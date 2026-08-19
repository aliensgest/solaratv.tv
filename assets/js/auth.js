/* =============================================
   SOLARA TV - Authentication System
   localStorage-based auth for GitHub Pages
   Copyright (c) 2026 solaratv.tv
   ============================================= */

const Auth = {
  STORAGE_KEY: 'solaratv_users',
  SESSION_KEY: 'solaratv_session',

  init() {
    const users = this.getUsers();
    if (!users.find(u => u.role === 'admin')) {
      this.createUser('admin', 'admin@solaratv.tv', 'SolaraAdmin2026!', 'admin');
    }
  },

  getUsers() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch { return []; }
  },

  saveUsers(users) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(users));
  },

  async hashPassword(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password + 'solaratv_salt_2026');
    const hash = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  },

  async createUser(username, email, password, role = 'client') {
    const users = this.getUsers();
    if (users.find(u => u.username === username || u.email === email)) {
      return { success: false, message: 'Username or email already exists' };
    }
    const hashedPassword = await this.hashPassword(password);
    const user = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      username,
      email,
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString()
    };
    users.push(user);
    this.saveUsers(users);
    return { success: true, user };
  },

  _supa() {
    return (window.SolaraDB && SolaraDB.isReady && SolaraDB.isReady()) ? SolaraDB.client() : null;
  },

  /** Register a new account — Supabase first, localStorage fallback */
  async register(username, email, password, role = 'client') {
    const sb = this._supa();
    if (sb) {
      try {
        const { data, error } = await sb.auth.signUp({
          email, password,
          options: { data: { username, role } }
        });
        if (!error && data && data.user) {
          return { success: true, user: data.user };
        }
        return { success: false, message: error?.message || 'Registration failed' };
      } catch (err) {
        return { success: false, message: err.message || 'Registration failed' };
      }
    }
    return this.createUser(username, email, password, role);
  },

  async login(username, password) {
    // 1) Try Supabase first (email-based)
    const sb = this._supa();
    if (sb && username.includes('@')) {
      try {
        const { data, error } = await sb.auth.signInWithPassword({ email: username, password });
        if (!error && data && data.user) {
          let role = 'client', uname = username.split('@')[0];
          try {
            const { data: prof } = await sb.from('profiles').select('role, username').eq('id', data.user.id).maybeSingle();
            if (prof) { role = prof.role || 'client'; uname = prof.username || uname; }
          } catch {}
          const session = {
            userId: data.user.id, username: uname, email: data.user.email,
            role, loginAt: new Date().toISOString(), source: 'supabase'
          };
          this._saveSession(session);
          return { success: true, session };
        }
        // fall through to localStorage on Supabase failure
      } catch {}
    }
    // 2) Fallback: legacy localStorage auth
    const users = this.getUsers();
    const hashedPassword = await this.hashPassword(password);
    const user = users.find(u =>
      (u.username === username || u.email === username) && u.password === hashedPassword
    );
    if (!user) {
      return { success: false, message: 'Invalid username or password' };
    }
    const session = {
      userId: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      loginAt: new Date().toISOString(),
      source: 'local'
    };
    this._saveSession(session);
    return { success: true, session };
  },

  getSession() {
    try {
      // Prefer persistent (localStorage); fallback to legacy sessionStorage
      return JSON.parse(localStorage.getItem(this.SESSION_KEY))
          || JSON.parse(sessionStorage.getItem(this.SESSION_KEY));
    } catch { return null; }
  },

  _saveSession(session) {
    const json = JSON.stringify(session);
    localStorage.setItem(this.SESSION_KEY, json);
    sessionStorage.setItem(this.SESSION_KEY, json);
  },

  _clearSession() {
    localStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.SESSION_KEY);
  },

  /** Restore session from Supabase JWT if we lost the local copy */
  async restoreFromSupabase() {
    const sb = this._supa();
    if (!sb) return null;
    try {
      const { data } = await sb.auth.getSession();
      if (!data || !data.session || !data.session.user) return null;
      const u = data.session.user;
      let role = 'client', uname = (u.email || '').split('@')[0];
      try {
        const { data: prof } = await sb.from('profiles').select('role, username').eq('id', u.id).maybeSingle();
        if (prof) { role = prof.role || 'client'; uname = prof.username || uname; }
      } catch {}
      const session = { userId: u.id, username: uname, email: u.email, role, loginAt: new Date().toISOString(), source: 'supabase' };
      this._saveSession(session);
      return session;
    } catch { return null; }
  },

  isLoggedIn() {
    return this.getSession() !== null;
  },

  isAdmin() {
    const session = this.getSession();
    return session && session.role === 'admin';
  },

  // Compute relative paths based on current location depth
  _getPath(target) {
    const path = window.location.pathname;
    const inSub = path.includes('/admin/') || path.includes('/client/');
    const prefix = inSub ? '../' : '';
    return prefix + target;
  },

  async logout() {
    this._clearSession();
    const sb = this._supa();
    if (sb) { try { await sb.auth.signOut(); } catch {} }
    window.location.href = this._getPath('login.html');
  },

  requireAuth(requiredRole) {
    const session = this.getSession();
    if (session) {
      if (requiredRole && session.role !== requiredRole) {
        window.location.href = session.role === 'admin' ? this._getPath('admin/index.html') : this._getPath('client/index.html');
        return false;
      }
      return true;
    }
    // No local session — try restoring from Supabase JWT before redirecting
    this.restoreFromSupabase().then(s => {
      if (s && (!requiredRole || s.role === requiredRole)) {
        location.reload();
      } else {
        window.location.href = this._getPath('login.html');
      }
    });
    return false;
  }
};

Auth.init();
