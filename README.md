# VibeRyan — Real-time Chat Application

A scalable, production-ready real-time chat application built with **Socket.io**, **Express**, **React**, **Tailwind CSS**, **better-sqlite3**, and **Zod** validation.

## ✨ Features

- 🌍 **Global Chat** — Default channel for all users
- 🏠 **Room Management** — Create, join, leave rooms with Room ID sharing
- 🔒 **Private Rooms** — Owner-controlled access with invite system
- 👥 **Presence System** — Real-time online/offline, join/leave notifications
- 💬 **Real-time Messaging** — WebSocket-powered with acknowledgements
- 🖼️ **Image Upload** — Share images in chat
- 😊 **Emoji Picker** — Full emoji support
- ✍️ **Typing Indicators** — See who is typing
- 🔐 **JWT Authentication** — Secure token-based auth
- 🛡️ **Zod Validation** — Input validation on both client and server
- ⚡ **Rate Limiting** — Spam prevention
- 📱 **Responsive UI** — Works on desktop and mobile

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────┐
│                    Client                        │
│  React + Tailwind CSS + Zustand + Socket.io     │
│  Zod validation on all forms                    │
└──────────────────┬──────────────────────────────┘
                   │ WebSocket + REST API
┌──────────────────▼──────────────────────────────┐
│                    Server                        │
│  Express + Socket.io + better-sqlite3 + Zod     │
│  JWT Auth + Rate Limiting + Multer              │
├─────────────────────────────────────────────────┤
│  Database: SQLite (zero config, file-based)     │
│  Presence: In-memory (or Redis if available)    │
└─────────────────────────────────────────────────┘
```

**No Docker, No PostgreSQL, No Redis required** — Just Node.js!

For production horizontal scaling, set `USE_REDIS=true` in `.env` and provide Redis connection details. The Socket.io Redis adapter will automatically sync messages across instances.

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18+ 
- **npm** 9+

### 1. Clone & Setup Server

```bash
cd server
npm run setup
```

This single command will:
- Install all dependencies
- Create SQLite database
- Seed the global room

### 2. Start Server

```bash
cd server
npm run dev
```

Server runs on `http://localhost:3001`

### 3. Setup & Start Client

```bash
cd client
npm install
npm run dev
```

Client runs on `http://localhost:5173`

### 4. Open Browser

Go to `http://localhost:5173` — Register a user and start chatting!

## 📁 Project Structure

```
├── server/
│   ├── prisma/
│   │   └── dev.db                 # SQLite database file (auto-created)
│   ├── src/
│   │   ├── config/index.ts        # Environment config
│   │   ├── lib/
│   │   │   ├── database.ts        # better-sqlite3 DB layer + all queries
│   │   │   └── redis.ts           # Redis OR in-memory presence store
│   │   ├── middleware/auth.ts      # JWT auth middleware
│   │   ├── routes/
│   │   │   ├── auth.ts            # Register, login, search users
│   │   │   ├── rooms.ts           # CRUD rooms, messages, invites
│   │   │   └── upload.ts          # Image upload
│   │   ├── socket/gateway.ts      # Socket.io event handlers + presence
│   │   ├── validators/index.ts    # Zod schemas (server)
│   │   ├── seed.ts                # Database seeder
│   │   └── server.ts              # Express + Socket.io entry
│   └── .env                       # Environment variables
│
├── client/
│   ├── src/
│   │   ├── components/            # React UI components
│   │   │   ├── ChatLayout.tsx
│   │   │   ├── ChatWindow.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MembersPanel.tsx
│   │   │   └── modals/
│   │   │       ├── CreateRoomModal.tsx
│   │   │       ├── JoinRoomModal.tsx
│   │   │       ├── InviteModal.tsx
│   │   │       └── PendingInvitesModal.tsx
│   │   ├── hooks/useSocket.ts     # Socket.io hook
│   │   ├── lib/
│   │   │   ├── api.ts             # Axios API client
│   │   │   └── validators.ts      # Zod schemas (client)
│   │   ├── pages/
│   │   │   ├── LoginPage.tsx
│   │   │   └── RegisterPage.tsx
│   │   ├── store/index.ts         # Zustand global store
│   │   ├── types/index.ts         # TypeScript interfaces
│   │   └── App.tsx                # Router + auth guards
│   └── vite.config.ts
└── README.md
```

