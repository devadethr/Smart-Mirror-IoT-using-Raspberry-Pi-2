"""
SmartMirror Server
A lightweight, self-contained Flask web server for Raspberry Pi 2 Model B (Raspberry Pi OS 32-bit).
Binds to 0.0.0.0:5000 for local network control from any smartphone browser.
"""

import json
import logging
import re
import urllib.request
import urllib.error
import xml.etree.ElementTree as ET
from datetime import datetime
from functools import wraps
from flask import (
    Flask,
    render_template,
    request,
    jsonify,
    session,
)

import config
import database as db

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S"
)
logger = logging.getLogger("smart_mirror")

app = Flask(__name__)
app.secret_key = config.SECRET_KEY
app.config["SESSION_COOKIE_HTTPONLY"] = True
app.config["SESSION_COOKIE_SAMESITE"] = "Lax"


def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        is_session_auth = session.get("authenticated", False)
        if not is_session_auth:
            header_pin = request.headers.get("X-Access-Code", "").strip()
            if header_pin and db.verify_access_code(header_pin):
                session["authenticated"] = True
                is_session_auth = True

        if not is_session_auth:
            return jsonify({"error": "Unauthorized. Enter your 4-digit access code."}), 401
        return f(*args, **kwargs)
    return decorated_function


WMO_CODES = {
    0: ("Clear sky", "☀️"),
    1: ("Mainly clear", "🌤️"),
    2: ("Partly cloudy", "⛅"),
    3: ("Overcast", "☁️"),
    45: ("Foggy", "🌫️"),
    48: ("Depositing rime fog", "🌫️"),
    51: ("Light drizzle", "🌦️"),
    53: ("Moderate drizzle", "🌧️"),
    55: ("Dense drizzle", "🌧️"),
    61: ("Slight rain", "🌦️"),
    63: ("Moderate rain", "🌧️"),
    65: ("Heavy rain", "🌧️"),
    71: ("Slight snow fall", "🌨️"),
    73: ("Moderate snow fall", "🌨️"),
    75: ("Heavy snow fall", "❄️"),
    80: ("Slight rain showers", "🌦️"),
    81: ("Moderate rain showers", "🌧️"),
    82: ("Violent rain showers", "⛈️"),
    95: ("Thunderstorm", "⛈️"),
}


def fetch_weather_data(lat: float, lon: float, units: str = "fahrenheit") -> dict:
    cache_key = f"weather_{lat}_{lon}_{units}"
    cached = db.get_cache(cache_key, config.WEATHER_CACHE_SECONDS)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    temp_unit_param = "fahrenheit" if units == "fahrenheit" else "celsius"
    url = (
        f"https://api.open-meteo.com/v1/forecast?"
        f"latitude={lat}&longitude={lon}&current=temperature_2m,relative_humidity_2m,weather_code&"
        f"daily=weather_code,temperature_2m_max,temperature_2m_min&temperature_unit={temp_unit_param}&"
        f"timezone=auto"
    )

    try:
        req = urllib.request.Request(
            url,
            headers={"User-Agent": "SmartMirror/1.0 (RaspberryPi2)"}
        )
        with urllib.request.urlopen(req, timeout=config.HTTP_TIMEOUT_SECONDS) as response:
            if response.status == 200:
                raw_data = json.loads(response.read().decode("utf-8"))
                current = raw_data.get("current", {})
                daily = raw_data.get("daily", {})

                w_code = current.get("weather_code", 0)
                condition_desc, condition_icon = WMO_CODES.get(w_code, ("Fair", "☀️"))

                forecast = []
                dates = daily.get("time", [])[:3]
                max_temps = daily.get("temperature_2m_max", [])[:3]
                min_temps = daily.get("temperature_2m_min", [])[:3]
                codes = daily.get("weather_code", [])[:3]

                for i in range(len(dates)):
                    day_name = datetime.strptime(dates[i], "%Y-%m-%d").strftime("%a")
                    f_code = codes[i] if i < len(codes) else 0
                    f_desc, f_icon = WMO_CODES.get(f_code, ("Fair", "☀️"))
                    forecast.append({
                        "day": day_name,
                        "date": dates[i],
                        "high": round(max_temps[i]) if i < len(max_temps) else 0,
                        "low": round(min_temps[i]) if i < len(min_temps) else 0,
                        "condition": f_desc,
                        "icon": f_icon
                    })

                unit_symbol = "°F" if units == "fahrenheit" else "°C"
                weather_result = {
                    "available": True,
                    "temperature": round(current.get("temperature_2m", 0)),
                    "unit": unit_symbol,
                    "humidity": current.get("relative_humidity_2m", 0),
                    "condition": condition_desc,
                    "icon": condition_icon,
                    "forecast": forecast,
                    "updated_at": datetime.now().strftime("%H:%M")
                }
                db.set_cache(cache_key, json.dumps(weather_result))
                return weather_result

    except Exception as e:
        logger.warning(f"Weather fetch failed: {e}. Graceful offline fallback applied.")

    return {
        "available": False,
        "message": "Weather currently unavailable",
        "updated_at": datetime.now().strftime("%H:%M")
    }


