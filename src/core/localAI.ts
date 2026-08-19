import {
  CreateMLCEngine,
  prebuiltAppConfig,
  type MLCEngine,
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
  generate(
    prompt: string,
    options?: GenerationOptions,
  ): Promise<string>;
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

type WebLLMModelRecord = {
  model_id: string;
  model?: string;
  model_lib?: string;
};

function configuredModel(
  id: string,
): WebLLMModelRecord | undefined {
  return prebuiltAppConfig.model_list.find(
    (entry) => entry.model_id === id,
  ) as WebLLMModelRecord | undefined;
}

/**
 * Browser-local inference via WebLLM/WebGPU.
 *
 * Model weights are downloaded from the configured WebLLM
 * Hugging Face repository on first install and then cached
 * locally by WebLLM.
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

    if (
      typeof crossOriginIsolated !== 'undefined' &&
      !crossOriginIsolated
    ) {
      this.status = 'error';

      throw new Error(
        'Local AI needs cross-origin isolation. ' +
          'Refresh the page after the latest deployment. ' +
          'Make sure COOP and COEP headers are enabled.',
      );
    }

    try {
      const entry = configuredModel(model.id);

      if (!entry) {
        throw new Error(
          `Model ${model.id} is not included in this WebLLM build.`,
        );
      }

      if (!entry.model) {
        throw new Error(
          `Model ${model.id} does not have a repository URL in WebLLM configuration.`,
        );
      }

      onProgress?.(
        0.01,
        'Checking local model cache…',
      );

      /*
       * CreateMLCEngine is responsible for:
       *
       * 1. Loading mlc-chat-config.json
       * 2. Loading tokenizer files
       * 3. Downloading model shards
       * 4. Downloading the compatible WebGPU WASM library
       * 5. Caching everything locally
       */
      this.engine = await CreateMLCEngine(model.id, {
        appConfig: prebuiltAppConfig,

        initProgressCallback: (report: {
          progress?: number;
          text?: string;
        }) => {
          onProgress?.(
            report.progress ?? 0,
            report.text,
          );
        },
      });

      this.model = {
        ...model,
        installed: true,
      };

      this.status = 'ready';

      onProgress?.(
        1,
        'Local model ready.',
      );
    } catch (e) {
      this.status = 'error';
      this.engine = null;

      const reason =
        e instanceof Error
          ? e.message
          : String(e);

      throw new Error(
        `Local model could not be loaded: ${reason}. ` +
          'The first installation requires internet access ' +
          'and enough browser storage. After successful caching, ' +
          'inference can run offline.',
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
      const request: {
        messages: Array<{
          role: 'system' | 'user';
          content: string;
        }>;
        temperature: number;
        max_tokens: number;
      } = {
        messages: [
          {
            role: 'system',
            content:
              'You are MindMesh, a private offline assistant. Be concise, accurate and honest.',
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
      };

      const result =
        await this.engine.chat.completions.create(
          request,
        );

      return (
        result.choices[0]?.message?.content ??
        ''
      );
    } finally {
      this.status = 'ready';
    }
  }

  async unload(): Promise<void> {
    if (this.engine) {
      await this.engine.unload();
    }

    this.engine = null;
    this.model = null;
    this.status = 'idle';
  }
}

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
      typeof crossOriginIsolated !== 'undefined' &&
      crossOriginIsolated,
  };
}

