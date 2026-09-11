# Releases

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