import {
  CreateMLCEngine,
  prebuiltAppConfig,
  type MLCEngine,
  type AppConfig,
} from '@mlc-ai/web-llm';

export type AIStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'generating'
  | 'error';

export interface AIModelInfo {
  id: string;
  name: string;
  sizeMb: number;
  contextLength: number;
  runtime: 'webgpu';
  installed: boolean;
}

export interface GenerationOptions {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export interface LocalAIEngine {
  getStatus(): AIStatus;
  getModel(): AIModelInfo | null;
  isSupported(): boolean;
  load(
    model: AIModelInfo,
    onProgress?: (progress: number, text?: string) => void,
  ): Promise<void>;
  generate(prompt: string, options?: GenerationOptions): Promise<string>;
  unload(): Promise<void>;
}

export interface AIDiagnostics {
  secureContext: boolean;
  crossOriginIsolated: boolean;
  webgpu: boolean;
  adapter: boolean;
  storage: boolean;
  modelConfigured: boolean;
  modelUrl?: string;
  modelFetch?: string;
  notes: string[];
}

/*
 * IMPORTANT:
 * Use the official WebLLM prebuilt model.
 *
 * Model:
 * Llama-3.2-1B-Instruct-q4f16_1-MLC
 *
 * The model repository contains:
 * - mlc-chat-config.json
 * - tokenizer.json
 * - tokenizer_config.json
 * - params_shard_*.bin
 *
 * WebLLM downloads these files directly in the browser
 * and caches them locally.
 */

const MODEL_ID = 'Llama-3.2-1B-Instruct-q4f16_1-MLC';

const MODEL_URL =
  'https://huggingface.co/mlc-ai/Llama-3.2-1B-Instruct-q4f16_1-MLC';

const MODEL_LIB_URL =
  'https://raw.githubusercontent.com/mlc-ai/binary-mlc-llm-libs/main/web-llm-models/v0_2_84/base/Llama-3.2-1B-Instruct-q4f16_1_cs1k-webgpu.wasm';

/*
 * Do NOT use HEAD requests against Hugging Face for diagnostics.
 *
 * A HEAD/CORS request can fail even when WebLLM itself can download
 * the actual model files.
 *
 * Therefore the real CreateMLCEngine() load is the authoritative test.
 */

const localAppConfig: AppConfig = {
  ...prebuiltAppConfig,

  cacheBackend: 'cache',

  model_list: [
    {
      model: MODEL_URL,
      model_id: MODEL_ID,
      model_lib: MODEL_LIB_URL,

      low_resource_required: true,

      vram_required_MB: 879.04,

      overrides: {
        context_window_size: 4096,
      },
    },
  ],
};

type WebLLMModelRecord = {
  model_id: string;
  model?: string;
  model_lib?: string;
  overrides?: {
    context_window_size?: number;
  };
};

function configuredModel(
  id: string,
): WebLLMModelRecord | undefined {
  return localAppConfig.model_list.find(
    (entry) => entry.model_id === id,
  ) as WebLLMModelRecord | undefined;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

/**
 * Browser-local inference via WebLLM/WebGPU.
 *
 * Model weights are downloaded once and cached by the browser.
 * After successful caching, inference can work without network.
 */
export class BrowserLocalAI implements LocalAIEngine {
  private status: AIStatus = 'idle';

  private model: AIModelInfo | null = null;

  private engine: MLCEngine | null = null;

  getStatus(): AIStatus {
    return this.status;
  }

  getModel(): AIModelInfo | null {
    return this.model;
  }

  isSupported(): boolean {
    return (
      typeof navigator !== 'undefined' &&
      'gpu' in navigator
    );
  }

  async load(
    model: AIModelInfo,
    onProgress?: (
      progress: number,
      text?: string,
    ) => void,
  ): Promise<void> {
    this.status = 'loading';

    if (!this.isSupported()) {
      this.status = 'error';

      throw new Error(
        'WebGPU is not available on this device/browser.',
      );
    }

    /*
     * WebLLM needs cross-origin isolation for the local
     * WebGPU/WASM environment used by this application.
     */
    if (
      typeof crossOriginIsolated !== 'undefined' &&
      !crossOriginIsolated
    ) {
      this.status = 'error';

      throw new Error(
        'Cross-origin isolation is disabled. ' +
        'Make sure the deployed site sends COOP and COEP headers, ' +
        'then completely reload the page.',
      );
    }

    if (model.id !== MODEL_ID) {
      this.status = 'error';

      throw new Error(
        `Unsupported model: ${model.id}. ` +
        `Use ${MODEL_ID}.`,
      );
    }

    try {
      onProgress?.(
        0.01,
        'Checking WebGPU and local model cache…',
      );

      /*
       * IMPORTANT:
       *
       * Do not manually fetch:
       * tokenizer.json
       * tokenizer_config.json
       * mlc-chat-config.json
       *
       * WebLLM must do this itself because it also handles
       * model caching and model loading.
       */

      onProgress?.(
        0.03,
        'Connecting to the model repository…',
      );

      const engine = await CreateMLCEngine(
        MODEL_ID,
        {
          appConfig: localAppConfig,

          initProgressCallback: (report) => {
            const progress =
              typeof report?.progress === 'number'
                ? report.progress
                : 0;

            const text =
              typeof report?.text === 'string'
                ? report.text
                : 'Loading local AI model…';

            onProgress?.(progress, text);
          },

          logLevel: 'INFO',
        },
        {
          context_window_size: 4096,
        },
      );

      this.engine = engine;

      this.model = {
        ...model,
        id: MODEL_ID,
        name: 'Llama 3.2 1B Instruct (4-bit)',
        sizeMb: 900,
        contextLength: 4096,
        runtime: 'webgpu',
        installed: true,
      };

      this.status = 'ready';

      onProgress?.(
        1,
        'Local AI model ready.',
      );
    } catch (error) {
      this.status = 'error';
      this.engine = null;

      const reason = errorMessage(error);

      /*
       * Keep the original WebLLM error visible.
       * This is important for diagnosing actual model-download
       * failures instead of hiding them behind "Failed to fetch".
       */
      throw new Error(
        [
          'Local AI model could not be loaded.',
          '',
          `WebLLM error: ${reason}`,
          '',
          'Model:',
          MODEL_URL,
          '',
          'If this is the first installation, the browser needs',
          'internet access to download the model files.',
          '',
          'After the download succeeds, WebLLM caches the model',
          'locally for offline inference.',
        ].join('\n'),
      );
    }
  }

  async generate(
    prompt: string,
    options: GenerationOptions = {},
  ): Promise<string> {
    if (
      !this.engine ||
      this.status !== 'ready'
    ) {
      throw new Error(
        'Local AI model is not ready.',
      );
    }

    this.status = 'generating';

    try {
      if (options.signal?.aborted) {
        throw new DOMException(
          'Generation aborted.',
          'AbortError',
        );
      }

      const response =
        await this.engine.chat.completions.create({
          messages: [
            {
              role: 'system',
              content:
                'You are MindMesh, a private offline assistant. ' +
                'Be concise, helpful and honest.',
            },
            {
              role: 'user',
              content: prompt,
            },
          ],

          temperature:
            options.temperature ?? 0.7,

          max_tokens:
            options.maxTokens ?? 512,
        });

      return (
        response.choices[0]?.message?.content ??
        ''
      );
    } finally {
      this.status = 'ready';
    }
  }

  async unload(): Promise<void> {
    try {
      if (this.engine) {
        await this.engine.unload();
      }
    } finally {
      this.engine = null;
      this.model = null;
      this.status = 'idle';
    }
  }
}

/**
 * Basic browser capability information.
 */
export function getBrowserAIInfo() {
  return {
    webgpu:
      typeof navigator !== 'undefined' &&
      'gpu' in navigator,

    secureContext:
      typeof window !== 'undefined'
        ? window.isSecureContext
        : false,

    crossOriginIsolated:
      typeof crossOriginIsolated !== 'undefined'
        ? crossOriginIsolated
        : false,
  };
}

/**
 * Diagnostics.
 *
 * IMPORTANT:
 * We intentionally DO NOT perform a manual HEAD/GET request
 * against Hugging Face here.
 *
 * "Failed to fetch" from a manual browser request does not prove
 * that WebLLM cannot load the model. WebLLM has its own model
 * downloader/cache implementation.
 *
 * The actual CreateMLCEngine() call in load() is the real test.
 */
export async function diagnoseLocalAI(
  model: AIModelInfo,
): Promise<AIDiagnostics> {
  const secureContext =
    typeof window !== 'undefined' &&
    window.isSecureContext;

  const isolated =
    typeof crossOriginIsolated !== 'undefined' &&
    crossOriginIsolated;

  const webgpu =
    typeof navigator !== 'undefined' &&
    'gpu' in navigator;

  const notes: string[] = [];

  let adapter = false;

  if (webgpu) {
    try {
      const gpu =
        (
          navigator as Navigator & {
            gpu: {
              requestAdapter: () => Promise<unknown>;
            };
          }
        ).gpu;

      adapter = !!(await gpu.requestAdapter());

      if (!adapter) {
        notes.push(
          'WebGPU exists, but no GPU adapter was returned.',
        );
      }
    } catch (error) {
      notes.push(
        `WebGPU adapter request failed: ${errorMessage(error)}`,
      );
    }
  } else {
    notes.push(
      'WebGPU API is unavailable.',
    );
  }

  if (!secureContext) {
    notes.push(
      'The page is not a secure context. Use HTTPS.',
    );
  }

  if (!isolated) {
    notes.push(
      'Cross-origin isolation is disabled. ' +
      'Verify COOP/COEP response headers and reload.',
    );
  }

  let storage = false;

  try {
    if (
      typeof navigator !== 'undefined' &&
      navigator.storage?.estimate
    ) {
      const estimate =
        await navigator.storage.estimate();

      storage = true;

      if (
        estimate.quota &&
        estimate.quota <
          model.sizeMb *
            1024 *
            1024 *
            1.2
      ) {
        notes.push(
          `Browser storage quota may be too small for ` +
          `a ${model.sizeMb} MB model.`,
        );
      }
    }
  } catch (error) {
    notes.push(
      `Browser storage estimate failed: ${errorMessage(error)}`,
    );
  }

  const entry =
    configuredModel(model.id);

  const modelUrl =
    typeof entry?.model === 'string'
      ? entry.model
      : undefined;

  /*
   * Do NOT use fetch(modelUrl, { method: 'HEAD' }).
   *
   * It was producing the misleading:
   *
   * "Model repository fetch failed: Failed to fetch"
   *
   * even before WebLLM attempted its actual model download.
   */
  const modelFetch =
    entry && modelUrl
      ? 'WebLLM-managed'
      : 'not-configured';

  if (!entry) {
    notes.push(
      `Model ${model.id} is not included in the local WebLLM configuration.`,
    );
  }

  if (!modelUrl) {
    notes.push(
      'WebLLM model repository URL is missing.',
    );
  }

  if (
    webgpu &&
    adapter &&
    secureContext &&
    isolated &&
    entry &&
    modelUrl
  ) {
    notes.push(
      'Browser, WebGPU, GPU adapter, secure context, ' +
      'and WebLLM model configuration look ready.',
    );

    notes.push(
      'Model download will be tested by CreateMLCEngine(), ' +
      'not by a manual HEAD request.',
    );
  }

  return {
    secureContext,

    crossOriginIsolated:
      isolated,

    webgpu,

    adapter,

    storage,

    modelConfigured:
      !!entry,

    modelUrl,

    modelFetch,

    notes,
  };
}
