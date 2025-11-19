/**
 * Simplified Auction Widget - Following ChatGPT's recommended pattern
 * Uses Shopify customer data directly, falls back to temp login only if needed
 * Includes persistent guest session management
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        backendUrl: (function() {
            // Use backend config if available, otherwise default
            if (window.BidlyBackendConfig) {
                const shopDomain = window.Shopify?.shop?.permanent_domain || window.location.hostname;
                return window.BidlyBackendConfig.getBackendUrl(shopDomain);
            }
            // Fallback to default if backend config not loaded
            console.warn('⚠️ Bidly: Backend config not loaded in widget-simple, using default backend');
            return 'https://bidly-auction-backend.onrender.com';
        })(),
        shopDomain: window.Shopify?.shop?.permanent_domain || window.location.hostname,
        sessionKey: 'bidly_guest_session',
        sessionExpiryHours: 6 // Guest sessions expire after 6 hours
    };

    console.log('Bidly: Simple auction widget initialized');
    console.log('Bidly: Customer data:', window.customerData);

    // Customer state
    let currentCustomer = null;
    let isLoggedIn = false;

    // Session management functions
    function saveGuestSession(customerData) {
        const sessionData = {
            customer: customerData,
            timestamp: Date.now(),
            shopDomain: CONFIG.shopDomain
        };
        
        try {
            localStorage.setItem(CONFIG.sessionKey, JSON.stringify(sessionData));
            console.log('Bidly: Guest session saved to localStorage');
        } catch (error) {
            console.warn('Bidly: Failed to save guest session:', error);
        }
    }

    function loadGuestSession() {
        try {
            const sessionData = localStorage.getItem(CONFIG.sessionKey);
            if (!sessionData) return null;

            const parsed = JSON.parse(sessionData);
            
            // Check if session is for the same shop
            if (parsed.shopDomain !== CONFIG.shopDomain) {
                console.log('Bidly: Session is for different shop, clearing');
                clearGuestSession();
                return null;
            }

            // Check if session has expired
            const sessionAge = Date.now() - parsed.timestamp;
            const maxAge = CONFIG.sessionExpiryHours * 60 * 60 * 1000; // Convert hours to milliseconds
            
            if (sessionAge > maxAge) {
                console.log('Bidly: Guest session expired, clearing');
                clearGuestSession();
                return null;
            }

            console.log('Bidly: Guest session loaded from localStorage');
            return parsed.customer;
        } catch (error) {
            console.warn('Bidly: Failed to load guest session:', error);
            clearGuestSession();
            return null;
        }
    }

    function clearGuestSession() {
        try {
            localStorage.removeItem(CONFIG.sessionKey);
            console.log('Bidly: Guest session cleared from localStorage');
        } catch (error) {
            console.warn('Bidly: Failed to clear guest session:', error);
        }
    }

    // Check if Shopify customer is logged in
    function checkShopifyCustomer() {
        const customer = window.customerData;
        if (customer && customer.email) {
            console.log('Bidly: Shopify customer detected:', customer);
            return customer;
        }
        console.log('Bidly: No Shopify customer detected');
        return null;
    }

    // Save customer to backend
    async function saveCustomer(customerData) {
        try {
            const response = await fetch(`${CONFIG.backendUrl}/api/customers/saveCustomer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shopifyId: customerData.id,
                    email: customerData.email,
                    firstName: customerData.first_name,
                    lastName: customerData.last_name,
                    shopDomain: CONFIG.shopDomain
                })
            });

            if (response.ok) {
                const result = await response.json();
                currentCustomer = result.customer;
                isLoggedIn = true;
                
                // Save guest session if it's a temporary customer
                if (!customerData.id) {
                    saveGuestSession(currentCustomer);
                }
                
                console.log('Bidly: Customer saved successfully:', currentCustomer);
                return true;
            } else if (response.status === 409) {
                // 409 = Customer already exists - backend should return the existing customer
                console.log('Bidly: Customer already exists (409), backend should return existing customer');
                try {
                    // Retry - backend should now return the existing customer
                    const retryResponse = await fetch(`${CONFIG.backendUrl}/api/customers/saveCustomer`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            shopifyId: customerData.id,
                            email: customerData.email,
                            firstName: customerData.first_name,
                            lastName: customerData.last_name,
                            shopDomain: CONFIG.shopDomain
                        })
                    });
                    
                    if (retryResponse.ok) {
                        const retryResult = await retryResponse.json();
                        currentCustomer = retryResult.customer;
                        isLoggedIn = true;
                        
                        // Save guest session if it's a temporary customer
                        if (!customerData.id) {
                            saveGuestSession(currentCustomer);
                        }
                        
                        console.log('Bidly: Retry successful, got existing customer:', currentCustomer);
                        return true;
                    } else {
                        console.error('Bidly: Retry failed after 409:', retryResponse.status);
                        return false;
                    }
                } catch (retryError) {
                    console.error('Bidly: Error retrying after 409:', retryError);
                    return false;
                }
            } else {
                console.error('Bidly: Failed to save customer:', response.status);
                return false;
            }
        } catch (error) {
            console.error('Bidly: Error saving customer:', error);
            return false;
        }
    }

    // Show temp login popup
    function showTempLoginPopup() {
        console.log('Bidly: Showing temp login popup');
        
        // Create simple login modal
        const modal = document.createElement('div');
        modal.className = 'bidly-temp-login-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 10000;
        `;

        modal.innerHTML = `
            <div style="background: white; padding: 30px; border-radius: 10px; max-width: 400px; width: 90%;">
                <h3 style="margin-top: 0;">Login to Bid</h3>
                <p>Please enter your details to participate in this auction:</p>
                <form id="temp-login-form">
                    <div style="margin-bottom: 15px;">
                        <label>Name:</label>
                        <input type="text" id="temp-name" required style="width: 100%; padding: 8px; margin-top: 5px;" autocomplete="name">
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label>Email:</label>
                        <input type="email" id="temp-email" required style="width: 100%; padding: 8px; margin-top: 5px;" autocomplete="email">
                    </div>
                    <div style="text-align: right;">
                        <button type="button" onclick="closeTempLogin()" style="margin-right: 10px; padding: 8px 16px;">Cancel</button>
                        <button type="submit" style="padding: 8px 16px; background: #007cba; color: white; border: none; border-radius: 4px;">Login</button>
                    </div>
                </form>
                <div style="margin-top: 15px; font-size: 12px; color: #666;">
                    Your session will be remembered for 6 hours or until you close your browser.
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Handle form submission
        document.getElementById('temp-login-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('temp-name').value.trim();
            const email = document.getElementById('temp-email').value.trim();

            if (!name || !email) {
                alert('Please enter both name and email.');
                return;
            }

            // Create temp customer data
            const tempCustomer = {
                id: null,
                email: email,
                first_name: name.split(' ')[0],
                last_name: name.split(' ').slice(1).join(' ') || 'Guest'
            };

            const success = await saveCustomer(tempCustomer);
            if (success) {
                closeTempLogin();
                // Refresh widget to show logged-in state
                window.dispatchEvent(new CustomEvent('bidly-login-success'));
            } else {
                alert('Login failed. Please try again.');
            }
        });
    }

    // Close temp login
    function closeTempLogin() {
        const modal = document.querySelector('.bidly-temp-login-modal');
        if (modal) {
            modal.remove();
        }
    }

    // Logout function
    function logout() {
        currentCustomer = null;
        isLoggedIn = false;
        clearGuestSession();
        console.log('Bidly: User logged out');
        window.dispatchEvent(new CustomEvent('bidly-logout'));
    }

    // Make functions globally available
    window.closeTempLogin = closeTempLogin;

    // Initialize customer detection
    async function init() {
        console.log('Bidly: Initializing customer detection...');
        
        const shopifyCustomer = checkShopifyCustomer();
        
        if (shopifyCustomer) {
            // Shopify customer found - save to backend
            const success = await saveCustomer(shopifyCustomer);
            if (success) {
                console.log('Bidly: Shopify customer logged in successfully');
                // Dispatch login success event
                window.dispatchEvent(new CustomEvent('bidly-login-success'));
            }
        } else {
            // Check for existing guest session
            const guestSession = loadGuestSession();
            if (guestSession) {
                currentCustomer = guestSession;
                isLoggedIn = true;
                console.log('Bidly: Guest session restored:', currentCustomer);
                // Dispatch login success event
                window.dispatchEvent(new CustomEvent('bidly-login-success'));
            } else {
                console.log('Bidly: No Shopify customer or guest session - will show temp login when needed');
            }
        }
    }

    // Check if user is logged in
    function isUserLoggedIn() {
        return isLoggedIn && currentCustomer;
    }

    // Get current customer
    function getCurrentCustomer() {
        return currentCustomer;
    }

    // Expose API
    window.BidlySimpleLogin = {
        init,
        isUserLoggedIn,
        getCurrentCustomer,
        showTempLoginPopup,
        logout,
        clearGuestSession,
        CONFIG
    };

    // Auto-initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
