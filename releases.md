# Releases

## [2026-10-01] feat(admin): replace mock data with API & real-time queue updates

**By:** Sara

### Changes

* Removed `admin-mock` data from the Admin Dashboard.
* Removed connected/offline gate statistics; gate connection status is handled by Nour.
* Added API integration:
  * `GET /admin/gates`
  * `GET /admin/queue`
  * `GET /admin/gates/:gateId/queue`
* Added loading and error states.
* Dashboard statistics are now calculated from queue tickets:
  * `WAITING` → Waiting Customers
  * `CALLED` → Called Customers
  * `IN_SERVICE` → Currently In Service
* Gate cards now display gate name, location, and waiting customers.
* Waiting customers per gate are filtered by `gateId` and `WAITING` status.
### Queue & Customers
* Replaced mock data with `GET /admin/gates/:gateId/queue`.
* Added `isToyotaCustomer` to `QueueTicket`.
  * `true` → Toyota Customer
  * `false` → New Customer
* Queue page shows only:
  * `WAITING`
  * `CALLED`
  * `ACKNOWLEDGED`
  * `IN_SERVICE`
* Customers page displays all returned tickets without status filtering.
* Removed vehicle information from the tables.
* Added phone number to the ticket hover information.
### Socket.IO
* Added `src/lib/gateSocket.ts`.
* Connected to the `/gate` namespace.
* Added gate rooms using `gate:{gateId}`.
* Added:
  * `joinGate`
  * `leaveGate`
  * `QUEUE_TICKET_ADDED`
  * `QUEUE_TICKET_STATUS_UPDATED`
* Queue and Customers pages now receive ticket additions and status updates in real time.
### QueueTicket
```ts
export interface QueueTicket {
  ticketId: string;
  queueNumber: number;
  gateId: string;
  plate: string;
  name: string;
  phone: string;
  source: "QR" | "VOICE";
  preferredContactMethod: ContactMethod;
  IsToyotaCustomer: boolean;
  status: QueueTicketStatus;
  createdAt: Date | string;
}
```
### StatusBadge
Added support for:
```text
WAITING
CALLED
ACKNOWLEDGED
IN_SERVICE
COMPLETED
SKIPPED
TOYOTA_CUSTOMER
NEW_CUSTOMER
```
### Temporary Testing
Created temporary backend mock responses for:
GET /admin/gates
GET /admin/queue
GET /admin/gates/:gateId/queue

## [2026-09-22] feat(kiosk-redis): cache static TTS prompts in Redis (7-day TTL)

**By:** Sara

**Requested:** Cache the audio for the kiosk's fixed (non-interpolated) voice prompts in Redis, keyed uniquely per message with a language suffix, so repeated requests reuse the cached TTS audio instead of re-synthesizing it every time.

**Changes:**

- Added `kiosk.redis.ts` — `KioskRedisService`, wrapping the existing `RedisService` client with kiosk-specific caching:
  - `KioskMessageKey` enum names the 6 static prompts: `NAME_ASKING`, `PHONE_ASKING`, `CONFIRMATION_BUTTONS`, `PHONE_KEYBOARD`, `CONTACT_METHOD_ASKING`, `CONTACT_METHOD_BUTTONS`.
  - Redis key format: `kiosk:tts:{message-key}-{ar|en}` (e.g. `kiosk:tts:name-asking-ar`).
  - `getCachedAudio` / `setCachedAudio` use `getBuffer` / `set` (binary-safe) rather than the string-based `get`, since TTS output is audio, not text.
  - `setCachedAudio` sets a 7-day expiry (`EX`); an unused entry ages out and regenerates automatically on the next request.
  - `getOrSynthesize(messageKey, lang, synthesize)` — the single entry point used everywhere: cache hit returns immediately, cache miss calls the TTS adapter once and caches the result.
- Wired `KioskRedisService` into `KioskService`'s 6 static-prompt methods (`askForName`, `askForPhone`, `showConfirmationButtons`, `showPhoneKeyboard`, `askForContactMethod`, `showContactMethodButtons`), replacing the direct `ttsAdapter.synthesize(message)` calls with `kioskRedisService.getOrSynthesize(...)`.
- `greeting()` intentionally left uncached — it embeds `session.customerName` / `session.phone`, so it's different per session and caching it would only fill Redis with one-off entries that are never reused.

**Bugs fixed while wiring this in (found during implementation, not requested but necessary):**

- `this.lang` was compared against `"ar"` in one method and `"Arabic"` in another — only one could ever match, so half the prompts were silently stuck in one language regardless of the env var. Normalized to a single `this.lang: 'ar' | 'en'`, derived once in the constructor.
- 5 methods (`askForPhone`, `showConfirmationButtons`, `showPhoneKeyboard`, `askForContactMethod`, `showContactMethodButtons`) checked `if (message === "Arabic")` against the just-declared, still-`undefined` `message` variable instead of `this.lang` — always `false`, so these 5 prompts always fell through to English. Fixed to read `this.lang` consistently.

