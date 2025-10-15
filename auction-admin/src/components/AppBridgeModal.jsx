import React, { useEffect } from 'react';
import { Modal } from '@shopify/app-bridge/actions';
import { useAppBridge } from '@shopify/app-bridge-react';

/**
 * App Bridge Modal Component
 * Replaces regular modals with App Bridge modals
 * These modals appear in the Shopify admin interface
 */
const AppBridgeModal = ({ 
  isOpen, 
  title, 
  message, 
  primaryAction, 
  secondaryAction, 
  onClose 
}) => {
  const app = useAppBridge();

  useEffect(() => {
    if (!isOpen || !app) return;

    const modal = Modal.create(app, {
      title,
      message,
      primaryAction: primaryAction ? {
        content: primaryAction.content,
        onAction: primaryAction.onAction
      } : undefined,
      secondaryActions: secondaryAction ? [{
        content: secondaryAction.content,
        onAction: secondaryAction.onAction
      }] : undefined
    });

    modal.dispatch(Modal.Action.OPEN);

    // Handle modal close
    const handleClose = () => {
      modal.dispatch(Modal.Action.CLOSE);
      if (onClose) onClose();
    };

    // Listen for modal close events
    modal.subscribe(Modal.Action.CLOSE, handleClose);

    // Cleanup function
    return () => {
      modal.dispatch(Modal.Action.CLOSE);
    };
  }, [isOpen, title, message, primaryAction, secondaryAction, onClose, app]);

  // This component doesn't render anything visible
  // The modal is handled by App Bridge
  return null;
};

export default AppBridgeModal;
