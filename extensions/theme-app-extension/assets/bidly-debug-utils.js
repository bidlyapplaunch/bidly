(function () {
    'use strict';

    const STORAGE_KEY = 'bidly_debug';

    function isDebugEnabled() {
        if (typeof window === 'undefined') {
            return false;
        }
        if (window.__BIDLY_DEBUG__ === true) {
            return true;
        }
        if (window.__BIDLY_DEBUG__ === false) {
            return false;
        }
        try {
            return window.localStorage?.getItem(STORAGE_KEY) === 'true';
        } catch {
            return false;
        }
    }

    function setDebugEnabled(enabled, { persist = true } = {}) {
        if (typeof window === 'undefined') {
            return;
        }

        window.__BIDLY_DEBUG__ = enabled;

        if (!persist) {
            return;
        }

        try {
            if (enabled) {
                window.localStorage?.setItem(STORAGE_KEY, 'true');
            } else {
                window.localStorage?.removeItem(STORAGE_KEY);
            }
        } catch {
            // Ignore storage restrictions (incognito, etc.)
        }
    }

    function createScopedConsole(scope = 'Widget') {
        const baseConsole = window.console || {};
        const prefix = `[Bidly:${scope}]`;

        const safeLog = baseConsole.log ? baseConsole.log.bind(baseConsole) : () => {};
        const safeWarn = baseConsole.warn ? baseConsole.warn.bind(baseConsole) : () => {};
        const safeError = baseConsole.error ? baseConsole.error.bind(baseConsole) : () => {};

        return {
            log: (...args) => {
                if (isDebugEnabled()) {
                    safeLog(prefix, ...args);
                }
            },
            warn: (...args) => {
                if (isDebugEnabled()) {
                    safeWarn(prefix, ...args);
                }
            },
            error: (...args) => {
                safeError(prefix, ...args);
            }
        };
    }

    window.BidlyDebugUtils = window.BidlyDebugUtils || {
        isEnabled: isDebugEnabled,
        setEnabled: setDebugEnabled,
        createConsole: createScopedConsole
    };

    window.BidlyDebug = window.BidlyDebug || {};
    window.BidlyDebug.widget = window.BidlyDebug.widget || {
        enable(persist = true) {
            setDebugEnabled(true, { persist });
        },
        disable() {
            setDebugEnabled(false);
        },
        isEnabled: isDebugEnabled
    };
})();

