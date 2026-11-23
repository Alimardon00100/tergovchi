import { useSyncExternalStore } from 'react';
const small = () => window.matchMedia('(max-width: 650px)').matches;
const subscribe = (callback: () => void) => {
  const media = window.matchMedia('(max-width: 650px)');
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
export const useSmallScene = () => useSyncExternalStore(subscribe, small, () => false);
export function SceneHeading({
  title,
  eyebrow,
  description,
}: {
  title: string;
  eyebrow: string;
  description: string;
}) {
  return (
    <div className="scene-title paper">
      <span className="tape" />
      <span className="eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}
export function PaperPager({
  page,
  total,
  change,
}: {
  page: number;
  total: number;
  change: (page: number) => void;
}) {
  if (total < 2) return null;
  return (
    <div className="paper-pager paper" aria-label="Papka sahifalari">
      <button disabled={page === 0} onClick={() => change(page - 1)}>
        Oldingi
      </button>
      <span>
        {page + 1} / {total}
      </span>
      <button disabled={page + 1 >= total} onClick={() => change(page + 1)}>
        Keyingi
      </button>
    </div>
  );
}
