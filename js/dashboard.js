/* ============================================================
   ABUGIDA DASHBOARD MODULE
   Overview, Children, Settings
   ============================================================ */
const Dashboard = {
  async load() {
    if (!State.currentUser) return;
    this.updateUserInfo();
    this.loadSettings();
    this.setupChildrenButtons();
    Payment.loadSubscription();
    // Load schools for child forms
    if (State.schools.length === 0) {
      try {
        const response = await api.get('/schools');
        if (response && response.success) State.schools = response.schools || [];
      } catch (e) { /* silent */ }
    }
    await this.loadChildren();
  },



  setupChildrenButtons() {
    const addBtn = document.getElementById('childrenAddBtn');
    if (addBtn && !addBtn._bound) {
      addBtn._bound = true;
      addBtn.addEventListener('click', () => this.showAddChildModal());
    }
    const overviewAddBtn = document.getElementById('overviewAddChildBtn');
    if (overviewAddBtn && !overviewAddBtn._bound) {
      overviewAddBtn._bound = true;
      overviewAddBtn.addEventListener('click', () => this.showAddChildModal());
    }
  },

  updateUserInfo() {
    const user = State.currentUser;
    if (!user) return;

    // Handle both camelCase and snake_case field names
    const firstName = user.first_name || user.firstName || '';
    const lastName = user.last_name || user.lastName || '';
    const name = `${firstName} ${lastName}`.trim();
    const initials = UI.getInitials(firstName, lastName);

    const sidebarName = document.getElementById('sidebarUserName');
    const sidebarEmail = document.getElementById('sidebarUserEmail');
    const sidebarAvatar = document.getElementById('sidebarAvatar');
    if (sidebarName) sidebarName.textContent = firstName || 'Account';
    if (sidebarEmail) sidebarEmail.textContent = user.email || UI.formatPhone(user.phone);
    if (sidebarAvatar) sidebarAvatar.textContent = initials;

    const welcomeMsg = document.getElementById('welcomeMessage');
    if (welcomeMsg) welcomeMsg.textContent = `Hi, ${firstName}!`;

    const subtitle = document.getElementById('welcomeSubtext');
    if (subtitle) subtitle.textContent = 'Here are the list of your children.';
  },

  async loadChildren() {
    const overviewContainer = document.getElementById('dashboardChildrenList');
    const childrenContainer = document.getElementById('childrenManagement');
    const commsWidget = document.getElementById('communicationsWidget');
    const eventsWidget = document.getElementById('eventsWidget');

    // Show skeletons
    if (overviewContainer) overviewContainer.innerHTML = UI.skeleton('list');
    if (childrenContainer) childrenContainer.innerHTML = UI.skeleton('list');
    if (commsWidget) commsWidget.innerHTML = UI.skeleton('card');
    if (eventsWidget) eventsWidget.innerHTML = UI.skeleton('card');

    try {
      const response = await api.get('/children');
      if (!response || !response.success) throw new Error('Failed');

      const children = response.children || [];

      // Render communications widget
      if (commsWidget) commsWidget.innerHTML = this.renderCommunicationsWidget(children);
      if (eventsWidget) eventsWidget.innerHTML = this.renderEventsWidget(children);

      // Children list (overview)
      if (overviewContainer) {
        if (children.length === 0) {
          overviewContainer.innerHTML = '';
          overviewContainer.appendChild(UI.emptyState({
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
            title: 'No children added yet',
            description: 'Add your children to start tracking their progress.',
            actionText: 'Add Child',
            actionCallback: () => this.showAddChildModal(),
          }));
        } else {
          overviewContainer.innerHTML = `<div class="children-grid" id="overviewChildrenGrid"></div>`;
          const grid = document.getElementById('overviewChildrenGrid');
          children.forEach(child => grid.appendChild(this.createChildCard(child)));
        }
      }

      // Children management page
      if (childrenContainer) {
        if (children.length === 0) {
          childrenContainer.innerHTML = '';
          childrenContainer.appendChild(UI.emptyState({
            icon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
            title: 'No children added yet',
            description: 'Add your children to start tracking their progress.',
            actionText: 'Add Child',
            actionCallback: () => this.showAddChildModal(),
          }));
        } else {
          childrenContainer.innerHTML = `<div class="children-grid" id="managementChildrenGrid"></div>`;
          const grid = document.getElementById('managementChildrenGrid');
          children.forEach(child => grid.appendChild(this.createChildCard(child, true)));
        }
      }
    } catch (error) {
      if (overviewContainer) overviewContainer.innerHTML = '';
      if (childrenContainer) childrenContainer.innerHTML = '';
      if (statsGrid) statsGrid.innerHTML = '';
      UI.toast('Something went wrong. Please try again.', 'error');
    }
  },

  createChildCard(child, showActions = false) {
    const initials = UI.getInitials(child.full_name?.split(' ')[0], child.full_name?.split(' ')[1]);
    const card = document.createElement('div');
    card.className = 'child-card';
    card.innerHTML = `
      <div class="child-card-header">
        <div class="avatar">${initials}</div>
        <div class="child-card-info">
          <div class="child-card-name">${UI.escapeHTML(child.full_name)}</div>
          <div class="child-card-grade">Grade ${UI.escapeHTML(String(child.grade))}</div>
        </div>
      </div>
      <div class="child-card-details">
        <div class="child-card-detail">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          ${UI.escapeHTML(child.school_name)}
        </div>

      </div>
      ${showActions ? `
      <div class="child-card-actions">
        <button class="btn btn-sm btn-secondary edit-child-btn" data-child-id="${child.id}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          Edit Child
        </button>
        <button class="btn btn-sm btn-ghost delete-child-btn" data-child-id="${child.id}" data-child-name="${UI.escapeHTML(child.full_name)}" style="color:var(--color-error)">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          Delete Child
        </button>
      </div>` : ''}
    `;

    if (showActions) {
      card.querySelector('.edit-child-btn')?.addEventListener('click', () => this.showEditChildModal(child));
      card.querySelector('.delete-child-btn')?.addEventListener('click', () => this.confirmDeleteChild(child));
    }

    return card;
  },

  renderCommunicationsWidget(children) {
    if (!children || children.length === 0) {
      return `<div class="overview-empty-state"><p>Add children to see communications from their schools.</p></div>`;
    }
    return `
      <div class="comms-list">
        ${children.map(child => `
          <div class="comm-item">
            <div class="comm-icon">${UI.getInitials(child.full_name?.split(' ')[0], child.full_name?.split(' ')[1])}</div>
            <div class="comm-content">
              <div class="comm-header">
                <span class="comm-title">${UI.escapeHTML(child.full_name)}</span>
                <span class="comm-time">Just now</span>
              </div>
              <div class="comm-body">No new messages from ${UI.escapeHTML(child.school_name)}</div>
              <span class="comm-school">${UI.escapeHTML(child.school_name)}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },

  renderEventsWidget(children) {
    if (!children || children.length === 0) {
      return `<div class="overview-empty-state"><p>Add children to see upcoming events from their schools.</p></div>`;
    }
    return `
      <div class="events-list">
        ${children.map(child => `
          <div class="event-item">
            <div class="event-date-badge">
              <div class="event-dot"></div>
            </div>
            <div class="event-content">
              <span class="event-title">${UI.escapeHTML(child.full_name)}</span>
              <span class="event-meta">${UI.escapeHTML(child.school_name)} • Grade ${UI.escapeHTML(String(child.grade))}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  },
  showAddChildModal() {
    const body = document.createElement('div');
    body.innerHTML = `
      <form id="addChildForm" novalidate>
        <div class="form-group">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <input type="text" id="modalChildName" class="form-input" placeholder="Full Name" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Grade <span class="required">*</span></label>
            <select id="modalChildGrade" class="form-select" required></select>
          </div>
          <div class="form-group">
            <label class="form-label">School <span class="required">*</span></label>
            <select id="modalChildSchool" class="form-select" required></select>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-full btn-lg" id="modalAddChildBtn">Add Child</button>
      </form>
    `;

    UI.openModal({ title: 'Add Child', body });

    setTimeout(() => {
      Auth.populateGradeSelect(document.getElementById('modalChildGrade'));
      Auth.populateSchoolSelect(document.getElementById('modalChildSchool'));

      document.getElementById('addChildForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.addChild();
      });
    }, 0);
  },

  async addChild() {
    const fullName = document.getElementById('modalChildName')?.value.trim();
    const grade = document.getElementById('modalChildGrade')?.value;
    const schoolName = document.getElementById('modalChildSchool')?.value;
    const btn = document.getElementById('modalAddChildBtn');

    if (!fullName || !grade || !schoolName) {
      UI.toast('Please fill all required fields.', 'error');
      return;
    }

    btn?.classList.add('loading');
    if (btn) btn.disabled = true;

    try {
      const response = await api.post('/children', { fullName, grade, schoolName });
      if (response && response.success) {
        UI.toast('Child added successfully.', 'success');
        UI.closeModal();
        await this.loadChildren();
      }
    } catch (error) {
      UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
    } finally {
      btn?.classList.remove('loading');
      if (btn) btn.disabled = false;
    }
  },

  showEditChildModal(child) {
    const body = document.createElement('div');
    body.innerHTML = `
      <form id="editChildForm" novalidate>
        <div class="form-group">
          <label class="form-label">Full Name <span class="required">*</span></label>
          <input type="text" id="editChildName" class="form-input" value="${UI.escapeHTML(child.full_name)}" required>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Grade <span class="required">*</span></label>
            <select id="editChildGrade" class="form-select" required></select>
          </div>
          <div class="form-group">
            <label class="form-label">School <span class="required">*</span></label>
            <select id="editChildSchool" class="form-select" required></select>
          </div>
        </div>
        <button type="submit" class="btn btn-primary btn-full btn-lg">Save Changes</button>
      </form>
    `;

    UI.openModal({ title: 'Edit Child', body });

    setTimeout(() => {
      Auth.populateGradeSelect(document.getElementById('editChildGrade'));
      Auth.populateSchoolSelect(document.getElementById('editChildSchool'));

      const gradeSelect = document.getElementById('editChildGrade');
      const schoolSelect = document.getElementById('editChildSchool');
      if (gradeSelect) gradeSelect.value = child.grade;
      if (schoolSelect) schoolSelect.value = child.school_name;

      document.getElementById('editChildForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this.updateChild(child.id);
      });
    }, 0);
  },

  async updateChild(childId) {
    const fullName = document.getElementById('editChildName')?.value.trim();
    const grade = document.getElementById('editChildGrade')?.value;
    const schoolName = document.getElementById('editChildSchool')?.value;

    if (!fullName || !grade || !schoolName) {
      UI.toast('Please fill all required fields.', 'error');
      return;
    }

    try {
      const response = await api.put(`/children/${childId}`, { fullName, grade, schoolName });
      if (response && response.success) {
        UI.toast('Child updated successfully.', 'success');
        UI.closeModal();
        await this.loadChildren();
      }
    } catch (error) {
      UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
    }
  },

  confirmDeleteChild(child) {
    const body = document.createElement('div');
    body.innerHTML = `
      <p style="margin-bottom:var(--space-6);color:var(--color-text-secondary)">
        Are you sure you want to remove <strong>${UI.escapeHTML(child.full_name)}</strong>? This action cannot be undone.
      </p>
      <div style="display:flex;gap:var(--space-3);justify-content:flex-end">
        <button class="btn btn-secondary" id="cancelDeleteBtn">Cancel</button>
        <button class="btn btn-danger" id="confirmDeleteBtn">Delete Child</button>
      </div>
    `;

    UI.openModal({ title: 'Delete Child', body });

    setTimeout(() => {
      document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => UI.closeModal());
      document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
        try {
          const response = await api.delete(`/children/${child.id}`);
          if (response && response.success) {
            UI.toast('Child deleted successfully.', 'success');
            UI.closeModal();
            await this.loadChildren();
          }
        } catch (error) {
          UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
        }
      });
    }, 0);
  },

  /* --- Settings --- */
  loadSettings() {
    if (!State.currentUser) return;
    const u = State.currentUser;
    const firstName = u.first_name || u.firstName || '';
    const lastName = u.last_name || u.lastName || '';
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('settingsFirstName', firstName);
    setVal('settingsLastName', lastName);
    setVal('settingsEmail', u.email);
    setVal('settingsPhone', UI.formatPhone(u.phone));
  },

  setupSettings() {
    const form = document.getElementById('settingsForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const firstName = document.getElementById('settingsFirstName')?.value.trim();
      const lastName = document.getElementById('settingsLastName')?.value.trim();
      const email = document.getElementById('settingsEmail')?.value.trim();
      const btn = document.getElementById('saveSettingsBtn');

      if (!firstName || !lastName) {
        UI.toast('Please fill all required fields.', 'error');
        return;
      }

      btn?.classList.add('loading');
      if (btn) btn.disabled = true;

      try {
        const response = await api.put('/user', { firstName, lastName, email });
        if (response && response.success) {
          // Update local state with consistent field names
          const user = response.user;
          State.setUser({
            ...State.currentUser,
            first_name: user.first_name || user.firstName,
            last_name: user.last_name || user.lastName,
            email: user.email || email,
          });
          UI.toast('Profile updated successfully.', 'success');
          this.updateUserInfo();
          App.updateNavigation();
        }
      } catch (error) {
        UI.toast(error.message || 'Something went wrong. Please try again.', 'error');
      } finally {
        btn?.classList.remove('loading');
        if (btn) btn.disabled = false;
      }
    });
  },
};
