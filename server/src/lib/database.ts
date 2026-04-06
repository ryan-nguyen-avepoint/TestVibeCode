import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

const DATA_DIR = path.resolve(__dirname, '../../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
const DB_PATH = path.join(DATA_DIR, 'dev.db');
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ============================================================
// Schema Creation
// ============================================================
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    avatar_url TEXT,
    is_online INTEGER DEFAULT 0,
    last_seen TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS rooms (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_global INTEGER DEFAULT 0,
    is_private INTEGER DEFAULT 0,
    avatar_url TEXT,
    owner_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (owner_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS room_members (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    role TEXT DEFAULT 'MEMBER',
    joined_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    UNIQUE(user_id, room_id)
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    content TEXT,
    type TEXT DEFAULT 'TEXT',
    image_url TEXT,
    user_id TEXT NOT NULL,
    room_id TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_messages_room_created ON messages(room_id, created_at);

  CREATE TABLE IF NOT EXISTS room_invites (
    id TEXT PRIMARY KEY,
    room_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    receiver_id TEXT NOT NULL,
    status TEXT DEFAULT 'PENDING',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (room_id) REFERENCES rooms(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(room_id, receiver_id)
  );
`);

// ============================================================
// Auto-seed: Ensure system user + global room always exist
// ============================================================
(function ensureGlobalRoom() {
  const bcryptjs = require('bcryptjs');
  // 1. Ensure system user exists
  const sysUser = db.prepare('SELECT id FROM users WHERE id = ?').get('system');
  if (!sysUser) {
    const hash = bcryptjs.hashSync('system_password_not_for_login', 12);
    db.prepare(
      'INSERT OR IGNORE INTO users (id, username, password) VALUES (?, ?, ?)'
    ).run('system', 'system', hash);
    console.log('✅ System user auto-created');
  }
  // 2. Ensure global room exists
  const globalRoom = db.prepare('SELECT id FROM rooms WHERE id = ?').get('global-room');
  if (!globalRoom) {
    db.prepare(
      'INSERT INTO rooms (id, name, description, is_global, is_private, owner_id) VALUES (?, ?, ?, 1, 0, ?)'
    ).run('global-room', '🌍 Global Chat', 'Welcome to the global chat room! Everyone is here.', 'system');
    console.log('✅ Global room auto-created');
  }
})();

// ============================================================
// Helper: Generate CUID-like IDs
// ============================================================
function cuid(): string {
  return 'c' + crypto.randomBytes(12).toString('hex');
}

// ============================================================
// User Queries
// ============================================================
export const userDb = {
  findByUsername: db.prepare<[string], any>('SELECT * FROM users WHERE username = ?'),

  findById: db.prepare<[string], any>('SELECT * FROM users WHERE id = ?'),

  findByIdSelect: (id: string) => {
    return db.prepare('SELECT id, username, avatar_url as avatarUrl, is_online as isOnline, created_at as createdAt FROM users WHERE id = ?').get(id);
  },

  create: (data: { username: string; password: string }) => {
    const id = cuid();
    db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)').run(id, data.username, data.password);
    return db.prepare('SELECT id, username, avatar_url as avatarUrl, created_at as createdAt FROM users WHERE id = ?').get(id) as any;
  },

  updateOnline: db.prepare('UPDATE users SET is_online = ?, last_seen = datetime(\'now\'), updated_at = datetime(\'now\') WHERE id = ?'),

  search: (query: string, excludeId: string) => {
    return db.prepare(
      'SELECT id, username, avatar_url as avatarUrl, is_online as isOnline FROM users WHERE username LIKE ? AND id != ? LIMIT 20'
    ).all(`%${query}%`, excludeId) as any[];
  },

  findManyByIds: (ids: string[]) => {
    if (ids.length === 0) return [];
    const placeholders = ids.map(() => '?').join(',');
    return db.prepare(
      `SELECT id, username, avatar_url as avatarUrl, is_online as isOnline FROM users WHERE id IN (${placeholders})`
    ).all(...ids) as any[];
  },

  upsert: (id: string, username: string, password: string) => {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (existing) return existing;
    db.prepare('INSERT INTO users (id, username, password) VALUES (?, ?, ?)').run(id, username, password);
    return { id, username };
  },
};

// ============================================================
// Room Queries
// ============================================================
export const roomDb = {
  findById: (id: string) => {
    return db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as any;
  },

  findGlobal: () => {
    return db.prepare('SELECT * FROM rooms WHERE is_global = 1').get() as any;
  },

  create: (data: { name: string; description?: string; isPrivate?: boolean; ownerId: string; id?: string }) => {
    const id = data.id || cuid();
    db.prepare(
      'INSERT INTO rooms (id, name, description, is_private, owner_id) VALUES (?, ?, ?, ?, ?)'
    ).run(id, data.name, data.description || null, data.isPrivate ? 1 : 0, data.ownerId);
    return { id, name: data.name };
  },

  upsert: (id: string, data: { name: string; description?: string; isGlobal?: boolean; isPrivate?: boolean; ownerId: string }) => {
    const existing = db.prepare('SELECT id FROM rooms WHERE id = ?').get(id);
    if (existing) return existing;
    db.prepare(
      'INSERT INTO rooms (id, name, description, is_global, is_private, owner_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, data.name, data.description || null, data.isGlobal ? 1 : 0, data.isPrivate ? 1 : 0, data.ownerId);
    return { id };
  },

  findByIdFull: (id: string) => {
    const room = db.prepare('SELECT * FROM rooms WHERE id = ?').get(id) as any;
    if (!room) return null;
    const owner = db.prepare('SELECT id, username, avatar_url as avatarUrl FROM users WHERE id = ?').get(room.owner_id) as any;
    const members = db.prepare(`
      SELECT rm.role, u.id, u.username, u.avatar_url as avatarUrl, u.is_online as isOnline 
      FROM room_members rm JOIN users u ON rm.user_id = u.id WHERE rm.room_id = ?
    `).all(id) as any[];
    const memberCount = members.length;
    const messageCount = (db.prepare('SELECT COUNT(*) as cnt FROM messages WHERE room_id = ?').get(id) as any).cnt;

    return {
      id: room.id,
      name: room.name,
      description: room.description,
      isGlobal: !!room.is_global,
      isPrivate: !!room.is_private,
      avatarUrl: room.avatar_url,
      ownerId: room.owner_id,
      owner,
      members: members.map((m: any) => ({ user: { id: m.id, username: m.username, avatarUrl: m.avatarUrl, isOnline: !!m.isOnline }, role: m.role })),
      memberCount,
      messageCount,
      createdAt: room.created_at,
      updatedAt: room.updated_at,
    };
  },

  updateTimestamp: db.prepare('UPDATE rooms SET updated_at = datetime(\'now\') WHERE id = ?'),

  findPublicNotMember: (userId: string) => {
    const rows = db.prepare(`
      SELECT r.*, 
             (SELECT COUNT(*) FROM room_members WHERE room_id = r.id) as member_count
      FROM rooms r 
      WHERE r.is_private = 0 AND r.is_global = 0 
        AND r.id NOT IN (SELECT room_id FROM room_members WHERE user_id = ?)
      ORDER BY r.created_at DESC LIMIT 50
    `).all(userId) as any[];

    return rows.map((r: any) => {
      const owner = db.prepare('SELECT id, username, avatar_url as avatarUrl FROM users WHERE id = ?').get(r.owner_id) as any;
      return {
        id: r.id, name: r.name, description: r.description,
        isGlobal: !!r.is_global, isPrivate: !!r.is_private,
        ownerId: r.owner_id, owner,
        _count: { members: r.member_count, messages: 0 },
        createdAt: r.created_at,
      };
    });
  },

  delete: (id: string) => {
    // Cascade delete: invites, messages, members, then room
    db.prepare('DELETE FROM room_invites WHERE room_id = ?').run(id);
    db.prepare('DELETE FROM messages WHERE room_id = ?').run(id);
    db.prepare('DELETE FROM room_members WHERE room_id = ?').run(id);
    db.prepare('DELETE FROM rooms WHERE id = ?').run(id);
  },

  getMemberIds: (roomId: string) => {
    return (db.prepare('SELECT user_id FROM room_members WHERE room_id = ?').all(roomId) as any[]).map((r: any) => r.user_id);
  },
};

// ============================================================
// Room Member Queries
// ============================================================
export const memberDb = {
  find: (userId: string, roomId: string) => {
    return db.prepare('SELECT * FROM room_members WHERE user_id = ? AND room_id = ?').get(userId, roomId) as any;
  },

  create: (userId: string, roomId: string, role: string = 'MEMBER') => {
    const id = cuid();
    db.prepare('INSERT INTO room_members (id, user_id, room_id, role) VALUES (?, ?, ?, ?)').run(id, userId, roomId, role);
  },

  delete: (userId: string, roomId: string) => {
    db.prepare('DELETE FROM room_members WHERE user_id = ? AND room_id = ?').run(userId, roomId);
  },

  countByRoom: (roomId: string): number => {
    const row = db.prepare('SELECT COUNT(*) as cnt FROM room_members WHERE room_id = ?').get(roomId) as any;
    return row?.cnt || 0;
  },

  findUserRooms: (userId: string) => {
    const memberships = db.prepare('SELECT room_id, role FROM room_members WHERE user_id = ?').all(userId) as any[];
    return memberships.map((m: any) => {
      const room = roomDb.findByIdFull(m.room_id);
      return room ? { ...room, myRole: m.role } : null;
    }).filter(Boolean);
  },

  findRoomIds: (userId: string) => {
    return (db.prepare('SELECT room_id as roomId FROM room_members WHERE user_id = ?').all(userId) as any[]);
  },
};

// ============================================================
// Message Queries
// ============================================================
export const messageDb = {
  create: (data: { content?: string | null; type: string; imageUrl?: string | null; userId: string; roomId: string }) => {
    const id = cuid();
    db.prepare(
      'INSERT INTO messages (id, content, type, image_url, user_id, room_id) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, data.content || null, data.type, data.imageUrl || null, data.userId, data.roomId);

    const msg = db.prepare('SELECT * FROM messages WHERE id = ?').get(id) as any;
    const user = db.prepare('SELECT id, username, avatar_url as avatarUrl FROM users WHERE id = ?').get(data.userId) as any;
    return {
      id: msg.id, content: msg.content, type: msg.type,
      imageUrl: msg.image_url, userId: msg.user_id, roomId: msg.room_id,
      user, createdAt: msg.created_at, updatedAt: msg.updated_at,
    };
  },

  findByRoom: (roomId: string, limit: number = 50, cursorId?: string) => {
    let rows: any[];
    if (cursorId) {
      const cursor = db.prepare('SELECT created_at FROM messages WHERE id = ?').get(cursorId) as any;
      if (cursor) {
        rows = db.prepare(
          'SELECT * FROM messages WHERE room_id = ? AND created_at < ? ORDER BY created_at DESC LIMIT ?'
        ).all(roomId, cursor.created_at, limit + 1) as any[];
      } else {
        rows = [];
      }
    } else {
      rows = db.prepare(
        'SELECT * FROM messages WHERE room_id = ? ORDER BY created_at DESC LIMIT ?'
      ).all(roomId, limit + 1) as any[];
    }

    const hasMore = rows.length > limit;
    if (hasMore) rows.pop();

    const messages = rows.reverse().map((msg: any) => {
      const user = db.prepare('SELECT id, username, avatar_url as avatarUrl FROM users WHERE id = ?').get(msg.user_id) as any;
      return {
        id: msg.id, content: msg.content, type: msg.type,
        imageUrl: msg.image_url, userId: msg.user_id, roomId: msg.room_id,
        user, createdAt: msg.created_at, updatedAt: msg.updated_at,
      };
    });

    return { messages, hasMore, nextCursor: hasMore ? messages[0]?.id : undefined };
  },
};

// ============================================================
// Invite Queries
// ============================================================
export const inviteDb = {
  findPending: (roomId: string, receiverId: string) => {
    return db.prepare('SELECT * FROM room_invites WHERE room_id = ? AND receiver_id = ? AND status = \'PENDING\'').get(roomId, receiverId) as any;
  },

  create: (data: { roomId: string; senderId: string; receiverId: string }) => {
    const id = cuid();
    // Upsert logic
    const existing = db.prepare('SELECT id FROM room_invites WHERE room_id = ? AND receiver_id = ?').get(data.roomId, data.receiverId) as any;
    if (existing) {
      db.prepare('UPDATE room_invites SET status = \'PENDING\', sender_id = ? WHERE id = ?').run(data.senderId, existing.id);
      return existing;
    }
    db.prepare('INSERT INTO room_invites (id, room_id, sender_id, receiver_id) VALUES (?, ?, ?, ?)').run(id, data.roomId, data.senderId, data.receiverId);
    return { id };
  },

  accept: (id: string) => {
    db.prepare('UPDATE room_invites SET status = \'ACCEPTED\' WHERE id = ?').run(id);
  },

  decline: (id: string) => {
    db.prepare('UPDATE room_invites SET status = \'DECLINED\' WHERE id = ?').run(id);
  },

  findById: (id: string) => {
    return db.prepare('SELECT * FROM room_invites WHERE id = ?').get(id) as any;
  },

  findPendingForUser: (receiverId: string) => {
    const rows = db.prepare(`
      SELECT ri.*, 
             r.id as r_id, r.name as r_name, r.description as r_description,
             u.id as s_id, u.username as s_username, u.avatar_url as s_avatarUrl
      FROM room_invites ri
      JOIN rooms r ON ri.room_id = r.id
      JOIN users u ON ri.sender_id = u.id
      WHERE ri.receiver_id = ? AND ri.status = 'PENDING'
        AND NOT EXISTS (
          SELECT 1 FROM room_members rm 
          WHERE rm.user_id = ri.receiver_id AND rm.room_id = ri.room_id
        )
      ORDER BY ri.created_at DESC
    `).all(receiverId) as any[];

    return rows.map((r: any) => ({
      id: r.id, roomId: r.room_id, status: r.status, createdAt: r.created_at,
      room: { id: r.r_id, name: r.r_name, description: r.r_description },
      sender: { id: r.s_id, username: r.s_username, avatarUrl: r.s_avatarUrl },
    }));
  },
};

export { db, cuid };
export default db;
