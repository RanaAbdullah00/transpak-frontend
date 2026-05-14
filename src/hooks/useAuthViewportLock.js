import { useEffect } from 'react';

const HTML_CLS = 'tp-auth-viewport-lock-root';
const BODY_CLS = 'tp-auth-viewport-lock';

/**
 * Locks document scroll while auth screens mount (one viewport; no page scroll).
 */
export function useAuthViewportLock() {
  useEffect(() => {
    document.documentElement.classList.add(HTML_CLS);
    document.body.classList.add(BODY_CLS);
    return () => {
      document.documentElement.classList.remove(HTML_CLS);
      document.body.classList.remove(BODY_CLS);
    };
  }, []);
}
