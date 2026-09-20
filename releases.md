# Releases

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
