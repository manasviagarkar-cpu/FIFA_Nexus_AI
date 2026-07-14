# FIFA Nexus AI — API Documentation Overview

This document provides a technical specification of the endpoints and queries offered by the FIFA Nexus AI microservices ecosystem.

---

## 1. Dynamic Wayfinding Service (FastAPI, Port 8001)

Performs real-time navigation calculations using stadium graph routing.

### Calculate Route
- **Endpoint**: `POST /api/v1/routes/calculate`
- **Authentication**: JWT Required (role: `fan`, `staff`, or `admin`)
- **Headers**:
  ```http
  Authorization: Bearer <JWT_TOKEN>
  Content-Type: application/json
  ```
- **Request Body**:
  ```json
  {
    "origin": "gate-a",
    "destination": "seating-vip",
    "accessibilityNeeds": ["wheelchair"],
    "isVIP": true,
    "preference": "accessible",
    "maxDensityThreshold": 0.85
  }
  ```
- **Response Payload**:
  ```json
  {
    "success": true,
    "data": {
      "routeId": "7df4c7e6-7b44-4869-bc91-28b9dcd8e41a",
      "path": [
        {
          "stepNumber": 1,
          "nodeId": "gate-a",
          "nodeName": "Gate A - Main Entrance",
          "zoneType": "entrance",
          "coordinate": {
            "latitude": 40.8135,
            "longitude": -74.0745,
            "level": 0
          },
          "instruction": "Start at Gate A - Main Entrance.",
          "altText": "Step 1: Start at Gate A - Main Entrance. Area: Gate A - Main Entrance (entrance). Crowd level: low. Estimated time: 0 seconds.",
          "timeFromPreviousSeconds": 0.0,
          "distanceFromPreviousMeters": 0.0,
          "currentDensity": 0.1,
          "congestionLevel": "low"
        }
      ],
      "totalTimeSeconds": 50.0,
      "totalDistanceMeters": 30.0,
      "averageDensity": 0.1,
      "accessibilityNotes": "Route has 1 steps, total distance 30 meters, estimated time 50 seconds.",
      "altText": "Route from Gate A - Main Entrance to Premium Concourse...",
      "isPersonalized": true,
      "preference": "accessible",
      "calculatedAt": "2026-07-14T03:00:00Z",
      "validForSeconds": 60
    }
  }
  ```

### Get Live Zone Densities
- **Endpoint**: `GET /api/v1/zones/density`
- **Authentication**: JWT Required (role: `fan`, `staff`, or `admin`)
- **Response**:
  ```json
  {
    "success": true,
    "data": [
      {
        "zoneId": "gate-a",
        "zoneName": "Gate A - Main Entrance",
        "zoneType": "entrance",
        "currentOccupancy": 100,
        "maxCapacity": 2000,
        "densityRatio": 0.05,
        "congestionLevel": "low",
        "trend": 0.0,
        "altText": "Gate A - Main Entrance: 100 of 2000 capacity, congestion level low",
        "updatedAt": "2026-07-14T03:00:00Z"
      }
    ]
  }
  ```

---

## 2. Predictive Crowd Management Service (Express, Port 8002)

Ingests live IoT turnstile/CCTV sensor metrics and manages automated staff alerts.

### Ingest Sensor Readings
- **Endpoint**: `POST /api/v1/sensors/ingest`
- **Authentication**: JWT Required (role: `staff` or `admin`)
- **Request Body**:
  ```json
  {
    "readings": [
      {
        "sensorId": "turnstile-a1",
        "sensorType": "turnstile",
        "zoneId": "gate-a",
        "timestamp": "2026-07-14T08:00:00Z",
        "payload": {
          "type": "turnstile",
          "entriesCount": 10,
          "exitsCount": 2,
          "periodSeconds": 60,
          "gateId": "gate-a-g1"
        }
      }
    ],
    "sourceSystem": "iot-gateways",
    "batchId": "batch-101"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "processedCount": 1,
      "rejectedCount": 0,
      "batchId": "batch-101",
      "processedAt": "2026-07-14T03:00:00Z"
    }
  }
  ```

### Acknowledge Dispatch Alert
- **Endpoint**: `POST /api/v1/alerts/acknowledge`
- **Authentication**: JWT Required (role: `staff` or `admin`)
- **Request Body**:
  ```json
  {
    "alertId": "5df4c7e6-7b44-4869-bc91-28b9dcd8e41a",
    "staffId": "d0f3c5e8-5b22-4211-ac81-12b9dcd8e41b",
    "notes": "Moving out to support Gate A queue control"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "data": {
      "alertId": "5df4c7e6-7b44-4869-bc91-28b9dcd8e41a",
      "status": "acknowledged",
      "acknowledgedBy": "d0f3c5e8-5b22-4211-ac81-12b9dcd8e41b",
      "acknowledgedAt": "2026-07-14T03:05:00Z"
    }
  }
  ```

### Live WebSocket Sensor & Alert Feed
- **Endpoint**: `WS /ws/sensors?token=<JWT_TOKEN>`
- **Authorization**: Token checks permissions for `prediction:view`.
- **Broadcast Events**:
  - `prediction_update`: Emitted every 30 seconds after prediction pipeline finishes.
  - `alert_new`: Emitted immediately when a critical congestion threshold is forecasted.

---

## 3. Fan Assistance GraphQL API (Apollo Server, Port 8003)

Unified GraphQL gateway powering conversational Q&A and translation utilizing Google Gemini Pro.

### GraphQL Playground URL
- `http://localhost:8003/graphql`

### Sample Queries

#### Translate Text Query
```graphql
query TranslateText {
  translate(input: {
    text: "Where can I find the nearest medical station?",
    targetLanguage: es,
    context: "emergency"
  }) {
    translatedText
    sourceLanguage
    targetLanguage
    confidence
    cached
  }
}
```

#### Ask Stadium Assistant Query
```graphql
query AskStadium {
  askStadium(input: {
    query: "Is there wheelchair assistance at gate A?",
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
    relatedQueries
  }
}
```

#### Submit Rating Feedback Mutation
```graphql
mutation SubmitFeedback {
  submitFeedback(input: {
    interactionType: "stadium_query",
    interactionId: "7df4c7e6-7b44-4869-bc91-28b9dcd8e41a",
    rating: 5,
    comment: "Excellent directions, very helpful for locating the elevator."
  }) {
    feedbackId
    acknowledged
    message
  }
}
```
