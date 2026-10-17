/**
 * LuminaMirror - Client Display Script
 * Ultra-lightweight vanilla JS designed for Chromium on Raspberry Pi 2 (1 GB RAM).
 * Runs the clock locally at 1 Hz and polls the consolidated API every 60 seconds.
 */

(function () {
  'use strict';

  // Elements
  const timeHoursEl = document.getElementById('clock-hours-mins');
  const timeSecondsEl = document.getElementById('clock-seconds');
  const timeAmpmEl = document.getElementById('clock-ampm');
  const clockDateEl = document.getElementById('clock-date');
  const greetingEl = document.getElementById('center-greeting');
  const weatherContainerEl = document.getElementById('weather-container');
  const scheduleContainerEl = document.getElementById('schedule-container');
  const todoContainerEl = document.getElementById('todo-container');
  const tickerContentEl = document.getElementById('ticker-content');
  const dimmingOverlayEl = document.getElementById('dimming-overlay');

  // Utility to prevent XSS
  function escapeHTML(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // 1. Local Real-Time Clock
  function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12;
    hours = hours ? hours : 12; // 12-hour format

    if (timeHoursEl) timeHoursEl.textContent = `${hours}:${minutes}`;
    if (timeSecondsEl) timeSecondsEl.textContent = `:${seconds}`;
    if (timeAmpmEl) timeAmpmEl.textContent = ampm;

    if (clockDateEl) {
      const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
      clockDateEl.textContent = now.toLocaleDateString(undefined, options);
    }
  }

  // 2. Render Weather
  function renderWeather(weather) {
    if (!weatherContainerEl) return;

    if (!weather || !weather.available) {
      weatherContainerEl.innerHTML = `
        <div class="unavailable-badge">
          Weather currently unavailable
        </div>
      `;
      return;
    }

    const currentTemp = weather.temperature;
    const unit = weather.unit || '°F';
    const condition = escapeHTML(weather.condition || 'Fair');
    const icon = weather.icon || '☀️';
    const city = escapeHTML(weather.city || '');

    let forecastHTML = '';
    if (Array.isArray(weather.forecast) && weather.forecast.length > 0) {
      forecastHTML = `
        <div class="weather-forecast">
          ${weather.forecast.map(f => `
            <div class="forecast-item">
              <span class="forecast-day">${escapeHTML(f.day)}</span>
              <span class="forecast-icon">${f.icon}</span>
              <span class="forecast-temps">${f.high}° / ${f.low}°</span>
            </div>
          `).join('')}
        </div>
      `;
    }

    weatherContainerEl.innerHTML = `
      <div class="weather-current">
        <span class="weather-icon">${icon}</span>
        <span class="weather-temp">${currentTemp}${unit}</span>
      </div>
      <div class="weather-details">
        <span>${condition}</span>
        ${city ? `<span>• ${city}</span>` : ''}
      </div>
      ${forecastHTML}
    `;
  }

  // 3. Render Calendar & Reminders
  function renderSchedule(events, reminders) {
    if (!scheduleContainerEl) return;

    const items = [];

    // Add calendar events
    if (Array.isArray(events)) {
      events.forEach(evt => {
        items.push({
          time: evt.start_time || '',
          title: evt.title || '',
          sub: evt.location || '',
          type: 'event'
        });
      });
    }

    // Add active reminders
    if (Array.isArray(reminders)) {
      reminders.forEach(rem => {
        items.push({
          time: rem.reminder_time || '',
          title: rem.title || '',
          repeat: rem.repeat_type !== 'none' ? rem.repeat_type : '',
          type: 'reminder'
        });
      });
    }

    // Sort combined by time
    items.sort((a, b) => (a.time > b.time ? 1 : -1));

    if (items.length === 0) {
      scheduleContainerEl.innerHTML = `
        <div class="unavailable-badge">No upcoming events or reminders</div>
      `;
      return;
    }

    scheduleContainerEl.innerHTML = items.slice(0, 5).map(item => `
      <div class="schedule-item">
        <span class="item-time">${escapeHTML(item.time)}</span>
        <span class="item-title">${escapeHTML(item.title)}</span>
        ${item.repeat ? `<span class="item-repeat">${escapeHTML(item.repeat)}</span>` : ''}
      </div>
    `).join('');
  }

  // 4. Render To-Do Items
  function renderTodos(todos) {
    if (!todoContainerEl) return;

    if (!Array.isArray(todos) || todos.length === 0) {
      todoContainerEl.innerHTML = `
        <div class="unavailable-badge">All tasks completed</div>
      `;
      return;
    }

    todoContainerEl.innerHTML = todos.slice(0, 6).map(t => `
      <div class="todo-item">
        <span>${escapeHTML(t.task)}</span>
        <span class="todo-bullet"></span>
      </div>
    `).join('');
  }

  // 5. Render News Ticker
  function renderNews(news) {
    if (!tickerContentEl) return;

    if (!news || !news.available || !Array.isArray(news.items) || news.items.length === 0) {
      tickerContentEl.innerHTML = `
        <span class="ticker-item">News feed currently unavailable • LuminaMirror offline mode active</span>
      `;
      return;
    }

    // Duplicate headlines once to ensure infinite seamless CSS keyframe loop
    const combined = [...news.items, ...news.items];
    tickerContentEl.innerHTML = combined.map(item => `
      <span class="ticker-item">${escapeHTML(item)}</span>
    `).join('');
  }

  // 6. Apply Night Dimming
  function applyDimming(dimming) {
    if (!dimmingOverlayEl) return;

    if (dimming && dimming.active) {
      // Dim overlay opacity (e.g. 0.65 dark layer gives 35% visible light)
      const overlayAlpha = 1.0 - (dimming.opacity || 0.35);
      dimmingOverlayEl.style.opacity = String(overlayAlpha);
    } else {
      dimmingOverlayEl.style.opacity = '0';
    }
  }

  // 7. Fetch Consolidated Data from Pi Flask Server
  async function fetchMirrorData() {
    try {
      const response = await fetch('/api/mirror-data', {
        headers: { 'Accept': 'application/json' },
        cache: 'no-cache'
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();

      if (greetingEl) {
        const greet = (data.greeting || 'Good morning').replace(/[,!.]+$/, '') + ',';
        const name = data.user_name || 'Alex';
        greetingEl.innerHTML = `<div style="font-size: 1rem; letter-spacing: 0.25em; text-transform: uppercase; color: rgba(255,255,255,0.6);">${escapeHTML(greet)}</div><div style="font-size: 1.75rem; font-weight: 500; color: #ffffff; margin-top: 4px;">${escapeHTML(name)}</div>`;
      }

      renderWeather(data.weather);
      renderSchedule(data.calendar_events, data.reminders);
      renderTodos(data.todos);
      renderNews(data.news);
      applyDimming(data.night_dimming);

    } catch (err) {
      console.warn('LuminaMirror fetch note (preserved existing view):', err.message);
      // If server or network is temporarily unreachable, keep display steady
    }
  }

  // Init
  updateClock();
  setInterval(updateClock, 1000);

  fetchMirrorData();
  setInterval(fetchMirrorData, 60000); // Poll once a minute to preserve Pi 2 resources

})();