**Notes:**

- Sizing: bounded at 12 keys total (6 messages × 2 languages) — this cache can't grow unbounded the way a per-session or per-user cache would.
- If prompt wording is edited later without renaming the `KioskMessageKey`, the old cached audio keeps being served until the 7-day TTL expires. Content-hashing the key (so a text change produces a new key automatically) was discussed as a more robust follow-up if that risk matters here.
- `KioskRedisService` needs `RedisService` available to `KioskModule` (either export it from wherever it's currently provided, or import `RedisModule` into `KioskModule`), and needs to be added to `KioskModule`'s `providers`.

## [2026-09-22] feat(kiosk-i18n): full English/Arabic localization, driven by env language setting

**By:** Sara

**Requested:** Make every piece of kiosk UI text — buttons, keyboard, placeholders, labels — switch between English and Arabic based on a language setting, matching whichever language the backend is now generating spoken/message content in.

**Changes:**

- Added `NEXT_PUBLIC_APP_LANGUAGE` env var (`en` | `ar`, defaults to `ar`) as the single source of truth for kiosk display language.
- Added a `STRINGS` dictionary covering every frontend-owned string: brand/gate labels, start overlay text, Yes/No confirmation labels, the four contact-method button labels, name/phone placeholders, keyboard control labels (space/clear/backspace) and their aria-labels, and the Send button.
- Added a parallel English (QWERTY) on-screen keyboard, swapped in for name entry alongside the existing Arabic layout based on the same language setting.
- Switched the whole page's `dir` attribute (and per-input text alignment) between `rtl` and `ltr` based on the same setting, instead of the previous hardcoded `dir="rtl"` throughout.
- Refactored the name/phone keyboard handlers (backspace, clear, space) to call dedicated functions instead of comparing the pressed key's display text — so keyboard labels can change per language without touching input logic.
- Backend (`KioskService`) now generates `message` (and its TTS audio) in the matching language as well, so the spoken/on-screen prompt text and the kiosk's own UI text stay consistent end-to-end.

**Kept language-independent (protocol, not display):**

- The Yes/No confirmation still emits a fixed value to the backend `INPUT` payload, decoupled from the displayed button label.
- The contact-method buttons still emit the `ContactMethod` enum key (e.g. `'SMS'`), not the localized label.

**Notes:**

- Setting `NEXT_PUBLIC_APP_LANGUAGE` requires a rebuild/restart to take effect, since it's inlined at build time in a Next.js client component.
- Frontend and backend language settings are two separate env values today — worth confirming both are kept in sync per environment, or consolidating into one shared config, to avoid a kiosk that speaks Arabic but shows English buttons (or vice versa).

## [2026-09-22] feat(kiosk-ui): contact-method buttons + voice-mode guard for CONTACT_METHOD_ASKING

**By:** Sara

**Requested:** Match the existing phone-asking UX pattern (2 voice attempts, then a manual fallback UI) for the `CONTACT_METHOD_ASKING` state, and make sure the kiosk never opens the mic while a button/keyboard UI is showing.

**Changes:**

- Added a `showContactMethodButtons` UI state and a 4-button picker (SMS / WhatsApp / تطبيق الساير / اتصال هاتفي), rendered from the shared `ContactMethod` enum.
- Added `sendContactMethod(method)`, mirroring `sendConfirmation`, which emits `INPUT` with `state: 'CONTACT_METHOD_ASKING'` and the chosen method as `text`.
- Updated the OUTPUT listener's UI branch so `inputMode: 'BUTTONS'` renders the contact-method picker only when `state === 'CONTACT_METHOD_ASKING'`, and falls back to the existing Yes/No confirmation buttons for every other `BUTTONS` state (e.g. `CONFIRMING_PHONE`).
- Added a defensive guard inside `startRecording()` itself: if `inputModeRef.current !== 'VOICE'` (or `textInputStateRef.current` is true), it logs why and returns without touching the microphone — regardless of which call site triggered it.
- Added `showContactMethodButtons` to `isKeyboardActive`, so the avatar hides consistently with the other manual-input UIs.

**Behavior now matches phone-asking exactly:**

1st & 2nd `CONTACT_METHOD_ASKING` attempt → backend sends `inputMode: VOICE` → mic opens normally.
3rd attempt → backend sends `inputMode: BUTTONS` → mic never opens, kiosk shows the 4 contact-method buttons instead of voice/Yes-No.

**Notes:**

- No backend changes required — `KioskService.handleContactMethodInput` already implemented the same 2-voice-attempts-then-fallback pattern as `handlePhoneInput`.
- Bug caught and fixed during implementation: an earlier draft toggled the button UI off `state === 'CONTACT_METHOD_ASKING'` alone, which would have skipped both voice attempts entirely. Fixed to key strictly off `inputMode`, same as every other state.

## [2026-09-22] feat(queue-contact): wire QueueService to ContactService for candidate notification

**By:** Sara

**Requested:** Connect `QueueService`'s candidate selection to `ContactService`, so a customer is actually notified when chosen from the queue, and the slot/ticket/rotation state stays in sync with the contact outcome.

**Changes:**

- Injected `ContactService` into `QueueService`.
- Updated `callNextCandidate()` to call `ContactService.notify(...)` after marking a ticket `CALLED`, passing `ticketId`, `slotId`, `phone`, `name`, and `preferredContactMethod`.
- Kept `slotId` as the correlation key passed through to `ContactService`, so outcome events can be routed back to the correct rotation.
- Confirmed existing `@OnEvent(EVENTS.CONTACT_ACK)` / `@OnEvent(EVENTS.CONTACT_TIMEOUT)` handlers in `QueueService` remain the single source of truth for:
  - Marking the ticket `ACKNOWLEDGED` and the slot `OCCUPIED` on ack.
  - Resetting the ticket to `WAITING` and rotating to the next candidate on timeout.
  - Deleting the rotation once a slot is filled.
- No direct dependency from `ContactService` back to `QueueService` — communication stays one-directional via events, avoiding circular DI.

**Notification Flow:**

Queue selects candidate → `QueueService.callNextCandidate` → `ContactService.notify(ticketId, slotId, phone, preferredContactMethod)` → Contact Adapter → customer notified

**Outcome Flow:**

`ContactService` emits `CONTACT_ACK` or `CONTACT_TIMEOUT` (with `ticketId` + `slotId`) → `QueueService`'s `@OnEvent` handlers update slot/ticket/rotation state accordingly

**Notes:**

- `QueueService` owns all slot, ticket, and rotation state — `ContactService` has no visibility into queues or slots, only ticket-level contact outcomes.
- This keeps `ContactService` and `QueueService` decoupled from each other in code, connected only through the event emitter.
- Still to confirm: error handling if `contactService.notify()` throws (e.g. bad phone number) — currently not caught, so a failed `notify()` call would leave the ticket stuck in `CALLED` rather than rotating to the next candidate.


## [2026-09-20] feat(queue-contact): add customer acknowledgment flow

**By:** Sara

**Requested:** Implement the customer acknowledgment flow after contacting a customer, with a 30-second response window.

**Changes:**

- Added pending-contact tracking in `ContactService`.
- Added a 30-second acknowledgment timeout after a notification is successfully sent.
- Added `acknowledge(ticketId)` handling for customer approval.
- Added the `POST /queue/acknowledge` endpoint.
- Added acknowledgment handling using the ticket ID.
- If the customer acknowledges within 30 seconds, the result becomes `ACKNOWLEDGED`.
- If no acknowledgment is received within 30 seconds, the result becomes `NO_RESPONSE`.
- Kept queue rotation outside `ContactService`; after `NO_RESPONSE`, Queue Core remains responsible for selecting the next customer.

**Acknowledgment Flow:**

Queue selects customer → ContactService → Contact Adapter → `SENT` → Start 30-second timer → Customer acknowledges → `ACKNOWLEDGED`

If there is no response:

Queue selects customer → ContactService → Contact Adapter → `SENT` → 30 seconds → `NO_RESPONSE` → Queue Core handles rotation

**Notes:**

- The 30-second timer is currently implemented using an in-memory timer for MVP simulation.
- Contact adapters do not wait for the 30-second period; they only simulate sending.
- Customer acknowledgment is simulated through the `/queue/acknowledge` endpoint.
- Queue Core remains responsible for rotation after `NO_RESPONSE`.


## [2026-09-20] feat(queue-contact): add simulated customer contact adapters

**By:** Sara

**Requested:** Implement the Customer Contact layer for the Queue module using a common adapter abstraction and simulated contact methods.

**Changes:**

- Added the `IContactAdapter` abstraction for customer contact methods.
- Added simulated contact adapters for SMS, WhatsApp, Elsaayer App, and Calling Agent.
- Added the `ContactMethod` type with `SMS`, `WHATSAPP`, `ELSAAYER_APP`, and `CALLING_AGENT`.
- Added the `Notification` structure containing `ticketId`, `phone`, `name`, and `message`.
- Added the `ContactResult` structure containing `ticketId`, `method`, and contact status.
- Updated the Calling Agent adapter to return the correct `CALLING_AGENT` method and ticket ID.
- Added `ContactService` logic to select the appropriate adapter based on the customer's `preferredContactMethod`.
- Kept all contact providers simulated for the MVP so they can later be replaced with real services.

**Notes:**

- The customer's phone number is taken from the `QueueTicket` and passed to the selected contact adapter.
- Each adapter simulates sending the notification and returns a `SENT` result.
- The adapter abstraction keeps the Queue Contact logic independent from the actual contact provider.

## [2026-09-20 01:27] fix(kiosk): add temporary contact method fallback

**By:** @RahmaMohamedFarouk06

**Requested:** fix(kiosk): add temporary contact method fallback (post-commit auto-log, branch `feature/rahma-qr-socket`, `deafe85`)

**Changes:**
- middleware/src/kiosk/kiosk.service.ts

**Notes:** auto-logged by post-commit hook; amend or extend as needed.

## [2026-09-20 01:25] feat(qr): add preferred contact method

**By:** @RahmaMohamedFarouk06

**Requested:** feat(qr): add preferred contact method (post-commit auto-log, branch `feature/rahma-qr-socket`, `30591d8`)

**Changes:**
- middleware/src/qr/dto/qr-checkin.dto.ts
- middleware/src/qr/qr.service.ts
- web/features/checkin/CheckinForm.tsx

**Notes:** auto-logged by post-commit hook; amend or extend as needed.

## [2026-09-20 01:24] feat(queue): add queue rotation and slot simulation

**By:** @RahmaMohamedFarouk06

**Requested:** feat(queue): add queue rotation and slot simulation (post-commit auto-log, branch `feature/rahma-qr-socket`, `f4a28ed`)

**Changes:**
- middleware/src/checkin/checkin.service.ts
- middleware/src/common/dtos/checkin-request.dto.ts
- middleware/src/common/events.ts
- middleware/src/common/typed-event-emitter.service.ts
- middleware/src/queue/queue.controller.ts
- middleware/src/queue/queue.module.ts
- middleware/src/queue/queue.service.ts

**Notes:** auto-logged by post-commit hook; amend or extend as needed.

## [2026-09-17 22:24] fix(ai): use stable NLU adapter token

**By:** @RahmaMohamedFarouk06

**Requested:** fix(ai): use stable NLU adapter token (post-commit auto-log, branch `feature/rahma-qr-socket`, `fb2e9aa`)

**Changes:**
- middleware/src/ai/nlu/nlu.port.ts

**Notes:** auto-logged by post-commit hook; amend or extend as needed.

## [2026-09-13 17:30] Configure Unified Redis TTL Policy for Kiosk Sessions

**By:** @cline

**Requested:** Configure a unified, configurable Redis session expiration policy for kiosk sessions with a 180-second default fallback across creation and updates.

**Changes:**
- `.env.example` — Added `KIOSK_SESSION_TTL_SECONDS=180` under Database & Cache configuration.
- `middleware/src/kiosk/session.service.ts` — Injected `ConfigService`, retrieved and validated `KIOSK_SESSION_TTL_SECONDS` (falling back to `180`s for missing or non-positive values), and passed `this.ttlSeconds` to `sessionRepository.save()` in `createSession()`, `updateState()`, and `updateSession()`.
- `middleware/src/kiosk/session.service.spec.ts` — Added unit tests verifying TTL configuration parsing, fallback handling, and TTL propagation to `sessionRepository.save()`.

**Notes:**
- Redis CAS atomic state transitions via `atomicTransitionState()` remain unchanged, preserving remaining TTL via Lua script `PTTL`.


## [2026-09-13 16:30] Implement Atomic State Transition for Kiosk Check-In Flow

**By:** @cline

**Requested:** Prevent race conditions and duplicate gate opening during simultaneous kiosk INPUT events by transitioning session states atomically in Redis using a Lua script.

**Changes:**
- `middleware/src/kiosk/session.repository.ts` — Added `atomicTransitionState()` executing an atomic Redis Lua script via `EVAL` to perform compare-and-swap (CAS) transitions while preserving key TTL, returning `SUCCESS`, `STATE_MISMATCH`, or `SESSION_NOT_FOUND`.
- `middleware/src/kiosk/session.service.ts` — Added `transitionState()` delegating atomic state changes to `SessionRepository`.
- `middleware/src/kiosk/kiosk.service.ts` — Updated `complete()` to atomically claim `CONFIRMING_PHONE -> CHECKING_IN` before calling `gateAdapter.openGate()` and emitting completion events, rejecting any concurrent duplicate transitions with a warning.
- `middleware/src/kiosk/session.repository.spec.ts` — Added unit tests verifying atomic transition behaviors across success, state mismatch, and session not found cases.
- `middleware/src/kiosk/session.service.spec.ts` — Added unit tests verifying `SessionService.transitionState()` delegation.

**Notes:**
- Redis executes the Lua script atomically, eliminating the need for in-memory JS locks.
- Socket ownership security checks and existing Redis JSON data structures were preserved unchanged.


## [2026-09-13 15:45] Bind Kiosk Sessions to Socket.IO Client ID & Validate INPUT Ownership

**By:** @cline

**Requested:** Bind each kiosk session to the Socket.IO socket that owns it and validate ownership on INPUT messages to prevent unauthorized clients from injecting responses into other sessions.

**Changes:**
- `middleware/src/kiosk/interfaces/kiosk-session.interface.ts` — Added `socketId` to `KioskSession` and `CreateSessionDto`.
- `middleware/src/kiosk/session.service.ts` — Updated `createSession()` to persist `socketId` in the session model stored in Redis.
- `middleware/src/kiosk/kiosk.gateway.ts` — Injected `SessionService`, added gate-to-kiosk socket mapping (`gateKioskSockets`), registered kiosk clients on `kiosk.join` when `clientType === 'kiosk'`, supported re-binding session `socketId` on legitimate kiosk reconnection, and added ownership validation in `handleInput()` to reject missing or mismatched sessions before publishing `KIOSK_INPUT`.
- `middleware/src/kiosk/kiosk.service.ts` — Updated `handleSapLookupResult()` to retrieve the gate's associated kiosk `socketId` from `KioskGateway` and pass it into `createSession()`.
- `web/lib/socket.ts` — Updated `joinGateRoom()` to accept and persist `clientType`, emitting `clientType` on initial join and reconnects.
- `web/app/kiosk/page.tsx` — Specified `clientType: 'kiosk'` when calling `joinGateRoom()`.
- `web/app/console/page.tsx` — Specified `clientType: 'console'` when calling `joinGateRoom()`.

**Notes:**
- Spectator/console clients joining `gate:${gateId}` are distinguished by `clientType` and never registered as the kiosk session owner.
- The `gateId` is preserved in the session for routing, and no client-side `gateId` or `state` is trusted for authorization.


**## [2026-09-12] Add Unknown Customer Name Collection & Kiosk On-Screen Keyboard**

**\*\*By:\*\*** @cline

**\*\*Requested:\*\*** Complete the unknown-SAP-customer branch by collecting the customer's name through the kiosk UI before continuing to phone collection.

**\*\*Changes:\*\***

\- `middleware/src/kiosk/kiosk.service.ts` — Added the `NAME_ASKING` flow for customers not found in SAP.

\- `middleware/src/kiosk/kiosk.service.ts` — Updated name handling to receive the customer's name through the generic `INPUT` payload `text` field.

\- `middleware/src/kiosk/kiosk.service.ts` — Saved the entered customer name in the Redis-backed kiosk session.

\- `middleware/src/kiosk/kiosk.service.ts` — Continued automatically to `PHONE_ASKING` after a valid name was submitted.

\- `middleware/src/kiosk/kiosk.gateway.ts` — Continued using the generic `INPUT` / `OUTPUT` transport events without introducing additional Socket.IO events for name submission.

\- `web/lib/socket.ts` — Updated `KioskInputPayload` to support both audio and text input.

\- `web/lib/socket.ts` — Updated input logging to safely handle text-only inputs without assuming that an audio buffer exists.

\- `web/app/kiosk/page.tsx` — Added a dedicated name-input UI for the `NAME_ASKING` state.

\- `web/app/kiosk/page.tsx` — Added an on-screen Arabic keyboard for kiosk-based name entry.

\- `web/app/kiosk/page.tsx` — Added support for Arabic letter input, spaces, backspace, clear, and name submission.

\- `web/app/kiosk/page.tsx` — Kept TTS playback active for the name prompt before allowing customer input.

\- `web/app/kiosk/page.tsx` — Prevented microphone recording from starting during `NAME_ASKING`, since this state uses text input instead of voice.

\- `web/app/kiosk/page.tsx` — Preserved the separation between backend kiosk business state and frontend avatar state.

**\*\*Unknown Customer Flow:\*\***

LPR → SAP Lookup → Customer Not Found → Create Session → `NAME_ASKING` → TTS Prompt → On-Screen Arabic Keyboard → Customer Name → `INPUT` → Save Name → `PHONE_ASKING`

**\*\*Notes:\*\***

\- The backend remains the source of truth for the kiosk workflow state.

\- The frontend only determines how the customer provides the requested input; it does not perform business-state transitions.

\- Voice states continue to use audio input, while `NAME_ASKING` uses text input.

\- The existing generic `INPUT` / `OUTPUT` communication architecture is preserved.

**### Next**

\- Add retry/prompt behavior for unrecognized YES/NO responses.

\- Add retry behavior for invalid phone numbers.

\- Complete gate-opening failure feedback.

\- Reset the kiosk session after check-in completion.


## [2026-09-11] Kiosk Frontend INPUT/OUTPUT Integration & UI Updates

- Updated the kiosk frontend to use the new generic Socket.IO communication:
  - `OUTPUT` for backend → frontend communication.
  - `INPUT` for frontend → backend communication.
- Added `KioskOutputPayload` and `KioskInputPayload` interfaces to structure kiosk communication.
- Replaced the previous `SEND_GREETING` subscription with the generic `OUTPUT` listener.
- Replaced the previous `confirming.phone` event with the generic `INPUT` event.
- Updated the frontend to keep track of the backend kiosk session ID and business state internally.
- Updated the voice interaction flow:
  - Receive `OUTPUT`.
  - Save session information and backend state.
  - Play TTS audio.
  - Switch avatar to `talking`.
  - After TTS finishes, switch avatar to `listening`.
  - Record customer speech.
  - Stop recording when speech ends.
  - Switch avatar back to `idle` while waiting for the backend.
  - Send the recorded audio through `INPUT`.
- Added support for different binary audio formats received through Socket.IO.
- Kept the frontend avatar state separate from the backend kiosk business state.
- Removed the temporary YES/NO buttons since customer interaction is handled through voice.
- Simplified the kiosk UI:
  - Removed session ID, gate ID, backend state, and avatar state from the screen.
  - Removed visible recording/debug information.
  - Added a full-screen dark background.
  - Kept the kiosk focused on the avatar/customer interaction.
- Updated the frontend Socket.IO fallback URL to the NestJS middleware backend (`localhost:3000`).

### Kiosk Voice Check-in Logic

- Implemented the `CONFIRMING_PHONE` voice flow:
  - Customer audio is converted to text using the STT adapter.
  - Transcript is processed by the NLU adapter.
  - `YES` confirms the phone number.
  - `NO` moves the session to `PHONE_ASKING`.
  - Unknown responses are logged for future retry handling.
- Implemented phone-number collection for the `PHONE_ASKING` state:
  - Customer audio is processed through STT.
  - NLU extracts and validates the Egyptian mobile number.
  - The extracted phone number is saved to the kiosk session.
  - The updated phone number is confirmed again through the greeting flow.
- Kept phone-number extraction and validation inside the NLU adapter instead of duplicating the logic in `KioskService`.
- Updated session handling so the Redis-backed kiosk session remains the source of truth for the current workflow state and customer data.

### Gate Opening

- Connected the `YES` confirmation branch to the Gate adapter.
- When the customer confirms the phone number:
  - Session moves to `CHECKING_IN`.
  - `gateAdapter.openGate(gateId)` is called using the gate associated with the kiosk session.
  - Successful gate opening updates the session to `COMPLETED`.
  - `CHECKIN_COMPLETED` is emitted with the gate status.
- Added gate-opening failure handling and logging.
- Updated `KioskGateway` to broadcast gate/check-in status through the existing `gate.state` Socket.IO event.
- Updated the console flow to receive the gate status and display the gate as `OPENED`.

### Next


- Add retry/prompt behavior for unrecognized YES/NO responses.
- Add retry behavior when the customer provides an invalid phone number.
- Complete the gate-opening failure UI/voice response.
- Refine the check-in completion flow and reset the kiosk for the next customer.
- Restrict `gate.state` broadcasts to the corresponding gate room instead of broadcasting to all connected consoles.


## [2026-09-11] Kiosk Frontend INPUT/OUTPUT Integration & UI Updates

- Updated the kiosk frontend to use the new generic Socket.IO communication:
  - `OUTPUT` for backend → frontend communication.
  - `INPUT` for frontend → backend communication.
- Added `KioskOutputPayload` and `KioskInputPayload` interfaces to structure kiosk communication.
- Replaced the previous `SEND_GREETING` subscription with the generic `OUTPUT` listener.
- Replaced the previous `confirming.phone` event with the generic `INPUT` event.
- Updated the frontend to keep track of the backend kiosk session ID and business state internally.
- Updated the voice interaction flow:
  - Receive `OUTPUT`.
  - Save session information and backend state.
  - Play TTS audio.
  - Switch avatar to `talking`.
  - After TTS finishes, switch avatar to `listening`.
  - Record customer speech.
  - Stop recording when speech ends.
  - Switch avatar back to `idle` while waiting for the backend.
  - Send the recorded audio through `INPUT`.
- Added support for different binary audio formats received through Socket.IO.
- Kept the frontend avatar state separate from the backend kiosk business state.
- Removed the temporary YES/NO buttons since customer interaction is handled through voice.
- Simplified the kiosk UI:
  - Removed session ID, gate ID, backend state, and avatar state from the screen.
  - Removed the visible recording/debug information.
  - Added a full-screen dark background.
  - Kept the kiosk focused on the avatar/customer interaction.
- Updated the frontend Socket.IO fallback URL to the NestJS middleware backend (`localhost:3000`).

### Next
- Complete the `CONFIRMING_PHONE` business logic.
- Implement the YES branch and continue the check-in flow.
- Implement phone-number collection for the NO branch.


## [2026-09-11] Refactor Kiosk Communication to Generic INPUT/OUTPUT Events

- Replaced specific Socket.IO kiosk events with two generic transport events:
  - `INPUT` for frontend → backend communication.
  - `OUTPUT` for backend → frontend communication.
- Added `KioskInputDto` and `KioskOutputDto` for the new communication structure.
- Updated `KioskGateway` to act as a transport layer:
  - Receives `INPUT` and publishes the internal `KIOSK_INPUT` event.
  - Sends backend responses through the generic `OUTPUT` event.
- Updated `KioskService` to process kiosk input based on the current session state stored in Redis.
- Removed the previous `CONFIRMING_PHONE` Socket.IO handler and specific `SEND_GREETING` / `ASKING_ABOUT_PHONE` socket events.
- Updated the voice confirmation flow:
  - SAP lookup → create kiosk session → greeting → `CONFIRMING_PHONE`.
  - Customer audio → `INPUT` → STT → NLU → process YES/NO.
  - NO response → update session to `PHONE_ASKING` → `OUTPUT`.
- Session state is now the backend source of truth for determining how incoming kiosk input should be processed.
- Removed the KioskService-level global state in favor of per-session state.

### Next
- Update the frontend to consume `OUTPUT` and send `INPUT`.
- Implement phone-number input handling and continue the check-in flow.


## [2026-09-11] Extend Voice Confirmation Flow with Phone Collection

**By:** @cline

**Requested:** Extend the Voice Kiosk confirmation flow to handle customers who do not confirm the phone number retrieved from SAP.

**Changes:**

- `middleware/src/kiosk/kiosk.service.ts` — Extended the voice confirmation flow to handle a negative customer response. When the customer does not confirm the phone number retrieved from SAP, the Kiosk now transitions to the phone-collection step and generates a voice prompt asking the customer to provide their phone number.

- `middleware/src/kiosk/kiosk.service.ts` — Added a dedicated `ASKING_ABOUT_PHONE` application event carrying the gate and session context, the generated TTS audio, and the corresponding display message.

- `middleware/src/kiosk/kiosk.gateway.ts` — Added an event listener for `ASKING_ABOUT_PHONE` that forwards the phone-collection prompt to the appropriate gate's Socket.IO room through the `ASKING_ABOUT_PHONE` gateway event.

- The phone-collection prompt now follows the same event-driven communication pattern as the kiosk greeting, keeping the Kiosk Service responsible for business logic while the Kiosk Gateway handles communication with the frontend.

**Voice Flow Update:**

LPR → SAP Lookup → Kiosk Session → Greeting → Customer Confirmation → STT → NLU → Negative Response → Ask for Phone Number → Frontend


## [2026-09-11] Implement Voice Confirmation Flow & Stub STT Integration

**By:** @cline

**Requested:** Implement the next stage of the Voice Kiosk cycle after the initial SAP lookup and greeting flow, including customer voice confirmation, STT → NLU processing, and a temporary Stub STT adapter for testing without ElevenLabs.

**Changes:**

- `middleware/src/kiosk/kiosk.gateway.ts` — Updated the `confirming.phone` Socket.IO handler to publish an internal `CONFIRMING_PHONE` event instead of directly executing Kiosk business logic.
- `middleware/src/common/events.ts` — Added `CONFIRMING_PHONE` to the central application events.
- `middleware/src/kiosk/kiosk.service.ts` — Added `handleConfirmingPhone()` to process customer voice responses through the STT and NLU adapters.
- `middleware/src/kiosk/kiosk.service.ts` — Integrated the existing `ISttAdapter` and `INluAdapter` abstractions into the confirmation flow.
- `middleware/src/kiosk/kiosk.service.ts` — Added the initial YES/NO intent handling for the customer phone confirmation step.
- `middleware/src/ai/nlu/...` — Connected the existing `NluRulesAdapter` to the kiosk flow through `INluAdapter.parse()`.
- `middleware/src/ai/stt/...` — Added `StubSttAdapter` implementing `ISttAdapter` to allow local testing without relying on the ElevenLabs STT service.
- `middleware/src/kiosk/kiosk.module.ts` — Configured the STT provider to use the Stub STT implementation for development/testing.
- Added configurable Stub STT responses through `STUB_STT_TEXT` so the voice flow can be tested with responses such as `ايوه`, `لا`, or a phone number.

**Voice Flow:**

LPR → SAP Lookup → Create Kiosk Session → Greeting/TTS → Customer Voice Response → STT → NLU → YES/NO Decision

**Notes:**

- The Kiosk Gateway is responsible for receiving Socket.IO messages and publishing application events.
- `KioskService` remains responsible for the kiosk business logic.
- STT and NLU are accessed through their interfaces/adapters, keeping the Kiosk Service independent from the actual provider.
- The Stub STT adapter is temporary and allows the complete kiosk state flow to be tested while ElevenLabs STT is unavailable.
- The next step is to complete the state transitions after `YES` / `NO`, including moving to `CHECKING_IN` or `PHONE_ASKING`.


## [2026-09-11 01:59] Fix Selected Gate RoomId Mismatch and Enable Console-Driven Gate Selection in Kiosk

**By:** @cline

**Requested:** Fix the Socket.IO room emission mismatch so the Kiosk page receives the `SEND_GREETING` event, and update the Kiosk page to join the specific gate selected on the Developer Console.

**Changes:**

- `middleware/src/kiosk/kiosk.gateway.ts` — Fixed `sendGreeting` to emit to the proper gate room name (`gate:${payload.gateId}`) rather than the raw gate ID.
- `middleware/src/kiosk/kiosk.gateway.ts` — Added additional room logging in `handleJoinRoom` for easier Socket.IO diagnostics.
- `web/app/console/page.tsx` — Updated `getUrlForApproach` to pass the selected `gateId` as a search query parameter when opening the Kiosk page.
- `web/app/kiosk/page.tsx` — Added dynamic `gateId` retrieval using `useSearchParams()`, with `gate-1` as a fallback.
- `web/app/kiosk/page.tsx` — Added a React `Suspense` boundary to support client-side search parameter handling.
- `web/app/kiosk/page.tsx` — Updated the Kiosk page to join the dynamically selected gate room.
- `web/app/kiosk/page.tsx` — Removed the premature `listening` state override that was interrupting the `talking` avatar state during TTS playback.

**Notes:**

The Kiosk now follows the gate selected from the Developer Console instead of relying on a hardcoded gate, and the backend/frontend use the same `gate:${gateId}` Socket.IO room convention.


## [2026-09-10 16:30] Implement Kiosk Session Management & Frontend Speech Integration

**By:** @cline

**Requested:** Implement backend Redis-based kiosk sessions, preserve gate context through SAP, and connect the frontend Kiosk to the backend greeting and TTS flow.

**Changes:**

- `middleware/src/common/dtos/sap-lookup-result.dto.ts` — Added `gateId` to preserve the gate context from LPR through SAP.
- `middleware/src/sap/sap.service.ts` — Updated SAP lookup handling to carry `gateId` into `SAP_LOOKUP_RESULT`.
- `middleware/src/kiosk/interfaces/kiosk-session.interface.ts` — Added the Kiosk session model containing `sessionId`, `gateId`, `plateNo`, customer information, and current kiosk state.
- `middleware/src/kiosk/session.repository.ts` — Added Redis-based session persistence using the existing `RedisService`.
- `middleware/src/kiosk/session.service.ts` — Added session creation and session management business logic.
- `middleware/src/kiosk/kiosk.module.ts` — Registered `SessionRepository` and `SessionService` and imported `RedisModule`.
- `middleware/src/kiosk/kiosk.service.ts` — Added session creation after SAP lookup.
- `middleware/src/kiosk/kiosk.service.ts` — Added initial `GREETING` state for SAP-found customers and `DATA_ASKING` for customers not found in SAP.
- `middleware/src/kiosk/kiosk.service.ts` — Added TTS greeting generation and `SEND_GREETING` emission with session and gate information.
- `web/lib/socket.ts` — Added `subscribeToSendGreeting()` for receiving backend greeting events.
- `web/app/kiosk/page.tsx` — Added frontend handling for `SEND_GREETING`, TTS audio playback, session tracking, and avatar state transitions.
- `web/app/kiosk/page.tsx` — Added temporary YES/NO controls for testing the confirmation stage.
- `web/app/kiosk/page.tsx` — Added browser audio unlocking and recording lifecycle management.
- `web/app/kiosk/page.tsx` — Added voice recording with `MediaRecorder` and silence detection before sending the customer's response to the backend.

**Notes:**

The initial end-to-end Kiosk startup flow is now connected:

LPR → SAP → Kiosk Session → Greeting → TTS → Frontend → Voice Recording → Backend


## [2026-09-10] Implement Voice Check-in & TTS Integration

**By:** @cline

**Requested:** Integrate text-to-speech into the Voice Kiosk workflow.

**Changes:**

- Integrated `ElevenLabsTtsAdapter` into `KioskService`.
- Configured the TTS adapter through the `ITtsAdapter` abstraction.
- Added TTS audio generation for Kiosk greeting messages.
- Added TTS provider error and timeout handling.
- Added frontend support for receiving and playing TTS audio buffers.
- Added avatar state transitions for `idle`, `talking`, and `listening`.
- Added a temporary `FakeTtsAdapter` for local testing without consuming ElevenLabs quota.

**Notes:**

The TTS provider remains replaceable through the adapter interface, allowing the Kiosk flow to be tested with either ElevenLabs or a local fake implementation.
