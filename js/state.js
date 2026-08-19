/* ============================================================
   ABUGIDA STATE MANAGEMENT
   ============================================================ */
const State = {
  currentUser: null,
  currentPage: 'home',
  currentDashboardPage: 'overview',
  otpSent: false,
  otpVerified: false,
  verifiedPhoneNumber: null,
  childrenCount: 0,
  otpTimerInterval: null,
  schools: [],
  subscription: null,
  pendingPlanType: null,  // ADD THIS

  reset() {
    this.otpSent = false;
    this.otpVerified = false;
    this.verifiedPhoneNumber = null;
    this.childrenCount = 0;
    this.pendingPlanType = null;  // ADD THIS
    if (this.otpTimerInterval) {
      clearInterval(this.otpTimerInterval);
      this.otpTimerInterval = null;
    }
  },

  setUser(user) {
    this.currentUser = user;
  },
};