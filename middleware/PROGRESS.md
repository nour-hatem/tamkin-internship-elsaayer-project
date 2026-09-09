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

---

## Test Execution Log

*(Updated automatically after running `npm test` inside `middleware/`)*

### Real test output (2026-09-09)

Ran via: `cd middleware && npm test`
Node version: v22.22.3
NestJS: 10.4.15
Jest: 29.7.0

```
PASS src/ai/config/ai-config.service.spec.ts
PASS src/ai/nlu/nlu-rules.adapter.spec.ts
PASS src/ai/stt/elevenlabs-stt.adapter.spec.ts
PASS src/ai/tts/elevenlabs-tts.adapter.spec.ts
PASS src/ai/llm/llm-nlu.adapter.spec.ts
PASS src/qr/qr.service.spec.ts

Test Suites: 6 passed, 6 total
Tests:       97 passed, 97 total
Snapshots:   0 total
Time:        5.481 s
Ran all test suites.
```
