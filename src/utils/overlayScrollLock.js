const HTML_CLASS = 'tp-overlay-open';

/**
 * Lock document scroll (html + body). Call unlock with returned function on cleanup.
 * Prevents double scrollbars behind iOS-style sheets/modals.
 */
export function lockOverlayScroll() {
  const html = document.documentElement;
  const body = document.body;
  const prevHtmlOverflow = html.style.overflow;
  const prevBodyOverflow = body.style.overflow;
  const prevBodyPosition = body.style.position;
  const prevBodyTop = body.style.top;
  const prevBodyWidth = body.style.width;
  const scrollY = window.scrollY;

  html.classList.add(HTML_CLASS);
  html.style.overflow = 'hidden';
  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${scrollY}px`;
  body.style.width = '100%';

  return () => {
    html.classList.remove(HTML_CLASS);
    html.style.overflow = prevHtmlOverflow;
    body.style.overflow = prevBodyOverflow;
    body.style.position = prevBodyPosition;
    body.style.top = prevBodyTop;
    body.style.width = prevBodyWidth;
    window.scrollTo(0, scrollY);
  };
}
