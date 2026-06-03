/* =============================================
   SOLARA TV - Blog System
   Copyright (c) 2026 solaratv.tv
   ============================================= */

const Blog = {
  STORAGE_KEY: 'solaratv_blogs',

  init() {
    const blogs = this.getAll();
    if (blogs.length === 0) {
      this.seedData();
    }
  },

  getAll() {
    try {
      return JSON.parse(localStorage.getItem(this.STORAGE_KEY)) || [];
    } catch { return []; }
  },

  save(blogs) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(blogs));
  },

  getPublished() {
    return this.getAll().filter(b => b.status === 'published').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  getById(id) {
    return this.getAll().find(b => b.id === id);
  },

  getBySlug(slug) {
    return this.getAll().find(b => b.slug === slug);
  },

  generateSlug(title) {
    return title.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  },

  create(data) {
    const blogs = this.getAll();
    const blog = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      title: data.title,
      slug: this.generateSlug(data.title),
      excerpt: data.excerpt || '',
      content: data.content,
      image: data.image || 'https://images.unsplash.com/photo-1574375927938-d5a98e8ffe85?w=800',
      category: data.category || 'IPTV',
      tags: data.tags || [],
      author: data.author || 'SOLARA TV',
      status: data.status || 'draft',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    blogs.push(blog);
    this.save(blogs);
    return blog;
  },

  update(id, data) {
    const blogs = this.getAll();
    const index = blogs.findIndex(b => b.id === id);
    if (index === -1) return null;
    blogs[index] = {
      ...blogs[index],
      ...data,
      slug: data.title ? this.generateSlug(data.title) : blogs[index].slug,
      updatedAt: new Date().toISOString()
    };
    this.save(blogs);
    return blogs[index];
  },

  delete(id) {
    const blogs = this.getAll();
    const filtered = blogs.filter(b => b.id !== id);
    this.save(filtered);
  },

  seedData() {
    const samplePosts = [
      {
        title: 'Best IPTV Service 2026: Complete Guide to Premium Streaming',
        excerpt: 'Discover why SOLARA TV is the #1 rated IPTV service in 2026. Learn about 4K streaming, device compatibility, and how to get started with 25,000+ channels.',
        content: '<h2>Why SOLARA TV is the Best IPTV Service in 2026</h2><p>In the rapidly evolving world of digital entertainment, IPTV (Internet Protocol Television) has emerged as the preferred choice for millions of viewers worldwide. SOLARA TV stands at the forefront of this revolution, offering an unparalleled streaming experience.</p><h2>What Makes SOLARA TV Different?</h2><p>With over 25,000 live channels in stunning 4K quality, SOLARA TV delivers content from Europe, Australia, USA, and the GCC region. Our service includes:</p><ul><li>25,000+ Live TV Channels in 4K/FHD</li><li>60,000+ Movies & TV Series</li><li>99.9% Server Uptime Guarantee</li><li>Anti-freeze Technology</li><li>24/7 Customer Support</li></ul><h2>Device Compatibility</h2><p>SOLARA TV works on virtually any device: Smart TVs (Samsung, LG, Sony), Amazon Fire Stick, Apple TV, Android phones, iPhones, iPads, Windows, Mac, and more. Setup takes just 5 minutes!</p><h2>How to Get Started</h2><p>Getting started with SOLARA TV is easy:</p><ol><li>Choose your plan</li><li>Contact us via WhatsApp</li><li>Receive your credentials</li><li>Start watching in 4K!</li></ol><p>Try our service risk-free with a 24-hour free trial. Experience the difference premium IPTV makes.</p>',
        image: 'https://images.unsplash.com/photo-1593784991095-a205069470b6?w=800',
        category: 'IPTV Guide',
        tags: ['IPTV', 'Streaming', '4K', 'Guide'],
        status: 'published'
      },
      {
        title: 'How to Setup IPTV on Amazon Fire Stick in 5 Minutes',
        excerpt: 'Step-by-step guide to installing and configuring SOLARA TV IPTV on your Amazon Fire Stick. Easy setup with screenshots and troubleshooting tips.',
        content: '<h2>Setting Up SOLARA TV on Amazon Fire Stick</h2><p>Amazon Fire Stick is one of the most popular devices for IPTV streaming. Here\'s how to set up SOLARA TV in just 5 minutes.</p><h2>Step 1: Enable Unknown Sources</h2><p>Go to Settings > My Fire TV > Developer Options > Install Unknown Apps and enable it for your browser.</p><h2>Step 2: Download the IPTV App</h2><p>You can use IPTV Smarters, TiviMate, or any compatible app. Search for it in the Amazon App Store or sideload it.</p><h2>Step 3: Enter Your Credentials</h2><p>Open the app and enter the M3U URL or Xtream Codes login details provided by SOLARA TV after your subscription.</p><h2>Step 4: Enjoy Premium Content</h2><p>Browse through 25,000+ channels organized by country and category. Enjoy movies, sports, news, and more in crystal-clear 4K quality.</p><h2>Troubleshooting Tips</h2><ul><li>Ensure your internet speed is at least 25 Mbps for 4K</li><li>Use a wired connection or 5GHz Wi-Fi for best results</li><li>Clear app cache if you experience buffering</li><li>Contact our 24/7 support via WhatsApp for help</li></ul>',
        image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=800',
        category: 'Tutorial',
        tags: ['Fire Stick', 'Setup', 'Tutorial', 'Amazon'],
        status: 'published'
      },
      {
        title: 'IPTV vs Cable TV: Why Thousands Are Making the Switch in 2026',
        excerpt: 'Compare IPTV and traditional cable TV. Learn about cost savings, channel variety, quality, and why IPTV is the future of television.',
        content: '<h2>IPTV vs Cable TV: The Complete Comparison</h2><p>The television landscape has changed dramatically. More people than ever are cutting the cord and switching to IPTV services like SOLARA TV. Here\'s why.</p><h2>Cost Comparison</h2><p>Traditional cable TV packages can cost $100-200+ per month with limited channels. SOLARA TV offers 25,000+ channels starting at just a fraction of that cost.</p><h2>Channel Selection</h2><p>Cable TV typically offers 200-500 channels. SOLARA TV provides access to over 25,000 channels from Europe, Australia, USA, and the GCC, plus 60,000+ on-demand movies and series.</p><h2>Quality</h2><p>While cable is limited to HD, SOLARA TV delivers stunning 4K Ultra HD quality with anti-freeze technology for smooth, buffer-free viewing.</p><h2>Flexibility</h2><p>Watch on any device, anywhere. No contracts, no hidden fees, no installation appointments. Stream on your TV, phone, tablet, or computer.</p><blockquote>SOLARA TV has completely changed how I watch TV. The quality is incredible and I have access to channels from around the world. - Happy Customer from UK</blockquote>',
        image: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=800',
        category: 'Comparison',
        tags: ['IPTV', 'Cable TV', 'Comparison', 'Cord Cutting'],
        status: 'published'
      }
    ];

    samplePosts.forEach(post => this.create(post));
  }
};

Blog.init();
