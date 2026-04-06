import { create } from 'zustand';
import { User, Room, Message, TypingUser, RoomInvite } from '../types';
import { authApi, roomApi } from '../lib/api';

interface AppStore {
  // Auth
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  
  // Rooms
  rooms: Room[];
  activeRoom: Room | null;
  activeRoomId: string | null;
  publicRooms: Room[];

  // Messages
  messages: Record<string, Message[]>;
  hasMoreMessages: Record<string, boolean>;
  
  // Presence
  onlineUsers: Record<string, User[]>;
  typingUsers: TypingUser[];
  
  // Invites
  pendingInvites: RoomInvite[];
  
  // UI
  sidebarOpen: boolean;
  membersOpen: boolean;
  createRoomOpen: boolean;
  joinRoomOpen: boolean;
  inviteOpen: boolean;

  // Auth actions
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  checkAuth: () => Promise<void>;
  
  // Room actions
  setRooms: (rooms: Room[]) => void;
  addRoom: (room: Room) => void;
  removeRoom: (roomId: string) => void;
  updateRoom: (room: Room) => void;
  setActiveRoom: (roomId: string | null) => void;
  updateRoomMembers: (roomId: string, members: any[]) => void;
  fetchRooms: () => Promise<void>;
  fetchPublicRooms: () => Promise<void>;
  
  // Message actions
  setMessages: (roomId: string, messages: Message[], hasMore: boolean) => void;
  addMessage: (message: Message) => void;
  prependMessages: (roomId: string, messages: Message[], hasMore: boolean) => void;
  
  // Presence actions
  setOnlineUsers: (roomId: string, users: User[]) => void;
  addOnlineUser: (roomId: string, user: User) => void;
  removeOnlineUser: (roomId: string, userId: string) => void;
  addTypingUser: (typingUser: TypingUser) => void;
  removeTypingUser: (userId: string, roomId: string) => void;
  
  // Invite actions
  setPendingInvites: (invites: RoomInvite[]) => void;
  addInvite: (invite: RoomInvite) => void;
  removeInvite: (inviteId: string) => void;
  fetchInvites: () => Promise<void>;
  
  // UI actions
  toggleSidebar: () => void;
  toggleMembers: () => void;
  setCreateRoomOpen: (open: boolean) => void;
  setJoinRoomOpen: (open: boolean) => void;
  setInviteOpen: (open: boolean) => void;
}

