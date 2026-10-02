# AI/Voice Layer — Progress Log (middleware/)

Companion to `DECISIONS.md`. Tracks the real execution status of the AI layer
within `middleware/src/ai/**`.

---

## Status at a glance

| Component | Port / Module | Status | Test Spec |
|---|---|---|---|
| **STT** | `ISttAdapter` | ✅ Migrated (`ElevenLabsSttAdapter` + `StubSttAdapter`) | `stt/elevenlabs-stt.adapter.spec.ts` |
| **TTS** | `ITtsAdapter` | ✅ Migrated (`ElevenLabsTtsAdapter` + `StubTtsAdapter`) | `tts/elevenlabs-tts.adapter.spec.ts` |
| **NLU** | `INluAdapter` | ✅ Migrated (`NluRulesAdapter` + `StubNluAdapter`) | `nlu/nlu-rules.adapter.spec.ts` |
| **LLM fallback** | `INluAdapter` | ✅ Migrated (`LlmNluAdapter`) | `llm/llm-nlu.adapter.spec.ts` |
| **LLM generic** | `ILlmAdapter` | ✅ Existing skeleton untouched (`StubLlmAdapter`) | — |
| **Config** | `AiConfigService` | ✅ Implemented with env defaults & validation | `config/ai-config.service.spec.ts` |
| **Wiring** | `AiModule` | ✅ Registered alongside existing stubs | `app.module.ts` |
| **Kiosk Flow** | `KioskService` | ✅ Integrated (`CONTACT_METHOD_ASKING` gate + retries) | `kiosk/kiosk.service.spec.ts` |
| **DI token fix** | `KioskModule` | ✅ Canonical token constants replace string literals | `kiosk/kiosk.service.spec.ts` |
| **Gate injection fix** | `KioskService` | ✅ Injects `GateService` instead of raw adapter | `kiosk/kiosk.service.spec.ts` |
| **Structured logging** | `LoggerModule` | ✅ pino dual-sink (stdout pretty/JSON + daily file rotation) | `common/logger/logger.service.spec.ts` |
| **Admin backend** | `AdminModule` | ✅ Gate tracking + REST endpoints + domain events | `admin/admin.service.spec.ts` |
| **Admin gateway** | `AdminGateway` | ✅ Socket.IO /gate namespace + ticket event broadcasting | `admin/admin.gateway.spec.ts` |
| **Admin frontend** | `web/app/admin` | ✅ Connected Gates screen (REST + socket real-time) | — (Next.js page) |

---

## Test Execution Log

*(Updated after running `npm test` inside `middleware/`)*

### Real test output (2026-09-19)

Ran via: `cd middleware && npm test`
Jest: 29.7.0

```
PASS src/ai/nlu/nlu-rules.adapter.spec.ts
PASS src/ai/config/ai-config.service.spec.ts
PASS src/kiosk/kiosk.service.spec.ts
PASS src/ai/stt/elevenlabs-stt.adapter.spec.ts
PASS src/ai/tts/elevenlabs-tts.adapter.spec.ts
PASS src/qr/qr.service.spec.ts
PASS src/ai/llm/llm-nlu.adapter.spec.ts

Test Suites: 7 passed, 7 total
Tests:       154 passed, 154 total
Snapshots:   0 total
Time:        6.843 s, estimated 7 s
Ran all test suites.
```

---

### Real test output (2026-10-02) — Contract Alignment

Ran via: `cd middleware && npm test`
Jest: 29.7.0
Branch: `feature/admin-dashboard-backend`

```
PASS src/ai/config/ai-config.service.spec.ts (9.646 s)
PASS src/ai/nlu/nlu-rules.adapter.spec.ts (10.128 s)
PASS src/ai/stt/elevenlabs-stt.adapter.spec.ts (10.204 s)
PASS src/admin/admin.gateway.spec.ts (10.322 s)
PASS src/ai/llm/llm-nlu.adapter.spec.ts (10.272 s)
PASS src/ai/tts/elevenlabs-tts.adapter.spec.ts (10.385 s)
PASS src/queue/queue.service.spec.ts (10.384 s)
PASS src/kiosk/kiosk.service.spec.ts (10.643 s)
PASS src/admin/admin.service.spec.ts (10.66 s)
PASS src/qr/qr.service.spec.ts (10.847 s)
PASS src/common/logger/logger.service.spec.ts (10.814 s)

Test Suites: 11 passed, 11 total
Tests:       172 passed, 172 total
Snapshots:   0 total
Time:        12.037 s
Ran all test suites.
```

**Delta from Week 2:** +4 suites (+1 `logger.service.spec.ts`, +1 `admin.service.spec.ts`, +1 `queue.service.spec.ts`, +1 `admin.gateway.spec.ts`), +18 tests.

#### New suites added

| Suite | Tests | What it covers |
|---|---|---|
| `common/logger/logger.service.spec.ts` | 2 | Structured JSON output, correlationId propagation via AsyncLocalStorage |
| `admin/admin.service.spec.ts` | 9 | Gate connect, GateInfo contract shape, disconnect, multi-gate partial disconnect, reconnect overwrite, `getGateQueue` filter, `getGateQueue` empty, `getFullQueue` delegation |
| `queue/queue.service.spec.ts` | 3 | `isToyotaCustomer: true` when found in SAP, `isToyotaCustomer: false` when not found, default to false |
| `admin/admin.gateway.spec.ts` | 4 | `joinGate`, `leaveGate`, `QUEUE_TICKET_ADDED` broadcast, `QUEUE_TICKET_STATUS_UPDATED` broadcast |
