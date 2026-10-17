# LuminaMirror — Smart Mirror & Phone Control for Raspberry Pi 2 Model B

A lightweight, beginner-friendly smart mirror and local smartphone controller designed specifically for **Raspberry Pi 2 Model B** (1 GB RAM, ARMv7 quad-core 900MHz, full-size HDMI) running **Raspberry Pi OS 32-bit**.

---

## 1. Hardware Architecture & Critical Power Safety

### Component Bill of Materials
1. **Raspberry Pi 2 Model B** (1 GB RAM, 40-pin GPIO, 4 USB ports, Ethernet).
2. **Network Connection**: Ethernet cable to home router, OR a compatible USB Wi-Fi dongle (e.g. Realtek RTL8188CUS / Ralink RT5370). *Note: The Pi 2 has no onboard Wi-Fi or Bluetooth.*
3. **Display**: 18.5-inch 16:9 monitor connected via full-size HDMI.
4. **Mirror**: Semi-reflective two-way mirror glass (60/40 or 70/30 transmission ratio) mounted directly against the monitor face.
5. **Audio (Optional)**: Standard plug-and-play USB microphone and USB speaker.
6. **Storage**: MicroSD card (16 GB or 32 GB, Class 10 / A1) flashed with **Raspberry Pi OS 32-bit (Bookworm or Bullseye with desktop)**.

### ⚠️ Critical Power Safety Warning
- **Never attempt to power the 18.5" monitor from the Raspberry Pi's USB ports or 5V GPIO pins.** The Pi 2 can only deliver a maximum total of 600mA (or 1.2A with `max_usb_current=1`) across all USB ports, which is far below what an HDMI monitor requires (typically 12V 2A).
- **Use separate power supplies**:
  - Raspberry Pi 2: Dedicated 5V 2.5A microUSB power adapter.
  - 18.5" Monitor: Its own factory AC power adapter plugged into the wall outlet or power strip.

---

## 2. Online vs. Offline Feature Separation

| Feature | Works Offline (No Internet)? | Requires Internet? | Notes |
| :--- | :--- | :--- | :--- |
| **Digital Clock & Calendar Date** | ✅ Yes | ❌ No | Rendered locally in browser with JavaScript. |
| **Phone Remote Control (`/`)** | ✅ Yes | ❌ No | Works over local home Wi-Fi/Ethernet LAN. |
| **Calendar Schedule CRUD** | ✅ Yes | ❌ No | Persisted locally in SQLite (`smart_mirror.db`). |
| **Reminders (Daily / Weekly)** | ✅ Yes | ❌ No | Evaluated and stored locally on the Pi. |
| **To-Do Task List** | ✅ Yes | ❌ No | Stored locally in SQLite. |
| **Night Dimming** | ✅ Yes | ❌ No | Time comparison runs on the local Pi clock. |
| **PIN Security Gate** | ✅ Yes | ❌ No | Salted PBKDF2 verification runs locally in Python. |
| **Weather & Forecast** | ❌ No | ✅ Yes | Queries free Open-Meteo API (cached for 15 min). Shows graceful *"Weather currently unavailable"* when offline. |
| **News RSS Headlines** | ❌ No | ✅ Yes | Reads standard RSS XML feed (cached for 15 min). Shows *"News feed currently unavailable"* when offline. |
| **Voice Output Test** | ✅ Yes (Browser) | ❌ No | Uses device Web Speech API synthesizer. |

---

## 3. Raspberry Pi 2 Performance Limits & Compatibility

- **RAM Budget**: The Pi 2 has only 1 GB RAM shared between system and GPU. This app uses lightweight Python 3 + Flask + SQLite and vanilla HTML/CSS, taking under 35 MB of RAM on the server side and ~120 MB in Chromium.
- **No Node.js or Docker**: Avoid running Node build chains or Docker on the Pi 2. They will cause severe swapping and thermal throttling on the 32-bit quad-core 900MHz CPU.
- **Browser Speech Recognition**: Web Speech API speech *recognition* (microphone input) requires Google cloud servers in Chromium, which is often disabled or unverified on ARMv7 32-bit Linux. In contrast, the Phone Control Panel works 100% reliably via touch without needing any microphone.

---

## 4. Testing on Your Computer First (Mac / Linux / Windows)

Before moving files to the Raspberry Pi, test everything on your computer:

