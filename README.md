# MindMesh

**AI Without the Internet.**

MindMesh is an offline-first AI assistant concept designed to keep conversations and knowledge on-device, with future Bluetooth/Wi-Fi Direct knowledge exchange.

## V1
- Mobile-first dark futuristic web app
- Chat with clearly labelled offline demo responses
- Local conversation persistence
- Knowledge package prototype
- Network/mesh prototype UI
- Free/Pro configurable limits
- Privacy/offline indicators
- Responsive desktop layout

## Run
```bash
npm install
npm run dev
```

Build with `npm run build`.

## Architecture
The V1 shell is intentionally modular and keeps future extension points for Local LLM/RAG, Bluetooth, Wi-Fi Direct, encryption and mesh routing.

## Privacy
No account or cloud AI is required by the V1 UI. Conversations are stored locally in the browser. Network sharing is not implemented and nothing is shared automatically.

## Roadmap
V2 — real local LLM + local retrieval
V3 — Bluetooth/Wi-Fi Direct knowledge exchange
V4 — encrypted AI mesh
Later — Android and iOS clients
