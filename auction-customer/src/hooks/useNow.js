import { useEffect, useState } from 'react';
import { getNow, subscribe } from '../services/timeTicker';

/**
 * Subscribe a component to the single shared 1s ticker and re-render once per
 * second with the current timestamp (ms). Replaces per-component setInterval.
 * @returns {number} current timestamp in milliseconds
 */
export function useNow() {
  const [now, setNow] = useState(getNow);

  useEffect(() => {
    // Seed with the freshest value in case time passed before this effect ran.
    setNow(getNow());
    const unsubscribe = subscribe(setNow);
    return unsubscribe;
  }, []);

  return now;
}

export default useNow;
