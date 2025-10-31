/**
 * Bidly Hybrid Login System
 * Shared login functionality for all auction components
 */

(function() {
    'use strict';

    // Configuration
    const CONFIG = {
        backendUrl: 'https://bidly-auction-backend.onrender.com',
        shopDomain: window.Shopify?.shop?.permanent_domain || window.location.hostname
    };
    
    console.log('Bidly: Configuration loaded:', CONFIG);
    console.log('Bidly: window.Shopify:', window.Shopify);
    console.log('Bidly: window.location.hostname:', window.location.hostname);

    // Customer state management
    let currentCustomer = null;
    let isLoggedIn = false;

    // Shopify customer detection
    async function detectShopifyCustomer() {
        try {
            console.log('Bidly: Detecting Shopify customer...');
            console.log('Bidly: window.Shopify:', window.Shopify);
            console.log('Bidly: window.Shopify?.customer:', window.Shopify?.customer);
            
            // Check for Shopify customer data in various locations
            let customerData = null;
            
            // Method 1: Check window.Shopify.customer
            if (window.Shopify?.customer && window.Shopify.customer.id) {
                customerData = {
                    id: window.Shopify.customer.id,
                    email: window.Shopify.customer.email,
                    firstName: window.Shopify.customer.first_name,
                    lastName: window.Shopify.customer.last_name || 'Customer'
                };
                console.log('Bidly: Found customer via window.Shopify.customer:', customerData);
            }
            
            // Method 2: Check for customer data in meta tags
            if (!customerData) {
                const customerMeta = document.querySelector('meta[name="shopify-customer"]');
                if (customerMeta) {
                    try {
                        const customerJson = JSON.parse(customerMeta.content);
                        customerData = {
                            id: customerJson.id,
                            email: customerJson.email,
                            firstName: customerJson.first_name,
                            lastName: customerJson.last_name || 'Customer'
                        };
                        console.log('Bidly: Found customer via meta tag:', customerData);
                    } catch (e) {
                        console.warn('Bidly: Error parsing customer meta tag:', e);
                    }
                }
            }
            
            // Method 3: Check for customer data in script tags
            if (!customerData) {
                const customerScript = document.querySelector('script[data-customer]');
                if (customerScript) {
                    try {
                        const customerJson = JSON.parse(customerScript.textContent);
                        customerData = {
                            id: customerJson.id,
                            email: customerJson.email,
                            firstName: customerJson.first_name,
                            lastName: customerJson.last_name || 'Customer'
                        };
                        console.log('Bidly: Found customer via script tag:', customerData);
                    } catch (e) {
                        console.warn('Bidly: Error parsing customer script:', e);
                    }
                }
            }
            
            // Method 4: Check for customer data in global variables
            if (!customerData && window.customer && window.customer.id) {
                customerData = {
                    id: window.customer.id,
                    email: window.customer.email,
                    firstName: window.customer.first_name,
                    lastName: window.customer.last_name || 'Customer'
                };
                console.log('Bidly: Found customer via window.customer:', customerData);
            }
            
            // Method 5: Check for customer data in window.customerData
            if (!customerData && window.customerData) {
                try {
                    const customerJson = typeof window.customerData === 'string' 
                        ? JSON.parse(window.customerData) 
                        : window.customerData;
                    
                    if (customerJson.id) {
                        customerData = {
                            id: customerJson.id,
                            email: customerJson.email,
                            firstName: customerJson.first_name || customerJson.firstName,
                            lastName: customerJson.last_name || customerJson.lastName || 'Customer'
                        };
                        console.log('Bidly: Found customer via window.customerData:', customerData);
                    }
                } catch (e) {
                    console.log('Bidly: Failed to parse window.customerData:', e);
                }
            }
            
            // Method 6: Check for customer data in Shopify global object
            if (!customerData && window.Shopify?.customerData) {
                try {
                    const customerJson = typeof window.Shopify.customerData === 'string' 
                        ? JSON.parse(window.Shopify.customerData) 
                        : window.Shopify.customerData;
                    
                    if (customerJson.id) {
                        customerData = {
                            id: customerJson.id,
                            email: customerJson.email,
                            firstName: customerJson.first_name || customerJson.firstName,
                            lastName: customerJson.last_name || customerJson.lastName || 'Customer'
                        };
                        console.log('Bidly: Found customer via window.Shopify.customerData:', customerData);
                    }
                } catch (e) {
                    console.log('Bidly: Failed to parse window.Shopify.customerData:', e);
                }
            }
            
            // Method 5: Check for customer data in localStorage/sessionStorage
            if (!customerData) {
                const storedCustomer = localStorage.getItem('shopify_customer') || sessionStorage.getItem('shopify_customer');
                if (storedCustomer) {
                    try {
                        const customerJson = JSON.parse(storedCustomer);
                        customerData = {
                            id: customerJson.id,
                            email: customerJson.email,
                            firstName: customerJson.first_name,
                            lastName: customerJson.last_name || 'Customer'
                        };
                        console.log('Bidly: Found customer via storage:', customerData);
                    } catch (e) {
                        console.warn('Bidly: Error parsing stored customer:', e);
                    }
                }
            }
            
            if (customerData && customerData.email) {
                // Set customer data locally first
                const customerLastName = customerData.lastName || 'Customer';
                currentCustomer = {
                    id: customerData.id,
                    email: customerData.email,
                    firstName: customerData.firstName,
                    lastName: customerLastName,
                    fullName: `${customerData.firstName} ${customerLastName}`,
                    shopifyId: customerData.id,
                    isTemp: false
                };
                isLoggedIn = true;
                console.log('Bidly: Customer detected locally:', currentCustomer);
                
                // Clear any guest customer data from sessionStorage since we have a Shopify customer
                try {
                    sessionStorage.removeItem('bidly_guest_customer');
                    console.log('Bidly: Cleared guest customer from sessionStorage (Shopify customer detected)');
                } catch (storageError) {
                    console.warn('Bidly: Could not clear guest storage:', storageError);
                }
                
                // Try to sync with backend (but don't fail if it doesn't work)
                try {
                    const response = await fetch(`${CONFIG.backendUrl}/api/customers/saveCustomer`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                    body: JSON.stringify({
                        shopifyId: customerData.id,
                        email: customerData.email,
                        firstName: customerData.firstName,
                        lastName: customerData.lastName || 'Customer', // Fallback for missing last names
                        shopDomain: CONFIG.shopDomain
                    })
                    });
                    
                    if (response.ok) {
                        const result = await response.json();
                        currentCustomer = result.customer;
                        console.log('Bidly: Customer synced with backend:', currentCustomer);
                    } else {
                        const errorText = await response.text();
                        console.warn('Bidly: Failed to sync customer with backend:', response.status, errorText);
                        // Continue with local customer data
                    }
                } catch (error) {
                    console.warn('Bidly: Error syncing customer with backend:', error);
                    // Continue with local customer data
                }
                
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Bidly: Error detecting Shopify customer:', error);
            return false;
        }
    }

    // Guest login function (session-only, no database saving)
    async function guestLogin(name, email) {
        try {
            console.log('Bidly: Attempting guest login (session-only)...');
            
            // Parse name into first and last name
            const nameParts = name.trim().split(' ');
            const firstName = nameParts[0];
            const lastName = nameParts.slice(1).join(' ') || 'Guest';
            
            // Create guest customer object (NOT saved to database)
            const guestCustomer = {
                id: 'guest_' + Date.now(), // Temporary ID
                email: email,
                firstName: firstName,
                lastName: lastName,
                fullName: `${firstName} ${lastName}`,
                isTemp: true,
                shopifyId: null // No Shopify ID = guest
            };
            
            // Store in sessionStorage only (cleared when browser closes)
            try {
                sessionStorage.setItem('bidly_guest_customer', JSON.stringify(guestCustomer));
                console.log('Bidly: Guest customer stored in sessionStorage');
            } catch (storageError) {
                console.warn('Bidly: Could not store guest in sessionStorage:', storageError);
            }
            
            // Set current customer (session-only)
            currentCustomer = guestCustomer;
            isLoggedIn = true;
            
            console.log('Bidly: Guest login successful (session-only):', currentCustomer);
            return true;
        } catch (error) {
            console.error('Bidly: Error during guest login:', error);
            return false;
        }
    }

    // Open Shopify login
    function openShopifyLogin() {
        const currentUrl = encodeURIComponent(window.location.href);
        let shopDomain = CONFIG.shopDomain;
        
        // Ensure shopDomain has the correct format
        if (!shopDomain.includes('.myshopify.com')) {
            // If it's just the hostname, try to construct the proper domain
            if (shopDomain.includes('myshopify.com')) {
                // Already has myshopify.com, use as is
            } else {
                // Add .myshopify.com if missing
                shopDomain = shopDomain.replace('.myshopify.com', '') + '.myshopify.com';
            }
        }
        
        const loginUrl = `https://${shopDomain}/account/login?return_to=${currentUrl}`;
        console.log('Bidly: Redirecting to Shopify login:', loginUrl);
        console.log('Bidly: Shop domain used:', shopDomain);
        window.location.href = loginUrl;
    }

    // Open guest login modal
    function openGuestLogin() {
        const modal = document.createElement('div');
        modal.className = 'bidly-modal-overlay';
        modal.innerHTML = `
            <div class="bidly-modal-content">
                <div class="bidly-modal-header">
                    <h3>Continue as Guest</h3>
                    <button class="bidly-modal-close" onclick="window.BidlyHybridLogin.closeGuestLoginModal()">&times;</button>
                </div>
                <div class="bidly-modal-body">
                    <form id="bidly-guest-login-form" onsubmit="window.BidlyHybridLogin.submitGuestLogin(event)">
                        <div class="bidly-form-group">
                            <label for="bidly-guest-name">Full Name</label>
                            <input type="text" id="bidly-guest-name" name="name" autocomplete="name" required>
                        </div>
                        <div class="bidly-form-group">
                            <label for="bidly-guest-email">Email Address</label>
                            <input type="email" id="bidly-guest-email" name="email" autocomplete="email" required>
                        </div>
                        <div class="bidly-form-actions">
                            <button type="submit" class="bidly-btn bidly-btn-primary">Continue as Guest</button>
                            <button type="button" class="bidly-btn bidly-btn-secondary" onclick="window.BidlyHybridLogin.closeGuestLoginModal()">Cancel</button>
                        </div>
                    </form>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    // Close guest login modal
    function closeGuestLoginModal() {
        const modal = document.querySelector('.bidly-modal-overlay');
        if (modal) {
            modal.remove();
        }
    }

    // Submit guest login
    async function submitGuestLogin(event) {
        event.preventDefault();
        console.log('Bidly: Submitting guest login form...');
        
        const nameInput = document.getElementById('bidly-guest-name');
        const emailInput = document.getElementById('bidly-guest-email');
        
        if (!nameInput || !emailInput) {
            console.error('Bidly: Form inputs not found');
            alert('Form error. Please try again.');
            return;
        }
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        console.log('Bidly: Form data:', { name, email });

        if (!name || !email) {
            alert('Please enter both name and email');
            return;
        }

        console.log('Bidly: Attempting guest login...');
        const success = await guestLogin(name, email);
        if (success) {
            console.log('Bidly: Guest login successful');
            closeGuestLoginModal();
            // Trigger custom event for components to listen to
            window.dispatchEvent(new CustomEvent('bidly-login-success', { 
                detail: { customer: currentCustomer } 
            }));
            console.log('Bidly: Login success event dispatched');
        } else {
            console.error('Bidly: Guest login failed');
            alert('Login failed. Please try again.');
        }
    }

    // Logout function
    function logout() {
        currentCustomer = null;
        isLoggedIn = false;
        // Trigger custom event for components to listen to
        window.dispatchEvent(new CustomEvent('bidly-logout', { 
            detail: { customer: null } 
        }));
        // Refresh the page to ensure all components update
        setTimeout(() => {
            window.location.reload();
        }, 500);
    }

    // Get current customer
    function getCurrentCustomer() {
        return currentCustomer;
    }

    // Check if logged in
    function isUserLoggedIn() {
        return isLoggedIn;
    }

    // Initialize login system
    async function init() {
        console.log('Bidly: Initializing hybrid login system...');
        
        // First, try to detect Shopify customer (this takes priority)
        const shopifyCustomerDetected = await detectShopifyCustomer();
        
        if (shopifyCustomerDetected) {
            console.log('Bidly: Shopify customer detected and synced');
            // Dispatch login success event immediately
            window.dispatchEvent(new CustomEvent('bidly-login-success', { 
                detail: { customer: currentCustomer } 
            }));
        } else {
            // If no Shopify customer, check for guest customer in sessionStorage
            try {
                const guestCustomerStr = sessionStorage.getItem('bidly_guest_customer');
                if (guestCustomerStr) {
                    const guestCustomer = JSON.parse(guestCustomerStr);
                    currentCustomer = guestCustomer;
                    isLoggedIn = true;
                    console.log('Bidly: Guest customer restored from sessionStorage:', guestCustomer);
                } else {
                    console.log('Bidly: No customer detected, will show login options when needed');
                }
            } catch (storageError) {
                console.warn('Bidly: Error reading guest customer from sessionStorage:', storageError);
            }
        }
    }

    // Expose global API
    window.BidlyHybridLogin = {
        init,
        detectShopifyCustomer,
        guestLogin,
        openShopifyLogin,
        openGuestLogin,
        closeGuestLoginModal,
        submitGuestLogin,
        logout,
        getCurrentCustomer,
        isUserLoggedIn,
        CONFIG
    };

    // Auto-initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
