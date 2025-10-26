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

    // Customer state management
    let currentCustomer = null;
    let isLoggedIn = false;

    // Shopify customer detection
    async function detectShopifyCustomer() {
        try {
            console.log('Bidly: Detecting Shopify customer...');
            
            // Check for Shopify customer data in various locations
            let customerData = null;
            
            // Method 1: Check window.Shopify.customer
            if (window.Shopify?.customer) {
                customerData = {
                    id: window.Shopify.customer.id,
                    email: window.Shopify.customer.email,
                    firstName: window.Shopify.customer.first_name,
                    lastName: window.Shopify.customer.last_name
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
                            lastName: customerJson.last_name
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
                            lastName: customerJson.last_name
                        };
                        console.log('Bidly: Found customer via script tag:', customerData);
                    } catch (e) {
                        console.warn('Bidly: Error parsing customer script:', e);
                    }
                }
            }
            
            // Method 4: Check for customer data in global variables
            if (!customerData && window.customer) {
                customerData = {
                    id: window.customer.id,
                    email: window.customer.email,
                    firstName: window.customer.first_name,
                    lastName: window.customer.last_name
                };
                console.log('Bidly: Found customer via window.customer:', customerData);
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
                            lastName: customerJson.last_name
                        };
                        console.log('Bidly: Found customer via storage:', customerData);
                    } catch (e) {
                        console.warn('Bidly: Error parsing stored customer:', e);
                    }
                }
            }
            
            if (customerData && customerData.email) {
                // Sync customer with backend
                const response = await fetch(`${CONFIG.backendUrl}/api/customers/sync`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        shopifyId: customerData.id,
                        email: customerData.email,
                        firstName: customerData.firstName,
                        lastName: customerData.lastName,
                        shopDomain: CONFIG.shopDomain
                    })
                });
                
                if (response.ok) {
                    const result = await response.json();
                    currentCustomer = result.customer;
                    isLoggedIn = true;
                    console.log('Bidly: Customer synced successfully:', currentCustomer);
                    return true;
                } else {
                    console.warn('Bidly: Failed to sync customer:', response.status);
                }
            }
            
            return false;
        } catch (error) {
            console.error('Bidly: Error detecting Shopify customer:', error);
            return false;
        }
    }

    // Guest login function
    async function guestLogin(name, email) {
        try {
            console.log('Bidly: Attempting guest login...');
            console.log('Bidly: Request data:', { name, email, shopDomain: CONFIG.shopDomain });
            console.log('Bidly: Backend URL:', `${CONFIG.backendUrl}/api/customers/temp-login`);
            
            const response = await fetch(`${CONFIG.backendUrl}/api/customers/temp-login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    email,
                    shopDomain: CONFIG.shopDomain
                })
            });
            
            if (response.ok) {
                const result = await response.json();
                currentCustomer = result.customer;
                isLoggedIn = true;
                console.log('Bidly: Guest login successful:', currentCustomer);
                return true;
            } else {
                const errorText = await response.text();
                console.error('Bidly: Guest login failed:', response.status, errorText);
                return false;
            }
        } catch (error) {
            console.error('Bidly: Error during guest login:', error);
            return false;
        }
    }

    // Open Shopify login
    function openShopifyLogin() {
        const currentUrl = encodeURIComponent(window.location.href);
        const shopDomain = CONFIG.shopDomain;
        const loginUrl = `https://${shopDomain}/account/login?return_to=${currentUrl}`;
        console.log('Bidly: Redirecting to Shopify login:', loginUrl);
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
            // Refresh the page to ensure all components update
            setTimeout(() => {
                window.location.reload();
            }, 500);
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
        
        // Try to detect Shopify customer
        const shopifyCustomerDetected = await detectShopifyCustomer();
        
        if (shopifyCustomerDetected) {
            console.log('Bidly: Shopify customer detected and synced');
            // Dispatch login success event immediately
            window.dispatchEvent(new CustomEvent('bidly-login-success', { 
                detail: { customer: currentCustomer } 
            }));
        } else {
            console.log('Bidly: No Shopify customer detected, will show login options when needed');
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
