/* =============================================
   SOLARA TV — PayPal Checkout (Smart Buttons)
   Client-side integration — safe on static hosting.
   Only the PUBLIC Client ID is used here.
   The PayPal SECRET + Activation Panel key live
   server-side in the Supabase Edge Function.
   ============================================= */

window.SOLARA_PAY = {
  // 🔑 PUBLIC client ID (ok to expose — it's designed for client-side use)
  clientId: 'BAAXn76-Ku89zdizrQJVbtXXyXyi9AnxIqVtx9_t1f1Co1qidffznHbmOU3A8Mh79ubybgQVPQMbGl6ulA',
  currency: 'EUR',
  whatsappNumber: '212600160196',
  // 🔒 Phase 2 — URL of the Supabase Edge Function that auto-creates the
  // subscription after payment. Empty = automation disabled.
  automationUrl: 'https://nuadbjtwcksoqheyushw.functions.supabase.co/payment-hook',
  // Server-side options (bouquets) for the payment modal
  optionsUrl: 'https://nuadbjtwcksoqheyushw.functions.supabase.co/get-options',
  // Mapping offers <-> amounts (for the PayPal order)
  plans: {
    monthly:   { amount: '17.00',  label: '1 Month',         sub: '1'  },
    quarterly: { amount: '34.99',  label: '3 Months',        sub: '3'  },
    semi:      { amount: '55.00',  label: '6 Months',        sub: '6'  },
    annual:    { amount: '90.00',  label: '12 Months',       sub: '12' },
    biennial:  { amount: '149.00', label: '24 Months',       sub: '24' },
    offer3:    { amount: '34.00',  label: '3 Months Offer',  sub: '3'  },
    offer6:    { amount: '50.00',  label: '6 Months Offer',  sub: '6'  },
    offer12:   { amount: '77.00',  label: '12 Months Offer', sub: '12' },
    offer24:   { amount: '149.00', label: '24 Months Offer', sub: '24' }
  }
};

// 🌍 Country list for the payment modal (matches the panel's country-based bouquets)
const COUNTRIES = ['United Kingdom','USA','Canada','France','Germany','Netherlands','Belgium','Switzerland','Austria','Portugal','Spain','Italy','Greece','Poland','Sweden','Denmark','Norway','Finland','Albania','Slovenia','Ex Yu','Lithuania','Latvia','Estonia','Hungary','Czech','Romania','Bulgaria','Russia','Ukraine','Georgia','Australia','New Zealand','Brasil','Latino','Caribbean','India','Turkey','Iran','Afghanistan','Pakistan','Azerbaijan','Uzbekistan','Tajikistan','Kurdistan','Israel','China','Korea','Indonesia','Myanmar','Thailand','Singapore','Taiwan','Vietnam','Malaysia','Japan','Philippines','Suriname','Africa'];

