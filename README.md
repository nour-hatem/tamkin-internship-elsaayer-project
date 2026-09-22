# Toyota Kiosk & Queue System MVP

Internal MVP for the Toyota Service Center Voice & QR Kiosk and Queue Management System.

The system supports customer check-in through QR and voice-based flows, LPR/SAP vehicle identification, queue management, gate control, and real-time kiosk updates.

---

## Overview

The system is designed around a service-center kiosk workflow:

1. A vehicle arrives at a service-center gate.
2. The vehicle can be identified through LPR and SAP.
3. The kiosk generates a QR check-in ticket or starts the voice flow.
4. The customer completes the required information.
5. The backend validates the check-in.
6. A queue entry is created.
7. The gate can be opened according to the configured business rules.
8. Kiosk clients receive real-time updates through Socket.IO.

The project follows a **Hexagonal Architecture (Ports & Adapters)** approach to keep business logic independent from infrastructure details.

---

## Architecture

```text
                    ┌─────────────────────┐
                    │   Next.js Web App   │
                    │  Kiosk / Check-in   │
                    └──────────┬──────────┘
                               │ HTTP / Socket.IO
                               ▼
                    ┌─────────────────────┐
                    │     NestJS API      │
                    │                     │
                    │  Application Logic  │
                    │  Domain Services    │
                    └───────┬─────┬───────┘
                            │     │
                 ┌──────────┘     └──────────┐
                 ▼                           ▼
        ┌─────────────────┐         ┌─────────────────┐
        │   PostgreSQL    │         │      Redis      │
        │     + Prisma    │         │ Tickets / TTL   │
        └─────────────────┘         └─────────────────┘

                 External / Infrastructure Adapters
                 ┌────────────┬────────────┐
                 ▼            ▼            ▼
                SAP          LPR        Gate System
```

---

## Tech Stack

| Layer                   | Technology                   |
| ----------------------- | ---------------------------- |
| Backend                 | NestJS                       |
| Frontend                | Next.js                      |
| Language                | TypeScript                   |
| Database                | PostgreSQL                   |
| ORM                     | Prisma                       |
| Cache / Temporary State | Redis                        |
| Real-time Communication | Socket.IO                    |
| Validation              | class-validator              |
| API Documentation       | Swagger                      |
| Containerization        | Docker / Docker Compose      |
| Architecture            | Hexagonal / Ports & Adapters |

---

## Project Structure

```text
tamkeen-internship-elsaayer-project/
│
├── middleware/              # NestJS backend
│   ├── src/
│   │   ├── checkin/
│   │   ├── common/
│   │   ├── gate/
│   │   ├── kiosk/
│   │   ├── queue/
│   │   ├── qr/
│   │   ├── sap/
│   │   └── ...
│   ├── .env.example
│   └── ...
│
├── web/                     # Next.js frontend
│   ├── app/
│   │   ├── checkin/
│   │   └── console/
│   ├── features/
│   │   ├── checkin/
│   │   └── ...
│   ├── .env.example
│   └── ...
│
├── docker-compose.yml
├── README.md
└── RELEASE_LOG.md
```

---

# Quick Start

## Prerequisites

Make sure the following are installed:

* Node.js
* npm
* Docker Desktop
* Git

## 1. Start infrastructure

From the project root:

```bash
docker compose up -d
```

This starts the required PostgreSQL and Redis services.

## 2. Install dependencies

From the project root:

```bash
npm install
```

If the workspaces are not installed from the root, install dependencies separately:

```bash
cd middleware
npm install

cd ../web
npm install
```

## 3. Configure environment variables

The repository includes example environment files so that each developer can create local configuration without committing machine-specific settings.

### Backend

Copy:

```text
middleware/.env.example
```

to:

```text
middleware/.env
```

### Frontend

Copy:

```text
web/.env.example
```

to:

```text
web/.env.local
```

For normal local development, keep the default `localhost` values.

---

## Local Development vs LAN Testing

### Local development

The default configuration uses:

```text
http://localhost:3000
http://localhost:3001
```

This is the recommended setup when everything is running on the same computer.

### QR testing from another device

If a phone or another device needs to scan the QR code and access the application, replace `localhost` with the **LAN IP address of the computer running the project**.

For example:

```env
APP_URL=http://192.168.x.x:3000
NEXT_PUBLIC_APP_URL=http://192.168.x.x:3000
NEXT_PUBLIC_BACKEND_URL=http://192.168.x.x:3001
```

The exact IP is different for each local network and computer.

The computer and the device scanning the QR code must be connected to the same network, and the required ports must be accessible.

---

## 4. Run the backend

```bash
cd middleware
npm run start:dev
```

Backend:

```text
http://localhost:3001
```

## 5. Run the frontend

```bash
cd web
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

# Main Flows

## 1. QR Check-in

The QR flow allows a customer to scan a QR code displayed at the kiosk and complete the check-in from a mobile device.

```text
LPR / SAP / Generic Request
          │
          ▼
      QR Ticket
          │
          ▼
   QR displayed on kiosk
          │
          ▼
 Customer scans QR
          │
          ▼
     /checkin page
          │
          ▼
   Validate ticket
          │
          ▼
     CheckInService
          │
          ▼
   Queue + Gate logic
