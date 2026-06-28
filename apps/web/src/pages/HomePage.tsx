import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Hero } from '../components/Hero';
import { Convert } from '../components/Convert';
import { HowItWorks } from '../components/HowItWorks';

interface HomeState {
  scrollTo?: string;
}

export function HomePage() {
  const location = useLocation();

  useEffect(() => {
    const state = location.state as HomeState | null;
    if (state?.scrollTo) {
      requestAnimationFrame(() => {
        const el = document.getElementById(state.scrollTo!);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
      return;
    }
    // Plain navigation home — pin to top.
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [location.key, location.state]);

  return (
    <>
      <Hero />
      <Convert />
      <HowItWorks />
    </>
  );
}
