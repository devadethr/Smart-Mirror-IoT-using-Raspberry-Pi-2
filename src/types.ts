export interface CalendarEvent {
  id: number;
  title: string;
  event_date: string; // YYYY-MM-DD
  start_time: string; // HH:MM
  end_time?: string;  // HH:MM
  location?: string;
  notes?: string;
}

export interface Reminder {
  id: number;
  title: string;
  reminder_time: string; // HH:MM
  repeat_type: 'none' | 'daily' | 'weekly';
  repeat_day?: number; // 0 = Sun, 1 = Mon, ..., 6 = Sat
  is_active: boolean;
}

export interface TodoItem {
  id: number;
  task: string;
  is_completed: boolean;
  priority: 'low' | 'normal' | 'high';
  created_at: string;
}

export interface TrafficBulletin {
  id: string;
  type: 'traffic' | 'local' | 'commute' | 'alert';
  headline: string;
  detail?: string;
  timestamp: string;
}

export interface MirrorSettings {
  greeting: string;
  user_name: string; // User name shown underneath greeting
  weather_city: string; // City and country name, e.g. "Seattle, US"
  weather_lat: number;
  weather_lon: number;
  weather_units: 'fahrenheit' | 'celsius';
  news_feed_url: string;
  night_dim_enabled: boolean;
  night_dim_start: number;
  night_dim_end: number;
  night_dim_opacity: number;
  pin_code: string; // default 1234
  is_canvas_lit: boolean; // Back-lit smart mirror canvas edge glow
  commute_origin: string; // e.g. "Home" or address
  commute_destination: string; // e.g. "Office" or address
  show_schedule_widget?: boolean; // Legacy combined schedule toggle
  show_calendar_widget: boolean; // Independent calendar widget toggle
  show_reminders_widget: boolean; // Independent reminders widget toggle
  show_todos_widget: boolean; // Independent to-do list widget toggle
  is_power_on: boolean; // Screen power state: when false, displays " Have a great day! " in middle
}

export interface WeatherForecastItem {
  day: string;
  date: string;
  high: number;
  low: number;
  condition: string;
  icon: string;
}

export interface WeatherData {
  available: boolean;
  temperature: number;
  unit: string;
  humidity: number;
  condition: string;
  icon: string;
  forecast: WeatherForecastItem[];
  city: string;
  message?: string;
}

export interface NewsData {
  available: boolean;
  items: string[];
  bulletins: TrafficBulletin[];
  message?: string;
}

export interface MapsRouteInfo {
  origin: string;
  destination: string;
  durationText: string;
  distanceText: string;
  trafficCondition: 'normal' | 'moderate' | 'heavy';
  steps: string[];
  summary: string;
}

export interface MapsPlaceInfo {
  name: string;
  address: string;
  rating?: number;
  isOpen?: boolean;
  category: string;
}

declare global {
  interface Window {
    google?: any;
    SpeechRecognition?: any;
    webkitSpeechRecognition?: any;
    gm_authFailure?: () => void;
  }
}
