import { useLayoutEffect } from 'react';

export function useTemporaryDesktopViewport(desktopWidth = 1100) {
  useLayoutEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;

    const originalContent = meta.getAttribute('content');
    meta.setAttribute('content', `width=${desktopWidth}`);
    document.body.classList.add('desktop-viewport-active');

    return () => {
      if (originalContent) {
        meta.setAttribute('content', originalContent);
      }
      document.body.classList.remove('desktop-viewport-active');
    };
  }, [desktopWidth]);
}