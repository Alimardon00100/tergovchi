import { AvatarPhoto } from '../../shared/ui/AvatarPhoto';
import { BoardDecor } from './BoardDecor';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Expand, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { getRankProgress } from '@detective/shared';
import { useBoard } from '../../app/Layout';
import { formatNumber } from '../../shared/lib/presentation';
import { useQuietMotion } from '../../shared/lib/motion';
import { RedStrings } from './RedStrings';
import { SCENE_IMAGES } from '../../shared/scene/SceneBackdrop';
const rooms = [
  {
    id: 'investigation',
    path: '/investigation-room',
    title: 'Tergov xonasi',
    caption: 'Birinchi iz shu yerdan boshlanadi.',
    photo: 'desk',
    stamp: 'YANGI ISHLAR',
  },
  {
    id: 'control',
    path: '/control-room',
    title: 'Nazorat zali',
    caption: 'Hech bir tafsilot nazoratsiz qolmasin.',
    photo: 'control',
    stamp: 'JARAYONDA',
  },
  {
    id: 'defense',
    path: '/defense-room',
    title: 'Himoya xonasi',
    caption: 'Taxminlar emas. Dalillar gapirsin.',
    photo: 'defense',
    stamp: 'DALILLAR',
  },
  {
    id: 'judgment',
    path: '/judgment-hall',
    title: 'Hukm zali',
    caption: 'Har bir ishning o‘z yakuni bor.',
    photo: 'judgment',
    stamp: 'YAKUNLANGAN',
  },
  {
    id: 'statistics',
    path: '/statistics',
    title: 'Statistika',
    caption: 'Izlanishlaringizning qog‘ozdagi izi.',
    photo: null,
    stamp: 'XIZMAT HISOBOTI',
  },
] as const;
export function Dashboard() {
  const data = useBoard();
  const quiet = useQuietMotion();
  const stage = useRef<HTMLDivElement>(null);
  const rank = getRankProgress(data.user.points, data.ranks);
  const active = data.cases.filter((entry) => entry.progress?.status === 'IN_PROGRESS').length;
  const closed = data.cases.filter((entry) => entry.progress?.status === 'CLOSED').length;
  const counts = [data.cases.length, active, active, closed, data.user.points];
  return (
    <div className="cork-stage" ref={stage}>
      <div className="board-nameplate">
        <span>O‘ZBEKISTON · TERGOV BO‘LIMI</span>
        <h1>Tergov doskasi</h1>
      </div>
      <BoardDecor />
      <RedStrings stage={stage} />
      <motion.div
        className="pinned-object detective-id"
        layoutId="scene-/profile"
        whileHover={quiet ? {} : { y: -5, rotate: -1 }}
      >
        <Link to="/profile" aria-label="Shaxsiy profil" className="credential-link">
          <i className="pushpin" data-thread-pin="profile" />
          <span className="credential-photo">
            <AvatarPhoto user={data.user} />
          </span>
          <img
            className="credential-insignia"
            src={`/ranks/${data.user.rankName.toLowerCase()}.svg`}
            alt={`${rank.current.title} pagoni`}
          />
          <span className="credential-label">TERGOVCHI GUVOHNOMASI</span>
          <strong>
            {data.user.avatarUrl
              ? data.user.displayName
              : `Tergovchi ${data.user.displayName.split(' ')[0]}`}
          </strong>
          <span className="credential-rank">{rank.current.title}</span>
          <span className="credential-points">{formatNumber(data.user.points)} ball</span>
          <span
            className="pencil-progress"
            aria-label="Keyingi unvongacha rivojlanish"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(rank.percent)}
          >
            <i style={{ width: `${rank.percent}%` }} />
          </span>
        </Link>
      </motion.div>
      {rooms.map((room, index) => (
        <motion.div
          key={room.id}
          className={`pinned-object room-polaroid room-polaroid--${room.id}`}
          layoutId={`scene-${room.path}`}
          whileHover={
            quiet ? {} : { y: -5, scale: 1.05, zIndex: 12, boxShadow: '0 18px 28px #0009' }
          }
          transition={{ duration: 0.25 }}
        >
          <Link to={room.path} className="polaroid-link" aria-label={room.title}>
            <i className="pushpin" data-thread-pin={room.id} />
            <span className="polaroid-image">
              {room.photo ? (
                <img src={SCENE_IMAGES[room.photo]} alt="" draggable={false} />
              ) : (
                <svg viewBox="0 0 250 140" aria-hidden="true">
                  <path d="M20 10V120H235 M35 100l38-30 36 12 42-50 35 9 40-26" />
                  <path d="M25 40H230M25 80H230" className="chart-pencil" />
                  <circle cx="151" cy="32" r="6" />
                </svg>
              )}
              <span className="photo-corner" />
            </span>
            <span className="polaroid-title">{room.title}</span>
            <span className="polaroid-caption">{room.caption}</span>
            <span className="rubber-stamp">{room.stamp}</span>
            <span className="handwritten-count">
              {counts[index]} {room.id === 'statistics' ? 'ball' : 'ta ish'}
            </span>
          </Link>
        </motion.div>
      ))}
      <div className="pinned-object board-motto">
        <span className="tape" />
        <p>
          Haqiqat hech qachon
          <br />
          <em>izsiz yo‘qolmaydi.</em>
        </p>
        <span>Dalillarni birlashtiring.</span>
      </div>
      {data.user.role === 'ADMIN' ? (
        <motion.div
          className="pinned-object secret-archive"
          layoutId="scene-/admin"
          whileHover={quiet ? {} : { y: -5, scale: 1.04 }}
        >
          <Link to="/admin" aria-label="Maxfiy arxiv">
            <i className="pushpin" data-thread-pin="archive" />
            <ShieldCheck size={28} />
            <strong>Maxfiy arxiv</strong>
            <span>FAQAT VAKOLATLI XODIMGA</span>
          </Link>
          <Link to="/case-files" className="case-registry-entry">
            Jinoyat ishlari reyestri
          </Link>
        </motion.div>
      ) : (
        <div className="pinned-object field-note">
          <span className="tape" />
          <Link to="/case-files" className="case-registry-entry">
            <span className="eyebrow">JPK · JK</span>
            <p>Jinoyat ishlari reyestri</p>
          </Link>
        </div>
      )}
      <p className="scene-instruction">Biror suratni bosing. Keyingi iz sizni kutmoqda.</p>
      <button
        className="metal-control fullscreen-control"
        aria-label="To‘liq ekran"
        onClick={async () => {
          try {
            if (document.fullscreenElement) await document.exitFullscreen();
            else await document.documentElement.requestFullscreen();
          } catch {
            toast.error('Brauzer to‘liq ekran rejimini ochmadi.');
          }
        }}
      >
        <Expand size={18} />
        <span>To‘liq ekran</span>
      </button>
    </div>
  );
}
