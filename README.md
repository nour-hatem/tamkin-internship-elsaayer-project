# Toyota Kiosk & Queue System MVP

Internal architecture and initial backend + frontend skeleton for the Toyota Service Center Voice & QR Kiosk system. Built with NestJS, Next.js, Prisma, PostgreSQL, Redis, and Socket.IO following Hexagonal (Ports & Adapters) architecture.

---

## Task Convergence Architecture

Both **Voice Kiosk (Sara)** and **QR Check-in (Rahma)** channels converge into a single shared `CheckInService`. Neither channel touches the gate or queue directly.

```
   LPR Camera / Simulator
             │ (PLATE_READ)
             ▼
        SAP Module (Prisma / PostgreSQL lookup)
             │ (SAP_LOOKUP_RESULT)
             ├──────────────────────────┐
             ▼                          ▼
    Voice Channel (Sara)        QR Channel (Rahma)
(If ACTIVE_APPROACH=voice)   (If ACTIVE_APPROACH=qr)
             │                          │
             └────────────┬─────────────┘
                          ▼
             Shared CheckInService.submit()
              ├── 1. Duplicate check
              ├── 2. Queue enqueue
              └── 3. Gate opening decision -> GateAdapter
```

---

## Quick Start

### 1. Prerequisites
- Node.js `v22.19.0` or `>=20.0.0`
- Docker & Docker Compose

### 2. Start PostgreSQL & Redis
```bash
docker compose up -d
```

### 3. Setup Unified Environment & Database
```bash
# At repository root:
cp .env.example .env

# Generate Prisma Client & Run Seed Data
npm run prisma:generate
npm run prisma:seed
```

*Note: Seed data inserts mock customers with plates: `ABC-1234`, `XYZ-9876`, `KSA-5555`, `TOY-2026`.*

### 4. Start Development (Full Stack)
```bash
npm run dev
# Backend running on http://localhost:3001 (Health Check: http://localhost:3001/health)
# Frontend running on http://localhost:3000 (Developer Console: http://localhost:3000/console)
```

Or start individually:
```bash
npm run dev:middleware   # Backend NestJS on :3001
npm run dev:web          # Frontend Next.js on :3000
```

---

## Developer Console & LPR Simulation

1. Open `http://localhost:3000/console`.
2. Select a Gate ID (e.g., `gate-1`). The console automatically joins WebSocket room `gate:gate-1` via `lib/socket.ts` and reconnects on connection loss.
3. Enter a plate number (e.g., `ABC-1234`) and click **Simulate LPR Read**.
4. Observe the live stream:
   - Backend `LprController` calls `LprService` stub.
   - `SapService` queries Postgres via Prisma and emits `SAP_LOOKUP_RESULT`.
   - The active channel (`ACTIVE_APPROACH`) calls `CheckInService.submit()`.
   - `CheckInService` enqueues the customer, opens the gate stub, and broadcasts `gate.state` to the console socket.

---

## Active Approach Configuration (`ACTIVE_APPROACH`)

In `middleware/.env`:
- `ACTIVE_APPROACH=voice`: Sara's `KioskService` processes `SAP_LOOKUP_RESULT` and ignores QR events.
- `ACTIVE_APPROACH=qr`: Rahma's `QrService` processes `SAP_LOOKUP_RESULT` and ignores Voice events.

Check current active adapters and approach configuration via REST:
```bash
curl http://localhost:3001/health
```

---

## Adapter Selection via Environment Variables

Every external dependency uses hexagonal ports with environment-selected adapters:

| Dependency | Port Token | Env Variable | Options |
|---|---|---|---|
| SAP Lookup | `SAP_ADAPTER_TOKEN` | `SAP_ADAPTER` | `prisma` (default), `stub` |
| Plate Reader | `LPR_ADAPTER_TOKEN` | `LPR_ADAPTER` | `stub` |
| Gate Controller | `GATE_ADAPTER_TOKEN` | `GATE_ADAPTER` | `stub` |
| Speech-To-Text | `STT_ADAPTER_TOKEN` | `STT_ADAPTER` | `stub` |
| Text-To-Speech | `TTS_ADAPTER_TOKEN` | `TTS_ADAPTER` | `stub` |
| NLU | `NLU_ADAPTER_TOKEN` | `NLU_ADAPTER` | `stub` |
| LLM | `LLM_ADAPTER_TOKEN` | `LLM_ADAPTER` | `stub` |

---

## Team Breakdown & Remaining TODOs

### Completed in Skeleton
- [x] Ports & Adapters for LPR, SAP, Gate, STT, TTS, NLU, LLM.
- [x] Prisma PostgreSQL datasource with `CustomerProfile` model and seed script.
- [x] Socket reconnection handling in `lib/socket.ts` (re-emits `kiosk.join` on `connect`).
- [x] Shared `CheckInService` with duplicate prevention, gate decision, and queue entry generation.
- [x] Developer console at `/console` with LPR trigger button and live socket listener.
- [x] `GET /health` endpoint for adapter inspection.

### TODO per Teammate
- **Nour (AI / Speech Layer)**:
  - Implement real streaming/file adapters for STT (`whisper`/`vosk`), TTS (`piper`/`elevenlabs`), NLU, and LLM inside `middleware/src/ai/`.
- **Sara (Voice Kiosk)**:
  - Expand `middleware/src/kiosk/kiosk.service.ts` to implement full XState / finite state machine for multi-turn audio conversation.
- **Rahma (QR Check-In)**:
  - Build QR code generation and mobile web check-in form endpoints in `middleware/src/qr/`.
