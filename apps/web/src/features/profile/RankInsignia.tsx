import type { RankName } from '@detective/shared';
export function RankInsignia({
  rank,
  title,
  className = '',
}: {
  rank: RankName;
  title: string;
  className?: string;
}) {
  return (
    <span
      className={`rank-photograph ${rank === 'MARSHAL' ? 'rank-photograph--marshal' : ''} ${className}`}
    >
      <img
        src={`/ranks/${rank.toLowerCase()}.png`}
        alt={`${title} pagoni`}
        width={rank === 'MARSHAL' ? 240 : 896}
        height={rank === 'MARSHAL' ? 120 : 1200}
        draggable={false}
      />
    </span>
  );
}
