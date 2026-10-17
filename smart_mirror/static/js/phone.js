/**
 * LuminaMirror - Phone Remote Control Client Logic
 * Handles local network SQLite CRUD, PIN authorization, and Speech Synthesis.
 */

(function () {
  'use strict';

  // State
  let isAuthenticated = false;
  let activePinBuffer = '';

  // Elements
  const toastEl = document.getElementById('toast-banner');
  const authModalEl = document.getElementById('auth-modal');
  const pinDisplayEl = document.getElementById('pin-display');
  const authErrorEl = document.getElementById('auth-error');

  // Show Toast
  function showToast(message, type = 'success') {
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.className = `toast-banner show ${type === 'error' ? 'toast-error' : 'toast-success'}`;
    setTimeout(() => {
      toastEl.classList.remove('show');
    }, 3500);
  }

  // HTTP Helper with JSON
  async function apiRequest(url, method = 'GET', body = null) {
    const options = {
      method: method,
      headers: {
        'Accept': 'application/json'
      }
    };
    if (body) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }
    const response = await fetch(url, options);
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        showAuthModal();
      }
      throw new Error(data.error || 'Server error');
    }
    return data;
  }

  // --- PIN Auth & Keypad ---
  function showAuthModal() {
    activePinBuffer = '';
    updatePinDisplay();
    if (authErrorEl) authErrorEl.textContent = '';
    if (authModalEl) authModalEl.style.display = 'flex';
  }

  function hideAuthModal() {
    if (authModalEl) authModalEl.style.display = 'none';
  }

  function updatePinDisplay() {
    if (!pinDisplayEl) return;
    pinDisplayEl.value = '•'.repeat(activePinBuffer.length);
  }

  async function submitPin() {
    if (activePinBuffer.length < 4) {
      if (authErrorEl) authErrorEl.textContent = 'Please enter at least 4 digits.';
      return;
    }
    try {
      await apiRequest('/api/auth/verify', 'POST', { pin: activePinBuffer });
      isAuthenticated = true;
      hideAuthModal();
      showToast('Unlocked successfully');
      loadAllData();
    } catch (err) {
      activePinBuffer = '';
      updatePinDisplay();
      if (authErrorEl) authErrorEl.textContent = err.message || 'Incorrect access code';
    }
  }

  // Check initial Auth
  async function checkAuth() {
    try {
      const res = await apiRequest('/api/auth/status');
      isAuthenticated = res.authenticated;
      if (!isAuthenticated) {
        showAuthModal();
      } else {
        loadAllData();
      }
    } catch (e) {
      showAuthModal();
    }
  }

  // Keypad clicks
  document.querySelectorAll('.keypad-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const val = btn.getAttribute('data-val');
      if (val === 'clear') {
        activePinBuffer = '';
        updatePinDisplay();
      } else if (val === 'enter') {
        submitPin();
      } else if (val) {
        if (activePinBuffer.length < 8) {
          activePinBuffer += val;
          updatePinDisplay();
        }
      }
    });
  });

  // --- Tab Navigation ---
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      tabButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const panel = document.getElementById(targetId);
      if (panel) panel.classList.add('active');
    });
  });

  // --- Schedule / Calendar ---
  const scheduleListEl = document.getElementById('schedule-list');
  const addEventForm = document.getElementById('add-event-form');

  async function loadSchedule() {
    try {
      const data = await apiRequest('/api/schedule');
      if (!scheduleListEl) return;

      if (!data.events || data.events.length === 0) {
        scheduleListEl.innerHTML = '<div style="color: var(--text-muted); padding: 12px; text-align: center;">No scheduled events.</div>';
        return;
      }

      scheduleListEl.innerHTML = data.events.map(evt => `
        <div class="item-row">
          <div class="item-main">
            <div class="item-title-text">${escapeText(evt.title)}</div>
            <div class="item-sub-text">${evt.event_date} at ${evt.start_time} ${evt.location ? '• ' + escapeText(evt.location) : ''}</div>
          </div>
          <button class="btn-danger" data-delete-event="${evt.id}">Delete</button>
        </div>
      `).join('');

      scheduleListEl.querySelectorAll('[data-delete-event]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-delete-event');
          try {
            await apiRequest(`/api/schedule/${id}`, 'DELETE');
            showToast('Event removed');
            loadSchedule();
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });
    } catch (e) {
      console.warn(e);
    }
  }

  if (addEventForm) {
    addEventForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('event-title').value.trim();
      const event_date = document.getElementById('event-date').value;
      const start_time = document.getElementById('event-start-time').value;
      const end_time = document.getElementById('event-end-time').value;
      const location = document.getElementById('event-location').value.trim();

      if (!title || !event_date || !start_time) {
        showToast('Please fill in event title, date, and time', 'error');
        return;
      }

      try {
        await apiRequest('/api/schedule', 'POST', {
          title,
          event_date,
          start_time,
          end_time,
          location
        });
        showToast('Calendar event created');
        addEventForm.reset();
        loadSchedule();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // --- Reminders ---
  const remindersListEl = document.getElementById('reminders-list');
  const addReminderForm = document.getElementById('add-reminder-form');
  const repeatTypeSelect = document.getElementById('reminder-repeat-type');
  const repeatDayGroup = document.getElementById('reminder-day-group');

  if (repeatTypeSelect && repeatDayGroup) {
    repeatTypeSelect.addEventListener('change', () => {
      repeatDayGroup.style.display = repeatTypeSelect.value === 'weekly' ? 'block' : 'none';
    });
  }

  async function loadReminders() {
    try {
      const data = await apiRequest('/api/reminders');
      if (!remindersListEl) return;

      if (!data.reminders || data.reminders.length === 0) {
        remindersListEl.innerHTML = '<div style="color: var(--text-muted); padding: 12px; text-align: center;">No active reminders.</div>';
        return;
      }

      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

      remindersListEl.innerHTML = data.reminders.map(rem => {
        let repeatBadge = '';
        if (rem.repeat_type === 'daily') repeatBadge = '<span class="badge">Daily</span>';
        else if (rem.repeat_type === 'weekly') {
          const dayName = rem.repeat_day !== null && rem.repeat_day !== undefined ? days[rem.repeat_day] : '';
          repeatBadge = `<span class="badge">Every ${dayName}</span>`;
        }

        return `
          <div class="item-row">
            <div class="item-main">
              <div class="item-title-text">${escapeText(rem.title)}</div>
              <div class="item-sub-text">${rem.reminder_time} ${repeatBadge}</div>
            </div>
            <button class="btn-danger" data-delete-reminder="${rem.id}">Delete</button>
          </div>
        `;
      }).join('');

      remindersListEl.querySelectorAll('[data-delete-reminder]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-delete-reminder');
          try {
            await apiRequest(`/api/reminders/${id}`, 'DELETE');
            showToast('Reminder deleted');
            loadReminders();
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });
    } catch (e) {
      console.warn(e);
    }
  }

  if (addReminderForm) {
    addReminderForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const title = document.getElementById('reminder-title').value.trim();
      const reminder_time = document.getElementById('reminder-time').value;
      const repeat_type = document.getElementById('reminder-repeat-type').value;
      const repeat_day_val = document.getElementById('reminder-day').value;
      const repeat_day = repeat_type === 'weekly' ? parseInt(repeat_day_val, 10) : null;

      if (!title || !reminder_time) {
        showToast('Please enter reminder title and time', 'error');
        return;
      }

      try {
        await apiRequest('/api/reminders', 'POST', {
          title,
          reminder_time,
          repeat_type,
          repeat_day
        });
        showToast('Reminder created');
        addReminderForm.reset();
        if (repeatDayGroup) repeatDayGroup.style.display = 'none';
        loadReminders();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // --- To-Do List ---
  const todosListEl = document.getElementById('todos-list');
  const addTodoForm = document.getElementById('add-todo-form');

  async function loadTodos() {
    try {
      const data = await apiRequest('/api/todos');
      if (!todosListEl) return;

      if (!data.todos || data.todos.length === 0) {
        todosListEl.innerHTML = '<div style="color: var(--text-muted); padding: 12px; text-align: center;">No tasks. Add one above!</div>';
        return;
      }

      todosListEl.innerHTML = data.todos.map(t => `
        <div class="item-row" style="${t.is_completed ? 'opacity: 0.6;' : ''}">
          <input type="checkbox" class="switch-checkbox" data-toggle-todo="${t.id}" ${t.is_completed ? 'checked' : ''} style="margin-right: 12px;">
          <div class="item-main">
            <span class="item-title-text" style="${t.is_completed ? 'text-decoration: line-through;' : ''}">${escapeText(t.task)}</span>
          </div>
          <button class="btn-danger" data-delete-todo="${t.id}">Delete</button>
        </div>
      `).join('');

      todosListEl.querySelectorAll('[data-toggle-todo]').forEach(cb => {
        cb.addEventListener('change', async () => {
          const id = cb.getAttribute('data-toggle-todo');
          try {
            await apiRequest(`/api/todos/${id}/toggle`, 'POST');
            loadTodos();
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });

      todosListEl.querySelectorAll('[data-delete-todo]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-delete-todo');
          try {
            await apiRequest(`/api/todos/${id}`, 'DELETE');
            showToast('Task removed');
            loadTodos();
          } catch (e) {
            showToast(e.message, 'error');
          }
        });
      });
    } catch (e) {
      console.warn(e);
    }
  }

  if (addTodoForm) {
    addTodoForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const taskInput = document.getElementById('todo-task');
      const task = taskInput.value.trim();
      if (!task) return;

      try {
        await apiRequest('/api/todos', 'POST', { task });
        taskInput.value = '';
        showToast('Task added');
        loadTodos();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // --- Mirror Settings ---
  const settingsForm = document.getElementById('settings-form');

  async function loadSettings() {
    try {
      const data = await apiRequest('/api/settings');
      const s = data.settings || {};

      if (document.getElementById('setting-greeting')) {
        document.getElementById('setting-greeting').value = s.greeting || 'Good morning';
      }
      if (document.getElementById('setting-city')) {
        document.getElementById('setting-city').value = s.weather_city || '';
      }
      if (document.getElementById('setting-lat')) {
        document.getElementById('setting-lat').value = s.weather_lat || '40.7128';
      }
      if (document.getElementById('setting-lon')) {
        document.getElementById('setting-lon').value = s.weather_lon || '-74.0060';
      }
      if (document.getElementById('setting-units')) {
        document.getElementById('setting-units').value = s.weather_units || 'fahrenheit';
      }
      if (document.getElementById('setting-news-url')) {
        document.getElementById('setting-news-url').value = s.news_feed_url || '';
      }
      if (document.getElementById('setting-night-dim')) {
        document.getElementById('setting-night-dim').checked = s.night_dim_enabled === '1';
      }
      if (document.getElementById('setting-dim-start')) {
        document.getElementById('setting-dim-start').value = s.night_dim_start || '22';
      }
      if (document.getElementById('setting-dim-end')) {
        document.getElementById('setting-dim-end').value = s.night_dim_end || '7';
      }
      if (document.getElementById('setting-dim-opacity')) {
        document.getElementById('setting-dim-opacity').value = s.night_dim_opacity || '0.35';
      }
    } catch (e) {
      console.warn(e);
    }
  }

  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const updates = {
        greeting: document.getElementById('setting-greeting').value.trim(),
        weather_city: document.getElementById('setting-city').value.trim(),
        weather_lat: parseFloat(document.getElementById('setting-lat').value) || 0,
        weather_lon: parseFloat(document.getElementById('setting-lon').value) || 0,
        weather_units: document.getElementById('setting-units').value,
        news_feed_url: document.getElementById('setting-news-url').value.trim(),
        night_dim_enabled: document.getElementById('setting-night-dim').checked ? '1' : '0',
        night_dim_start: parseInt(document.getElementById('setting-dim-start').value, 10) || 22,
        night_dim_end: parseInt(document.getElementById('setting-dim-end').value, 10) || 7,
        night_dim_opacity: parseFloat(document.getElementById('setting-dim-opacity').value) || 0.35
      };

      try {
        await apiRequest('/api/settings', 'PUT', updates);
        showToast('Settings saved to SQLite');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // --- Change PIN ---
  const changePinForm = document.getElementById('change-pin-form');
  if (changePinForm) {
    changePinForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const currentPin = document.getElementById('current-pin-input').value.trim();
      const newPin = document.getElementById('new-pin-input').value.trim();
      const confirmPin = document.getElementById('confirm-pin-input').value.trim();

      if (newPin !== confirmPin) {
        showToast('New PIN and confirmation do not match', 'error');
        return;
      }
      if (newPin.length < 4 || !/^\d+$/.test(newPin)) {
        showToast('PIN must be at least 4 numeric digits', 'error');
        return;
      }

      try {
        await apiRequest('/api/auth/change-pin', 'POST', {
          current_pin: currentPin,
          new_pin: newPin
        });
        showToast('Access PIN changed successfully');
        changePinForm.reset();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // --- Voice Test Button ---
  const testVoiceBtn = document.getElementById('btn-test-voice');
  const voiceStatusMsg = document.getElementById('voice-status-msg');

  if (testVoiceBtn) {
    testVoiceBtn.addEventListener('click', async () => {
      try {
        const res = await apiRequest('/api/voice/test', 'POST');
        const textToSpeak = res.text || 'Lumina Mirror is online and ready.';

        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(textToSpeak);
          utterance.rate = 0.95;
          utterance.pitch = 1.0;
          window.speechSynthesis.speak(utterance);
          if (voiceStatusMsg) {
            voiceStatusMsg.textContent = 'Speaking on phone speaker: "' + textToSpeak + '"';
          }
          showToast('Playing voice test...');
        } else {
          if (voiceStatusMsg) {
            voiceStatusMsg.textContent = 'Speech synthesis unsupported in this browser. (Server payload: ' + textToSpeak + ')';
          }
          showToast('Speech synthesis not supported in this phone browser', 'error');
        }
      } catch (e) {
        showToast(e.message, 'error');
      }
    });
  }

  // Lock Button
  const btnLock = document.getElementById('btn-lock');
  if (btnLock) {
    btnLock.addEventListener('click', async () => {
      try {
        await apiRequest('/api/auth/logout', 'POST');
        isAuthenticated = false;
        showAuthModal();
      } catch (e) {
        showAuthModal();
      }
    });
  }

  function loadAllData() {
    loadSchedule();
    loadReminders();
    loadTodos();
    loadSettings();
  }

  function escapeText(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Set default date input to today
  const todayStr = new Date().toISOString().split('T')[0];
  const eventDateInput = document.getElementById('event-date');
  if (eventDateInput) eventDateInput.value = todayStr;

  checkAuth();

})();
