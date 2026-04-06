import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useStore } from '../store';
import { Message, User } from '../types';
import toast from 'react-hot-toast';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'http://localhost:3001';

export function useSocket() {
  const socketRef = useRef<Socket | null>(null);
  const {
    token,
    isAuthenticated,
    user,
    activeRoomId,
    addMessage,
    setOnlineUsers,
    addOnlineUser,
    removeOnlineUser,
    addTypingUser,
    removeTypingUser,
    addRoom,
    updateRoom,
    fetchRooms,
    addInvite,
    removeRoom,
    setActiveRoom,
  } = useStore();

  // Connect socket
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 20000,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('🔌 Socket connected:', socket.id);
      // Re-fetch rooms to rejoin socket rooms
      fetchRooms();
    });

    socket.on('disconnect', (reason) => {
      console.log('💔 Socket disconnected:', reason);
      if (reason === 'io server disconnect') {
        socket.connect();
      }
    });

    socket.on('connect_error', (error) => {
      console.error('❌ Socket connection error:', error.message);
      if (error.message.includes('Authentication')) {
        toast.error('Session expired. Please log in again.');
      }
    });

    // Message events
    socket.on('message:new', (message: Message) => {
      addMessage(message);
      
      // Play notification sound for messages from others
      if (message.userId !== user?.id && message.type !== 'SYSTEM') {
        playNotificationSound();
      }
    });

    // Presence events
    socket.on('user:online', (data: { userId: string; username: string; roomId?: string }) => {
      if (data.roomId) {
        addOnlineUser(data.roomId, {
          id: data.userId,
          username: data.username,
          avatarUrl: null,
          isOnline: true,
          createdAt: '',
        });
      }
    });

    socket.on('user:offline', (data: { userId: string; username: string; roomId?: string }) => {
      if (data.roomId) {
        removeOnlineUser(data.roomId, data.userId);
      }
    });

    socket.on('room:online-users', (data: { roomId: string; users: User[] }) => {
      setOnlineUsers(data.roomId, data.users);
    });

    // Typing events
    socket.on('user:typing', (data: { userId: string; username: string; roomId: string }) => {
      if (data.userId !== user?.id) {
        addTypingUser(data);
      }
    });

    socket.on('user:stop-typing', (data: { userId: string; username: string; roomId: string }) => {
      removeTypingUser(data.userId, data.roomId);
    });

    // Room events
    socket.on('room:created', (room: any) => {
      addRoom(room);
    });

    socket.on('room:user-joined', (data: { roomId: string; user: any }) => {
      if (data.roomId) {
        addOnlineUser(data.roomId, data.user);
      }
    });

    socket.on('room:updated', (room: any) => {
      updateRoom(room);
    });

    socket.on('room:user-left', (data: { roomId: string; user: any }) => {
      if (data.roomId) {
        removeOnlineUser(data.roomId, data.user.id);
      }
    });

    // Invite events
    socket.on('invite:received', (invite: any) => {
      addInvite(invite);
      toast(`📬 ${invite.sender.username} invited you to ${invite.room.name}`, {
        duration: 5000,
      });
    });

    // Room deleted event (owner deleted the room)
    socket.on('room:deleted', (data: { roomId: string; roomName: string }) => {
      removeRoom(data.roomId);
      // If user was viewing the deleted room, switch away
      const state = useStore.getState();
      if (state.activeRoomId === data.roomId) {
        setActiveRoom(null);
      }
      toast(`🗑️ Room "${data.roomName}" has been deleted by the owner`, { duration: 4000 });
    });

    return () => {
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated, token]);

  // Join/leave socket rooms when active room changes
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket?.connected || !activeRoomId) return;

    socket.emit('room:join', { roomId: activeRoomId }, (res: any) => {
      if (!res?.success) {
        console.error('Failed to join socket room:', res?.error);
      }
    });

    // Request online users
    socket.emit('room:get-online', { roomId: activeRoomId });

    return () => {
      if (socket?.connected && activeRoomId) {
        socket.emit('room:leave', { roomId: activeRoomId });
      }
    };
  }, [activeRoomId]);

  // Send message via socket
  const sendMessage = useCallback(
    (roomId: string, content: string, type: 'TEXT' | 'IMAGE' | 'EMOJI' = 'TEXT', imageUrl?: string) => {
      return new Promise<any>((resolve, reject) => {
        const socket = socketRef.current;
        if (!socket?.connected) {
          reject(new Error('Socket not connected'));
          return;
        }

        socket.emit(
          'message:send',
          { roomId, content, type, imageUrl },
          (res: any) => {
            if (res?.success) {
              resolve(res.message);
            } else {
              reject(new Error(res?.error || 'Failed to send message'));
            }
          }
        );
      });
    },
    []
  );

  // Typing indicators
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startTyping = useCallback((roomId: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    socket.emit('typing:start', { roomId });

    // Auto-stop after 3 seconds
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket.emit('typing:stop', { roomId });
    }, 3000);
  }, []);

  const stopTyping = useCallback((roomId: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    socket.emit('typing:stop', { roomId });
  }, []);

  // Join socket room (after REST join)
  const joinSocketRoom = useCallback((roomId: string) => {
    const socket = socketRef.current;
    if (!socket?.connected) return;

    socket.emit('room:join', { roomId }, (res: any) => {
      if (!res?.success) {
        console.error('Failed to join socket room:', res?.error);
      }
    });
  }, []);

  return {
    socket: socketRef.current,
    isConnected: socketRef.current?.connected ?? false,
    sendMessage,
    startTyping,
    stopTyping,
    joinSocketRoom,
  };
}

// Simple notification sound
function playNotificationSound() {
  try {
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.value = 0.1;
    oscillator.start();
    gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    oscillator.stop(audioCtx.currentTime + 0.2);
  } catch {
    // Audio not supported, ignore
  }
}
