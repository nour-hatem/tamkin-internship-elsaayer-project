# AI/Voice Layer — Decision Log (middleware/)

Every autonomous decision taken while building `middleware/src/ai/**`, in the
order it was made. Companion progress notes live in `middleware/PROGRESS.md`.

---

## 2026-09-09 — Reconciliation: overnight root-level work vs. real skeleton

### DR-001 — The real skeleton already existed; the root src/ai/ work was built blind

During the previous session the agent operated under the (logged) assumption that
the repository had no existing skeleton (DECISIONS.md D-002 in src/ai/).
That assumption was **wrong**. The repository's `middleware/` directory, which
appeared as `.gitkeep`-only at survey time, had by this session been populated
with a real NestJS application and real port interfaces:

```
middleware/src/ai/
  stt/stt.port.ts          ISttAdapter, STT_ADAPTER_TOKEN
  tts/tts.port.ts          ITtsAdapter, TTS_ADAPTER_TOKEN
  nlu/nlu.port.ts          INluAdapter, NLU_ADAPTER_TOKEN
  llm/llm.port.ts          ILlmAdapter, LLM_ADAPTER_TOKEN
  stt/stub-stt.adapter.ts
  tts/stub-tts.adapter.ts
  nlu/stub-nlu.adapter.ts
  llm/stub-llm.adapter.ts
  ai.module.ts             wired into app.module.ts

middleware/src/common/dtos/
  nlu-result.dto.ts        NluResultDto interface (already shared)
```

The overnight work in `src/ai/` was stranded: it implemented its own ports with
different signatures and DI tokens, and lived outside the real NestJS app.
This entry records the concrete differences and migration decisions.

**Action taken:** all real implementation code was migrated from `src/ai/**`
into `middleware/src/ai/**`, adjusted to the REAL port interfaces. The stray
`src/` directory was deleted afterwards. See DR-002 through DR-010.

---

### Concrete differences found (Step 2 required report)

#### DR-002 — NluResult shape: discriminated union vs. flat DTO. Flat DTO wins.

| Dimension | Root overnight (VOID) | Canonical middleware DTO |
|---|---|---|
| File | `src/ai/common/nlu-result.ts` | `middleware/src/common/dtos/nlu-result.dto.ts` |
| Shape | Discriminated union, 4 named variants | Flat interface, 3 fields |
| `intent` | `'YES'|'NO'|'PHONE'|'UNKNOWN'` literals | `string` (open) |
| `confidence` | absent | `number` (required) |
| `entities` | absent | `Record<string,string|number|boolean>` (required) |
| `phone` | field on PHONE variant | absent; goes in `entities` |

**Migration:** adapters produce `NluResultDto` using this mapping:
- YES → `{ intent: 'YES', confidence: 0.98, entities: {} }`
- NO → `{ intent: 'NO', confidence: 0.98, entities: {} }`
- PHONE → `{ intent: 'PHONE', confidence: 0.99, entities: { phone: digits } }`
- UNKNOWN → `{ intent: 'UNKNOWN', confidence: 0.0, entities: {} }`

**FLAG FOR REVIEW:** `intent: string` is weaker than a discriminated union.
Callers (kiosk state machine) should guard with an exhaustive switch.
`nlu-result.dto.ts` was NOT changed — it is shared territory.

#### DR-003 — STT port signature differs; real port wins.

| | Root overnight | Real middleware port |
|---|---|---|
| Method | `transcribe(audio, language): Promise<SttResult>` | `transcribe(audioBuffer: Buffer): Promise<string>` |
| Return | `{ transcript: string }` | bare `string` |
| Language | explicit param | absent (read from config internally) |
| Token | `STT_ADAPTER = Symbol(...)` | `STT_ADAPTER_TOKEN = 'STT_ADAPTER_TOKEN'` |

**Migration:** `ElevenLabsSttAdapter` implements `ISttAdapter`. Language is read
from `AiConfigService` (`ELEVENLABS_LANGUAGE`, default `'ar'`).

#### DR-004 — TTS port has no language param; real port wins.

| | Root overnight | Real middleware port |
|---|---|---|
| Method | `synthesize(text, lang): Promise<Buffer>` | `synthesize(text: string): Promise<Buffer>` |
| Token | `TTS_ADAPTER = Symbol(...)` | `TTS_ADAPTER_TOKEN = 'TTS_ADAPTER_TOKEN'` |

