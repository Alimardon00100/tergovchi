import { useEffect } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ShieldCheck } from 'lucide-react';
import { useUi } from '../../app/store';

export function RankCelebration() {
  const active = useUi((state) => state.celebrating);
  const celebrate = useUi((state) => state.celebrate);
  const reduced = useReducedMotion();
  const forced = useUi((state) => state.reducedMotion);
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => celebrate(false), 3500);
    return () => window.clearTimeout(timer);
  }, [active, celebrate]);
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          className="rank-celebration"
          initial={reduced || forced ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduced || forced ? 0 : 0.2 }}
          role="status"
        >
          <div className="celebration-message">
            <ShieldCheck size={40} />
            <h2>Yangi unvon muborak!</h2>
            <p>Mehnatingiz va kuzatuvchanligingiz e’tirof etildi.</p>
          </div>
          {!reduced &&
            !forced &&
            Array.from({ length: 32 }, (_, i) => (
              <i
                key={i}
                className="confetti"
                style={{
                  left: `${(i * 137.5) % 100}%`,
                  animationDelay: `${(i % 7) * 0.13}s`,
                  background: i % 2 ? '#c9a86a' : '#eee8d6',
                  rotate: `${i * 43}deg`,
                }}
              />
            ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
