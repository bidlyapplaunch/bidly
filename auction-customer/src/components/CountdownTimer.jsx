import React, { useEffect, useRef } from 'react';
import { Text } from '@shopify/polaris';
import { t } from '../i18n';
import { useNow } from '../hooks/useNow';
import './CountdownTimer.css';

const CountdownTimer = ({ endTime, startTime, status, onTimeUp }) => {
  // Consume the single shared ticker instead of owning a per-instance setInterval.
  const now = useNow();

  const onTimeUpRef = useRef(onTimeUp);
  onTimeUpRef.current = onTimeUp;

  // Guard so onTimeUp fires exactly once when the timer crosses zero, even
  // though we now recompute remaining time from shared `now` on every tick.
  const firedTimeUpRef = useRef(false);

  // For pending auctions, count down to start time; for active, to end time.
  const targetTime = status === 'pending'
    ? new Date(startTime).getTime()
    : new Date(endTime).getTime();
  const difference = targetTime - now;
  const isExpired = !(difference > 0);

  // Reset the one-shot guard if the target changes (e.g. popcorn extension
  // pushes endTime into the future, or status flips pending -> active).
  useEffect(() => {
    firedTimeUpRef.current = false;
  }, [endTime, startTime, status]);

  // Fire onTimeUp exactly once when we cross zero.
  useEffect(() => {
    if (isExpired && !firedTimeUpRef.current) {
      firedTimeUpRef.current = true;
      if (onTimeUpRef.current) onTimeUpRef.current();
    }
  }, [isExpired]);

  if (isExpired) {
    if (status === 'pending') {
      return (
        <div className="bidly-countdown bidly-countdown--started">
          {t('marketplace.countdown.auctionStarted')}
        </div>
      );
    }
    return (
      <div className="bidly-countdown bidly-countdown--ended">
        {t('marketplace.countdown.auctionEnded')}
      </div>
    );
  }

  const days = Math.floor(difference / (1000 * 60 * 60 * 24));
  const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((difference % (1000 * 60)) / 1000);

  const formatTime = (value) => value.toString().padStart(2, '0');

  return (
    <div className="bidly-countdown-wrap">
      <div className="bidly-countdown bidly-countdown--active">
        {days > 0 && `${days}d `}
        {formatTime(hours)}:{formatTime(minutes)}:{formatTime(seconds)}
      </div>
      <Text variant="bodySm" style={{ color: 'var(--bidly-marketplace-color-text-secondary, #666666)' }}>
        {status === 'pending' ?
          t('marketplace.countdown.untilStart') :
          (days > 0 ? t('marketplace.countdown.remaining') : t('marketplace.countdown.left'))
        }
      </Text>
    </div>
  );
};

export default CountdownTimer;