**Migration:** `ElevenLabsTtsAdapter` implements `ITtsAdapter`. Language comes
from config (`ELEVENLABS_LANGUAGE`, default `'ar'`).

#### DR-005 — NLU port method is `parse`, not `interpret`; real port wins.

| | Root overnight | Real middleware port |
|---|---|---|
| Interface | `TranscriptInterpreter` | `INluAdapter` |
| Method | `interpret(transcript)` | `parse(text): Promise<NluResultDto>` |
| Token | `TRANSCRIPT_INTERPRETER = Symbol(...)` | `NLU_ADAPTER_TOKEN = 'NLU_ADAPTER_TOKEN'` |

**Migration:** `NluRulesAdapter` and `LlmNluAdapter` both implement
`INluAdapter.parse()`. Internal classification logic (yes/no/phone/unknown with
Arabic-Indic normalisation) is unchanged but now produces `NluResultDto`.

#### DR-006 — LLM port is generic `generateResponse`; overnight was NLU-specific.

The real `ILlmAdapter.generateResponse(prompt, context?): Promise<string>` is
generic; the overnight `LlmNluAdapter` implemented `TranscriptInterpreter`.

**Migration:** `LlmNluAdapter` implements `INluAdapter` (not `ILlmAdapter`),
because its job is to produce `NluResultDto`, not raw text. `StubLlmAdapter` and
`ILlmAdapter` are left untouched — other modules may be wired to `LLM_ADAPTER_TOKEN`.

#### DR-007 — DI tokens: Symbol vs. string literal. String wins (team's pattern).

The real skeleton uses string tokens (`'STT_ADAPTER_TOKEN'`). All migrated
adapters use the real string tokens. No change to the real ports.

#### DR-008 — AiConfigService is new; it is added as a helper, not wired into ai.module.ts

The real `ai.module.ts` uses `ConfigService` directly. `AiConfigService` is
brought in as `middleware/src/ai/config/ai-config.service.ts`. The existing
`ai.module.ts` factory is extended to register and inject it, but the stub
adapter providers are not removed.

#### DR-009 — Test harness runs under middleware's existing Jest config

Tests run via `cd middleware && npm test`. No separate `package.json`/`jest.config.js`
is created. The network tripwire is installed per-spec (not globally) to avoid
affecting other middleware specs.

#### DR-010 — AiService not migrated yet (needs team approval to mount)

The overnight `AiService` single-entry-point is not yet added to the real app.
It would require expanding `ai.module.ts`'s exports — a shared change. See MB-001.

---

## Overnight entries now explicitly superseded

| Entry | Why void |
|---|---|
| **D-002** "There is no shared skeleton" | **VOID** — `middleware/src/ai/**` and `middleware/src/common/dtos/nlu-result.dto.ts` existed. All choices that flowed from this are overridden by the real skeleton. |
| **D-003** "Self-contained toolchain inside src/ai/" | **VOID** — `middleware/` has its own package.json, tsconfig.json, and Jest config. The stray `src/ai/{package,tsconfig,jest.config}.{json,js}` are deleted with the directory. |
| **D-004** "NluResult lives in src/ai/common/nlu-result.ts" | **VOID** — Canonical type is `NluResultDto` in `middleware/src/common/dtos/nlu-result.dto.ts`. |
| **D-006** "Port names follow the brief, not the diagram" | **VOID** — Real ports are `ISttAdapter`, `ITtsAdapter`, `INluAdapter`, `ILlmAdapter` with the team's string tokens. |
| **B-001** "Layer not mounted in any application" | **VOID** — `AiModule` is imported and wired in `middleware/src/app.module.ts`. |
| **B-002** "No root package.json, so no repo-wide npm test" | **VOID** — `middleware/package.json` is the real runner: `cd middleware && npm test`. |
| **B-003** "NluResult should move to a shared common/" | **VOID** — Already there: `middleware/src/common/dtos/nlu-result.dto.ts`. |

---

## Blocked — pending decisions outside this workstream's scope

### MB-001 — AiService not yet mounted in the real app

The `AiService` single-entry-point (interpretAudio / speak) is not yet in
`middleware/src/ai/ai.module.ts`'s providers/exports. Adding it needs team sign-off.
**Flag for whoever owns kiosk/ or checkin/ controllers:** inject `AiService`
and call `interpretAudio(buffer)` / `speak(text)` once it is mounted.

### MB-002 — Do not touch kiosk/, checkin/, gate/, qr/