const PayPalUI = {
  _planKey: null,

  open(planKey) {
    const plan = window.SOLARA_PAY.plans[planKey];
    if (!plan) { alert('Unknown plan'); return; }
    this._planKey = planKey;
    this._build();
    document.getElementById('solaraPayPlanLabel').textContent = plan.label + ' — €' + plan.amount;
    document.getElementById('solaraPayBtn').style.display = 'flex';
    document.getElementById('solaraPaySuccess').style.display = 'none';
    document.getElementById('solaraPayModal').classList.add('open');
    this._loadOptions();
    this._loadSdk().then(() => this._render());
  },

  _isVod(name) {
    return /vod|movie|series|netflix|disney|apple\+|imdb|sub\b/i.test(name || '');
  },

  async _loadOptions() {
    const box = document.getElementById('solaraPayOptions');
    if (!box) return;
    box.style.display = 'block';
    const note = document.getElementById('solaraPayNote');
    if (note) note.value = '';
    // Countries
    const countrySel = document.getElementById('solaraPayCountry');
    if (countrySel) {
      countrySel.innerHTML = '<option value="">🌐 World / All</option>' +
        COUNTRIES.map(c => '<option value="' + c.replace(/'/g, '') + '">' + c + '</option>').join('');
    }
    // Reset pack/vod lists to "All" defaults
    const packsEl = document.getElementById('solaraPayPacks');
    const vodsEl = document.getElementById('solaraPayVods');
    if (packsEl) packsEl.innerHTML = '<label style="display:flex;align-items:center;gap:8px;color:#ddd;cursor:pointer;"><input type="checkbox" value="all" checked onchange="PayPalUI.onPackChange()"> All Bouquets</label>';
    if (vodsEl) vodsEl.innerHTML = '<label style="display:flex;align-items:center;gap:8px;color:#ddd;cursor:pointer;"><input type="checkbox" value="all" checked onchange="PayPalUI.onVodChange()"> All VOD</label>';
    const url = window.SOLARA_PAY.optionsUrl;
    if (!url) return;
    try {
      const resp = await fetch(url);
      const data = await resp.json().catch(() => ({}));
      if (!(data && data.ok && data.bouquets && data.bouquets.length)) return;
      data.bouquets.forEach(b => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:8px;color:#ddd;cursor:pointer;';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = b.id;
        cb.onchange = this._isVod(b.name) ? () => this.onVodChange() : () => this.onPackChange();
        label.appendChild(cb);
        label.appendChild(document.createTextNode(b.name));
        if (this._isVod(b.name)) { if (vodsEl) vodsEl.appendChild(label); }
        else if (packsEl) packsEl.appendChild(label);
      });
    } catch {}
  },

  onPackChange() {
    const packsEl = document.getElementById('solaraPayPacks');
    const boxes = packsEl ? Array.from(packsEl.querySelectorAll('input[type=checkbox]')) : [];
    const allBox = boxes.find(b => b.value === 'all');
    const anySpecific = boxes.some(b => b.value !== 'all' && b.checked);
    if (allBox && anySpecific) allBox.checked = false;
    if (allBox && !anySpecific) allBox.checked = true;
  },

  onVodChange() {
    const vodsEl = document.getElementById('solaraPayVods');
    const boxes = vodsEl ? Array.from(vodsEl.querySelectorAll('input[type=checkbox]')) : [];
    const allBox = boxes.find(b => b.value === 'all');
    const anySpecific = boxes.some(b => b.value !== 'all' && b.checked);
    if (allBox && anySpecific) allBox.checked = false;
    if (allBox && !anySpecific) allBox.checked = true;
  },

  onCountryChange() {
    // Auto-check bouquets matching the selected country
    const country = document.getElementById('solaraPayCountry') ? document.getElementById('solaraPayCountry').value : '';
    const packsEl = document.getElementById('solaraPayPacks');
    if (!packsEl || !country) return;
    const boxes = Array.from(packsEl.querySelectorAll('input[type=checkbox]'));
    let matched = 0;
    boxes.forEach(b => {
      if (b.value === 'all') return;
      const name = (b.closest('label') || {}).textContent || '';
      if (name.toLowerCase().includes(country.toLowerCase())) { b.checked = true; matched++; }
    });
    const allBox = boxes.find(b => b.value === 'all');
    if (allBox && matched > 0) allBox.checked = false;
  },

  _gatherOptions() {
    let country = '', note = '';
    try { country = document.getElementById('solaraPayCountry') ? document.getElementById('solaraPayCountry').value : ''; } catch {}
    try { note = document.getElementById('solaraPayNote') ? document.getElementById('solaraPayNote').value.trim() : ''; } catch {}
    const ids = [];
    ['solaraPayPacks', 'solaraPayVods'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const boxes = Array.from(el.querySelectorAll('input[type=checkbox]'));
      const allBox = boxes.find(b => b.value === 'all');
      const specifics = boxes.filter(b => b.value !== 'all' && b.checked).map(b => b.value);
      if (!(allBox && allBox.checked)) specifics.forEach(v => { if (!ids.includes(v)) ids.push(v); });
    });
    return { country, pack: ids.length ? ids.join(',') : 'all', note };
  },

  close() {
    const m = document.getElementById('solaraPayModal');
    if (m) m.classList.remove('open');
  },

  _build() {
    if (document.getElementById('solaraPayModal')) return;
    const modal = document.createElement('div');
    modal.id = 'solaraPayModal';
    modal.innerHTML = `
      <div class="solara-pay-overlay" onclick="PayPalUI.close()"></div>
      <div class="solara-pay-box">
        <button class="solara-pay-close" onclick="PayPalUI.close()" aria-label="Close">&times;</button>
        <h3 style="margin:0 0 4px;color:#FFD700;">💳 Secure Payment</h3>
        <p id="solaraPayPlanLabel" style="color:#fff;margin:0 0 16px;font-weight:700;"></p>
        <div id="solaraPayOptions" style="margin-bottom:14px;">
          <div style="margin-bottom:10px;">
            <label for="solaraPayCountry" style="color:#aaa;font-size:.75rem;display:block;margin-bottom:4px;">🌍 Select Country</label>
            <select id="solaraPayCountry" style="width:100%;padding:9px;border-radius:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,215,0,.3);color:#fff;font-size:.85rem;" onchange="PayPalUI.onCountryChange()">
              <option value="">🌐 World / All</option>
            </select>
          </div>
          <div style="margin-bottom:10px;">
            <label style="color:#aaa;font-size:.75rem;display:block;margin-bottom:4px;">📺 Select Bouquets</label>
            <div id="solaraPayPacks" style="max-height:150px;overflow:auto;border:1px solid rgba(255,215,0,.2);border-radius:8px;padding:8px;background:rgba(0,0,0,.2);font-size:.8rem;line-height:1.9;">
              <label style="display:flex;align-items:center;gap:8px;color:#ddd;cursor:pointer;"><input type="checkbox" value="all" checked onchange="PayPalUI.onPackChange()"> All Bouquets</label>
            </div>
          </div>
          <div style="margin-bottom:10px;">
            <label style="color:#aaa;font-size:.75rem;display:block;margin-bottom:4px;">🎬 Select VOD</label>
            <div id="solaraPayVods" style="max-height:120px;overflow:auto;border:1px solid rgba(255,215,0,.2);border-radius:8px;padding:8px;background:rgba(0,0,0,.2);font-size:.8rem;line-height:1.9;">
              <label style="display:flex;align-items:center;gap:8px;color:#ddd;cursor:pointer;"><input type="checkbox" value="all" checked onchange="PayPalUI.onVodChange()"> All VOD</label>
            </div>
          </div>
          <div>
            <label for="solaraPayNote" style="color:#aaa;font-size:.75rem;display:block;margin-bottom:4px;">Note (optional — your name / order ref)</label>
            <input id="solaraPayNote" type="text" maxlength="100" placeholder="e.g. John Doe" style="width:100%;padding:9px;border-radius:8px;background:rgba(0,0,0,.35);border:1px solid rgba(255,215,0,.3);color:#fff;font-size:.85rem;">
          </div>
        </div>
        <div id="solaraPayBtn" style="min-height:180px;display:flex;align-items:center;justify-content:center;color:#888;"><i class="fas fa-spinner fa-spin"></i> Loading secure payment...</div>
        <div id="solaraPaySuccess" style="display:none;text-align:center;padding:20px;">
          <div style="font-size:3rem;color:#25D366;"><i class="fas fa-check-circle"></i></div>
          <h3 style="color:#fff;">Payment Successful!</h3>
          <p id="solaraPayOrderId" style="color:#aaa;font-size:.85rem;"></p>
          <div id="solaraPayCreds" style="display:none;background:rgba(0,0,0,.35);border:1px solid rgba(255,215,0,.3);border-radius:12px;padding:14px;margin:12px 0;text-align:left;font-family:monospace;font-size:.85rem;">
            <div style="color:#FFD700;font-family:inherit;font-weight:700;margin-bottom:8px;">📺 Your M3U account</div>
            <div>Username: <strong id="credUser" style="color:#fff;"></strong> <button class="solara-copy" onclick="PayPalUI.copyCred('credUser')">📋</button></div>
            <div>Password: <strong id="credPass" style="color:#fff;"></strong> <button class="solara-copy" onclick="PayPalUI.copyCred('credPass')">📋</button></div>
            <div id="credExpire" style="margin-top:6px;"></div>
          </div>
          <p id="solaraPayAutomation" style="font-size:.85rem;font-weight:700;margin:10px 0;"></p>
          <button id="solaraPayWhatsAppBtn" class="btn" style="background:#25D366;color:#fff;border:none;padding:12px 24px;border-radius:30px;font-weight:700;cursor:pointer;margin-top:10px;" onclick="PayPalUI.continueWhatsApp()"><i class="fab fa-whatsapp"></i> Confirm on WhatsApp</button>
          <p id="solaraPaySuccessNote" style="color:#888;font-size:.75rem;margin-top:8px;">Send us your payment ID so we can activate your plan instantly.</p>
        </div>
      </div>`;
    document.body.appendChild(modal);

    const css = document.createElement('style');
    css.textContent = `
      #solaraPayModal{position:fixed;inset:0;z-index:99999;display:none;align-items:center;justify-content:center}
      #solaraPayModal.open{display:flex}
      .solara-pay-overlay{position:absolute;inset:0;background:rgba(0,0,0,.8);backdrop-filter:blur(4px)}
      .solara-pay-box{position:relative;background:#111;border:1px solid rgba(255,215,0,.4);border-radius:20px;padding:30px;width:min(420px,92vw);box-shadow:0 20px 60px rgba(0,0,0,.6);max-height:90vh;overflow:auto}
      .solara-pay-close{position:absolute;top:10px;right:14px;background:none;border:none;color:#aaa;font-size:1.6rem;cursor:pointer;line-height:1}
      .solara-pay-close:hover{color:#fff}
      #solaraPayBtn .paypal-buttons{min-height:40px}
    `;
    document.head.appendChild(css);
  },

  _loadSdk() {
    return new Promise((resolve) => {
      if (window.paypal) { resolve(); return; }
      if (document.getElementById('paypal-sdk')) {
        const t = setInterval(() => { if (window.paypal) { clearInterval(t); resolve(); } }, 100);
        setTimeout(() => clearInterval(t), 10000);
        return;
      }
      const s = document.createElement('script');
      s.id = 'paypal-sdk';
      s.src = 'https://www.paypal.com/sdk/js?client-id=' + window.SOLARA_PAY.clientId + '&currency=' + window.SOLARA_PAY.currency + '&intent=capture';
      s.onload = () => resolve();
      document.head.appendChild(s);
    });
  },

  _render() {
    const holder = document.getElementById('solaraPayBtn');
    const plan = window.SOLARA_PAY.plans[this._planKey];
    holder.innerHTML = '';
    try {
      paypal.Buttons({
        style: { layout: 'vertical', color: 'gold', shape: 'rect', label: 'paypal' },
        createOrder: (data, actions) => actions.order.create({
          purchase_units: [{
            description: 'SOLARA TV — ' + plan.label,
            amount: { currency_code: window.SOLARA_PAY.currency, value: plan.amount }
          }]
        }),
        onApprove: (data, actions) => actions.order.capture().then((details) => {
          this._onSuccess(data.orderID, details, plan);
        }),
        onError: (err) => {
          holder.innerHTML = '<p style="color:#ff6b6b;">Payment error: ' + ((err && err.message) ? err.message : 'please try again') + '</p>';
        }
      }).render(holder);
    } catch (err) {
      holder.innerHTML = '<p style="color:#ff6b6b;">Could not load PayPal: ' + err.message + '</p>';
    }
  },

  async _onSuccess(orderId, details, plan) {
    document.getElementById('solaraPayBtn').style.display = 'none';
    document.getElementById('solaraPaySuccess').style.display = 'block';
    const payerEmail = (details && details.payer && details.payer.email_address) || '';
    document.getElementById('solaraPayOrderId').textContent = 'Order ID: ' + orderId + ' • €' + plan.amount + ' • ' + plan.label;
    window.SOLARA_PAY._lastOrder = { orderId, plan: plan.label, amount: plan.amount, sub: plan.sub, email: payerEmail };

    // Local payment history (visible in admin later)
    try {
      const hist = JSON.parse(localStorage.getItem('solaratv_payments') || '[]');
      hist.unshift({ orderId, plan: plan.label, amount: plan.amount, email: payerEmail, date: new Date().toISOString() });
      localStorage.setItem('solaratv_payments', JSON.stringify(hist.slice(0, 200)));
    } catch {}

    // Phase 2 — auto-create subscription server-side
    const url = window.SOLARA_PAY.automationUrl;
    const autoEl = document.getElementById('solaraPayAutomation');
    const credsBox = document.getElementById('solaraPayCreds');
    if (url) {
      // userId from the logged-in session (set by auth.js on login)
      let userId = '';
      try {
        const sess = JSON.parse(localStorage.getItem('solaratv_session') || 'null');
        if (sess && sess.userId) userId = sess.userId;
      } catch {}
      // Selected options (country + bouquets + VOD + note)
      const opts = this._gatherOptions();
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planKey: this._planKey, paypalOrderId: orderId, userId, pack: opts.pack, country: opts.country, note: opts.note })
        });
        const data = await resp.json().catch(() => ({}));
        if (data && data.ok) {
          autoEl.textContent = '✅ Subscription created! Your M3U details below.';
          autoEl.style.color = '#25D366';
          if (data.username && data.password) {
            document.getElementById('credUser').textContent = data.username;
            document.getElementById('credPass').textContent = data.password;
            document.getElementById('credExpire').innerHTML = 'Expires: <strong style="color:#fff;">' + (data.expire || '—') + '</strong>';
            credsBox.style.display = 'block';
            // Keep credentials for the client dashboard
            window.SOLARA_PAY._lastCreds = { username: data.username, password: data.password, expire: data.expire };
            try {
              const stored = JSON.parse(localStorage.getItem('solaratv_payments') || '[]');
              const last = stored.find(s => s.orderId === orderId);
              if (last) Object.assign(last, { username: data.username, password: data.password, expire: data.expire });
              localStorage.setItem('solaratv_payments', JSON.stringify(stored));
            } catch {}
          }
        } else {
          autoEl.textContent = '⚠️ Payment received — please confirm on WhatsApp for activation.';
          autoEl.style.color = '#ffc107';
          console.warn('Automation hook response:', data);
        }
      } catch (e) {
        autoEl.textContent = '⚠️ Payment received — please confirm on WhatsApp for activation.';
        autoEl.style.color = '#ffc107';
        console.warn('Automation hook failed:', e);
      }
    } else {
      autoEl.textContent = '⚠️ Please confirm on WhatsApp for activation.';
      autoEl.style.color = '#ffc107';
    }

    // Notify the page so it can refresh (client dashboard subscriptions)
    try { window.dispatchEvent(new CustomEvent('solara:payment', { detail: { ok: true } })); } catch {}
  },

  copyCred(id) {
    const el = document.getElementById(id);
    if (!el) return;
    navigator.clipboard.writeText(el.textContent).then(() => {
      const btn = el.nextElementSibling;
      if (btn) { const t = btn.textContent; btn.textContent = '✅'; setTimeout(() => { btn.textContent = t; }, 1200); }
    }).catch(() => {});
  },

  continueWhatsApp() {
    const o = window.SOLARA_PAY._lastOrder;
    if (!o) return;
    const msg = encodeURIComponent(
      '✅ I just paid ' + o.amount + ' EUR via PayPal.\n' +
      '• Plan: ' + o.plan + '\n' +
      '• Order ID: ' + o.orderId + '\n' +
      'Please activate my subscription. Thanks!'
    );
    window.open('https://wa.me/' + window.SOLARA_PAY.whatsappNumber + '?text=' + msg, '_blank');
  }
};