def fetch_news_feed(feed_url: str) -> dict:
    if not feed_url or not feed_url.startswith(("http://", "https://")):
        return {"available": False, "items": [], "message": "News feed URL not configured"}

    cache_key = f"news_{hash(feed_url)}"
    cached = db.get_cache(cache_key, config.NEWS_CACHE_SECONDS)
    if cached:
        try:
            return json.loads(cached)
        except Exception:
            pass

    try:
        req = urllib.request.Request(
            feed_url,
            headers={"User-Agent": "SmartMirror/1.0 (RaspberryPi2; RSS Reader)"}
        )
        with urllib.request.urlopen(req, timeout=config.HTTP_TIMEOUT_SECONDS) as response:
            if response.status == 200:
                xml_content = response.read()
                root = ET.fromstring(xml_content)
                items = []
                for item in root.findall(".//item")[:8]:
                    title_elem = item.find("title")
                    if title_elem is not None and title_elem.text:
                        clean_title = re.sub(r"<[^>]+>", "", title_elem.text).strip()
                        if clean_title:
                            items.append(clean_title)

                if items:
                    news_result = {
                        "available": True,
                        "items": items,
                        "bulletins": [
                            {"type": "traffic", "headline": "TRAFFIC: I-90 Westbound moving smoothly at 55 mph • Normal Flow"},
                            {"type": "local", "headline": "LOCAL: Street cleaning on Pine St today from 2 PM to 4 PM"}
                        ],
                        "updated_at": datetime.now().strftime("%H:%M")
                    }
                    db.set_cache(cache_key, json.dumps(news_result))
                    return news_result

    except Exception as e:
        logger.warning(f"News RSS fetch failed: {e}. Graceful offline fallback applied.")

    return {
        "available": False,
        "items": [],
        "bulletins": [
            {"type": "traffic", "headline": "TRAFFIC BULLETIN: Local traffic operating normally on home network"}
        ],
        "message": "News feed currently unavailable"
    }


def is_night_dimming_active(start_hour: int, end_hour: int) -> bool:
    now_hour = datetime.now().hour
    if start_hour > end_hour:
        return now_hour >= start_hour or now_hour < end_hour
    else:
        return start_hour <= now_hour < end_hour


# --- Routes ---

@app.route("/")
def phone_control_panel():
    return render_template("index.html")


@app.route("/mirror")
def mirror_display():
    return render_template("mirror.html")


