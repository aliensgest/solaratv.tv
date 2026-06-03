/* =============================================
   SOLARA TV — Blog System (Supabase-first, localStorage fallback)
   API is async: all read/write methods return Promises.
   Callers should `await` the result.
   ============================================= */

const Blog = {
  STORAGE_KEY: 'solaratv_blogs',
  TABLE: 'posts',

  /* ---------- internal helpers ---------- */
  _supa() {
    return (window.SolaraDB && window.SolaraDB.isReady && window.SolaraDB.isReady())
      ? window.SolaraDB.client() : null;
  },

  _localAll() {
    try { return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || []; }
    catch { return []; }
  },
  _localSave(arr) { localStorage.setItem(this.STORAGE_KEY, JSON.stringify(arr)); },

  _genId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
  },

  generateSlug(title) {
    return (title || '').toString().toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '')
      .slice(0, 80) || this._genId();
  },

  /* Normalize a Supabase row to the shape the UI expects */
  _fromSupabase(row) {
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      excerpt: row.excerpt || '',
      content: row.content || '',
      image: row.cover_image || row.image || '',
      category: row.category || 'IPTV',
      author: row.author || 'SOLARA TV',
      tags: row.tags || [],
      status: row.published ? 'published' : 'draft',
      createdAt: row.created_at,
      updatedAt: row.updated_at
    };
  },

  /* Normalize UI input to Supabase row */
  _toSupabase(data, existing) {
    const title = data.title || existing?.title || '';
    return {
      slug: data.slug || existing?.slug || this.generateSlug(title),
      title,
      excerpt: data.excerpt || '',
      content: data.content || '',
      cover_image: data.image || existing?.image || null,
      category: data.category || existing?.category || 'IPTV',
      author: data.author || existing?.author || 'SOLARA TV',
      tags: data.tags || existing?.tags || [],
      published: (data.status || existing?.status) === 'published'
    };
  },

  /* ---------- public async API ---------- */

  /** True if reads/writes go to Supabase */
  isCloud() { return !!this._supa(); },

  async getAll() {
    const c = this._supa();
    if (c) {
      const { data, error } = await c.from(this.TABLE)
        .select('*').order('created_at', { ascending: false });
      if (error) { console.warn('[Blog] supabase getAll error', error); return this._localAll(); }
      return data.map(r => this._fromSupabase(r));
    }
    return this._localAll().sort((a, b) =>
      new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getPublished() {
    const c = this._supa();
    if (c) {
      const { data, error } = await c.from(this.TABLE)
        .select('*').eq('published', true)
        .order('created_at', { ascending: false });
      if (error) { console.warn('[Blog] supabase getPublished error', error); }
      else return data.map(r => this._fromSupabase(r));
    }
    return this._localAll()
      .filter(b => b.status === 'published')
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  async getById(id) {
    if (!id) return null;
    const c = this._supa();
    if (c) {
      const { data, error } = await c.from(this.TABLE).select('*').eq('id', id).maybeSingle();
      if (!error && data) return this._fromSupabase(data);
    }
    return this._localAll().find(b => b.id === id) || null;
  },

  async getBySlug(slug) {
    if (!slug) return null;
    const c = this._supa();
    if (c) {
      const { data, error } = await c.from(this.TABLE).select('*').eq('slug', slug).maybeSingle();
      if (!error && data) return this._fromSupabase(data);
    }
    return this._localAll().find(b => b.slug === slug) || null;
  },

  async create(data) {
    const c = this._supa();
    if (c) {
      const row = this._toSupabase(data);
      const { data: ins, error } = await c.from(this.TABLE).insert(row).select().single();
      if (error) return { success: false, message: error.message };
      return { success: true, data: this._fromSupabase(ins) };
    }
    // localStorage fallback
    const arr = this._localAll();
    const blog = {
      id: this._genId(),
      slug: data.slug || this.generateSlug(data.title),
      title: data.title,
      excerpt: data.excerpt || '',
      content: data.content || '',
      image: data.image || '',
      category: data.category || 'IPTV',
      author: data.author || 'SOLARA TV',
      tags: data.tags || [],
      status: data.status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    arr.push(blog);
    this._localSave(arr);
    return { success: true, data: blog };
  },

  async update(id, data) {
    const c = this._supa();
    if (c) {
      const existing = await this.getById(id);
      if (!existing) return { success: false, message: 'Post not found' };
      const row = this._toSupabase(data, existing);
      const { data: upd, error } = await c.from(this.TABLE)
        .update(row).eq('id', id).select().single();
      if (error) return { success: false, message: error.message };
      return { success: true, data: this._fromSupabase(upd) };
    }
    const arr = this._localAll();
    const i = arr.findIndex(b => b.id === id);
    if (i === -1) return { success: false, message: 'Post not found' };
    arr[i] = {
      ...arr[i],
      ...data,
      slug: data.title ? this.generateSlug(data.title) : arr[i].slug,
      updatedAt: new Date().toISOString()
    };
    this._localSave(arr);
    return { success: true, data: arr[i] };
  },

  async delete(id) {
    const c = this._supa();
    if (c) {
      const { error } = await c.from(this.TABLE).delete().eq('id', id);
      return { success: !error, message: error?.message };
    }
    const arr = this._localAll().filter(b => b.id !== id);
    this._localSave(arr);
    return { success: true };
  }
};

window.Blog = Blog;
