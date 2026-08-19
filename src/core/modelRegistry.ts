import type { AIModelInfo } from './localAI';

// WebLLM model ID. The model is fetched once by the browser and then cached locally.
export const LOCAL_MODELS: AIModelInfo[] = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    name: 'Llama 3.2 1B Instruct (Q4)',
    sizeMb: 900,
    contextLength: 4096,
    runtime: 'webgpu',
    installed: false,
  },
];

export function findModel(id: string): AIModelInfo | undefined {
  return LOCAL_MODELS.find((model) => model.id === id);
}
