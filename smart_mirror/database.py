"""
SmartMirror Database Manager
Stores all user schedules, reminders, to-dos, and mirror configuration locally in SQLite.
Uses Python standard library (sqlite3, hashlib, secrets) with zero extra dependencies.
"""

import sqlite3
import hashlib
import secrets
import logging
from datetime import datetime
from config import (
    DATABASE_PATH,
    DEFAULT_PIN,
    DEFAULT_CITY,
    DEFAULT_LAT,
    DEFAULT_LON,
    DEFAULT_TEMP_UNIT,
    DEFAULT_NEWS_FEED,
    DEFAULT_NIGHT_DIM_ENABLED,
    DEFAULT_NIGHT_DIM_START,
    DEFAULT_NIGHT_DIM_END,
    DEFAULT_NIGHT_DIM_OPACITY,
)

logger = logging.getLogger("smart_mirror.db")


def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def hash_pin(pin: str, salt: str = None) -> tuple:
    if salt is None:
        salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt.encode("utf-8"), 100000)
    return key.hex(), salt


def verify_pin_hash(pin: str, stored_hash: str, salt: str) -> bool:
    key = hashlib.pbkdf2_hmac("sha256", pin.encode("utf-8"), salt.encode("utf-8"), 100000)
    return secrets.compare_digest(key.hex(), stored_hash)


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS calendar_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        event_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        location TEXT,
        notes TEXT,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        reminder_time TEXT NOT NULL,
        repeat_type TEXT NOT NULL DEFAULT 'none',
        repeat_day INTEGER DEFAULT NULL,
        is_active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS todos (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task TEXT NOT NULL,
        is_completed INTEGER NOT NULL DEFAULT 0,
        priority TEXT NOT NULL DEFAULT 'normal',
        created_at TEXT NOT NULL
    )
    """)

    cursor.execute("""
    CREATE TABLE IF NOT EXISTS api_cache (
        cache_key TEXT PRIMARY KEY,
        data_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
    )
    """)

    # Seed default PIN and user settings if fresh
    cursor.execute("SELECT value FROM settings WHERE key = 'pin_hash'")
    if not cursor.fetchone():
        pin_hash_val, pin_salt_val = hash_pin(DEFAULT_PIN)
        default_settings = [
            ("pin_hash", pin_hash_val),
            ("pin_salt", pin_salt_val),
            ("greeting", "Good morning"),
            ("user_name", "Alex"),
            ("weather_city", DEFAULT_CITY),
            ("weather_lat", str(DEFAULT_LAT)),
            ("weather_lon", str(DEFAULT_LON)),
            ("weather_units", DEFAULT_TEMP_UNIT),
            ("news_feed_url", DEFAULT_NEWS_FEED),
            ("is_canvas_lit", "1"),
            ("night_dim_enabled", "1" if DEFAULT_NIGHT_DIM_ENABLED else "0"),
            ("night_dim_start", str(DEFAULT_NIGHT_DIM_START)),
            ("night_dim_end", str(DEFAULT_NIGHT_DIM_END)),
            ("night_dim_opacity", str(DEFAULT_NIGHT_DIM_OPACITY)),
        ]
        cursor.executemany("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", default_settings)

        # Seed sample items
        today_str = datetime.now().strftime("%Y-%m-%d")
        cursor.execute("""
        INSERT INTO calendar_events (title, event_date, start_time, end_time, location, notes, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            "Design Review & Demo",
            today_str,
            "09:30",
            "10:15",
            "Lab 204",
            "SmartMirror with Google Maps & Voice",
            datetime.now().isoformat()
        ))

        cursor.execute("""
        INSERT INTO reminders (title, reminder_time, repeat_type, repeat_day, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """, (
            "Hydrate & Stretch",
            "11:00",
            "daily",
            None,
            1,
            datetime.now().isoformat()
        ))

        cursor.execute("""
        INSERT INTO todos (task, is_completed, priority, created_at)
        VALUES (?, ?, ?, ?)
        """, (
            "Calibrate perimeter back-lit canvas lighting",
            0,
            "high",
            datetime.now().isoformat()
        ))

        cursor.execute("""
        INSERT INTO todos (task, is_completed, priority, created_at)
        VALUES (?, ?, ?, ?)
        """, (
            "Sync Google Maps live commute route",
            1,
            "normal",
            datetime.now().isoformat()
        ))

    conn.commit()
    conn.close()