```

## 2. Voice Check-in

The voice flow uses the shared check-in infrastructure while allowing the kiosk to collect customer information through the voice interaction layer.

## 3. LPR + SAP

LPR provides the detected plate number.

The SAP integration determines whether the vehicle/customer exists.

The QR flow supports:

* **SAP HIT** → plate locked + customer information prefilled.
* **SAP MISS** → detected plate prefilled but editable.
* **Generic QR** → customer enters the required information manually.

## 4. Queue & Gate

After a successful check-in:

* The customer is added to the queue.
* Queue information is returned to the client.
* Gate-opening rules are applied.
* Duplicate check-ins are rejected.

## 5. Real-time Updates

Socket.IO is used to synchronize kiosk displays.

```text
QR Ticket Created
      │
      ▼
Typed Event Emitter
      │
      ▼
Kiosk Gateway
      │
      ▼
Socket.IO
      │
      ▼
Browser / Kiosk
```

---

# QR Check-in Flow

The QR implementation currently supports:

### QR Ticket Generation

Each ticket contains:

* Unique token
* Gate ID
* Source
* Plate information when available
* Customer information when available
* Expiration information

Tickets are stored temporarily in Redis with a **180-second TTL**.

### Gate-specific QR Tickets

QR tickets are generated for the selected gate.

The generated URL contains:

```text
/checkin?gate=<gateId>&t=<token>
```

### SAP HIT

When SAP finds the vehicle:

```text
LPR Plate
   ↓
SAP Lookup
   ↓
SAP HIT
   ↓
QR Ticket
   ├── Plate locked
   ├── Customer name
   └── Customer phone
```

### SAP MISS

When SAP does not find the vehicle:

```text
LPR Plate
   ↓
SAP Lookup
   ↓
SAP MISS
   ↓
QR Ticket
   └── Plate prefilled but editable
```

### Mobile Check-in

The QR code opens:

```text
/checkin
```

The page:

1. Reads the QR token and gate ID.
2. Retrieves the ticket information.
3. Prefills available information.
4. Locks the plate when required.
5. Allows the customer to complete the check-in.
6. Submits the request to the backend.

### Ticket Validation

QR tickets:

* Expire after 180 seconds.
* Can only be consumed once.
* Validate locked plate numbers before consumption.
* Do not get burned when the customer submits an incorrect locked plate.

### Real-time Display

The kiosk console receives QR state updates through Socket.IO.

The display is synchronized when:

* A new QR ticket is created.
* A QR ticket is successfully consumed.
* The selected gate changes.
* The console initially loads.
* The current QR ticket disappears or expires.

---

# Developer Console & LPR Simulation

The developer console can be used to simulate the kiosk/LPR workflow during development.

It supports:

* Gate selection
* QR generation
* QR display
* LPR simulation
* SAP lookup flow
* Real-time display updates

---

# Configuration

Important backend configuration includes:

```env
DATABASE_URL=...
REDIS_URL=...
APP_URL=...
ACTIVE_APPROACH=...
```

The frontend uses:

```env
NEXT_PUBLIC_APP_URL=...
NEXT_PUBLIC_BACKEND_URL=...
```

Example environment files are provided in:

```text
middleware/.env.example
web/.env.example
```

These files use `localhost` by default and do not contain machine-specific IP addresses.

---

# Active Approach

The project supports switching between different customer check-in approaches.

For example:

```env
ACTIVE_APPROACH=qr
```

The QR service only handles SAP lookup events when QR is the active approach.

This prevents different approaches from processing the same event simultaneously.

---

# Team Contributions

## Rahma Mohamed — QR Check-in

### Completed

* [x] QR ticket generation with unique tokens.
* [x] Gate-specific QR ticket generation and check-in URLs.
* [x] Redis-based temporary ticket storage.
* [x] 180-second ticket expiration.
* [x] Single-use QR tickets.
* [x] SAP/LPR-aware QR flows.
* [x] SAP HIT flow with locked plate and customer information.
* [x] SAP MISS flow with editable plate information.
* [x] Mobile `/checkin` page.
* [x] QR check-in form and ticket prefill.
* [x] Duplicate vehicle check-in protection.
* [x] Plate validation before QR ticket consumption.
* [x] Current ticket and plate-hint cleanup.
* [x] Real-time QR display updates through Socket.IO.
* [x] Gate-specific QR display state.
* [x] Stale QR state cleanup.
* [x] Local-network support for QR testing.
* [x] Portable environment templates for local development.

---

# Current Status

### QR Check-in

**Implemented**

* QR generation
* SAP HIT / MISS integration
* Mobile check-in
* Ticket expiration
* Single-use validation
* Plate validation
* Queue integration
* Gate integration
* Real-time display synchronization

### Remaining / Future Improvements

* Additional production integrations
* More extensive end-to-end testing
* Production deployment configuration
* Final verification of rapid consecutive gate-open rate limiting
* Further UI/UX improvements

---

# Development Notes

The project follows a feature-based Git workflow.

Development branches should be created for individual features and merged into `dev` for review before reaching `master`.

Keep commits focused and avoid combining unrelated changes in a single commit.

---

# License

Internal training / internship project.
