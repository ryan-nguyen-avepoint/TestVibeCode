import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MessageCircle, Eye, EyeOff, Loader2, Sparkles, UserPlus } from 'lucide-react';
import { useStore } from '../store';
import { authApi } from '../lib/api';
import { registerSchema, type RegisterInput } from '../lib/validators';
import toast from 'react-hot-toast';

export default function RegisterPage() {
  const navigate = useNavigate();
  const { setAuth } = useStore();
  const [form, setForm] = useState<RegisterInput>({ username: '', password: '', confirmPassword: '' });
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterInput, string>>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const validate = (): boolean => {
    const result = registerSchema.safeParse(form);
    if (!result.success) {
      const fieldErrors: typeof errors = {};
      result.error.errors.forEach((e) => {
        const field = e.path[0] as keyof RegisterInput;
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
      const { data } = await authApi.register({
        username: form.username,
        password: form.password,
      });
      setAuth(data.user, data.token);
      toast.success(`Welcome to VibeRyan, ${data.user.username}! 🚀`);
      navigate('/chat');
    } catch (err: any) {
      const message = err.response?.data?.error || 'Registration failed. Please try again.';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen t-bg flex items-center justify-center p-4">
      {/* Animated background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary-600/10 rounded-full blur-3xl animate-pulse-soft" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-purple-600/10 rounded-full blur-3xl animate-pulse-soft" style={{ animationDelay: '1s' }} />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-purple-600 shadow-lg shadow-primary-500/25 mb-4">
            <MessageCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold t-text">
            Join Vibe<span className="text-gradient">Ryan</span>
          </h1>
          <p className="t-text-m mt-2 flex items-center justify-center gap-1.5">
            <Sparkles className="w-4 h-4 text-primary-400" />
            Create your account in seconds
          </p>
        </div>

        {/* Form Card */}
        <div className="glass-card p-8 animate-slide-up">
          <h2 className="text-xl font-semibold t-text mb-1 flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-primary-400" />
            Create Account
          </h2>
          <p className="t-text-m text-sm mb-6">Pick a username and you're good to go</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium t-text-t mb-1.5">Username</label>
              <input
                type="text"
                className={`input-field ${errors.username ? 'ring-2 ring-red-500/40 border-red-500/60' : ''}`}
                placeholder="Choose a cool username"
                value={form.username}
                onChange={(e) => {
                  setForm({ ...form, username: e.target.value });
                  if (errors.username) setErrors({ ...errors, username: undefined });
                }}
                autoFocus
              />
              {errors.username && (
                <p className="text-red-400 text-xs mt-1.5 animate-fade-in">{errors.username}</p>
              )}
              <p className="t-text-f text-xs mt-1">Letters, numbers, underscores. 3-20 chars.</p>
            </div>

            <div>
              <label className="block text-sm font-medium t-text-t mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  className={`input-field pr-11 ${errors.password ? 'ring-2 ring-red-500/40 border-red-500/60' : ''}`}
                  placeholder="At least 6 characters"
                  value={form.password}
                  onChange={(e) => {
                    setForm({ ...form, password: e.target.value });
                    if (errors.password) setErrors({ ...errors, password: undefined });
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 t-text-f hover:t-text-t transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-red-400 text-xs mt-1.5 animate-fade-in">{errors.password}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium t-text-t mb-1.5">Confirm Password</label>
              <input
                type={showPassword ? 'text' : 'password'}
                className={`input-field ${errors.confirmPassword ? 'ring-2 ring-red-500/40 border-red-500/60' : ''}`}
                placeholder="Type your password again"
                value={form.confirmPassword}
                onChange={(e) => {
                  setForm({ ...form, confirmPassword: e.target.value });
                  if (errors.confirmPassword) setErrors({ ...errors, confirmPassword: undefined });
                }}
              />
              {errors.confirmPassword && (
                <p className="text-red-400 text-xs mt-1.5 animate-fade-in">{errors.confirmPassword}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full flex items-center justify-center gap-2 py-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Creating account...
                </>
              ) : (
                'Create Account'
              )}
            </button>
          </form>

          <p className="text-center t-text-m text-sm mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 hover:text-primary-500 font-medium transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
