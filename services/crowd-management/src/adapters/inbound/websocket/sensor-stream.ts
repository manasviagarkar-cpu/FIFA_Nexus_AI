import { Server } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import jwt from 'jsonwebtoken';
import { config } from '../../../config';
import { JWTPayload, UserRole, ROLE_PERMISSIONS } from '@shared/auth';
import { redisClient } from '../../../infrastructure/redis';
import { logger } from '../../../infrastructure/logger';

export const setupWebSocketServer = (server: Server): WebSocketServer => {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as JWTPayload;
      const permissions = ROLE_PERMISSIONS[decoded.role as UserRole] || [];

      // Only staff/admin or users with prediction:view can stream live predictions
      if (!permissions.includes('prediction:view')) {
        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
        socket.destroy();
        return;
      }

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request, decoded);
      });
    } catch (err: any) {
      logger.warn('WS upgrade verification failure:', err.message);
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
    }
  });

  wss.on('connection', (ws: WebSocket, request, user: JWTPayload) => {
    logger.info(`WebSocket connection established for user ${user.sub} (${user.role})`);

    // Ping/pong heartbeat mechanism to avoid stale sockets
    let isAlive = true;
    ws.on('pong', () => {
      isAlive = true;
    });

    const pingInterval = setInterval(() => {
      if (!isAlive) {
        logger.info(`Terminating stale socket connection for user ${user.sub}`);
        ws.terminate();
        return;
      }
      isAlive = false;
      ws.ping();
    }, 30000);

    ws.on('close', () => {
      logger.info(`WebSocket connection closed for user ${user.sub}`);
      clearInterval(pingInterval);
    });

    ws.on('error', (err) => {
      logger.error(`WebSocket error on connection ${user.sub}:`, err);
    });
  });

  // Redis Pub/Sub integration for streaming predictions to all clients
  const startRedisSubscriber = async () => {
    try {
      const subscriberClient = redisClient.duplicate();
      await subscriberClient.connect();
      logger.info('WS Redis subscriber client connected.');

      await subscriberClient.subscribe('predictions:cycle', (message) => {
        const payload = JSON.stringify({
          type: 'prediction_update',
          timestamp: new Date().toISOString(),
          data: JSON.parse(message),
        });
        broadcast(wss, payload);
      });

      await subscriberClient.subscribe('alerts:active', (message) => {
        const payload = JSON.stringify({
          type: 'alert_new',
          timestamp: new Date().toISOString(),
          data: JSON.parse(message),
        });
        broadcast(wss, payload);
      });
    } catch (err) {
      logger.error('Failed to initialize Redis Subscriber for WS broadcasts:', err);
    }
  };

  startRedisSubscriber();

  return wss;
};

const broadcast = (wss: WebSocketServer, payload: string) => {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
};
