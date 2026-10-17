import { CalendarEvent, Reminder, TodoItem, MirrorSettings, WeatherData, NewsData, TrafficBulletin } from './types';

const SETTINGS_KEY = 'smartmirror_settings';
const EVENTS_KEY = 'smartmirror_events';
const REMINDERS_KEY = 'smartmirror_reminders';
const TODOS_KEY = 'smartmirror_todos';

export const DEFAULT_SETTINGS: MirrorSettings = {
  greeting: 'Good morning',
  user_name: 'Alex',
  weather_city: 'Seattle, US',
  weather_lat: 47.6062,
  weather_lon: -122.3321,
  weather_units: 'fahrenheit',
  news_feed_url: 'http://feeds.bbci.co.uk/news/world/rss.xml',
  night_dim_enabled: true,
  night_dim_start: 22,
  night_dim_end: 7,
  night_dim_opacity: 0.35,
  pin_code: '1234',
  is_canvas_lit: true,
  commute_origin: 'Home (Bellevue)',
  commute_destination: 'Office (Downtown Seattle)',
  show_schedule_widget: true,
  show_calendar_widget: true,
  show_reminders_widget: true,
  show_todos_widget: true,
  is_power_on: true
};

export const INITIAL_EVENTS: CalendarEvent[] = [
  {
    id: 1,
    title: 'Design Review & Standup',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '09:30',
    end_time: '10:15',
    location: 'Conference Room B',
    notes: 'Present SmartMirror v2 updates with Maps and Gemini Live'
  },
  {
    id: 2,
    title: 'Hardware Lab Testing',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '13:00',
    end_time: '14:30',
    location: 'Maker Studio 4',
    notes: 'Verify 5V 2.5A power stability and HDMI two-way mirror glass reflections'
  },
  {
    id: 3,
    title: 'Team Commute & Coffee Sync',
    event_date: new Date().toISOString().split('T')[0],
    start_time: '16:00',
    end_time: '16:45',
    location: 'Pike Place Cafe',
    notes: 'Check real-time traffic route'
  }
];

export const INITIAL_REMINDERS: Reminder[] = [
  {
    id: 1,
    title: 'Hydrate & 20-20-20 Eye Break',
    reminder_time: '11:00',
    repeat_type: 'daily',
    is_active: true
  },
  {
    id: 2,
    title: 'Review Weekly Agenda & Commute',
    reminder_time: '17:30',
    repeat_type: 'weekly',
    repeat_day: 5, // Friday
    is_active: true
  }
];

export const INITIAL_TODOS: TodoItem[] = [
  {
    id: 1,
    task: 'Calibrate ambient edge backlight on 18.5" frame',
    is_completed: false,
    priority: 'high',
    created_at: new Date().toISOString()
  },
  {
    id: 2,
    task: 'Connect Google Maps real-time route agent to phone',
    is_completed: true,
    priority: 'high',
    created_at: new Date().toISOString()
  },
  {
    id: 3,
    task: 'Test Gemini voice conversations on phone controller',
    is_completed: false,
    priority: 'normal',
    created_at: new Date().toISOString()
  },
  {
    id: 4,
    task: 'Mount shadowbox with 2-way 60/40 acrylic mirror',
    is_completed: true,
    priority: 'normal',
    created_at: new Date().toISOString()
  }
];

export const INITIAL_BULLETINS: TrafficBulletin[] = [
  {
    id: 'b-1',
    type: 'traffic',
    headline: 'TRAFFIC ALERT: I-90 Westbound moving smoothly at 55 mph • Travel time to Downtown: 18 min',
    timestamp: '10 min ago'
  },
  {
    id: 'b-2',
    type: 'commute',
    headline: 'COMMUTE: Optimal route via SR-520 Bridge has green flow • Toll rate: $3.40',
    timestamp: '15 min ago'
  },
  {
    id: 'b-3',
    type: 'local',
    headline: 'LOCAL BULLETIN: Street cleaning on Pine St today from 2 PM to 4 PM • Alternate parking advised',
    timestamp: '25 min ago'
  },
  {
    id: 'b-4',
    type: 'alert',
    headline: 'WEATHER BULLETIN: Clear skies today with comfortable 68°F afternoon breeze',
    timestamp: '1 hr ago'
  }
];

export function getStoredSettings(): MirrorSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      show_calendar_widget: parsed.show_calendar_widget ?? parsed.show_schedule_widget ?? true,
      show_reminders_widget: parsed.show_reminders_widget ?? parsed.show_schedule_widget ?? true,
      show_todos_widget: parsed.show_todos_widget ?? true,
      is_power_on: parsed.is_power_on ?? true
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveStoredSettings(settings: MirrorSettings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function getStoredEvents(): CalendarEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return INITIAL_EVENTS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_EVENTS;
  }
}

