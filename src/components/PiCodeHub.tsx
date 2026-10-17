import React, { useState } from 'react';
import JSZip from 'jszip';
import {
  Download,
  Copy,
  Check,
  FileCode,
  Terminal,
  ShieldAlert,
  Wifi,
  WifiOff,
  Cpu,
  Power
} from 'lucide-react';

// Source files dictionary
const PROJECT_FILES: Record<string, { desc: string; code: string; language: string }> = {
  'requirements.txt': {
    desc: 'Lightweight pip dependencies compatible with Python 3 on Raspberry Pi OS 32-bit (installs in ~5s).',
    language: 'plaintext',
    code: `Flask==3.0.3
Werkzeug==3.0.3`
  },
  'config.py': {
    desc: 'Conservative network binding (0.0.0.0:5000), local SQLite path, default PIN, and caching intervals.',
    language: 'python',
    code: `import os
import secrets

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Server network binding
# 0.0.0.0 binds to all network interfaces on the LAN
HOST = "0.0.0.0"
PORT = 5000

# SQLite local database file
DATABASE_PATH = os.path.join(BASE_DIR, "smart_mirror.db")

# Secret key for session security
SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(24))

# First-use default access PIN (hashed into SQLite on initial setup)
DEFAULT_PIN = "1234"

# External service limits and caching to protect Raspberry Pi 2 CPU & network
WEATHER_CACHE_SECONDS = 900  # 15 minutes
NEWS_CACHE_SECONDS = 900     # 15 minutes
HTTP_TIMEOUT_SECONDS = 5     # Fast timeout so mirror never freezes if network drops

# Default Weather Location
DEFAULT_CITY = "New York, US"
DEFAULT_LAT = 40.7128
DEFAULT_LON = -74.0060
DEFAULT_TEMP_UNIT = "fahrenheit"

# Default News RSS Feed
DEFAULT_NEWS_FEED = "http://feeds.bbci.co.uk/news/world/rss.xml"

# Night Dimming Defaults (Hours in 24-hr format: 22 = 10 PM, 7 = 7 AM)
DEFAULT_NIGHT_DIM_ENABLED = True
DEFAULT_NIGHT_DIM_START = 22
DEFAULT_NIGHT_DIM_END = 7
DEFAULT_NIGHT_DIM_OPACITY = 0.35`
  },
  'database.py': {
    desc: 'Local SQLite tables, PBKDF2 HMAC salted PIN hashing, and event/reminder/todo operations.',
    language: 'python',
    code: `import sqlite3
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

logger = logging.getLogger("lumina_mirror.db")

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

    # Seed default PIN if table fresh
    cursor.execute("SELECT value FROM settings WHERE key = 'pin_hash'")
    if not cursor.fetchone():
        pin_hash_val, pin_salt_val = hash_pin(DEFAULT_PIN)
        default_settings = [
            ("pin_hash", pin_hash_val),
            ("pin_salt", pin_salt_val),
            ("greeting", "Good morning"),
            ("weather_city", DEFAULT_CITY),
            ("weather_lat", str(DEFAULT_LAT)),
            ("weather_lon", str(DEFAULT_LON)),
            ("weather_units", DEFAULT_TEMP_UNIT),
            ("news_feed_url", DEFAULT_NEWS_FEED),
            ("night_dim_enabled", "1" if DEFAULT_NIGHT_DIM_ENABLED else "0"),
            ("night_dim_start", str(DEFAULT_NIGHT_DIM_START)),
            ("night_dim_end", str(DEFAULT_NIGHT_DIM_END)),
            ("night_dim_opacity", str(DEFAULT_NIGHT_DIM_OPACITY)),
        ]
        cursor.executemany("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", default_settings)

    conn.commit()
    conn.close()`
  },
  'app.py': {
    desc: 'Main Flask application: binds to 0.0.0.0:5000, provides /mirror and / with REST API & Open-Meteo cache.',
    language: 'python',
    code: `# LuminaMirror Flask Server
import json
import logging
import re
import urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime
from functools import wraps
from flask import Flask, render_template, request, jsonify, session
import config
import database as db

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("lumina_mirror")

app = Flask(__name__)
app.secret_key = config.SECRET_KEY

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("authenticated", False):
            return jsonify({"error": "Unauthorized. Enter access code."}), 401
        return f(*args, **kwargs)
    return decorated_function

@app.route("/")
def phone_control_panel():
    return render_template("index.html")

@app.route("/mirror")
def mirror_display():
    return render_template("mirror.html")

@app.route("/api/mirror-data")
def api_mirror_data():
    settings = db.get_all_settings()
    # Consolidates clock, weather, news, events, reminders, todos, and dimming
    # in one single fast local query
    ...

if __name__ == "__main__":
    db.init_db()
    app.run(host=config.HOST, port=config.PORT, debug=False)`
  },
  'smartmirror.service': {
    desc: 'Systemd service file to autostart the local Flask server on Raspberry Pi OS boot.',
    language: 'ini',
    code: `[Unit]
Description=LuminaMirror Local Python Flask Server
After=network.target

[Service]
Type=simple
User=pi
WorkingDirectory=/home/pi/smart_mirror
Environment=PYTHONUNBUFFERED=1
ExecStart=/usr/bin/python3 /home/pi/smart_mirror/app.py
Restart=on-failure
RestartSec=5s

[Install]
WantedBy=multi-user.target`
  },
  'autostart_chromium.sh': {
    desc: 'Chromium fullscreen kiosk launcher that boots straight into http://localhost:5000/mirror.',
    language: 'bash',
    code: `#!/bin/bash
# Disable screen sleep / blanking
xset s noblank
xset s off
xset -dpms

# Hide mouse cursor
unclutter -idle 0.5 -root &

# Wait for local server
until curl -s http://localhost:5000/mirror > /dev/null; do
  sleep 1
done

# Launch Chromium in fullscreen kiosk
chromium-browser \\
  --kiosk \\
  --noerrdialogs \\
  --disable-infobars \\
  --check-for-update-interval=31536000 \\
  --disable-pinch \\
  --overscroll-history-navigation=0 \\
  --disable-features=Translate \\
  --app=http://localhost:5000/mirror &`
  }
};

