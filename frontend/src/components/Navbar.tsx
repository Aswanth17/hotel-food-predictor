import React from 'react';
import { Sparkles, Activity, Menu } from 'lucide-react';

interface NavbarProps {
  onNewPredictionClick: () => void;
  systemStatus: {
    healthy: boolean;
    guestModelReady: boolean;
    foodModelReady: boolean;
    xgbAvailable?: boolean;
  };
  hotelName?: string;
  currentPageTitle?: string;
  onToggleSidebar?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onNewPredictionClick, systemStatus, hotelName, currentPageTitle, onToggleSidebar
}) => {
  const modelsOk = systemStatus.guestModelReady && systemStatus.foodModelReady;

  return (
    <header className="h-16 bg-white border-b border-stone-200/90 px-5 flex items-center justify-between sticky top-0 z-30 shadow-xs">
      {/* Left: menu toggle + title */}
      <div className="flex items-center gap-4">
        {onToggleSidebar && (
          <button onClick={onToggleSidebar}
            className="p-2 rounded-lg text-stone-500 hover:bg-stone-100 transition-colors">
            <Menu className="w-5 h-5" />
          </button>
        )}
        <div>
          <h2 className="text-base font-bold text-stone-900 tracking-tight">
            {currentPageTitle || 'Food Provision Predictor'}
          </h2>
          {hotelName && (
            <p className="text-xs text-stone-500 hidden md:block truncate max-w-xs">
              {hotelName}
            </p>
          )}
        </div>
      </div>

      {/* Right: status badges + CTA */}
      <div className="flex items-center space-x-3">
        <div className="hidden lg:flex items-center space-x-3 text-xs bg-stone-50 px-3 py-1.5 rounded-xl border border-stone-200">
          <div className="flex items-center space-x-1.5">
            <span className={`w-2 h-2 rounded-full ${systemStatus.healthy ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            <span className="text-stone-600 font-medium">API: {systemStatus.healthy ? 'Online' : 'Offline'}</span>
          </div>
          <span className="text-stone-300">|</span>
          <div className="flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-emerald-700" />
            <span className="text-stone-600 font-medium">
              {modelsOk ? 'RF' : 'Fallback'}
              {systemStatus.xgbAvailable ? ' + XGBoost' : ''}
            </span>
          </div>
        </div>

        <button
          onClick={onNewPredictionClick}
          className="flex items-center space-x-2 px-4 py-2 bg-[#1B4332] hover:bg-[#144531] text-white text-xs sm:text-sm font-semibold rounded-xl transition-colors">
          <Sparkles className="w-4 h-4 text-amber-300" />
          <span>New Forecast</span>
        </button>
      </div>
    </header>
  );
};
