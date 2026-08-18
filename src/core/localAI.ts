export type AIStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';

export interface AIModelInfo {
  id: string;
  name: string;
  sizeMb: number;
  contextLength: number;
  runtime: 'webgpu' | 'wasm' | 'mock';
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
  load(model: AIModelInfo): Promise<void>;
  generate(prompt: string, options?: GenerationOptions): Promise<string>;
  unload(): Promise<void>;
}

/**
 * V2 browser runtime boundary. A real WebGPU/WebAssembly model adapter can be
 * plugged in without changing ChatManager or the UI. This adapter deliberately
 * fails instead of pretending that a mock response is a real local LLM.
 */
export class BrowserLocalAI implements LocalAIEngine {
  private status: AIStatus = 'idle';
  private model: AIModelInfo | null = null;

  getStatus(): AIStatus { return this.status; }
  getModel(): AIModelInfo | null { return this.model; }
  isSupported(): boolean {
    return typeof window !== 'undefined' && 'gpu' in navigator;
  }

  async load(model: AIModelInfo): Promise<void> {
    this.status = 'loading';
    if (!this.isSupported()) {
      this.status = 'error';
      throw new Error('Local GPU inference is not available in this browser.');
    }
    if (!model.installed) {
      this.status = 'error';
      throw new Error('This model is not installed locally.');
    }
    // Runtime/model adapter integration point.
    this.model = model;
    this.status = 'ready';
  }

  async generate(_prompt: string, _options: GenerationOptions = {}): Promise<string> {
    if (this.status !== 'ready') throw new Error('Local AI model is not ready.');
    throw new Error('No local model runtime is installed yet. Connect a WebGPU/WebAssembly model adapter.');
  }

  async unload(): Promise<void> {
    this.model = null;
    this.status = 'idle';
  }
}

export function getBrowserAIInfo() {
  const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator;
  return { webgpu, secureContext: typeof window !== 'undefined' ? window.isSecureContext : false };
}
