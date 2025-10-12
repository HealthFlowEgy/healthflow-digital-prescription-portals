// File: backend/services/websocket/websocket.service.ts
// Purpose: Real-time WebSocket service with Socket.IO

import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import { logger } from '../../shared/utils/logger';
import { db } from '../../shared/database/connection';

interface AuthSocket extends Socket {
  userId?: string;
  userEmail?: string;
  tenantId?: string;
}

export class WebSocketService {
  private io: Server;
  private userSockets: Map<string, Set<string>> = new Map(); // userId -> Set of socketIds

  constructor(httpServer: HttpServer) {
    this.io = new Server(httpServer, {
      cors: {
        origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
        methods: ['GET', 'POST'],
        credentials: true,
      },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
    });

    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();

    logger.info('WebSocket service initialized');
  }

  /**
   * Setup Redis adapter for horizontal scaling
   */
  private async setupRedisAdapter() {
    try {
      const pubClient = createClient({ url: process.env.REDIS_URL });
      const subClient = pubClient.duplicate();

      await Promise.all([pubClient.connect(), subClient.connect()]);

      this.io.adapter(createAdapter(pubClient, subClient));

      logger.info('Redis adapter configured for WebSocket');
    } catch (error) {
      logger.error('Failed to setup Redis adapter:', error);
      // Continue without Redis adapter (single instance mode)
    }
  }

  /**
   * Setup authentication middleware
   */
  private setupMiddleware() {
    this.io.use(async (socket: AuthSocket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        socket.userId = decoded.userId;
        socket.userEmail = decoded.email;
        socket.tenantId = decoded.tenantId;

        logger.info(`WebSocket authenticated: ${socket.userEmail} (${socket.id})`);
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed:', error);
        next(new Error('Invalid token'));
      }
    });
  }

  /**
   * Setup event handlers
   */
  private setupEventHandlers() {
    this.io.on('connection', (socket: AuthSocket) => {
      this.handleConnection(socket);

      socket.on('disconnect', () => this.handleDisconnect(socket));
      socket.on('subscribe', (data) => this.handleSubscribe(socket, data));
      socket.on('unsubscribe', (data) => this.handleUnsubscribe(socket, data));
      socket.on('ping', () => socket.emit('pong'));
    });
  }

  /**
   * Handle new connection
   */
  private handleConnection(socket: AuthSocket) {
    const userId = socket.userId!;

    // Track user's socket
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(socket.id);

    // Join user's personal room
    socket.join(`user:${userId}`);

    // Join tenant room if available
    if (socket.tenantId) {
      socket.join(`tenant:${socket.tenantId}`);
    }

    // Send welcome message
    socket.emit('connected', {
      socketId: socket.id,
      userId,
      timestamp: new Date().toISOString(),
    });

    logger.info(`User ${socket.userEmail} connected (${socket.id})`);

    // Update user's online status
    this.updateOnlineStatus(userId, true);
  }

  /**
   * Handle disconnection
   */
  private handleDisconnect(socket: AuthSocket) {
    const userId = socket.userId!;

    // Remove socket from user's set
    const userSocketSet = this.userSockets.get(userId);
    if (userSocketSet) {
      userSocketSet.delete(socket.id);
      
      // If no more sockets for this user, mark as offline
      if (userSocketSet.size === 0) {
        this.userSockets.delete(userId);
        this.updateOnlineStatus(userId, false);
      }
    }

    logger.info(`User ${socket.userEmail} disconnected (${socket.id})`);
  }

  /**
   * Handle room subscription
   */
  private handleSubscribe(socket: AuthSocket, data: { room: string }) {
    const { room } = data;
    
    // Validate room access
    if (this.canAccessRoom(socket, room)) {
      socket.join(room);
      socket.emit('subscribed', { room });
      logger.info(`User ${socket.userEmail} subscribed to ${room}`);
    } else {
      socket.emit('error', { message: 'Access denied to room' });
    }
  }

  /**
   * Handle room unsubscription
   */
  private handleUnsubscribe(socket: AuthSocket, data: { room: string }) {
    const { room } = data;
    socket.leave(room);
    socket.emit('unsubscribed', { room });
    logger.info(`User ${socket.userEmail} unsubscribed from ${room}`);
  }

  /**
   * Validate room access
   */
  private canAccessRoom(socket: AuthSocket, room: string): boolean {
    // User can access their own room
    if (room === `user:${socket.userId}`) {
      return true;
    }

    // User can access their tenant's room
    if (room === `tenant:${socket.tenantId}`) {
      return true;
    }

    // Add more room access logic as needed
    return false;
  }

  /**
   * Update user's online status
   */
  private async updateOnlineStatus(userId: string, isOnline: boolean) {
    try {
      await db('public.users')
        .where({ id: userId })
        .update({
          is_online: isOnline,
          last_seen_at: new Date(),
        });
    } catch (error) {
      logger.error('Failed to update online status:', error);
    }
  }

  // ========== PUBLIC METHODS FOR EMITTING EVENTS ==========

  /**
   * Send notification to specific user
   */
  public sendToUser(userId: string, event: string, data: any) {
    this.io.to(`user:${userId}`).emit(event, data);
    logger.debug(`Sent ${event} to user ${userId}`);
  }

  /**
   * Send notification to all users in a tenant
   */
  public sendToTenant(tenantId: string, event: string, data: any) {
    this.io.to(`tenant:${tenantId}`).emit(event, data);
    logger.debug(`Sent ${event} to tenant ${tenantId}`);
  }

  /**
   * Broadcast to all connected users
   */
  public broadcast(event: string, data: any) {
    this.io.emit(event, data);
    logger.debug(`Broadcast ${event} to all users`);
  }

  /**
   * Send notification to specific room
   */
  public sendToRoom(room: string, event: string, data: any) {
    this.io.to(room).emit(event, data);
    logger.debug(`Sent ${event} to room ${room}`);
  }

  /**
   * Get online user count
   */
  public getOnlineUserCount(): number {
    return this.userSockets.size;
  }

  /**
   * Check if user is online
   */
  public isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId);
  }

  /**
   * Get user's socket count
   */
  public getUserSocketCount(userId: string): number {
    return this.userSockets.get(userId)?.size || 0;
  }

  /**
   * Get Socket.IO server instance
   */
  public getIO(): Server {
    return this.io;
  }
}

// Singleton instance
let wsService: WebSocketService;

export function initializeWebSocket(httpServer: HttpServer): WebSocketService {
  if (!wsService) {
    wsService = new WebSocketService(httpServer);
  }
  return wsService;
}

export function getWebSocketService(): WebSocketService {
  if (!wsService) {
    throw new Error('WebSocket service not initialized');
  }
  return wsService;
}