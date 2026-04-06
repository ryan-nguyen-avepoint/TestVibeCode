import { z } from 'zod';

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be at most 100 characters'),
});

export const loginSchema = z.object({
  username: z.string().min(1, 'Username is required'),
  password: z.string().min(1, 'Password is required'),
});

export const createRoomSchema = z.object({
  name: z
    .string()
    .min(2, 'Room name must be at least 2 characters')
    .max(50, 'Room name must be at most 50 characters'),
  description: z.string().max(200).optional(),
  isPrivate: z.boolean().optional().default(false),
});

export const sendMessageSchema = z.object({
  content: z.string().max(2000).optional(),
  roomId: z.string().min(1, 'Room ID is required'),
  type: z.enum(['TEXT', 'IMAGE', 'EMOJI']).optional().default('TEXT'),
  imageUrl: z.string().optional(),
});

export const joinRoomSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
});

export const inviteUserSchema = z.object({
  roomId: z.string().min(1, 'Room ID is required'),
  username: z.string().min(1, 'Username is required'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
export type InviteUserInput = z.infer<typeof inviteUserSchema>;
