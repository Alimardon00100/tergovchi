import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { CASE_STATUSES, caseListSchema, casePreviewSchema } from '@detective/shared';
import type { CasePreview } from '@detective/shared';
import { api } from '../../shared/api/client';
import { PaperSelect } from '../../shared/ui/PaperSelect';
import { useQuietMotion } from '../../shared/lib/motion';
import { useCaseUi, CasePending, CasePager, CaseField, Deadline } from './CaseShell';
export function CaseDashboard() {
  const { t, meta } = useCaseUi();
  const navigate = useNavigate(),
    client = useQueryClient(),
    quiet = useQuietMotion();
  const [status, setStatus] = useState('ALL'),
    [investigator, setInvestigator] = useState('ALL'),
    [params, setParams] = useState(''),
    [page, setPage] = useState(1),
    [selected, setSelected] = useState<string | null>(null);
  const cases = useQuery({
    queryKey: ['legal', 'list', params, page],
    queryFn: () => api(`/v1/cases?page=${page}&${params}`, caseListSchema),
  });
  const take = useMutation({
    mutationFn: (id: string) => api(`/v1/cases/${id}/lock`, casePreviewSchema, { method: 'POST' }),
    onSuccess: async (result) => {
      await client.invalidateQueries({ queryKey: ['legal'] });
      navigate('/case-files/' + result.id);
    },
    onError: () => toast.error(t('error')),
  });
  return (
    <>
      <form
        className="case-filters case-paper"
        onSubmit={(event) => {
          event.preventDefault();
          const f = new FormData(event.currentTarget),
            q = new URLSearchParams();
          if (status !== 'ALL') q.set('status', status);
          if (investigator !== 'ALL') q.set('investigatorId', investigator);
          for (const key of ['jkArticle', 'from', 'to']) {
            const value = String(f.get(key) ?? '').trim();
            if (value) q.set(key, value);
          }
          setParams(q.toString());
          setPage(1);
        }}
      >
        <CaseField label={t('status')}>
          <PaperSelect
            label={t('status')}
            value={status}
            onChange={setStatus}
            options={['ALL', ...CASE_STATUSES].map((value) => ({
              value,
              label: t(value === 'ALL' ? 'all' : value),
            }))}
          />
        </CaseField>
        <CaseField label={t('article')}>
          <input
            name="jkArticle"
            inputMode="numeric"
            placeholder="169"
            pattern="[0-9]{1,3}(-[0-9]{1,2})?"
            maxLength={6}
          />
        </CaseField>
        <CaseField label={t('from')}>
          <input type="date" name="from" />
        </CaseField>
        <CaseField label={t('to')}>
          <input type="date" name="to" />
        </CaseField>
        <CaseField label={t('investigator')}>
          <PaperSelect
            label={t('investigator')}
            value={investigator}
            onChange={setInvestigator}
            options={[
              { value: 'ALL', label: t('all') },
              ...meta.investigators.map((u) => ({ value: u.id, label: u.displayName })),
            ]}
          />
        </CaseField>
        <button className="case-button case-stamp-button" type="submit">
          {t('filter')}
        </button>
        <button
          className="case-button"
          type="reset"
          onClick={() => {
            setStatus('ALL');
            setInvestigator('ALL');
            setParams('');
            setPage(1);
          }}
        >
          {t('reset')}
        </button>
      </form>
      {cases.isPending ? (
        <CasePending />
      ) : cases.isError ? (
        <CasePending error retry={() => void cases.refetch()} />
      ) : (
        <>
          <div className="case-folder-grid">
            {cases.data.items.map((file) => (
              <motion.article
                className="case-file-folder"
                key={file.id}
                whileHover={quiet ? {} : { y: -4, rotate: -0.4 }}
              >
                <span className="case-folder-tab">{file.caseNumber}</span>
                <div className="case-stamp">{t(file.status)}</div>
                <h2>{file.title}</h2>
                <p>{file.summary}</p>
                <dl>
                  <div>
                    <dt>{t('article')}</dt>
                    <dd>{file.jkArticles.join(', ')}</dd>
                  </div>
                  <div>
                    <dt>{t('investigator')}</dt>
                    <dd>{file.assignee?.displayName ?? t('unassigned')}</dd>
                  </div>
                  <div>
                    <dt>{t('deadline')}</dt>
                    <dd>
                      <Deadline date={file.deadlineAt} />
                    </dd>
                  </div>
                </dl>
                <div className="case-actions">
                  <button className="case-button" onClick={() => setSelected(file.id)}>
                    {t('view')}
                  </button>
                  {meta.user.role === 'USER' && (
                    <span title={file.blockReason ?? undefined}>
                      <button
                        className="case-button case-stamp-button"
                        disabled={!file.canTake || take.isPending}
                        onClick={() => take.mutate(file.id)}
                      >
                        {t(file.assignee?.id === meta.user.id ? 'renew' : 'take')}
                      </button>
                    </span>
                  )}
                  {file.canEnter && (
                    <Link className="case-button" to={'/case-files/' + file.id}>
                      {t('enter')}
                    </Link>
                  )}
                </div>
              </motion.article>
            ))}
          </div>
          {cases.data.items.length === 0 && <p className="case-paper">{t('emptyCases')}</p>}
          <CasePager
            page={page}
            size={cases.data.pageSize}
            total={cases.data.total}
            onChange={setPage}
          />
        </>
      )}
      {selected && (
        <CasePreviewDialog
          id={selected}
          onClose={() => setSelected(null)}
          onTake={(id) => take.mutate(id)}
          busy={take.isPending}
        />
      )}
    </>
  );
}
function CasePreviewDialog({
  id,
  onClose,
  onTake,
  busy,
}: {
  id: string;
  onClose: () => void;
  onTake: (id: string) => void;
  busy: boolean;
}) {
  const { t, theme, locale, meta } = useCaseUi();
  const query = useQuery({
    queryKey: ['legal', 'preview', id],
    queryFn: () => api(`/v1/cases/${id}`, casePreviewSchema),
  });
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay" />
        <Dialog.Content
          className={`case-module case-paper case-modal theme-${theme}`}
          lang={locale}
        >
          <Dialog.Title>{t('preview')}</Dialog.Title>
          <Dialog.Description>{query.data?.caseNumber ?? t('loading')}</Dialog.Description>
          {query.isPending ? (
            <p role="status">{t('loading')}</p>
          ) : query.isError ? (
            <p role="alert">{t('error')}</p>
          ) : (
            <>
              <h2>{query.data.title}</h2>
              <p>{query.data.summary}</p>
              <p>
                <strong>{t('article')}: </strong>
                {query.data.jkArticles.join(', ')}
              </p>
              <h3>{t('initial')}</h3>
              <p>{query.data.initialFacts}</p>
              <Deadline date={query.data.deadlineAt} />
              {meta.user.role === 'USER' && (
                <button
                  className="case-button case-stamp-button"
                  disabled={!query.data.canTake || busy}
                  title={query.data.blockReason ?? undefined}
                  onClick={() => onTake(id)}
                >
                  {t('take')}
                </button>
              )}
              {query.data.canEnter && (
                <Link className="case-button" to={'/case-files/' + id}>
                  {t('enter')}
                </Link>
              )}
            </>
          )}
          <Dialog.Close className="case-button case-modal-close">{t('close')}</Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
export function CaseStatus({ file }: { file: CasePreview }) {
  const { t } = useCaseUi();
  return (
    <span className="case-stamp" data-status={file.status}>
      {t(file.status)}
    </span>
  );
}