def get_all_settings() -> dict:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT key, value FROM settings WHERE key NOT IN ('pin_hash', 'pin_salt')")
    rows = cursor.fetchall()
    conn.close()
    return {row["key"]: row["value"] for row in rows}


def update_settings(updates: dict):
    filtered = [(k, str(v)) for k, v in updates.items() if k not in ("pin_hash", "pin_salt")]
    if not filtered:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.executemany("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", filtered)
    conn.commit()
    conn.close()


def verify_access_code(pin_attempt: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = 'pin_hash'")
    h_row = cursor.fetchone()
    cursor.execute("SELECT value FROM settings WHERE key = 'pin_salt'")
    s_row = cursor.fetchone()
    conn.close()

    if not h_row or not s_row:
        return False
    return verify_pin_hash(pin_attempt, h_row["value"], s_row["value"])


def change_access_code(current_pin: str, new_pin: str) -> bool:
    if not verify_access_code(current_pin):
        return False
    if len(new_pin) < 4:
        return False

    new_hash, new_salt = hash_pin(new_pin)
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('pin_hash', ?)", (new_hash,))
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES ('pin_salt', ?)", (new_salt,))
    conn.commit()
    conn.close()
    return True


# --- Calendar Events ---

def get_calendar_events(limit: int = 15) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    SELECT id, title, event_date, start_time, end_time, location, notes
    FROM calendar_events
    ORDER BY event_date ASC, start_time ASC
    LIMIT ?
    """, (limit,))
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_calendar_event(title: str, event_date: str, start_time: str, end_time: str = "", location: str = "", notes: str = "") -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO calendar_events (title, event_date, start_time, end_time, location, notes, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (title.strip(), event_date, start_time, end_time, location.strip(), notes.strip(), datetime.now().isoformat()))
    event_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return event_id


def update_calendar_event(event_id: int, title: str, event_date: str, start_time: str, end_time: str = "", location: str = "", notes: str = "") -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    UPDATE calendar_events
    SET title = ?, event_date = ?, start_time = ?, end_time = ?, location = ?, notes = ?
    WHERE id = ?
    """, (title.strip(), event_date, start_time, end_time, location.strip(), notes.strip(), event_id))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def delete_calendar_event(event_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM calendar_events WHERE id = ?", (event_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


# --- Reminders ---

def get_reminders(active_only: bool = False) -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    query = "SELECT id, title, reminder_time, repeat_type, repeat_day, is_active FROM reminders"
    if active_only:
        query += " WHERE is_active = 1"
    query += " ORDER BY reminder_time ASC"
    cursor.execute(query)
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_reminder(title: str, reminder_time: str, repeat_type: str = "none", repeat_day: int = None) -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO reminders (title, reminder_time, repeat_type, repeat_day, is_active, created_at)
    VALUES (?, ?, ?, ?, 1, ?)
    """, (title.strip(), reminder_time, repeat_type, repeat_day, datetime.now().isoformat()))
    rem_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return rem_id


def delete_reminder(rem_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM reminders WHERE id = ?", (rem_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


# --- To-Do Items ---

def get_todos() -> list:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, task, is_completed, priority, created_at FROM todos ORDER BY is_completed ASC, id DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(r) for r in rows]


def add_todo(task: str, priority: str = "normal") -> int:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
    INSERT INTO todos (task, is_completed, priority, created_at)
    VALUES (?, 0, ?, ?)
    """, (task.strip(), priority, datetime.now().isoformat()))
    todo_id = cursor.lastrowid
    conn.commit()
    conn.close()
    return todo_id


def update_todo(todo_id: int, task: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE todos SET task = ? WHERE id = ?", (task.strip(), todo_id))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def toggle_todo(todo_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE todos SET is_completed = CASE WHEN is_completed = 1 THEN 0 ELSE 1 END WHERE id = ?", (todo_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


def delete_todo(todo_id: int) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM todos WHERE id = ?", (todo_id,))
    affected = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return affected


# --- Caching ---

def get_cache(cache_key: str, max_age_seconds: int) -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT data_json, updated_at FROM api_cache WHERE cache_key = ?", (cache_key,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    now_ts = int(datetime.now().timestamp())
    if now_ts - row["updated_at"] > max_age_seconds:
        return None
    return row["data_json"]


def set_cache(cache_key: str, data_json: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    now_ts = int(datetime.now().timestamp())
    cursor.execute("""
    INSERT OR REPLACE INTO api_cache (cache_key, data_json, updated_at)
    VALUES (?, ?, ?)
    """, (cache_key, data_json, now_ts))
    conn.commit()
    conn.close()
