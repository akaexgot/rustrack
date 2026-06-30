import { useEffect } from 'react';

export default function HomePointerGlow() {
  useEffect(() => {
    const root = document.documentElement;

    function updatePointer(event: PointerEvent) {
      root.style.setProperty('--home-pointer-x', `${event.clientX}px`);
      root.style.setProperty('--home-pointer-y', `${event.clientY}px`);
    }

    window.addEventListener('pointermove', updatePointer, { passive: true });
    return () => window.removeEventListener('pointermove', updatePointer);
  }, []);

  return null;
}
