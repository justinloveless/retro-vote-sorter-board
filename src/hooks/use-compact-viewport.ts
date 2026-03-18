import * as React from "react";

const COMPACT_VIEWPORT_HEIGHT = 850;

export function useIsCompactViewport() {
  const [isCompact, setIsCompact] = React.useState<boolean>(() =>
    typeof window !== "undefined" ? window.innerHeight < COMPACT_VIEWPORT_HEIGHT : false
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-height: ${COMPACT_VIEWPORT_HEIGHT - 1}px)`);
    const onChange = () => setIsCompact(window.innerHeight < COMPACT_VIEWPORT_HEIGHT);
    mql.addEventListener("change", onChange);
    setIsCompact(window.innerHeight < COMPACT_VIEWPORT_HEIGHT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return isCompact;
}
