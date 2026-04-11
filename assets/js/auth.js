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

  async login(username, password) {
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
      loginAt: new Date().toISOString()
    };
    sessionStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    return { success: true, session };
  },

  getSession() {
    try {
      return JSON.parse(sessionStorage.getItem(this.SESSION_KEY));
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

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    window.location.href = this._getPath('login.html');
  },

  requireAuth(requiredRole) {
    const session = this.getSession();
    if (!session) {
      window.location.href = this._getPath('login.html');
      return false;
    }
    if (requiredRole && session.role !== requiredRole) {
      window.location.href = session.role === 'admin' ? this._getPath('admin/index.html') : this._getPath('client/index.html');
      return false;
    }
    return true;
  }
};

Auth.init();
