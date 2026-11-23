import { motion } from 'framer-motion';
import type { SafeProfile } from '@detective/shared';
import { useUi } from '../../app/store';
import { useQuietMotion } from '../../shared/lib/motion';
import { AvatarPhoto } from '../../shared/ui/AvatarPhoto';
import { formatNumber } from '../../shared/lib/presentation';
import { RankInsignia } from './RankInsignia';
type Props = {
  profile: SafeProfile;
  open: boolean;
  small: boolean;
  panel: 'profile' | 'shelves';
  onOpenChange: (open: boolean) => void;
  onProfile: (edit: boolean) => void;
  onPassword: () => void;
  onLogout: () => void;
  loggingOut: boolean;
};
export function SafeDoor({
  profile,
  open,
  small,
  panel,
  onOpenChange,
  onProfile,
  onPassword,
  onLogout,
  loggingOut,
}: Props) {
  const quiet = useQuietMotion();
  const ui = useUi();
  const visible = open && (!small || panel === 'profile');
  return (
    <motion.div
      className="metal-safe-door"
      initial={quiet ? false : { rotateY: 0, x: '0%' }}
      animate={{
        rotateY: open ? (small ? (panel === 'profile' ? 180 : 90) : 132) : 0,
        x: open && small && panel === 'profile' ? '-100%' : '0%',
      }}
      transition={{ duration: quiet ? 0 : 1.15, ease: [0.22, 0.7, 0.2, 1] }}
      style={{ transformOrigin: '100% 50%' }}
    >
      <div className="metal-door-front" aria-hidden={open}>
        <div className="metal-front-sign">
          TERGOV BO‘LIMI<strong>SHAXSIY SEYF</strong>
          <small>Faqat xizmat uchun</small>
        </div>
        <span className="metal-keyhole" />
        <span className="metal-door-handle" />
        {!open && (
          <button
            className="metal-front-open metal-button"
            onClick={() => onOpenChange(true)}
            aria-label="Seyfni ochish"
          >
            Seyfni ochish
          </button>
        )}
      </div>
      <div className="metal-door-back" aria-hidden={!visible}>
        <div className="metal-profile-plate">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`metal-rivet metal-rivet--${n}`} aria-hidden="true" />
          ))}
          {visible && (
            <section className="metal-profile-info" aria-label="Xizmat darajasi">
              <button
                className="metal-save"
                onClick={() => onProfile(true)}
                aria-label="Profilni tahrirlash"
              >
                Saqlash
              </button>
              <button
                className="safe-summary"
                aria-label="To‘liq profilni ochish"
                onClick={() => onProfile(false)}
              >
                <span className="metal-id-photo">
                  <AvatarPhoto user={profile} />
                  <span>{profile.avatarUrl ? 'Tergovchi' : 'Tergovchi_1'}</span>
                </span>
                <span className="safe-summary-details">
                  <strong className="safe-summary-name">{profile.displayName}</strong>
                  <span className="safe-summary-rank">{profile.rank.title}</span>
                  <span className="safe-summary-points">{formatNumber(profile.points)} ball</span>
                </span>
                <RankInsignia
                  rank={profile.rankName}
                  title={profile.rank.title}
                  className="summary-rank"
                />
                <span className="summary-progress-note">
                  {profile.progress.next
                    ? `${profile.progress.next.title} uchun yana ${formatNumber(profile.progress.remaining)} ball kerak`
                    : 'Eng yuqori xizmat darajasi'}
                </span>
                <span
                  className="metal-progress summary-progress"
                  role="progressbar"
                  aria-label="Keyingi unvongacha rivojlanish"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(profile.progress.percent)}
                >
                  <i style={{ width: `${profile.progress.percent}%` }} />
                </span>
              </button>
              <div className="metal-account-actions">
                <button className="metal-button" disabled={loggingOut} onClick={onLogout}>
                  Hisobdan chiqish
                </button>
                <button className="metal-button" onClick={onPassword}>
                  Parolni o‘zgartirish
                </button>
              </div>
              <label className="metal-motion">
                <input
                  type="checkbox"
                  checked={ui.reducedMotion}
                  onChange={(event) => ui.setMotion(event.target.checked)}
                />
                <span className="metal-check" aria-hidden="true" />
                Harakatlarni kamaytirish
              </label>
              <button
                className="metal-button metal-lock-button"
                onClick={() => onOpenChange(false)}
                aria-label="Seyfni yopish"
              >
                Qulflash
              </button>
            </section>
          )}
        </div>
      </div>
    </motion.div>
  );
}
