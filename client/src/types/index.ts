export interface User {
  id: string;
  username: string;
  avatarUrl: string | null;
  isOnline: boolean;
  lastSeen?: string;
  createdAt: string;
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  isGlobal: boolean;
  isPrivate: boolean;
  avatarUrl: string | null;
  ownerId: string;
  owner: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  members: RoomMemberInfo[];
  myRole?: string;
  memberCount: number;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  _count?: { members: number; messages: number };
}

export interface RoomMemberInfo {
  user: Pick<User, 'id' | 'username' | 'avatarUrl' | 'isOnline'>;
  role: 'OWNER' | 'ADMIN' | 'MEMBER';
}

export interface Message {
  id: string;
  content: string | null;
  type: 'TEXT' | 'IMAGE' | 'SYSTEM' | 'EMOJI';
  imageUrl: string | null;
  userId: string;
  roomId: string;
  user: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  createdAt: string;
  updatedAt: string;
}

export interface RoomInvite {
  id: string;
  roomId: string;
  room: Pick<Room, 'id' | 'name' | 'description'>;
  sender: Pick<User, 'id' | 'username' | 'avatarUrl'>;
  status: 'PENDING' | 'ACCEPTED' | 'DECLINED';
  createdAt: string;
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface TypingUser {
  userId: string;
  username: string;
  roomId: string;
}
