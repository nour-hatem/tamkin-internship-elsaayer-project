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

### Real test output (2026-10-01) — Week 3

Ran via: `cd middleware && npm test`
Jest: 29.7.0
Branch: `feature/admin-dashboard-backend`

```
PASS src/ai/config/ai-config.service.spec.ts (6.358 s)
PASS src/ai/nlu/nlu-rules.adapter.spec.ts (6.413 s)
PASS src/ai/stt/elevenlabs-stt.adapter.spec.ts (6.243 s)
PASS src/ai/tts/elevenlabs-tts.adapter.spec.ts (6.592 s)
PASS src/ai/llm/llm-nlu.adapter.spec.ts (6.407 s)
PASS src/common/logger/logger.service.spec.ts (6.226 s)
PASS src/admin/admin.service.spec.ts (6.282 s)
PASS src/qr/qr.service.spec.ts (6.772 s)
PASS src/kiosk/kiosk.service.spec.ts (6.966 s)

Test Suites: 9 passed, 9 total
Tests:       164 passed, 164 total
Snapshots:   0 total
Time:        7.819 s
Ran all test suites.
```

**Delta from Week 2:** +2 suites (+1 `logger.service.spec.ts`, +1 `admin.service.spec.ts`), +10 tests.

#### New suites added in Week 3

| Suite | Tests | What it covers |
|---|---|---|
| `common/logger/logger.service.spec.ts` | 2 | Structured JSON output, correlationId propagation via AsyncLocalStorage |
| `admin/admin.service.spec.ts` | 8 | Gate connect, disconnect, multi-gate partial disconnect, reconnect overwrite, `getGateQueue` filter, `getGateQueue` empty, `getFullQueue` delegation |
