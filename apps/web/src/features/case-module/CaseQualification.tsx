import { useEffect, useRef, useState, useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  LEGAL_ELEMENTS,
  emptyPayloads,
  completeSchemas,
  draftSchemas,
  draftViewSchema,
  draftSavedSchema,
  scoreViewSchema,
} from '@detective/shared';
import type { CaseWorkspace, CasePersonView, LegalElement, PayloadMap } from '@detective/shared';
import { api } from '../../shared/api/client';
import { useCaseUi, CasePending } from './CaseShell';
import { QualificationFields } from './QualificationFields';
const localSchema = z.object({
  expires: z.number(),
  answers: z.array(
    z.object({
      episodeId: z.string().uuid(),
      element: z.enum(LEGAL_ELEMENTS),
      payload: z.unknown(),
      version: z.number().int().min(0),
      dirty: z.boolean(),
    }),
  ),
});
type DraftRow = z.infer<typeof localSchema>['answers'][number];
function useDraft(workspace: CaseWorkspace) {
  const { meta, t } = useCaseUi(),
    client = useQueryClient(),
    id = workspace.case.id,
    key = `case-draft:${meta.user.id}:${id}`;
  const query = useQuery({
    queryKey: ['legal', 'draft', id],
    queryFn: () => api(`/v1/cases/${id}/qualification`, draftViewSchema),
    retry: 1,
  });
  const [rows, setRows] = useState<DraftRow[] | null>(null),
    [state, setState] = useState('saved'),
    [warning, setWarning] = useState(''),
    [qualificationId, setQualificationId] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const model = useRef<DraftRow[]>([]),
    draftId = useRef<string | null>(null),
    initialized = useRef(false),
    saving = useRef<Promise<void> | null>(null);
  const canEdit = workspace.permissions.canEdit && query.data?.canEdit === true;
  const persist = useCallback(
    (next: DraftRow[]) => {
      try {
        if (next.some((r) => r.dirty))
          localStorage.setItem(
            key,
            JSON.stringify({ expires: Date.now() + 86400000, answers: next }),
          );
        else localStorage.removeItem(key);
      } catch {
        setWarning('localUnavailable');
      }
    },
    [key],
  );
  const commit = useCallback(
    (next: DraftRow[]) => {
      model.current = next;
      setRows(next);
      persist(next);
    },
    [persist],
  );
  useEffect(() => {
    if (!query.data || initialized.current) return;
    initialized.current = true;
    draftId.current = query.data.id;
    setQualificationId(query.data.id);
    let next: DraftRow[] = workspace.episodes.flatMap((episode) =>
      LEGAL_ELEMENTS.map((element) => {
        const found = query.data.answers.find(
          (a) => a.episodeId === episode.id && a.elementType === element,
        );
        return {
          episodeId: episode.id,
          element,
          payload: found?.payload ?? emptyPayloads()[element],
          version: found?.version ?? 0,
          dirty: (!found || !query.data.id) && query.data.canEdit,
        };
      }),
    );
    try {
      const local = localSchema.safeParse(JSON.parse(localStorage.getItem(key) ?? 'null'));
      if (local.success && local.data.expires > Date.now()) {
        for (const saved of local.data.answers) {
          const index = next.findIndex(
            (r) => r.episodeId === saved.episodeId && r.element === saved.element,
          );
          if (
            index >= 0 &&
            saved.dirty &&
            draftSchemas[saved.element].safeParse(saved.payload).success
          ) {
            next = next.map((r, i) => (i === index ? saved : r));
            setWarning('localDraft');
          }
        }
      } else localStorage.removeItem(key);
    } catch {
      setWarning('localUnavailable');
    }
    commit(next);
    if (next.some((row) => row.dirty)) setState(navigator.onLine ? 'pending' : 'offline');
  }, [query.data, workspace.episodes, key, commit, reload]);
  const flush = useCallback(async () => {
    if (saving.current) return saving.current;
    if (!canEdit || !model.current.some((r) => r.dirty)) return;
    if (!navigator.onLine) {
      setState('offline');
      throw Error('Offline');
    }
    setState('saving');
    const run = async () => {
      try {
        const dirty = model.current.filter((r) => r.dirty);
        for (const row of dirty) {
          const saved = await api(
            `/v1/cases/${id}/qualification/answers/${row.element}`,
            draftSavedSchema,
            {
              method: 'PUT',
              body: JSON.stringify({
                episodeId: row.episodeId,
                payload: row.payload,
                baseVersion: row.version,
              }),
            },
          );
          draftId.current = saved.qualificationId;
          setQualificationId(saved.qualificationId);
          commit(
            model.current.map((current) =>
              current.episodeId === row.episodeId && current.element === row.element
                ? {
                    ...current,
                    version: saved.answer.version,
                    dirty: JSON.stringify(current.payload) !== JSON.stringify(row.payload),
                  }
                : current,
            ),
          );
          if (saved.conflict) setWarning('conflict');
        }
        setState(model.current.some((r) => r.dirty) ? 'pending' : 'saved');
      } catch (error) {
        setState(navigator.onLine ? 'error' : 'offline');
        throw error;
      } finally {
        saving.current = null;
      }
    };
    saving.current = run();
    return saving.current;
  }, [canEdit, id, commit]);
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => {
    if (!rows?.some((r) => r.dirty) || !canEdit) return;
    const timer = setTimeout(() => void flush().catch(() => undefined), 2000);
    return () => clearTimeout(timer);
  }, [rows, canEdit, flush]);
  useEffect(() => {
    const timer = setInterval(() => void flushRef.current().catch(() => undefined), 30000);
    const online = () => void flushRef.current().catch(() => undefined),
      offline = () => setState('offline');
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    const leave = (event: BeforeUnloadEvent) => {
      if (model.current.some((r) => r.dirty)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', leave);
    return () => {
      clearInterval(timer);
      window.removeEventListener('online', online);
      window.removeEventListener('offline', offline);
      window.removeEventListener('beforeunload', leave);
    };
  }, []);
  const change = (episodeId: string, element: LegalElement, payload: unknown) => {
    if (!canEdit) return;
    commit(
      model.current.map((row) =>
        row.episodeId === episodeId && row.element === element
          ? { ...row, payload, dirty: true }
          : row,
      ),
    );
    setState(navigator.onLine ? 'pending' : 'offline');
  };
  const validate = () =>
    model.current.every((row) => completeSchemas[row.element].safeParse(row.payload).success);
  const submit = async () => {
    if (!validate()) throw Error(t('incomplete'));
    await flush();
    if (model.current.some((r) => r.dirty)) await flush();
    if (model.current.some((r) => r.dirty) || !draftId.current) throw Error(t('pending'));
    const result = await api(`/v1/cases/${id}/qualification/submit`, scoreViewSchema, {
      method: 'POST',
      body: JSON.stringify({ qualificationId: draftId.current }),
    });
    try {
      localStorage.removeItem(key);
    } catch {
      /* Already saved on server. */
    }
    await client.invalidateQueries({ queryKey: ['legal'] });
    return result;
  };
  return {
    query,
    rows,
    state,
    warning,
    qualificationId,
    canEdit,
    change,
    flush,
    submit,
    valid: rows !== null && validate(),
    discard: () => {
      try {
        localStorage.removeItem(key);
      } catch {
        /* Optional storage. */
      }
      initialized.current = false;
      setRows(null);
      setWarning('');
      setReload((value) => value + 1);
      void query.refetch();
    },
  };
}
export function CaseQualification({
  workspace,
  persons,
  onSubmitted,
}: {
  workspace: CaseWorkspace;
  persons: CasePersonView[];
  onSubmitted: () => void;
}) {
  const { t } = useCaseUi();
  const draft = useDraft(workspace);
  const [episodeId, setEpisodeId] = useState(workspace.episodes[0]?.id ?? ''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const episode = workspace.episodes.find((e) => e.id === episodeId);
  if (draft.query.isPending || !draft.rows)
    return (
      <CasePending
        error={draft.query.isError}
        retry={draft.query.isError ? () => void draft.query.refetch() : undefined}
      />
    );
  const subject = (draft.rows.find(
    (row) => row.episodeId === episodeId && row.element === 'SUBJECT',
  )?.payload ?? []) as PayloadMap['SUBJECT'];
  return (
    <div className="case-paper case-qualification">
      <div className="case-section-heading">
        <div>
          <span className="case-kicker">{t('substantive')}</span>
          <h2>{t('qualification')}</h2>
        </div>
        <p>
          {t('attempts')}: {workspace.attemptsUsed}/3
        </p>
      </div>
      <p>{t('independent')}</p>
      {!draft.canEdit && (
        <p className="case-warning">
          {t(workspace.case.status === 'ASSIGNED' ? 'needDocument' : 'readOnly')}
        </p>
      )}
      <div className="case-episode-picker" aria-label={t('episode')}>
        {workspace.episodes.map((e) => (
          <button
            className="case-button"
            aria-pressed={episodeId === e.id}
            onClick={() => setEpisodeId(e.id)}
            key={e.id}
          >
            {t('episode')} {e.episodeNumber} · {t('weight')} {e.weight}
          </button>
        ))}
      </div>
      {episode && <p>{episode.description}</p>}
      {draft.rows
        .filter((row) => row.episodeId === episodeId)
        .map((row) => (
          <details className="case-accordion" key={row.element} open>
            <summary>
              {t(row.element)}{' '}
              <span>
                {row.element === 'SUBJECT' ? 50 : 12.5} {t('score')}
              </span>
            </summary>
            <QualificationFields
              element={row.element}
              payload={row.payload}
              persons={persons}
              subject={subject}
              eventDate={episode?.dateTime ?? workspace.case.openedAt}
              disabled={!draft.canEdit || busy}
              onChange={(payload) => draft.change(episodeId, row.element, payload)}
            />
          </details>
        ))}
      <div className="case-save-status" role="status" aria-live="polite">
        {t(draft.state)}
        {draft.warning && <p className="case-warning">{t(draft.warning)}</p>}
        {!workspace.referenceReady && <p className="case-warning">{t('noReference')}</p>}
      </div>
      {error && (
        <p role="alert" className="case-warning">
          {error}
        </p>
      )}
      <div className="case-actions">
        <button
          className="case-button"
          disabled={!draft.canEdit || busy}
          onClick={() => void draft.flush().catch(() => setError(t('error')))}
        >
          {t('sync')}
        </button>
        <button
          className="case-button case-stamp-button"
          disabled={!draft.canEdit || busy || !draft.valid || !workspace.referenceReady}
          onClick={async () => {
            setBusy(true);
            setError('');
            try {
              await draft.submit();
              onSubmitted();
            } catch {
              setError(t('error'));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('submit')}
        </button>
        {draft.warning === 'localDraft' && (
          <button className="case-button" disabled={busy} onClick={draft.discard}>
            {t('deleteLocal')}
          </button>
        )}
      </div>
    </div>
  );
}
