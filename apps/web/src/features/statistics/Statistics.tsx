import { useState } from 'react';
import { useBoard } from '../../app/Layout';
import { SceneHeading } from '../../shared/scene/SceneObjects';
import { formatDate, formatNumber } from '../../shared/lib/presentation';
export function Statistics() {
  const data = useBoard();
  const [tab, setTab] = useState('history');
  const active = data.cases.filter((entry) => entry.progress?.status === 'IN_PROGRESS').length;
  const closed = data.cases.filter((entry) => entry.progress?.status === 'CLOSED').length;
  const maximum = Math.max(20, ...data.weekly.map((day) => day.points));
  const points = data.weekly
    .map((day, index) => `${45 + index * 53},${205 - (day.points / maximum) * 165}`)
    .join(' ');
  return (
    <div className={`statistics-stage statistics-tab--${tab}`}>
      <SceneHeading
        title="Xizmat statistikasi"
        eyebrow="TERGOV BO‘LIMINING HISOBOTI"
        description="Har bir izlanish qog‘ozda o‘z izini qoldiradi."
      />
      <section className="statistics-summary paper">
        <span className="paperclip" />
        <span className="eyebrow">SHAXSIY HISOB</span>
        <h2>Tergov qaydlari</h2>
        <dl className="ruled-totals">
          <div>
            <dt>Mavjud ishlar</dt>
            <dd>{data.cases.length}</dd>
          </div>
          <div>
            <dt>Jarayonda</dt>
            <dd>{active}</dd>
          </div>
          <div>
            <dt>Yakunlangan</dt>
            <dd>{closed}</dd>
          </div>
          <div>
            <dt>To‘plangan ball</dt>
            <dd>{formatNumber(data.user.points)}</dd>
          </div>
        </dl>
        <p>Natijalar shaxsiy xizmat daftaringizdan olindi.</p>
        <span className="rubber-stamp">TEKSHIRILGAN</span>
      </section>
      <section className="statistics-history paper">
        <span className="tape" />
        <span className="eyebrow">OXIRGI YETTI KUN</span>
        <h2>Izlanishlar samarasi</h2>
        <svg
          viewBox="0 0 400 265"
          className="paper-chart"
          role="img"
          aria-label="Oxirgi yetti kunda yig‘ilgan ball grafigi"
        >
          <title>
            Yetti kunlik ballar: {data.weekly.map((day) => `${day.day}: ${day.points}`).join(', ')}
          </title>
          {[0, 1, 2, 3, 4].map((index) => (
            <g key={index}>
              <path className="chart-rule" d={`M40 ${205 - index * 41.25}H375`} />
              <text x="30" y={210 - index * 41.25} textAnchor="end">
                {Math.round((index * maximum) / 4)}
              </text>
            </g>
          ))}
          <path className="chart-axes" d="M40 25V210H380" />
          <polyline points={points} className="chart-line" />
          {data.weekly.map((day, index) => (
            <g key={day.day}>
              <circle cx={45 + index * 53} cy={205 - (day.points / maximum) * 165} r="3" />
              <text x={45 + index * 53} y="235" textAnchor="middle">
                {formatDate(day.day + 'T12:00:00Z', true)}
              </text>
            </g>
          ))}
        </svg>
        <p>Faqat shu davrda qo‘shilgan haqiqiy ballar ko‘rsatilgan.</p>
      </section>
      <section className="statistics-leaders paper">
        <span className="pushpin" />
        <span className="eyebrow">XIZMAT RO‘YXATI</span>
        <h2>Yetakchi tergovchilar</h2>
        <ol>
          {data.leaderboard.map((person) => (
            <li key={person.id}>
              <strong>
                {person.displayName}
                {person.id === data.user.id && <small> · siz</small>}
              </strong>
              <span>{formatNumber(person.points)} ball</span>
              <small>{data.ranks.find((rank) => rank.name === person.rankName)?.title}</small>
            </li>
          ))}
        </ol>
        {!data.leaderboard.length && <p>Birinchi natija sizniki bo‘lsin.</p>}
      </section>
      <div className="paper-tabs paper" aria-label="Hisobot varaqlari">
        {[
          ['summary', 'Qaydlar'],
          ['history', 'Grafik'],
          ['leaders', 'Yetakchilar'],
        ].map(([value, title]) => (
          <button
            key={value}
            aria-pressed={tab === value}
            onClick={() => setTab(value ?? 'history')}
          >
            {title}
          </button>
        ))}
      </div>
    </div>
  );
}
