# Release Log

## Unreleased

### Added

* QR ticket generation with unique tokens.
* Temporary QR ticket storage in Redis.
* 180-second QR ticket expiration.
* Single-use QR ticket consumption.
* Gate-specific QR ticket generation and check-in URLs.
* SAP/LPR integration for QR check-in flows.
* SAP HIT flow with locked plate and prefilled customer information.
* SAP MISS flow with prefilled but editable plate information.
* Mobile `/checkin` page for QR-based customer check-in.
* Real-time QR display updates through Socket.IO.
* Gate-specific QR display state.
* Initial QR display loading when the console opens or the selected gate changes.
* Local-network support for QR check-in testing.
* `middleware/.env.example` for portable backend configuration.
* `web/.env.example` for portable frontend configuration.

### Changed

* Connected QR check-in to the shared `CheckInService`.
* Added duplicate vehicle check-in protection.
* Added plate validation before consuming locked QR tickets.
* Added current-ticket cleanup after successful QR check-in.
* Added temporary plate-hint cleanup after successful QR check-in.
* Updated the kiosk console to clear stale QR and timer state.
* Updated QR URL generation to use the configured `APP_URL`.
* Added gate-aware QR generation so the selected gate receives its own ticket.
* Changed environment templates to use `localhost` instead of a machine-specific LAN IP.
* Added documentation for switching from `localhost` to a local LAN IP when testing QR codes from another device.

### Fixed

* Prevented an incorrect plate from consuming a valid locked QR ticket.
* Prevented stale QR information from remaining on the kiosk after ticket consumption or gate changes.
* Prevented missing `gateId` from being lost during SAP/LPR QR processing.
* Limited QR ticket fallback behavior to actual expired/used tickets.
* Added the missing mobile `/checkin` route used by scanned QR codes.
* Prevented machine-specific IP addresses from being required by the repository's default environment setup.

---

## [2026-09-10] — QR Check-in Flow with SAP/LPR Integration

**Author:** Rahma Mohamed

### Requested

Build the QR check-in flow for Approach B, including:

* Temporary QR tickets
* SAP/LPR integration
* Customer check-in
* Queue handling
* Gate-opening rules

### Implemented

* Added Redis-based QR ticket storage with a 180-second TTL.
* Added single-use QR ticket consumption.
* Added QR ticket generation and display endpoints.
* Integrated LPR plate reads with SAP lookup results.
* Added SAP HIT QR flow with locked plate and customer information.
* Added SAP MISS QR flow with prefilled but editable plate information.
* Added gate-specific QR ticket generation.
* Connected QR check-in to the shared `CheckInService`.
* Added duplicate vehicle check-in protection.
* Added Redis gate-open rate limiting.
* Added mobile QR check-in form with ticket prefill and plate locking.
* Added the `/checkin` mobile web page used by scanned QR codes.
* Added QR ticket expiration and single-use validation.
* Added atomic plate validation before QR ticket consumption.
* Added real-time QR display updates through Socket.IO.
* Added console synchronization when switching gates or refreshing the console.
* Added cleanup of stale QR display state and temporary plate hints.
* Updated QR URL generation to use the configured `APP_URL`.

### Testing

The following QR scenarios were tested successfully:

* Generic QR flow
* SAP HIT
* SAP MISS
* Successful QR submission
* Duplicate check-in blocking
* Queue creation
* Gate opening
* Gate-specific QR generation
* QR display updates

### Notes

Rate-limit logic is implemented, but the rapid consecutive gate-open scenario still needs final verification.

---

## [2026-09-12] — Portable Environment Configuration

**Author:** Rahma Mohamed

### Added

* Added `middleware/.env.example`.
* Added `web/.env.example`.
* Added generic `localhost` defaults for local development.
* Added comments explaining when a LAN IP is required for QR testing from another device.

### Changed

* Removed machine-specific IP addresses from the shared environment templates.
* Kept developer-specific `.env` and `.env.local` files local and ignored by Git.
* Updated README setup instructions to explain local development versus LAN QR testing.

### Result

The project can now be cloned and configured on another developer's machine without depending on Rahma's local IP address.