@app.route("/api/mirror-data")
def api_mirror_data():
    settings = db.get_all_settings()

    lat = float(settings.get("weather_lat", config.DEFAULT_LAT))
    lon = float(settings.get("weather_lon", config.DEFAULT_LON))
    units = settings.get("weather_units", config.DEFAULT_TEMP_UNIT)
    city_name = settings.get("weather_city", config.DEFAULT_CITY)
    weather = fetch_weather_data(lat, lon, units)
    weather["city"] = city_name

    feed_url = settings.get("news_feed_url", config.DEFAULT_NEWS_FEED)
    news = fetch_news_feed(feed_url)

    events = db.get_calendar_events(limit=6)
    reminders = db.get_reminders(active_only=True)
    todos = db.get_todos()

    dim_enabled = settings.get("night_dim_enabled", "1") == "1"
    dim_start = int(settings.get("night_dim_start", 22))
    dim_end = int(settings.get("night_dim_end", 7))
    dim_opacity = float(settings.get("night_dim_opacity", 0.35))
    is_dimmed = dim_enabled and is_night_dimming_active(dim_start, dim_end)
    is_canvas_lit = settings.get("is_canvas_lit", "1") == "1"

    return jsonify({
        "server_time": datetime.now().isoformat(),
        "greeting": settings.get("greeting", "Good morning"),
        "user_name": settings.get("user_name", "Alex"),
        "is_canvas_lit": is_canvas_lit,
        "weather": weather,
        "news": news,
        "calendar_events": events,
        "reminders": reminders,
        "todos": [t for t in todos if not t["is_completed"]][:6],
        "completed_todos": [t for t in todos if t["is_completed"]][:3],
        "night_dimming": {
            "active": is_dimmed,
            "opacity": dim_opacity if is_dimmed else 1.0
        }
    })


@app.route("/api/auth/status", methods=["GET"])
def api_auth_status():
    return jsonify({"authenticated": session.get("authenticated", False)})


@app.route("/api/auth/verify", methods=["POST"])
def api_auth_verify():
    data = request.get_json(silent=True) or {}
    pin = str(data.get("pin", "")).strip()
    if not pin:
        return jsonify({"success": False, "error": "Access code is required"}), 400

    if db.verify_access_code(pin):
        session["authenticated"] = True
        logger.info("Access code verified successfully.")
        return jsonify({"success": True, "message": "Unlocked"})

    logger.warning("Failed access code attempt.")
    return jsonify({"success": False, "error": "Incorrect access code"}), 401


@app.route("/api/auth/logout", methods=["POST"])
def api_auth_logout():
    session["authenticated"] = False
    return jsonify({"success": True, "message": "Locked"})


@app.route("/api/auth/change-pin", methods=["POST"])
@require_auth
def api_auth_change_pin():
    data = request.get_json(silent=True) or {}
    current_pin = str(data.get("current_pin", "")).strip()
    new_pin = str(data.get("new_pin", "")).strip()

    if len(new_pin) < 4 or not new_pin.isdigit():
        return jsonify({"success": False, "error": "New PIN must be at least 4 numeric digits."}), 400

    if db.change_access_code(current_pin, new_pin):
        return jsonify({"success": True, "message": "Access code updated."})

    return jsonify({"success": False, "error": "Current access code is incorrect."}), 400


@app.route("/api/schedule", methods=["GET"])
def api_get_schedule():
    events = db.get_calendar_events(limit=30)
    return jsonify({"events": events})


@app.route("/api/schedule", methods=["POST"])
@require_auth
def api_add_schedule():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    event_date = str(data.get("event_date", "")).strip()
    start_time = str(data.get("start_time", "")).strip()
    end_time = str(data.get("end_time", "")).strip()
    location = str(data.get("location", "")).strip()
    notes = str(data.get("notes", "")).strip()

    if not title or not re.match(r"^\d{4}-\d{2}-\d{2}$", event_date) or not re.match(r"^\d{2}:\d{2}$", start_time):
        return jsonify({"error": "Valid title, date (YYYY-MM-DD), and time (HH:MM) required."}), 400

    event_id = db.add_calendar_event(title, event_date, start_time, end_time, location, notes)
    return jsonify({"success": True, "id": event_id})


@app.route("/api/schedule/<int:event_id>", methods=["PUT"])
@require_auth
def api_update_schedule(event_id):
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    event_date = str(data.get("event_date", "")).strip()
    start_time = str(data.get("start_time", "")).strip()
    end_time = str(data.get("end_time", "")).strip()
    location = str(data.get("location", "")).strip()
    notes = str(data.get("notes", "")).strip()

    if not title or not re.match(r"^\d{4}-\d{2}-\d{2}$", event_date) or not re.match(r"^\d{2}:\d{2}$", start_time):
        return jsonify({"error": "Valid title, date (YYYY-MM-DD), and start time (HH:MM) required."}), 400

    if db.update_calendar_event(event_id, title, event_date, start_time, end_time, location, notes):
        return jsonify({"success": True, "message": "Event updated."})
    return jsonify({"error": "Event not found."}), 404


