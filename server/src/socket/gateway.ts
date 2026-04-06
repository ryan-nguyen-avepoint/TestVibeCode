import { Server as HttpServer } from 'http';
import { Server, Socket } from 'socket.io';
import { redisPub, redisSub, redis, RedisKeys, useRedis, storeReady } from '../lib/redis';
import { verifyToken } from '../middleware/auth';
import { sendMessageSchema } from '../validators';
import { userDb, memberDb, messageDb, roomDb } from '../lib/database';
import { config } from '../config';

let ioInstance: Server | null = null;
// userId -> Set of socketIds (supports multiple devices)
const userSocketMap = new Map<string, Set<string>>();

export function getIO(): Server | null {
  return ioInstance;
}

export function getUserSocketId(userId: string): string | undefined {
  const sockets = userSocketMap.get(userId);
  if (!sockets || sockets.size === 0) return undefined;
  // Return first socket (for sending targeted events like invites)
  return sockets.values().next().value;
}

export function getAllUserSocketIds(userId: string): string[] {
  const sockets = userSocketMap.get(userId);
  if (!sockets) return [];
  return Array.from(sockets);
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

interface ServerToClientEvents {
  'message:new': (message: any) => void;
  'message:system': (message: any) => void;
  'user:online': (data: { userId: string; username: string; roomId?: string }) => void;
  'user:offline': (data: { userId: string; username: string; roomId?: string }) => void;
  'user:typing': (data: { userId: string; username: string; roomId: string }) => void;
  'user:stop-typing': (data: { userId: string; username: string; roomId: string }) => void;
  'room:created': (room: any) => void;
  'room:updated': (room: any) => void;
  'room:user-joined': (data: { roomId: string; user: any }) => void;
  'room:user-left': (data: { roomId: string; user: any }) => void;
  'room:online-users': (data: { roomId: string; users: any[] }) => void;
  'invite:received': (invite: any) => void;
  'error': (data: { message: string }) => void;
}

interface ClientToServerEvents {
  'room:join': (data: { roomId: string }, ack?: (res: any) => void) => void;
  'room:leave': (data: { roomId: string }, ack?: (res: any) => void) => void;
  'message:send': (data: { roomId: string; content?: string; type?: string; imageUrl?: string }, ack?: (res: any) => void) => void;
  'typing:start': (data: { roomId: string }) => void;
  'typing:stop': (data: { roomId: string }) => void;
  'room:get-online': (data: { roomId: string }) => void;
}

export async function initializeSocket(httpServer: HttpServer): Promise<Server> {
  // Wait for the store (Redis or in-memory) to be ready
  await storeReady;

  const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
    cors: {
      origin: config.cors.clientUrl,
      methods: ['GET', 'POST'],
      credentials: true,
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    transports: ['websocket', 'polling'],
  });

  ioInstance = io;

  // Redis adapter for horizontal scaling (only if Redis is available)
  if (useRedis && redisPub && redisSub) {
    const { createAdapter } = await import('@socket.io/redis-adapter');
    io.adapter(createAdapter(redisPub, redisSub));
    console.log('📡 Socket.io using Redis adapter');
  } else {
    console.log('📡 Socket.io using in-memory adapter (single instance)');
  }

  // Authentication middleware
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.query.token;
      if (!token || typeof token !== 'string') {
        return next(new Error('Authentication required'));
      }

      const payload = verifyToken(token);
      if (!payload) {
        return next(new Error('Invalid token'));
      }

      socket.userId = payload.userId;
      socket.username = payload.username;
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket: AuthenticatedSocket) => {
    const userId = socket.userId!;
    const username = socket.username!;

    console.log(`⚡ User connected: ${username} (${socket.id})`);

    // Track user socket mapping (multiple devices)
    if (!userSocketMap.has(userId)) {
      userSocketMap.set(userId, new Set());
    }
    userSocketMap.get(userId)!.add(socket.id);

    // Track user presence in Redis
    await redis.pipeline()
      .set(RedisKeys.userOnline(userId), socket.id)
      .set(RedisKeys.socketUser(socket.id), JSON.stringify({ userId, username }))
      .set(RedisKeys.userSocket(userId), socket.id)
      .exec();

    // Update DB online status
    userDb.updateOnline.run(1, userId);

    // Auto-join all rooms user is a member of
    const memberships = memberDb.findRoomIds(userId);

    for (const { roomId } of memberships) {
      socket.join(roomId);
      await redis.sadd(RedisKeys.roomOnline(roomId), userId);
      
      // Notify room that user came online
      socket.to(roomId).emit('user:online', { userId, username, roomId });
    }

    // ===== Event Handlers =====

    // Join a socket room (for real-time events after REST join)
    socket.on('room:join', async (data, ack) => {
      try {
        const { roomId } = data;

        // Verify membership exists
        const membership = memberDb.find(userId, roomId);

        if (!membership) {
          ack?.({ success: false, error: 'Not a member of this room' });
          return;
        }

        socket.join(roomId);
        await redis.sadd(RedisKeys.roomOnline(roomId), userId);

        // Notify room
        socket.to(roomId).emit('room:user-joined', {
          roomId,
          user: { id: userId, username, isOnline: true },
        });

        // Send online users list to joining user
        const onlineUserIds = await redis.smembers(RedisKeys.roomOnline(roomId));
        const onlineUsers = userDb.findManyByIds(onlineUserIds);

        socket.emit('room:online-users', { roomId, users: onlineUsers });

        ack?.({ success: true });
      } catch (error) {
        console.error('Room join error:', error);
        ack?.({ success: false, error: 'Failed to join room' });
      }
    });

    // Leave a socket room
    socket.on('room:leave', async (data, ack) => {
      try {
        const { roomId } = data;
        
        socket.leave(roomId);
        await redis.srem(RedisKeys.roomOnline(roomId), userId);

        socket.to(roomId).emit('room:user-left', {
          roomId,
          user: { id: userId, username },
        });

        ack?.({ success: true });
      } catch (error) {
        console.error('Room leave error:', error);
        ack?.({ success: false, error: 'Failed to leave room' });
      }
    });

    // Send message
    socket.on('message:send', async (data, ack) => {
      try {
        const parsed = sendMessageSchema.safeParse({
          ...data,
          type: data.type || 'TEXT',
        });

        if (!parsed.success) {
          ack?.({ success: false, error: parsed.error.errors[0].message });
          return;
        }

        const { roomId, content, type, imageUrl } = parsed.data;

        // Verify membership
        const membership = memberDb.find(userId, roomId);

        if (!membership) {
          ack?.({ success: false, error: 'Not a member of this room' });
          return;
        }

        // Create message in DB
        const message = messageDb.create({
          content: content || null,
          type,
          imageUrl: imageUrl || null,
          userId,
          roomId,
        });

        // Update room timestamp
        roomDb.updateTimestamp.run(roomId);

        // Broadcast to all in room (including sender)
        io.to(roomId).emit('message:new', message);

        ack?.({ success: true, message });
      } catch (error) {
        console.error('Send message error:', error);
        ack?.({ success: false, error: 'Failed to send message' });
      }
    });

    // Typing indicators
    socket.on('typing:start', (data) => {
      socket.to(data.roomId).emit('user:typing', { userId, username, roomId: data.roomId });
    });

    socket.on('typing:stop', (data) => {
      socket.to(data.roomId).emit('user:stop-typing', { userId, username, roomId: data.roomId });
    });

    // Get online users for a room
    socket.on('room:get-online', async (data) => {
      try {
        const onlineUserIds = await redis.smembers(RedisKeys.roomOnline(data.roomId));
        const onlineUsers = userDb.findManyByIds(onlineUserIds);
        socket.emit('room:online-users', { roomId: data.roomId, users: onlineUsers });
      } catch (error) {
        console.error('Get online users error:', error);
      }
    });

    // ===== Disconnect =====
    socket.on('disconnect', async () => {
      console.log(`💔 User disconnected: ${username} (${socket.id})`);

      // Remove this specific socket from user's socket set
      const sockets = userSocketMap.get(userId);
      if (sockets) {
        sockets.delete(socket.id);
        if (sockets.size === 0) {
          userSocketMap.delete(userId);
        }
      }

      // Clean up this socket from Redis
      await redis.pipeline()
        .del(RedisKeys.socketUser(socket.id))
        .exec();

      // Only mark user offline if they have NO remaining connections
      const stillConnected = userSocketMap.has(userId) && userSocketMap.get(userId)!.size > 0;
      if (!stillConnected) {
        await redis.pipeline()
          .del(RedisKeys.userOnline(userId))
          .del(RedisKeys.userSocket(userId))
          .exec();

        // Update DB
        userDb.updateOnline.run(0, userId);

        // Notify all rooms
        for (const { roomId } of memberships) {
          await redis.srem(RedisKeys.roomOnline(roomId), userId);
          socket.to(roomId).emit('user:offline', { userId, username, roomId });
        }
      }
    });
  });

  return io;
}
