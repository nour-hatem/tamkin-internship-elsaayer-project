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

---

## 2026-09-30 — Week 3: DI Fixes, Structured Logging, Admin Module, Connected Gates UI

### DR-016 — Replace string DI tokens with canonical constants from port files

**Decision:** Replace the four raw string literals (`'ITtsAdapter'`, `'ISttAdapter'`, `'INluAdapter'`, `'IGateAdapter'`) in `KioskModule` with the token constants exported from each port file (`TTS_ADAPTER_TOKEN`, `STT_ADAPTER_TOKEN`, `NLU_ADAPTER_TOKEN`, `GATE_ADAPTER_TOKEN`).

**Why:** The string literals were a typo-prone local copy of the canonical constants. A mismatch (e.g. `'ITtsAdapter'` instead of `'TTS_ADAPTER_TOKEN'`) causes silent DI failures at runtime because NestJS resolves providers by token identity. The canonical constants in the port files are the single source of truth.

**Alternative:** Leave string literals in place and ensure they match by convention. Rejected — convention-only correctness breaks silently and is not verifiable by the compiler.

---

### DR-017 — Inject `GateService` instead of raw `IGateAdapter` in `KioskService`

**Decision:** Changed `KioskService` to inject `GateService` (the concrete class, no `@Inject` decorator needed) instead of injecting `GATE_ADAPTER_TOKEN` directly.

**Why:** `GateService` owns the 5-second auto-close timer and the 30-second Redis rate-limit guard. Injecting the raw adapter bypasses both. No business logic changed — the call site switches from `this.gateAdapter.openGate(gateId)` to `this.gateService.openGate(gateId)`.

**Alternative:** Keep raw adapter injection and duplicate the timer/rate-limit logic in `KioskService`. Rejected — duplicating infrastructure-level guards in a feature service creates drift and is outside Nour's scope.

---

### DR-018 — Structured logging: pino over winston

**Decision:** Use `pino` (with `pino-pretty` for dev, `pino-roll` for daily file rotation) rather than `winston`.

