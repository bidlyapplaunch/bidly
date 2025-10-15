import React, { useEffect } from 'react';

/**
 * App Bridge Toast Component
 * Replaces regular toast notifications with App Bridge toasts
 * These toasts appear in the Shopify admin interface
 */
const AppBridgeToast = ({ message, isError = false, duration = 5000 }) => {
  useEffect(() => {
    if (!message) return;

    // Simplified toast - just log to console for now
    console.log(`🍞 Toast: ${message}`, { isError, duration });
    
    // In a real implementation, you would show a toast notification
    // For now, we'll just log it
  }, [message, isError, duration]);

  // This component doesn't render anything visible
  return null;
};

export default AppBridgeToast;
