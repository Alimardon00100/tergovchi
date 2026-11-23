import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import type { SafeCase } from '@detective/shared';
import { useQuietMotion } from '../../shared/lib/motion';
import { casePhoto } from '../../shared/lib/presentation';
export function SafeCaseFolder({
  entry,
  index,
  onOpen,
}: {
  entry: SafeCase;
  index: number;
  onOpen?: () => void;
}) {
  const quiet = useQuietMotion();
  const stamp =
    entry.progress?.status === 'CLOSED' ? 'OCHILGAN' : entry.progress ? 'JARAYONDA' : 'OCHILMAGAN';
  return (
    <motion.div
      className={`metal-case metal-case--${index}`}
      whileHover={quiet ? {} : { y: -5, scale: 1.02, boxShadow: '4px 12px 12px #000b' }}
      transition={{ duration: 0.22 }}
    >
      <Link
        className="absolute inset-0"
        data-case-id={entry.id}
        to={`/investigation-room?case=${entry.id}`}
        onClick={onOpen}
        aria-label={`${entry.title} — tergov xonasida ochish`}
      >
        <span className="metal-folder-tab">ISH</span>
        <span className="metal-case-number">
          ISH-{new Date(entry.createdAt).getFullYear()}-{entry.id.slice(0, 4).toUpperCase()}
        </span>
        <span className="metal-case-thumbnail">
          <img
            src={casePhoto(entry.slug, entry.coverImageUrl)}
            alt={`${entry.title} ish surati`}
            draggable={false}
          />
        </span>
        <strong>{entry.title}</strong>
        <span className="metal-case-stamp">{stamp}</span>
      </Link>
    </motion.div>
  );
}
