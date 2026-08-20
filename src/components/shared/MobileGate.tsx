import { useState, useEffect } from 'react';
import { MobileViewer } from '../mobile/MobileViewer';

const MOBILE_BREAKPOINT = 768;

export function MobileGate({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  if (isMobile) {
    return <MobileViewer />;
  }

  return <>{children}</>;
}
