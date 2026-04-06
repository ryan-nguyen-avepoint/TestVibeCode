import { Router, Response } from 'express';
import { roomDb, memberDb, messageDb, inviteDb, userDb } from '../lib/database';
import { createRoomSchema } from '../validators';
import { AuthRequest, authMiddleware } from '../middleware/auth';

const router = Router();

// ==========================================
// STATIC ROUTES MUST COME BEFORE :roomId
// ==========================================

// Browse public rooms
router.get('/browse/public', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rooms = roomDb.findPublicNotMember(req.user!.id);
    res.json({ rooms });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get pending invites for current user
router.get('/invites/pending', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const invites = inviteDb.findPendingForUser(req.user!.id);
    res.json({ invites });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Decline an invite
router.delete('/invites/:inviteId', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const inviteId = req.params.inviteId as string;
    const invite = inviteDb.findById(inviteId);
    if (!invite) {
      res.status(404).json({ error: 'Invite not found' });
      return;
    }
    if (invite.receiver_id !== req.user!.id) {
      res.status(403).json({ error: 'Not your invite' });
      return;
    }
    inviteDb.decline(inviteId);
    res.json({ message: 'Invite declined' });
  } catch (error) {
    console.error('Decline invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all rooms the user is a member of
router.get('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const rooms = memberDb.findUserRooms(req.user!.id);
    res.json({ rooms });
  } catch (error) {
    console.error('Get rooms error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create room
router.post('/', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const parsed = createRoomSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.errors[0].message });
      return;
    }

    const { name, description, isPrivate } = parsed.data;

    const room = roomDb.create({ name, description, isPrivate, ownerId: req.user!.id });
    if (!room) {
      res.status(500).json({ error: 'Failed to create room' });
      return;
    }
    memberDb.create(req.user!.id, (room as any).id, 'OWNER');

    // Re-fetch after member was added so members list is populated
    const fullRoom = roomDb.findByIdFull((room as any).id);
    res.status(201).json({ room: { ...fullRoom, myRole: 'OWNER' } });
  } catch (error) {
    console.error('Create room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Join room by ID
router.post('/:roomId/join', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;

    const room = roomDb.findById(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    // Always clean up any pending invite for this user+room (handles dirty data)
    const pendingInvite = inviteDb.findPending(roomId, req.user!.id);
    if (pendingInvite) {
      inviteDb.accept(pendingInvite.id);
    }

    const existingMember = memberDb.find(req.user!.id, roomId);
    if (existingMember) {
      // Even though already a member, invite was cleaned above — return success-ish
      res.status(409).json({ error: 'Already a member of this room' });
      return;
    }

    if (room.is_private && !pendingInvite) {
      res.status(403).json({ error: 'This is a private room. You need an invitation to join.' });
      return;
    }

    memberDb.create(req.user!.id, roomId, 'MEMBER');

    // System message
    const sysMessage = messageDb.create({
      content: `${req.user!.username} joined the room`,
      type: 'SYSTEM',
      userId: req.user!.id,
      roomId,
    });

    // Emit real-time events to room members
    const { getIO } = await import('../socket/gateway');
    const io = getIO();
    if (io) {
      // Broadcast system message to room
      io.to(roomId).emit('message:new', sysMessage);
      // Notify existing members about the new user
      io.to(roomId).emit('room:user-joined', {
        roomId,
        user: { id: req.user!.id, username: req.user!.username, isOnline: true, avatarUrl: null },
      });
      // Also emit room:updated so clients can refetch member lists
      const updatedRoom = roomDb.findByIdFull(roomId);
      if (updatedRoom) {
        io.to(roomId).emit('room:updated', updatedRoom);
      }
    }

    const fullRoom = roomDb.findByIdFull(roomId);
    res.json({ room: { ...fullRoom, myRole: 'MEMBER' } });
  } catch (error) {
    console.error('Join room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Leave room
router.post('/:roomId/leave', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;

    const room = roomDb.findById(roomId);
    if (!room) {
      res.status(404).json({ error: 'Room not found' });
      return;
    }

    if (room.is_global) {
      res.status(403).json({ error: 'Cannot leave the global room' });
      return;
    }

    memberDb.delete(req.user!.id, roomId);

    // Check if room is now empty — auto-delete if no members left
    const remainingMembers = memberDb.countByRoom(roomId);
    if (remainingMembers === 0) {
      roomDb.delete(roomId);
      console.log(`🗑️ Room "${room.name}" (${roomId}) auto-deleted — no members remaining`);
      res.json({ message: 'Left room successfully (room deleted — no members remaining)' });
      return;
    }

    messageDb.create({
      content: `${req.user!.username} left the room`,
      type: 'SYSTEM',
      userId: req.user!.id,
      roomId,
    });

    res.json({ message: 'Left room successfully' });
  } catch (error) {
    console.error('Leave room error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Invite user to room (owner/admin only)
router.post('/:roomId/invite', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: 'Username is required' });
      return;
    }

    const membership = memberDb.find(req.user!.id, roomId);
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      res.status(403).json({ error: 'Only room owners and admins can invite users' });
      return;
    }

    const targetUser = userDb.findByUsername.get(username) as any;
    if (!targetUser) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existingMember = memberDb.find(targetUser.id, roomId);
    if (existingMember) {
      res.status(409).json({ error: 'User is already a member' });
      return;
    }

    const invite = inviteDb.create({ roomId, senderId: req.user!.id, receiverId: targetUser.id });

    // Emit invite to receiver via socket
    const { getIO, getAllUserSocketIds } = await import('../socket/gateway');
    const io = getIO();
    if (io) {
      const room = roomDb.findById(roomId);
      const receiverSocketIds = getAllUserSocketIds(targetUser.id);
      const invitePayload = {
        id: invite.id,
        roomId,
        room: room ? { id: room.id, name: room.name, description: room.description } : null,
        sender: { id: req.user!.id, username: req.user!.username, avatarUrl: null },
        status: 'PENDING',
        createdAt: new Date().toISOString(),
      };
      for (const socketId of receiverSocketIds) {
        io.to(socketId).emit('invite:received', invitePayload);
      }
    }

    res.json({ invite });
  } catch (error) {
    console.error('Invite error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get room messages (paginated)
router.get('/:roomId/messages', authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const roomId = req.params.roomId as string;
    const cursor = req.query.cursor as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    const membership = memberDb.find(req.user!.id, roomId);
    if (!membership) {
      res.status(403).json({ error: 'Not a member of this room' });
      return;
    }

    const result = messageDb.findByRoom(roomId, limit, cursor);
    res.json(result);
  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
