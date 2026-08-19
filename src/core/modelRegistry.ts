import type { AIModelInfo } from './localAI';

/** WebLLM 0.2.84 prebuilt model. Keep the id in sync with prebuiltAppConfig. */
export const LOCAL_MODELS: AIModelInfo[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Instruct (4-bit)',
    sizeMb: 900,
    contextLength: 4096,
    runtime: 'webgpu',
    installed: false,
  },
];

export function findModel(id: string): AIModelInfo | undefined {
  return LOCAL_MODELS.find((model) => model.id === id);
}
