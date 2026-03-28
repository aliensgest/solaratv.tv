/* =============================================
   SOLARA TV - Main App JavaScript
   Copyright (c) 2026 solaratv.tv
   ============================================= */

const App = {
  init() {
    this.initNavbar();
    this.initTabs();
    this.initFAQ();
    this.initMobileMenu();
  },

  // Sticky navbar scroll effect
  initNavbar() {
    const header = document.querySelector('header');
    if (!header) return;
    window.addEventListener('scroll', () => {
      header.classList.toggle('scrolled', window.scrollY > 50);
    });
  },

  // Tab system for channels
  initTabs() {
    const tabBtns = document.querySelectorAll('.tab-btn');
    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const region = btn.dataset.region;
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        const target = document.getElementById(region);
        if (target) target.classList.add('active');
      });
    });
  },

  // FAQ accordion
  initFAQ() {
    document.querySelectorAll('.faq-question').forEach(q => {
      q.addEventListener('click', () => {
        const answer = q.nextElementSibling;
        const isOpen = answer.classList.contains('active');
        // Close all
        document.querySelectorAll('.faq-answer').forEach(a => a.classList.remove('active'));
        document.querySelectorAll('.faq-question').forEach(q2 => q2.classList.remove('active'));
        // Toggle current
        if (!isOpen) {
          answer.classList.add('active');
          q.classList.add('active');
        }
      });
    });
  },

  // Mobile hamburger menu
  initMobileMenu() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    if (!hamburger || !navLinks) return;
    hamburger.addEventListener('click', () => {
      navLinks.classList.toggle('open');
      hamburger.innerHTML = navLinks.classList.contains('open')
        ? '<i class="fas fa-times"></i>'
        : '<i class="fas fa-bars"></i>';
    });
  },

  // WhatsApp helper
  openWhatsApp(message) {
    const encoded = encodeURIComponent(message || 'Hello, I\'m interested in SOLARA TV IPTV service');
    window.open('https://wa.me/212600160196?text=' + encoded, '_blank');
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
