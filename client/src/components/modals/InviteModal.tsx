import { useState } from 'react';
import { X, UserPlus, Search, Loader2, Send } from 'lucide-react';
import { useStore } from '../../store';
import { roomApi, authApi } from '../../lib/api';
import { inviteSchema, type InviteInput } from '../../lib/validators';
import toast from 'react-hot-toast';

export default function InviteModal() {
  const { inviteOpen, setInviteOpen, activeRoom, activeRoomId } = useStore();
  const [username, setUsername] = useState('');
  const [errors, setErrors] = useState('');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);

  if (!inviteOpen || !activeRoom || !activeRoomId) return null;

  const handleSearch = async (query: string) => {
    setUsername(query);
    if (errors) setErrors('');

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const { data } = await authApi.searchUsers(query);
      setSearchResults(data.users);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleInvite = async (targetUsername: string) => {
    const result = inviteSchema.safeParse({ username: targetUsername });
    if (!result.success) {
      setErrors(result.error.errors[0].message);
      return;
    }
    setErrors('');

    setLoading(true);
    try {
      await roomApi.inviteUser(activeRoomId, targetUsername);
      toast.success(`Invited ${targetUsername} to ${activeRoom.name}! 📬`);
      // Remove from search results
      setSearchResults((prev) => prev.filter((u) => u.username !== targetUsername));
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to invite user');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDirect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return;
    await handleInvite(username.trim());
  };

  const handleClose = () => {
    setInviteOpen(false);
    setUsername('');
    setErrors('');
    setSearchResults([]);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative glass-card p-6 w-full max-w-md animate-bounce-in">
        <button onClick={handleClose} className="absolute top-4 right-4 btn-ghost p-1.5">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
            <UserPlus className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold t-text">Invite to Room</h2>
            <p className="text-xs t-text-m truncate max-w-[250px]">{activeRoom.name}</p>
          </div>
        </div>

        <form onSubmit={handleSubmitDirect} className="space-y-4">
          <div>
            <label className="block text-sm font-medium t-text-t mb-1.5">Search username</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 t-text-f" />
              <input
                type="text"
                className={`input-field pl-10 ${errors ? 'ring-2 ring-red-500/40 border-red-500/60' : ''}`}
                placeholder="Type a username to search..."
                value={username}
                onChange={(e) => handleSearch(e.target.value)}
                autoFocus
              />
              {searching && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primary-400 animate-spin" />
              )}
            </div>
            {errors && (
              <p className="text-red-400 text-xs mt-1 animate-fade-in">{errors}</p>
            )}
          </div>

          {/* Search results */}
          {searchResults.length > 0 && (
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {searchResults.map((user) => (
                <div
                  key={user.id}
                  className="flex items-center gap-3 p-2.5 rounded-xl t-bg-e border t-border-s hover:t-bg-h transition-colors"
                >
                  <div className="avatar w-8 h-8 text-xs bg-gradient-to-br from-primary-500 to-purple-600">
                    {user.username.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium t-text truncate">{user.username}</p>
                    <p className="text-[10px] t-text-f">
                      {user.isOnline ? '🟢 Online' : '⚫ Offline'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleInvite(user.username)}
                    disabled={loading}
                    className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1"
                  >
                    <Send className="w-3 h-3" />
                    Invite
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Direct invite button */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={handleClose} className="flex-1 btn-secondary">
              Close
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
