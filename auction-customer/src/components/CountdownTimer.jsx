import React, { useState, useEffect } from 'react';
import { Text, Badge } from '@shopify/polaris';
import { t } from '../i18n';

const CountdownTimer = ({ endTime, startTime, status, onTimeUp }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });
  const [isExpired, setIsExpired] = useState(false);

  useEffect(() => {
    const calculateTimeLeft = () => {
      const now = new Date().getTime();
      
      // For pending auctions, count down to start time
      // For active auctions, count down to end time
      const targetTime = status === 'pending' ? new Date(startTime).getTime() : new Date(endTime).getTime();
      const difference = targetTime - now;

      if (difference > 0) {
        const days = Math.floor(difference / (1000 * 60 * 60 * 24));
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        setTimeLeft({ days, hours, minutes, seconds });
        setIsExpired(false);
      } else {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0 });
        setIsExpired(true);
        if (onTimeUp) onTimeUp();
      }
    };

    // Calculate immediately
    calculateTimeLeft();

    // Update every second
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, [endTime, startTime, status, onTimeUp]);

  if (isExpired) {
    if (status === 'pending') {
      return (
        <div
          style={{
            backgroundColor: 'var(--bidly-marketplace-color-success, #00c851)',
            color: '#ffffff',
            padding: '4px 8px',
            borderRadius: 'var(--bidly-marketplace-border-radius, 4px)',
            fontFamily: 'var(--bidly-marketplace-font-family, Inter, sans-serif)',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {t('marketplace.countdown.auctionStarted')}
        </div>
      );
    } else {
      return (
        <div
          style={{
            backgroundColor: 'var(--bidly-marketplace-color-error, #ff4444)',
            color: '#ffffff',
            padding: '4px 8px',
            borderRadius: 'var(--bidly-marketplace-border-radius, 4px)',
            fontFamily: 'var(--bidly-marketplace-font-family, Inter, sans-serif)',
            fontSize: '14px',
            fontWeight: 'bold'
          }}
        >
          {t('marketplace.countdown.auctionEnded')}
        </div>
      );
    }
  }

  const formatTime = (value) => value.toString().padStart(2, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <div
        style={{
          backgroundColor: 'var(--bidly-marketplace-color-accent, #00b894)',
          color: '#ffffff',
          padding: '4px 8px',
          borderRadius: 'var(--bidly-marketplace-border-radius, 4px)',
          fontFamily: 'var(--bidly-marketplace-font-family, Inter, sans-serif)',
          fontSize: '14px',
          fontWeight: 'bold'
        }}
      >
        {timeLeft.days > 0 && `${timeLeft.days}d `}
        {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
      </div>
      <Text variant="bodySm" style={{ color: 'var(--bidly-marketplace-color-text-secondary, #666666)' }}>
        {status === 'pending' ? 
          t('marketplace.countdown.untilStart') : 
          (timeLeft.days > 0 ? t('marketplace.countdown.remaining') : t('marketplace.countdown.left'))
        }
      </Text>
    </div>
  );
};

export default CountdownTimer;
