import React, { useState, useEffect } from 'react';
import { Sidebar } from './components/Sidebar';
import { Navbar } from './components/Navbar';
import { DashboardPage } from './pages/DashboardPage';
import { NewPredictionPage } from './pages/NewPredictionPage';
import { PredictionHistoryPage } from './pages/PredictionHistoryPage';
import { HotelsPage } from './pages/HotelsPage';
import { FoodInventoryPage } from './pages/FoodInventoryPage';
import { HistoricalDataPage } from './pages/HistoricalDataPage';
import { ModelPerformancePage } from './pages/ModelPerformancePage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { EventsCalendarPage } from './pages/EventsCalendarPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { HotelProfilePage } from './pages/HotelProfilePage';
import { api, getToken, getStoredHotel, setStoredHotel, clearToken, AuthHotel } from './api';

type Tab =
  | 'dashboard' | 'new-prediction' | 'history' | 'hotels'
  | 'hotel-profile' | 'inventory' | 'historical-data' | 'model-performance'
  | 'reports' | 'settings' | 'events';

type AuthView = 'login' | 'register';

function App() {
  const [authView, setAuthView]         = useState<AuthView>('login');
  const [hotel, setHotel]               = useState<AuthHotel | null>(null);
  const [authChecked, setAuthChecked]   = useState(false);
  const [currentTab, setCurrentTab]     = useState<Tab>('dashboard');
  const [isModelTrained, setIsModelTrained] = useState(false);
  const [sidebarOpen, setSidebarOpen]   = useState(true);
  const [systemStatus, setSystemStatus] = useState({
    healthy: false, guestModelReady: false, foodModelReady: false,
    xgbAvailable: false
  });

  // Restore session from localStorage on mount
  useEffect(() => {
    const token = getToken();
    const stored = getStoredHotel();
    if (token && stored) {
      setHotel(stored);
      // Verify token is still valid
      api.getMe()
        .then(res => {
          const h = (res as any).hotel || res;
          const refreshed: AuthHotel = {
            hotel_id: h.hotel_id ?? h.id ?? stored.hotel_id,
            hotel_name: h.hotel_name ?? h.name ?? stored.hotel_name,
            city: h.city ?? stored.city,
            star_rating: h.star_rating ?? stored.star_rating,
            dining_capacity: h.dining_capacity ?? stored.dining_capacity,
            total_rooms: h.total_rooms ?? stored.total_rooms,
            email: h.email || stored.email,
            role: (res as any).role || stored.role || 'hotel'
          };
          setHotel(refreshed);
          setStoredHotel(refreshed);
        })
        .catch(() => {
          clearToken();
          setHotel(null);
        })
        .finally(() => setAuthChecked(true));
    } else {
      setAuthChecked(true);
    }
  }, []);

  // Check model status after login
  useEffect(() => {
    if (!hotel) return;
    api.getHealth()
      .then(h => {
        const guestReady = !!(h.models?.guest_count_model_present);
        const foodReady  = !!(h.models?.food_quantity_model_present);
        setIsModelTrained(guestReady && foodReady);
        setSystemStatus({
          healthy: h.status === 'healthy',
          guestModelReady: guestReady,
          foodModelReady: foodReady,
          xgbAvailable: !!(h.models?.xgboost_available)
        });
      })
      .catch(() => {});
  }, [hotel]);

  const handleLogin = (h: AuthHotel) => {
    setHotel(h);
    setCurrentTab('dashboard');
  };

  const handleLogout = async () => {
    await api.logout();
    setHotel(null);
    setCurrentTab('dashboard');
  };

  // ── Loading splash ─────────────────────────────────────────────────────────
  if (!authChecked) {
    return (
      <div className="min-h-screen bg-[#0E2F22] flex items-center justify-center">
        <div className="text-center text-white">
          <div className="w-8 h-8 border-2 border-amber-400 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-emerald-300">Loading…</p>
        </div>
      </div>
    );
  }

  // ── Auth screens ───────────────────────────────────────────────────────────
  if (!hotel) {
    return authView === 'login'
      ? <LoginPage onLogin={handleLogin} onGoRegister={() => setAuthView('register')} />
      : <RegisterPage onLogin={handleLogin} onGoLogin={() => setAuthView('login')} />;
  }

  // ── Authenticated app ──────────────────────────────────────────────────────
  const renderPage = () => {
    switch (currentTab) {
      case 'dashboard':
        return (
          <DashboardPage
            hotel={hotel}
            onNavigateToNewPrediction={() => setCurrentTab('new-prediction')}
            onNavigateToHistory={() => setCurrentTab('history')}
          />
        );
      case 'new-prediction':
        return (
          <NewPredictionPage 
            hotel={hotel} 
            onNavigateToUpgrade={() => setCurrentTab('hotel-profile')} 
          />
        );
      case 'history':           return <PredictionHistoryPage hotel={hotel} />;
      case 'hotel-profile':     
        return (
          <HotelProfilePage 
            hotel={hotel!} 
            onHotelUpdated={updated => setHotel(updated)}
            onNavigateToPrediction={() => setCurrentTab('new-prediction')}
          />
        );
      case 'hotels':            return <HotelsPage />;
      case 'inventory':         return <FoodInventoryPage />;
      case 'historical-data':   return <HistoricalDataPage hotel={hotel} />;
      case 'model-performance': return <ModelPerformancePage />;
      case 'reports':           return <ReportsPage />;
      case 'settings':          return <SettingsPage />;
      case 'events':            return <EventsCalendarPage />;
      default:
        return (
          <DashboardPage
            hotel={hotel}
            onNavigateToNewPrediction={() => setCurrentTab('new-prediction')}
            onNavigateToHistory={() => setCurrentTab('history')}
          />
        );
    }
  };

  const pageTitles: Record<Tab, string> = {
    'dashboard':         hotel?.role === 'admin' ? 'System Overview' : 'My Hotel Dashboard',
    'new-prediction':    'New Provision Forecast',
    'history':           hotel?.role === 'admin' ? 'Global Prediction Audit' : 'My Prediction History',
    'hotel-profile':     'My Hotel Profile & Capacity Upgrade',
    'hotels':            'All Hotels Overview',
    'inventory':         'Food Catalogue',
    'historical-data':   hotel?.role === 'admin' ? 'All Historical Records' : 'My Historical Records',
    'model-performance': 'ML Model Performance (RF vs XGBoost)',
    'reports':           hotel?.role === 'admin' ? 'System Reports & Export' : 'My Reports & Export',
    'settings':          'Settings & About',
    'events':            'Events & Holidays Calendar',
  };

  return (
    <div className="flex min-h-screen bg-stone-100 font-sans text-stone-900">
      {sidebarOpen && (
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tab) => setCurrentTab(tab as Tab)}
          isModelTrained={isModelTrained}
          hotel={hotel}
          onLogout={handleLogout}
        />
      )}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        <Navbar
          onNewPredictionClick={() => setCurrentTab('new-prediction')}
          systemStatus={systemStatus}
          hotelName={hotel.hotel_name}
          onToggleSidebar={() => setSidebarOpen(s => !s)}
          currentPageTitle={pageTitles[currentTab]}
        />
        <main className="flex-1 overflow-y-auto p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
