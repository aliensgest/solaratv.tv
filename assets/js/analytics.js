/* =============================================
   SOLARA TV - Click Tracking / Analytics System
   Copyright (c) 2026 solaratv.tv
   ============================================= */

const Analytics = {
  STORAGE_KEY: 'solaratv_analytics',

  init() {
    this.trackPageView();
    this.attachClickTracking();
  },

  getData() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || { pageViews: [], clicks: [] };
    } catch { return { pageViews: [], clicks: [] }; }
  },

  saveData(data) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
  },

  trackPageView() {
    const data = this.getData();
    const entry = {
      page: window.location.pathname,
      title: document.title,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent
    };
    data.pageViews.push(entry);
    // Keep last 1000 entries
    if (data.pageViews.length > 1000) {
      data.pageViews = data.pageViews.slice(-1000);
    }
    this.saveData(data);
  },

  trackClick(element, label) {
    const data = this.getData();
    const entry = {
      page: window.location.pathname,
      element: element.tagName,
      label: label || element.textContent?.trim().substring(0, 80) || '',
      id: element.id || '',
      className: element.className?.substring?.(0, 60) || '',
      timestamp: new Date().toISOString()
    };
    data.clicks.push(entry);
    if (data.clicks.length > 2000) {
      data.clicks = data.clicks.slice(-2000);
    }
    this.saveData(data);
  },

  attachClickTracking() {
    document.addEventListener('click', (e) => {
      const target = e.target.closest('a, button, .btn, [data-track]');
      if (target) {
        this.trackClick(target, target.getAttribute('data-track'));
      }
    });
  },

  getPageViewStats() {
    const data = this.getData();
    const views = data.pageViews;
    const pages = {};
    views.forEach(v => {
      const key = v.page;
      if (!pages[key]) pages[key] = { count: 0, title: v.title };
      pages[key].count++;
    });
    return Object.entries(pages)
      .map(([page, info]) => ({ page, ...info }))
      .sort((a, b) => b.count - a.count);
  },

  getClickStats() {
    const data = this.getData();
    const clicks = data.clicks;
    const labels = {};
    clicks.forEach(c => {
      const key = c.label || c.id || c.className;
      if (!labels[key]) labels[key] = { count: 0, page: c.page };
      labels[key].count++;
    });
    return Object.entries(labels)
      .map(([label, info]) => ({ label, ...info }))
      .sort((a, b) => b.count - a.count);
  },

  getTodayViews() {
    const data = this.getData();
    const today = new Date().toISOString().split('T')[0];
    return data.pageViews.filter(v => v.timestamp.startsWith(today)).length;
  },

  getTotalViews() {
    return this.getData().pageViews.length;
  },

  getTotalClicks() {
    return this.getData().clicks.length;
  },

  getViewsByDay(days = 7) {
    const data = this.getData();
    const result = [];
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];
      const count = data.pageViews.filter(v => v.timestamp.startsWith(dateStr)).length;
      result.push({ date: dateStr, count });
    }
    return result;
  },

  clearData() {
    localStorage.removeItem(this.STORAGE_KEY);
  }
};

Analytics.init();
