"""
LuminaMirror Configuration
Designed specifically for Raspberry Pi 2 Model B running Raspberry Pi OS 32-bit.
All settings are kept lightweight, local, and private.
"""

import os
import secrets

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Server network binding
# 0.0.0.0 allows any device on the local Wi-Fi / Ethernet to connect to the phone control panel
HOST = "0.0.0.0"
PORT = 5000

# SQLite local database file
DATABASE_PATH = os.path.join(BASE_DIR, "smart_mirror.db")

# Secret key for session security (persisted or randomized)
SECRET_KEY = os.environ.get("FLASK_SECRET_KEY", secrets.token_hex(24))

# First-use default access PIN (will be hashed into SQLite on first database setup)
# You can change this from the phone control panel at any time.
DEFAULT_PIN = "1234"

# External service limits and caching to protect Raspberry Pi 2 CPU & network
WEATHER_CACHE_SECONDS = 900  # 15 minutes
NEWS_CACHE_SECONDS = 900     # 15 minutes
HTTP_TIMEOUT_SECONDS = 5     # Fast timeout so mirror never freezes if network drops

# Default Weather Location (Can be customized in Phone Control Panel)
DEFAULT_CITY = "New York, US"
DEFAULT_LAT = 40.7128
DEFAULT_LON = -74.0060
DEFAULT_TEMP_UNIT = "fahrenheit"  # "fahrenheit" or "celsius"

# Default News RSS Feed (BBC World News or NPR World News)
DEFAULT_NEWS_FEED = "http://feeds.bbci.co.uk/news/world/rss.xml"

# Night Dimming Defaults (Hours in 24-hr format: 22 = 10 PM, 7 = 7 AM)
DEFAULT_NIGHT_DIM_ENABLED = True
DEFAULT_NIGHT_DIM_START = 22
DEFAULT_NIGHT_DIM_END = 7
DEFAULT_NIGHT_DIM_OPACITY = 0.35  # Screen dimmed to 35% brightness
