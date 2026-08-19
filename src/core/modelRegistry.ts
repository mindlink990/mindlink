import type { AIModelInfo } from './localAI';

/**
 * Mobile-first local model list.
 *
 * The default model is intentionally the smaller SmolLM2 360M q4f32 build:
 * it is about 580 MB, is marked low-resource by WebLLM, and does not require
 * shader-f16. This makes first-install much more realistic on Android Chrome
 * than the ~900 MB Llama 3.2 1B model.
 */
export const LOCAL_MODELS: AIModelInfo[] = [
  {
    id: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
    name: 'SmolLM2 360M Instruct (4-bit)',
    sizeMb: 580,
    contextLength: 4096,
    runtime: 'webgpu',
    installed: false,
  },
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
