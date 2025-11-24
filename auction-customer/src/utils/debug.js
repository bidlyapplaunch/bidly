const STORAGE_KEY = 'bidly_debug';

const DEV_ENABLED =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.DEV === true;

function readPersistedFlag() {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function setDebugEnabled(enabled, { persist = true } = {}) {
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
    // Ignore storage errors.
  }
}

export function isDebugEnabled() {
  if (typeof window !== 'undefined') {
    if (window.__BIDLY_DEBUG__ === true) {
      return true;
    }
    if (window.__BIDLY_DEBUG__ === false) {
      return false;
    }
  }

  if (DEV_ENABLED) {
    return true;
  }

  return readPersistedFlag();
}

export function installDebugConsole(scope = 'Customer') {
  if (typeof window === 'undefined' || typeof window.console === 'undefined') {
    return;
  }

  const { console } = window;
  if (console.__BIDLY_PATCHED__) {
    return;
  }

  const originalLog =
    typeof console.log === 'function' ? console.log.bind(console) : () => {};

  console.log = (...args) => {
    if (isDebugEnabled()) {
      originalLog(`[Bidly:${scope}]`, ...args);
    }
  };

  console.__BIDLY_PATCHED__ = true;

  window.BidlyDebug = window.BidlyDebug || {};
  window.BidlyDebug[scope.toLowerCase()] = {
    enable(persist = true) {
      setDebugEnabled(true, { persist });
    },
    disable() {
      setDebugEnabled(false);
    },
    isEnabled: isDebugEnabled
  };
}

