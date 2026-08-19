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

  reset() {
    this.otpSent = false;
    this.otpVerified = false;
    this.verifiedPhoneNumber = null;
    this.childrenCount = 0;
    if (this.otpTimerInterval) {
      clearInterval(this.otpTimerInterval);
      this.otpTimerInterval = null;
    }
  },

  setUser(user) {
    this.currentUser = user;
  },
};
