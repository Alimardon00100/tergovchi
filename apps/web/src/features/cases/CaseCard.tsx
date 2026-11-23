import { motion } from 'framer-motion';
import type { CaseView } from '@detective/shared';
import { useUi } from '../../app/store';
import { useQuietMotion } from '../../shared/lib/motion';
import { caseCode, casePhoto, difficultyLabels } from '../../shared/lib/presentation';
export function CaseCard({ entry, index = 0 }: { entry: CaseView; index?: number }) {
  const select = useUi((state) => state.selectCase);
  const quiet = useQuietMotion();
  return (
    <motion.button
      className={`case-folder case-folder--${index} ${entry.progress?.status === 'CLOSED' ? 'case-folder--closed' : ''}`}
      layoutId={`case-${entry.id}`}
      aria-label={`${entry.title} — ish tafsilotlarini ochish`}
      onClick={() => select(entry.id)}
      initial={quiet ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: quiet ? 0 : 0.35, delay: quiet ? 0 : index * 0.035 }}
      whileHover={quiet ? {} : { y: -5, scale: 1.05, zIndex: 15, boxShadow: '0 18px 30px #000b' }}
    >
      <span className="folder-tab">JINOYAT ISHI</span>
      <span className="folder-crease" />
      <span className="folder-photo">
        <img src={casePhoto(entry.slug, entry.coverImageUrl)} alt="" draggable={false} />
        <i className="paperclip" />
      </span>
      <span className="folder-number">{caseCode(entry)}</span>
      <h2>{entry.title}</h2>
      <span className="folder-difficulty">
        {difficultyLabels[entry.difficulty]} · {entry.evidence.length} ta dalil
      </span>
      <span className="folder-status rubber-stamp">
        {entry.progress?.status === 'CLOSED'
          ? 'YAKUNLANDI'
          : entry.progress
            ? 'JARAYONDA'
            : 'OCHILMAGAN'}
      </span>
      <span className="folder-points">
        {entry.progress
          ? `${entry.progress.awardedPoints} ball`
          : `+${entry.customPoints ?? entry.basePoints} ball`}
      </span>
    </motion.button>
  );
}
