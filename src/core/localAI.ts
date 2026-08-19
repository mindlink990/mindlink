export type AIStatus = 'idle' | 'loading' | 'ready' | 'generating' | 'error';
export interface AIModelInfo { id: string; name: string; sizeMb: number; contextLength: number; runtime: 'webgpu' | 'wasm' | 'mock'; installed: boolean; }
export interface GenerationOptions { temperature?: number; maxTokens?: number; signal?: AbortSignal; }
export interface LocalAIEngine { getStatus(): AIStatus; getModel(): AIModelInfo | null; isSupported(): boolean; load(model: AIModelInfo, onProgress?: (progress: number, text?: string) => void): Promise<void>; generate(prompt: string, options?: GenerationOptions): Promise<string>; unload(): Promise<void>; }

/** Real browser-local inference through WebLLM. No cloud inference endpoint is used. */
export class BrowserLocalAI implements LocalAIEngine {
  private status: AIStatus = 'idle'; private model: AIModelInfo | null = null; private engine: any = null;
  getStatus(): AIStatus { return this.status; }
  getModel(): AIModelInfo | null { return this.model; }
  isSupported(): boolean { return typeof window !== 'undefined' && typeof navigator !== 'undefined' && 'gpu' in navigator; }
  async load(model: AIModelInfo, onProgress?: (progress: number, text?: string) => void): Promise<void> {
    this.status = 'loading';
    try {
      if (!this.isSupported()) throw new Error('WebGPU is not available in this browser.');
      if (model.runtime !== 'webgpu') throw new Error('This model requires a WebGPU runtime.');
      const webllm = await import('@mlc-ai/web-llm');
      this.engine = await webllm.CreateMLCEngine(model.id, { initProgressCallback: (report: { progress?: number; text?: string }) => onProgress?.(report.progress ?? 0, report.text) });
      this.model = { ...model, installed: true }; this.status = 'ready';
    } catch (error) { this.engine = null; this.status = 'error'; throw error instanceof Error ? error : new Error('Unable to load the local model.'); }
  }
  async generate(prompt: string, options: GenerationOptions = {}): Promise<string> {
    if (!this.engine || this.status !== 'ready') throw new Error('Local AI model is not ready.');
    this.status = 'generating';
    try {
      const response = await this.engine.chat.completions.create({ messages: [{ role: 'user', content: prompt }], temperature: options.temperature ?? 0.7, max_tokens: options.maxTokens ?? 512, stream: false });
      return response.choices?.[0]?.message?.content ?? '';
    } finally { this.status = 'ready'; }
  }
  async unload(): Promise<void> { try { await this.engine?.unload?.(); } finally { this.engine = null; this.model = null; this.status = 'idle'; } }
}
export function getBrowserAIInfo() { const webgpu = typeof navigator !== 'undefined' && 'gpu' in navigator; return { webgpu, secureContext: typeof window !== 'undefined' ? window.isSecureContext : false }; }
