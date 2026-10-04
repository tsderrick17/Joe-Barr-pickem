import { useCallback, useEffect, useRef } from "react";

/**
 * A callback whose identity never changes but which always runs the latest
 * version of `callback`. Passing it to a memoized child keeps that child from
 * redrawing every time the parent's state changes.
 */
export function useStableCallback<Args extends unknown[], Result>(callback: (...args: Args) => Result) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  return useCallback((...args: Args) => latest.current(...args), []);
}
