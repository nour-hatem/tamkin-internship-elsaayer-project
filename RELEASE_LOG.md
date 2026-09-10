# Release Log

## Unreleased

### QR Check-in

* Added QR ticket generation with unique tokens.
* Added temporary QR ticket storage in Redis.
* Added 180-second ticket expiration.
* Added single-use QR tickets.
* Added mobile check-in endpoint.
* Connected QR check-in to the shared CheckInService.
* Added mobile check-in page.
* Added QR code rendering in the kiosk console.
* Added local-network support for QR check-in testing.

## [2026-09-10 16:15] QR check-in flow with SAP/LPR integration

**By:** Rahma Mohamed

**Requested:** Build the QR check-in flow for Approach B, including temporary QR tickets, SAP/LPR integration, customer check-in, queue handling, and gate-opening rules.

**Changes:**

* Added Redis-based QR ticket storage with a 180-second TTL and single-use token consumption.
* Added QR ticket generation and display endpoints.
* Integrated LPR plate reads with SAP lookup results to support SAP HIT and SAP MISS QR flows.
* SAP HIT creates a QR ticket with the plate locked and customer data prefilled.
* SAP MISS creates a QR ticket with the detected plate prefilled but editable.
* Connected QR check-in submission to the shared `CheckInService` instead of calling Queue/Gate services directly.
* Added duplicate vehicle check-in protection.
* Added Redis gate-open rate limiting to prevent repeated gate opens within the configured time window.
* Added the mobile QR check-in form with ticket prefill, plate locking, duplicate handling, and successful check-in state.
* Added the QR check-in frontend client flow and updated the console/check-in pages.

**Notes:** Main QR check-in scenarios were tested successfully, including Generic QR, SAP HIT, SAP MISS, successful submission, duplicate check-in blocking, queue creation, and gate opening. Rate-limit logic is implemented but the rapid consecutive-open scenario still needs final verification.
