import React, { useState, useEffect } from 'react';
import { CalendarEvent, Reminder, TodoItem, MirrorSettings, WeatherData } from '../types';
import { GoogleMapsAgent } from './GoogleMapsAgent';
import { GeminiVoiceAgent } from './GeminiVoiceAgent';
import { geocodeCityCountry } from '../storage';
import {
  Calendar,
  CheckSquare,
  Clock,
  Settings,
  Lock,
  Unlock,
  Volume2,
  Trash2,
  Plus,
  ExternalLink,
  ShieldAlert,
  Moon,
  Info,
  Check,
  Bell,
  Edit2,
  X,
  Compass,
  Sparkles,
  MapPin,
  Sun,
  Monitor,
  Power
} from 'lucide-react';

interface PhoneControlPanelProps {
  events: CalendarEvent[];
  reminders: Reminder[];
  todos: TodoItem[];
  settings: MirrorSettings;
  weather: WeatherData;
  mapsApiKey: string;
  onAddEvent: (event: Omit<CalendarEvent, 'id'>) => void;
  onUpdateEvent: (id: number, updated: Omit<CalendarEvent, 'id'>) => void;
  onDeleteEvent: (id: number) => void;
  onAddReminder: (reminder: Omit<Reminder, 'id'>) => void;
  onDeleteReminder: (id: number) => void;
  onAddTodo: (task: string) => void;
  onToggleTodo: (id: number) => void;
  onUpdateTodo: (id: number, task: string) => void;
  onDeleteTodo: (id: number) => void;
  onUpdateSettings: (newSettings: Partial<MirrorSettings>) => void;
  onChangePin: (oldPin: string, newPin: string) => boolean;
  onOpenMirrorView: () => void;
  onUpdateCommuteHeadline: (headline: string) => void;
}

