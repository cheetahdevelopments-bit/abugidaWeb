/* ============================================================
   ABUGIDA APPLICATION
   Main Entry Point — Routing, Navigation, Initialization
   ============================================================ */
const App = {
  currentPage: 'home',

  init() {
    // Initialize modules
    Auth.init();
    Dashboard.setupSettings();

    // Setup all event listeners
    this.setupNavigation();
    this.setupMobileNav();
    this.setupHeaderAuth();
    this.setupDashboardNav();
    this.setupHelpFab();
    this.setupAuthBack();
    this.setupHelpCenter();
    this.setupScrollListener();


    // Check auth, then route
    this.checkAuth().then(() => {
      const hash = window.location.hash.replace('#', '') || 'home';
      this.navigateTo(hash);
    });

    // Session check every minute
    setInterval(() => this.checkAuth(), CONFIG.SESSION_CHECK_INTERVAL);
  },

  /* ===========================================================
     NAVIGATION — Landing page links
     =========================================================== */
  setupNavigation() {
    document.querySelectorAll('[data-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        console.log('Nav link clicked:', link.dataset.nav);
        const page = link.dataset.nav;
        this.navigateTo(page);
      });
    });

    document.getElementById('brandLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.navigateTo('home');
    });

    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '') || 'home';
      if (hash !== this.currentPage) this.navigateTo(hash);
    });
  },

  /* ===========================================================
     DASHBOARD NAVIGATION
     =========================================================== */
  setupDashboardNav() {
    document.querySelectorAll('[data-dashboard-page]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.dashboardPage;
        App.switchDashboardPage(page);
      });
    });
  },

  /* ===========================================================
     MOBILE NAV
     =========================================================== */
  setupMobileNav() {
    const toggle = document.getElementById('menuToggle');
    const nav = document.getElementById('mobileNav');
    const backBtn = document.getElementById('mobileNavBackBtn');

    toggle?.addEventListener('click', () => nav?.classList.toggle('active'));
    backBtn?.addEventListener('click', () => nav?.classList.remove('active'));

    const closeMobileNavAndNavigate = (page, isRegister = false) => {
      nav?.classList.remove('active');
      setTimeout(() => {
        this.navigateTo(page);
        if (isRegister) setTimeout(() => document.querySelector('[data-auth-tab="register"]')?.click(), 50);
      }, 300); // Match fade-out transition duration
    };

    const closeMobileNavAndLogout = async () => {
      nav?.classList.remove('active');
      setTimeout(async () => {
        await this.logout();
      }, 300); // Match fade-out transition duration
    };

    nav?.querySelectorAll('[data-nav]').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        closeMobileNavAndNavigate(link.dataset.nav);
      });
    });

    document.getElementById('mobileLoginBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileNavAndNavigate('auth');
    });
    document.getElementById('mobileRegisterBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileNavAndNavigate('auth', true);
    });
    document.getElementById('mobileDashboardBtn')?.addEventListener('click', (e) => {
      e.preventDefault();
      closeMobileNavAndNavigate('dashboard');
    });
    document.getElementById('mobileSignOutBtn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      closeMobileNavAndLogout();
    });
  },


  /* ===========================================================
     HEADER AUTH BUTTONS
     =========================================================== */
  setupHeaderAuth() {
    // Sign in — check session first
    ['navLoginBtn', 'mobileLoginBtn', 'heroSignIn', 'ctaSignIn'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`${id} clicked.`);
        if (State.currentUser) {
          this.navigateTo('dashboard');
        } else {
          this.navigateTo('auth');
        }
      });
    });

    // Get Started — check session first
    ['navRegisterBtn', 'mobileRegisterBtn', 'heroGetStarted', 'ctaGetStarted'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        e.preventDefault();
        console.log(`${id} clicked.`);
        if (State.currentUser) {
          this.navigateTo('dashboard');
        } else {
          this.navigateTo('auth');
          setTimeout(() => document.querySelector('[data-auth-tab="register"]')?.click(), 50);
        }
      });
    });

    // Dashboard link (logged in)
    ['navDashboardBtn', 'mobileDashboardBtn'].forEach(id => {
      document.getElementById(id)?.addEventListener('click', (e) => {
        e.preventDefault();
        this.navigateTo('dashboard');
      });
    });

    // Sign out (logged in)
    document.getElementById('navSignOutBtn')?.addEventListener('click', () => this.logout());

    // Auth brand link goes home
    document.getElementById('authBrandLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      this.navigateTo('home');
    });
  },


  /* ===========================================================
     HELP FAB
     =========================================================== */
  setupHelpFab() {
    const btn = document.getElementById('helpFabBtn');
    const panel = document.getElementById('helpPanel');
    const close = document.getElementById('helpCloseBtn');

    btn?.addEventListener('click', () => {
      panel?.classList.toggle('active');
    });

    close?.addEventListener('click', () => {
      panel?.classList.remove('active');
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.help-fab')) {
        panel?.classList.remove('active');
      }
    });
  },

  /* ===========================================================
     AUTH BACK BUTTON
     =========================================================== */
  setupAuthBack() {
    document.getElementById('authBackBtn')?.addEventListener('click', () => {
      if (State.currentUser) {
        this.navigateTo('dashboard');
      } else {
        this.navigateTo('home');
      }
    });
  },

  /* ===========================================================
     HELP CENTER OVERLAY
     =========================================================== */
  setupHelpCenter() {
    const modal = document.getElementById('helpCenterModal');
    const closeBtn = document.getElementById('helpCenterClose');
    const backdrop = document.getElementById('helpCenterBackdrop');
    const footerLink = document.getElementById('footerHelpCenter');

    const openModal = () => {
      modal?.classList.add('active');
      document.body.style.overflow = 'hidden';
    };
    const closeModal = () => {
      modal?.classList.remove('active');
      document.body.style.overflow = '';
    };

    footerLink?.addEventListener('click', (e) => {
      e.preventDefault();
      openModal();
    });

    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal?.classList.contains('active')) closeModal();
    });
  },

  setupScrollListener() {
    let lastScrollTop = 0;
    const header = document.getElementById('siteHeader');
    window.addEventListener('scroll', () => {
      let scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      if (scrollTop > lastScrollTop && scrollTop > header.offsetHeight) {
        document.body.classList.add('scrolled-down');
      } else {
        document.body.classList.remove('scrolled-down');
      }
      if (scrollTop > 40) {
        header.classList.add('scrolled');
      } else {
        header.classList.remove('scrolled');
      }
      lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;
    }, false);
  },



  /* ===========================================================
     PAGE ROUTING — with transitions
     =========================================================== */
  _isTransitioning: false,

  _resetTransition() {
    this._isTransitioning = false;
    document.querySelectorAll('.page').forEach(p => {
      p.style.transition = '';
      p.style.transform = '';
      p.style.opacity = '';
    });
  },

  navigateTo(page) {
    if (this._isTransitioning) return;

    const pageMap = {
      home: 'page-home', features: 'page-home', about: 'page-home', contact: 'page-home',
      auth: 'page-auth', dashboard: 'page-dashboard',
    };

    const targetId = pageMap[page] || 'page-home';

    // Redirect to auth if trying to access dashboard without login
    if (targetId === 'page-dashboard' && !State.currentUser) {
      this.navigateTo('auth');
      return;
    }

    const authOverlay = document.getElementById('page-auth');
    const isAuthOpen = authOverlay?.classList.contains('active');

    // If navigating to home/dashboard while auth overlay is open, close the overlay first
    if (isAuthOpen && targetId !== 'page-auth') {
      this._isTransitioning = true;
      const safetyTimer = setTimeout(() => this._resetTransition(), 1200);

      authOverlay.classList.remove('active');
      document.body.classList.remove('no-scroll');

      // If going to dashboard, also hide home and show dashboard
      if (targetId === 'page-dashboard') {
        const homeEl = document.getElementById('page-home');
        if (homeEl) homeEl.classList.remove('active');
        const targetEl = document.getElementById(targetId);
        if (targetEl) targetEl.classList.add('active');
      }

      window.scrollTo(0, 0);

      setTimeout(() => {
        clearTimeout(safetyTimer);
        this._isTransitioning = false;
      }, 500);

      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.nav === page);
      });

      if (window.location.hash !== `#${page}`) {
        history.pushState(null, '', `#${page}`);
      }

      this.currentPage = page;
      document.body.className = 'on-' + page;
      document.getElementById('mobileNav')?.classList.remove('active');

      if (page === 'dashboard' && State.currentUser) {
        Dashboard.load();
      }
      return;
    }

    const currentEl = document.querySelector('.page.active');
    const targetEl = document.getElementById(targetId);

    // Same page section scroll (features, about, contact)
    if (!currentEl || !targetEl || currentEl === targetEl) {
      if (['features', 'about', 'contact'].includes(page)) {
        const sectionMap = { features: 'featuresSection', about: 'aboutSection', contact: 'trustSection' };
        setTimeout(() => {
          document.getElementById(sectionMap[page])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
      }
      return;
    }

    // Skip if already on this exact page
    if (currentEl.id === targetId) return;

    // Special handling: Auth page opens as overlay on top of home
    if (targetId === 'page-auth') {
      this._isTransitioning = true;
      const safetyTimer = setTimeout(() => this._resetTransition(), 1200);

      // Ensure home page stays active behind the overlay
      const homeEl = document.getElementById('page-home');
      if (homeEl && !homeEl.classList.contains('active')) {
        homeEl.classList.add('active');
      }

      // Show auth overlay (CSS handles the fade via .active class)
      targetEl.classList.add('active');

      window.scrollTo(0, 0);

      setTimeout(() => {
        clearTimeout(safetyTimer);
        this._isTransitioning = false;
      }, 500);

      document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.toggle('active', link.dataset.nav === page);
      });

      if (window.location.hash !== `#${page}`) {
        history.pushState(null, '', `#${page}`);
      }

      this.currentPage = page;
      document.body.className = 'on-' + page + ' no-scroll';
      document.getElementById('mobileNav')?.classList.remove('active');
      return;
    }

    const isCrossPage = currentEl.id !== targetId;
    this._isTransitioning = true;

    // Safety: always unlock after 1.2s no matter what
    const safetyTimer = setTimeout(() => this._resetTransition(), 1200);

    // Fade out current
    currentEl.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
    currentEl.style.opacity = '0';
    currentEl.style.transform = 'scale(0.97) translateY(10px)';

    setTimeout(() => {
      // Swap pages
      currentEl.classList.remove('active');
      currentEl.style.transition = '';
      currentEl.style.transform = '';
      currentEl.style.opacity = '';

      // Prep target
      targetEl.style.opacity = '0';
      targetEl.style.transform = 'scale(1.03) translateY(-10px)';
      targetEl.classList.add('active');

      window.scrollTo(0, 0);

      // Fade in target
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          targetEl.style.transition = 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)';
          targetEl.style.opacity = '1';
          targetEl.style.transform = 'scale(1) translateY(0)';
        });
      });

      setTimeout(() => {
        clearTimeout(safetyTimer);
        targetEl.style.transition = '';
        targetEl.style.transform = '';
        targetEl.style.opacity = '';
        this._isTransitioning = false;
      }, 500);
    }, 320);

    // Update nav links
    document.querySelectorAll('.nav-link').forEach(link => {
      link.classList.toggle('active', link.dataset.nav === page);
    });

    // Update URL
    if (window.location.hash !== `#${page}`) {
      history.pushState(null, '', `#${page}`);
    }

    this.currentPage = page;
    document.body.className = 'on-' + page;
    document.getElementById('mobileNav')?.classList.remove('active');

    // Load dashboard
    if (page === 'dashboard' && State.currentUser) {
      Dashboard.load();
    }

    // Scroll to section on landing page
    if (['features', 'about', 'contact'].includes(page)) {
      const sectionMap = { features: 'featuresSection', about: 'aboutSection', contact: 'trustSection' };
      setTimeout(() => {
        document.getElementById(sectionMap[page])?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 500);
    }
  },

  switchDashboardPage(page) {
    State.currentDashboardPage = page;

    document.querySelectorAll('[data-dashboard-page]').forEach(link => {
      link.classList.toggle('active', link.dataset.dashboardPage === page);
    });

    document.querySelectorAll('.dashboard-page').forEach(p => p.classList.remove('active'));
    document.getElementById(`dashboardPage-${page}`)?.classList.add('active');

    const titles = { overview: 'Dashboard', children: 'My Children', settings: 'Settings' };
    const titleEl = document.getElementById('dashboardTitle');
    if (titleEl) titleEl.textContent = titles[page] || page;

    // Hide 'Dashboard' nav link if on overview page, show otherwise
    const overviewNavLink = document.querySelector('[data-dashboard-page="overview"]');
    if (overviewNavLink) {
      if (page === 'overview') {
        overviewNavLink.classList.add('hidden');
      } else {
        overviewNavLink.classList.remove('hidden');
      }
    }

    if (page === 'children') Dashboard.loadChildren();
    if (page === 'settings') Dashboard.loadSettings();
  },

  /* ===========================================================
     AUTH CHECK & STATE
     =========================================================== */
  async checkAuth() {
    try {
      const response = await api.get('/user');
      if (response && response.success) {
        State.setUser(response.user);
        this.updateNavigation();
        return true;
      }
    } catch (e) { /* silent */ }

    State.currentUser = null;
    this.updateNavigation();
    return false;
  },

  updateNavigation() {
    const isLoggedIn = !!State.currentUser;
    const authButtons = document.getElementById('navAuthButtons');
    const userMenu = document.getElementById('navUserMenu');
    const mobileAuth = document.getElementById('mobileAuthButtons');
    const mobileUser = document.getElementById('mobileUserMenu');

    if (authButtons) authButtons.classList.toggle('hidden', isLoggedIn);
    if (userMenu) userMenu.classList.toggle('hidden', !isLoggedIn);
    if (mobileAuth) mobileAuth.classList.toggle('hidden', isLoggedIn);
    if (mobileUser) mobileUser.classList.toggle('hidden', !isLoggedIn);
  },

  async logout() {
    try {
      await api.post('/logout', {});
    } catch (e) { /* continue even if fails */ }
    State.currentUser = null;
    this.updateNavigation();
    UI.toast('You have been logged out.', 'success');
    this.navigateTo('home');
  },
};

// Initialize
document.addEventListener('DOMContentLoaded', () => App.init());
