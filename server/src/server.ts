import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { config } from './config';
import { initializeSocket } from './socket/gateway';
import authRoutes from './routes/auth';
import roomRoutes from './routes/rooms';
import uploadRoutes from './routes/upload';

const app = express();
const httpServer = createServer(app);

// Middleware
app.use(cors({
  origin: config.cors.clientUrl,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());

// Rate limiting
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Too many requests, please try again later' },
  standardHeaders: true,
  legacyHeaders: false,
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20,
  message: { error: 'Too many auth attempts, please try again later' },
});

app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/register', authLimiter);

// Static files (uploads)
app.use('/uploads', express.static(path.resolve(config.upload.dir)));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/upload', uploadRoutes);

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize Socket.io and start server
async function start() {
  const io = await initializeSocket(httpServer);

  httpServer.listen(config.port, () => {
    console.log(`🚀 VibeRyan Chat Server running on port ${config.port}`);
    console.log(`📡 WebSocket ready`);
    console.log(`🌍 CORS origin: ${config.cors.clientUrl}`);
    console.log(`💾 Database: SQLite (file-based, zero config)`);
  });
}

start().catch((err) => {
  console.error('❌ Failed to start server:', err);
  process.exit(1);
});

export { app, httpServer };
