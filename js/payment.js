/* ============================================================
   ABUGIDA PAYMENT MODULE
   Chapa Integration — Subscription Plans
   ============================================================ */
const Payment = {
  init() {
    this.setupPricingButtons();
    this.setupReturnHandling();
  },

  /* ===========================================================
     PRICING BUTTONS
     =========================================================== */
  setupPricingButtons() {
    document.querySelectorAll('[data-plan-type]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const planType = btn.dataset.planType;
        this.handlePlanSelection(planType);
      });
    });
  },

  /* ===========================================================
     PLAN SELECTION — Check auth first
     =========================================================== */
  handlePlanSelection(planType) {
    // Check if user is logged in
    if (!State.currentUser) {
      UI.toast('Please sign in or create an account to subscribe.', 'info');
      // Store the selected plan so we can return to it after auth
      State.pendingPlanType = planType;
      App.navigateTo('auth');
      return;
    }

    // User is logged in — show confirm order modal
    this.showConfirmOrderModal(planType);
  },

  /* ===========================================================
     GET PLAN DETAILS
     =========================================================== */
  getPlanDetails(planType) {
    const plans = {
      monthly: {
        name: 'Monthly',
        type: 'monthly',
        amount: 999,
        period: 'month',
        description: 'Full access, billed every month.',
        features: [
          'Track unlimited children',
          'Academic Progress',
          'Attendance Monitoring',
          'Teacher Messaging',
          'Event Notifications',
          'Priority Support'
        ]
      },
      quarterly: {
        name: 'Quarterly',
        type: 'quarterly',
        amount: 2699,
        period: '3 months',
        description: 'Full access, billed every 3 months.',
        features: [
          'Track unlimited children',
          'Academic Progress',
          'Attendance Monitoring',
          'Teacher Messaging',
          'Event Notifications',
          'Priority Support'
        ]
      },
      semi_annual: {
        name: 'Semi-Annual',
        type: 'semi_annual',
        amount: 4199,
        period: '6 months',
        description: 'Full access, billed every 6 months.',
        features: [
          'Track unlimited children',
          'Academic Progress',
          'Attendance Monitoring',
          'Teacher Messaging',
          'Event Notifications',
          'Priority Support'
        ]
      }
    };
    return plans[planType] || plans.monthly;
  },

  /* ===========================================================
     SHOW CONFIRM ORDER MODAL
     =========================================================== */
  showConfirmOrderModal(planType) {
    const plan = this.getPlanDetails(planType);
    const user = State.currentUser;
    const firstName = user.first_name || user.firstName || '';
    const lastName = user.last_name || user.lastName || '';
    const userEmail = user.email || 'Not provided';
    const userPhone = user.phone ? UI.formatPhone(user.phone) : 'Not provided';

    const body = document.createElement('div');
    body.innerHTML = `
      <div style="margin-bottom:var(--space-6)">
        <!-- Plan Summary -->
        <div style="
          background: linear-gradient(135deg, rgba(184, 115, 51, 0.08) 0%, rgba(138, 80, 35, 0.04) 100%);
          border: 1px solid rgba(184, 115, 51, 0.15);
          border-radius: var(--radius-lg);
          padding: var(--space-5);
          margin-bottom: var(--space-5);
        ">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-3)">
            <div>
              <div style="font-size:var(--text-lg);font-weight:700;color:var(--color-text-primary)">${plan.name} Plan</div>
              <div style="font-size:var(--text-sm);color:var(--color-text-secondary)">${plan.description}</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:var(--text-2xl);font-weight:800;color:var(--color-primary)">ETB ${plan.amount.toLocaleString()}</div>
              <div style="font-size:var(--text-xs);color:var(--color-text-tertiary)">/${plan.period}</div>
            </div>
          </div>
        </div>

        <!-- User Info -->
        <div style="
          background: var(--color-surface-secondary);
          border: 1px solid var(--color-border);
          border-radius: var(--radius-lg);
          padding: var(--space-4);
          margin-bottom: var(--space-5);
        ">
          <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-tertiary);margin-bottom:var(--space-3)">Billing Information</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-3);font-size:var(--text-sm)">
            <div>
              <div style="color:var(--color-text-tertiary);font-size:var(--text-xs)">Full Name</div>
              <div style="font-weight:600;color:var(--color-text-primary)">${UI.escapeHTML(firstName)} ${UI.escapeHTML(lastName)}</div>
            </div>
            <div>
              <div style="color:var(--color-text-tertiary);font-size:var(--text-xs)">Phone</div>
              <div style="font-weight:600;color:var(--color-text-primary)">${UI.escapeHTML(userPhone)}</div>
            </div>
            <div style="grid-column:1/-1">
              <div style="color:var(--color-text-tertiary);font-size:var(--text-xs)">Email</div>
              <div style="font-weight:600;color:var(--color-text-primary)">${UI.escapeHTML(userEmail)}</div>
            </div>
          </div>
        </div>

        <!-- What's Included -->
        <div style="margin-bottom:var(--space-5)">
          <div style="font-size:var(--text-xs);font-weight:700;text-transform:uppercase;letter-spacing:0.05em;color:var(--color-text-tertiary);margin-bottom:var(--space-3)">What's Included</div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--space-2)">
            ${plan.features.map(feature => `
              <div style="display:flex;align-items:center;gap:var(--space-2);font-size:var(--text-sm);color:var(--color-text-secondary)">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-success);flex-shrink:0"><polyline points="20 6 9 17 4 12"/></svg>
                ${feature}
              </div>
            `).join('')}
          </div>
        </div>

        <!-- Payment Method Notice -->
        <div style="
          display:flex;
          align-items:center;
          gap:var(--space-3);
          padding:var(--space-3) var(--space-4);
          background: rgba(58, 123, 139, 0.08);
          border: 1px solid rgba(58, 123, 139, 0.15);
          border-radius: var(--radius-md);
          margin-bottom: var(--space-5);
        ">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color:var(--color-info);flex-shrink:0"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
          <div style="font-size:var(--text-xs);color:var(--color-text-secondary)">
            You'll be redirected to <strong>Chapa</strong> to complete your payment securely. We accept Telebirr, CBE Birr, and major credit cards.
          </div>
        </div>

        <!-- Action Buttons -->
        <div style="display:flex;gap:var(--space-3)">
          <button class="btn btn-secondary" id="cancelOrderBtn" style="flex:1">Cancel</button>
          <button class="btn btn-primary" id="confirmOrderBtn" style="flex:1.5">
            Proceed to Payment
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </button>
        </div>
      </div>
    `;

    UI.openModal({ 
      title: 'Confirm Your Order', 
      body,
      onClose: () => {}
    });

    // Cancel button
    document.getElementById('cancelOrderBtn')?.addEventListener('click', () => {
      UI.closeModal();
    });

    // Confirm button
    document.getElementById('confirmOrderBtn')?.addEventListener('click', () => {
      UI.closeModal();
      this.subscribe(planType);
    });
  },

  /* ===========================================================
     SUBSCRIBE — Initialize Chapa Payment
     =========================================================== */
  async subscribe(planType) {
    if (!State.currentUser) {
      UI.toast('Please sign in to continue.', 'info');
      App.navigateTo('auth');
      return;
    }

    const validPlans = ['monthly', 'quarterly', 'semi_annual'];
    if (!validPlans.includes(planType)) {
      UI.toast('Invalid plan selected.', 'error');
      return;
    }

    // Show loading overlay
    const body = document.createElement('div');
    body.innerHTML = `
      <div style="text-align:center;padding:var(--space-8) var(--space-4)">
        <div class="spinner" style="margin:0 auto var(--space-4);width:40px;height:40px;border:3px solid var(--color-border);border-top-color:var(--color-primary);border-radius:50%;animation:spin 0.8s linear infinite"></div>
        <p style="color:var(--color-text-secondary);font-size:var(--text-sm)">Initializing secure payment...</p>
      </div>
    `;
    UI.openModal({ title: 'Processing', body });

    try {
      const response = await api.post('/payment/initialize', { planType });

      if (response && response.success && response.checkout_url) {
        // Redirect to Chapa checkout
        window.location.href = response.checkout_url;
      } else {
        UI.closeModal();
        UI.toast(response?.message || 'Failed to initialize payment.', 'error');
      }
    } catch (error) {
      UI.closeModal();
      UI.toast(error.message || 'Payment initialization failed.', 'error');
    }
  },

  /* ===========================================================
     RETURN HANDLING — After Chapa redirect
     =========================================================== */
  setupReturnHandling() {
    const hash = window.location.hash;
    if (hash.includes('payment-return')) {
      const params = new URLSearchParams(hash.split('?')[1]);
      const txRef = params.get('tx_ref');
      
      if (txRef) {
        this.verifyPayment(txRef);
      }
    }
  },

  /* ===========================================================
     VERIFY PAYMENT
     =========================================================== */
  async verifyPayment(txRef) {
    if (!State.currentUser) {
      UI.toast('Please sign in to verify your payment.', 'info');
      App.navigateTo('auth');
      return;
    }

    try {
      const response = await api.get(`/payment/verify/${txRef}`);

      if (response && response.success) {
        if (response.subscription) {
          State.subscription = response.subscription;
          UI.toast('Payment successful! Your subscription is now active.', 'success');
          App.navigateTo('dashboard');
          Dashboard.loadSubscription();
        } else if (response.transaction?.status === 'pending') {
          UI.toast('Payment is still processing. Please wait a moment.', 'info');
          App.navigateTo('dashboard');
        } else {
          UI.toast('Payment verification complete.', 'info');
          App.navigateTo('dashboard');
        }
      }
    } catch (error) {
      UI.toast(error.message || 'Payment verification failed.', 'error');
      App.navigateTo('dashboard');
    }
  },

  /* ===========================================================
     LOAD SUBSCRIPTION — For Dashboard
     =========================================================== */
  async loadSubscription() {
    const widget = document.getElementById('subscriptionWidget');
    if (!widget) return;

    try {
      const response = await api.get('/subscription');

      if (response && response.success) {
        const subscription = response.subscription;
        State.subscription = subscription;
        widget.innerHTML = this.renderSubscriptionWidget(subscription);
      }
    } catch (error) {
      widget.innerHTML = `
        <div class="overview-empty-state">
          <p>Unable to load subscription information.</p>
        </div>
      `;
    }
  },

  /* ===========================================================
     RENDER SUBSCRIPTION WIDGET
     =========================================================== */
  renderSubscriptionWidget(subscription) {
    if (!subscription) {
      return `
        <div class="overview-empty-state">
          <p>No active subscription.</p>
          <a href="#pricing" class="btn btn-sm btn-primary" style="margin-top:var(--space-3)">View Plans</a>
        </div>
      `;
    }

    const isActive = subscription.status === 'active';
    const endDate = subscription.end_date ? UI.formatDate(subscription.end_date) : 'N/A';
    const startDate = subscription.start_date ? UI.formatDate(subscription.start_date) : 'N/A';

    return `
      <div style="background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:var(--space-5)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:var(--space-4);flex-wrap:wrap;gap:var(--space-3)">
          <div>
            <div style="font-size:var(--text-lg);font-weight:700;color:var(--color-text-primary)">${UI.escapeHTML(subscription.plan_name)} Plan</div>
            <div style="font-size:var(--text-xs);color:var(--color-text-tertiary);text-transform:uppercase;letter-spacing:0.05em">${UI.escapeHTML(subscription.plan_type.replace('_', ' '))}</div>
          </div>
          <div>
            <span style="
              display:inline-flex;
              align-items:center;
              gap:var(--space-2);
              padding:0.25rem 0.75rem;
              border-radius:var(--radius-full);
              font-size:var(--text-xs);
              font-weight:700;
              ${isActive ? `
                background:var(--color-success-light);
                color:var(--color-success);
              ` : `
                background:var(--color-warning-light);
                color:var(--color-warning);
              `}
            ">
              <span style="width:6px;height:6px;border-radius:50%;background:currentColor"></span>
              ${isActive ? 'Active' : UI.escapeHTML(subscription.status)}
            </span>
          </div>
        </div>
        <div style="display:flex;gap:var(--space-6);font-size:var(--text-sm);flex-wrap:wrap">
          <div>
            <div style="color:var(--color-text-tertiary);font-size:var(--text-xs)">Started</div>
            <div style="color:var(--color-text-primary);font-weight:600">${startDate}</div>
          </div>
          <div>
            <div style="color:var(--color-text-tertiary);font-size:var(--text-xs)">Expires</div>
            <div style="color:var(--color-text-primary);font-weight:600">${endDate}</div>
          </div>
          <div>
            <div style="color:var(--color-text-tertiary);font-size:var(--text-xs)">Amount</div>
            <div style="color:var(--color-text-primary);font-weight:600">ETB ${parseFloat(subscription.amount).toLocaleString()}</div>
          </div>
        </div>
      </div>
    `;
  },
};

// Auto-init on DOM ready
document.addEventListener('DOMContentLoaded', () => Payment.init());