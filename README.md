# FIFA Nexus AI — Smart Stadiums & Tournament Operations

![CI](https://github.com/manasviagarkar-cpu/FIFA_Nexus_AI/actions/workflows/ci.yml/badge.svg)
![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)
![Node](https://img.shields.io/badge/Node.js-20-brightgreen)
![Python](https://img.shields.io/badge/Python-3.11-blue)

A production-grade **microservices platform** for the **2026 FIFA World Cup** at MetLife Stadium — powering Smart Stadium Operations and Fan Experience across wayfinding, crowd management, fan AI assistance, and tournament operations.

> **Live Demo:** Vercel static dashboard → backed by Render microservices

---

## Architecture Overview

This project uses **Hexagonal Architecture (Ports and Adapters)** across all four services, keeping business rules cleanly separated from infrastructure concerns (HTTP, WebSockets, GraphQL, databases, caches, AI APIs).

```
                ┌──────────────────────────────────────────────┐
                │          FIFA Nexus AI — Live Dashboard       │
                │          (Vercel Static — public/)            │
                └─────────────────────┬────────────────────────┘
                                      │ REST / GraphQL / WS
        ┌─────────────────────────────┼──────────────────────────────────┐
        │                             │                    │              │
        v                             v                    v              v
┌──────────────┐             ┌──────────────┐   ┌──────────────┐  ┌──────────────┐
│ Wayfinding   │             │ Crowd Mgmt   │   │ Fan Assist   │  │ Tournament   │
│ (FastAPI)    │             │ (Express+WS) │   │ (Apollo GQL) │  │ Ops (Express)│
│ Port: 8001   │             │ Port: 8002   │   │ Port: 8003   │  │ Port: 8004   │
└──────┬───────┘             └──────┬───────┘   └──────┬───────┘  └──────┬───────┘
       │                            │                   │                  │
       └────────────────────────────┼───────────────────┘                  │
                                    │                                       │
                         ┌──────────┴────────┐                  ┌──────────┴────┐
                         │   PostgreSQL DB    │                  │  Redis Cache  │
                         └───────────────────┘                  └───────────────┘
```

### Core Services

1. **Dynamic Wayfinding Service** (`services/wayfinding` · Python / FastAPI · Port 8001)
   - Real-time route calculation using A* pathfinding, adjusted dynamically by live crowd density.
   - Role-based routing: VIP fast-tracks, wheelchair-accessible paths, family-friendly routes.
   - Hexagonal adapters for PostgreSQL (zone/path data) and Redis (route caching).

2. **Predictive Crowd Management Service** (`services/crowd-management` · Node.js / TypeScript / Express + WebSocket · Port 8002)
   - Ingests IoT sensor readings: turnstiles, cameras, Wi-Fi probes, crowd counters.
   - Computes 15/30-minute congestion forecasts using an EWMA model.
   - Real-time WebSocket streaming of sensor events and crowd alerts to the dashboard.
   - **Tournament integration:** queries Tournament Ops for upcoming kickoff times and applies a surge multiplier to predictions (up to +40% near kickoff).

3. **Multilingual Fan Assistance API** (`services/fan-assistance` · Node.js / TypeScript / Apollo Server · Port 8003)
   - Unified GraphQL endpoint backed by Gemini Pro for contextual stadium Q&A.
   - 10-language translation with two-tier caching (Redis + PostgreSQL).
   - Star-rating feedback mutations for continuous AI response quality improvement.

4. **Tournament Operations Service** (`services/tournament-ops` · Node.js / TypeScript / Express · Port 8004) ⭐ *New*
   - Full match/fixture CRUD (create, update scores, mark live/completed, delete).
   - Group standings computation with FIFA tiebreaker logic (points → GD → GF → H2H).
   - Venue-based upcoming match endpoint used by Crowd Management for kickoff surge detection.
   - Hexagonal adapters for PostgreSQL (match persistence) and Redis (standings cache).

---

## Directory Structure

```
FIFA_Nexus_AI/
├── .eslintrc.json              # Root ESLint config (all TS services inherit)
├── .prettierrc                 # Root Prettier config
├── .vercelignore               # Prevents venv/ / node_modules from confusing Vercel
├── vercel.json                 # Static site: serve public/ (no framework, no build)
├── render.yaml                 # Render IaC: 4 services + Postgres + Redis
├── docker-compose.yml          # Local orchestration
├── .env.example
├── LICENSE
│
├── public/
│   └── index.html              # Full-featured demo dashboard (2200+ lines)
│                               # JWT auth, wayfinding, crowd, fan AI, tournament tabs
│
├── shared/
│   └── contracts/              # Zero-drift shared type package
│       ├── src/
│       │   ├── common.ts       # Enums, base structures
│       │   ├── auth.ts         # JWT payload, roles, permissions
│       │   ├── wayfinding.ts   # Route request/response types
│       │   ├── crowd.ts        # Sensor, prediction, alert types
│       │   ├── fan-assistance.ts
│       │   ├── tournament-ops.ts  # Match, standing, venue types ⭐ New
│       │   └── index.ts        # Barrel export
│       └── python/
│           └── contracts.py    # Auto-generated Pydantic mirror (run generate:python)
│
├── scripts/
│   ├── seed-database.sql           # Full DB schema + seed data (incl. matches table) ⭐
│   └── generate-python-contracts.ts # Codegen: TS → Pydantic (replaces hand-editing) ⭐
│
├── services/
│   ├── wayfinding/             # Python FastAPI
│   │   ├── Dockerfile
│   │   ├── pyproject.toml      # Ruff + Black configured
│   │   └── app/
│   │       ├── main.py
│   │       ├── domain/
│   │       ├── ports/
│   │       ├── adapters/
│   │       └── core/           # A* pathfinding
│   │
│   ├── crowd-management/       # Express + WebSocket
│   │   ├── Dockerfile
│   │   └── src/
│   │       ├── index.ts
│   │       ├── domain/         # Prediction, alert, sensor services
│   │       └── adapters/
│   │           └── outbound/
│   │               └── tournament/   # TournamentOpsAdapter ⭐ New
│   │
│   ├── fan-assistance/         # Apollo GraphQL
│   │   ├── Dockerfile
│   │   └── src/
│   │
│   └── tournament-ops/         # Express REST ⭐ New service
│       ├── Dockerfile
│       ├── package.json
│       ├── tsconfig.json
│       ├── jest.config.ts
│       ├── .eslintrc.json
│       └── src/
│           ├── index.ts
│           ├── config/
│           ├── domain/
│           │   ├── entities/   # match.entity, standing.entity
│           │   ├── ports/      # inbound.ports, outbound.ports
│           │   └── services/   # match.service, standings.service
│           ├── adapters/
│           │   ├── inbound/http/  # routes, tournament.controller, middleware
│           │   └── outbound/      # postgres.adapter, redis.adapter
│           └── utils/          # Zod validators
│
└── .github/
    └── workflows/
        └── ci.yml              # CI: all 4 services linted, type-checked, tested ⭐
```

---

## Deployment

### Static Frontend (Vercel)

The `public/index.html` dashboard is served by Vercel as a plain static site.

**Why `vercel.json` is configured the way it is:**
- `"framework": null` — prevents Vercel from auto-detecting Python (due to `venv/`) or Node frameworks
- `"buildCommand": ""` / `"installCommand": ""` — skip the build phase entirely
- `"outputDirectory": "public"` — serve files from `public/` directly

```json
{
  "version": 2,
  "framework": null,
  "buildCommand": "",
  "outputDirectory": "public",
  "installCommand": "",
  "routes": [{ "src": "/(.*)", "dest": "/index.html" }]
}
```

### Backend Services (Render)

All 4 backend microservices are deployed via `render.yaml` as Dockerized web services on Render.

| Service | Render Name | Port |
|---------|-------------|------|
| Wayfinding | `fifa-nexus-wayfinding` | 8001 |
| Crowd Management | `fifa-nexus-crowd-management` | 8002 |
| Fan Assistance | `fifa-nexus-fan-assistance` | 8003 |
| Tournament Ops | `fifa-nexus-tournament-ops` | 8004 |
| PostgreSQL | `fifa-nexus-postgres` | — |
| Redis | `fifa-nexus-redis` | — |

**Deploy steps:**
1. Fork/push this repo to GitHub
2. Go to [render.com/deploy](https://render.com) → "New" → "Blueprint"
3. Connect your GitHub repo — Render reads `render.yaml` automatically
4. Set `GEMINI_API_KEY` as an environment secret in the `fan-assistance` service
5. After deploy, update the dashboard URL inputs in the frontend

---

## Local Development

### Requirements
- Docker & Docker Compose
- Node.js v20+ (for TS services)
- Python 3.11+ (for wayfinding)

### Quick Start
```bash
# Clone
git clone https://github.com/manasviagarkar-cpu/FIFA_Nexus_AI.git
cd FIFA_Nexus_AI

# Configure
cp .env.example .env  # Add your GEMINI_API_KEY

# Start all services + DB
docker-compose up --build -d

# Verify health
curl http://localhost:8001/api/v1/health-wayfinding
curl http://localhost:8002/api/v1/health
curl http://localhost:8003/api/v1/health
curl http://localhost:8004/api/v1/health
```

---

## Testing Guide

All services enforce **≥ 85% statement/branch coverage** via Jest (TS) and pytest (Python).

```bash
# Python — Wayfinding
cd services/wayfinding && python -m pytest tests/ -v --cov=app

# TypeScript — Crowd Management
cd services/crowd-management && npm install && npm test

# TypeScript — Fan Assistance
cd services/fan-assistance && npm install && npm test

# TypeScript — Tournament Ops  ⭐ New
cd services/tournament-ops && npm install && npm test
```

### Code Quality Commands
```bash
# Lint all TS services
cd services/crowd-management && npm run lint
cd services/fan-assistance && npm run lint
cd services/tournament-ops && npm run lint

# Python lint/format
cd services/wayfinding && ruff check . && black --check .

# Generate Python contracts mirror from TS source
cd shared/contracts && npm run generate:python
```

---

## Key API Schemas

### Wayfinding — `POST /api/v1/routes/calculate`
```json
{
  "origin": "gate-a",
  "destination": "seating-vip",
  "accessibilityNeeds": ["wheelchair"],
  "isVIP": true,
  "preference": "accessible"
}
```

### Crowd Management — `POST /api/v1/sensors/ingest` (Staff/Admin)
```json
{
  "readings": [{
    "sensorId": "turn-gatea-1",
    "sensorType": "turnstile",
    "zoneId": "gate-a",
    "timestamp": "2026-07-14T08:00:00Z",
    "payload": { "type": "turnstile", "entriesCount": 150, "exitsCount": 10, "periodSeconds": 60, "gateId": "gate-a-g1" }
  }],
  "sourceSystem": "turnstile-iot",
  "batchId": "batch-101"
}
```

### WebSocket — `WS /ws/sensors?token=<JWT>`
Real-time crowd alerts and sensor events from Redis pub/sub.

### Fan Assistance — GraphQL `POST /graphql`
```graphql
query AskStadium {
  askStadium(input: {
    query: "Can I bring my bag into MetLife?",
    language: en,
    currentZoneId: "gate-a"
  }) {
    answer
    accessibilityNotes
    sources { title type relevance }
  }
}
```

### Tournament Ops ⭐ — `POST /api/v1/matches` (Admin)
```json
{
  "stage": "group",
  "groupId": "A",
  "homeTeam": "USA",
  "awayTeam": "MEX",
  "venueId": "seating-101",
  "venueName": "MetLife Stadium - Section 101",
  "kickoffTime": "2026-06-11T20:00:00Z"
}
```

### Tournament Ops — `GET /api/v1/standings`
Returns computed group standings with FIFA tiebreakers (points → GD → GF → H2H).

### Tournament Ops — `GET /api/v1/matches/venue/:venueId/upcoming`
Returns the next scheduled match at a given venue — consumed by Crowd Management for kickoff surge detection.

---

## Environment Variables

| Variable | Service | Description |
|---|---|---|
| `DATABASE_URL` | All | PostgreSQL connection string |
| `REDIS_URL` | All | Redis connection URL |
| `JWT_SECRET` | All | HS256 signing secret (match across services) |
| `GEMINI_API_KEY` | fan-assistance | Google Gemini Pro API key |
| `TOURNAMENT_OPS_URL` | crowd-management | URL of tournament-ops service |
| `SERVICE_PORT` | All | Port to bind (defaults: 8001–8004) |
