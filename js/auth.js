/* ============================================================
   ABUGIDA AUTH MODULE
   Login, Registration (info→OTP→children), Forgot Password
   ============================================================ */
const Auth = {
  init() {
    this.setupTabs();
    this.setupLogin();
    this.setupRegistration();
    this.setupOTPInputs();
    this.setupForgotPassword();
    this.setupPhoneInputs();
    this.setupPasswordToggle();
  },

  /* ===========================================================
     PHONE INPUT NORMALIZATION
     Shows +251 prefix, normalizes user input
     =========================================================== */
  setupPhoneInputs() {
    document.querySelectorAll('.phone-input').forEach(input => {
      input.addEventListener('input', () => {
        let val = input.value.replace(/\D/g, '');
        // Strip leading 0 or 251 if user types them after prefix
        if (val.startsWith('0')) val = val.substring(1);
        if (val.startsWith('251')) val = val.substring(3);
        // Limit to 9 digits
        val = val.substring(0, 9);
        input.value = val;
      });
    });
  },

  /* ===========================================================
     PASSWORD TOGGLE — Eye icon show/hide
     =========================================================== */
  setupPasswordToggle() {
    document.addEventListener('click', (e) => {
      const btn = e.target.closest('.password-toggle-btn');
      if (!btn) return;

      e.preventDefault();
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;

      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      btn.classList.toggle('visible', isPassword);
      input.focus({ preventScroll: true });
    });
  },

  /* Parse phone: returns full 12-digit number or null */
  parsePhone(inputId) {
    const raw = document.getElementById(inputId)?.value?.trim() || '';
    const digits = raw.replace(/\D/g, '');
    // After stripping prefix, should be 9 digits
    if (digits.length !== 9) return null;
    if (!digits.startsWith('9')) return null;
    return '251' + digits;
  },

  formatPhoneDisplay(phone12) {
    if (!phone12 || phone12.length !== 12) return phone12 || '';
    return `+${phone12.slice(0,3)} ${phone12.slice(3,5)} ${phone12.slice(5,8)} ${phone12.slice(8)}`;
  },

  /* ===========================================================
     TAB SWITCHING
     =========================================================== */
  setupTabs() {
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const name = tab.dataset.authTab;
        document.querySelectorAll('.auth-tab-panel').forEach(p => p.classList.remove('active'));
        document.getElementById(`auth-${name}`).classList.add('active');

        const title = document.getElementById('authTitle');
        const subtitle = document.getElementById('authSubtitle');
        const footerText = document.getElementById('authFooterText');
        const footerLink = document.getElementById('authFooterLink');

        if (name === 'login') {
          title.textContent = 'Welcome back';
          subtitle.textContent = 'Sign in to your account to continue.';
          footerText.textContent = 'Don\'t have an account?';
          footerLink.textContent = 'Create one';
        } else {
          title.textContent = 'Create your account';
          subtitle.textContent = 'Tell us about yourself to get started.';
          footerText.textContent = 'Already have an account?';
          footerLink.textContent = 'Sign In';
          this.goToStep(1);
          State.reset();
        }

        // Clear login error when switching
        document.getElementById('loginError')?.classList.add('hidden');
      });
    });

    document.getElementById('authFooterLink')?.addEventListener('click', (e) => {
      e.preventDefault();
      const activeTab = document.querySelector('.auth-tab.active');
      const target = activeTab?.dataset.authTab === 'login' ? 'register' : 'login';
      document.querySelector(`[data-auth-tab="${target}"]`)?.click();
    });
  },

  /* ===========================================================
     LOGIN
     =========================================================== */
  setupLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      console.log('Login form submitted.');
      const identifier = document.getElementById('loginIdentifier').value.trim();
      const password = document.getElementById('loginPassword').value;
      const rememberMe = document.getElementById('rememberMe').checked;
      const btn = document.getElementById('loginBtn');
      const errorEl = document.getElementById('loginError');

      // Clear previous error
      errorEl?.classList.add('hidden');

      if (!identifier || !password) {
        this.showLoginError('Please fill all required fields.');
        return;
      }

      btn.classList.add('loading');
      btn.disabled = true;

      try {
        const response = await api.post('/login', { identifier, password, rememberMe });
        if (response && response.success) {
          State.setUser(response.user);
          App.updateNavigation();
          UI.toast('Login successful!', 'success');
          App.navigateTo('dashboard');
        } else {
          this.showLoginError(response?.message || 'Something went wrong. Please try again.');
        }
      } catch (error) {
        this.showLoginError(error.message || 'Something went wrong. Please try again.');
      } finally {
        btn.classList.remove('loading');
        btn.disabled = false;
      }
    });
  },

  showLoginError(message) {
    const errorEl = document.getElementById('loginError');
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.classList.remove('hidden');
    }
  },

  /* ===========================================================
     REGISTRATION — Step 1: Info
     =========================================================== */
  setupRegistration() {
    const continueBtn = document.getElementById('continueToOtp');
    const completeBtn = document.getElementById('completeRegistrationBtn');
    const addChildBtn = document.getElementById('addChildBtn');
    const backBtn = document.getElementById('regBackToInfo');

    if (continueBtn) {
      continueBtn.addEventListener('click', async () => {
        console.log('Continue to OTP button clicked.');
        const first = document.getElementById('regFirstName').value.trim();
        const last = document.getElementById('regLastName').value.trim();
        const phone = this.parsePhone('regPhone');
        const pw = document.getElementById('regPassword').value;
        const confirm = document.getElementById('regConfirmPassword').value;

        if (!first || first.length < 2) {
          UI.toast('Please fill all required fields.', 'error');
          return;
        }
        if (!last || last.length < 2) {
          UI.toast('Please fill all required fields.', 'error');
          return;
        }
        if (!phone) {
          UI.toast('Please enter a valid 9-digit phone number.', 'error');
          return;
        }
        if (pw.length < CONFIG.PASSWORD_MIN_LENGTH) {
          UI.toast(`Password must be at least ${CONFIG.PASSWORD_MIN_LENGTH} characters.`, 'error');
          return;
        }
        if (pw !== confirm) {
          UI.toast('Passwords do not match.', 'error');
          return;
        }

        // Store phone for later
        State.verifiedPhoneNumber = phone;

        // Send OTP
        continueBtn.classList.add('loading');
        continueBtn.disabled = true;

        try {
          const response = await api.post('/send-otp', { phone });
          if (response && response.success) {
            State.otpSent = true;
            UI.toast('An OTP has been sent to your phone.', 'success');

            // Show phone number in step 2
            document.getElementById('regPhoneDisplay').textContent = this.formatPhoneDisplay(phone);

            // Go to step 2
            this.goToStep(2);
            this.clearOTPInputs('regOtpGroup');
            this.startOTPTimer('regOtpTimer');
            document.querySelector('#regOtpGroup .otp-input')?.focus();
          }
        } catch (error) {
          UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
        } finally {
          continueBtn.classList.remove('loading');
          continueBtn.disabled = false;
        }
      });
    }

    if (backBtn) {
      backBtn.addEventListener('click', () => {
        this.goToStep(1);
        State.otpSent = false;
      });
    }

    /* ===========================================================
       REGISTRATION — Step 2: OTP Verification
       =========================================================== */
    const verifyRegBtn = document.getElementById('verifyRegOtpBtn');
    if (verifyRegBtn) {
      verifyRegBtn.addEventListener('click', async () => {
        const otp = this.getOTPValue('regOtpGroup');

        if (!otp || otp.length !== 6) {
          UI.toast('Invalid OTP. Please try again.', 'error');
          return;
        }

        verifyRegBtn.classList.add('loading');
        verifyRegBtn.disabled = true;

        try {
          const response = await api.post('/verify-otp', { phone: State.verifiedPhoneNumber, otp });
          if (response && response.success) {
            State.otpVerified = true;
            UI.toast('Phone number verified successfully!', 'success');
            this.goToStep(3);
            // Add first child form
            if (State.childrenCount === 0) this.addChildForm();
          }
        } catch (error) {
          UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
        } finally {
          verifyRegBtn.classList.remove('loading');
          verifyRegBtn.disabled = false;
        }
      });
    }

    if (addChildBtn) {
      addChildBtn.addEventListener('click', () => {
        if (State.childrenCount >= CONFIG.MAX_CHILDREN) {
          UI.toast(`Maximum ${CONFIG.MAX_CHILDREN} children allowed`, 'warning');
          return;
        }
        this.addChildForm();
      });
    }

    /* ===========================================================
       REGISTRATION — Step 3: Complete
       =========================================================== */
    if (completeBtn) {
      completeBtn.addEventListener('click', async () => {
        if (!State.otpVerified) {
          UI.toast('Please fill all required fields.', 'error');
          return;
        }

        const children = this.getChildrenData();
        if (children.length === 0) {
          UI.toast('Please add at least one child.', 'error');
          return;
        }

        completeBtn.classList.add('loading');
        completeBtn.disabled = true;

        try {
          const response = await api.post('/register', {
            firstName: document.getElementById('regFirstName').value.trim(),
            lastName: document.getElementById('regLastName').value.trim(),
            phone: State.verifiedPhoneNumber,
            password: document.getElementById('regPassword').value,
            email: document.getElementById('regEmail').value.trim() || undefined,
            children,
          });

          if (response && response.success) {
            State.setUser(response.user);
            State.reset();
            App.updateNavigation();
            UI.toast('Registration successful! Welcome to Abugida.', 'success');
            App.navigateTo('dashboard');
          }
        } catch (error) {
          UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
        } finally {
          completeBtn.classList.remove('loading');
          completeBtn.disabled = false;
        }
      });
    }

    // Load schools
    this.loadSchools();
  },

  /* ===========================================================
     OTP INPUTS (shared for registration & forgot password)
     =========================================================== */
  setupOTPInputs() {
    document.querySelectorAll('.otp-input').forEach((input, index) => {
      input.addEventListener('input', (e) => {
        const val = e.target.value.replace(/\D/g, '');
        e.target.value = val;
        if (val) {
          input.classList.add('filled');
          // Move to next
          const parent = input.closest('.otp-group');
          const siblings = parent ? Array.from(parent.querySelectorAll('.otp-input')) : [];
          const idx = siblings.indexOf(input);
          if (idx >= 0 && idx < siblings.length - 1) siblings[idx + 1].focus();
        } else {
          input.classList.remove('filled');
        }
      });
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !e.target.value) {
          const parent = input.closest('.otp-group');
          const siblings = parent ? Array.from(parent.querySelectorAll('.otp-input')) : [];
          const idx = siblings.indexOf(input);
          if (idx > 0) {
            siblings[idx - 1].focus();
            siblings[idx - 1].value = '';
            siblings[idx - 1].classList.remove('filled');
          }
        }
      });
      input.addEventListener('paste', (e) => {
        e.preventDefault();
        const pasted = (e.clipboardData.getData('text') || '').replace(/\D/g, '').slice(0, 6);
        const parent = input.closest('.otp-group');
        const siblings = parent ? Array.from(parent.querySelectorAll('.otp-input')) : [];
        const startIdx = siblings.indexOf(input);
        if (startIdx < 0) return;
        pasted.split('').forEach((char, i) => {
          const target = siblings[startIdx + i];
          if (target) { target.value = char; target.classList.add('filled'); }
        });
        const focusIdx = Math.min(startIdx + pasted.length, siblings.length - 1);
        siblings[focusIdx]?.focus();
      });
      input.addEventListener('focus', () => input.select());
    });
  },

  getOTPValue(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return '';
    return Array.from(group.querySelectorAll('.otp-input')).map(i => i.value).join('');
  },

  clearOTPInputs(groupId) {
    const group = document.getElementById(groupId);
    if (!group) return;
    group.querySelectorAll('.otp-input').forEach(i => { i.value = ''; i.classList.remove('filled'); });
  },

  startOTPTimer(timerId) {
    let timeLeft = CONFIG.OTP_RESEND_DELAY;
    const timerEl = document.getElementById(timerId);

    const update = () => {
      const min = Math.floor(timeLeft / 60);
      const sec = timeLeft % 60;
      timerEl.textContent = `Resend in ${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      if (timeLeft <= 0) {
        timerEl.innerHTML = `<button class="btn btn-ghost btn-sm resend-otp-btn">Resend Code</button>`;
        timerEl.querySelector('.resend-otp-btn')?.addEventListener('click', () => this.resendOTP());
      }
    };

    update();
    const interval = setInterval(() => { timeLeft--; update(); }, 1000);
    timerEl._interval = interval;
  },

  async resendOTP() {
    if (!State.verifiedPhoneNumber) return;
    try {
      const response = await api.post('/send-otp', { phone: State.verifiedPhoneNumber });
      if (response && response.success) {
        UI.toast('An OTP has been sent to your phone.', 'success');
        this.startOTPTimer('regOtpTimer');
      }
    } catch (error) {
      UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
    }
  },

  /* ===========================================================
     REGISTRATION STEPS
     =========================================================== */
  goToStep(step) {
    document.querySelectorAll('.register-step').forEach((s, i) => {
      s.classList.toggle('active', i === step - 1);
    });

    const indicators = document.querySelectorAll('.register-step-indicator');
    const lines = document.querySelectorAll('.register-step-line');

    indicators.forEach((ind, i) => {
      ind.classList.remove('active', 'completed');
      const circle = ind.querySelector('.register-step-circle');
      if (i < step - 1) {
        ind.classList.add('completed');
        circle.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      } else if (i === step - 1) {
        ind.classList.add('active');
        circle.textContent = i + 1;
      } else {
        circle.textContent = i + 1;
      }
    });

    lines.forEach((line, i) => {
      line.classList.toggle('completed', i < step - 1);
    });
  },

  /* ===========================================================
     CHILDREN FORMS
     =========================================================== */
  async loadSchools() {
    try {
      const response = await api.get('/schools');
      if (response && response.success) {
        State.schools = response.schools || [];
      }
    } catch (e) { /* silent */ }
  },

  populateSchoolSelect(select) {
    if (!select) return;
    select.innerHTML = `<option value="">Select a school</option>`;
    State.schools.forEach(school => {
      const opt = document.createElement('option');
      opt.value = school;
      opt.textContent = school;
      select.appendChild(opt);
    });
  },

  populateGradeSelect(select) {
    if (!select) return;
    select.innerHTML = `<option value="">Select a grade</option>`;
    for (let i = 1; i <= 12; i++) {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = `Grade ${i}`;
      select.appendChild(opt);
    }
  },

  addChildForm() {
    State.childrenCount++;
    const container = document.getElementById('childrenContainer');
    const card = document.createElement('div');
    card.className = 'child-form-card';
    card.innerHTML = `
      <div class="child-form-header">
        <h4><span class="child-form-number">${State.childrenCount}</span> Child ${State.childrenCount}</h4>
        ${State.childrenCount > 1 ? `<button type="button" class="btn-remove-child">Remove</button>` : ''}
      </div>
      <div class="form-group">
        <label class="form-label">Full Name <span class="required">*</span></label>
        <input type="text" class="form-input child-name" placeholder="Full Name" required>
      </div>
      <div class="form-row">
        <div class="form-group">
          <label class="form-label">Grade <span class="required">*</span></label>
          <select class="form-select child-grade" required></select>
        </div>
        <div class="form-group">
          <label class="form-label">School <span class="required">*</span></label>
          <select class="form-select child-school" required></select>
        </div>
      </div>
    `;

    container.appendChild(card);
    this.populateGradeSelect(card.querySelector('.child-grade'));
    this.populateSchoolSelect(card.querySelector('.child-school'));

    const removeBtn = card.querySelector('.btn-remove-child');
    if (removeBtn) {
      removeBtn.addEventListener('click', () => {
        card.remove();
        State.childrenCount--;
        this.renumberChildren();
      });
    }
  },

  renumberChildren() {
    const cards = document.querySelectorAll('#childrenContainer .child-form-card');
    cards.forEach((card, i) => {
      const num = i + 1;
      card.querySelector('.child-form-number').textContent = num;
      card.querySelector('h4').innerHTML = `<span class="child-form-number">${num}</span> Child ${num}`;
      const removeBtn = card.querySelector('.btn-remove-child');
      if (removeBtn) removeBtn.style.display = num <= 1 ? 'none' : '';
    });
  },

  getChildrenData() {
    const children = [];
    document.querySelectorAll('#childrenContainer .child-form-card').forEach(card => {
      const fullName = card.querySelector('.child-name')?.value.trim();
      const grade = card.querySelector('.child-grade')?.value;
      const schoolName = card.querySelector('.child-school')?.value;
      if (fullName && grade && schoolName) {
        children.push({ fullName, grade, schoolName });
      }
    });
    return children;
  },

  /* ===========================================================
     FORGOT PASSWORD
     =========================================================== */
  setupForgotPassword() {
    const link = document.getElementById('forgotPasswordLink');
    const modal = document.getElementById('forgotPasswordModal');
    const closeBtn = document.getElementById('forgotPasswordClose');
    const backdrop = document.getElementById('forgotPasswordBackdrop');
    const sendBtn = document.getElementById('forgotSendOtpBtn');
    const resetBtn = document.getElementById('forgotResetBtn');
    const backBtn = document.getElementById('forgotBackBtn');
    const doneBtn = document.getElementById('forgotDoneBtn');

    if (!modal) return;

    // Open modal
    link?.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.forgotResetToStep1();
    });

    // Close modal
    const closeModal = () => {
      modal.classList.remove('active');
      document.body.style.overflow = '';
    };
    closeBtn?.addEventListener('click', closeModal);
    backdrop?.addEventListener('click', closeModal);
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) closeModal();
    });

    // Setup forgot password OTP inputs
    this.setupOTPInputs();

    // Step 1: Send OTP
    sendBtn?.addEventListener('click', async () => {
      const phone = this.parsePhone('forgotPhone');
      if (!phone) {
        UI.toast('Please enter a valid 9-digit phone number.', 'error');
        return;
      }

      sendBtn.classList.add('loading');
      sendBtn.disabled = true;

      try {
        const response = await api.post('/forgot-password', { phone });
        if (response && response.success) {
          State.verifiedPhoneNumber = phone;
          document.getElementById('forgotPhoneDisplay').textContent = this.formatPhoneDisplay(phone);
          document.getElementById('forgotStep1').classList.add('hidden');
          document.getElementById('forgotStep2').classList.remove('hidden');
          this.clearOTPInputs('forgotOtpGroup');
          this.startOTPTimer('forgotOtpTimer');
          document.querySelector('#forgotOtpGroup .otp-input')?.focus();
          UI.toast('An OTP has been sent to your phone.', 'success');
        }
      } catch (error) {
        UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
      } finally {
        sendBtn.classList.remove('loading');
        sendBtn.disabled = false;
      }
    });

    // Step 2: Reset password
    resetBtn?.addEventListener('click', async () => {
      const otp = this.getOTPValue('forgotOtpGroup');
      const newPw = document.getElementById('forgotNewPassword')?.value;
      const confirmPw = document.getElementById('forgotConfirmPassword')?.value;

      if (!otp || otp.length !== 6) {
        UI.toast('Invalid OTP. Please try again.', 'error');
        return;
      }
      if (!newPw || newPw.length < CONFIG.PASSWORD_MIN_LENGTH) {
        UI.toast(`Password must be at least ${CONFIG.PASSWORD_MIN_LENGTH} characters.`, 'error');
        return;
      }
      if (newPw !== confirmPw) {
        UI.toast('Passwords do not match.', 'error');
        return;
      }

      resetBtn.classList.add('loading');
      resetBtn.disabled = true;

      try {
        const response = await api.post('/reset-password', {
          phone: State.verifiedPhoneNumber,
          otp,
          newPassword: newPw,
        });
        if (response && response.success) {
          // Show success step
          document.getElementById('forgotStep2').classList.add('hidden');
          document.getElementById('forgotStep3').classList.remove('hidden');
        }
      } catch (error) {
        UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
      } finally {
        resetBtn.classList.remove('loading');
        resetBtn.disabled = false;
      }
    });

    // Back to phone step
    backBtn?.addEventListener('click', () => {
      this.forgotResetToStep1();
    });

    // Done — close modal and switch to login
    doneBtn?.addEventListener('click', () => {
      closeModal();
      this.forgotResetToStep1();
      // Switch to login tab
      document.querySelector('[data-auth-tab="login"]')?.click();
    });
  },

  forgotResetToStep1() {
    document.getElementById('forgotStep1')?.classList.remove('hidden');
    document.getElementById('forgotStep2')?.classList.add('hidden');
    document.getElementById('forgotStep3')?.classList.add('hidden');
    document.getElementById('forgotPhone').value = '';
    this.clearOTPInputs('forgotOtpGroup');
    const timer = document.getElementById('forgotOtpTimer');
    if (timer?._interval) clearInterval(timer._interval);
    document.getElementById('forgotNewPassword').value = '';
    document.getElementById('forgotConfirmPassword').value = '';
  },
};
