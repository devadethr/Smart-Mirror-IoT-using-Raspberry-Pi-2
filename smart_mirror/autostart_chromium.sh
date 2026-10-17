#!/bin/bash
# LuminaMirror - Chromium Kiosk Autostart Script for Raspberry Pi OS (32-bit)
# Place this script in /home/pi/smart_mirror/autostart_chromium.sh and make executable:
# chmod +x /home/pi/smart_mirror/autostart_chromium.sh

# 1. Disable screen blanking / power management so mirror screen stays awake
xset s noblank
xset s off
xset -dpms

# 2. Hide mouse pointer when idle
unclutter -idle 0.5 -root &

# 3. Wait for the local Flask server to be ready
until curl -s http://localhost:5000/mirror > /dev/null; do
  sleep 1
done

# 4. Launch Chromium in lightweight kiosk mode (no crash bubble, no toolbars)
chromium-browser \
  --kiosk \
  --noerrdialogs \
  --disable-infobars \
  --check-for-update-interval=31536000 \
  --disable-pinch \
  --overscroll-history-navigation=0 \
  --disable-features=Translate \
  --app=http://localhost:5000/mirror &