export const useStore = create<AppStore>((set, get) => ({
  // Initial state
  user: null,
  token: localStorage.getItem('viberyan_token'),
  isAuthenticated: false,
  isLoading: true,
  rooms: [],
  activeRoom: null,
  activeRoomId: null,
  publicRooms: [],
  messages: {},
  hasMoreMessages: {},
  onlineUsers: {},
  typingUsers: [],
  pendingInvites: [],
  sidebarOpen: true,
  membersOpen: false,
  createRoomOpen: false,
  joinRoomOpen: false,
  inviteOpen: false,

  // Auth
  setAuth: (user, token) => {
    localStorage.setItem('viberyan_token', token);
    localStorage.setItem('viberyan_user', JSON.stringify(user));
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  logout: () => {
    localStorage.removeItem('viberyan_token');
    localStorage.removeItem('viberyan_user');
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      rooms: [],
      activeRoom: null,
      activeRoomId: null,
      messages: {},
      onlineUsers: {},
      typingUsers: [],
      pendingInvites: [],
    });
  },

  checkAuth: async () => {
    const token = localStorage.getItem('viberyan_token');
    if (!token) {
      set({ isLoading: false, isAuthenticated: false });
      return;
    }
    try {
      const { data } = await authApi.me();
      set({ user: data.user, token, isAuthenticated: true, isLoading: false });
    } catch {
      localStorage.removeItem('viberyan_token');
      localStorage.removeItem('viberyan_user');
      set({ isLoading: false, isAuthenticated: false, user: null, token: null });
    }
  },

  // Rooms
  setRooms: (rooms) => set({ rooms }),

  addRoom: (room) => {
    const exists = get().rooms.find((r) => r.id === room.id);
    if (!exists) {
      set({ rooms: [room, ...get().rooms] });
    }
  },

  removeRoom: (roomId) => {
    set({
      rooms: get().rooms.filter((r) => r.id !== roomId),
      ...(get().activeRoomId === roomId
        ? { activeRoom: null, activeRoomId: null }
        : {}),
    });
  },

  updateRoom: (room) => {
    const rooms = get().rooms.map((r) => r.id === room.id ? { ...r, ...room } : r);
    set({ rooms });
    // If this is the active room, update activeRoom too
    if (get().activeRoomId === room.id) {
      set({ activeRoom: rooms.find((r) => r.id === room.id) || null });
    }
  },

  setActiveRoom: (roomId) => {
    if (!roomId) {
      set({ activeRoom: null, activeRoomId: null });
      return;
    }
    const room = get().rooms.find((r) => r.id === roomId);
    set({ activeRoom: room || null, activeRoomId: roomId });
  },

  updateRoomMembers: (roomId, members) => {
    set({
      rooms: get().rooms.map((r) =>
        r.id === roomId ? { ...r, members, memberCount: members.length } : r
      ),
    });
    if (get().activeRoomId === roomId) {
      const room = get().rooms.find((r) => r.id === roomId);
      if (room) set({ activeRoom: room });
    }
  },

  fetchRooms: async () => {
    try {
      const { data } = await roomApi.getMyRooms();
      set({ rooms: data.rooms });
    } catch (err) {
      console.error('Failed to fetch rooms:', err);
    }
  },

  fetchPublicRooms: async () => {
    try {
      const { data } = await roomApi.browsePublic();
      set({ publicRooms: data.rooms });
    } catch (err) {
      console.error('Failed to fetch public rooms:', err);
    }
  },

  // Messages
  setMessages: (roomId, messages, hasMore) =>
    set({
      messages: { ...get().messages, [roomId]: messages },
      hasMoreMessages: { ...get().hasMoreMessages, [roomId]: hasMore },
    }),

  addMessage: (message) => {
    const roomMessages = get().messages[message.roomId] || [];
    set({
      messages: {
        ...get().messages,
        [message.roomId]: [...roomMessages, message],
      },
    });
  },

  prependMessages: (roomId, messages, hasMore) => {
    const existing = get().messages[roomId] || [];
    set({
      messages: { ...get().messages, [roomId]: [...messages, ...existing] },
      hasMoreMessages: { ...get().hasMoreMessages, [roomId]: hasMore },
    });
  },

  // Presence
  setOnlineUsers: (roomId, users) =>
    set({ onlineUsers: { ...get().onlineUsers, [roomId]: users } }),

  addOnlineUser: (roomId, user) => {
    const current = get().onlineUsers[roomId] || [];
    if (!current.find((u) => u.id === user.id)) {
      set({ onlineUsers: { ...get().onlineUsers, [roomId]: [...current, user] } });
    }
  },

  removeOnlineUser: (roomId, userId) => {
    const current = get().onlineUsers[roomId] || [];
    set({
      onlineUsers: {
        ...get().onlineUsers,
        [roomId]: current.filter((u) => u.id !== userId),
      },
    });
  },

  addTypingUser: (typingUser) => {
    const existing = get().typingUsers;
    if (!existing.find((t) => t.userId === typingUser.userId && t.roomId === typingUser.roomId)) {
      set({ typingUsers: [...existing, typingUser] });
    }
  },

  removeTypingUser: (userId, roomId) => {
    set({
      typingUsers: get().typingUsers.filter(
        (t) => !(t.userId === userId && t.roomId === roomId)
      ),
    });
  },

  // Invites
  setPendingInvites: (invites) => set({ pendingInvites: invites }),
  addInvite: (invite) => set({ pendingInvites: [invite, ...get().pendingInvites] }),
  removeInvite: (inviteId) =>
    set({ pendingInvites: get().pendingInvites.filter((i) => i.id !== inviteId) }),

  fetchInvites: async () => {
    try {
      const { data } = await roomApi.getPendingInvites();
      set({ pendingInvites: data.invites });
    } catch (err) {
      console.error('Failed to fetch invites:', err);
    }
  },

  // UI
  toggleSidebar: () => set({ sidebarOpen: !get().sidebarOpen }),
  toggleMembers: () => set({ membersOpen: !get().membersOpen }),
  setCreateRoomOpen: (open) => set({ createRoomOpen: open }),
  setJoinRoomOpen: (open) => set({ joinRoomOpen: open }),
  setInviteOpen: (open) => set({ inviteOpen: open }),
}));
