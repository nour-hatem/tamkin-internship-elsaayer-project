# AI/Voice Layer — Progress Log (middleware/)

Companion to `DECISIONS.md`. Tracks the real execution status of the AI layer
within `middleware/src/ai/**`.

---

## Status at a glance

| Component | Port | Status | Test Spec |
|---|---|---|---|
| **STT** | `ISttAdapter` | Migrated (`ElevenLabsSttAdapter` + `StubSttAdapter`) | `stt/elevenlabs-stt.adapter.spec.ts` |
| **TTS** | `ITtsAdapter` | Migrated (`ElevenLabsTtsAdapter` + `StubTtsAdapter`) | `tts/elevenlabs-tts.adapter.spec.ts` |
| **NLU** | `INluAdapter` | Migrated (`NluRulesAdapter` + `StubNluAdapter`) | `nlu/nlu-rules.adapter.spec.ts` |
| **LLM fallback** | `INluAdapter` | Migrated (`LlmNluAdapter`) | `llm/llm-nlu.adapter.spec.ts` |
| **LLM generic** | `ILlmAdapter` | Existing skeleton untouched (`StubLlmAdapter`) | — |
| **Config** | `AiConfigService` | Implemented with env defaults & validation | `config/ai-config.service.spec.ts` |
| **Wiring** | `AiModule` | Registered alongside existing stubs | `app.module.ts` |
| **Kiosk Flow** | `KioskService` | Integrated (`CONTACT_METHOD_ASKING` gate + retries) | `kiosk/kiosk.service.spec.ts` |

---

## Test Execution Log

*(Updated automatically after running `npm test` inside `middleware/`)*

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
