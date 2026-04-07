/**
 * Customer Authentication Service
 * Handles customer authentication for the auction marketplace.
 * When running inside a Shopify Storefront (via app proxy) we rely on Shopify customer sessions.
 * Otherwise we fall back to local sessionStorage for non-Shopify environments.
 */

const getMarketplaceConfig = () => {
  if (typeof window === 'undefined') {
    return {};
  }
  return window.BidlyMarketplaceConfig || {};
};

const buildCustomerFromConfig = (configCustomer = {}) => ({
  id: configCustomer.id,
  email: configCustomer.email,
  name: configCustomer.name || configCustomer.email || 'Shopify Customer',
  fullName: configCustomer.name || configCustomer.email || 'Shopify Customer',
  firstName: configCustomer.firstName || '',
  lastName: configCustomer.lastName || '',
  isTemp: false,
  source: 'shopify'
});

class CustomerAuthService {
  constructor() {
    this.customer = null;
    this.loadFromStorage();
  }

  /**
   * Load customer data from Shopify session, shared login system, or sessionStorage
   */
  loadFromStorage() {
    try {
      // Attempt Shopify marketplace config first
      const marketplaceConfig = getMarketplaceConfig();
      if (marketplaceConfig.customer?.logged_in) {
        this.customer = buildCustomerFromConfig(marketplaceConfig.customer);
        return;
      }

      // Try shared login system used by the widget
      if (window.BidlyHybridLogin) {
        const sharedCustomer = window.BidlyHybridLogin.getCurrentCustomer();
        const isLoggedIn = window.BidlyHybridLogin.isUserLoggedIn();

        if (isLoggedIn && sharedCustomer) {
          this.customer = sharedCustomer;
          return;
        }
      }

      // Check localStorage for returning bidder (shared with widget)
      const bidderStr = localStorage.getItem('bidly_bidder');
      if (bidderStr) {
        const bidder = JSON.parse(bidderStr);
        if (bidder.email) {
          this.customer = {
            id: bidder.customerId || ('bidder_' + Date.now()),
            email: bidder.email,
            name: bidder.name || bidder.email,
            fullName: bidder.name || bidder.email,
            firstName: bidder.firstName || null,
            lastName: bidder.lastName || null,
            phone: bidder.phone || null,
            isTemp: false,
            isBidlyBidder: true
          };
          return;
        }
      }

      // Fall back to sessionStorage (legacy)
      const stored = sessionStorage.getItem('customerAuth');
      if (stored) {
        this.customer = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading customer from storage:', error);
      this.customer = null;
    }
  }

  /**
   * Check if customer is authenticated
   */
  isAuthenticated() {
    return this.customer !== null;
  }

  /**
   * Get current customer data
   */
  getCustomer() {
    return this.customer;
  }

  /**
   * Get customer name for display
   */
  getCustomerName() {
    if (this.customer) {
      return this.customer.fullName || this.customer.name || 'Guest';
    }
    return 'Guest';
  }

  /**
   * Get customer email (for admin purposes)
   */
  getCustomerEmail() {
    return this.customer ? this.customer.email : null;
  }

  /**
   * Login/Register customer
   */
  async login(customerData) {
    try {
      const marketplaceConfig = getMarketplaceConfig();

      if (marketplaceConfig.customer?.logged_in) {
        this.customer = buildCustomerFromConfig(marketplaceConfig.customer);
        return true;
      }

      // Try shared login system first
      if (window.BidlyHybridLogin) {
        const success = await window.BidlyHybridLogin.guestLogin(
          customerData.name,
          customerData.email
        );
        if (success) {
          const sharedCustomer = window.BidlyHybridLogin.getCurrentCustomer();
          if (sharedCustomer) {
            this.customer = sharedCustomer;
            return true;
          }
        }
      }

      // Save to localStorage (persistent) and sessionStorage (legacy)
      localStorage.setItem('bidly_bidder', JSON.stringify({
        name: customerData.name,
        email: customerData.email,
        phone: customerData.phone || null,
        firstName: customerData.firstName || null,
        lastName: customerData.lastName || null,
        customerId: customerData.id,
        timestamp: Date.now()
      }));
      sessionStorage.setItem('customerAuth', JSON.stringify(customerData));
      this.customer = customerData;

      return true;
    } catch (error) {
      console.error('Error storing customer data:', error);
      return false;
    }
  }

  /**
   * Logout customer
   */
  logout() {
    try {
      // Use shared login system if available
      if (window.BidlyHybridLogin) {
        window.BidlyHybridLogin.logout();
      }

      // Clear all storage
      sessionStorage.removeItem('customerAuth');
      localStorage.removeItem('bidly_bidder');
      this.customer = null;

      return true;
    } catch (error) {
      console.error('Error clearing customer data:', error);
      return false;
    }
  }

  /**
   * Get customer data for API requests
   */
  getCustomerForAPI() {
    if (!this.customer) {
      return null;
    }

    return {
      customerId: this.customer.id,
      customerName: this.customer.fullName || this.customer.name,
      customerEmail: this.customer.email
    };
  }

  /**
   * Validate customer data
   */
  validateCustomerData(customerData) {
    if (!customerData) {
      return { valid: false, error: 'Customer data is required' };
    }

    if (!customerData.name || !customerData.name.trim()) {
      return { valid: false, error: 'Name is required' };
    }

    if (!customerData.email || !customerData.email.trim()) {
      return { valid: false, error: 'Email is required' };
    }

    if (!/\S+@\S+\.\S+/.test(customerData.email)) {
      return { valid: false, error: 'Please enter a valid email address' };
    }

    return { valid: true };
  }

  /**
   * Get session info
   */
  getSessionInfo() {
    if (!this.customer) {
      return null;
    }

    return {
      name: this.customer.name,
      email: this.customer.email,
      loginTime: this.customer.loginTime,
      sessionDuration: Date.now() - new Date(this.customer.loginTime).getTime()
    };
  }
}

// Create a singleton instance
const customerAuthService = new CustomerAuthService();

export default customerAuthService;
