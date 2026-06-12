import React, { useEffect, useRef, useState } from 'react';
import { Banner } from '@shopify/polaris';

/**
 * App Bridge Toast Component
 * Shows a visible toast notification on the page
 */
const AppBridgeToast = ({ message, isError = false, duration = 5000, onDismiss }) => {
  const [visible, setVisible] = useState(true);

  // Keep the latest onDismiss in a ref so the auto-dismiss timer isn't reset by
  // unrelated re-renders that pass a new inline callback.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    if (!message) {
      setVisible(false);
      return;
    }

    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      if (onDismissRef.current) {
        onDismissRef.current();
      }
    }, duration);

    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!visible || !message) {
    return null;
  }

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      zIndex: 10000,
      maxWidth: '400px',
      animation: 'slideIn 0.3s ease-out'
    }}>
      <Banner
        tone={isError ? 'critical' : 'info'}
        onDismiss={() => {
          setVisible(false);
          if (onDismissRef.current) {
            onDismissRef.current();
          }
        }}
      >
        <p>{message}</p>
      </Banner>
      <style>{`
        @keyframes slideIn {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
};

export default AppBridgeToast;
