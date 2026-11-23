import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import type { SafeCase } from '@detective/shared';
import { useQuietMotion } from '../../shared/lib/motion';
import { useSmallScene } from '../../shared/scene/SceneObjects';
import { SafeCaseFolder } from './SafeCaseFolder';
export function AllCasesModal({ entries, onClose }: { entries: SafeCase[]; onClose: () => void }) {
  const quiet = useQuietMotion();
  const small = useSmallScene();
  const capacity = small ? 2 : 6;
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(entries.length / capacity));
  const current = Math.min(page, pages - 1);
  return (
    <Dialog.Root
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content asChild>
          <motion.section
            className="all-cases-document paper"
            style={{ x: '-50%', y: '-50%' }}
            initial={quiet ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: quiet ? 0 : 0.25 }}
          >
            <span className="paperclip" aria-hidden="true" />
            <span className="metal-paper-classification">TERGOV BO‘LIMI · ISHLAR ARXIVI</span>
            <Dialog.Title>Barcha jinoyat ishlari</Dialog.Title>
            <Dialog.Description>
              {entries.length} ta ish. Papkani tanlang va tergov xonasida oching.
            </Dialog.Description>
            <Dialog.Close className="metal-paper-close" aria-label="Barcha ishlar oynasini yopish">
              ×
            </Dialog.Close>
            <div className="all-cases-board">
              {entries
                .slice(current * capacity, current * capacity + capacity)
                .map((entry, index) => (
                  <SafeCaseFolder key={entry.id} entry={entry} index={index} onOpen={onClose} />
                ))}
              {!entries.length && <p className="all-cases-empty">Hozircha jinoyat ishlari yo‘q.</p>}
            </div>
            <div className="all-cases-footer">
              <button className="document-close-stamp" onClick={onClose}>
                Yopish
              </button>
              <div className="all-cases-pagination">
                <button disabled={!current} onClick={() => setPage(current - 1)}>
                  Oldingi
                </button>
                <span>
                  {current + 1}/{pages}
                </span>
                <button disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>
                  Keyingi
                </button>
              </div>
            </div>
          </motion.section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
