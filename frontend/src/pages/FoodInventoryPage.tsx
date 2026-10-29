import React, { useState, useEffect } from 'react';
import { Plus, Edit3, Trash2, AlertTriangle, Save, UtensilsCrossed } from 'lucide-react';
import { api } from '../api';
import { FoodItem } from '../types';
import { Badge } from '../components/Badge';
import { Modal } from '../components/Modal';

const CATEGORIES = ['Main Course', 'Breakfast Special', 'Bakery', 'Beverage', 'Dairy', 'Salad', 'Dessert', 'Snacks'];
const UNITS = ['kg', 'litres', 'pieces'] as const;
const empty: Partial<FoodItem> = { name: '', category: 'Main Course', unit: 'kg', default_consumption_per_guest: 0.2, cost_per_unit: 0, shelf_life_days: 2 };

export const FoodInventoryPage: React.FC = () => {
  const [items, setItems] = useState<FoodItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<FoodItem | null>(null);
  const [toDelete, setToDelete] = useState<FoodItem | null>(null);
  const [form, setForm] = useState<Partial<FoodItem>>(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('All');

  useEffect(() => { load(); }, []);

  const load = async () => {
    try { setLoading(true); setItems(await api.getFoodItems()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  const openAdd = () => { setForm(empty); setEditItem(null); setShowForm(true); setError(null); };
  const openEdit = (i: FoodItem) => { setForm({ ...i }); setEditItem(i); setShowForm(true); setError(null); };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) { setError('Name is required.'); return; }
    if (!form.default_consumption_per_guest || form.default_consumption_per_guest <= 0) { setError('Consumption per guest must be > 0.'); return; }
    try {
      setSaving(true); setError(null);
      if (editItem) { await api.updateFoodItem(editItem.id, form); setSuccess('Updated.'); }
      else { await api.createFoodItem(form); setSuccess('Added.'); }
      setShowForm(false); load(); setTimeout(() => setSuccess(null), 3000);
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    try { await api.deleteFoodItem(toDelete.id); setToDelete(null); load(); }
    catch (e: any) { setError(e.message); }
  };

  const categories = ['All', ...Array.from(new Set(items.map(i => i.category))).sort()];
  const displayed = activeCategory === 'All' ? items : items.filter(i => i.category === activeCategory);

  const unitBadge = (u: string) => u === 'kg' ? 'green' : u === 'litres' ? 'blue' : 'amber';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold text-stone-900">Food Catalogue</h2>
          <p className="text-sm text-stone-500">Manage buffet items, units, and default per-guest consumption factors.</p>
        </div>
        <button onClick={openAdd} className="flex items-center gap-2 px-4 py-2 bg-[#1B4332] text-white text-sm font-semibold rounded-xl hover:bg-[#144531] shadow-xs">
          <Plus className="w-4 h-4" /> Add Item
        </button>
      </div>

      {success && <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm">{success}</div>}

      {/* Category filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${activeCategory === cat ? 'bg-[#1B4332] text-white border-[#1B4332]' : 'bg-white text-stone-600 border-stone-200 hover:bg-stone-50'}`}>
            {cat}
          </button>
        ))}
      </div>

      {/* Items Table */}
      <div className="bg-white rounded-2xl border border-stone-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200 text-stone-500 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Item Name</th>
                <th className="py-3 px-4">Category</th>
                <th className="py-3 px-4 text-center">Unit</th>
                <th className="py-3 px-4 text-right">Per-Guest Factor</th>
                <th className="py-3 px-4 text-right">Cost/Unit</th>
                <th className="py-3 px-4 text-right">Shelf Life</th>
                <th className="py-3 px-4 text-right">Avg Consumed</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {loading ? (
                <tr><td colSpan={8} className="py-8 text-center text-stone-400">Loading catalogue…</td></tr>
              ) : displayed.length === 0 ? (
                <tr><td colSpan={8} className="py-10 text-center text-stone-400">No items in this category.</td></tr>
              ) : displayed.map(item => (
                <tr key={item.id} className="hover:bg-stone-50/70">
                  <td className="py-3 px-4 font-semibold text-stone-900">{item.name}</td>
                  <td className="py-3 px-4 text-stone-600">{item.category}</td>
                  <td className="py-3 px-4 text-center"><Badge variant={unitBadge(item.unit) as any}>{item.unit}</Badge></td>
                  <td className="py-3 px-4 text-right font-medium text-emerald-800">{item.default_consumption_per_guest} {item.unit}/guest</td>
                  <td className="py-3 px-4 text-right text-stone-600">${item.cost_per_unit}</td>
                  <td className="py-3 px-4 text-right text-stone-500">{item.shelf_life_days}d</td>
                  <td className="py-3 px-4 text-right text-stone-500">{item.avg_consumption ?? '—'} {item.avg_consumption ? item.unit : ''}</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => openEdit(item)} className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg hover:bg-stone-100"><Edit3 className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setToDelete(item)} className="p-1.5 text-rose-400 hover:text-rose-700 rounded-lg hover:bg-rose-50"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title={editItem ? 'Edit Food Item' : 'Add Food Item'} maxWidth="xl">
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          {error && <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-stone-600 mb-1">Item Name *</label>
              <input type="text" value={form.name ?? ''} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Steamed Basmati Rice"
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden text-xs" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">Category *</label>
              <select value={form.category ?? 'Main Course'} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-hidden">
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">Measurement Unit *</label>
              <select value={form.unit ?? 'kg'} onChange={e => setForm(f => ({ ...f, unit: e.target.value as any }))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 text-xs focus:ring-2 focus:ring-emerald-700 focus:outline-hidden">
                {UNITS.map(u => <option key={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">Per-Guest Consumption ({form.unit}) *</label>
              <input type="number" step="0.01" min="0.001" value={form.default_consumption_per_guest ?? ''}
                onChange={e => setForm(f => ({ ...f, default_consumption_per_guest: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden text-xs" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">Cost per Unit ($)</label>
              <input type="number" step="0.01" min="0" value={form.cost_per_unit ?? ''}
                onChange={e => setForm(f => ({ ...f, cost_per_unit: parseFloat(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden text-xs" />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-600 mb-1">Shelf Life (days)</label>
              <input type="number" min="1" value={form.shelf_life_days ?? ''}
                onChange={e => setForm(f => ({ ...f, shelf_life_days: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 bg-stone-50 focus:bg-white focus:ring-2 focus:ring-emerald-700 focus:outline-hidden text-xs" />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-xs font-semibold border border-stone-200 rounded-xl hover:bg-stone-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-5 py-2 bg-[#1B4332] text-white text-xs font-bold rounded-xl hover:bg-[#144531] disabled:opacity-60 flex items-center gap-2">
              <Save className="w-3.5 h-3.5" />{saving ? 'Saving...' : editItem ? 'Update' : 'Add Item'}
            </button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={!!toDelete} onClose={() => setToDelete(null)} title="Confirm Removal" maxWidth="sm">
        <div className="space-y-4 text-sm">
          <div className="flex items-start gap-3 text-rose-700"><AlertTriangle className="w-5 h-5 shrink-0" />
            <p>Remove <strong>{toDelete?.name}</strong> from the active catalogue?</p></div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setToDelete(null)} className="px-4 py-2 text-xs border border-stone-200 rounded-xl hover:bg-stone-50 font-semibold">Cancel</button>
            <button onClick={handleDelete} className="px-4 py-2 bg-rose-700 text-white text-xs font-bold rounded-xl hover:bg-rose-800">Remove</button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
