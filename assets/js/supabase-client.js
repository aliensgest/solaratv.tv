/* =============================================
   SOLARA TV - Supabase Client Wrapper
   Drop-in replacement for localStorage-based auth + data
   Docs: https://supabase.com/docs
   ============================================= */

// CONFIG — public values only (anon key is safe in browser, protected by RLS)
// Dashboard: https://supabase.com/dashboard/project/nuadbjtwcksoqheyushw
window.SUPABASE_CONFIG = window.SUPABASE_CONFIG || {
  url:     'https://nuadbjtwcksoqheyushw.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im51YWRianR3Y2tzb3FoZXl1c2h3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NzgzMDcsImV4cCI6MjA5NjA1NDMwN30.T_Bx7-NfSrx_PUAaI8K4V_mFPY6WovuGNE9-xs52H9M'
};

// Load Supabase JS SDK from CDN (no build step required)
(function loadSdk() {
  if (window.supabase) return;
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
  s.defer = true;
  document.head.appendChild(s);
})();

const SolaraDB = {
  _client: null,

  client() {
    if (this._client) return this._client;
    if (!window.supabase) return null;
    const { url, anonKey } = window.SUPABASE_CONFIG;
    if (!url || url.startsWith('YOUR_')) return null;
    this._client = window.supabase.createClient(url, anonKey);
    return this._client;
  },

  isReady() { return !!this.client(); },

  /* ========== AUTH ========== */
  async register(email, password, username) {
    const c = this.client(); if (!c) throw new Error('Supabase not configured');
    const { data, error } = await c.auth.signUp({
      email, password,
      options: { data: { username, role: 'client' } }
    });
    if (error) return { success: false, message: error.message };
    return { success: true, user: data.user };
  },

  async login(email, password) {
    const c = this.client(); if (!c) throw new Error('Supabase not configured');
    const { data, error } = await c.auth.signInWithPassword({ email, password });
    if (error) return { success: false, message: error.message };
    return { success: true, session: data.session, user: data.user };
  },

  async logout() {
    const c = this.client(); if (!c) return;
    await c.auth.signOut();
  },

  async getUser() {
    const c = this.client(); if (!c) return null;
    const { data } = await c.auth.getUser();
    return data.user;
  },

  async getSession() {
    const c = this.client(); if (!c) return null;
    const { data } = await c.auth.getSession();
    return data.session;
  },

  /* ========== USERS TABLE ========== */
  async listUsers() {
    const c = this.client(); if (!c) return [];
    const { data, error } = await c.from('profiles').select('*').order('created_at', { ascending: false });
    if (error) { console.error(error); return []; }
    return data;
  },

  /* ========== SUBSCRIPTIONS ========== */
  async createSubscription(row) {
    const c = this.client(); if (!c) throw new Error('Supabase not configured');
    const { data, error } = await c.from('subscriptions').insert(row).select().single();
    if (error) return { success: false, message: error.message };
    return { success: true, data };
  },

  async listSubscriptions(limit = 200) {
    const c = this.client(); if (!c) return [];
    const { data, error } = await c.from('subscriptions').select('*').order('created_at', { ascending: false }).limit(limit);
    if (error) { console.error(error); return []; }
    return data;
  },

  /* ========== BLOG ========== */
  async listPosts(publishedOnly = true) {
    const c = this.client(); if (!c) return [];
    let q = c.from('posts').select('*').order('created_at', { ascending: false });
    if (publishedOnly) q = q.eq('published', true);
    const { data, error } = await q;
    if (error) { console.error(error); return []; }
    return data;
  },

  async upsertPost(post) {
    const c = this.client(); if (!c) throw new Error('Supabase not configured');
    const { data, error } = await c.from('posts').upsert(post).select().single();
    if (error) return { success: false, message: error.message };
    return { success: true, data };
  },

  async deletePost(id) {
    const c = this.client(); if (!c) return false;
    const { error } = await c.from('posts').delete().eq('id', id);
    return !error;
  },

  /* ========== ANALYTICS ========== */
  async trackPageView(page) {
    const c = this.client(); if (!c) return;
    await c.from('page_views').insert({ page, viewed_at: new Date().toISOString() });
  },

  async getAnalyticsSummary(days = 7) {
    const c = this.client(); if (!c) return [];
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const { data, error } = await c.from('page_views').select('page, viewed_at').gte('viewed_at', since);
    if (error) { console.error(error); return []; }
    return data;
  }
};

window.SolaraDB = SolaraDB;
