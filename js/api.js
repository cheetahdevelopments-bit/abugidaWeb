/* ============================================================
   ABUGIDA API CLIENT
   ============================================================ */
const api = {
  async request(endpoint, options = {}) {
    const url = `${CONFIG.API_BASE_URL}${endpoint}`;
    const config = {
      headers: { 'Content-Type': 'application/json', ...options.headers },
      credentials: 'include',
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = data.message || 'Request failed';

        // Session expired (401 on non-login endpoints) — redirect to home
        if (response.status === 401 && !endpoint.includes('/login') && !endpoint.includes('/forgot-password') && !endpoint.includes('/send-otp') && !endpoint.includes('/verify-otp')) {
          State.currentUser = null;
          App.updateNavigation();
          if (App.currentPage === 'dashboard') App.navigateTo('home');
        }

        throw new Error(message);
      }

      return data;
    } catch (error) {
      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        throw new Error(t('networkError'));
      }
      throw error;
    }
  },

  get(endpoint) { return this.request(endpoint, { method: 'GET' }); },
  post(endpoint, body) { return this.request(endpoint, { method: 'POST', body: JSON.stringify(body) }); },
  put(endpoint, body) { return this.request(endpoint, { method: 'PUT', body: JSON.stringify(body) }); },
  delete(endpoint) { return this.request(endpoint, { method: 'DELETE' }); },
};
