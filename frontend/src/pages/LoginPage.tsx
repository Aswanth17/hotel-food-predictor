import React, { useState } from 'react';
import { Hotel, Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { api, setToken, setStoredHotel, AuthHotel } from '../api';

interface LoginPageProps {
  onLogin: (hotel: AuthHotel) => void;
  onGoRegister: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin, onGoRegister }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]     = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim().toLowerCase(), password);
      setToken(res.access_token);
      const hotel: AuthHotel = {
        hotel_id: res.hotel_id, 
        hotel_name: res.hotel_name,
        city: res.city, 
        star_rating: res.star_rating,
        dining_capacity: res.dining_capacity, 
        total_rooms: res.total_rooms,
        email: res.email ?? email,
        role: (res as any).role || 'hotel'
      };
      setStoredHotel(hotel);
      onLogin(hotel);
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E2F22] to-[#1a4a35] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-400/30 mb-4">
            <Hotel className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Hotel Food Predictor</h1>
          <p className="text-emerald-300/70 text-sm mt-1">Sign in to your hotel account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-stone-900 mb-6">Welcome back</h2>

          {error && (
            <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Hotel Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                required placeholder="grand@hotel.com"
                className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1.5">Password</label>
              <div className="relative">
                <input
                  type={showPw ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  required placeholder="••••••••"
                  className="w-full px-4 py-3 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent pr-11"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600">
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#144531] hover:bg-[#1a5a40] text-white font-semibold rounded-xl transition-colors disabled:opacity-60 mt-2">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : <LogIn className="w-4 h-4" />}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-stone-500">
              New hotel?{' '}
              <button onClick={onGoRegister} className="text-emerald-700 font-semibold hover:underline">
                Create an account
              </button>
            </p>
          </div>

          {/* Demo hint with Quick Autofill */}
          <div className="mt-5 p-3.5 bg-stone-50 border border-stone-200 rounded-2xl text-xs text-stone-700 space-y-2.5">
            <p className="font-bold text-stone-900 flex items-center justify-between">
              <span>Quick Login Accounts:</span>
              <span className="text-[10px] text-stone-400 font-normal">Click to autofill</span>
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setEmail('grand@hotel.com');
                  setPassword('password123');
                }}
                className="text-left p-2 rounded-xl border border-emerald-200 bg-emerald-50/70 hover:bg-emerald-100/60 transition group"
              >
                <div className="font-bold text-emerald-900 flex items-center gap-1">
                  <span>🏨 Hotel Account</span>
                </div>
                <div className="text-[11px] text-emerald-700 font-mono mt-0.5">grand@hotel.com</div>
                <div className="text-[10px] text-emerald-600/80">Private hotel & capacity</div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setEmail('admin@hotelpredictor.com');
                  setPassword('admin123');
                }}
                className="text-left p-2 rounded-xl border border-amber-200 bg-amber-50/70 hover:bg-amber-100/60 transition group"
              >
                <div className="font-bold text-amber-900 flex items-center gap-1">
                  <span>👑 Admin Account</span>
                </div>
                <div className="text-[11px] text-amber-800 font-mono mt-0.5">admin@hotel...</div>
                <div className="text-[10px] text-amber-700/80">ML metrics & all hotels</div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
