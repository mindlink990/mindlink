import type { AIModelInfo } from './localAI';

export const LOCAL_MODELS: AIModelInfo[] = [
  {
    id: 'local-small-demo',
    name: 'MindMesh Small Local Model',
    sizeMb: 900,
    contextLength: 4096,
    runtime: 'webgpu',
    installed: false,
  },
];

export function findModel(id: string): AIModelInfo | undefined {
  return LOCAL_MODELS.find((model) => model.id === id);
}
