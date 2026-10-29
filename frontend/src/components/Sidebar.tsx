import React from 'react';
import {
  LayoutDashboard, Sparkles, History, Building2, UtensilsCrossed,
  Database, Cpu, BarChart3, Settings, Hotel, Calendar, LogOut
} from 'lucide-react';
import { AuthHotel } from '../api';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
  isModelTrained?: boolean;
  hotel?: AuthHotel | null;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab, onSelectTab, isModelTrained, hotel, onLogout
}) => {
  const isAdmin = hotel?.role === 'admin';

  // Role-specific navigation items
  const hotelOpsItems = [
    { id: 'dashboard',      label: 'My Dashboard',        icon: LayoutDashboard },
    { id: 'new-prediction', label: 'New Prediction',      icon: Sparkles, highlight: true },
    { id: 'history',        label: 'My Predictions',      icon: History },
  ];

  const hotelMgmtItems = [
    { id: 'hotel-profile',    label: 'My Hotel & Capacity', icon: Building2 },
    { id: 'events',           label: 'Events & Holidays',   icon: Calendar },
    { id: 'inventory',        label: 'Food Catalogue',      icon: UtensilsCrossed },
    { id: 'historical-data',  label: 'My Historical Data',  icon: Database },
    { id: 'reports',          label: 'My Reports',          icon: BarChart3 },
  ];

  const adminOpsItems = [
    { id: 'dashboard',        label: 'System Dashboard',    icon: LayoutDashboard },
    { id: 'history',          label: 'Global Predictions',  icon: History },
  ];

  const adminMgmtItems = [
    { id: 'hotels',           label: 'All Hotels Overview', icon: Building2 },
    { id: 'model-performance',label: 'ML Model Performance',icon: Cpu,
      badge: isModelTrained ? 'Trained' : 'Untrained' },
    { id: 'inventory',        label: 'Food Catalogue',      icon: UtensilsCrossed },
    { id: 'historical-data',  label: 'All Historical Data', icon: Database },
    { id: 'reports',          label: 'System Reports',      icon: BarChart3 },
    { id: 'settings',         label: 'Settings & About',    icon: Settings },
  ];

  const opsItems = isAdmin ? adminOpsItems : hotelOpsItems;
  const mgmtItems = isAdmin ? adminMgmtItems : hotelMgmtItems;

  const NavBtn = ({ item }: { item: any }) => {
    const Icon     = item.icon;
    const isActive = currentTab === item.id;
    return (
      <button
        key={item.id}
        onClick={() => onSelectTab(item.id)}
        className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all ${
          isActive
            ? 'bg-amber-500 text-stone-900 shadow-md font-semibold'
            : item.highlight
            ? 'bg-[#1F6F4E]/40 text-emerald-100 hover:bg-[#1F6F4E]/70 hover:text-white'
            : 'text-stone-300 hover:bg-[#1F6F4E]/40 hover:text-white'
        }`}
      >
        <div className="flex items-center space-x-3">
          <Icon className={`w-4 h-4 ${isActive ? 'text-stone-900' : 'text-emerald-300'}`} />
          <span>{item.label}</span>
        </div>
        {item.badge && (
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
            item.badge === 'Trained'
              ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
              : 'bg-rose-400/20 text-rose-300 border border-rose-400/40'
          }`}>{item.badge}</span>
        )}
      </button>
    );
  };

  return (
    <aside className="w-64 bg-[#144531] text-stone-100 flex flex-col min-h-screen border-r border-[#0E2F22] shrink-0 select-none">
      {/* Brand */}
      <div className="p-6 border-b border-[#1F6F4E]/60 flex items-center space-x-3">
        <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-300">
          <Hotel className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-tight text-white leading-tight">Food Provision</h1>
          <p className="text-[11px] text-emerald-200/80 font-medium tracking-wide uppercase">Hotel Predictor</p>
        </div>
      </div>

      {/* Hotel or Admin info */}
      {hotel && (
        <div className="px-4 py-3 border-b border-[#1F6F4E]/40">
          <p className="text-[11px] text-emerald-300/60 uppercase font-bold tracking-wider mb-1">
            {isAdmin ? 'System Role' : 'Logged in as'}
          </p>
          <p className="text-sm font-semibold text-white truncate flex items-center gap-1.5">
            {isAdmin && <span className="text-amber-300 text-xs">👑</span>}
            {hotel.hotel_name}
          </p>
          <p className="text-[11px] text-stone-300 truncate">
            {isAdmin ? 'Full Platform & ML Access' : `${hotel.city} · ${hotel.star_rating}★ · ${hotel.dining_capacity} Seats`}
          </p>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/60 px-3 py-2">Operations</p>
        {opsItems.map(item => <NavBtn key={item.id} item={item} />)}

        <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-300/60 px-3 pt-5 pb-2">Management & ML</p>
        {mgmtItems.map(item => <NavBtn key={item.id} item={item} />)}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-[#1F6F4E]/40 space-y-2">
        {onLogout && (
          <button onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm text-rose-300 hover:bg-rose-500/20 hover:text-rose-200 transition-colors font-medium">
            <LogOut className="w-4 h-4" />
            <span>Logout</span>
          </button>
        )}
        <div className="p-3 rounded-xl bg-[#0E2F22]/80 border border-[#1F6F4E]/40 text-xs">
          <p className="font-semibold text-emerald-200">Final Year College Project</p>
          <p className="text-[11px] text-stone-400 mt-0.5">Hotel F&B Demand Analytics v2.0</p>
          <div className="mt-2 flex items-center space-x-2 text-[10px] text-emerald-300/80">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>RF + XGBoost Dual ML Engine</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
