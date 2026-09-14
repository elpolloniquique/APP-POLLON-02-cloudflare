import { useState, useEffect } from 'react';

/** Laptops ~11" (1366px) y móvil: panel admin en modo compacto */
export const COMPACT_ADMIN_MQ = '(max-width: 1366px)';
export const MOBILE_ADMIN_MQ = '(max-width: 767px)';

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia(query).matches,
  );

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    onChange();
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}

export function useCompactAdmin() {
  const isCompact = useMediaQuery(COMPACT_ADMIN_MQ);
  const isMobile = useMediaQuery(MOBILE_ADMIN_MQ);
  return { isCompact, isMobile, useDrawerSidebar: isCompact };
}