export function saveStoredEvents(events: CalendarEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export function getStoredReminders(): Reminder[] {
  try {
    const raw = localStorage.getItem(REMINDERS_KEY);
    if (!raw) return INITIAL_REMINDERS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_REMINDERS;
  }
}

export function saveStoredReminders(reminders: Reminder[]): void {
  localStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders));
}

export function getStoredTodos(): TodoItem[] {
  try {
    const raw = localStorage.getItem(TODOS_KEY);
    if (!raw) return INITIAL_TODOS;
    return JSON.parse(raw);
  } catch {
    return INITIAL_TODOS;
  }
}

export function saveStoredTodos(todos: TodoItem[]): void {
  localStorage.setItem(TODOS_KEY, JSON.stringify(todos));
}

// Global Cities Geocoding Database for instant offline & online coordinate resolution
export const CITY_GEOCODE_PRESETS: Record<string, { lat: number; lon: number; name: string }> = {
  'seattle': { lat: 47.6062, lon: -122.3321, name: 'Seattle, US' },
  'new york': { lat: 40.7128, lon: -74.0060, name: 'New York, US' },
  'san francisco': { lat: 37.7749, lon: -122.4194, name: 'San Francisco, US' },
  'los angeles': { lat: 34.0522, lon: -118.2437, name: 'Los Angeles, US' },
  'chicago': { lat: 41.8781, lon: -87.6298, name: 'Chicago, US' },
  'boston': { lat: 42.3601, lon: -71.0589, name: 'Boston, US' },
  'austin': { lat: 30.2672, lon: -97.7431, name: 'Austin, US' },
  'london': { lat: 51.5074, lon: -0.1278, name: 'London, UK' },
  'paris': { lat: 48.8566, lon: 2.3522, name: 'Paris, FR' },
  'berlin': { lat: 52.5200, lon: 13.4050, name: 'Berlin, DE' },
  'tokyo': { lat: 35.6762, lon: 139.6503, name: 'Tokyo, JP' },
  'sydney': { lat: -33.8688, lon: 151.2093, name: 'Sydney, AU' },
  'toronto': { lat: 43.6532, lon: -79.3832, name: 'Toronto, CA' },
  'vancouver': { lat: 49.2827, lon: -123.1207, name: 'Vancouver, CA' },
  'mumbai': { lat: 19.0760, lon: 72.8777, name: 'Mumbai, IN' },
  'delhi': { lat: 28.6139, lon: 77.2090, name: 'Delhi, IN' },
  'singapore': { lat: 1.3521, lon: 103.8198, name: 'Singapore, SG' },
  'dubai': { lat: 25.2048, lon: 55.2708, name: 'Dubai, AE' }
};

export async function geocodeCityCountry(query: string): Promise<{ lat: number; lon: number; formatted: string } | null> {
  const clean = query.trim().toLowerCase();
  
  // 1. Try local preset match
  for (const [key, preset] of Object.entries(CITY_GEOCODE_PRESETS)) {
    if (clean.includes(key)) {
      return { lat: preset.lat, lon: preset.lon, formatted: preset.name };
    }
  }

  // 2. Try Open-Meteo geocoding API (free, reliable, global)
  try {
    const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=en&format=json`);
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const top = data.results[0];
        const country = top.country_code ? top.country_code.toUpperCase() : top.country || '';
        return {
          lat: top.latitude,
          lon: top.longitude,
          formatted: `${top.name}, ${country}`
        };
      }
    }
  } catch (err) {
    console.warn('Geocoding error, falling back to query', err);
  }

  return null;
}

export const FALLBACK_WEATHER: WeatherData = {
  available: true,
  city: 'Seattle, US',
  temperature: 66,
  unit: '°F',
  humidity: 58,
  condition: 'Mainly Clear',
  icon: '🌤️',
  forecast: [
    { day: 'Today', date: '2026-10-17', high: 69, low: 52, condition: 'Mainly Clear', icon: '🌤️' },
    { day: 'Sun', date: '2026-10-18', high: 71, low: 54, condition: 'Partly Cloudy', icon: '⛅' },
    { day: 'Mon', date: '2026-10-19', high: 67, low: 50, condition: 'Fair', icon: '☀️' }
  ]
};

export const FALLBACK_NEWS: NewsData = {
  available: true,
  items: [
    'Raspberry Pi Foundation highlights lightweight local IoT applications',
    'Regional transit agency reports 98% on-time performance on high-speed rail',
    'Smart mirror prototype demonstrates energy efficiency and zero cloud data leakage'
  ],
  bulletins: INITIAL_BULLETINS
};