## 🔧 Environment Variables

### Server (`server/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | Server port |
| `DATABASE_URL` | `file:./dev.db` | SQLite database path |
| `USE_REDIS` | `false` | Enable Redis for horizontal scaling |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `JWT_SECRET` | (set in .env) | JWT signing secret |
| `CLIENT_URL` | `http://localhost:5173` | CORS origin |

## 🏭 Production Deployment

### Single Instance (No Redis)
1. Build: `cd server && npm run build && cd ../client && npm run build`
2. Serve the client build with the server or a reverse proxy
3. Set `NODE_ENV=production` and a strong `JWT_SECRET`

### Multi-Instance (With Redis)
1. Set `USE_REDIS=true` in `.env`
2. Provide `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`
3. Use sticky sessions in your load balancer (nginx, HAProxy)
4. The Socket.io Redis adapter handles cross-instance message pub/sub

### Sticky Sessions (Nginx)

```nginx
upstream chat_backend {
    ip_hash;  # sticky sessions
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
}

server {
    listen 80;
    location / {
        proxy_pass http://chat_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## 📈 Scaling This Project Bigger

This project is **designed to scale**. Here's a roadmap for growing it from a personal project to production with thousands of concurrent users:

### Phase 1: Current (Single Instance)
- **SQLite** — Zero config, handles up to ~50-100 concurrent writers well
- **In-memory presence** — Fast, but bound to one process
- **Good for**: Personal use, small teams, up to ~200 concurrent users

### Phase 2: Medium Scale (Multi-Instance with Redis)
Set `USE_REDIS=true` and configure Redis:
- **Redis Pub/Sub** — Socket.io Redis adapter syncs messages across Node.js instances
- **Redis presence** — Online users tracked via Redis Sets, shared across all instances
- **Load balancer** — Nginx/HAProxy with sticky sessions (ip_hash or cookie)
- **Good for**: Up to ~5,000-10,000 concurrent users on 2-4 instances

### Phase 3: Large Scale (Migrate to PostgreSQL + Redis Cluster)
- **Replace SQLite with PostgreSQL** — Better concurrent write handling, connection pooling (pg-pool)
- **Redis Cluster** — For high-availability presence and pub/sub
- **Message queue** — Bull/BullMQ for background tasks (email notifications, media processing)
- **CDN** — Serve uploaded images from S3/Cloudflare R2 instead of local disk
- **Good for**: Up to ~100,000 concurrent users

### Phase 4: Enterprise Scale
- **Microservices** — Split auth, messaging, presence, upload into separate services
- **Kafka/NATS** — Replace Redis pub/sub for ultra-high-throughput message streaming
- **Database sharding** — Shard messages by room for horizontal DB scaling
- **ElasticSearch** — Full-text message search
- **WebRTC** — Add voice/video calling
- **Rate limit by tier** — Different limits for free vs paid users
- **Good for**: 100K+ concurrent users

### What You'd Change (Code-wise)
| Component | Current | At Scale |
|-----------|---------|----------|
| Database | `better-sqlite3` (file) | PostgreSQL + pgBouncer |
| Presence | In-memory `Map/Set` | Redis Cluster |
| Pub/Sub | In-process | Redis / NATS / Kafka |
| File storage | Local `/uploads` | S3 / Cloudflare R2 + CDN |
| Auth | JWT stateless | JWT + Redis session store |
| Search | SQL `LIKE` | ElasticSearch |
| Deploy | Single process | Docker + Kubernetes |

The architecture is already modular — `database.ts`, `redis.ts`, and `gateway.ts` are clean abstractions that can be swapped out without touching business logic.
