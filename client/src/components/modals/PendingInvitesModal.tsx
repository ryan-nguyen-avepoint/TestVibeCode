import { useState } from 'react';
import { X, Bell, DoorOpen, Loader2, Trash2 } from 'lucide-react';
import { useStore } from '../../store';
import { roomApi } from '../../lib/api';
import toast from 'react-hot-toast';

interface Props {
  open: boolean;
  onClose: () => void;
  socket: {
    joinSocketRoom: (roomId: string) => void;
  };
}

export default function PendingInvitesModal({ open, onClose, socket }: Props) {
  const { pendingInvites, removeInvite, addRoom, setActiveRoom } = useStore();
  const [loading, setLoading] = useState<string | null>(null);

  if (!open) return null;

  const handleAccept = async (invite: any) => {
    setLoading(invite.id);
    try {
      const { data } = await roomApi.joinRoom(invite.roomId);
      addRoom(data.room);
      setActiveRoom(data.room.id);
      socket.joinSocketRoom(data.room.id);
      removeInvite(invite.id);
      toast.success(`Joined "${invite.room.name}"! 🎉`);
      if (pendingInvites.length <= 1) onClose();
    } catch (err: any) {
      // If already a member (409), the server still cleaned up the invite — just remove from UI
      if (err.response?.status === 409) {
        removeInvite(invite.id);
        toast.success(`You're already in "${invite.room.name}"!`);
        if (pendingInvites.length <= 1) onClose();
      } else {
        toast.error(err.response?.data?.error || 'Failed to join room');
      }
    } finally {
      setLoading(null);
    }
  };

  const handleDecline = async (invite: any) => {
    try {
      await roomApi.declineInvite(invite.id);
      removeInvite(invite.id);
      toast('Invite declined', { icon: '🗑️' });
      if (pendingInvites.length <= 1) onClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to decline invite');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative glass-card p-6 w-full max-w-md animate-bounce-in">
        <button onClick={onClose} className="absolute top-4 right-4 btn-ghost p-1.5">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20">
            <Bell className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold t-text">Pending Invites</h2>
            <p className="text-xs t-text-m">
              {pendingInvites.length} invite{pendingInvites.length !== 1 ? 's' : ''} waiting
            </p>
          </div>
        </div>

        <div className="space-y-2 max-h-80 overflow-y-auto">
          {pendingInvites.length === 0 ? (
            <div className="text-center py-8">
              <Bell className="w-8 h-8 t-text-g mx-auto mb-2" />
              <p className="t-text-m text-sm">No pending invites</p>
              <p className="t-text-f text-xs mt-1">Invites from room owners will appear here</p>
            </div>
          ) : (
            pendingInvites.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-3 p-3 rounded-xl t-bg-e border t-border-s"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium t-text truncate">
                    {invite.room?.name || 'Unknown Room'}
                  </p>
                  <p className="text-[11px] t-text-f">
                    Invited by <span className="t-text-t">{invite.sender?.username || 'Unknown'}</span>
                  </p>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => handleDecline(invite)}
                    className="btn-ghost p-2 t-text-f hover:text-red-400"
                    title="Decline"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleAccept(invite)}
                    disabled={loading === invite.id}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    {loading === invite.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <DoorOpen className="w-3.5 h-3.5" />
                    )}
                    Accept
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
