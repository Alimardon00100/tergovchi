import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  caseWorkspaceSchema,
  personsSchema,
  documentsSchema,
  CASE_DOCUMENT_TYPES,
  scoreHistorySchema,
  publicUserSchema,
} from '@detective/shared';
import type { CaseWorkspace } from '@detective/shared';
import { api } from '../../shared/api/client';
import { PaperSelect } from '../../shared/ui/PaperSelect';
import { useCaseUi, CasePending, Deadline, CaseField } from './CaseShell';
import { CaseStatus } from './CaseDashboard';
import { CaseQualification } from './CaseQualification';
export function CaseWorkspacePage() {
  const { id = '' } = useParams(),
    { t, meta } = useCaseUi();
  const [tab, setTab] = useState('general');
  const query = useQuery({
    queryKey: ['legal', 'workspace', id],
    queryFn: () => api(`/v1/cases/${id}/workspace`, caseWorkspaceSchema),
    refetchInterval: 60000,
  });
  const persons = useQuery({
    queryKey: ['legal', 'persons', id],
    queryFn: () => api(`/v1/cases/${id}/persons`, personsSchema),
    enabled: !!query.data,
  });
  const tabs = [
    'general',
    'documents',
    'persons',
    ...(['USER', 'HEAD', 'PROSECUTOR'].includes(meta.user.role) ? ['qualification'] : []),
    'results',
  ];
  if (query.isPending) return <CasePending />;
  if (query.isError) return <CasePending error retry={() => void query.refetch()} />;
  const workspace = query.data;
  return (
    <>
      <div className="case-paper case-workspace-heading">
        <Link to="/case-files">← {t('registry')}</Link>
        <span className="case-kicker">{workspace.case.caseNumber}</span>
        <h2>{workspace.case.title}</h2>
        <CaseStatus file={workspace.case} />
        <div className="case-workspace-meta">
          <span>
            {t('article')} {workspace.case.jkArticles.join(', ')}
          </span>
          <span>{workspace.case.assignee?.displayName ?? t('unassigned')}</span>
          <Deadline date={workspace.case.deadlineAt} />
        </div>
      </div>
      <div role="tablist" aria-label={t('cases')} className="case-tabs">
        {tabs.map((item, index) => (
          <button
            role="tab"
            aria-selected={tab === item}
            aria-controls={'panel-' + item}
            id={'tab-' + item}
            tabIndex={tab === item ? 0 : -1}
            key={item}
            onClick={() => setTab(item)}
            onKeyDown={(event) => {
              if (['ArrowRight', 'ArrowLeft', 'Home', 'End'].includes(event.key)) {
                event.preventDefault();
                const target =
                  event.key === 'Home'
                    ? tabs[0]
                    : event.key === 'End'
                      ? tabs.at(-1)
                      : tabs[
                          (index + (event.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length
                        ];
                if (target) {
                  setTab(target);
                  document.getElementById('tab-' + target)?.focus();
                }
              }
            }}
          >
            {t(item)}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={'panel-' + tab} aria-labelledby={'tab-' + tab} tabIndex={0}>
        {tab === 'general' && <General workspace={workspace} />}
        {tab === 'documents' && <Documents id={id} />}
        {tab === 'persons' &&
          (persons.isPending ? (
            <CasePending />
          ) : persons.isError ? (
            <CasePending error retry={() => void persons.refetch()} />
          ) : (
            <div className="case-person-grid">
              {persons.data.map((p) => (
                <article key={p.id} className="case-person-sheet case-paper">
                  {p.photoUrl && <img src={p.photoUrl} alt="" />}
                  <span className="case-kicker">{t(p.role)}</span>
                  <h3>{p.fullName}</h3>
                  <dl>
                    <div>
                      <dt>{t('birthDate')}</dt>
                      <dd>{p.birthDate}</dd>
                    </div>
                    <div>
                      <dt>{t('address')}</dt>
                      <dd>{p.masked ? t('masked') : p.address}</dd>
                    </div>
                    <div>
                      <dt>PINFL</dt>
                      <dd>{p.pinfl ?? '—'}</dd>
                    </div>
                  </dl>
                  {p.masked && <p className="case-warning">{t('masked')}</p>}
                </article>
              ))}
              {persons.data.length === 0 && <p className="case-paper">{t('noPersons')}</p>}
            </div>
          ))}
        {tab === 'qualification' &&
          (persons.isPending ? (
            <CasePending />
          ) : persons.isError ? (
            <CasePending error retry={() => void persons.refetch()} />
          ) : (
            <CaseQualification
              key={id}
              workspace={workspace}
              persons={persons.data}
              onSubmitted={() => setTab('results')}
            />
          ))}
        {tab === 'results' && <Results id={id} />}
      </div>
    </>
  );
}
export function General({ workspace }: { workspace: CaseWorkspace }) {
  const { t, meta, v2 } = useCaseUi(),
    client = useQueryClient();
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [investigator, setInvestigator] = useState(meta.investigators[0]?.id ?? 'EMPTY');
  const [id] = useState(workspace.case.id);
  const action = async (name: string, body?: unknown) => {
    setBusy(true);
    setError('');
    try {
      await api(`/${v2 && name === 'lock' ? 'v2' : 'v1'}/cases/${id}/${name}`, z.unknown(), {
        method: name === 'lock-release' ? 'DELETE' : 'POST',
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      await client.invalidateQueries({ queryKey: ['legal'] });
      if (v2) await client.invalidateQueries({ queryKey: ['case-opening-v2'] });
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="case-paper">
      <span className="case-kicker">{t('procedural')}</span>
      <h2>{t('general')}</h2>
      <p>{workspace.case.summary}</p>
      <h3>{t('initial')}</h3>
      <p>{workspace.case.initialFacts}</p>
      <dl className="case-general-data">
        <div>
          <dt>{t('opened')}</dt>
          <dd>{new Date(workspace.case.openedAt).toLocaleString()}</dd>
        </div>
        <div>
          <dt>{t('department')}</dt>
          <dd>{workspace.case.department.name}</dd>
        </div>
        <div>
          <dt>{t('lockedUntil')}</dt>
          <dd>
            {workspace.case.lock ? new Date(workspace.case.lock.expiresAt).toLocaleString() : '—'}
          </dd>
        </div>
      </dl>
      {workspace.case.canTake && (
        <button className="case-button" disabled={busy} onClick={() => void action('lock')}>
          {t('renew')}
        </button>
      )}
      {workspace.case.lock?.lockedBy === meta.user.id && (
        <button
          className="case-button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await api(`/${v2 ? 'v2' : 'v1'}/cases/${id}/lock`, z.unknown(), { method: 'DELETE' });
              await client.invalidateQueries({ queryKey: ['legal'] });
              if (v2) await client.invalidateQueries({ queryKey: ['case-opening-v2'] });
            } catch {
              setError(t('error'));
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('release')}
        </button>
      )}
      {workspace.episodes.map((e) => (
        <section className="case-episode-note" key={e.id}>
          <h3>
            {t('episode')} {e.episodeNumber} · {t('article')} {e.jkArticle}
          </h3>
          <p>{e.description}</p>
          <p>
            {e.location} · {new Date(e.dateTime).toLocaleString()} · {t('weight')} {e.weight}
          </p>
        </section>
      ))}
      {workspace.permissions.canApprove && (
        <button
          className="case-button case-stamp-button"
          disabled={busy}
          onClick={() => void action('approve')}
        >
          {t('approve')}
        </button>
      )}
      {meta.user.role === 'HEAD' &&
        workspace.case.department.id === meta.department.id &&
        workspace.case.status !== 'CLOSED' && (
          <form
            className="case-management"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget),
                submit = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
              const type = submit?.value ?? 'reassign';
              const reason = String(data.get('reason'));
              if (type === 'resume') {
                const deadline = String(data.get('deadline'));
                if (!deadline) {
                  setError(t('newDeadline'));
                  return;
                }
                void action('resume', { reason, deadlineAt: new Date(deadline).toISOString() });
              } else if (type === 'suspend') void action('suspend', { reason });
              else void action('reassign', { reason, userId: investigator });
            }}
          >
            <h3>{t('HEAD')}</h3>
            <CaseField label={t('reason')}>
              <textarea name="reason" required minLength={5} maxLength={1000} />
            </CaseField>
            {workspace.case.status === 'SUSPENDED' ? (
              <>
                <CaseField label={t('newDeadline')}>
                  <input type="datetime-local" name="deadline" required />
                </CaseField>
                <button value="resume" className="case-button" disabled={busy}>
                  {t('resume')}
                </button>
              </>
            ) : (
              <>
                <CaseField label={t('investigator')}>
                  <PaperSelect
                    label={t('investigator')}
                    value={investigator}
                    onChange={setInvestigator}
                    options={
                      meta.investigators.length
                        ? meta.investigators.map((u) => ({ value: u.id, label: u.displayName }))
                        : [{ value: 'EMPTY', label: t('unassigned') }]
                    }
                  />
                </CaseField>
                <button
                  className="case-button"
                  value="reassign"
                  disabled={busy || investigator === 'EMPTY'}
                >
                  {t('reassign')}
                </button>
                <button className="case-button" value="suspend" disabled={busy}>
                  {t('suspend')}
                </button>
              </>
            )}
          </form>
        )}
      {error && (
        <p role="alert" className="case-warning">
          {error}
        </p>
      )}
    </div>
  );
}
function Documents({ id }: { id: string }) {
  const { t } = useCaseUi(),
    client = useQueryClient();
  const [type, setType] = useState('ALL'),
    [current, setCurrent] = useState<{ url: string; title: string; mime: string } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['legal', 'documents', id],
    queryFn: () => api(`/v1/cases/${id}/documents`, documentsSchema),
    staleTime: 300000,
  });
  useEffect(
    () => () => {
      if (current) URL.revokeObjectURL(current.url);
    },
    [current],
  );
  if (query.isPending) return <CasePending />;
  if (query.isError) return <CasePending error retry={() => void query.refetch()} />;
  return (
    <div className="case-paper">
      <span className="case-kicker">{t('procedural')}</span>
      <h2>{t('documents')}</h2>
      <div className="case-actions">
        <PaperSelect
          label={t('documentType')}
          value={type}
          onChange={setType}
          options={['ALL', ...CASE_DOCUMENT_TYPES].map((value) => ({
            value,
            label: t(value === 'ALL' ? 'all' : value),
          }))}
        />
        <button className="case-button" onClick={() => void query.refetch()}>
          {t('refreshDocuments')}
        </button>
      </div>
      {query.data
        .filter((d) => type === 'ALL' || d.type === type)
        .map((d) => (
          <article className="case-document-row" key={d.id}>
            <div>
              <h3>{d.title}</h3>
              <p>
                {t(d.type)} · {Math.ceil(d.bytes / 1024)} KB{' '}
                {d.isEvidence && <span className="case-evidence">{t('evidence')}</span>}
              </p>
            </div>
            <button
              className="case-button"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  await api('/auth/me', publicUserSchema);
                  const res = await fetch(d.signedUrl, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                  });
                  if (!res.ok) throw Error('Document unavailable');
                  const blob = await res.blob();
                  setCurrent({ url: URL.createObjectURL(blob), title: d.title, mime: d.mime });
                  await client.invalidateQueries({ queryKey: ['legal', 'workspace', id] });
                } catch {
                  setError(t('documentFailed'));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {t('openDocument')}
            </button>
          </article>
        ))}
      {query.data.filter((d) => type === 'ALL' || d.type === type).length === 0 && (
        <p>{t('noDocuments')}</p>
      )}
      {error && (
        <p className="case-warning" role="alert">
          {error}
        </p>
      )}
      {current && (
        <div className="case-document-viewer">
          <h3>{current.title}</h3>
          <button className="case-button" onClick={() => setCurrent(null)}>
            {t('close')}
          </button>
          {current.mime === 'application/pdf' ? (
            <iframe src={current.url} title={current.title} />
          ) : (
            <img src={current.url} alt={current.title} />
          )}
        </div>
      )}
    </div>
  );
}
export function Results({ id }: { id: string }) {
  const { t, v2 } = useCaseUi();
  const query = useQuery({
    queryKey: ['legal', 'scores', id, v2],
    queryFn: () => api(`/${v2 ? 'v2' : 'v1'}/cases/${id}/score`, scoreHistorySchema),
  });
  const [error, setError] = useState('');
  if (query.isPending) return <CasePending />;
  if (query.isError) return <CasePending error retry={() => void query.refetch()} />;
  return (
    <div className="case-paper">
      <span className="case-kicker">{t('substantive')}</span>
      <h2>{t('results')}</h2>
      <div className="case-best-score">
        <strong>
          {query.data.best ?? '—'}
          <small>/100</small>
        </strong>
        <span>
          {t('best')} · {t('attempts')} {query.data.attemptsUsed}/3
        </span>
      </div>
      {query.data.items.length === 0 && <p>{t('noScores')}</p>}
      {query.data.items.map((score) => (
        <section className="case-score-attempt" key={score.id}>
          <h3>
            {t('attempt')} {score.attemptNumber} — {score.totalScore}/100
          </h3>
          <p>
            {score.investigator} · {t('revision')} {score.referenceRevision} ·{' '}
            {new Date(score.scoredAt).toLocaleString()}
          </p>
          {score.breakdown.episodes.map((e) => (
            <div key={e.episodeId}>
              <h4>
                {t('episode')} {e.episodeNumber} · {e.score.toFixed(2)}/100 · {t('weight')}{' '}
                {e.weight}
              </h4>
              <div className="case-score-elements">
                {e.elements.map((el) => (
                  <div key={el.element}>
                    <span>{t(el.element)}</span>
                    <progress
                      max={el.max}
                      value={el.points}
                      aria-label={`${t(el.element)} ${el.points.toFixed(2)}/${el.max}`}
                    />
                    <b>
                      {el.points.toFixed(2)} / {el.max}
                    </b>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
      <div className="case-actions">
        {['pdf', 'docx'].map((format) => (
          <button
            className="case-button"
            key={format}
            onClick={async () => {
              setError('');
              try {
                await api('/auth/me', publicUserSchema);
                const res = await fetch(`/api/v1/cases/${id}/export?format=${format}`, {
                  credentials: 'same-origin',
                });
                if (!res.ok) throw Error('Export failed');
                const blob = URL.createObjectURL(await res.blob()),
                  link = document.createElement('a');
                link.href = blob;
                link.download = `case-report.${format}`;
                link.click();
                setTimeout(() => URL.revokeObjectURL(blob), 60000);
              } catch {
                setError(t('error'));
              }
            }}
          >
            {t('export')} {format.toUpperCase()}
          </button>
        ))}
      </div>
      {error && <p role="alert">{error}</p>}
    </div>
  );
}
