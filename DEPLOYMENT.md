# 🚀 VibeRyan — Production Deployment Guide

This guide walks you through deploying VibeRyan (backend + frontend) to production using **free hosting platforms**.

---

## 📋 Architecture Overview

| Component | Tech | Deployed To |
|-----------|------|-------------|
| **Backend** | Node.js + Express + Socket.io + SQLite | Render.com (free) |
| **Frontend** | React + Vite + Tailwind | Vercel or Netlify (free) |

---

## ⚙️ Pre-Deployment Checklist

1. Push your code to a **GitHub** repository
2. Make sure both `server/` and `client/` folders are at the repo root
3. Set up environment variables (see below)

---

## 🖥️ Backend Deployment (Render.com)

[Render](https://render.com) offers **free web services** with persistent disk storage — perfect for SQLite.

### Step 1: Create a Render account
Go to [https://render.com](https://render.com) and sign up with GitHub.

### Step 2: Create a new Web Service
1. Click **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Name** | `viberyan-api` |
| **Region** | Pick closest to your users |
| **Root Directory** | `server` |
| **Runtime** | `Node` |
| **Build Command** | `npm install` |
| **Start Command** | `npx tsx src/server.ts` |
| **Instance Type** | Free |

### Step 3: Add Environment Variables
In the Render dashboard → **Environment** tab:

| Key | Value |
|-----|-------|
| `PORT` | `3001` |
| `JWT_SECRET` | `your-super-secret-random-string-here` |
| `CORS_ORIGIN` | `https://your-frontend-domain.vercel.app` |
| `NODE_ENV` | `production` |

> 💡 Generate a strong JWT_SECRET: run `node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"` in your terminal.

### Step 4: Add a Persistent Disk (for SQLite)
1. In your web service settings, go to **Disks**
2. Add a disk:
   - **Name**: `sqlite-data`
   - **Mount Path**: `/opt/render/project/src/prisma`
   - **Size**: `1 GB` (free tier)

This ensures your SQLite database (`dev.db`) persists across deploys.

### Step 5: Update server for production
Make sure your `server/src/server.ts` reads the `PORT` from environment:
```typescript
const PORT = process.env.PORT || 3001;
```

Your server should already handle CORS via `process.env.CORS_ORIGIN`.

### Step 6: Deploy
Click **Manual Deploy** → **Deploy latest commit**. Render will automatically redeploy on every push to `main`.

---

## 🌐 Frontend Deployment

### Option A: Vercel (Recommended)

[Vercel](https://vercel.com) is the easiest option for React/Vite apps.

#### Step 1: Create a Vercel account
Go to [https://vercel.com](https://vercel.com) and sign up with GitHub.

#### Step 2: Import your project
1. Click **Add New** → **Project**
2. Import your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Root Directory** | `client` |
| **Framework Preset** | `Vite` |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

#### Step 3: Add Environment Variables

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://viberyan-api.onrender.com` |
| `VITE_WS_URL` | `https://viberyan-api.onrender.com` |

> ⚠️ Replace `viberyan-api.onrender.com` with your actual Render backend URL.

#### Step 4: Update client API configuration
Make sure `client/src/lib/api.ts` uses the environment variable:
```typescript
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';
```

And `client/src/hooks/useSocket.ts` uses:
```typescript
const WS_URL = import.meta.env.VITE_WS_URL || 'http://localhost:3001';
```

#### Step 5: Deploy
Click **Deploy**. Vercel auto-deploys on every push.

#### Step 6: Add Vercel Rewrites (for SPA routing)
Create `client/vercel.json`:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

---

### Option B: Netlify

#### Step 1: Create a Netlify account
Go to [https://netlify.com](https://netlify.com) and sign up with GitHub.

#### Step 2: Create a new site
1. Click **Add new site** → **Import an existing project**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| **Base directory** | `client` |
| **Build command** | `npm run build` |
| **Publish directory** | `client/dist` |

#### Step 3: Add Environment Variables
Same as Vercel:
- `VITE_API_URL` = `https://viberyan-api.onrender.com`
- `VITE_WS_URL` = `https://viberyan-api.onrender.com`

#### Step 4: Add redirect rules
Create `client/public/_redirects`:
```
/*    /index.html   200
```

This ensures SPA routing works correctly.

---

## 🔧 Post-Deployment Configuration

### 1. Update CORS on Backend
After deploying the frontend, update the `CORS_ORIGIN` env var on Render to match your frontend URL:
```
CORS_ORIGIN=https://your-app.vercel.app
```

### 2. Update WebSocket transport
If WebSocket connections fail behind some proxies, make sure Socket.io falls back to polling. In `useSocket.ts`:
```typescript
const socket = io(WS_URL, {
  auth: { token },
  transports: ['websocket', 'polling'], // fallback to polling
});
```

### 3. Test Everything
- ✅ Login/Register works
- ✅ Real-time messages are sent and received
- ✅ Image uploads work
- ✅ Room creation, joining, and leaving work
- ✅ Dark/Light theme toggle works
- ✅ Mobile responsive layout works

---

## 🆓 Free Tier Limitations

### Render (Free Tier)
- **Spin down after 15 min of inactivity** — first request after sleep takes ~30s
- 750 hours/month free
- 512 MB RAM, 0.1 CPU
- To keep it awake, use a cron service like [UptimeRobot](https://uptimerobot.com) to ping your backend every 14 minutes

### Vercel (Free Tier)
- Unlimited deployments
- 100 GB bandwidth/month
- Custom domains supported
- No sleep issues — static hosting

### Netlify (Free Tier)
- 100 GB bandwidth/month
- 300 build minutes/month
- Custom domains supported

---

## 🔄 Alternative Platforms

| Platform | Best For | Free Tier |
|----------|----------|-----------|
| [Railway](https://railway.app) | Backend + DB | $5 free credit/month |
| [Fly.io](https://fly.io) | Backend (Docker) | 3 shared VMs free |
| [Cloudflare Pages](https://pages.cloudflare.com) | Frontend | Unlimited bandwidth |
| [Supabase](https://supabase.com) | If migrating to PostgreSQL | 500 MB DB free |

---

## 📁 Production File Structure

```
your-repo/
├── server/                  → Deploy to Render
│   ├── src/
│   │   ├── server.ts
│   │   ├── lib/database.ts
│   │   ├── routes/
│   │   ├── socket/
│   │   └── middleware/
│   ├── prisma/
│   │   └── dev.db          → SQLite database (on persistent disk)
│   ├── uploads/            → Image uploads
│   └── package.json
├── client/                  → Deploy to Vercel/Netlify
│   ├── src/
│   ├── dist/               → Built output
│   ├── vercel.json         → SPA routing (Vercel)
│   └── package.json
└── DEPLOYMENT.md
```

---

## 🎯 Quick Deploy Commands

```bash
# Generate a JWT secret
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Test production build locally
cd client && npm run build && npx serve dist

# Test backend locally with production env
cd server && NODE_ENV=production JWT_SECRET=test123 npx tsx src/server.ts
```

---

## ❓ Troubleshooting

| Issue | Fix |
|-------|-----|
| WebSocket not connecting | Check CORS_ORIGIN matches frontend URL exactly (no trailing slash) |
| SQLite errors on Render | Make sure persistent disk is mounted at the correct path |
| 404 on page refresh | Add SPA rewrites (vercel.json or _redirects) |
| Slow first load | Render free tier sleeps after 15 min — use UptimeRobot |
| Images not loading | Ensure `uploads/` folder exists and is writable |
| CORS errors | Backend CORS_ORIGIN must match the deployed frontend domain |

---

Happy deploying! 🚀