@app.route("/api/schedule/<int:event_id>", methods=["DELETE"])
@require_auth
def api_delete_schedule(event_id):
    if db.delete_calendar_event(event_id):
        return jsonify({"success": True})
    return jsonify({"error": "Event not found."}), 404


@app.route("/api/reminders", methods=["GET"])
def api_get_reminders():
    reminders = db.get_reminders(active_only=False)
    return jsonify({"reminders": reminders})


@app.route("/api/reminders", methods=["POST"])
@require_auth
def api_add_reminder():
    data = request.get_json(silent=True) or {}
    title = str(data.get("title", "")).strip()
    reminder_time = str(data.get("reminder_time", "")).strip()
    repeat_type = str(data.get("repeat_type", "none")).strip().lower()
    repeat_day = data.get("repeat_day")

    if not title or not re.match(r"^\d{2}:\d{2}$", reminder_time):
        return jsonify({"error": "Valid title and time (HH:MM) required."}), 400

    rem_id = db.add_reminder(title, reminder_time, repeat_type, repeat_day)
    return jsonify({"success": True, "id": rem_id})


@app.route("/api/reminders/<int:rem_id>", methods=["DELETE"])
@require_auth
def api_delete_reminder(rem_id):
    if db.delete_reminder(rem_id):
        return jsonify({"success": True})
    return jsonify({"error": "Reminder not found."}), 404


@app.route("/api/todos", methods=["GET"])
def api_get_todos():
    todos = db.get_todos()
    return jsonify({"todos": todos})


@app.route("/api/todos", methods=["POST"])
@require_auth
def api_add_todo():
    data = request.get_json(silent=True) or {}
    task = str(data.get("task", "")).strip()
    if not task:
        return jsonify({"error": "Task description is required."}), 400
    todo_id = db.add_todo(task)
    return jsonify({"success": True, "id": todo_id})


@app.route("/api/todos/<int:todo_id>", methods=["PUT"])
@require_auth
def api_update_todo(todo_id):
    data = request.get_json(silent=True) or {}
    task = str(data.get("task", "")).strip()
    if not task:
        return jsonify({"error": "Task text is required."}), 400
    if db.update_todo(todo_id, task):
        return jsonify({"success": True})
    return jsonify({"error": "To-Do not found."}), 404


@app.route("/api/todos/<int:todo_id>/toggle", methods=["POST"])
@require_auth
def api_toggle_todo(todo_id):
    if db.toggle_todo(todo_id):
        return jsonify({"success": True})
    return jsonify({"error": "To-Do not found."}), 404


@app.route("/api/todos/<int:todo_id>", methods=["DELETE"])
@require_auth
def api_delete_todo(todo_id):
    if db.delete_todo(todo_id):
        return jsonify({"success": True})
    return jsonify({"error": "To-Do not found."}), 404


@app.route("/api/settings", methods=["GET"])
def api_get_settings():
    return jsonify({"settings": db.get_all_settings()})


@app.route("/api/settings", methods=["PUT"])
@require_auth
def api_update_settings():
    data = request.get_json(silent=True) or {}
    allowed_keys = {
        "greeting", "user_name", "weather_city", "weather_lat", "weather_lon",
        "weather_units", "news_feed_url", "is_canvas_lit", "night_dim_enabled",
        "night_dim_start", "night_dim_end", "night_dim_opacity"
    }
    updates = {k: v for k, v in data.items() if k in allowed_keys}
    if updates:
        db.update_settings(updates)
        return jsonify({"success": True})
    return jsonify({"error": "No valid settings provided."}), 400


@app.route("/api/voice/test", methods=["POST"])
@require_auth
def api_voice_test():
    settings = db.get_all_settings()
    now_str = datetime.now().strftime("%I:%M %p")
    greeting = settings.get("greeting", "Hello")
    user_name = settings.get("user_name", "friend")
    return jsonify({
        "success": True,
        "text": f"{greeting}, {user_name}! The time is {now_str}. SmartMirror is online and ready."
    })


if __name__ == "__main__":
    db.init_db()
    logger.info(f"Binding to {config.HOST}:{config.PORT}")
    app.run(host=config.HOST, port=config.PORT, debug=False)
