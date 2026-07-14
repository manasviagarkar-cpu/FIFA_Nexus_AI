# FIFA Nexus AI — Microservices Backend

A production-ready microservices backend for **FIFA Nexus AI**, a Smart Stadium Operations and Fan Experience platform for the 2026 World Cup, constructed using Node.js (TypeScript), FastAPI (Python), PostgreSQL, and Redis.

## Architecture Overview

This project uses **Hexagonal Architecture (Ports and Adapters)** across all three services. This separates business rules (Domain services, entities) from external concerns (HTTP APIs, WebSockets, GraphQL endpoints, databases, caches, and AI APIs).

```
               +-------------------------------------------------+
               |              FIFA Nexus AI API                  |
               +-------------------------------------------------+
                                      |
       +------------------------------+------------------------------+
       |                              |                              |
       v                              v                              v
+--------------+               +--------------+               +--------------+
| Wayfinding   |               | Crowd Mgmt   |               | Fan Assist   |
| (FastAPI)    |               | (Express)    |               | (GraphQL)    |
| Port: 8001   |               | Port: 8002   |               | Port: 8003   |
+--------------+               +--------------+               +--------------+
       |                              |                              |
       +--------------+---------------+                              |
                      |                                              |
                      v                                              v
               +--------------+                               +--------------+
               | PostgreSQL   |                               | Gemini Pro   |
               | & Redis      |                               | AI SDK       |
               +--------------+                               +--------------+
```

### Core Services

1. **Dynamic Wayfinding Service (Python / FastAPI):**
   - Calculates personalized, real-time stadium navigation routes.
   - Built-in pathfinding (A* algorithm) adjusting weights dynamically based on real-time crowd density, user accessibility needs, VIP statuses, and route preferences.
2. **Predictive Crowd Management Service (Node.js / TypeScript / Express):**
   - Ingests IoT sensor readings (turnstiles, cameras, Wi-Fi probes, crowd counters).
   - Computes forecasted congestions 15-30 minutes ahead using an Exponentially Weighted Moving Average (EWMA) model.
   - Generates automated high-priority alerts to dispatch safety personnel.
3. **Multilingual Fan Assistance API (Node.js / TypeScript / Apollo Server GraphQL):**
   - Single unified GraphQL endpoint integrating with Gemini Pro for contextual stadium Q&A and translation.
   - Two-tier caching (Redis + PostgreSQL) for ultra-low latency translations.

---

## Directory Structure

```
FIFA_Nexus_AI/
├── docker-compose.yml
├── .env.example
├── README.md
├── shared/
│   └── contracts/                    # Zero-drift shared contract packages
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       │   ├── common.ts             # Shared enums and structures
│       │   ├── auth.ts               # JWT, roles, permissions
│       │   ├── wayfinding.ts         # Route requests/responses
│       │   ├── crowd.ts              # Sensor inputs, prediction maps
│       │   ├── fan-assistance.ts     # Translations, queries schemas
│       │   └── index.ts              # Exports
│       └── python/
│           └── contracts.py          # Python mirror Pydantic models
│
└── services/
    ├── wayfinding/                   # Python FastAPI
    │   ├── Dockerfile
    │   ├── requirements.txt
    │   ├── pyproject.toml
    │   └── app/
    │       ├── main.py               # Lifecycles, health check, CORS
    │       ├── config.py             # Settings
    │       ├── domain/               # Pydantic models & core entities
    │       ├── ports/                # Inbound/outbound ports
    │       ├── adapters/             # REST routing & DB/Cache adapters
    │       └── core/                 # A* pathfinding core
    │
    ├── crowd-management/             # Express HTTP & WebSocket
    │   ├── Dockerfile
    │   ├── package.json
    │   ├── tsconfig.json
    │   └── src/
    │       ├── index.ts              # Express & WebSocket bootstrapper
    │       ├── domain/               # Entities, use cases, ports
    │       ├── adapters/             # REST/WS & PG/Redis clients
    │       └── utils/                # EWMA calculator & Zod validators
    │
    └── fan-assistance/               # Express Apollo GraphQL
        ├── Dockerfile
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts              # Express & Apollo Server setup
            ├── domain/               # Entities, use cases, ports
            └── adapters/             # GQL resolvers, Gemini & DB clients
```

---

## Local Development & Setup

### Requirements
- Docker and Docker Compose
- Node.js v20+ & npm (optional, for local service runs)
- Python 3.11+ (optional, for local python runs)

### Steps

1. **Clone and Navigate:**
   ```bash
   cd FIFA_Nexus_AI
   ```

2. **Configure Environment:**
   Copy `.env.example` to `.env` and configure your credentials.
   ```bash
   cp .env.example .env
   ```
   *Make sure to provide your `GEMINI_API_KEY` for live Q&A/translation queries.*

3. **Orchestrate via Docker Compose:**
   Run the entire environment (Postgres, Redis, and all 3 microservices):
   ```bash
   docker-compose up --build -d
   ```
   This automatically:
   - Builds production multi-stage images.
   - Restores the database schema and seeds realistic MetLife stadium zones, paths, and default test accounts via `scripts/seed-database.sql`.

4. **Verify Health:**
   ```bash
   curl http://localhost:8001/api/v1/health
   curl http://localhost:8002/api/v1/health
   curl http://localhost:8003/api/v1/health
   ```

---

## Testing Guide

All services contain unit and E2E test suites with mocked infrastructure and APIs. Coverage requirements are configured to enforce `>85%` statement/branch coverage.

### Run Python Wayfinding Tests
```bash
cd services/wayfinding
python -m pip install -r requirements.txt
python -m pytest tests/ -v
```

### Run Node.js Crowd Management Tests
```bash
cd services/crowd-management
npm install
npm run test
```

### Run Node.js Fan Assistance Tests
```bash
cd services/fan-assistance
npm install
npm run test
```

---

## Key Endpoint Schemas

### 1. Dynamic Wayfinding (`:8001`)
- **`POST /api/v1/routes/calculate`**
  - Header: `Authorization: Bearer <JWT>`
  - Body:
    ```json
    {
      "origin": "gate-a",
      "destination": "seating-vip",
      "accessibilityNeeds": ["wheelchair"],
      "isVIP": true,
      "preference": "accessible"
    }
    ```

### 2. Predictive Crowd Management (`:8002`)
- **`POST /api/v1/sensors/ingest`**
  - Header: `Authorization: Bearer <JWT>` (requires role `staff` or `admin`)
  - Body:
    ```json
    {
      "readings": [
        {
          "sensorId": "turn-gatea-1",
          "sensorType": "turnstile",
          "zoneId": "gate-a",
          "timestamp": "2026-07-14T08:00:00Z",
          "payload": {
            "type": "turnstile",
            "entriesCount": 150,
            "exitsCount": 10,
            "periodSeconds": 60,
            "gateId": "gate-a-g1"
          }
        }
      ],
      "sourceSystem": "turnstile-iot",
      "batchId": "batch-101"
    }
    ```

- **`WS /ws/sensors?token=<JWT>`**
  - Connect to receive live real-time updates and active staff alerts broadcasted from Redis pub/sub.

### 3. Fan Assistance GraphQL (`:8003/graphql`)
- **Ask Query Example:**
  ```graphql
  query AskStadium {
    askStadium(input: {
      query: "Can I bring my bag into MetLife?",
      language: en,
      currentZoneId: "gate-a"
    }) {
      answer
      accessibilityNotes
      sources {
        title
        type
        relevance
      }
    }
  }
  ```
