# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root configurations and contracts
COPY shared/contracts /shared/contracts
WORKDIR /shared/contracts
RUN npm ci && npm run build

# Setup crowd-management
WORKDIR /app
COPY services/crowd-management/package*.json ./
RUN npm ci

COPY services/crowd-management ./
RUN npm run build

# Stage 2: Production
FROM node:20-alpine

WORKDIR /app

RUN apk add --no-cache curl

COPY services/crowd-management/package*.json ./
RUN npm ci --only=production

COPY --from=builder /shared/contracts /shared/contracts
COPY --from=builder /app/dist ./dist

ENV NODE_ENV=production
EXPOSE 8002

CMD ["node", "dist/index.js"]
