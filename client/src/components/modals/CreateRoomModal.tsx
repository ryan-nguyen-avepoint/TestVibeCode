import { useState } from 'react';
import { X, Plus, Lock, Globe, Loader2 } from 'lucide-react';
import { useStore } from '../../store';
import { roomApi } from '../../lib/api';
import { createRoomSchema, type CreateRoomInput } from '../../lib/validators';
import toast from 'react-hot-toast';

export default function CreateRoomModal() {
  const { createRoomOpen, setCreateRoomOpen, addRoom, setActiveRoom } = useStore();
  const [form, setForm] = useState<CreateRoomInput>({ name: '', description: '', isPrivate: false });
  const [errors, setErrors] = useState<Partial<Record<keyof CreateRoomInput, string>>>({});
  const [loading, setLoading] = useState(false);

  if (!createRoomOpen) return null;

  const validate = (): boolean => {
    const result = createRoomSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.errors.forEach((e) => {
        const field = e.path[0] as keyof CreateRoomInput;
        if (!fieldErrors[field]) fieldErrors[field] = e.message;
      });
      setErrors(fieldErrors);
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      const { data } = await roomApi.createRoom({
        name: form.name.trim(),
        description: form.description?.trim() || undefined,
        isPrivate: form.isPrivate,
      });
      addRoom(data.room);
      setActiveRoom(data.room.id);
      toast.success(`Room "${data.room.name}" created! 🎉`);
      handleClose();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create room');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setCreateRoomOpen(false);
    setForm({ name: '', description: '', isPrivate: false });
    setErrors({});
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal */}
      <div className="relative glass-card p-6 w-full max-w-md animate-bounce-in">
        <button onClick={handleClose} className="absolute top-4 right-4 btn-ghost p-1.5">
          <X className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary-500/10 flex items-center justify-center border border-primary-500/20">
            <Plus className="w-5 h-5 text-primary-400" />
          </div>
          <div>
            <h2 className="text-lg font-bold t-text">Create Room</h2>
            <p className="text-xs t-text-m">Start a new conversation space</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium t-text-t mb-1.5">Room Name</label>
            <input
              type="text"
              className={`input-field ${errors.name ? 'ring-2 ring-red-500/40 border-red-500/60' : ''}`}
              placeholder="e.g., Design Team, Gaming Lounge"
              value={form.name}
              onChange={(e) => {
                setForm({ ...form, name: e.target.value });
                if (errors.name) setErrors({ ...errors, name: undefined });
              }}
              autoFocus
            />
            {errors.name && (
              <p className="text-red-400 text-xs mt-1 animate-fade-in">{errors.name}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium t-text-t mb-1.5">Description (optional)</label>
            <input
              type="text"
              className={`input-field ${errors.description ? 'ring-2 ring-red-500/40 border-red-500/60' : ''}`}
              placeholder="What's this room about?"
              value={form.description || ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {errors.description && (
              <p className="text-red-400 text-xs mt-1 animate-fade-in">{errors.description}</p>
            )}
          </div>

          {/* Privacy toggle */}
          <div>
            <button
              type="button"
              onClick={() => setForm({ ...form, isPrivate: !form.isPrivate })}
              className="w-full flex items-center gap-3 cursor-pointer p-3 rounded-xl t-bg-e border t-border-s hover:t-bg-h transition-colors text-left"
            >
              <div className={`w-10 h-6 rounded-full p-0.5 transition-colors flex-shrink-0 ${form.isPrivate ? 'bg-amber-500' : ''}`} style={{ backgroundColor: form.isPrivate ? undefined : 'var(--bg-hover)' }}>
                <div className={`w-5 h-5 rounded-full bg-white shadow-md transition-transform ${form.isPrivate ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-1.5">
                  {form.isPrivate ? <Lock className="w-4 h-4 text-amber-400" /> : <Globe className="w-4 h-4 t-text-m" />}
                  <span className="text-sm font-medium t-text">
                    {form.isPrivate ? 'Private Room' : 'Public Room'}
                  </span>
                </div>
                <p className="text-[11px] t-text-f mt-0.5">
                  {form.isPrivate
                    ? 'Only invited users can join this room'
                    : 'Anyone can find and join this room'}
                </p>
              </div>
            </button>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={handleClose} className="flex-1 btn-secondary">
              Cancel
            </button>
            <button type="submit" disabled={loading} className="flex-1 btn-primary flex items-center justify-center gap-2">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {loading ? 'Creating...' : 'Create Room'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