// Alias used by existing "Pay Now" buttons on pricing.html / offers.html
function pay(planKey) { PayPalUI.open(planKey); }

// 🎁 Free trial — 1 day, 0 credit (server-side creation, no PayPal needed)
const TRIAL_URL = 'https://nuadbjtwcksoqheyushw.functions.supabase.co/create-trial';

async function startTrial() {
  let userId = '';
  try {
    const sess = JSON.parse(localStorage.getItem('solaratv_session') || 'null');
    if (sess && sess.userId) userId = sess.userId;
  } catch {}
  if (!userId) { alert('Please login first to get your free trial.'); return; }

  PayPalUI._build();
  document.getElementById('solaraPayPlanLabel').textContent = '🎁 Free Trial — 1 Day (0 €)';
  const optBox = document.getElementById('solaraPayOptions');
  if (optBox) optBox.style.display = 'none';
  document.getElementById('solaraPayBtn').style.display = 'flex';
  document.getElementById('solaraPaySuccess').style.display = 'none';
  document.getElementById('solaraPayCreds').style.display = 'none';
  document.getElementById('solaraPayModal').classList.add('open');
  document.getElementById('solaraPayBtn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Creating your free trial...';

  try {
    const resp = await fetch(TRIAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId })
    });
    const data = await resp.json().catch(() => ({}));
    if (data && data.ok) {
      document.getElementById('solaraPayBtn').style.display = 'none';
      document.getElementById('solaraPaySuccess').style.display = 'block';
      document.getElementById('solaraPayOrderId').textContent = 'Free Trial — 1 Day • 0 €';
      document.getElementById('credUser').textContent = data.username || '—';
      document.getElementById('credPass').textContent = data.password || '—';
      document.getElementById('credExpire').innerHTML = 'Expires: <strong style="color:#fff;">' + (data.expire || '—') + '</strong>';
      document.getElementById('solaraPayCreds').style.display = 'block';
      const autoEl = document.getElementById('solaraPayAutomation');
      autoEl.textContent = '✅ Free trial created! Enjoy 1 day.';
      autoEl.style.color = '#25D366';
      document.getElementById('solaraPayWhatsAppBtn').style.display = 'none';
      document.getElementById('solaraPaySuccessNote').style.display = 'none';
      window.SOLARA_PAY._lastOrder = { orderId: 'TRIAL', plan: 'Free Trial 1 Day', amount: '0', sub: '99' };
      try { window.dispatchEvent(new CustomEvent('solara:payment', { detail: { ok: true } })); } catch {}
    } else {
      alert((data && data.error) || 'Trial creation failed. Try again or contact us.');
      PayPalUI.close();
    }
  } catch (e) {
    alert('Trial creation failed. Try again or contact us.');
    PayPalUI.close();
  }
}
