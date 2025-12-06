import { useCallback, useLayoutEffect, useRef } from 'react';

/**
 * A hook to define an event handler with a stable identity.
 * The handler always has access to the latest props/state but doesn't trigger updates.
 * Similar to the proposed useEffectEvent.
 */
export function useEvent<T extends (...args: any[]) => any>(fn: T): T {
  const handlerRef = useRef(fn);

  useLayoutEffect(() => {
    handlerRef.current = fn;
  });

  return useCallback((...args: Parameters<T>) => {
    const fn = handlerRef.current;
    return fn(...args);
  }, []) as T;
}
