/* ============================================================
   ABUGIDA UI COMPONENTS
   Toasts, Modals, Skeletons, Empty States, Helpers
   ============================================================ */
const UI = {
  /* --- Toast Notifications --- */
  toast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
      success: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
      error: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>',
      warning: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>',
      info: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<span class="toast-icon">${icons[type] || icons.info}</span><span class="toast-message">${this.escapeHTML(message)}</span><button class="toast-close" aria-label="Dismiss"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>`;
    container.appendChild(toast);
    toast.querySelector('.toast-close')?.addEventListener('click', () => toast.remove());

    setTimeout(() => {
      toast.classList.add('leaving');
      setTimeout(() => toast.remove(), 200);
    }, CONFIG.TOAST_DURATION);
  },

  /* --- Modal --- */
  openModal({ title, body, onClose }) {
    const overlay = document.getElementById('modalOverlay');
    const titleEl = document.getElementById('modalTitle');
    const bodyEl = document.getElementById('modalBody');

    titleEl.textContent = title || '';
    bodyEl.innerHTML = '';

    if (typeof body === 'string') {
      bodyEl.innerHTML = body;
    } else if (body instanceof HTMLElement) {
      bodyEl.appendChild(body);
    } else if (typeof body === 'function') {
      const result = body();
      if (result instanceof HTMLElement) bodyEl.appendChild(result);
    }

    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';

    const close = () => {
      overlay.classList.remove('active');
      document.body.style.overflow = '';
      if (onClose) onClose();
    };

    document.getElementById('modalClose').onclick = close;
    document.getElementById('modalBackdrop').onclick = close;

    const handler = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', handler);
    overlay._closeHandler = () => document.removeEventListener('keydown', handler);
  },

  closeModal() {
    const overlay = document.getElementById('modalOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
    if (overlay._closeHandler) overlay._closeHandler();
  },

  /* --- Skeleton Loaders --- */
  skeleton(type = 'card') {
    const map = {
      card: '<div class="skeleton skeleton-card"></div>',
      text: '<div class="skeleton skeleton-text" style="width:100%"></div><div class="skeleton skeleton-text" style="width:70%"></div>',
      heading: '<div class="skeleton skeleton-heading"></div>',
      row: '<div class="skeleton-row"><div class="skeleton skeleton-avatar"></div><div style="flex:1"><div class="skeleton skeleton-text" style="width:60%"></div><div class="skeleton skeleton-text" style="width:40%"></div></div></div>',
      list: '<div style="display:flex;flex-direction:column;gap:var(--space-3)">' + '<div class="skeleton-row"><div class="skeleton skeleton-avatar"></div><div style="flex:1"><div class="skeleton skeleton-text" style="width:60%"></div><div class="skeleton skeleton-text" style="width:40%"></div></div></div>'.repeat(3) + '</div>',
      stats: '<div class="stats-grid">' + '<div class="skeleton skeleton-card" style="height:100px"></div>'.repeat(3) + '</div>',
    };
    return map[type] || map.card;
  },

  /* --- Empty State --- */
  emptyState({ icon, title, description, actionText, actionCallback }) {
    const div = document.createElement('div');
    div.className = 'empty-state';
    div.innerHTML = `
      <div class="empty-state-icon">${icon || '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>'}</div>
      <h3 class="empty-state-title">${this.escapeHTML(title)}</h3>
      <p class="empty-state-desc">${this.escapeHTML(description)}</p>
      ${actionText ? `<button class="btn btn-primary empty-state-btn">${this.escapeHTML(actionText)}</button>` : ''}
    `;
    if (actionText && actionCallback) {
      const btn = div.querySelector('.empty-state-btn');
      if (btn) btn.addEventListener('click', actionCallback);
    }
    return div;
  },

  /* --- Helpers --- */
  escapeHTML(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  },

  parseEthiopianPhone(phone) {
    if (!phone) return null;
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('0')) cleaned = '251' + cleaned.substring(1);
    else if (cleaned.startsWith('9') && cleaned.length === 9) cleaned = '251' + cleaned;
    else if (cleaned.startsWith('251') && cleaned.length === 12) { /* ok */ }
    else return null;
    if (cleaned.length !== 12 || !cleaned.startsWith('251')) return null;
    return cleaned;
  },

  formatPhone(phone) {
    if (!phone || phone.length !== 12) return phone || '';
    return `+${phone.slice(0,3)} ${phone.slice(3,5)} ${phone.slice(5,8)} ${phone.slice(8)}`;
  },

  getInitials(firstName, lastName) {
    const f = firstName?.[0] || '';
    const l = lastName?.[0] || '';
    return (f + l).toUpperCase() || 'U';
  },

  getGreeting() {
    const hour = new Date().getHours();
    if (hour < 12) return t('goodMorning');
    if (hour < 18) return t('goodAfternoon');
    return t('goodEvening');
  },

  formatDate(date) {
    if (!date) return '';
    return new Date(date).toLocaleDateString(State.currentLanguage === 'am' ? 'am-ET' : 'en-US', {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  },

  debounce(fn, delay = CONFIG.DEBOUNCE_DELAY) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  },
};