export const PhoneControlPanel: React.FC<PhoneControlPanelProps> = ({
  events,
  reminders,
  todos,
  settings,
  weather,
  mapsApiKey,
  onAddEvent,
  onUpdateEvent,
  onDeleteEvent,
  onAddReminder,
  onDeleteReminder,
  onAddTodo,
  onToggleTodo,
  onUpdateTodo,
  onDeleteTodo,
  onUpdateSettings,
  onChangePin,
  onOpenMirrorView,
  onUpdateCommuteHeadline
}) => {
  // Navigation
  const [activeTab, setActiveTab] = useState<'overview' | 'calendar' | 'tasks' | 'maps' | 'voice' | 'settings'>('overview');

  // Security / PIN Lock
  const [isUnlocked, setIsUnlocked] = useState<boolean>(true);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  // --- Calendar Form State ---
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventStart, setEventStart] = useState('09:00');
  const [eventEnd, setEventEnd] = useState('10:00');
  const [eventLocation, setEventLocation] = useState('');
  const [eventNotes, setEventNotes] = useState('');

  // --- Todo Form & Inline Edit State ---
  const [todoText, setTodoText] = useState('');
  const [editingTodoId, setEditingTodoId] = useState<number | null>(null);
  const [editingTodoText, setEditingTodoText] = useState('');

  // --- Reminders Form State ---
  const [remTitle, setRemTitle] = useState('');
  const [remTime, setRemTime] = useState('08:00');
  const [remRepeat, setRemRepeat] = useState<'none' | 'daily' | 'weekly'>('none');
  const [remDay, setRemDay] = useState<number>(1);

  // --- Settings Form State ---
  const [greeting, setGreeting] = useState(settings.greeting);
  const [userName, setUserName] = useState(settings.user_name || 'Alex');
  const [cityCountryInput, setCityCountryInput] = useState(settings.weather_city || 'Seattle, US');
  const [lat, setLat] = useState(String(settings.weather_lat));
  const [lon, setLon] = useState(String(settings.weather_lon));
  const [units, setUnits] = useState<'fahrenheit' | 'celsius'>(settings.weather_units);
  const [newsUrl, setNewsUrl] = useState(settings.news_feed_url);
  const [isCanvasLit, setIsCanvasLit] = useState(settings.is_canvas_lit);
  const [dimEnabled, setDimEnabled] = useState(settings.night_dim_enabled);
  const [dimStart, setDimStart] = useState(String(settings.night_dim_start));
  const [dimEnd, setDimEnd] = useState(String(settings.night_dim_end));
  const [dimOpacity, setDimOpacity] = useState(String(settings.night_dim_opacity));
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [showCalendarWidget, setShowCalendarWidget] = useState<boolean>(settings.show_calendar_widget ?? true);
  const [showRemindersWidget, setShowRemindersWidget] = useState<boolean>(settings.show_reminders_widget ?? true);
  const [showTodosWidget, setShowTodosWidget] = useState<boolean>(settings.show_todos_widget ?? true);
  const [isPowerOn, setIsPowerOn] = useState<boolean>(settings.is_power_on ?? true);

  useEffect(() => {
    setShowCalendarWidget(settings.show_calendar_widget ?? true);
  }, [settings.show_calendar_widget]);

  useEffect(() => {
    setShowRemindersWidget(settings.show_reminders_widget ?? true);
  }, [settings.show_reminders_widget]);

  useEffect(() => {
    setShowTodosWidget(settings.show_todos_widget ?? true);
  }, [settings.show_todos_widget]);

  useEffect(() => {
    setIsPowerOn(settings.is_power_on ?? true);
  }, [settings.is_power_on]);

  // Change PIN states
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // PIN Unlock Check
  const handleKeypadPress = (val: string) => {
    setPinError('');
    if (val === 'clear') {
      setPinInput('');
    } else if (val === 'enter') {
      if (pinInput === settings.pin_code) {
        setIsUnlocked(true);
        setPinInput('');
        showToast('SmartMirror unlocked');
      } else {
        setPinError('Incorrect PIN. Default is 1234.');
        setPinInput('');
      }
    } else {
      if (pinInput.length < 6) {
        setPinInput(prev => prev + val);
      }
    }
  };

  // Input Validation for Date & Time
  const validateDateTime = (dateStr: string, startTimeStr: string, endTimeStr?: string): string | null => {
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateStr)) {
      return 'Date must be in YYYY-MM-DD format (e.g. 2026-10-17).';
    }

    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(startTimeStr)) {
      return 'Start time must be in HH:MM 24-hr format (e.g. 09:30).';
    }

    if (endTimeStr && endTimeStr.trim()) {
      if (!timeRegex.test(endTimeStr)) {
        return 'End time must be in HH:MM format.';
      }
      if (endTimeStr < startTimeStr) {
        return 'End time cannot be earlier than start time.';
      }
    }

    return null;
  };

  // Add or Update Calendar Event
  const handleSaveCalendarEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) {
      showToast('Event title is required', 'error');
      return;
    }

    const errorMsg = validateDateTime(eventDate, eventStart, eventEnd);
    if (errorMsg) {
      showToast(errorMsg, 'error');
      return;
    }

    if (editingEventId !== null) {
      // Edit existing event
      onUpdateEvent(editingEventId, {
        title: eventTitle.trim(),
        event_date: eventDate,
        start_time: eventStart,
        end_time: eventEnd || undefined,
        location: eventLocation.trim() || undefined,
        notes: eventNotes.trim() || undefined
      });
      setEditingEventId(null);
      showToast('Event updated successfully');
    } else {
      // Add new event
      onAddEvent({
        title: eventTitle.trim(),
        event_date: eventDate,
        start_time: eventStart,
        end_time: eventEnd || undefined,
        location: eventLocation.trim() || undefined,
        notes: eventNotes.trim() || undefined
      });
      showToast('Calendar event added');
    }

    // Reset Form
    setEventTitle('');
    setEventLocation('');
    setEventNotes('');
  };

  // Start Editing an Existing Event
  const handleStartEditEvent = (evt: CalendarEvent) => {
    setEditingEventId(evt.id);
    setEventTitle(evt.title);
    setEventDate(evt.event_date);
    setEventStart(evt.start_time);
    setEventEnd(evt.end_time || '');
    setEventLocation(evt.location || '');
    setEventNotes(evt.notes || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEditEvent = () => {
    setEditingEventId(null);
    setEventTitle('');
    setEventLocation('');
    setEventNotes('');
  };

  // Add Reminder
  const handleAddReminder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) {
      showToast('Reminder title is required', 'error');
      return;
    }
    onAddReminder({
      title: remTitle.trim(),
      reminder_time: remTime,
      repeat_type: remRepeat,
      repeat_day: remRepeat === 'weekly' ? remDay : undefined,
      is_active: true
    });
    setRemTitle('');
    showToast('Reminder saved');
  };

  // Save Settings & Geocode City/Country
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGeocoding(true);

    let resolvedLat = parseFloat(lat) || 0;
    let resolvedLon = parseFloat(lon) || 0;
    let formattedCity = cityCountryInput.trim();

    // Auto-geocode city & country query if provided
    if (cityCountryInput.trim()) {
      const geoResult = await geocodeCityCountry(cityCountryInput.trim());
      if (geoResult) {
        resolvedLat = geoResult.lat;
        resolvedLon = geoResult.lon;
        formattedCity = geoResult.formatted;
        setLat(String(resolvedLat));
        setLon(String(resolvedLon));
        setCityCountryInput(formattedCity);
      } else {
        showToast(`Could not resolve location "${cityCountryInput}". Keeping existing coordinates.`, 'error');
      }
    }

    onUpdateSettings({
      greeting: greeting.trim(),
      user_name: userName.trim(),
      weather_city: formattedCity,
      weather_lat: resolvedLat,
      weather_lon: resolvedLon,
      weather_units: units,
      news_feed_url: newsUrl.trim(),
      is_canvas_lit: isCanvasLit,
      night_dim_enabled: dimEnabled,
      night_dim_start: parseInt(dimStart, 10) || 22,
      night_dim_end: parseInt(dimEnd, 10) || 7,
      night_dim_opacity: parseFloat(dimOpacity) || 0.35,
      show_schedule_widget: showCalendarWidget || showRemindersWidget,
      show_calendar_widget: showCalendarWidget,
      show_reminders_widget: showRemindersWidget,
      show_todos_widget: showTodosWidget,
      is_power_on: isPowerOn
    });

    setIsGeocoding(false);
    showToast('Settings saved to local SQLite');
  };

  // Change PIN handler
  const handleChangePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin !== confirmPin) {
      showToast('New PIN does not match confirmation', 'error');
      return;
    }
    if (newPin.length < 4) {
      showToast('PIN must be at least 4 digits', 'error');
      return;
    }
    const success = onChangePin(currentPin, newPin);
    if (success) {
      showToast('Access PIN changed successfully');
      setCurrentPin('');
      setNewPin('');
      setConfirmPin('');
    } else {
      showToast('Current PIN is incorrect', 'error');
    }
  };

  return (
    <div className="w-full max-w-md mx-auto bg-slate-900 min-h-screen text-slate-100 flex flex-col font-sans border-x border-slate-800 shadow-2xl relative pb-20">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-lg text-sm font-medium shadow-lg transition-all ${
            toastMessage.type === 'error' ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toastMessage.text}
        </div>
      )}

      {/* Top Mobile App Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3 flex items-center justify-between">
        <div>
          <h1 className="text-base font-bold tracking-tight text-white flex items-center gap-2">
            <span>SmartMirror</span>
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
              Pi 2 LAN
            </span>
          </h1>
          <p className="text-xs text-slate-400">Phone Remote &amp; Control Hub</p>
        </div>

        <div className="flex items-center gap-2">
          {/* Mirror Power Toggle */}
          <button
            onClick={() => {
              const nextPower = !isPowerOn;
              setIsPowerOn(nextPower);
              onUpdateSettings({ is_power_on: nextPower });
              showToast(nextPower ? 'SmartMirror powered ON' : 'SmartMirror powered OFF ("Have a great day!")');
            }}
            className={`p-2 rounded-md border text-xs transition-colors cursor-pointer ${
              isPowerOn
                ? 'bg-emerald-950/70 border-emerald-800 text-emerald-400 hover:bg-emerald-900/60'
                : 'bg-red-950/80 border-red-800 text-red-400 hover:bg-red-900/60'
            }`}
            title={isPowerOn ? "Turn SmartMirror OFF (Displays 'Have a great day!')" : "Turn SmartMirror ON"}
          >
            <Power className="w-4 h-4" />
          </button>

          <button
            onClick={onOpenMirrorView}
            className="px-3 py-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 border border-slate-700 flex items-center gap-1.5 transition-colors"
            title="Preview Mirror in 16:9 view"
          >
            <span>Mirror</span>
            <ExternalLink className="w-3 h-3 text-sky-400" />
          </button>

          <button
            onClick={() => setIsUnlocked(prev => !prev)}
            className={`p-2 rounded-md border text-xs transition-colors ${
              isUnlocked ? 'bg-slate-800 border-slate-700 text-slate-300' : 'bg-amber-950 border-amber-800 text-amber-400'
            }`}
            title={isUnlocked ? 'Lock Controller' : 'Unlock Controller'}
          >
            {isUnlocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
          </button>
        </div>
      </header>

      {/* PIN LOCK OVERLAY */}
      {!isUnlocked && (
        <div className="p-6 my-auto flex flex-col items-center justify-center text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-800/80 border border-slate-700 flex items-center justify-center mb-4 text-sky-400">
            <Lock className="w-7 h-7" />
          </div>
          <h2 className="text-lg font-bold text-white">SmartMirror Locked</h2>
          <p className="text-xs text-slate-400 mt-1 max-w-xs">
            Enter your 4-digit access code to manage schedules, to-dos, or settings. Default PIN: <strong className="text-sky-400">1234</strong>
          </p>

          <div className="my-5 w-40 h-12 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-center text-2xl font-mono tracking-widest text-white">
            {'•'.repeat(pinInput.length) || <span className="text-xs text-slate-600 font-sans tracking-normal">Enter PIN</span>}
          </div>

          {pinError && (
            <p className="text-xs text-red-400 mb-3">{pinError}</p>
          )}

          {/* Keypad */}
          <div className="grid grid-cols-3 gap-2.5 w-64">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(num => (
              <button
                key={num}
                onClick={() => handleKeypadPress(num)}
                className="h-12 bg-slate-800 hover:bg-slate-700 active:scale-95 text-lg font-semibold rounded-lg border border-slate-700 transition-all"
              >
                {num}
              </button>
            ))}
            <button
              onClick={() => handleKeypadPress('clear')}
              className="h-12 bg-slate-900 hover:bg-slate-800 active:scale-95 text-xs font-semibold text-red-400 rounded-lg border border-slate-800 transition-all"
            >
              Clear
            </button>
            <button
              onClick={() => handleKeypadPress('0')}
              className="h-12 bg-slate-800 hover:bg-slate-700 active:scale-95 text-lg font-semibold rounded-lg border border-slate-700 transition-all"
            >
              0
            </button>
            <button
              onClick={() => handleKeypadPress('enter')}
              className="h-12 bg-sky-600 hover:bg-sky-500 active:scale-95 text-xs font-bold text-white rounded-lg transition-all"
            >
              Unlock
            </button>
          </div>
        </div>
      )}

      {/* MAIN UNLOCKED CONTENT */}
      {isUnlocked && (
        <main className="flex-1 p-4 space-y-4">
          
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'overview' && (
            <div className="space-y-4">
              
              {/* Quick Status Card */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-semibold text-white">SmartMirror Online</h2>
                  <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/80 border border-emerald-800/60 px-2 py-0.5 rounded">
                    SQLite Local
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed">
                  Welcome, <strong className="text-white">{settings.user_name || 'Alex'}</strong>! Schedule, to-dos, and settings are actively stored in SQLite and synced to your 18.5" mirror.
                </p>

                <div className="mt-3 pt-3 border-t border-slate-700/60 flex items-center justify-between text-xs text-slate-400">
                  <span>Weather: <strong className="text-white">{weather.temperature}{weather.unit} ({weather.city})</strong></span>
                  <span>Tasks: <strong className="text-white font-mono">{todos.filter(t => !t.is_completed).length} pending</strong></span>
                </div>
              </div>

              {/* Quick Shortcut Buttons */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setActiveTab('maps')}
                  className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition-colors"
                >
                  <Compass className="w-5 h-5 text-sky-400 mb-1" />
                  <div className="text-xs font-bold text-white">Google Maps Agent</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Live routes &amp; traffic ETA</div>
                </button>

                <button
                  onClick={() => setActiveTab('voice')}
                  className="p-3 bg-slate-800/80 hover:bg-slate-800 border border-slate-700 rounded-xl text-left transition-colors"
                >
                  <Sparkles className="w-5 h-5 text-purple-400 mb-1" />
                  <div className="text-xs font-bold text-white">Gemini Voice Chat</div>
                  <div className="text-[10px] text-slate-400 mt-0.5">Talk to your mirror</div>
                </button>
              </div>

              {/* Quick Mirror Reflection Space & Corner Widgets Controls */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5 text-sky-400" />
                    <span>Mirror Reflection Space</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">Edge Widgets</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Close corner widgets whenever you want an unobstructed view of your full outfit and body reflection:
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1">
                  {/* Calendar Widget Quick Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showCalendarWidget;
                      setShowCalendarWidget(next);
                      onUpdateSettings({ show_calendar_widget: next });
                      showToast(next ? 'Calendar shown on mirror' : 'Calendar hidden');
                    }}
                    className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-between text-center gap-1 transition-colors ${
                      showCalendarWidget
                        ? 'bg-sky-950/70 border-sky-800 text-sky-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="truncate text-[11px]">Calendar</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 shrink-0">
                      {showCalendarWidget ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* Reminders Widget Quick Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showRemindersWidget;
                      setShowRemindersWidget(next);
                      onUpdateSettings({ show_reminders_widget: next });
                      showToast(next ? 'Reminders shown on mirror' : 'Reminders hidden');
                    }}
                    className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-between text-center gap-1 transition-colors ${
                      showRemindersWidget
                        ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="truncate text-[11px]">Reminders</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 shrink-0">
                      {showRemindersWidget ? 'ON' : 'OFF'}
                    </span>
                  </button>

                  {/* To-Do Widget Quick Toggle */}
                  <button
                    type="button"
                    onClick={() => {
                      const next = !showTodosWidget;
                      setShowTodosWidget(next);
                      onUpdateSettings({ show_todos_widget: next });
                      showToast(next ? 'To-Do shown on mirror' : 'To-Do hidden');
                    }}
                    className={`p-2 rounded-xl border text-xs font-semibold flex flex-col items-center justify-between text-center gap-1 transition-colors ${
                      showTodosWidget
                        ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-500'
                    }`}
                  >
                    <span className="truncate text-[11px]">To-Do List</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 shrink-0">
                      {showTodosWidget ? 'ON' : 'OFF'}
                    </span>
                  </button>
                </div>
              </div>

              {/* Reminders Quick Box */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-amber-400" />
                    <span>Active Reminders</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-mono">{reminders.length} total</span>
                </div>

                {reminders.length === 0 ? (
                  <p className="text-xs text-slate-500 py-2">No active reminders.</p>
                ) : (
                  reminders.map(rem => (
                    <div key={rem.id} className="p-2.5 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-white font-medium">{rem.title}</span>
                        <span className="text-amber-400 font-mono ml-2">({rem.reminder_time})</span>
                      </div>
                      <button
                        onClick={() => onDeleteReminder(rem.id)}
                        className="text-slate-500 hover:text-red-400"
                        title="Delete reminder"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>

            </div>
          )}

          {/* TAB 2: CALENDAR SCHEDULE (With Add, Edit & Delete) */}
          {activeTab === 'calendar' && (
            <div className="space-y-4">
              
              {/* Event Add/Edit Form */}
              <form onSubmit={handleSaveCalendarEvent} className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-sky-400" />
                    <span>{editingEventId !== null ? 'Edit Calendar Event' : 'Add Calendar Event'}</span>
                  </h2>
                  {editingEventId !== null && (
                    <button
                      type="button"
                      onClick={handleCancelEditEvent}
                      className="text-xs text-slate-400 hover:text-white flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" />
                      <span>Cancel</span>
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Event Title *</label>
                  <input
                    type="text"
                    value={eventTitle}
                    onChange={e => setEventTitle(e.target.value)}
                    placeholder="e.g. Science Fair Presentation"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                    required
                    maxLength={100}
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Date (YYYY-MM-DD) *</label>
                    <input
                      type="date"
                      value={eventDate}
                      onChange={e => setEventDate(e.target.value)}
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Start Time (HH:MM) *</label>
                    <input
                      type="time"
                      value={eventStart}
                      onChange={e => setEventStart(e.target.value)}
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">End Time (Optional)</label>
                    <input
                      type="time"
                      value={eventEnd}
                      onChange={e => setEventEnd(e.target.value)}
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Location / Room</label>
                    <input
                      type="text"
                      value={eventLocation}
                      onChange={e => setEventLocation(e.target.value)}
                      placeholder="e.g. Lab 204"
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                      maxLength={60}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Notes (Optional)</label>
                  <input
                    type="text"
                    value={eventNotes}
                    onChange={e => setEventNotes(e.target.value)}
                    placeholder="e.g. Bring HDMI cable"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                    maxLength={140}
                  />
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] bg-sky-600 hover:bg-sky-500 active:scale-[0.98] rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 transition-all mt-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingEventId !== null ? 'Save Changes to SQLite' : 'Add Event to Mirror'}</span>
                </button>
              </form>

              {/* Event List with Edit and Delete Actions */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                  Calendar Schedule ({events.length})
                </h3>
                {events.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No events scheduled. Add one above!</p>
                ) : (
                  events.map(evt => (
                    <div
                      key={evt.id}
                      className={`p-3 bg-slate-950 rounded-lg border transition-colors flex items-center justify-between gap-3 ${
                        editingEventId === evt.id ? 'border-sky-500 ring-1 ring-sky-500/50' : 'border-slate-800'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-white truncate">{evt.title}</div>
                        <div className="text-xs text-slate-400 mt-0.5 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sky-400">{evt.event_date}</span>
                          <span>{evt.start_time}{evt.end_time ? ` - ${evt.end_time}` : ''}</span>
                          {evt.location && <span className="text-slate-500">• {evt.location}</span>}
                        </div>
                        {evt.notes && <div className="text-[11px] text-slate-500 italic mt-0.5">{evt.notes}</div>}
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleStartEditEvent(evt)}
                          className="p-2 text-slate-400 hover:text-sky-400 active:scale-95 transition-colors"
                          title="Edit Event"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => onDeleteEvent(evt.id)}
                          className="p-2 text-slate-400 hover:text-red-400 active:scale-95 transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 3: TO-DO TASKS (Add, Edit, Complete, Delete) */}
          {activeTab === 'tasks' && (
            <div className="space-y-4">
              
              {/* Quick Add Form */}
              <form
                onSubmit={e => {
                  e.preventDefault();
                  if (!todoText.trim()) return;
                  onAddTodo(todoText.trim());
                  setTodoText('');
                  showToast('Task added');
                }}
                className="flex gap-2"
              >
                <input
                  type="text"
                  value={todoText}
                  onChange={e => setTodoText(e.target.value)}
                  placeholder="What needs to be done?"
                  className="flex-1 min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  required
                />
                <button
                  type="submit"
                  className="min-h-[44px] px-4 bg-sky-600 hover:bg-sky-500 active:scale-[0.98] rounded-lg text-sm font-semibold text-white flex items-center justify-center shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </form>

              {/* Tasks List */}
              <div className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    Tasks List
                  </h3>
                  <span className="text-xs text-slate-500">
                    {todos.filter(t => t.is_completed).length} / {todos.length} done
                  </span>
                </div>

                {todos.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">No tasks yet. Add one above!</p>
                ) : (
                  todos.map(todo => (
                    <div
                      key={todo.id}
                      className={`p-3 bg-slate-950 rounded-lg border border-slate-800 flex items-center justify-between gap-2.5 transition-all ${
                        todo.is_completed ? 'opacity-50' : ''
                      }`}
                    >
                      <label className="flex items-center gap-3 cursor-pointer min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={todo.is_completed}
                          onChange={() => onToggleTodo(todo.id)}
                          className="w-5 h-5 rounded border-slate-700 accent-sky-500 cursor-pointer shrink-0"
                        />
                        {editingTodoId === todo.id ? (
                          <input
                            type="text"
                            value={editingTodoText}
                            onChange={e => setEditingTodoText(e.target.value)}
                            onBlur={() => {
                              if (editingTodoText.trim()) onUpdateTodo(todo.id, editingTodoText.trim());
                              setEditingTodoId(null);
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                if (editingTodoText.trim()) onUpdateTodo(todo.id, editingTodoText.trim());
                                setEditingTodoId(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 bg-slate-900 border border-sky-500 rounded px-2 py-1 text-sm text-white"
                          />
                        ) : (
                          <span className={`text-sm text-white truncate ${todo.is_completed ? 'line-through text-slate-400' : ''}`}>
                            {todo.task}
                          </span>
                        )}
                      </label>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => {
                            setEditingTodoId(todo.id);
                            setEditingTodoText(todo.task);
                          }}
                          className="p-1.5 text-slate-500 hover:text-sky-400 transition-colors"
                          title="Edit Task"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteTodo(todo.id)}
                          className="p-1.5 text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete Task"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* TAB 4: GOOGLE MAPS REAL-TIME AGENT */}
          {activeTab === 'maps' && (
            <GoogleMapsAgent
              apiKey={mapsApiKey}
              commuteOrigin={settings.commute_origin}
              commuteDestination={settings.commute_destination}
              onUpdateCommuteHeadline={onUpdateCommuteHeadline}
            />
          )}

          {/* TAB 5: GEMINI VOICE CONVERSATIONS */}
          {activeTab === 'voice' && (
            <GeminiVoiceAgent
              userName={settings.user_name}
              weather={weather}
              events={events}
              todos={todos}
              onAddTask={onAddTodo}
              onAddEvent={onAddEvent}
            />
          )}

          {/* TAB 6: SETTINGS & LOCATION CONFIGURATION */}
          {activeTab === 'settings' && (
            <div className="space-y-4">
              
              {/* Mirror Customization Form */}
              <form onSubmit={handleSaveSettings} className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
                <h2 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Settings className="w-4 h-4 text-sky-400" />
                  <span>SmartMirror Settings</span>
                </h2>

                {/* User Name (Mentioned underneath Good Morning) */}
                <div>
                  <label className="block text-xs text-slate-400 mb-1">User Name (Shown Underneath Greeting) *</label>
                  <input
                    type="text"
                    value={userName}
                    onChange={e => setUserName(e.target.value)}
                    placeholder="e.g. Alex, Maya, or Family"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                    required
                    maxLength={30}
                  />
                  <small className="text-[11px] text-slate-500 mt-0.5 block">
                    Displays right beneath "Good morning" on the mirror display.
                  </small>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Greeting Text</label>
                  <input
                    type="text"
                    value={greeting}
                    onChange={e => setGreeting(e.target.value)}
                    placeholder="e.g. Good morning"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                    maxLength={40}
                  />
                </div>

                {/* Weather Location (City and Country) */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white">
                    <MapPin className="w-3.5 h-3.5 text-sky-400" />
                    <span>Weather Location (City &amp; Country)</span>
                  </div>
                  <div>
                    <input
                      type="text"
                      value={cityCountryInput}
                      onChange={e => setCityCountryInput(e.target.value)}
                      placeholder="e.g. Seattle, US or London, UK"
                      className="w-full min-h-[44px] bg-slate-900 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                      required
                    />
                    <small className="text-[11px] text-slate-400 mt-1 block">
                      Type any city and country. Saving automatically geocodes coordinates for live forecast.
                    </small>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div>
                      <label className="block text-[10px] text-slate-500">Resolved Lat</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={lat}
                        onChange={e => setLat(e.target.value)}
                        className="w-full h-8 bg-slate-900 border border-slate-800 rounded px-2 text-xs font-mono text-slate-300"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-500">Resolved Lon</label>
                      <input
                        type="number"
                        step="0.0001"
                        value={lon}
                        onChange={e => setLon(e.target.value)}
                        className="w-full h-8 bg-slate-900 border border-slate-800 rounded px-2 text-xs font-mono text-slate-300"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Temperature Unit</label>
                  <select
                    value={units}
                    onChange={e => setUnits(e.target.value as any)}
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                  >
                    <option value="fahrenheit">Fahrenheit (°F)</option>
                    <option value="celsius">Celsius (°C)</option>
                  </select>
                </div>

                {/* Lit Canvas / Ambient Backlight Toggle */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Sun className="w-3.5 h-3.5 text-amber-400" />
                      <span>Illuminated Smart Mirror Canvas</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Renders ambient back-lit perimeter aura around the mirror
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isCanvasLit}
                    onChange={e => setIsCanvasLit(e.target.checked)}
                    className="w-5 h-5 rounded border-slate-700 accent-sky-500 cursor-pointer"
                  />
                </div>

                {/* Corner Widgets Visibility (Independent Toggles for Decluttered Body View) */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2.5">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Monitor className="w-3.5 h-3.5 text-sky-400" />
                      <span>Declutter Corner Mirror Widgets</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      Toggle Calendar, Reminders, and To-Do widgets independently to maximize clear mirror glass for body viewing.
                    </div>
                  </div>

                  {/* Independent Calendar Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-xs text-slate-300">Show Calendar Events Widget</span>
                    <input
                      type="checkbox"
                      checked={showCalendarWidget}
                      onChange={e => {
                        setShowCalendarWidget(e.target.checked);
                        onUpdateSettings({ show_calendar_widget: e.target.checked });
                      }}
                      className="w-5 h-5 rounded border-slate-700 accent-sky-500 cursor-pointer"
                    />
                  </div>

                  {/* Independent Reminders Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-xs text-slate-300">Show Reminders Widget</span>
                    <input
                      type="checkbox"
                      checked={showRemindersWidget}
                      onChange={e => {
                        setShowRemindersWidget(e.target.checked);
                        onUpdateSettings({ show_reminders_widget: e.target.checked });
                      }}
                      className="w-5 h-5 rounded border-slate-700 accent-amber-500 cursor-pointer"
                    />
                  </div>

                  {/* Independent To-Do Toggle */}
                  <div className="flex items-center justify-between pt-1 border-t border-slate-800/80">
                    <span className="text-xs text-slate-300">Show To-Do List Widget</span>
                    <input
                      type="checkbox"
                      checked={showTodosWidget}
                      onChange={e => {
                        setShowTodosWidget(e.target.checked);
                        onUpdateSettings({ show_todos_widget: e.target.checked });
                      }}
                      className="w-5 h-5 rounded border-slate-700 accent-emerald-500 cursor-pointer"
                    />
                  </div>
                </div>

                {/* SmartMirror Display Power Switch */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                      <Power className={`w-3.5 h-3.5 ${isPowerOn ? 'text-emerald-400' : 'text-red-400'}`} />
                      <span>SmartMirror Display Power</span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">
                      {isPowerOn ? 'Display active ("WELCOME" → Greeting, vanishes after 20s)' : 'Standby mode: Displays " Have a great day! " in the middle'}
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={isPowerOn}
                    onChange={e => {
                      setIsPowerOn(e.target.checked);
                      onUpdateSettings({ is_power_on: e.target.checked });
                    }}
                    className="w-5 h-5 rounded border-slate-700 accent-emerald-500 cursor-pointer"
                  />
                </div>

                {/* Night Dimming Section */}
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Moon className="w-3.5 h-3.5 text-sky-400" />
                        <span>Night Dimming Mode</span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-0.5">
                        Dims display during sleeping hours
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={dimEnabled}
                      onChange={e => setDimEnabled(e.target.checked)}
                      className="w-5 h-5 rounded border-slate-700 accent-sky-500 cursor-pointer"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">Start Hour (24h)</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={dimStart}
                        onChange={e => setDimStart(e.target.value)}
                        className="w-full h-9 bg-slate-900 border border-slate-700 rounded px-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-400 mb-1">End Hour (24h)</label>
                      <input
                        type="number"
                        min="0"
                        max="23"
                        value={dimEnd}
                        onChange={e => setDimEnd(e.target.value)}
                        className="w-full h-9 bg-slate-900 border border-slate-700 rounded px-2 text-xs text-white"
                      />
                    </div>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isGeocoding}
                  className="w-full min-h-[44px] bg-sky-600 hover:bg-sky-500 active:scale-[0.98] rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-1.5 transition-all mt-4"
                >
                  <Check className="w-4 h-4" />
                  <span>{isGeocoding ? 'Geocoding & Saving...' : 'Save All Settings to SQLite'}</span>
                </button>
              </form>

              {/* Change PIN Card */}
              <form onSubmit={handleChangePinSubmit} className="bg-slate-800/80 border border-slate-700/80 rounded-xl p-4 space-y-3">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span>Change 4-Digit Access PIN</span>
                </h3>

                <div>
                  <label className="block text-xs text-slate-400 mb-1">Current PIN</label>
                  <input
                    type="password"
                    maxLength={8}
                    value={currentPin}
                    onChange={e => setCurrentPin(e.target.value)}
                    placeholder="Current PIN (default: 1234)"
                    className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">New PIN</label>
                    <input
                      type="password"
                      maxLength={8}
                      value={newPin}
                      onChange={e => setNewPin(e.target.value)}
                      placeholder="New PIN (min 4 digits)"
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Confirm New PIN</label>
                    <input
                      type="password"
                      maxLength={8}
                      value={confirmPin}
                      onChange={e => setConfirmPin(e.target.value)}
                      placeholder="Repeat new PIN"
                      className="w-full min-h-[44px] bg-slate-950 border border-slate-700 rounded-lg px-3 text-sm text-white focus:outline-none focus:border-sky-500"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full min-h-[44px] bg-slate-700 hover:bg-slate-600 active:scale-[0.98] rounded-lg text-sm font-medium text-white transition-all"
                >
                  Update Access PIN
                </button>
              </form>

            </div>
          )}

        </main>
      )}

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-slate-900/95 backdrop-blur border-t border-slate-800 grid grid-cols-6 h-16 z-40">
        <button
          onClick={() => setActiveTab('overview')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeTab === 'overview' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Info className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] tracking-tight">Status</span>
        </button>

        <button
          onClick={() => setActiveTab('calendar')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeTab === 'calendar' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Calendar className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] tracking-tight">Events</span>
        </button>

        <button
          onClick={() => setActiveTab('tasks')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeTab === 'tasks' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <CheckSquare className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] tracking-tight">To-Do</span>
        </button>

        <button
          onClick={() => setActiveTab('maps')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeTab === 'maps' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Compass className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] tracking-tight">Maps</span>
        </button>

        <button
          onClick={() => setActiveTab('voice')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeTab === 'voice' ? 'text-purple-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Sparkles className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] tracking-tight">Voice</span>
        </button>

        <button
          onClick={() => setActiveTab('settings')}
          className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
            activeTab === 'settings' ? 'text-sky-400 font-semibold' : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Settings className="w-4 h-4 mb-0.5" />
          <span className="text-[9px] tracking-tight">Config</span>
        </button>
      </nav>

    </div>
  );
};
