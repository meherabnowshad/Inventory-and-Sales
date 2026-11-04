import { useState, useEffect } from 'react';
import { fetchHealth, HealthResponse } from '../services/api';

let cachedHealth: HealthResponse | null = null;
let activePromise: Promise<HealthResponse> | null = null;
const listeners = new Set<
  (health: HealthResponse | null, loading: boolean, err: string | null) => void
>();

export function resetHealthCache(): void {
  cachedHealth = null;
  activePromise = null;
  listeners.clear();
}

export function useHealthStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(cachedHealth);
  const [loading, setLoading] = useState<boolean>(!cachedHealth);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const listener = (
      newHealth: HealthResponse | null,
      newLoading: boolean,
      newErr: string | null,
    ) => {
      if (isMounted) {
        setHealth(newHealth);
        setLoading(newLoading);
        setError(newErr);
      }
    };

    listeners.add(listener);

    // If no cache and no active request, initiate one shared request
    if (!cachedHealth && !activePromise) {
      activePromise = fetchHealth()
        .then((data) => {
          cachedHealth = data;
          activePromise = null;
          listeners.forEach((l) => l(data, false, null));
          return data;
        })
        .catch((err: unknown) => {
          activePromise = null;
          const msg = err instanceof Error ? err.message : 'Connection failed';
          listeners.forEach((l) => l(null, false, msg));
          throw err;
        });
    }

    return () => {
      isMounted = false;
      listeners.delete(listener);
    };
  }, []);

  return { health, loading, error };
}
