import { useCallback, useEffect, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  completeSchemas,
  draftSchemas,
  draftSavedSchema,
  draftViewSchema,
  emptyPayloads,
  LEGAL_ELEMENTS,
  scoreViewSchema,
} from '@detective/shared';
import type { CaseWorkspace, LegalElement } from '@detective/shared';
import { api, ApiError } from '../../shared/api/client';
import { useCaseUi } from './CaseShell';
import { answerKey, openingLocalSchema, persistOpening } from './opening-draft-store';
import type { OpeningRow } from './opening-draft-store';

export function useOpeningDraft(workspace: CaseWorkspace) {
  const { meta } = useCaseUi(),
    client = useQueryClient(),
    id = workspace.case.id;
  const key = `case-draft:v2:${meta.user.id}:${id}`;
  const legacyKey = `case-draft:${meta.user.id}:${id}`;
  const query = useQuery({
    queryKey: ['case-opening-v2', 'draft', id],
    queryFn: () => api(`/v2/cases/${id}/qualification`, draftViewSchema),
  });
  const model = useRef<OpeningRow[]>([]),
    confirmed = useRef(new Map<string, unknown>()),
    initialized = useRef(false),
    draftId = useRef<string | null>(null),
    saving = useRef<Promise<void> | null>(null);
  const [rows, setRows] = useState<OpeningRow[] | null>(null),
    [state, setState] = useState('saved'),
    [error, setError] = useState(''),
    [warning, setWarning] = useState(''),
    [blocked, setBlocked] = useState(false);
  const canEdit = workspace.permissions.canEdit && query.data?.canEdit === true && !blocked;
  useEffect(() => {
    setBlocked(false);
  }, [workspace.case.lock?.lockedAt]);
  const commit = useCallback(
    (next: OpeningRow[]) => {
      model.current = next;
      setRows(next);
      try {
        persistOpening(key, next);
        persistOpening(legacyKey, next);
      } catch {
        setWarning('localUnavailable');
      }
    },
    [key, legacyKey],
  );
  useEffect(() => {
    if (!query.data || initialized.current) return;
    initialized.current = true;
    draftId.current = query.data.id;
    let next: OpeningRow[] = workspace.episodes.flatMap((episode) =>
      LEGAL_ELEMENTS.map((element) => {
        const found = query.data.answers.find(
          (answer) => answer.episodeId === episode.id && answer.elementType === element,
        );
        const row = {
          episodeId: episode.id,
          element,
          payload: found?.payload ?? emptyPayloads()[element],
          version: found?.version ?? 0,
          dirty: !found && query.data.canEdit,
        };
        confirmed.current.set(answerKey(row), row.payload);
        return row;
      }),
    );
    try {
      const local = openingLocalSchema.safeParse(
        JSON.parse(
          localStorage.getItem(key) ??
            localStorage.getItem(`case-draft:${meta.user.id}:${id}`) ??
            'null',
        ),
      );
      if (local.success && local.data.expires > Date.now()) {
        next = next.map((row) => {
          const saved = local.data.answers.find((item) => answerKey(item) === answerKey(row));
          if (!saved?.dirty || !draftSchemas[row.element].safeParse(saved.payload).success)
            return row;
          setWarning('localDraft');
          return saved;
        });
      }
    } catch {
      setWarning('localUnavailable');
    }
    commit(next);
    if (next.some((row) => row.dirty)) setState(navigator.onLine ? 'pending' : 'offline');
  }, [query.data, workspace.episodes, key, meta.user.id, id, commit]);
  const flush = useCallback(async () => {
    if (saving.current) return saving.current;
    if (!canEdit || !model.current.some((row) => row.dirty)) return;
    if (!navigator.onLine) {
      setState('offline');
      throw Error('Offline');
    }
    const run = async () => {
      setState('saving');
      setError('');
      try {
        for (const row of model.current.filter((item) => item.dirty)) {
          const result = await api(`/v2/cases/${id}/qualification/answers`, draftSavedSchema, {
            method: 'PUT',
            body: JSON.stringify({
              episodeId: row.episodeId,
              elementType: row.element,
              payload: row.payload,
              baseVersion: row.version,
            }),
          });
          draftId.current = result.qualificationId;
          confirmed.current.set(answerKey(row), result.answer.payload);
          commit(
            model.current.map((current) =>
              answerKey(current) === answerKey(row)
                ? {
                    ...current,
                    version: result.answer.version,
                    dirty: JSON.stringify(current.payload) !== JSON.stringify(row.payload),
                  }
                : current,
            ),
          );
          if (result.conflict) setWarning('conflict');
        }
        setState(model.current.some((row) => row.dirty) ? 'pending' : 'saved');
      } catch (failure) {
        const rejected =
          failure instanceof ApiError && failure.status >= 400 && failure.status < 500;
        if (failure instanceof ApiError && failure.status === 404) {
          setBlocked(true);
          setError('reopenWorkspace');
        } else if (rejected) {
          commit(
            model.current.map((row) => ({
              ...row,
              payload: confirmed.current.get(answerKey(row)),
              dirty: false,
            })),
          );
          setWarning('rolledBack');
          setError(
            failure.status === 409 ? 'lockLost' : failure.status === 429 ? 'rateLimited' : 'error',
          );
          if ([403, 404, 409].includes(failure.status)) setBlocked(true);
        } else setError('error');
        setState(navigator.onLine ? 'error' : 'offline');
        throw failure;
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
    if (!canEdit || !rows?.some((row) => row.dirty)) return;
    const timer = setTimeout(() => void flush().catch(() => undefined), 2000);
    return () => clearTimeout(timer);
  }, [rows, canEdit, flush]);
  useEffect(() => {
    const online = () => void flushRef.current().catch(() => undefined),
      offline = () => setState('offline');
    const leave = (event: BeforeUnloadEvent) => {
      if (model.current.some((row) => row.dirty)) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('online', online);
    window.addEventListener('offline', offline);
    window.addEventListener('beforeunload', leave);
    const interval = setInterval(online, 30000);
    return () => {
      clearInterval(interval);
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
    setError('');
  };
  const valid =
    rows !== null &&
    rows.every((row) => completeSchemas[row.element].safeParse(row.payload).success);
  const submit = async () => {
    if (!valid || !canEdit || !workspace.referenceReady) return false;
    try {
      if (!draftId.current) commit(model.current.map((row) => ({ ...row, dirty: true })));
      await flush();
      if (model.current.some((row) => row.dirty)) await flush();
      if (!draftId.current || model.current.some((row) => row.dirty)) throw Error('Pending draft');
      await api(`/v2/cases/${id}/qualification/submit`, scoreViewSchema, {
        method: 'POST',
        body: JSON.stringify({ qualificationId: draftId.current }),
      });
      draftId.current = null;
      try {
        localStorage.removeItem(key);
        localStorage.removeItem(`case-draft:${meta.user.id}:${id}`);
      } catch {
        setWarning('localUnavailable');
      }
      await Promise.all([
        client.invalidateQueries({ queryKey: ['case-opening-v2'] }),
        client.invalidateQueries({ queryKey: ['legal'] }),
      ]);
      return true;
    } catch (failure) {
      setError(
        failure instanceof ApiError
          ? failure.status === 409
            ? 'lockLost'
            : failure.status === 422
              ? 'noReference'
              : failure.status === 429
                ? 'rateLimited'
                : 'error'
          : 'error',
      );
      return false;
    }
  };
  return { query, rows, state, error, warning, canEdit, valid, change, flush, submit };
}
