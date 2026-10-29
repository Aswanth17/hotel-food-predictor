import React, { useState } from 'react';
import { Hotel, Eye, EyeOff, UserPlus, AlertCircle, CheckCircle2 } from 'lucide-react';
import { api, setToken, setStoredHotel, AuthHotel } from '../api';

interface RegisterPageProps {
  onLogin: (hotel: AuthHotel) => void;
  onGoLogin: () => void;
}

export const RegisterPage: React.FC<RegisterPageProps> = ({ onLogin, onGoLogin }) => {
  const [form, setForm] = useState({
    hotel_name: '', city: '', email: '', password: '', confirm_password: '',
    total_rooms: 100, star_rating: 4, dining_capacity: 150
  });
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (form.password !== form.confirm_password) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    try {
      const res = await api.register({
        ...form,
        email: form.email.trim().toLowerCase()
      });
      setToken(res.access_token);
      const hotel: AuthHotel = {
        hotel_id: res.hotel_id, hotel_name: res.hotel_name,
        city: res.city || form.city, star_rating: res.star_rating || form.star_rating,
        dining_capacity: res.dining_capacity || form.dining_capacity,
        total_rooms: res.total_rooms || form.total_rooms,
        email: form.email
      };
      setStoredHotel(hotel);
      onLogin(hotel);
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "w-full px-4 py-2.5 border border-stone-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0E2F22] to-[#1a4a35] flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-400/30 mb-3">
            <Hotel className="w-7 h-7 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-white">Hotel Food Predictor</h1>
          <p className="text-emerald-300/70 text-sm mt-1">Register your hotel account</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-2xl p-8">
          <h2 className="text-xl font-bold text-stone-900 mb-5">Create Hotel Account</h2>

          {error && (
            <div className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Hotel Name *</label>
                <input type="text" value={form.hotel_name} onChange={e => set('hotel_name', e.target.value)}
                  required placeholder="The Grand Palace Hotel" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">City / Location *</label>
                <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
                  required placeholder="Mumbai" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Star Rating</label>
                <select value={form.star_rating} onChange={e => set('star_rating', parseInt(e.target.value))}
                  className={inputCls}>
                  {[3,4,5].map(s => <option key={s} value={s}>{s} Stars</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Total Rooms</label>
                <input type="number" value={form.total_rooms} min={10} max={2000}
                  onChange={e => set('total_rooms', parseInt(e.target.value))} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Dining Capacity</label>
                <input type="number" value={form.dining_capacity} min={20} max={5000}
                  onChange={e => set('dining_capacity', parseInt(e.target.value))} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Hotel Email *</label>
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                  required placeholder="manager@yourhotel.com" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Password *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.password}
                    onChange={e => set('password', e.target.value)}
                    required minLength={6} placeholder="Min 6 characters"
                    className={inputCls + ' pr-10'} />
                  <button type="button" onClick={() => setShowPw(!showPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400">
                    {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-1.5">Confirm Password *</label>
                <div className="relative">
                  <input type={showPw ? 'text' : 'password'} value={form.confirm_password}
                    onChange={e => set('confirm_password', e.target.value)}
                    required placeholder="Repeat password" className={inputCls + ' pr-10'} />
                  {form.confirm_password && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2">
                      {form.password === form.confirm_password
                        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                        : <AlertCircle className="w-4 h-4 text-red-400" />}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-[#144531] hover:bg-[#1a5a40] text-white font-semibold rounded-xl transition-colors disabled:opacity-60 mt-2">
              {loading ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : <UserPlus className="w-4 h-4" />}
              {loading ? 'Creating account…' : 'Create Hotel Account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-stone-500">
              Already have an account?{' '}
              <button onClick={onGoLogin} className="text-emerald-700 font-semibold hover:underline">
                Sign in
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
