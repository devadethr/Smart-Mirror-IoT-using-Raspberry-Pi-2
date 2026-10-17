import React, { useState, useEffect } from 'react';
import {
  CalendarEvent,
  Reminder,
  TodoItem,
  MirrorSettings,
  WeatherData,
  NewsData,
  TrafficBulletin
} from './types';
import {
  getStoredSettings,
  saveStoredSettings,
  getStoredEvents,
  saveStoredEvents,
  getStoredReminders,
  saveStoredReminders,
  getStoredTodos,
  saveStoredTodos,
  FALLBACK_WEATHER,
  FALLBACK_NEWS
} from './storage';
import { TopSimulatorBar, ViewMode } from './components/TopSimulatorBar';
import { MirrorDisplay } from './components/MirrorDisplay';
import { PhoneControlPanel } from './components/PhoneControlPanel';
import { PiCodeHub } from './components/PiCodeHub';
import { Maximize2, Smartphone, Monitor, AlertTriangle } from 'lucide-react';

const MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 'AIzaSyChqG1Q4ovK9nYpJKykBnwVr6mqZsgT-fk';

export default function App() {
  const initialPath = window.location.pathname;
  const initialMode: ViewMode = initialPath === '/mirror' ? 'mirror' : 'dual';

  const [viewMode, setViewMode] = useState<ViewMode>(initialMode);
  const [isSimulatedOffline, setIsSimulatedOffline] = useState<boolean>(false);
  const [showGlassReflection, setShowGlassReflection] = useState<boolean>(true);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  // Persistent States
  const [settings, setSettings] = useState<MirrorSettings>(getStoredSettings);
  const [events, setEvents] = useState<CalendarEvent[]>(getStoredEvents);
  const [reminders, setReminders] = useState<Reminder[]>(getStoredReminders);
  const [todos, setTodos] = useState<TodoItem[]>(getStoredTodos);

  // Weather & News
  const [weather, setWeather] = useState<WeatherData>(FALLBACK_WEATHER);
  const [news, setNews] = useState<NewsData>(FALLBACK_NEWS);

  // Listen for Google Maps quota limit events
  useEffect(() => {
    const handleQuota = () => setQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handleQuota);
    return () => window.removeEventListener('gmp-quota-exceeded', handleQuota);
  }, []);

  // Save changes to storage whenever modified
  useEffect(() => {
    saveStoredSettings(settings);
  }, [settings]);

  useEffect(() => {
    saveStoredEvents(events);
  }, [events]);

  useEffect(() => {
    saveStoredReminders(reminders);
  }, [reminders]);

  useEffect(() => {
    saveStoredTodos(todos);
  }, [todos]);

  // Fetch real Open-Meteo weather when online for the configured city / lat / lon
  useEffect(() => {
    if (isSimulatedOffline) {
      return;
    }

    const fetchLiveWeather = async () => {
      try {
        const unitParam = settings.weather_units === 'fahrenheit' ? 'fahrenheit' : 'celsius';
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${settings.weather_lat}&longitude=${settings.weather_lon}&current=temperature_2m,relative_humidity_2m,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit=${unitParam}&timezone=auto`;

        const res = await fetch(url);
        if (!res.ok) throw new Error('Weather API error');
        const data = await res.json();

        const current = data.current || {};
        const daily = data.daily || {};

        const wmoDesc = (code: number) => {
          if (code === 0) return { desc: 'Clear sky', icon: '☀️' };
          if (code <= 3) return { desc: 'Partly cloudy', icon: '⛅' };
          if (code <= 48) return { desc: 'Foggy', icon: '🌫️' };
          if (code <= 65) return { desc: 'Rain', icon: '🌧️' };
          if (code <= 77) return { desc: 'Snow', icon: '❄️' };
          if (code <= 82) return { desc: 'Showers', icon: '🌦️' };
          return { desc: 'Thunderstorm', icon: '⛈️' };
        };

        const currentWmo = wmoDesc(current.weather_code || 0);

        const forecast = (daily.time || []).slice(0, 3).map((t: string, i: number) => {
          const dayName = new Date(t + 'T00:00:00').toLocaleDateString(undefined, { weekday: 'short' });
          const code = (daily.weather_code || [])[i] || 0;
          const { desc, icon } = wmoDesc(code);
          return {
            day: i === 0 ? 'Today' : dayName,
            date: t,
            high: Math.round((daily.temperature_2m_max || [])[i] || 70),
            low: Math.round((daily.temperature_2m_min || [])[i] || 50),
            condition: desc,
            icon
          };
        });

        setWeather({
          available: true,
          city: settings.weather_city,
          temperature: Math.round(current.temperature_2m || 68),
          unit: settings.weather_units === 'fahrenheit' ? '°F' : '°C',
          humidity: current.relative_humidity_2m || 50,
          condition: currentWmo.desc,
          icon: currentWmo.icon,
          forecast
        });
      } catch (err) {
        console.warn('Live weather note: using fallback weather', err);
      }
    };

    fetchLiveWeather();
    const interval = setInterval(fetchLiveWeather, 15 * 60 * 1000);
    return () => clearInterval(interval);
  }, [settings.weather_lat, settings.weather_lon, settings.weather_units, settings.weather_city, isSimulatedOffline]);

  // Calendar Event handlers
  const handleAddEvent = (newEvent: Omit<CalendarEvent, 'id'>) => {
    const nextId = events.length > 0 ? Math.max(...events.map(e => e.id)) + 1 : 1;
    setEvents(prev => [...prev, { id: nextId, ...newEvent }]);
  };

  const handleUpdateEvent = (id: number, updated: Omit<CalendarEvent, 'id'>) => {
    setEvents(prev => prev.map(e => (e.id === id ? { ...updated, id } : e)));
  };

  const handleDeleteEvent = (id: number) => {
    setEvents(prev => prev.filter(e => e.id !== id));
  };

  // Reminders handlers
  const handleAddReminder = (newRem: Omit<Reminder, 'id'>) => {
    const nextId = reminders.length > 0 ? Math.max(...reminders.map(r => r.id)) + 1 : 1;
    setReminders(prev => [...prev, { id: nextId, ...newRem }]);
  };

  const handleDeleteReminder = (id: number) => {
    setReminders(prev => prev.filter(r => r.id !== id));
  };

  // To-Do handlers
  const handleAddTodo = (task: string) => {
    const nextId = todos.length > 0 ? Math.max(...todos.map(t => t.id)) + 1 : 1;
    setTodos(prev => [
      ...prev,
      {
        id: nextId,
        task,
        is_completed: false,
        priority: 'normal',
        created_at: new Date().toISOString()
      }
    ]);
  };

  const handleToggleTodo = (id: number) => {
    setTodos(prev =>
      prev.map(t => (t.id === id ? { ...t, is_completed: !t.is_completed } : t))
    );
  };

  const handleUpdateTodo = (id: number, task: string) => {
    setTodos(prev => prev.map(t => (t.id === id ? { ...t, task } : t)));
  };

  const handleDeleteTodo = (id: number) => {
    setTodos(prev => prev.filter(t => t.id !== id));
  };

  // Settings & Commute
  const handleUpdateSettings = (newSettings: Partial<MirrorSettings>) => {
    setSettings(prev => ({ ...prev, ...newSettings }));
  };

  const handleChangePin = (oldPin: string, newPin: string): boolean => {
    if (oldPin !== settings.pin_code) {
      return false;
    }
    setSettings(prev => ({ ...prev, pin_code: newPin }));
    return true;
  };

  const handleUpdateCommuteHeadline = (headline: string) => {
    const newBulletin: TrafficBulletin = {
      id: `commute-${Date.now()}`,
      type: 'commute',
      headline,
      timestamp: 'Just now'
    };
    setNews(prev => ({
      ...prev,
      bulletins: [newBulletin, ...prev.bulletins.filter(b => b.type !== 'commute')]
    }));
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      
      {/* Google Maps Quota Notice (Required by Demo Key Governance) */}
      {quotaExceeded && (
        <div className="bg-amber-50 border-b border-amber-200 text-amber-900 px-4 py-2.5 text-xs md:text-sm text-center sticky top-0 z-50 shadow-sm">
          <span>
            Google Maps Platform quota reached. If you are the app owner, visit{' '}
            <a
              href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
              target="_blank"
              rel="noopener noreferrer"
              className="underline font-semibold text-amber-950 hover:text-amber-800"
            >
              maps developer site
            </a>{' '}
            for instructions to update your account.
          </span>
        </div>
      )}

      {/* Top Simulator Control Bar */}
      <TopSimulatorBar
        viewMode={viewMode}
        onSelectViewMode={setViewMode}
        isSimulatedOffline={isSimulatedOffline}
        onToggleOffline={() => setIsSimulatedOffline(prev => !prev)}
        showGlassReflection={showGlassReflection}
        onToggleReflection={() => setShowGlassReflection(prev => !prev)}
        isCanvasLit={settings.is_canvas_lit}
        onToggleCanvasLit={() => setSettings(prev => ({ ...prev, is_canvas_lit: !prev.is_canvas_lit }))}
        isPowerOn={settings.is_power_on}
        onTogglePower={() => handleUpdateSettings({ is_power_on: !settings.is_power_on })}
      />

      {/* Main View Area */}
      <div className="flex-1 flex flex-col">
        
        {/* MODE 1: DUAL LIVE SYNC */}
        {viewMode === 'dual' && (
          <div className="w-full flex-1 p-4 lg:p-6 max-w-[1600px] mx-auto flex flex-col gap-4">
            
            <div className="bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span className="font-semibold text-white">SmartMirror Live Sync:</span>
                <span>Actions in the phone controller immediately update SQLite and the 18.5" mirror display</span>
              </div>
              <div className="text-slate-400 font-mono">
                LAN: 0.0.0.0:5000 • Raspberry Pi 2 OS 32-bit
              </div>
            </div>

            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              
              {/* Phone Controller Mockup Column */}
              <div className="lg:col-span-5 xl:col-span-4 flex flex-col items-center">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center gap-1.5 self-start">
                  <Smartphone className="w-4 h-4 text-sky-400" />
                  <span>Phone Browser Control Panel (/)</span>
                </div>
                
                {/* Mobile Phone Device Frame */}
                <div className="w-full max-w-[390px] rounded-[40px] border-4 border-slate-700 bg-slate-950 p-2 shadow-2xl shadow-black/80">
                  <div className="w-28 h-4 bg-slate-800 rounded-full mx-auto mb-2" />
                  <div className="rounded-[32px] overflow-hidden max-h-[760px] overflow-y-auto">
                    <PhoneControlPanel
                      events={events}
                      reminders={reminders}
                      todos={todos}
                      settings={settings}
                      weather={weather}
                      mapsApiKey={MAPS_API_KEY}
                      onAddEvent={handleAddEvent}
                      onUpdateEvent={handleUpdateEvent}
                      onDeleteEvent={handleDeleteEvent}
                      onAddReminder={handleAddReminder}
                      onDeleteReminder={handleDeleteReminder}
                      onAddTodo={handleAddTodo}
                      onToggleTodo={handleToggleTodo}
                      onUpdateTodo={handleUpdateTodo}
                      onDeleteTodo={handleDeleteTodo}
                      onUpdateSettings={handleUpdateSettings}
                      onChangePin={handleChangePin}
                      onOpenMirrorView={() => setViewMode('mirror')}
                      onUpdateCommuteHeadline={handleUpdateCommuteHeadline}
                    />
                  </div>
                </div>
              </div>

              {/* 18.5" Monitor Bezel Frame Column */}
              <div className="lg:col-span-7 xl:col-span-8 flex flex-col">
                <div className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Monitor className="w-4 h-4 text-sky-400" />
                    <span>18.5-Inch Two-Way Smart Mirror (/mirror)</span>
                  </div>
                  <button
                    onClick={() => setViewMode('mirror')}
                    className="text-xs text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                  >
                    <span>Fullscreen</span>
                    <Maximize2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 18.5" 16:9 Bezel Frame */}
                <div className={`w-full aspect-[16/9] bg-black rounded-2xl border-8 border-neutral-900 shadow-2xl shadow-black overflow-hidden relative flex flex-col transition-all ${
                  settings.is_canvas_lit ? 'ring-2 ring-sky-500/30' : ''
                }`}>
                  <MirrorDisplay
                    events={events}
                    reminders={reminders}
                    todos={todos}
                    settings={settings}
                    weather={weather}
                    news={news}
                    isSimulatedOffline={isSimulatedOffline}
                    showGlassReflection={showGlassReflection}
                    onToggleCalendarWidget={() =>
                      handleUpdateSettings({ show_calendar_widget: !settings.show_calendar_widget })
                    }
                    onToggleRemindersWidget={() =>
                      handleUpdateSettings({ show_reminders_widget: !settings.show_reminders_widget })
                    }
                    onToggleTodosWidget={() =>
                      handleUpdateSettings({ show_todos_widget: !settings.show_todos_widget })
                    }
                    onTogglePower={() =>
                      handleUpdateSettings({ is_power_on: !settings.is_power_on })
                    }
                    onUpdateSettings={handleUpdateSettings}
                  />
                </div>

                {/* Mirror Specs Banner */}
                <div className="mt-3 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3 px-2">
                  <span>Display: Pure #000000 black canvas (unlit pixels reflect room light like a mirror)</span>
                  <span className="font-mono">16:9 Aspect • Contained Schedule Box</span>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* MODE 2: PHONE ONLY */}
        {viewMode === 'phone' && (
          <div className="w-full flex-1 p-4 md:p-6 flex flex-col items-center justify-center">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
              <PhoneControlPanel
                events={events}
                reminders={reminders}
                todos={todos}
                settings={settings}
                weather={weather}
                mapsApiKey={MAPS_API_KEY}
                onAddEvent={handleAddEvent}
                onUpdateEvent={handleUpdateEvent}
                onDeleteEvent={handleDeleteEvent}
                onAddReminder={handleAddReminder}
                onDeleteReminder={handleDeleteReminder}
                onAddTodo={handleAddTodo}
                onToggleTodo={handleToggleTodo}
                onUpdateTodo={handleUpdateTodo}
                onDeleteTodo={handleDeleteTodo}
                onUpdateSettings={handleUpdateSettings}
                onChangePin={handleChangePin}
                onOpenMirrorView={() => setViewMode('mirror')}
                onUpdateCommuteHeadline={handleUpdateCommuteHeadline}
              />
            </div>
          </div>
        )}

        {/* MODE 3: MIRROR ONLY */}
        {viewMode === 'mirror' && (
          <div className="w-full flex-1 bg-black flex flex-col min-h-screen">
            <MirrorDisplay
              events={events}
              reminders={reminders}
              todos={todos}
              settings={settings}
              weather={weather}
              news={news}
              isSimulatedOffline={isSimulatedOffline}
              showGlassReflection={showGlassReflection}
              onToggleCalendarWidget={() =>
                handleUpdateSettings({ show_calendar_widget: !settings.show_calendar_widget })
              }
              onToggleRemindersWidget={() =>
                handleUpdateSettings({ show_reminders_widget: !settings.show_reminders_widget })
              }
              onToggleTodosWidget={() =>
                handleUpdateSettings({ show_todos_widget: !settings.show_todos_widget })
              }
              onTogglePower={() =>
                handleUpdateSettings({ is_power_on: !settings.is_power_on })
              }
              onUpdateSettings={handleUpdateSettings}
            />
          </div>
        )}

        {/* MODE 4: PI CODE & DEPLOYMENT HUB */}
        {viewMode === 'code' && (
          <div className="w-full flex-1 py-6">
            <PiCodeHub />
          </div>
        )}

      </div>

    </div>
  );
}
