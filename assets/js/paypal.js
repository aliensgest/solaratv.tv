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
    this._loadSdk().then(() => this._render());
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
        <div id="solaraPayBtn" style="min-height:180px;display:flex;align-items:center;justify-content:center;color:#888;"><i class="fas fa-spinner fa-spin"></i> Loading secure payment...</div>
        <div id="solaraPaySuccess" style="display:none;text-align:center;padding:20px;">
          <div style="font-size:3rem;color:#25D366;"><i class="fas fa-check-circle"></i></div>
          <h3 style="color:#fff;">Payment Successful!</h3>
          <p id="solaraPayOrderId" style="color:#aaa;font-size:.85rem;"></p>
          <p id="solaraPayAutomation" style="font-size:.85rem;font-weight:700;margin:10px 0;"></p>
          <button class="btn" style="background:#25D366;color:#fff;border:none;padding:12px 24px;border-radius:30px;font-weight:700;cursor:pointer;margin-top:10px;" onclick="PayPalUI.continueWhatsApp()"><i class="fab fa-whatsapp"></i> Confirm on WhatsApp</button>
          <p style="color:#888;font-size:.75rem;margin-top:8px;">Send us your payment ID so we can activate your plan instantly.</p>
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
    if (url) {
      try {
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ planKey: this._planKey, paypalOrderId: orderId })
        });
        const data = await resp.json().catch(() => ({}));
        if (data && data.ok) {
          autoEl.textContent = '✅ Subscription auto-created on our panel!';
          autoEl.style.color = '#25D366';
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