```bash
# 1. Open a terminal and enter the project directory
cd smart_mirror

# 2. (Optional but recommended) Create a virtual environment
python3 -m venv venv
source venv/bin/activate   # On Windows: venv\Scripts\activate

# 3. Install the minimal dependencies (takes ~5 seconds)
pip install -r requirements.txt

# 4. Start the server
python3 app.py
```

Now open in your computer browser:
- **Phone Control Panel**: `http://localhost:5000/` (Default PIN: `1234`)
- **Mirror Display**: `http://localhost:5000/mirror`

---

## 5. Raspberry Pi Setup Instructions (Raspberry Pi OS 32-bit)

### Step 1: Connect Pi to Local Network
Connect your Pi to your router using an Ethernet cable (recommended) or plug in your USB Wi-Fi dongle.

### Step 2: Find the Pi's Local IP Address
On the Pi's terminal (or via SSH):
```bash
hostname -I
```
*Example output:* `192.168.1.145`

### Step 3: Copy Files to the Pi
Copy the `smart_mirror` folder to `/home/pi/smart_mirror`. You can use `scp`, a USB drive, or Git:
```bash
# Example copying via SCP from your computer:
scp -r smart_mirror pi@192.168.1.145:/home/pi/
```

### Step 4: Install Dependencies on the Pi
```bash
# Update package index and ensure python3-pip is present
sudo apt update
sudo apt install -y python3-pip python3-flask python3-werkzeug unclutter

# Or install via pip:
cd /home/pi/smart_mirror
pip3 install -r requirements.txt
```

### Step 5: Test Run the Server on the Pi
```bash
cd /home/pi/smart_mirror
python3 app.py
```
Open a browser on your phone (connected to the same Wi-Fi) and type:
```
http://192.168.1.145:5000/
```
Enter PIN `1234` when prompted. You can now add events, to-dos, and adjust weather settings!

---

## 6. Autostart on Boot (Optional, Step-by-Step)

To have your smart mirror turn on automatically whenever the Pi is powered on:

### Step A: Enable Flask Server as a System Service
1. Copy the systemd service file:
   ```bash
   sudo cp /home/pi/smart_mirror/smartmirror.service /etc/systemd/system/
   ```
2. Reload systemd and enable the service:
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl enable smartmirror.service
   sudo systemctl start smartmirror.service
   ```
3. Verify it is running:
   ```bash
   sudo systemctl status smartmirror.service
   ```

### Step B: Enable Chromium Kiosk Mode on Display Boot
1. Make the autostart script executable:
   ```bash
   chmod +x /home/pi/smart_mirror/autostart_chromium.sh
   ```
2. In Raspberry Pi OS (LXDE desktop), edit the user autostart configuration:
   ```bash
   mkdir -p ~/.config/lxsession/LXDE-pi
   nano ~/.config/lxsession/LXDE-pi/autostart
   ```
3. Add the following line at the very bottom:
   ```bash
   @/home/pi/smart_mirror/autostart_chromium.sh
   ```
4. Save (`Ctrl+O`, `Enter`) and Exit (`Ctrl+X`).
5. Reboot the Pi:
   ```bash
   sudo reboot
   ```
When the desktop loads, Chromium will open in fullscreen kiosk mode on `http://localhost:5000/mirror`.

---

## 7. Troubleshooting & FAQ

- **How do I exit Chromium Kiosk Mode on the Pi?**
  Press `Alt + F4` or `Ctrl + W` on a keyboard connected to the Pi.
- **Phone cannot connect to `http://<PI_IP>:5000`?**
  1. Ensure both your phone and Pi are on the exact same home Wi-Fi network (some mesh routers separate 2.4GHz and 5GHz into guest networks).
  2. Confirm the server is bound to `0.0.0.0` (not `127.0.0.1`).
  3. Run `curl http://localhost:5000` on the Pi terminal to confirm the server is running.
- **Audio Output Test**:
  Test USB speaker audio on the Pi with:
  ```bash
  aplay /usr/share/sounds/alsa/Front_Center.wav
  ```
- **How to safely turn off the smart mirror?**
  Never unplug the power cord directly without shutting down, as this can corrupt the microSD card. Run:
  ```bash
  sudo poweroff
  ```
  Wait until the green ACT LED on the Pi stops blinking completely before disconnecting power.
