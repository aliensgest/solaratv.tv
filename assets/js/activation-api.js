/* =============================================
   SOLARA TV - Activation Panel API Wrapper
   API: https://activationpanel.net/api/api.php
   Copyright (c) 2026 solaratv.tv
   ============================================= */

const ActivationAPI = {
  SETTINGS_KEY: 'solaratv_api_settings',
  BASE_URL: 'https://activationpanel.net/api/api.php',

  // --- Settings ---
  getSettings() {
    try {
      return JSON.parse(localStorage.getItem(this.SETTINGS_KEY)) || {};
    } catch { return {}; }
  },

  saveSettings(settings) {
    localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(settings));
  },

  getApiKey() {
    return this.getSettings().api_key || '';
  },

  setApiKey(key) {
    const s = this.getSettings();
    s.api_key = key;
    this.saveSettings(s);
  },

  // --- Core request ---
  async request(params) {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      return { status: 'false', message: 'API key not configured. Go to API Settings.' };
    }
    params.api_key = apiKey;

    const url = this.BASE_URL + '?' + new URLSearchParams(params).toString();
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      // API returns array with single object
      return Array.isArray(data) ? data[0] : data;
    } catch (err) {
      return { status: 'false', message: 'Network error: ' + err.message };
    }
  },

  // --- Add New Subscription ---
  async addM3U(sub, pack, note) {
    const params = { action: 'new', type: 'm3u', sub, pack };
    if (note) params.note = note;
    return this.request(params);
  },

  async addMAG(mac, sub, pack, note) {
    const params = { action: 'new', type: 'mag', mac, sub, pack };
    if (note) params.note = note;
    return this.request(params);
  },

  async addProtocol(sub, pack) {
    return this.request({ action: 'new', type: 'protocol', sub, pack });
  },

  // --- Renew ---
  async renewM3U(username, password, sub) {
    return this.request({ action: 'renew', type: 'm3u', username, password, sub });
  },

  async renewMAG(mac, sub) {
    return this.request({ action: 'renew', type: 'mag', mac, sub });
  },

  // --- Info ---
  async getDeviceInfoM3U(username, password) {
    return this.request({ action: 'device_info', username, password });
  },

  async getDeviceInfoMAG(mac) {
    return this.request({ action: 'device_info', mac });
  },

  async getBouquets() {
    const apiKey = this.getApiKey();
    if (!apiKey) return [];
    try {
      const res = await fetch(this.BASE_URL + '?' + new URLSearchParams({ action: 'bouquet', api_key: apiKey }));
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch { return []; }
  },

  async getResellerInfo() {
    return this.request({ action: 'reseller_info' });
  },

  // --- Local subscription history ---
  HISTORY_KEY: 'solaratv_sub_history',

  getHistory() {
    try { return JSON.parse(localStorage.getItem(this.HISTORY_KEY)) || []; }
    catch { return []; }
  },

  addToHistory(entry) {
    const h = this.getHistory();
    entry.date = new Date().toISOString();
    h.unshift(entry);
    // keep last 200
    if (h.length > 200) h.length = 200;
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(h));
  },

  clearHistory() {
    localStorage.removeItem(this.HISTORY_KEY);
  }
};
