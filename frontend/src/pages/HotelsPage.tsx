import React, { useState, useEffect } from 'react';
import {
  Building2, Plus, Edit3, Trash2, Star, Users, MapPin, Phone, Mail, X, Save, AlertTriangle
} from 'lucide-react';
import { api } from '../api';
import { Hotel } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';
import { StatCard } from '../components/StatCard';

const emptyHotel: Partial<Hotel> = {
  name: '', city: '', total_rooms: 100, star_rating: 4, dining_capacity: 150,
  contact_email: '', contact_phone: ''
};

export const HotelsPage: React.FC = () => {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [hotelToDelete, setHotelToDelete] = useState<Hotel | null>(null);
  const [form, setForm] = useState<Partial<Hotel>>(emptyHotel);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => { loadHotels(); }, []);

  const loadHotels = async () => {
    try { setLoading(true); setHotels(await api.getHotels()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setForm(emptyHotel); setEditingHotel(null); setShowForm(true); setError(null); };
  const openEdit = (h: Hotel) => { setForm({ ...h }); setEditingHotel(h); setShowForm(true); setError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim() || !form.city?.trim()) { setError('Hotel name and city are required.'); return; }
    try {
      setSaving(true); setError(null);
      if (editingHotel) {
        await api.updateHotel(editingHotel.id, form);
        setSuccess('Hotel updated successfully.');
      } else {
        await api.createHotel(form);
        setSuccess('Hotel added successfully.');
      }
      setShowForm(false); loadHotels();
      setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!hotelToDelete) return;
    try {
      await api.deleteHotel(hotelToDelete.id);
      setHotelToDelete(null); loadHotels();
      setSuccess('Hotel deleted.'); setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
  };

  const starRatingColor = (r: number) => r >= 5 ? 'amber' : r >= 4 ? 'green' : 'blue';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900">Hotel Management</h2>
          <p className="text-sm text-stone-500">Add, edit, and manage your hotel portfolio.</p>
        </div>
        <button onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-[#1B4332] text-white text-sm font-semibold rounded-xl hover:bg-[#144531] transition-colors shadow-xs">
          <Plus className="w-4 h-4" /> Add Hotel
        </button>
      </div>

      {success && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium">{success}</div>}
      {error && !showForm && <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">{error}</div>}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-48 bg-stone-200/60 rounded-2xl animate-pulse" />
          ))
        ) : hotels.length === 0 ? (
          <div className="col-span-3 p-12 text-center text-stone-400 bg-white rounded-2xl border border-stone-200">
            <Building2 className="w-10 h-10 mx-auto mb-3 text-stone-300" />
            <p className="font-medium">No hotels yet. Click "Add Hotel" to begin.</p>
          </div>
        ) : hotels.map((hotel) => (
          <div key={hotel.id} className="bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-shadow overflow-hidden">
            <div className="p-5 border-b border-stone-100 bg-gradient-to-r from-[#144531]/5 to-transparent">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-bold text-stone-900 text-base truncate">{hotel.name}</h3>
                  <div className="flex items-center gap-1.5 mt-1 text-xs text-stone-500">
                    <MapPin className="w-3.5 h-3.5 text-stone-400" />
                    <span>{hotel.city}</span>
                  </div>
                </div>
                <Badge variant={starRatingColor(hotel.star_rating)}>{'★'.repeat(hotel.star_rating)}</Badge>
              </div>
            </div>
            <div className="p-5 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-stone-50 rounded-xl">
                  <p className="text-stone-500 mb-0.5">Total Rooms</p>
                  <p className="font-bold text-stone-900">{hotel.total_rooms}</p>
                </div>
                <div className="p-2.5 bg-emerald-50 rounded-xl">
                  <p className="text-emerald-700 mb-0.5">Dining Capacity</p>
                  <p className="font-bold text-emerald-900">{hotel.dining_capacity} seats</p>
                </div>
              </div>
              {hotel.contact_email && (
                <div className="flex items-center gap-2 text-xs text-stone-500">
                  <Mail className="w-3.5 h-3.5" /><span className="truncate">{hotel.contact_email}</span>
                </div>
              )}
              {hotel.historical_record_count !== undefined && (
                <p className="text-[11px] text-stone-400">{hotel.historical_record_count.toLocaleString()} historical records</p>
              )}
              <div className="flex gap-2 pt-1">
                <button onClick={() => openEdit(hotel)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold border border-stone-200 rounded-lg hover:bg-stone-50 text-stone-700">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
                <button onClick={() => setHotelToDelete(hotel)}
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold border border-rose-200 rounded-lg hover:bg-rose-50 text-rose-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add / Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editingHotel ? 'Edit Hotel' : 'Add New Hotel'} maxWidth="xl">
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { label: 'Hotel Name *', key: 'name', type: 'text', placeholder: 'e.g. The Grand Palace Hotel', full: true },
              { label: 'City / Location *', key: 'city', type: 'text', placeholder: 'e.g. Metro City' },
              { label: 'Total Rooms', key: 'total_rooms', type: 'number', placeholder: '100' },
              { label: 'Dining Capacity (seats)', key: 'dining_capacity', type: 'number', placeholder: '150' },
              { label: 'Contact Email', key: 'contact_email', type: 'email', placeholder: 'manager@hotel.com' },
              { label: 'Contact Phone', key: 'contact_phone', type: 'text', placeholder: '+1-555-0100' },
            ].map(({ label, key, type, placeholder, full }) => (
              <div key={key} className={full ? 'sm:col-span-2' : ''}>
                <label className="block text-xs font-bold text-stone-600 mb-1">{label}</label>
                <input type={type} placeholder={placeholder}
                  value={(form as any)[key] ?? ''}
                  onChange={e => setForm(f => ({ ...f, [key]: type === 'number' ? parseInt(e.target.value) || 0 : e.target.value }))}
                  className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden text-xs"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">Star Rating</label>
              <select value={form.star_rating ?? 4}
                onChange={e => setForm(f => ({ ...f, star_rating: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-hidden">
                {[1,2,3,4,5].map(r => <option key={r} value={r}>{r} Star{'s' && r > 1 ? 's' : ''}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)}
              className="px-4 py-2 text-xs font-semibold border border-stone-200 rounded-xl hover:bg-stone-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-5 py-2 bg-[#1B4332] text-white text-xs font-bold rounded-xl hover:bg-[#144531] disabled:opacity-60 flex items-center gap-2">
              <Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : editingHotel ? 'Update Hotel' : 'Add Hotel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <Modal isOpen={!!hotelToDelete} onClose={() => setHotelToDelete(null)} title="Confirm Deletion" maxWidth="sm">
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 text-rose-700">
            <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
            <p>Delete <strong>{hotelToDelete?.name}</strong>? This will also remove all associated historical records and predictions.</p>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setHotelToDelete(null)} className="px-4 py-2 text-xs font-semibold border border-stone-200 rounded-xl hover:bg-stone-50">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 bg-rose-700 text-white text-xs font-bold rounded-xl hover:bg-rose-800">Delete Hotel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
