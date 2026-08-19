# MindMesh

**AI Without the Internet.**

MindMesh is an offline-first AI assistant concept designed to keep conversations and knowledge on-device, with future Bluetooth/Wi-Fi Direct knowledge exchange.

## V1
- Mobile-first dark futuristic web app
- Local conversation persistence
- Knowledge package prototype
- Network/mesh prototype UI
- Free/Pro configurable limits
- Privacy/offline indicators
- Responsive desktop layout

## V2.1 — Real local AI
- WebLLM browser inference through WebGPU
- Llama 3.2 1B Instruct Q4 model
- Local model loading and progress UI
- Real local chat generation after the model is loaded
- No cloud inference endpoint
- Browser-local model caching

**First model setup requires an internet connection to download the model assets. After the model is cached locally, inference can run without internet, subject to browser/device WebGPU support and available memory.**

## Run
```bash
npm install
npm run dev
```

Build with `npm run build`.

## Architecture
The app keeps the UI separate from the local AI engine. `BrowserLocalAI` owns WebLLM lifecycle and inference, while the model registry identifies supported local models. The architecture leaves room for local RAG, Bluetooth, Wi-Fi Direct, encryption and mesh routing.

## Privacy
No account or cloud AI is required for local inference. Conversations are stored locally in the browser. Nothing is shared automatically.

## Known limitations
- WebGPU is required for the current browser local model.
- The first model download is large and requires network access.
- Mobile browser performance and available GPU memory vary by device.
- Knowledge package indexing/RAG is the next integration step.
- Bluetooth/Wi-Fi Direct and mesh routing are not implemented yet.

## Roadmap
V2.2 — local package indexing + RAG
V3 — Bluetooth/Wi-Fi Direct knowledge exchange
V4 — encrypted AI mesh
Later — Android and iOS clients
