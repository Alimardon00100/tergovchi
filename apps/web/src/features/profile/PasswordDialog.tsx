import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { motion } from 'framer-motion';
import { useQuietMotion } from '../../shared/lib/motion';
import { PasswordForm } from './PasswordForm';
export function PasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const quiet = useQuietMotion();
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(next) => {
        if (!busy) onOpenChange(next);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content asChild>
          <motion.section
            className="metal-password-paper paper"
            style={{ x: '-50%', y: '-50%' }}
            initial={quiet ? false : { opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: quiet ? 0 : 0.25 }}
          >
            <span className="paperclip" aria-hidden="true" />
            <Dialog.Close
              className="metal-paper-close"
              disabled={busy}
              aria-label="Parol formasini yopish"
            >
              ×
            </Dialog.Close>
            <span className="metal-paper-classification">SHAXSIY HUJJAT · MAXFIY</span>
            <Dialog.Title>Parolni o‘zgartirish</Dialog.Title>
            <Dialog.Description>
              Amaldagi parolni tasdiqlang va yangi parol kiriting.
            </Dialog.Description>
            <PasswordForm onChanged={() => onOpenChange(false)} onBusyChange={setBusy} />
            <span className="metal-paper-seal" aria-hidden="true">
              TERGOV
              <br />
              BO‘LIMI
            </span>
          </motion.section>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
