import { useMemo, useState } from 'react';
import {
  MessageCircle, Plus, Hash, Lock, Globe, LogOut, Search,
  ChevronDown, ChevronRight, Bell, Settings, UserCircle, Zap, Sun, Moon, X
} from 'lucide-react';
import { useStore } from '../store';
import { useThemeStore } from '../store/theme';
import { Room } from '../types';
import toast from 'react-hot-toast';

interface SidebarProps {
  onOpenInvites: () => void;
  onMobileClose?: () => void;
}

export default function Sidebar({ onOpenInvites, onMobileClose }: SidebarProps) {
  const {
    user, rooms, activeRoomId, pendingInvites,
    setActiveRoom, setCreateRoomOpen, setJoinRoomOpen,
    logout, toggleSidebar,
  } = useStore();
  const { theme, toggleTheme } = useThemeStore();

  const [roomsCollapsed, setRoomsCollapsed] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const globalRoom = useMemo(() => rooms.find((r) => r.isGlobal), [rooms]);
  const privateRooms = useMemo(() => rooms.filter((r) => !r.isGlobal), [rooms]);

  const filteredRooms = useMemo(() => {
    if (!searchQuery.trim()) return privateRooms;
    const q = searchQuery.toLowerCase().trim();
    return privateRooms.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q)
    );
  }, [privateRooms, searchQuery]);

  // Also filter global room
  const showGlobalRoom = useMemo(() => {
    if (!globalRoom) return false;
    if (!searchQuery.trim()) return true;
    return globalRoom.name.toLowerCase().includes(searchQuery.toLowerCase().trim());
  }, [globalRoom, searchQuery]);

  const handleLogout = () => {
    logout();
    toast.success('Logged out successfully');
  };

  const getInitial = (name: string) => name.charAt(0).toUpperCase();

  const getRoomIcon = (room: Room) => {
    if (room.isGlobal) return <Globe className="w-4 h-4 text-emerald-400" />;
    if (room.isPrivate) return <Lock className="w-4 h-4 text-amber-400" />;
    return <Hash className="w-4 h-4 t-text-m" />;
  };

  const handleSelectRoom = (roomId: string) => {
    setActiveRoom(roomId);
    onMobileClose?.();
  };

  return (
    <div className="h-full w-80 t-bg-s backdrop-blur-xl border-r t-border-s flex flex-col">
      {/* Header */}
      <div className="p-4 border-b t-border-s">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary-500 to-purple-600 flex items-center justify-center shadow-lg shadow-primary-500/20">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold t-text leading-tight">
                Vibe<span className="text-primary-400">Ryan</span>
              </h1>
              <p className="text-[10px] t-text-f uppercase tracking-wider font-medium">Real-time Chat</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={toggleTheme}
              className="btn-ghost p-2"
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
            {pendingInvites.length > 0 && (
              <button
                onClick={onOpenInvites}
                className="relative btn-ghost p-2"
                title="Pending invites"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white font-bold flex items-center justify-center">
                  {pendingInvites.length}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* User Info */}
        <div className="flex items-center gap-3 p-2.5 rounded-xl t-bg-e border t-border-s">
          <div className="relative">
            <div className="avatar w-9 h-9 text-xs">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                getInitial(user?.username || '?')
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 online-dot w-2 h-2" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium t-text truncate">{user?.username}</p>
            <p className="text-[11px] text-emerald-400 flex items-center gap-1">
              <Zap className="w-3 h-3" />
              Online
            </p>
          </div>
        </div>
      </div>

      {/* Room Actions */}
      <div className="px-3 pt-3 pb-1 flex gap-2">
        <button
          onClick={() => setCreateRoomOpen(true)}
          className="flex-1 btn-primary text-xs py-2 flex items-center justify-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" />
          Create Room
        </button>
        <button
          onClick={() => setJoinRoomOpen(true)}
          className="flex-1 btn-secondary text-xs py-2 flex items-center justify-center gap-1.5"
        >
          <Search className="w-3.5 h-3.5" />
          Join Room
        </button>
      </div>

      {/* Search Rooms */}
      <div className="px-3 pt-2 pb-1">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 t-text-f" />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field text-xs py-2 pl-9 pr-8"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 t-text-f hover:t-text-t transition-colors p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Rooms List */}
      <div className="flex-1 overflow-y-auto px-3 pt-2 pb-3 space-y-1">
        {/* Global Room */}
        {showGlobalRoom && globalRoom && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold t-text-f uppercase tracking-wider px-2 mb-1.5">
              Global
            </p>
            <button
              onClick={() => handleSelectRoom(globalRoom.id)}
              className={`w-full sidebar-item ${activeRoomId === globalRoom.id ? 'sidebar-item-active' : ''}`}
            >
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center flex-shrink-0">
                <Globe className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-sm font-medium truncate t-text">{globalRoom.name}</p>
                <p className="text-[11px] t-text-f">{globalRoom.memberCount} members</p>
              </div>
            </button>
          </div>
        )}

        {/* Private/Public Rooms */}
        {privateRooms.length > 0 && (
          <div>
            <button
              onClick={() => setRoomsCollapsed(!roomsCollapsed)}
              className="w-full text-[10px] font-semibold t-text-f uppercase tracking-wider px-2 mb-1.5 flex items-center justify-between hover:t-text-t transition-colors cursor-pointer"
            >
              <span>
                Rooms ({searchQuery ? `${filteredRooms.length}/${privateRooms.length}` : privateRooms.length})
              </span>
              {roomsCollapsed ? (
                <ChevronRight className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {!roomsCollapsed && (
              <>
                {filteredRooms.length > 0 ? (
                  filteredRooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => handleSelectRoom(room.id)}
                      className={`w-full sidebar-item mb-0.5 ${activeRoomId === room.id ? 'sidebar-item-active' : ''}`}
                    >
                      <div className="w-8 h-8 rounded-lg t-bg-t flex items-center justify-center flex-shrink-0 border t-border">
                        {getRoomIcon(room)}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className="text-sm font-medium truncate t-text">{room.name}</p>
                        <p className="text-[11px] t-text-f">
                          {room.memberCount} member{room.memberCount !== 1 ? 's' : ''}
                          {room.myRole === 'OWNER' && (
                            <span className="ml-1 text-primary-400">• Owner</span>
                          )}
                        </p>
                      </div>
                    </button>
                  ))
                ) : searchQuery ? (
                  <div className="text-center py-4 px-2">
                    <p className="t-text-f text-xs">No rooms match "{searchQuery}"</p>
                  </div>
                ) : null}
              </>
            )}
          </div>
        )}

        {privateRooms.length === 0 && !searchQuery && (
          <div className="text-center py-8 px-4">
            <div className="w-12 h-12 rounded-2xl t-bg-e flex items-center justify-center mx-auto mb-3">
              <Hash className="w-6 h-6 t-text-g" />
            </div>
            <p className="t-text-m text-sm font-medium">No rooms yet</p>
            <p className="t-text-f text-xs mt-1">Create or join a room to start chatting</p>
          </div>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="p-3 border-t t-border-s">
        <button
          onClick={handleLogout}
          className="w-full btn-ghost text-xs flex items-center justify-center gap-2 t-text-m hover:text-red-400 py-2.5"
        >
          <LogOut className="w-4 h-4" />
          Sign Out
        </button>
      </div>
    </div>
  );
}
