import { useState } from 'react';
import { X, Search, Loader2, DoorOpen, Globe, Users } from 'lucide-react';
import { useStore } from '../../store';
import { roomApi } from '../../lib/api';
import { joinRoomSchema, type JoinRoomInput } from '../../lib/validators';
import toast from 'react-hot-toast';
import { Room } from '../../types';

interface Props {
  socket: {
    joinSocketRoom: (roomId: string) => void;
  };
}

export default function JoinRoomModal({ socket }: Props) {
  const { joinRoomOpen, setJoinRoomOpen, addRoom, setActiveRoom, fetchPublicRooms, publicRooms } = useStore();
  const [roomId, setRoomId] = useState('');
  const [errors, setErrors] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'id' | 'browse'>('id');
  const [browsed, setBrowsed] = useState(false);

  if (!joinRoomOpen) return null;

  const handleJoinById = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = joinRoomSchema.safeParse({ roomId: roomId.trim() });
    if (!result.success) {
      setErrors(result.error.errors[0].message);
      return;
    }
    setErrors('');

    setLoading(true);
    try {
      const { data } = await roomApi.joinRoom(roomId.trim());
      addRoom(data.room);
      setActiveRoom(data.room.id);
      socket.joinSocketRoom(data.room.id);
      toast.success(`Joined "${data.room.name}"! 🎉`);
      handleClose();
    } catch (err: any) {
      const msg = err.response?.data?.error || 'Failed to join room';
      toast.error(msg);
      setErrors(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleJoinPublic = async (room: Room) => {
    setLoading(true);
    try {
      const { data } = await roomApi.joinRoom(room.id);
      addRoom(data.room);
      setActiveRoom(data.room.id);
      socket.joinSocketRoom(data.room.id);
      toast.success(`Joined "${room.name}"! 🎉`);
      handleClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to join room');
    } finally {
      setLoading(false);
    }
  };

  const handleBrowse = () => {
    setTab('browse');
    if (!browsed) {
      fetchPublicRooms();
      setBrowsed(true);
    }
  };

  const handleClose = () => {
    setJoinRoomOpen(false);
    setRoomId('');
    setErrors('');
    setTab('id');
    setBrowsed(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative glass-card p-6 w-full max-w-md animate-bounce-in">
        <button onClick={handleClose} className="absolute top-4 right-4 btn-ghost p-1.5">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20">
            <DoorOpen className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold t-text">Join a Room</h2>
            <p className="text-xs t-text-m">Enter a Room ID or browse public rooms</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 p-1 t-bg-e rounded-xl">
          <button
            onClick={() => setTab('id')}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === 'id'
                ? 'bg-primary-600 text-white shadow-lg'
                : 't-text-m hover:t-text-s'
            }`}
          >
            <Search className="w-3.5 h-3.5 inline mr-1.5" />
            By Room ID
          </button>
          <button
            onClick={handleBrowse}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
              tab === 'browse'
                ? 'bg-primary-600 text-white shadow-lg'
                : 't-text-m hover:t-text-s'
            }`}
          >
            <Globe className="w-3.5 h-3.5 inline mr-1.5" />
            Browse Public
          </button>
        </div>

        {tab === 'id' ? (
          <form onSubmit={handleJoinById} className="space-y-4">
            <div>
              <label className="block text-sm font-medium t-text-t mb-1.5">Room ID</label>
              <input
                type="text"
                className={`input-field ${errors ? 'ring-2 ring-red-500/40 border-red-500/60' : ''}`}
                placeholder="Paste the Room ID here"
                value={roomId}
                onChange={(e) => {
                  setRoomId(e.target.value);
                  if (errors) setErrors('');
                }}
                autoFocus
              />
              {errors && (
                <p className="text-red-400 text-xs mt-1 animate-fade-in">{errors}</p>
              )}
            </div>

            <div className="flex gap-3">
              <button type="button" onClick={handleClose} className="flex-1 btn-secondary">
                Cancel
              </button>
              <button type="submit" disabled={loading || !roomId.trim()} className="flex-1 btn-primary flex items-center justify-center gap-2">
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <DoorOpen className="w-4 h-4" />}
                {loading ? 'Joining...' : 'Join Room'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {publicRooms.length === 0 ? (
              <div className="text-center py-8">
                <Globe className="w-8 h-8 t-text-g mx-auto mb-2" />
                <p className="t-text-m text-sm">No public rooms available</p>
                <p className="t-text-f text-xs mt-1">Create one and invite people!</p>
              </div>
            ) : (
              publicRooms.map((room) => (
                <div
                  key={room.id}
                  className="flex items-center gap-3 p-3 rounded-xl t-bg-e border t-border-s hover:t-bg-h transition-colors"
                >
                  <div className="w-9 h-9 rounded-lg t-bg-t flex items-center justify-center">
                    <Globe className="w-4 h-4 t-text-m" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium t-text truncate">{room.name}</p>
                    <p className="text-[11px] t-text-f flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {room._count?.members || 0} members
                    </p>
                  </div>
                  <button
                    onClick={() => handleJoinPublic(room)}
                    disabled={loading}
                    className="btn-primary text-xs py-1.5 px-3"
                  >
                    Join
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
