import React, { useState, useEffect } from 'react';
import { Text, Badge } from '@shopify/polaris';

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
        <Badge status="success">
          <Text variant="bodyMd" fontWeight="bold">Auction Started</Text>
        </Badge>
      );
    } else {
      return (
        <Badge status="critical">
          <Text variant="bodyMd" fontWeight="bold">Auction Ended</Text>
        </Badge>
      );
    }
  }

  const formatTime = (value) => value.toString().padStart(2, '0');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      <Badge status={status === 'pending' ? 'warning' : 'info'}>
        <Text variant="bodyMd" fontWeight="bold">
          {timeLeft.days > 0 && `${timeLeft.days}d `}
          {formatTime(timeLeft.hours)}:{formatTime(timeLeft.minutes)}:{formatTime(timeLeft.seconds)}
        </Text>
      </Badge>
      <Text variant="bodySm" color="subdued">
        {status === 'pending' ? 
          (timeLeft.days > 0 ? 'until start' : 'until start') : 
          (timeLeft.days > 0 ? 'remaining' : 'left')
        }
      </Text>
    </div>
  );
};

export default CountdownTimer;
