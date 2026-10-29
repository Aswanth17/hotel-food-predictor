import React, { useState, useEffect } from 'react';
import { Calendar, Plus, Trash2, Edit2, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../api';

const CATEGORIES = [
  'Normal', 'Weekend', 'Public Holiday', 'Festival',
  'Wedding', 'Conference', 'Special Hotel Event'
];

const CAT_COLORS: Record<string, string> = {
  'Festival':           'bg-orange-100 text-orange-800 border-orange-200',
  'Public Holiday':     'bg-blue-100 text-blue-800 border-blue-200',
  'Wedding':            'bg-pink-100 text-pink-800 border-pink-200',
  'Conference':         'bg-purple-100 text-purple-800 border-purple-200',
  'Special Hotel Event':'bg-amber-100 text-amber-800 border-amber-200',
  'Weekend':            'bg-sky-100 text-sky-800 border-sky-200',
  'Normal':             'bg-stone-100 text-stone-700 border-stone-200',
};

const emptyForm = {
  event_name: '', event_date: '', event_end_date: '',
  event_category: 'Special Hotel Event', description: '', expected_guest_count: ''
};

export const EventsCalendarPage: React.FC = () => {
  const [events, setEvents]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing]   = useState<any | null>(null);
  const [form, setForm]         = useState({ ...emptyForm });
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [success, setSuccess]   = useState<string | null>(null);

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.getEvents();
      setEvents(res.events || []);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm });
    setShowForm(true);
  };

  const openEdit = (ev: any) => {
    setEditing(ev);
    setForm({
      event_name: ev.event_name, event_date: ev.event_date,
      event_end_date: ev.event_end_date || '',
      event_category: ev.event_category, description: ev.description || '',
      expected_guest_count: ev.expected_guest_count || ''
    });
    setShowForm(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        event_name: form.event_name,
        event_date: form.event_date,
        event_end_date: form.event_end_date || undefined,
        event_category: form.event_category,
        description: form.description,
        expected_guest_count: form.expected_guest_count ? parseInt(form.expected_guest_count as string) : undefined
      };
      if (editing) {
        await api.updateEvent(editing.id, payload);
        setSuccess('Event updated');
      } else {
        await api.createEvent(payload);
        setSuccess('Event created');
      }
      setShowForm(false);
      load();
    } catch (err: any) { setError(err.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this event?')) return;
    try {
      await api.deleteEvent(id);
      setSuccess('Event deleted');
      load();
    } catch (err: any) { setError(err.message); }
  };

  const inp = "w-full px-3 py-2 border border-stone-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-stone-900">Hotel Events Calendar</h2>
            <p className="text-sm text-stone-500">Manage events that affect guest count and food demand</p>
          </div>
        </div>
        <button onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-[#144531] text-white rounded-xl text-sm font-semibold hover:bg-[#1a5a40] transition-colors">
          <Plus className="w-4 h-4" /> Add Event
        </button>
      </div>

      {/* Alerts */}
      {error   && <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex gap-2"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />{error}</div>}
      {success && <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-sm flex gap-2"><CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" />{success}</div>}

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-stone-200 shadow-sm p-6">
          <h3 className="font-bold text-stone-900 mb-4">{editing ? 'Edit Event' : 'Create New Event'}</h3>
          <form onSubmit={handleSave} className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-600 mb-1">Event Name *</label>
              <input type="text" value={form.event_name} onChange={e => setForm({...form, event_name: e.target.value})}
                required placeholder="Annual Business Gala" className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Event Date *</label>
              <input type="date" value={form.event_date} onChange={e => setForm({...form, event_date: e.target.value})}
                required className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">End Date (optional)</label>
              <input type="date" value={form.event_end_date} onChange={e => setForm({...form, event_end_date: e.target.value})}
                className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Category *</label>
              <select value={form.event_category} onChange={e => setForm({...form, event_category: e.target.value})}
                className={inp}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-600 mb-1">Expected Guests (optional)</label>
              <input type="number" value={form.expected_guest_count}
                onChange={e => setForm({...form, expected_guest_count: e.target.value})}
                placeholder="300" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-stone-600 mb-1">Description (optional)</label>
              <textarea value={form.description} onChange={e => setForm({...form, description: e.target.value})}
                rows={2} placeholder="Additional details about this event…" className={inp + ' resize-none'} />
            </div>
            <div className="col-span-2 flex gap-3">
              <button type="submit" disabled={saving}
                className="px-5 py-2 bg-[#144531] text-white text-sm font-semibold rounded-xl hover:bg-[#1a5a40] disabled:opacity-60">
                {saving ? 'Saving…' : editing ? 'Update Event' : 'Create Event'}
              </button>
              <button type="button" onClick={() => setShowForm(false)}
                className="px-5 py-2 bg-stone-100 text-stone-700 text-sm font-semibold rounded-xl hover:bg-stone-200">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Events list */}
      {loading ? (
        <div className="text-center py-12 text-stone-400">Loading events…</div>
      ) : events.length === 0 ? (
        <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center">
          <Calendar className="w-12 h-12 text-stone-300 mx-auto mb-3" />
          <p className="font-semibold text-stone-600">No events yet</p>
          <p className="text-sm text-stone-400 mt-1">Add hotel events like weddings, conferences, and festivals to improve prediction accuracy.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map(ev => (
            <div key={ev.id} className="bg-white rounded-2xl border border-stone-200 p-4 flex items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 text-lg">
                  {ev.event_category === 'Festival' ? '🎉' :
                   ev.event_category === 'Wedding' ? '💍' :
                   ev.event_category === 'Conference' ? '🏢' :
                   ev.event_category === 'Public Holiday' ? '🏛️' : '📅'}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-stone-900 text-sm">{ev.event_name}</p>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${CAT_COLORS[ev.event_category] || CAT_COLORS['Normal']}`}>
                      {ev.event_category}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {ev.event_date}{ev.event_end_date ? ` → ${ev.event_end_date}` : ''}
                    {ev.expected_guest_count ? ` · ~${ev.expected_guest_count} guests expected` : ''}
                  </p>
                  {ev.description && <p className="text-xs text-stone-400 mt-0.5 truncate">{ev.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => openEdit(ev)}
                  className="p-2 text-stone-400 hover:text-emerald-700 hover:bg-emerald-50 rounded-lg transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(ev.id)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