/**
 * Tests the actual WebLLM model configuration files
 * instead of incorrectly testing the Hugging Face
 * repository HTML page.
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

  /*
   * WebGPU adapter test
   */
  let adapter = false;

  if (webgpu) {
    try {
      const gpu = (
        navigator as Navigator & {
          gpu: {
            requestAdapter: () => Promise<unknown>;
          };
        }
      ).gpu;

      adapter = !!(await gpu.requestAdapter());

      if (!adapter) {
        notes.push(
          'WebGPU is available but no GPU adapter was returned.',
        );
      }
    } catch (e) {
      notes.push(
        `WebGPU adapter request failed: ${
          e instanceof Error
            ? e.message
            : String(e)
        }`,
      );
    }
  } else {
    notes.push(
      'WebGPU API is unavailable.',
    );
  }

  /*
   * Cross-origin isolation
   */
  if (!isolated) {
    notes.push(
      'Cross-origin isolation is disabled. ' +
        'The deployment must send COOP and COEP headers.',
    );
  }

  /*
   * Browser storage
   */
  let storage = false;

  try {
    const estimate =
      await navigator.storage?.estimate();

    storage = !!estimate;

    if (
      estimate?.quota &&
      estimate.quota <
        model.sizeMb *
          1024 *
          1024 *
          1.2
    ) {
      notes.push(
        `Browser storage quota may be too small for a ${model.sizeMb} MB model.`,
      );
    }
  } catch {
    notes.push(
      'Browser storage estimate unavailable.',
    );
  }

  /*
   * WebLLM model configuration
   */
  const entry = configuredModel(model.id);

  const modelUrl =
    typeof entry?.model === 'string'
      ? entry.model
      : undefined;

  let modelFetch =
    'not tested';

  if (!entry) {
    notes.push(
      `Model ${model.id} is missing from WebLLM prebuiltAppConfig.`,
    );
  }

  if (!modelUrl) {
    notes.push(
      'WebLLM model repository URL is missing from the installed model configuration.',
    );
  } else {
    /*
     * IMPORTANT:
     *
     * Do NOT fetch the Hugging Face repository HTML page.
     *
     * Test the actual WebLLM configuration file.
     */
    const baseUrl =
      modelUrl.replace(/\/+$/, '');

    const configUrl =
      `${baseUrl}/resolve/main/mlc-chat-config.json`;

    try {
      const response = await fetch(
        configUrl,
        {
          method: 'GET',
          cache: 'no-store',
          mode: 'cors',
          redirect: 'follow',
        },
      );

      modelFetch =
        `HTTP ${response.status}`;

      if (!response.ok) {
        notes.push(
          `mlc-chat-config.json returned HTTP ${response.status}.`,
        );
      } else {
        notes.push(
          'mlc-chat-config.json is reachable from the browser.',
        );
      }
    } catch (e) {
      modelFetch =
        'blocked/failed';

      notes.push(
        `Model repository fetch failed: ${
          e instanceof Error
            ? e.message
            : String(e)
        }`,
      );
    }

    /*
     * Test tokenizer configuration separately.
     */
    const tokenizerConfigUrl =
      `${baseUrl}/resolve/main/tokenizer_config.json`;

    try {
      const response = await fetch(
        tokenizerConfigUrl,
        {
          method: 'GET',
          cache: 'no-store',
          mode: 'cors',
          redirect: 'follow',
        },
      );

      if (!response.ok) {
        notes.push(
          `tokenizer_config.json returned HTTP ${response.status}.`,
        );
      } else {
        notes.push(
          'tokenizer_config.json is reachable from the browser.',
        );
      }
    } catch (e) {
      notes.push(
        `Tokenizer config fetch failed: ${
          e instanceof Error
            ? e.message
            : String(e)
        }`,
      );
    }
  }

  /*
   * Secure context
   */
  if (!secureContext) {
    notes.push(
      'The page is not a secure context. WebGPU requires HTTPS or localhost.',
    );
  }

  /*
   * Final diagnostic
   */
  if (
    webgpu &&
    adapter &&
    secureContext &&
    isolated &&
    modelFetch.startsWith('HTTP 2')
  ) {
    notes.push(
      'Browser, WebGPU, isolation and WebLLM model configuration look reachable.',
    );
  }

  return {
    secureContext,
    crossOriginIsolated: isolated,
    webgpu,
    adapter,
    storage,
    modelConfigured: !!entry,
    modelUrl,
    modelFetch,
    notes,
  };
}