**Why:** pino is measurably faster (synchronous JSON serialisation vs winston's stream pipeline), is the de-facto standard for NestJS production deployments, and its transport model (stdout + file stream) maps cleanly to the dual-sink requirement. `pino-roll` gives daily rotation with file-count retention without a third-party cron.

**Alternative:** `winston` with `winston-daily-rotate-file`. Would work but adds more dependencies, is slower (benchmarks: 5-10× at high throughput), and is less idiomatic for NestJS.

---

### DR-019 — Log placement: flow boundaries only, not every service call

**Decision:** Added structured log lines only at the entry and exit of the six named critical flows (LPR read, SAP lookup, check-in submit, gate open, queue enqueue, queue rotation). Did not add logs inside helper methods, validators, or DTO constructors.

**Why:** The requirement was "enough context to trace a customer journey end-to-end." Over-logging obscures signal with noise; the six boundary points are sufficient to reconstruct any customer path from `plate → SAP lookup → check-in → queue → gate open`.

**Alternative:** Log every service method entry/exit. Rejected — creates log volume 10-20× higher with no meaningful traceability gain, and makes `queue.service.ts` (which already has complex async slot management) hard to read.

---

### DR-020 — `LoggerModule` is `@Global()`, not imported per-feature-module

**Decision:** Decorated `LoggerModule` with `@Global()` so any module that needs `LoggerService` receives it without explicitly importing `LoggerModule`.

**Why:** The logger is an infrastructure concern, not a feature concern. Every module in the app will eventually use it. Requiring an explicit import in every module is the same pattern NestJS itself uses for `ConfigModule.forRoot({ isGlobal: true })`.

**Alternative:** Require each module to import `LoggerModule` explicitly. Rejected — creates import boilerplate in every module and makes it easy to forget for new modules added later.

---

### DR-021 — `AdminService` tracks gates in memory (`Map`), not Redis

**Decision:** `AdminService.connectedGates` is a plain `Map<string, { socketId, connectedAt }>` in process memory.

**Why:** Connected-gate state is ephemeral — it is fully reconstructed from socket events on each process start. There is no requirement to survive a server restart. Adding Redis for this would introduce a new infrastructure dependency for no durability benefit.

**Alternative:** Store connected-gate state in Redis to survive restarts and support horizontal scaling. Deferred — not required by the current spec; flag for future if multi-instance deployment is needed (see MB-005).

---

### DR-022 — `getGateQueue` filters `getAllTickets()` by `gateId`, no dedicated method added to `QueueService`

**Decision:** `AdminService.getGateQueue(gateId)` calls `QueueService.getAllTickets()` and filters client-side rather than adding a `getTicketsForGate(gateId)` method to `QueueService`.

**Why:** `QueueService` is Rahma's file — adding a method would require her review and coordination. The ticket array is small (bounded by the number of active vehicles at any given time, typically < 50). In-memory filtering is negligible.

**Alternative:** Add `QueueService.getTicketsForGate(gateId)`. Deferred pending Rahma's review — flag in MB-005 below.

---

### DR-023 — Socket.IO event names: `gate.connected` / `gate.disconnected` (dot-notation, lowercase)

**Decision:** The Socket.IO events broadcast to the frontend are named `gate.connected` and `gate.disconnected` (dot-separator, all lowercase).

**Why:** All existing Socket.IO events in this codebase use dot-notation lowercase (`checkin.display`, `sap.result`, `gate.state`, `kiosk.state`). Consistency with the existing naming convention makes the event list predictable.

**Alternative:** Use `GATE_CONNECTED` / `GATE_DISCONNECTED` (the NestJS domain event names). Rejected — the domain event name is an internal bus identifier; the Socket.IO event name is part of a public protocol that must be readable and follow the established convention.

---

### DR-024 — Gate Socket.IO forwarding done in `KioskGateway`, not `AdminService`

**Decision:** Added `@OnEvent(EVENTS.GATE_CONNECTED)` and `@OnEvent(EVENTS.GATE_DISCONNECTED)` handlers to `KioskGateway` to broadcast `gate.connected` / `gate.disconnected` as Socket.IO events. `AdminService` is not given a reference to the Socket.IO server.

**Why:** `KioskGateway` already owns the `@WebSocketServer() server: Server` reference and has the established pattern of `@OnEvent` → `this.server.emit(...)` (see `handleCheckinDisplayUpdated`, `handleSapLookup`, `handleCheckInCompleted`). Injecting the server into `AdminService` would either require circular dependency resolution or an awkward shared gateway reference.

**Alternative:** Inject `KioskGateway` into `AdminService` and call a method on the gateway. Rejected — creates a dependency from the admin feature module back onto the kiosk module, which is the wrong direction.

---

### DR-025 — Admin frontend: REST for initial state, socket for live updates

**Decision:** `web/app/admin/page.tsx` fetches `GET /admin/gates` on mount for initial state and subscribes to `gate.connected` / `gate.disconnected` socket events for real-time updates. No polling.

**Why:** Polling adds unnecessary load and latency. The socket subscriptions already deliver instant updates. The REST call on mount is needed because the socket connection may not yet have received all prior-connected gates at page load time.

**Alternative:** Socket-only (join a room and receive a full state dump on connection). Rejected — requires a backend change to emit a state dump on connection, which is out of scope. REST + socket is the minimal-change approach.

---

### DR-026 — GateInfo contract shape & name/location stubbing

**Decision:** `GET /admin/gates` returns `{ gates: GateInfo[] }` where each gate includes `id: string`, `name: string`, and `location: string`. The gate `name` is derived deterministically from `gateId` (e.g., `"gate-1"` $\rightarrow$ `"Gate 1"`), and `location` is initialized to `""` as a placeholder.

**Why:** The contract specifies `{ gates: { id: string, name: string, location: string }[] }`. Currently, the backend has no persistent gate registry service providing human-readable names or physical location metadata. Deriving the name from `gateId` and stubbing `location` fulfills the contract schema without hardcoding artificial values, and serves as a placeholder until a dedicated GateRegistry is integrated.

**Alternative:** Hardcode mock gate locations ("Toyota Service Entrance", etc.). Rejected — hardcoding domain metadata inside service code creates tight coupling and false assumptions.

### DR-027 — `isToyotaCustomer` / `IsToyotaCustomer` field handling and default

**Decision:** Added both `isToyotaCustomer: boolean` and `IsToyotaCustomer: boolean` to `QueueTicket` and `CheckInRequestDto`. In `CheckInService.submit()`, the value is read from `request.isToyotaCustomer ?? request.IsToyotaCustomer ?? false` and forwarded to `QueueService.enqueue()`.

**Why:** The contract specifies `IsToyotaCustomer: boolean` on `QueueTicket` (`true` = Toyota Customer, `false` = New Customer). Supporting both camelCase (`isToyotaCustomer`) and PascalCase (`IsToyotaCustomer`) ensures seamless compatibility with TypeScript conventions as well as frontend expectations (`ticket.IsToyotaCustomer` in `CustomerTable.tsx`). In `CheckInService.submit()`, if the caller does not provide the flag, it safely defaults to `false` (new customer) because `CheckInService` does not directly re-query `SapService` during ticket creation.

**Alternative:** Force synchronous SAP query inside `CheckInService.submit()`. Rejected — check-in submission must remain fast and resilient; SAP lookup already occurs upstream at the gate entry flow.

### DR-028 — `QUEUE_TICKET_ADDED` & `QUEUE_TICKET_STATUS_UPDATED` domain events and `/gate` gateway

**Decision:** Added `QUEUE_TICKET_ADDED` and `QUEUE_TICKET_STATUS_UPDATED` domain events emitted by `QueueService` on ticket creation (`enqueue`) and every status modification (`updateTicketStatus`, `callNextCandidate`, `handleContactAck`, `handleContactTimeout`). Dedicated `AdminGateway` on namespace `/gate` handles room subscription (`joinGate`/`leaveGate`) and broadcasts `QUEUE_TICKET_ADDED { ticket }` and `QUEUE_TICKET_STATUS_UPDATED { ticketId, status }` to `gate:{gateId}`.

**Why:** The contract specifies real-time queue updates over Socket.IO on namespace `/gate` in rooms `gate:{gateId}`. Separating internal domain events (emitted across the NestJS event bus) from the WebSocket gateway ensures low coupling and keeps `QueueService` agnostic of socket transports.

**Alternative:** Directly inject `AdminGateway` or `Server` into `QueueService`. Rejected — coupling business logic in `QueueService` to WebSocket server references creates transport dependencies and complicates testing.

---

## Open items (MB series)

### MB-005 — `AdminService` in-memory gate state does not survive process restart

If the middleware process restarts, `connectedGates` is empty until kiosk sockets reconnect and emit `GATE_CONNECTED`. For an MVP this is acceptable. For production, consider snapshotting to Redis or emitting a "current state" broadcast on reconnect.

### MB-006 — `QueueService.getTicketsForGate(gateId)` not yet added

`AdminService.getGateQueue` filters in memory. If ticket volume grows or Rahma adds gate-specific indexing to `QueueService`, this filter should move server-side.
