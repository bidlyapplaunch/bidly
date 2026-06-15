// Single shared "now" source for all countdown timers.
//
// Previously every CountdownTimer instance ran its own 1s setInterval. With many
// auction cards (each card + its detail/bid modals embed a timer) that is 100+
// intervals all calling setState every second -> mobile jank.
//
// This module-level singleton runs ONE setInterval (only while there is at least
// one subscriber) and notifies all subscribers with the current timestamp.

const subscribers = new Set();
let intervalId = null;
let currentNow = Date.now();

const tick = () => {
  currentNow = Date.now();
  // Copy to an array so a subscriber unsubscribing during notify is safe.
  for (const subscriber of Array.from(subscribers)) {
    subscriber(currentNow);
  }
};

const start = () => {
  if (intervalId !== null) return;
  currentNow = Date.now();
  intervalId = setInterval(tick, 1000);
};

const stop = () => {
  if (intervalId === null) return;
  clearInterval(intervalId);
  intervalId = null;
};

/**
 * Get the most recent shared timestamp (ms). Refreshed when a new subscriber
 * joins so the first render is current.
 * @returns {number}
 */
export function getNow() {
  return currentNow;
}

/**
 * Subscribe to the shared 1s tick. The callback receives the current timestamp
 * (ms). Returns an unsubscribe function. The underlying interval only runs while
 * there is at least one subscriber.
 * @param {(now: number) => void} callback
 * @returns {() => void}
 */
export function subscribe(callback) {
  subscribers.add(callback);
  // Refresh "now" so a late subscriber doesn't read a stale value, then start
  // the shared interval if it isn't already running.
  currentNow = Date.now();
  start();

  return () => {
    subscribers.delete(callback);
    if (subscribers.size === 0) {
      stop();
    }
  };
}