Nothing in those directories was changed. If any module there injects
`NLU_ADAPTER_TOKEN`, it still gets the stub. **Flag:** the stub returns
`{ intent: 'confirm_checkin', confidence: 0.95, entities: { confirmation: true } }` —
verify this is what the state machine expects before switching to the real adapter.

### MB-003 — Phone validation vs. diagram (carry-forward from D-012)

The `^01\d{9}$` rule contradicts `diagrams/04-kiosk-conversation.mmd`'s
`Digits extracted >= 7` transition. Whoever owns the state machine owns that call.

### MB-004 — No Redis TTS caching (carry-forward from D-011)

`diagrams/07-voice-avatar-pipeline.mmd` shows TTS cached in Redis. The adapter
does not cache; the right shape is a decorating `ITtsAdapter`. Scope-deferred.

---

## 2026-09-19 — Queue Voice Integration (feature/queue-voice-integration)

### DR-011 — Semantic intent detection & corrected-speech phone extraction

1. **Semantic full-utterance intent recognition**:
   - Fixed `matchYesNo` to interpret the complete utterance rather than naive exact-string equality or raw substring matching.
   - Introduced bilingual `AMBIGUOUS` token sets (`maybe`, `not`, `لو`, `ممكن`, `ولا`, etc.) to defer mixed or ambiguous utterances to LLM fallback rather than prematurely returning `UNKNOWN`.
   - Alef variants fold `لأ` to `لا` which is included in negative sets.

2. **Corrected-speech phone extraction**:
   - `normalizeNumberWords()` runs before letter normalization to prevent diacritic and teh-marbuta folding from breaking digit-word lookups.
   - Naive strip-all-digits was replaced by digit-run extraction and filtering for valid 11-digit Egyptian mobile numbers (`01[0125]\d{8}`).
   - When multiple valid numbers occur in speech (e.g. self-correction "010... لا لا 012..."), the extractor selects the last valid candidate.

### DR-012 — Shared ContactMethod enum and deterministic rules hierarchy

- Introduced `ContactMethod` union type (`'SMS' | 'WHATSAPP' | 'ELSAAYER_APP' | 'CALLING_AGENT'`) and `CONTACT_METHOD_OPTIONS` ordered array in `src/ai/nlu/contact-method.ts`.
- Implemented `matchContactMethod` in `NluRulesAdapter` with hierarchical resolution:
  1. Method name (Arabic/English terms)
  2. Bare digit (1-4 matching option indices)
  3. Option context + digit ("الخيار الاول", "option 2")
  4. Arabic ordinals ("الاول", "التانية", etc.)
  5. English ordinals ("first", "second", etc.)
- Multi-match guard: if multiple distinct methods match, resolve to `undefined` and defer to LLM rather than guessing.

### DR-013 — Grounded context parameter on INluAdapter and LLM fallback

- Extended `INluAdapter.parse(text: string, context?: string)` with an optional context parameter, keeping existing callers backwards-compatible.
- `LlmNluAdapter` uses context to ground the prompt: `Context: <context>\nUtterance: "<transcript>"`.
- Extended LLM system prompt to support 5 explicit output shapes (`YES`, `NO`, `PHONE`, `CONTACT_METHOD`, `UNKNOWN`).
- Parsed LLM result maps `CONTACT_METHOD` into standard `NluResultDto` (`{ intent: 'CONTACT_METHOD', confidence: 0.97, entities: { contactMethod } }`).

### DR-014 — Voice flow contact-method gate & retry ceiling

- In `kiosk.service.ts`, added `CONTACT_METHOD_ASKING` state between phone confirmation and check-in submit. Check-in cannot proceed without a valid contact method.
- Followed the existing binary retry ceiling used across `kiosk.service.ts`:
  - 1st miss: increment `contactMethodRetries` to 1 and re-prompt via voice (`inputMode: VOICE`).
  - 2nd miss: fall back to on-screen selection buttons (`inputMode: BUTTONS`).
  - Never guess or default a contact method on the customer's behalf.
- Kept modifications to Sara's `kiosk.service.ts` surgical: only added the state transition gate, input handler, and audio/button prompt helpers without restructuring the state machine.

### DR-015 — End-to-end check-in plumbing to QueueTicket

- Extended `CheckInRequestDto` and `CheckinSubmittedPayload` with `contactMethod?: ContactMethod | null`.
- Extended `QueueService.enqueue()` and `QueueTicket` to store `contactMethod`.
- In `kiosk.service.ts`, passed `session.contactMethod` into `checkinService.submit()` so it is recorded on the ticket and published in events.