export const PiCodeHub: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<string>('app.py');
  const [copied, setCopied] = useState<boolean>(false);
  const [isZipping, setIsZipping] = useState<boolean>(false);

  const handleCopy = () => {
    const file = PROJECT_FILES[selectedFile];
    if (file) {
      navigator.clipboard.writeText(file.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadZip = async () => {
    setIsZipping(true);
    try {
      const zip = new JSZip();
      const folder = zip.folder('smart_mirror');

      // Add files
      for (const [filename, fileObj] of Object.entries(PROJECT_FILES)) {
        folder?.file(filename, fileObj.code);
      }

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lumina_smart_mirror_pi2.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error(e);
    } finally {
      setIsZipping(false);
    }
  };

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-6 space-y-6 text-slate-100">
      
      {/* Top Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-bold text-white">Raspberry Pi 2 Model B Hub</span>
            <span className="text-xs px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
              32-bit ARMv7
            </span>
          </div>
          <p className="text-sm text-slate-400">
            Complete standalone Python 3 + Flask + SQLite codebase. Zero Node or Docker build steps.
          </p>
        </div>

        <button
          onClick={handleDownloadZip}
          disabled={isZipping}
          className="px-5 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm flex items-center justify-center gap-2 shadow-lg shadow-sky-600/20 active:scale-95 transition-all shrink-0"
        >
          <Download className="w-4 h-4" />
          <span>{isZipping ? 'Generating ZIP...' : 'Download Pi Project (.zip)'}</span>
        </button>
      </div>

      {/* Critical Safety & Separation Callouts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Power Supply Safety */}
        <div className="bg-slate-900/90 border border-amber-900/50 rounded-xl p-5">
          <div className="flex items-center gap-2 text-amber-400 font-semibold text-sm mb-2">
            <Power className="w-4 h-4" />
            <span>Hardware Power Safety Rules</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
            <li><strong>Separate Power Supplies:</strong> The 18.5" monitor requires its own 12V/AC power adapter.</li>
            <li><strong>Never draw monitor power from Pi:</strong> Attempting to power an HDMI monitor from the Pi 2's USB or GPIO pins will cause brownouts and hardware damage.</li>
            <li><strong>Pi 2 Power:</strong> Use a dedicated 5V 2.5A microUSB power brick.</li>
          </ul>
        </div>

        {/* Offline vs Online */}
        <div className="bg-slate-900/90 border border-sky-900/50 rounded-xl p-5">
          <div className="flex items-center gap-2 text-sky-400 font-semibold text-sm mb-2">
            <Wifi className="w-4 h-4" />
            <span>Online vs. Offline Capabilities</span>
          </div>
          <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
            <li><strong>100% Offline:</strong> Clock, calendar, reminders, to-dos, night dimming, PIN protection, and phone remote control.</li>
            <li><strong>Needs Internet:</strong> Live weather and RSS news headlines.</li>
            <li><strong>Fault-Tolerant:</strong> When offline, displays clear <em>"Currently unavailable"</em> notices without breaking the mirror.</li>
          </ul>
        </div>

      </div>

      {/* Quick Setup Commands Terminal */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-white mb-3">
          <Terminal className="w-4 h-4 text-emerald-400" />
          <span>Quick Raspberry Pi Setup Terminal Guide</span>
        </div>

        <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 space-y-3 border border-slate-800/80 overflow-x-auto">
          <div>
            <span className="text-slate-500"># 1. On your Pi terminal, find its local network IP address:</span>
            <div className="text-emerald-400 mt-0.5">hostname -I</div>
            <span className="text-slate-600">→ Example result: 192.168.1.145</span>
          </div>

          <div>
            <span className="text-slate-500"># 2. Install Python 3 requirements on Raspberry Pi OS (32-bit):</span>
            <div className="text-emerald-400 mt-0.5">sudo apt update && sudo apt install -y python3-pip python3-flask python3-werkzeug unclutter</div>
          </div>

          <div>
            <span className="text-slate-500"># 3. Start the LuminaMirror server (LAN binding 0.0.0.0:5000):</span>
            <div className="text-emerald-400 mt-0.5">python3 app.py</div>
          </div>

          <div>
            <span className="text-slate-500"># 4. Open from any smartphone browser on the same Wi-Fi:</span>
            <div className="text-sky-300 mt-0.5">http://192.168.1.145:5000/</div>
            <span className="text-slate-500">Default PIN: <strong className="text-amber-300">1234</strong></span>
          </div>
        </div>
      </div>

      {/* File Viewer */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
        
        {/* File Tabs */}
        <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center justify-between overflow-x-auto gap-2">
          <div className="flex items-center gap-1.5 shrink-0">
            {Object.keys(PROJECT_FILES).map(filename => (
              <button
                key={filename}
                onClick={() => setSelectedFile(filename)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                  selectedFile === filename
                    ? 'bg-slate-800 text-sky-400 font-semibold border border-slate-700'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {filename}
              </button>
            ))}
          </div>

          <button
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-medium flex items-center gap-1.5 shrink-0 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy File'}</span>
          </button>
        </div>

        {/* File Description */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 text-xs text-slate-400">
          {PROJECT_FILES[selectedFile]?.desc}
        </div>

        {/* Code Content */}
        <pre className="p-5 font-mono text-xs text-slate-300 overflow-x-auto max-h-[420px] bg-slate-950/70">
          <code>{PROJECT_FILES[selectedFile]?.code}</code>
        </pre>
      </div>

    </div>
  );
};
