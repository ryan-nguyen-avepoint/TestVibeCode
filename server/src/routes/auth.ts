import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { userDb, memberDb, roomDb, messageDb } from '../lib/database';
import { registerSchema, loginSchema } from '../validators';
import { AuthRequest, authMiddleware, generateToken } from '../middleware/auth';

const router = Router();

// Register
router.post('/register', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { username, password } = parsed.data;

    const existing = userDb.findByUsername.get(username);
    if (existing) {
      res.status(409).json({ error: 'Username already taken' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = userDb.create({ username, password: hashedPassword });

    const token = generateToken(user.id, user.username);

    // Auto-join global room
    const globalRoom = roomDb.findGlobal();
    if (globalRoom) {
      try {
        memberDb.create(user.id, globalRoom.id, 'MEMBER');

        // System message announcing the new user
        const sysMessage = messageDb.create({
          content: `${user.username} joined VibeRyan! Welcome! 🎉`,
          type: 'SYSTEM',
          userId: user.id,
          roomId: globalRoom.id,
        });

        // Broadcast to global room via socket
        const { getIO } = await import('../socket/gateway');
        const io = getIO();
        if (io) {
          io.to(globalRoom.id).emit('message:new', sysMessage);
          io.to(globalRoom.id).emit('room:user-joined', {
            roomId: globalRoom.id,
            user: { id: user.id, username: user.username, isOnline: true, avatarUrl: null },
          });
          const updatedRoom = roomDb.findByIdFull(globalRoom.id);
          if (updatedRoom) {
            io.to(globalRoom.id).emit('room:updated', updatedRoom);
          }
        }
      } catch { /* already member */ }
    }

    res.status(201).json({ user, token });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { username, password } = parsed.data;

    const user = userDb.findByUsername.get(username) as any;
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      res.status(401).json({ error: 'Invalid credentials' });
      return;
    }

    const token = generateToken(user.id, user.username);

    // Auto-join global room if not already a member
    const globalRoom = roomDb.findGlobal();
    if (globalRoom) {
      const isMember = memberDb.find(user.id, globalRoom.id);
      if (!isMember) {
        try {
          memberDb.create(user.id, globalRoom.id, 'MEMBER');
        } catch { /* ignore if already member */ }
      }
    }

    res.json({
      user: {
        id: user.id,
        username: user.username,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get current user
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = userDb.findByIdSelect(req.user!.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Search users
router.get('/users/search', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;
    if (!query || query.length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters' });
      return;
    }

    const users = userDb.search(query, req.user!.id);
    res.json({ users });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
