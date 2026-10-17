import React, { useState, useEffect } from 'react';
import { CalendarEvent, Reminder, TodoItem, MirrorSettings, WeatherData, NewsData } from '../types';
import { Calendar, CheckSquare, Cloud, Bell, X, Power, Sliders, Sparkles } from 'lucide-react';

interface MirrorDisplayProps {
  events: CalendarEvent[];
  reminders: Reminder[];
  todos: TodoItem[];
  settings: MirrorSettings;
  weather: WeatherData;
  news: NewsData;
  isSimulatedOffline: boolean;
  showGlassReflection: boolean;
  onToggleCalendarWidget?: () => void;
  onToggleRemindersWidget?: () => void;
  onToggleTodosWidget?: () => void;
  onTogglePower?: () => void;
  onUpdateSettings?: (partial: Partial<MirrorSettings>) => void;
}

export const MirrorDisplay: React.FC<MirrorDisplayProps> = ({
  events,
  reminders,
  todos,
  settings,
  weather,
  news,
  isSimulatedOffline,
  showGlassReflection,
  onToggleCalendarWidget,
  onToggleRemindersWidget,
  onToggleTodosWidget,
  onTogglePower,
  onUpdateSettings
}) => {
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Independent widget visibility states synced with settings
  const [showCalendar, setShowCalendar] = useState<boolean>(settings.show_calendar_widget ?? true);
  const [showReminders, setShowReminders] = useState<boolean>(settings.show_reminders_widget ?? true);
  const [showTodos, setShowTodos] = useState<boolean>(settings.show_todos_widget ?? true);
  const [isPowerOn, setIsPowerOn] = useState<boolean>(settings.is_power_on ?? true);

  // Quick Declutter bar overlay toggle
  const [showControlsBar, setShowControlsBar] = useState<boolean>(true);

  useEffect(() => {
    setShowCalendar(settings.show_calendar_widget ?? true);
  }, [settings.show_calendar_widget]);

  useEffect(() => {
    setShowReminders(settings.show_reminders_widget ?? true);
  }, [settings.show_reminders_widget]);

  useEffect(() => {
    setShowTodos(settings.show_todos_widget ?? true);
  }, [settings.show_todos_widget]);

  useEffect(() => {
    setIsPowerOn(settings.is_power_on ?? true);
  }, [settings.is_power_on]);

  // Greeting Lifecycle Stages:
  // 1. 'welcome': Displays "WELCOME " in the middle (3.5s)
  // 2. 'greeting': Displays dynamic time-based greeting & user name in the middle
  // 3. 'vanished': Greeting vanishes after 20s total from opening app or turning on power
  type GreetingStage = 'welcome' | 'greeting' | 'vanished';
  const [greetingStage, setGreetingStage] = useState<GreetingStage>('welcome');
  const [greetingSecondsLeft, setGreetingSecondsLeft] = useState<number>(20);
  const [sequenceKey, setSequenceKey] = useState<number>(0);

  useEffect(() => {
    if (!isPowerOn) {
      setGreetingStage('vanished');
      setGreetingSecondsLeft(0);
      return;
    }

    // When power is turned on or app opened:
    setGreetingStage('welcome');
    setGreetingSecondsLeft(20);

    // Show "WELCOME " for 3.5 seconds, then transition to dynamic greeting
    const welcomeTimer = setTimeout(() => {
      setGreetingStage('greeting');
    }, 3500);

    // Greeting vanishes completely after 20 seconds total from opening/turning on
    const vanishTimer = setTimeout(() => {
      setGreetingStage('vanished');
    }, 20000);

    // 1-second countdown ticker
    const countdownInterval = setInterval(() => {
      setGreetingSecondsLeft(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => {
      clearTimeout(welcomeTimer);
      clearTimeout(vanishTimer);
      clearInterval(countdownInterval);
    };
  }, [isPowerOn, sequenceKey]);

  const handleReplayGreeting = () => {
    if (!isPowerOn) return;
    setSequenceKey(k => k + 1);
  };

  // 1-second local clock ticker
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Format 12-hour clock
  let hours = currentTime.getHours();
  const minutes = String(currentTime.getMinutes()).padStart(2, '0');
  const seconds = String(currentTime.getSeconds()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12 || 12;

  const dateFormatted = currentTime.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

  // Calculate Night Dimming
  const currentHour = currentTime.getHours();
  let isDimmed = false;
  if (settings.night_dim_enabled && isPowerOn) {
    if (settings.night_dim_start > settings.night_dim_end) {
      isDimmed = currentHour >= settings.night_dim_start || currentHour < settings.night_dim_end;
    } else {
      isDimmed = currentHour >= settings.night_dim_start && currentHour < settings.night_dim_end;
    }
  }

  // Active uncompleted & recent completed tasks
  const pendingTodos = todos.filter(t => !t.is_completed).slice(0, 5);
  const completedTodos = todos.filter(t => t.is_completed).slice(0, 3);

  // Active reminders
  const activeReminders = reminders.filter(r => r.is_active);

  // Upcoming events
  const upcomingEvents = [...events]
    .sort((a, b) => (a.event_date + a.start_time).localeCompare(b.event_date + b.start_time))
    .slice(0, 4);

  // Combine news items and bulletins
  const bulletinItems = [
    ...(news.bulletins || []).map(b => `[${b.type.toUpperCase()} BULLETIN] ${b.headline}`),
    ...(news.items || [])
  ];

  // Dynamic greeting that changes according to the time of day, followed by comma
  const getTimeBasedGreeting = (date: Date): string => {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) {
      return 'GOOD MORNING,';
    } else if (hour >= 12 && hour < 17) {
      return 'GOOD AFTERNOON,';
    } else if (hour >= 17 && hour < 22) {
      return 'GOOD EVENING,';
    } else {
      return 'GOOD NIGHT,';
    }
  };

  const dynamicGreeting = getTimeBasedGreeting(currentTime);

  // Toggle handlers that update local state and notify parent
  const handleToggleCalendar = (newVal?: boolean) => {
    const next = newVal !== undefined ? newVal : !showCalendar;
    setShowCalendar(next);
    onUpdateSettings?.({ show_calendar_widget: next });
    onToggleCalendarWidget?.();
  };

  const handleToggleReminders = (newVal?: boolean) => {
    const next = newVal !== undefined ? newVal : !showReminders;
    setShowReminders(next);
    onUpdateSettings?.({ show_reminders_widget: next });
    onToggleRemindersWidget?.();
  };

  const handleToggleTodos = (newVal?: boolean) => {
    const next = newVal !== undefined ? newVal : !showTodos;
    setShowTodos(next);
    onUpdateSettings?.({ show_todos_widget: next });
    onToggleTodosWidget?.();
  };

  const handleTogglePower = (newVal?: boolean) => {
    const next = newVal !== undefined ? newVal : !isPowerOn;
    setIsPowerOn(next);
    onUpdateSettings?.({ is_power_on: next });
    onTogglePower?.();
  };

  // ----------------------------------------------------
  // SWITCHED OFF STATE: Displays in the middle (" Have a great day! ")
  // ----------------------------------------------------
  if (!isPowerOn) {
    return (
      <div
        className="relative w-full h-full min-h-[640px] bg-black text-white overflow-hidden select-none font-sans flex flex-col items-center justify-center transition-all duration-700"
        tabIndex={0}
      >
        {/* Two-Way Mirror Glass Reflection Simulation even when off */}
        {showGlassReflection && (
          <div
            className="absolute inset-0 pointer-events-none z-30 opacity-25 mix-blend-screen"
            style={{
              background: 'radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.15) 0%, rgba(200, 225, 255, 0.05) 50%, transparent 80%)'
            }}
            aria-hidden="true"
          />
        )}

        {/* Center Farewell Message when Mirror is Switched Off */}
        <div className="relative z-40 flex flex-col items-center justify-center text-center px-6 max-w-xl animate-fade-in">
          {/* Exact phrase requested: " Have a great day! " */}
          <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-wide text-white drop-shadow-[0_0_35px_rgba(255,255,255,0.45)]">
            &ldquo; Have a great day! &rdquo;
          </div>
          <div className="text-[11px] md:text-xs font-mono tracking-[0.3em] uppercase text-slate-500 mt-5">
            SmartMirror • Display Switched Off
          </div>

          {/* Quick Power ON Toggle Switch in Off State */}
          <button
            onClick={() => handleTogglePower(true)}
            className="mt-8 flex items-center gap-2 px-5 py-2.5 rounded-full bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-300 hover:text-white text-xs font-medium transition-all shadow-xl hover:scale-105 cursor-pointer"
            title="Turn SmartMirror back on"
          >
            <Power className="w-3.5 h-3.5 text-emerald-400" />
            <span>Switch SmartMirror ON</span>
          </button>
        </div>

        {/* Minimal standby power badge in bottom right corner */}
        <div className="absolute bottom-4 right-4 z-40 flex items-center gap-2 text-[10px] text-slate-600 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500/70 animate-ping" />
          <span>STANDBY</span>
        </div>
      </div>
    );
  }

  // ----------------------------------------------------
  // SWITCHED ON STATE: Active SmartMirror
  // ----------------------------------------------------
  return (
    <div
      className={`relative w-full h-full min-h-[640px] bg-black text-white overflow-hidden select-none font-sans flex flex-col justify-between transition-all duration-700 ${
        settings.is_canvas_lit
          ? 'ring-2 ring-sky-400/40 shadow-[inset_0_0_120px_rgba(56,189,248,0.2),0_0_60px_rgba(56,189,248,0.15)]'
          : ''
      }`}
    >
      {/* Ambient Edge Glow Backlight (Canvas is lit) */}
      {settings.is_canvas_lit && (
        <div
          className="absolute inset-0 pointer-events-none z-10 opacity-80"
          style={{
            background: 'radial-gradient(ellipse at 50% 50%, transparent 60%, rgba(56, 189, 248, 0.12) 88%, rgba(255, 255, 255, 0.22) 100%)'
          }}
          aria-hidden="true"
        />
      )}

      {/* Night Dimming Optical Layer */}
      {isDimmed && (
        <div
          className="absolute inset-0 bg-black pointer-events-none z-40 transition-opacity duration-1000"
          style={{ opacity: 1 - settings.night_dim_opacity }}
          aria-hidden="true"
        />
      )}

      {/* Two-Way Mirror Glass Reflection Simulation */}
      {showGlassReflection && (
        <div
          className="absolute inset-0 pointer-events-none z-30 opacity-20 mix-blend-screen"
          style={{
            background: 'radial-gradient(circle at 50% 45%, rgba(255, 255, 255, 0.15) 0%, rgba(200, 225, 255, 0.05) 50%, transparent 80%)'
          }}
          aria-hidden="true"
        />
      )}

      {/* TOP CONTROLS BAR: Independent Widget Toggle Switches to Declutter the UI */}
      <div className="relative z-40 w-full px-4 pt-2 pb-1 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowControlsBar(!showControlsBar)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium text-slate-400 hover:text-white bg-slate-900/60 hover:bg-slate-800 transition-colors cursor-pointer"
            title="Toggle widget declutter bar"
          >
            <Sliders className="w-3 h-3 text-sky-400" />
            <span className="hidden sm:inline">Declutter Controls</span>
          </button>
        </div>

        {showControlsBar && (
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
            {/* Calendar Independent Toggle Switch */}
            <label className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-900/90 border border-white/15 px-2 py-1 rounded-lg cursor-pointer transition-colors">
              <Calendar className="w-3.5 h-3.5 text-sky-400" />
              <span className="text-[11px] text-slate-300 font-medium">Calendar</span>
              <button
                type="button"
                role="switch"
                aria-checked={showCalendar}
                onClick={() => handleToggleCalendar()}
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  showCalendar ? 'bg-sky-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    showCalendar ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>

            {/* Reminder Independent Toggle Switch */}
            <label className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-900/90 border border-white/15 px-2 py-1 rounded-lg cursor-pointer transition-colors">
              <Bell className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] text-slate-300 font-medium">Reminders</span>
              <button
                type="button"
                role="switch"
                aria-checked={showReminders}
                onClick={() => handleToggleReminders()}
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  showReminders ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    showReminders ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>

            {/* To-Do Independent Toggle Switch */}
            <label className="flex items-center gap-1.5 bg-slate-950/80 hover:bg-slate-900/90 border border-white/15 px-2 py-1 rounded-lg cursor-pointer transition-colors">
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-[11px] text-slate-300 font-medium">To-Do</span>
              <button
                type="button"
                role="switch"
                aria-checked={showTodos}
                onClick={() => handleToggleTodos()}
                className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${
                  showTodos ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    showTodos ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </label>

            {/* Greeting Status / Replay Control */}
            {greetingStage !== 'vanished' ? (
              <div className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/80 border border-white/15 text-[11px] text-slate-300">
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-slate-400 font-mono">
                  {greetingStage === 'welcome' ? 'Welcome' : 'Greeting:'}
                </span>
                <span className="font-mono text-sky-300">{greetingSecondsLeft}s</span>
                <button
                  type="button"
                  onClick={() => setGreetingStage('vanished')}
                  className="ml-1 text-slate-400 hover:text-white text-[10px] underline cursor-pointer"
                  title="Dismiss greeting now"
                >
                  Dismiss
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleReplayGreeting}
                className="hidden sm:flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-950/80 hover:bg-slate-900/90 border border-white/15 text-[11px] text-slate-300 hover:text-white transition-colors cursor-pointer"
                title="Replay Welcome & Greeting sequence (vanishes in 20s)"
              >
                <Sparkles className="w-3 h-3 text-sky-400" />
                <span>Show Greeting</span>
              </button>
            )}

            {/* Mirror Power Switch */}
            <button
              onClick={() => handleTogglePower(false)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-500/40 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-[11px] font-medium transition-colors cursor-pointer"
              title="Switch off smart mirror display (Shows 'Have a great day!')"
            >
              <Power className="w-3 h-3 text-red-400" />
              <span>Turn OFF</span>
            </button>
          </div>
        )}
      </div>

      {/* Main 16:9 Viewport Grid */}
      <div className="relative z-20 w-full flex-1 p-5 md:p-7 lg:p-8 grid grid-cols-1 md:grid-cols-2 grid-rows-[auto_1fr_auto] gap-4 md:gap-6">
        
        {/* TOP LEFT: Refined Digital Clock & Date (Compact at top edge) */}
        <div className="flex flex-col items-start justify-start">
          <div className="flex items-baseline tracking-tight font-extralight font-mono text-white">
            <span className="text-3xl md:text-4xl lg:text-5xl font-light">
              {hours}:{minutes}
            </span>
            <span className="text-base md:text-lg text-slate-400 font-normal ml-1">
              :{seconds}
            </span>
            <span className="text-xs md:text-sm text-slate-400 font-medium ml-1.5 tracking-widest">
              {ampm}
            </span>
          </div>
          <div className="text-xs md:text-sm text-slate-300 font-normal mt-1 tracking-wide">
            {dateFormatted}
          </div>
          {isDimmed && (
            <div className="text-[10px] text-sky-400/80 mt-1 uppercase tracking-widest font-mono">
              Night Dimming Active ({Math.round(settings.night_dim_opacity * 100)}% brightness)
            </div>
          )}
        </div>

        {/* TOP RIGHT: Weather & Forecast (Compact at top edge) */}
        <div className="flex flex-col items-start md:items-end justify-start text-left md:text-right">
          {isSimulatedOffline || !weather.available ? (
            <div className="p-3 border border-slate-800/80 rounded-xl bg-slate-950/60 max-w-xs">
              <div className="flex items-center gap-2 text-slate-400 text-xs">
                <Cloud className="w-4 h-4 text-slate-500 shrink-0" />
                <span>Weather currently unavailable</span>
              </div>
              <div className="text-[10px] text-slate-500 mt-1">
                SmartMirror offline fallback active
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-start md:items-end">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl md:text-3xl">{weather.icon}</span>
                <span className="text-3xl md:text-4xl font-light tracking-tight font-mono">
                  {weather.temperature}{weather.unit}
                </span>
              </div>
              <div className="text-slate-300 text-xs md:text-sm mt-0.5 font-normal flex items-center gap-1.5">
                <span>{weather.condition}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-400">{weather.city || settings.weather_city}</span>
              </div>
              {/* Compact 3-Day Forecast Strip */}
              {weather.forecast && weather.forecast.length > 0 && (
                <div className="flex items-center gap-3 mt-2 pt-2 border-t border-white/15">
                  {weather.forecast.map((f, idx) => (
                    <div key={idx} className="flex flex-col items-center text-xs text-slate-300">
                      <span className="font-semibold text-white text-[11px]">{f.day}</span>
                      <span className="text-sm my-0.5">{f.icon}</span>
                      <span className="font-mono text-slate-400 text-[10px]">{f.high}°/{f.low}°</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* CENTER: User Reflection Zone with "WELCOME " -> Greeting Message -> Vanishes after 20s (Both aligned in the middle) */}
        <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center pointer-events-none py-2 min-h-[140px] text-center">
          {greetingStage === 'welcome' && (
            <div className="flex flex-col items-center justify-center text-center animate-fade-in transition-all duration-700">
              {/* Aligned in middle: "WELCOME " */}
              <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-light tracking-[0.28em] text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.45)] uppercase">
                WELCOME
              </div>
            </div>
          )}

          {greetingStage === 'greeting' && (
            <div className="flex flex-col items-center justify-center text-center animate-fade-in transition-all duration-700">
              {/* Greeting that changes according to the time, followed by comma, aligned in middle */}
              <div className="text-sm md:text-base font-light tracking-[0.25em] text-white/70 uppercase">
                {dynamicGreeting}
              </div>
              {/* User Name directly underneath greeting, aligned in middle (no text underneath) */}
              <div className="text-2xl md:text-3xl lg:text-4xl font-medium tracking-wide text-white mt-1 drop-shadow-[0_0_25px_rgba(255,255,255,0.3)]">
                {settings.user_name || 'Alex'}
              </div>
            </div>
          )}

          {greetingStage === 'vanished' && (
            /* Vanished completely after 20 seconds so user can view body properly */
            <div className="w-full h-full flex items-center justify-center opacity-0 transition-opacity duration-1000" aria-hidden="true" />
          )}
        </div>

        {/* BOTTOM LEFT: CALENDAR & REMINDER WIDGETS PUSHED TO THE FAR EDGE (Independently Toggleable) */}
        <div className="flex flex-col justify-end items-start w-full max-w-[310px] lg:max-w-[330px] space-y-2.5">
          
          {/* 1. INDEPENDENT CALENDAR WIDGET */}
          {showCalendar ? (
            <div className="w-full bg-black/85 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-xl shadow-black/90 overflow-hidden box-border">
              <div className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2 flex items-center justify-between pb-1.5 border-b border-white/10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Calendar className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                  <span className="truncate">Upcoming Events</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {upcomingEvents.length}
                  </span>
                  {/* Close Calendar Widget Button */}
                  <button
                    onClick={() => handleToggleCalendar(false)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                    title="Close Calendar to clear body reflection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-28 overflow-y-auto overflow-x-hidden pr-0.5 text-xs">
                {upcomingEvents.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-1">No scheduled events</div>
                ) : (
                  upcomingEvents.map(evt => (
                    <div key={`evt-${evt.id}`} className="flex items-center gap-2 text-xs min-w-0 w-full overflow-hidden">
                      <span className="font-mono font-medium text-sky-400 min-w-[42px] shrink-0 text-[11px]">
                        {evt.start_time}
                      </span>
                      <span className="text-white font-normal truncate min-w-0 flex-1 block" title={evt.title}>
                        {evt.title}
                      </span>
                      {evt.location && (
                        <span className="text-[10px] text-slate-400 truncate max-w-[70px] shrink-0" title={evt.location}>
                          {evt.location}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Minimal Edge Pill when Calendar is Closed */
            <button
              onClick={() => handleToggleCalendar(true)}
              className="px-2.5 py-1 bg-black/70 hover:bg-black/95 text-slate-400 hover:text-white border border-white/20 rounded-xl text-[11px] flex items-center gap-1.5 transition-all cursor-pointer pointer-events-auto shadow-lg"
              title="Click to show Calendar"
            >
              <Calendar className="w-3 h-3 text-sky-400" />
              <span>Show Calendar</span>
            </button>
          )}

          {/* 2. INDEPENDENT REMINDERS WIDGET */}
          {showReminders ? (
            <div className="w-full bg-black/85 backdrop-blur-md border border-white/20 rounded-2xl p-3 shadow-xl shadow-black/90 overflow-hidden box-border">
              <div className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2 flex items-center justify-between pb-1.5 border-b border-white/10">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Bell className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span className="truncate">Reminders</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-[10px] text-slate-500 font-mono">
                    {activeReminders.length}
                  </span>
                  {/* Close Reminders Widget Button */}
                  <button
                    onClick={() => handleToggleReminders(false)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                    title="Close Reminders to clear body reflection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 max-h-24 overflow-y-auto overflow-x-hidden pr-0.5 text-xs">
                {activeReminders.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-1">No active reminders</div>
                ) : (
                  activeReminders.map(rem => (
                    <div key={`rem-${rem.id}`} className="flex items-center gap-2 text-xs min-w-0 w-full overflow-hidden">
                      <span className="font-mono font-medium text-amber-400 min-w-[42px] shrink-0 text-[11px]">
                        {rem.reminder_time}
                      </span>
                      <span className="text-slate-200 font-normal truncate min-w-0 flex-1 block" title={rem.title}>
                        {rem.title}
                      </span>
                      {rem.repeat_type !== 'none' && (
                        <span className="text-[8px] font-mono uppercase tracking-wider px-1 py-0.5 rounded border border-white/20 text-slate-300 shrink-0">
                          {rem.repeat_type}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          ) : (
            /* Minimal Edge Pill when Reminders is Closed */
            <button
              onClick={() => handleToggleReminders(true)}
              className="px-2.5 py-1 bg-black/70 hover:bg-black/95 text-slate-400 hover:text-white border border-white/20 rounded-xl text-[11px] flex items-center gap-1.5 transition-all cursor-pointer pointer-events-auto shadow-lg"
              title="Click to show Reminders"
            >
              <Bell className="w-3 h-3 text-amber-400" />
              <span>Show Reminders</span>
            </button>
          )}

        </div>

        {/* BOTTOM RIGHT: TO-DO TASKS PUSHED TO THE FAR EDGE (Independently Toggleable) */}
        <div className="flex flex-col justify-end items-start md:items-end text-left md:text-right w-full max-w-[280px] lg:max-w-[300px] ml-auto">
          {showTodos ? (
            /* Framed Contained Box Hugging the Right Edge */
            <div className="w-full bg-black/85 backdrop-blur-md border border-white/20 rounded-2xl p-3.5 shadow-xl shadow-black/90 overflow-hidden box-border">
              <div className="text-xs font-semibold tracking-widest uppercase text-slate-400 mb-2 flex items-center justify-between pb-1.5 border-b border-white/10">
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Close To-Do List Button */}
                  <button
                    onClick={() => handleToggleTodos(false)}
                    className="p-1 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors cursor-pointer"
                    title="Close To-Do list to see reflection"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <span className="text-[10px] text-slate-500 font-mono">
                    {pendingTodos.length} left
                  </span>
                </div>
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="truncate">To-Do</span>
                  <CheckSquare className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                </div>
              </div>

              <div className="space-y-1.5 max-h-36 overflow-y-auto overflow-x-hidden pr-0.5 text-xs">
                {pendingTodos.length === 0 && completedTodos.length === 0 ? (
                  <div className="text-xs text-slate-500 italic py-1">All tasks completed</div>
                ) : (
                  <>
                    {/* Pending Tasks */}
                    {pendingTodos.map(todo => (
                      <div key={todo.id} className="flex items-center md:justify-end gap-2 text-xs text-white min-w-0 w-full overflow-hidden">
                        <span className="truncate min-w-0 flex-1 md:flex-initial">{todo.task}</span>
                        <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      </div>
                    ))}

                    {/* Completed Tasks */}
                    {completedTodos.map(todo => (
                      <div
                        key={todo.id}
                        className="flex items-center md:justify-end gap-2 text-xs text-slate-500 line-through opacity-65 min-w-0 w-full overflow-hidden"
                        title="Completed task"
                      >
                        <span className="truncate min-w-0 flex-1 md:flex-initial">{todo.task}</span>
                        <span className="text-[10px] text-emerald-400 font-mono shrink-0">✓</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          ) : (
            /* Minimal Edge Tab when To-Do is Closed */
            <button
              onClick={() => handleToggleTodos(true)}
              className="px-2.5 py-1.5 bg-black/70 hover:bg-black/95 text-slate-400 hover:text-white border border-white/20 rounded-xl text-[11px] flex items-center gap-1.5 transition-all mb-1 cursor-pointer pointer-events-auto shadow-lg"
              title="Click to reopen To-Do List"
            >
              <CheckSquare className="w-3.5 h-3.5 text-emerald-400" />
              <span>Show Tasks</span>
            </button>
          )}
        </div>

      </div>

      {/* BOTTOM TICKER: LOCAL NEWS & TRAFFIC BULLETINS */}
      <div className="relative z-30 w-full h-11 bg-black/90 border-t border-white/20 flex items-center px-4 md:px-6 overflow-hidden">
        <div className="shrink-0 text-xs font-semibold uppercase tracking-widest text-sky-400 flex items-center gap-2 mr-4 md:mr-6">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse" />
          <span className="font-mono text-[11px] md:text-xs text-white">Bulletins</span>
        </div>
        <div className="relative overflow-hidden w-full">
          {isSimulatedOffline ? (
            <div className="text-xs text-slate-400 italic">
              [OFFLINE BULLETIN] SmartMirror running local offline mode • LAN Active • Open-Meteo &amp; RSS queued
            </div>
          ) : (
            <div className="flex items-center whitespace-nowrap animate-marquee">
              {bulletinItems.concat(bulletinItems).map((item, i) => (
                <span key={i} className="text-xs md:text-sm text-slate-200 mr-8 flex items-center">
                  <span className="font-medium text-white">{item}</span>
                  <span className="mx-4 text-sky-500 font-bold">•</span>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
