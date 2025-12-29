/**
 * Bidly Hybrid Login System
 * Shared login functionality for all auction components
 */

(function() {
    'use strict';

    const console = (() => {
        if (typeof window !== 'undefined' && window.BidlyDebugUtils?.createConsole) {
            return window.BidlyDebugUtils.createConsole('Widget');
        }
        const fallback = (typeof window !== 'undefined' && window.console) || {};
        return {
            log: fallback.log ? fallback.log.bind(fallback) : () => {},
            warn: fallback.warn ? fallback.warn.bind(fallback) : () => {},
            error: fallback.error ? fallback.error.bind(fallback) : () => {}
        };
    })();

    // Configuration
    const resolveShopDomain = () => {
        const candidates = [
            window.Shopify?.shop?.permanent_domain,
            window.Shopify?.shop,
            window.Shopify?.config?.shop,
            window.location.hostname
        ];

        let detected = '';
        for (const candidate of candidates) {
            if (!candidate) {
                continue;
            }
            const cleaned = window.BidlyBackendConfig?.cleanDomain
                ? window.BidlyBackendConfig.cleanDomain(candidate)
                : candidate.toString().toLowerCase();
            if (!cleaned) {
                continue;
            }
            detected = cleaned;
            if (cleaned.endsWith('.myshopify.com')) {
                break;
            }
        }

        if (window.BidlyBackendConfig?.getCanonicalShopDomain) {
            const canonical = window.BidlyBackendConfig.getCanonicalShopDomain(detected || window.location.hostname);
            if (canonical) {
                return canonical;
            }
        }

        return detected || window.location.hostname;
    };

    const SHOP_DOMAIN = resolveShopDomain();

    const CONFIG = {
        backendUrl: (function() {
            // Use backend config if available, otherwise default
            if (window.BidlyBackendConfig) {
                return window.BidlyBackendConfig.getBackendUrl(SHOP_DOMAIN);
            }
            // Fallback to default if backend config not loaded
            console.warn('⚠️ Bidly: Backend config not loaded in hybrid-login, using default backend');
            return 'https://bidly-auction-backend.onrender.com';
        })(),
        shopDomain: SHOP_DOMAIN
    };
    
    console.log('Bidly: Configuration loaded:', CONFIG);
    console.log('Bidly: window.Shopify:', window.Shopify);
    console.log('Bidly: window.location.hostname:', window.location.hostname);

    // Customer state management
    let currentCustomer = null;
    let isLoggedIn = false;
    let proxyPrefetchPromise = null;
    let proxyPrefetchResult = null;
    let proxyPrefetchTimestamp = 0;

    function getCustomerIdCandidates() {
        const ids = new Set();
        const add = (value) => {
            if (!value) {
                return;
            }
            const normalized = value.toString().split('/').pop().trim();
            if (normalized) {
                ids.add(normalized);
            }
        };

        add(window.Shopify?.customer?.id);
        add(window.ShopifyAnalytics?.meta?.page?.customerId);
        add(window.meta?.page?.customerId);
        add(window.__st?.cid);
        add(currentCustomer?.shopifyId);

        try {
            const stored = sessionStorage.getItem('bidly_last_customer_id');
            if (stored) {
                add(stored);
            }
        } catch (storageError) {
            console.warn('Bidly: Unable to read stored customer id', storageError);
        }

        return Array.from(ids);
    }

    async function requestCustomerContext(customerId) {
        const params = new URLSearchParams();
        params.append('_', Date.now().toString());
        if (customerId) {
            params.append('logged_in_customer_id', customerId);
            params.append('customer_id', customerId);
        }
        // include Shopify's known customer id when available
        const shopifyCustomerId = window.Shopify?.customer?.id;
        if (!customerId && shopifyCustomerId) {
            params.append('shopify_customer_id', shopifyCustomerId.toString());
        }

        const response = await fetch(`/apps/bidly/customer/context?${params.toString()}`, {
            credentials: 'include',
            headers: {
                'Accept': 'application/json'
            },
            cache: 'no-store'
        });

        if (!response.ok) {
            return null;
        }

        const data = await response.json();
        if (data?.success && data.loggedIn && data.customer?.email) {
            return {
                id: data.customer.id,
                email: data.customer.email,
                firstName: data.customer.firstName || null,
                lastName: data.customer.lastName || null,
                fullName: data.customer.fullName || null,
                displayName: data.customer.fullName || data.customer.email || 'Shopify Customer'
            };
        }

        return null;
    }

    async function fetchCustomerContextViaProxy() {
        try {
            if (!proxyPrefetchPromise || Date.now() - proxyPrefetchTimestamp > 3000) {
                proxyPrefetchTimestamp = Date.now();
                proxyPrefetchPromise = requestCustomerContext(null)
                    .then((result) => {
                        proxyPrefetchResult = result;
                        return result;
                    })
                    .catch((error) => {
                        console.warn('Bidly: Proxy prefetch failed', error);
                        proxyPrefetchResult = null;
                        return null;
                    });
            }

            if (proxyPrefetchResult && proxyPrefetchResult.email) {
                return proxyPrefetchResult;
            }

            const prefetched = await proxyPrefetchPromise;
            if (prefetched && prefetched.email) {
                return prefetched;
            }

            const candidates = getCustomerIdCandidates();

            for (const candidate of candidates) {
                const context = await requestCustomerContext(candidate);
                if (context) {
                    proxyPrefetchResult = context;
                    return context;
                }
            }

            const fallback = await requestCustomerContext(null);
            if (fallback) {
                proxyPrefetchResult = fallback;
                return fallback;
            }
        } catch (error) {
            console.warn('Bidly: Failed to fetch customer context via proxy', error);
        }
        return null;
    }

    async function persistCustomerToBackend(customerData) {
        if (!customerData || !customerData.email) {
            return false;
        }

        try {
            const response = await fetch(`${CONFIG.backendUrl}/api/customers/saveCustomer`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shopifyId: customerData.id || customerData.shopifyId || null,
                    email: customerData.email,
                    firstName: customerData.firstName || customerData.first_name || undefined,
                    lastName: customerData.lastName || customerData.last_name || undefined,
                    displayName: customerData.displayName || customerData.fullName || undefined,
                    shopDomain: CONFIG.shopDomain
                })
            });

            if (response.ok) {
                const result = await response.json();
                const persisted = result.customer || {};
                const displayName =
                    persisted.displayName ||
                    persisted.fullName ||
                    customerData.displayName ||
                    customerData.fullName ||
                    customerData.email ||
                    'Shopify Customer';

                currentCustomer = {
                    id: persisted.id || persisted._id || customerData.id || customerData.shopifyId,
                    email: persisted.email || customerData.email,
                    firstName: persisted.firstName || customerData.firstName || null,
                    lastName: persisted.lastName || customerData.lastName || null,
                    fullName: persisted.fullName || customerData.fullName || displayName,
                    displayName,
                    shopifyId: persisted.shopifyId || customerData.id || customerData.shopifyId || null,
                    isTemp: persisted.isTemp === true
                };
                isLoggedIn = true;
                console.log('Bidly: Customer synced with backend:', currentCustomer);
                try {
                    if (currentCustomer.shopifyId) {
                        sessionStorage.setItem('bidly_last_customer_id', currentCustomer.shopifyId.toString());
                    }
                } catch (storageError) {
                    console.warn('Bidly: Unable to store Shopify customer id:', storageError);
                }
                return true;
            }

            if (response.status === 409) {
                const errorData = await response.json().catch(() => null);
                const existing = errorData?.existingCustomer || errorData?.customer;
                if (existing) {
                    currentCustomer = {
                        id: existing.id || existing._id || customerData.id,
                        email: existing.email || customerData.email,
                        firstName: existing.firstName || customerData.firstName || null,
                        lastName: existing.lastName || customerData.lastName || null,
                        fullName: existing.fullName || customerData.fullName || existing.displayName,
                        displayName: existing.displayName || customerData.displayName || customerData.email,
                        shopifyId: existing.shopifyId || customerData.id || customerData.shopifyId,
                        isTemp: existing.isTemp === true
                    };
                    isLoggedIn = true;
                    console.log('Bidly: Using existing customer from 409 response:', currentCustomer);
                    return true;
                }

                if (customerData.email) {
                    try {
                        const fetchResponse = await fetch(`${CONFIG.backendUrl}/api/customers/by-email?email=${encodeURIComponent(customerData.email)}&shop=${encodeURIComponent(CONFIG.shopDomain)}`);
                        if (fetchResponse.ok) {
                            const fetchResult = await fetchResponse.json();
                            if (fetchResult.success && fetchResult.customer) {
                                const fetched = fetchResult.customer;
                                currentCustomer = {
                                    id: fetched.id || fetched._id || customerData.id,
                                    email: fetched.email || customerData.email,
                                    firstName: fetched.firstName || customerData.firstName || null,
                                    lastName: fetched.lastName || customerData.lastName || null,
                                    fullName: fetched.fullName || customerData.fullName || fetched.displayName,
                                    displayName: fetched.displayName || customerData.displayName || customerData.email,
                                    shopifyId: fetched.shopifyId || customerData.id || customerData.shopifyId,
                                    isTemp: fetched.isTemp === true
                                };
                                isLoggedIn = true;
                                console.log('Bidly: Fetched existing customer via GET:', currentCustomer);
                                return true;
                            }
                        }
                    } catch (fetchError) {
                        console.warn('Bidly: Failed to fetch customer via GET after 409:', fetchError);
                    }
                }
            }

            console.warn('Bidly: Failed to sync customer with backend:', response.status);
        } catch (error) {
            console.warn('Bidly: Error syncing customer with backend:', error);
        }

        return false;
    }

    // Shopify customer detection
    async function detectShopifyCustomer() {
        const MAX_ATTEMPTS = 8;
        const BASE_DELAY_MS = 250;
        
        // Detect Dawn theme for special handling
        const isDawnTheme = window.Shopify?.theme?.name?.toLowerCase().includes('dawn');

        try {
            // Try proxy in parallel (non-blocking), but check old methods immediately
            // For Dawn theme, this is especially important
            const proxyPromise = fetchCustomerContextViaProxy().catch(() => null);
            
            if (isDawnTheme) {
                console.log('Bidly: Dawn theme detected - using enhanced customer detection');
            }

            for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                console.log(`Bidly: Detecting Shopify customer (attempt ${attempt}/${MAX_ATTEMPTS})...`);
                console.log('Bidly: window.Shopify:', window.Shopify);
                console.log('Bidly: window.Shopify?.customer:', window.Shopify?.customer);
                console.log('Bidly: window.customerData (Liquid injected):', window.customerData);
                
                // For Dawn theme, check proxy result earlier in the loop (after attempt 2)
                if (isDawnTheme && attempt >= 3) {
                    try {
                        const earlyProxyResult = await Promise.race([
                            proxyPromise,
                            new Promise(resolve => setTimeout(() => resolve(null), 200))
                        ]);
                        if (earlyProxyResult && earlyProxyResult.email) {
                            console.log('Bidly: Dawn theme - customer found via proxy (early in loop):', earlyProxyResult);
                            const synced = await persistCustomerToBackend(earlyProxyResult);
                            if (synced) {
                                return true;
                            }
                        }
                    } catch (e) {
                        // Continue with other checks
                    }
                }
                
                let customerData = null;
                
                // Check window.Shopify.customer (standard method)
                if (window.Shopify?.customer && window.Shopify.customer.id) {
                    customerData = {
                        id: window.Shopify.customer.id,
                        email: window.Shopify.customer.email,
                        firstName: window.Shopify.customer.first_name || null,
                        lastName: window.Shopify.customer.last_name || null
                    };
                    console.log('Bidly: Found customer via window.Shopify.customer:', customerData);
                }
                
                // Dawn theme: Also check if customer is logged in via cookies/session indicators
                if (!customerData) {
                    try {
                        // Check for customer session cookie
                        const cookies = document.cookie.split(';');
                        let hasCustomerSession = false;
                        for (const cookie of cookies) {
                            const [name] = cookie.trim().split('=');
                            if (name.includes('customer') || name.includes('_shopify_y') || name.includes('_shopify_s')) {
                                hasCustomerSession = true;
                                break;
                            }
                        }
                        
                        // If we have session indicators but no customer data, try app proxy
                        if (hasCustomerSession) {
                            console.log('Bidly: Customer session detected via cookies, will try app proxy...');
                        }
                    } catch (e) {
                        // Ignore cookie errors
                    }
                }
                
                // Also check window.Shopify.customerData early (Dawn theme and others use this)
                if (!customerData && window.Shopify?.customerData) {
                    try {
                        const customerJson = typeof window.Shopify.customerData === 'string' 
                            ? JSON.parse(window.Shopify.customerData) 
                            : window.Shopify.customerData;
                        
                        // Check if customerData has actual data (not all nulls)
                        if (customerJson && (customerJson.id || customerJson.email)) {
                            customerData = {
                                id: customerJson.id || customerJson.customer_id || null,
                                email: customerJson.email || null,
                                firstName: customerJson.first_name || customerJson.firstName || null,
                                lastName: customerJson.last_name || customerJson.lastName || null
                            };
                            console.log('Bidly: Found customer via window.Shopify.customerData (early check):', customerData);
                        }
                    } catch (e) {
                        // Ignore parse errors, will try again later
                    }
                }
                
                // Dawn theme specific: Check for customer in JSON-LD structured data
                if (!customerData) {
                    try {
                        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
                        for (const script of jsonLdScripts) {
                            try {
                                const data = JSON.parse(script.textContent);
                                // Check if it's a Person schema with customer info
                                if (data['@type'] === 'Person' && (data.identifier || data.email)) {
                                    customerData = {
                                        id: data.identifier || data.customerId || null,
                                        email: data.email || null,
                                        firstName: data.givenName || data.firstName || null,
                                        lastName: data.familyName || data.lastName || null
                                    };
                                    if (customerData.id || customerData.email) {
                                        console.log('Bidly: Found customer via JSON-LD:', customerData);
                                        break;
                                    }
                                }
                            } catch (e) {
                                // Continue to next script
                            }
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                }
                
                // Dawn theme: Check for customer data in data attributes
                if (!customerData) {
                    try {
                        const customerElement = document.querySelector('[data-customer-id], [data-customer-email], [data-customer]');
                        if (customerElement) {
                            const customerId = customerElement.getAttribute('data-customer-id') || 
                                             customerElement.getAttribute('data-customer');
                            const customerEmail = customerElement.getAttribute('data-customer-email');
                            
                            if (customerId || customerEmail) {
                                customerData = {
                                    id: customerId || null,
                                    email: customerEmail || null,
                                    firstName: customerElement.getAttribute('data-customer-first-name') || null,
                                    lastName: customerElement.getAttribute('data-customer-last-name') || null
                                };
                                console.log('Bidly: Found customer via data attributes:', customerData);
                            }
                        }
                    } catch (e) {
                        // Ignore errors
                    }
                }
                
                if (!customerData) {
                    const customerMeta = document.querySelector('meta[name="shopify-customer"]');
                    if (customerMeta) {
                        try {
                            const customerJson = JSON.parse(customerMeta.content);
                            customerData = {
                                id: customerJson.id,
                                email: customerJson.email,
                                firstName: customerJson.first_name || null,
                                lastName: customerJson.last_name || null
                            };
                            console.log('Bidly: Found customer via meta tag:', customerData);
                        } catch (e) {
                            console.warn('Bidly: Error parsing customer meta tag:', e);
                        }
                    }
                }
                
                if (!customerData) {
                    const customerScript = document.querySelector('script[data-customer]');
                    if (customerScript) {
                        try {
                            const customerJson = JSON.parse(customerScript.textContent);
                            customerData = {
                                id: customerJson.id,
                                email: customerJson.email,
                                firstName: customerJson.first_name || null,
                                lastName: customerJson.last_name || null
                            };
                            console.log('Bidly: Found customer via script tag:', customerData);
                        } catch (e) {
                            console.warn('Bidly: Error parsing customer script:', e);
                        }
                    }
                }
                
                if (!customerData && window.customer && window.customer.id) {
                    customerData = {
                        id: window.customer.id,
                        email: window.customer.email,
                        firstName: window.customer.first_name || null,
                        lastName: window.customer.last_name || null
                    };
                    console.log('Bidly: Found customer via window.customer:', customerData);
                }
                
                // Check window.customerData (injected by Liquid template) - prioritize this for Dawn
                if (!customerData && window.customerData) {
                    try {
                        const customerJson = typeof window.customerData === 'string' 
                            ? JSON.parse(window.customerData) 
                            : window.customerData;
                        
                        // Check if customerData has actual data (not all nulls) - important for Dawn theme
                        if (customerJson && (customerJson.id || customerJson.email)) {
                            customerData = {
                                id: customerJson.id || null,
                                email: customerJson.email || null,
                                firstName: customerJson.first_name || customerJson.firstName || null,
                                lastName: customerJson.last_name || customerJson.lastName || null
                            };
                            console.log('Bidly: Found customer via window.customerData (Liquid injected):', customerData);
                        } else {
                            console.log('Bidly: window.customerData exists but has no valid data:', customerJson);
                        }
                    } catch (e) {
                        console.log('Bidly: Failed to parse window.customerData:', e);
                    }
                }
                
                if (!customerData && window.Shopify?.customerData) {
                    try {
                        const customerJson = typeof window.Shopify.customerData === 'string' 
                            ? JSON.parse(window.Shopify.customerData) 
                            : window.Shopify.customerData;
                        
                        if (customerJson.id) {
                            customerData = {
                                id: customerJson.id,
                                email: customerJson.email,
                                firstName: customerJson.first_name || customerJson.firstName || null,
                                lastName: customerJson.last_name || customerJson.lastName || null
                            };
                            console.log('Bidly: Found customer via window.Shopify.customerData:', customerData);
                        }
                    } catch (e) {
                        console.log('Bidly: Failed to parse window.Shopify.customerData:', e);
                    }
                }
                
                if (!customerData) {
                    const storedCustomer = localStorage.getItem('shopify_customer') || sessionStorage.getItem('shopify_customer');
                    if (storedCustomer) {
                        try {
                            const customerJson = JSON.parse(storedCustomer);
                            customerData = {
                                id: customerJson.id,
                                email: customerJson.email,
                                firstName: customerJson.first_name || null,
                                lastName: customerJson.last_name || null
                            };
                            console.log('Bidly: Found customer via storage:', customerData);
                        } catch (e) {
                            console.warn('Bidly: Error parsing stored customer:', e);
                        }
                    }
                }
                
                if (customerData && customerData.email) {
                    try {
                        sessionStorage.removeItem('bidly_guest_customer');
                        console.log('Bidly: Cleared guest customer from sessionStorage (Shopify customer detected)');
                    } catch (storageError) {
                        console.warn('Bidly: Could not clear guest storage:', storageError);
                    }

                    const synced = await persistCustomerToBackend(customerData);
                    if (synced) {
                        return true;
                    }
                }
                
                if (attempt < MAX_ATTEMPTS) {
                    const delay = BASE_DELAY_MS * attempt;
                    console.log(`Bidly: No Shopify customer detected yet, retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
            
            // Final check: try proxy result if it's ready (more aggressive for Dawn theme)
            try {
                // For Dawn theme, wait a bit longer for proxy to resolve
                const isDawnTheme = window.Shopify?.theme?.name?.toLowerCase().includes('dawn');
                const proxyTimeout = isDawnTheme ? 500 : 100;
                
                const proxyResult = await Promise.race([
                    proxyPromise,
                    new Promise(resolve => setTimeout(() => resolve(null), proxyTimeout))
                ]);
                if (proxyResult && proxyResult.email) {
                    console.log('Bidly: Found customer via app proxy:', proxyResult);
                    const synced = await persistCustomerToBackend(proxyResult);
                    if (synced) {
                        return true;
                    }
                }
                
                // If proxy didn't resolve but we're in Dawn, try direct fetch
                if (isDawnTheme && !proxyResult) {
                    console.log('Bidly: Dawn theme - trying direct proxy fetch...');
                    const directProxyResult = await fetchCustomerContextViaProxy();
                    if (directProxyResult && directProxyResult.email) {
                        console.log('Bidly: Found customer via direct proxy fetch:', directProxyResult);
                        const synced = await persistCustomerToBackend(directProxyResult);
                        if (synced) {
                            return true;
                        }
                    }
                }
            } catch (e) {
                console.warn('Bidly: Proxy check failed:', e);
            }
            
            console.warn('Bidly: Shopify customer not detected after retries');
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
            const fullName = `${firstName} ${lastName}`;
            
            // Create guest customer object (NOT saved to database)
            const guestCustomer = {
                id: 'guest_' + Date.now(), // Temporary ID
                email: email,
                firstName: firstName,
                lastName: lastName,
                fullName: fullName,
                displayName: fullName, // Use fullName as displayName for guests
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
        const t = window.BidlyTranslate || ((key, params) => {
            // Fallback if translation not available
            const fallbacks = {
                'widget.guestLogin.title': 'Continue as Guest',
                'widget.guestLogin.fullName': 'Full Name',
                'widget.guestLogin.emailAddress': 'Email Address',
                'widget.guestLogin.continue': 'Continue as Guest',
                'widget.guestLogin.cancel': 'Cancel'
            };
            return fallbacks[key] || key;
        });
        
        modal.innerHTML = `
            <div class="bidly-modal-content">
                <div class="bidly-modal-header">
                    <h3>${t('widget.guestLogin.title')}</h3>
                    <button class="bidly-modal-close" onclick="window.BidlyHybridLogin.closeGuestLoginModal()">&times;</button>
                </div>
                <div class="bidly-modal-body">
                    <form id="bidly-guest-login-form" onsubmit="window.BidlyHybridLogin.submitGuestLogin(event)">
                        <div class="bidly-form-group">
                            <label for="bidly-guest-name">${t('widget.guestLogin.fullName')}</label>
                            <input type="text" id="bidly-guest-name" name="name" autocomplete="name" required>
                        </div>
                        <div class="bidly-form-group">
                            <label for="bidly-guest-email">${t('widget.guestLogin.emailAddress')}</label>
                            <input type="email" id="bidly-guest-email" name="email" autocomplete="email" required>
                        </div>
                        <div class="bidly-form-actions">
                            <button type="submit" class="bidly-btn bidly-btn-primary">${t('widget.guestLogin.continue')}</button>
                            <button type="button" class="bidly-btn bidly-btn-secondary" onclick="window.BidlyHybridLogin.closeGuestLoginModal()">${t('widget.guestLogin.cancel')}</button>
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
        
        const t = window.BidlyTranslate || ((key, params) => {
            const fallbacks = {
                'widget.guestLogin.errorForm': 'Form error. Please try again.',
                'widget.guestLogin.errorNameEmail': 'Please enter both name and email',
                'widget.guestLogin.errorFailed': 'Login failed. Please try again.'
            };
            return fallbacks[key] || key;
        });
        
        if (!nameInput || !emailInput) {
            console.error('Bidly: Form inputs not found');
            alert(t('widget.guestLogin.errorForm'));
            return;
        }
        
        const name = nameInput.value.trim();
        const email = emailInput.value.trim();

        console.log('Bidly: Form data:', { name, email });

        if (!name || !email) {
            alert(t('widget.guestLogin.errorNameEmail'));
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
            alert(t('widget.guestLogin.errorFailed'));
        }
    }

    // Logout function
    function logout() {
        console.log('Bidly: Logging out...', { currentCustomer });
        
        // Clear guest data from sessionStorage
        try {
            sessionStorage.removeItem('bidly_guest_customer');
            console.log('Bidly: Cleared guest customer from sessionStorage');
        } catch (storageError) {
            console.warn('Bidly: Could not clear guest storage:', storageError);
        }
        
        currentCustomer = null;
        isLoggedIn = false;
        
        // Trigger custom event for components to listen to
        window.dispatchEvent(new CustomEvent('bidly-logout', { 
            detail: { customer: null } 
        }));
        
        // Don't reload automatically - let the widget handle it
        console.log('Bidly: Logout complete, event dispatched');
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
