import { getRankProgress } from '@detective/shared';
import type { Workspace } from '@detective/shared';
import { Shield, Star } from 'lucide-react';
import { formatNumber } from '../../shared/lib/presentation';
export function RankCard({ data }: { data: Workspace }) {
  const rank = getRankProgress(data.user.points, data.ranks);
  return (
    <section className="rank-record paper">
      <span className="pushpin" />
      <span className="eyebrow">XIZMAT DARAJASI</span>
      <div className="rank-insignia">
        <Shield size={80} strokeWidth={1} />
        <Star size={28} fill="currentColor" />
      </div>
      <h2>{rank.current.title}</h2>
      <span className="rank-record-points">{formatNumber(data.user.points)} ball</span>
      <div
        className="pencil-progress"
        role="progressbar"
        aria-label="Keyingi unvongacha rivojlanish"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(rank.percent)}
      >
        <i style={{ width: `${rank.percent}%` }} />
      </div>
      <p>{rank.next ? `Keyingi unvon: ${rank.next.title}` : 'Eng yuqori unvon'}</p>
      <span className="rubber-stamp">
        {rank.next ? `${formatNumber(rank.remaining)} BALL QOLDI` : 'MARSHAL'}
      </span>
    </section>
  );
}
