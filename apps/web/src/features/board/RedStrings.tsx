import { useEffect, useState } from 'react';
import type { RefObject } from 'react';
import { motion } from 'framer-motion';
import { useQuietMotion } from '../../shared/lib/motion';
const edges = [
  ['profile', 'investigation'],
  ['investigation', 'control'],
  ['control', 'defense'],
  ['defense', 'judgment'],
  ['judgment', 'statistics'],
  ['statistics', 'profile'],
  ['investigation', 'statistics'],
  ['control', 'judgment'],
];
export function RedStrings({ stage }: { stage: RefObject<HTMLDivElement> }) {
  const [paths, setPaths] = useState<string[]>([]);
  const quiet = useQuietMotion();
  useEffect(() => {
    const root = stage.current;
    if (!root) return;
    let active = true;
    let frame = 0;
    let until = 0;
    const measure = () => {
      if (!active) return;
      const rect = root.getBoundingClientRect();
      const pins = new Map(
        Array.from(root.querySelectorAll<HTMLElement>('[data-thread-pin]')).map((pin) => {
          const p = pin.getBoundingClientRect();
          return [
            pin.dataset['threadPin'],
            { x: p.x + p.width / 2 - rect.x, y: p.y + p.height / 2 - rect.y },
          ];
        }),
      );
      const next = edges.flatMap(([from, to]) => {
        const a = pins.get(from);
        const b = pins.get(to);
        return a && b
          ? [`M${a.x} ${a.y} Q${(a.x + b.x) / 2} ${(a.y + b.y) / 2 + 16} ${b.x} ${b.y}`]
          : [];
      });
      setPaths((current) => (current.join('|') === next.join('|') ? current : next));
    };
    const tick = (time: number) => {
      measure();
      frame = time < until ? requestAnimationFrame(tick) : 0;
    };
    const follow = () => {
      until = performance.now() + 400;
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const observer = new ResizeObserver(measure);
    observer.observe(root);
    root.querySelectorAll('.pinned-object').forEach((object) => observer.observe(object));
    root.addEventListener('pointerover', follow);
    root.addEventListener('pointerout', follow);
    measure();
    void document.fonts.ready.then(measure);
    return () => {
      active = false;
      observer.disconnect();
      cancelAnimationFrame(frame);
      root.removeEventListener('pointerover', follow);
      root.removeEventListener('pointerout', follow);
    };
  }, [stage]);
  return (
    <svg className="red-strings" aria-hidden="true">
      <defs>
        <filter id="thread-shadow">
          <feDropShadow dx="1" dy="2" stdDeviation="1" floodOpacity="0.75" />
        </filter>
      </defs>
      {paths.map((d, index) => (
        <motion.path
          key={index}
          d={d}
          pathLength={1}
          strokeDasharray="1"
          initial={quiet ? false : { strokeDashoffset: 1 }}
          animate={{ strokeDashoffset: 0 }}
          transition={{ duration: quiet ? 0 : 1.3, delay: quiet ? 0 : index * 0.09 }}
        />
      ))}
    </svg>
  );
}
