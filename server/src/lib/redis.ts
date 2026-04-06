import { config } from '../config';

// ============================================================
// In-memory presence store (used when Redis is not available)
// Works perfectly for single-instance deployments
// ============================================================

class MemoryStore {
  private store = new Map<string, string>();
  private sets = new Map<string, Set<string>>();

  async set(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async get(key: string): Promise<string | null> {
    return this.store.get(key) || null;
  }

  async del(key: string): Promise<void> {
    this.store.delete(key);
    this.sets.delete(key);
  }

  async sadd(key: string, ...members: string[]): Promise<void> {
    if (!this.sets.has(key)) this.sets.set(key, new Set());
    const s = this.sets.get(key)!;
    members.forEach((m) => s.add(m));
  }

  async srem(key: string, ...members: string[]): Promise<void> {
    const s = this.sets.get(key);
    if (s) members.forEach((m) => s.delete(m));
  }

  async smembers(key: string): Promise<string[]> {
    const s = this.sets.get(key);
    return s ? Array.from(s) : [];
  }

  pipeline() {
    const ops: Array<() => Promise<void>> = [];
    const self = this;
    const chain = {
      set(key: string, value: string) {
        ops.push(() => self.set(key, value));
        return chain;
      },
      del(key: string) {
        ops.push(() => self.del(key));
        return chain;
      },
      async exec() {
        for (const op of ops) await op();
      },
    };
    return chain;
  }
}

// ============================================================
// Exports — Redis or In-Memory based on config
// ============================================================

let redis: MemoryStore = new MemoryStore();
let redisPub: any = null;
let redisSub: any = null;
let useRedis = false;

async function initializeStore(): Promise<void> {
  if (config.redis.enabled) {
    try {
      const Redis = (await import('ioredis')).default;
      const redisConfig = {
        host: config.redis.host,
        port: config.redis.port,
        password: config.redis.password,
        retryStrategy: (times: number) => Math.min(times * 50, 2000),
        maxRetriesPerRequest: null as null,
      };
      const testConn = new Redis(redisConfig);
      await testConn.ping();
      testConn.disconnect();

      redis = new Redis(redisConfig) as any;
      redisPub = new Redis(redisConfig);
      redisSub = new Redis(redisConfig);
      useRedis = true;

      console.log('✅ Redis connected — using Redis adapter for horizontal scaling');
      return;
    } catch (err: any) {
      console.warn('⚠️  Redis not available, falling back to in-memory store');
      console.warn(`   (${err.message})`);
    }
  }

  // Fallback
  redis = new MemoryStore();
  redisPub = null;
  redisSub = null;
  useRedis = false;
  console.log('📦 Using in-memory presence store (single-instance mode)');
}

const storeReady = initializeStore();

// Redis key helpers
const RedisKeys = {
  userOnline: (userId: string) => `user:online:${userId}`,
  userSocket: (userId: string) => `user:socket:${userId}`,
  socketUser: (socketId: string) => `socket:user:${socketId}`,
  roomOnline: (roomId: string) => `room:online:${roomId}`,
  userRooms: (userId: string) => `user:rooms:${userId}`,
  typing: (roomId: string) => `room:typing:${roomId}`,
} as const;

export { redis, redisPub, redisSub, RedisKeys, useRedis, storeReady };
export default redis;
