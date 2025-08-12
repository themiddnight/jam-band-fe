/**
 * Performance optimization utilities for keyboard components
 */
import { useCallback, useRef } from "react";

/**
 * Debounce utility for expensive operations
 */
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number,
): ((...args: Parameters<T>) => void) => {
  let timeout: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

/**
 * Throttle utility for frequent operations
 */
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number,
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
};

/**
 * Hook for optimized Set operations
 */
export const useOptimizedSet = <T>() => {
  const setRef = useRef<Set<T>>(new Set());

  const add = useCallback((item: T) => {
    if (!setRef.current.has(item)) {
      setRef.current = new Set(setRef.current).add(item);
      return true;
    }
    return false;
  }, []);

  const remove = useCallback((item: T) => {
    if (setRef.current.has(item)) {
      const newSet = new Set(setRef.current);
      newSet.delete(item);
      setRef.current = newSet;
      return true;
    }
    return false;
  }, []);

  const has = useCallback((item: T) => setRef.current.has(item), []);

  const clear = useCallback(() => {
    setRef.current = new Set();
  }, []);

  return {
    set: setRef.current,
    add,
    remove,
    has,
    clear,
    size: setRef.current.size,
  };
};

/**
 * Hook for optimized Map operations
 */
export const useOptimizedMap = <K, V>() => {
  const mapRef = useRef<Map<K, V>>(new Map());

  const set = useCallback((key: K, value: V) => {
    const existing = mapRef.current.get(key);
    if (existing !== value) {
      mapRef.current = new Map(mapRef.current).set(key, value);
      return true;
    }
    return false;
  }, []);

  const remove = useCallback((key: K) => {
    if (mapRef.current.has(key)) {
      const newMap = new Map(mapRef.current);
      newMap.delete(key);
      mapRef.current = newMap;
      return true;
    }
    return false;
  }, []);

  const get = useCallback((key: K) => mapRef.current.get(key), []);

  const has = useCallback((key: K) => mapRef.current.has(key), []);

  const clear = useCallback(() => {
    mapRef.current = new Map();
  }, []);

  return {
    map: mapRef.current,
    set,
    remove,
    get,
    has,
    clear,
    size: mapRef.current.size,
  };
};

/**
 * Memoization utility for expensive calculations
 */
export const memoize = <T extends (...args: any[]) => any>(fn: T): T => {
  const cache = new Map();

  return ((...args: Parameters<T>) => {
    const key = JSON.stringify(args);
    if (cache.has(key)) {
      return cache.get(key);
    }

    const result = fn(...args);
    cache.set(key, result);
    return result;
  }) as T;
};

/**
 * Batch state updates to reduce re-renders
 */
export const useBatchedUpdates = () => {
  const batchRef = useRef<(() => void)[]>([]);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const addUpdate = useCallback((update: () => void) => {
    batchRef.current.push(update);

    if (timeoutRef.current !== undefined) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      const updates = batchRef.current;
      batchRef.current = [];
      updates.forEach((update) => update());
    }, 0);
  }, []);

  return addUpdate;
};

/**
 * Performance monitoring utility
 */
export const measurePerformance = (name: string, fn: () => void) => {
  const start = performance.now();
  fn();
  const end = performance.now();
  console.log(`${name} took ${(end - start).toFixed(2)}ms`);
};

/**
 * Hook for stable event handlers
 */
export const useStableCallback = <T extends (...args: any[]) => any>(
  callback: T,
): T => {
  const callbackRef = useRef<T>(callback);
  callbackRef.current = callback;

  return useCallback((...args: Parameters<T>) => {
    return callbackRef.current(...args);
  }, []) as T;
};

/**
 * Array comparison utility for memoization
 */
export const arrayEquals = <T>(a: T[], b: T[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every((val, index) => val === b[index]);
};

/**
 * Object comparison utility for memoization
 */
export const shallowEquals = <T extends Record<string, any>>(
  a: T,
  b: T,
): boolean => {
  const keysA = Object.keys(a);
  const keysB = Object.keys(b);

  if (keysA.length !== keysB.length) return false;

  return keysA.every((key) => a[key] === b[key]);
};