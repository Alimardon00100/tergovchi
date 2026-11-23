import * as Dialog from '@radix-ui/react-dialog';
import { useRef } from 'react';
import { motion } from 'framer-motion';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { toast } from 'sonner';
import { X, LockKeyhole, Fingerprint } from 'lucide-react';
import type { Workspace } from '@detective/shared';
import { caseActionResultSchema } from '@detective/shared';
import { useUi } from '../../app/store';
import { api } from '../../shared/api/client';
import { Button } from '../../shared/ui/primitives';
import { useQuietMotion } from '../../shared/lib/motion';
import { caseCode, casePhoto, difficultyLabels, formatDate } from '../../shared/lib/presentation';
export function CaseDialog({ data }: { data: Workspace }) {
  const ui = useUi();
  const client = useQueryClient();
  const quiet = useQuietMotion();
  const trigger = useRef<HTMLElement | null>(null);
  const entry = data.cases.find((item) => item.id === ui.selectedCase);
  const refresh = async () => {
    await Promise.all([
      client.invalidateQueries({ queryKey: ['workspace'] }),
      client.invalidateQueries({ queryKey: ['me'] }),
    ]);
  };
  const opening = useMutation({
    mutationFn: () =>
      api(`/cases/${entry?.id}/open`, caseActionResultSchema, {
        method: 'POST',
        headers: { 'Idempotency-Key': crypto.randomUUID() },
      }),
    onSuccess: async (result) => {
      await refresh();
      if (result.rankChanged) ui.celebrate(true);
      toast.success(
        result.awarded
          ? `Ish boshlandi. +${result.pointsAdded} ball!`
          : 'Bu ish allaqachon boshlangan.',
      );
    },
    onError: (error) => toast.error(error.message),
  });
  const closing = useMutation({
    mutationFn: () =>
      api(`/cases/${entry?.id}/close`, z.object({ closed: z.boolean() }), { method: 'POST' }),
    onSuccess: async () => {
      await refresh();
      ui.selectCase(null);
      toast.success('Tergov yakunlandi. Ish Hukm zaliga o‘tkazildi.');
    },
    onError: (error) => toast.error(error.message),
  });
  return (
    <Dialog.Root
      open={!!entry}
      onOpenChange={(open) => {
        if (!open) ui.selectCase(null);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        {entry && (
          <Dialog.Content
            asChild
            onOpenAutoFocus={() => {
              trigger.current =
                document.activeElement instanceof HTMLElement ? document.activeElement : null;
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (trigger.current?.isConnected) trigger.current.focus({ preventScroll: true });
            }}
          >
            <motion.section
              className="case-dialog"
              layoutId={`case-${entry.id}`}
              transition={{ duration: quiet ? 0 : 0.45 }}
            >
              <div className="case-cover">
                <span className="eyebrow">TERGOV BO‘LIMI</span>
                <span className="case-file-code">{caseCode(entry)}</span>
                <div className="case-cover-photo">
                  <img src={casePhoto(entry.slug, entry.coverImageUrl)} alt="" />
                  <span className="paperclip" />
                </div>
                <span className="rubber-stamp">
                  {entry.progress?.status === 'CLOSED' ? 'YAKUNLANGAN' : 'MAXFIY'}
                </span>
                <Fingerprint size={44} />
                <span>{difficultyLabels[entry.difficulty]} daraja</span>
              </div>
              <div className="case-pages paper">
                <Dialog.Close className="dialog-close" aria-label="Ish papkasini yopish">
                  <X size={24} />
                </Dialog.Close>
                <div className="case-pages-scroll">
                  <span className="eyebrow">JINOYAT ISHI · ASL NUSXA</span>
                  <Dialog.Title>{entry.title}</Dialog.Title>
                  <Dialog.Description>{entry.summary}</Dialog.Description>
                  <h3>Ish tafsilotlari</h3>
                  <p>{entry.description}</p>
                  <h3>
                    Dalillar papkasi <small>{entry.evidence.length} ta material</small>
                  </h3>
                  {entry.progress ? (
                    <div className="evidence-list">
                      {entry.evidence.length ? (
                        entry.evidence.map((evidence, index) => (
                          <article className="evidence-record" key={evidence.id}>
                            <span className="evidence-order">
                              DALIL / {String(index + 1).padStart(2, '0')}
                            </span>
                            <h4>{evidence.title}</h4>
                            <p>{evidence.content ?? 'Raqamli dalil materiali.'}</p>
                          </article>
                        ))
                      ) : (
                        <p className="muted">Bu ishga qo‘shimcha materiallar biriktirilmagan.</p>
                      )}
                    </div>
                  ) : (
                    <div className="evidence-locked">
                      <LockKeyhole size={28} />
                      <strong>Dalillar tergov boshlanganda ochiladi</strong>
                      <p>Ishni ro‘yxatga oling va materiallarni o‘rganing.</p>
                    </div>
                  )}
                  {entry.progress && (
                    <p className="case-opened-date">
                      Boshlangan: {formatDate(entry.progress.openedAt)}
                      {entry.progress.closedAt &&
                        ` · Yakunlangan: ${formatDate(entry.progress.closedAt)}`}
                    </p>
                  )}
                </div>
                <div className="case-actions">
                  <span>
                    {entry.progress?.status === 'CLOSED'
                      ? 'Ish arxivga olindi'
                      : entry.progress
                        ? 'Dalillarni ko‘rib chiqing'
                        : `Birinchi ochishda +${entry.customPoints ?? entry.basePoints} ball`}
                  </span>
                  {!entry.progress ? (
                    <Button busy={opening.isPending} onClick={() => opening.mutate()}>
                      Ishni boshlash
                    </Button>
                  ) : entry.progress.status === 'IN_PROGRESS' ? (
                    <Button busy={closing.isPending} onClick={() => closing.mutate()}>
                      Tergovni yakunlash
                    </Button>
                  ) : (
                    <Dialog.Close asChild>
                      <Button variant="secondary">Papkasini yopish</Button>
                    </Dialog.Close>
                  )}
                </div>
              </div>
            </motion.section>
          </Dialog.Content>
        )}
      </Dialog.Portal>
    </Dialog.Root>
  );
}
