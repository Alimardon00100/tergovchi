import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import {
  caseListSchema,
  caseWorkspaceSchema,
  personsSchema,
  LEGAL_ELEMENTS,
  emptyPayloads,
  completeSchemas,
  elementSchema,
  ELEMENT_WEIGHTS,
  adminUsersSchema,
  auditListSchema,
  CASE_DOCUMENT_TYPES,
} from '@detective/shared';
import type { PayloadMap, LegalElement } from '@detective/shared';
import { api } from '../../shared/api/client';
import { PaperSelect } from '../../shared/ui/PaperSelect';
import { useCaseUi, CaseField, CasePending, CasePager } from './CaseShell';
import { QualificationFields } from './QualificationFields';
const referencesSchema = z.object({
  revision: z.number().int(),
  weights: z.object({
    SUBJECT: z.literal(50),
    PARTICIPATION: z.literal(12.5),
    OBJECT: z.literal(12.5),
    OBJECTIVE: z.literal(12.5),
    SUBJECTIVE: z.literal(12.5),
  }),
  answers: z.array(
    z.object({ episodeId: z.string().uuid(), elementType: elementSchema, payload: z.unknown() }),
  ),
});
export function CaseAdmin() {
  const { t, meta } = useCaseUi();
  const [tab, setTab] = useState('references'),
    [selected, setSelected] = useState(''),
    [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['legal', 'admin-list', page],
    queryFn: () => api(`/v1/cases?page=${page}&pageSize=25`, caseListSchema),
    enabled: meta.user.role === 'ADMIN',
  });
  useEffect(() => {
    if (query.data && !query.data.items.some((c) => c.id === selected))
      setSelected(query.data.items[0]?.id ?? '');
  }, [query.data, selected]);
  if (meta.user.role !== 'ADMIN') return <p className="case-paper">{t('permission')}</p>;
  return (
    <>
      <div className="case-paper">
        <h2>{t('administration')}</h2>
        <div className="case-actions">
          {['references', 'createCase', 'users'].map((key) => (
            <button
              className="case-button"
              key={key}
              aria-pressed={tab === key}
              onClick={() => setTab(key)}
            >
              {t(key)}
            </button>
          ))}
        </div>
      </div>
      {tab === 'createCase' ? (
        <CreateCase
          onCreated={(id) => {
            setTab('references');
            setSelected(id);
            void query.refetch();
          }}
        />
      ) : tab === 'users' ? (
        <Users />
      ) : query.isPending ? (
        <CasePending />
      ) : query.isError ? (
        <CasePending error retry={() => void query.refetch()} />
      ) : (
        <>
          <div className="case-paper">
            <CaseField label={t('cases')}>
              <PaperSelect
                label={t('cases')}
                value={selected || 'EMPTY'}
                options={
                  query.data.items.length
                    ? query.data.items.map((c) => ({
                        value: c.id,
                        label: `${c.caseNumber} · ${c.title}`,
                      }))
                    : [{ value: 'EMPTY', label: t('emptyCases') }]
                }
                onChange={setSelected}
              />
            </CaseField>
            <CasePager page={page} total={query.data.total} size={25} onChange={setPage} />
          </div>
          {selected && <ReferenceEditor key={selected} id={selected} />}
        </>
      )}
    </>
  );
}
function ReferenceEditor({ id }: { id: string }) {
  const { t } = useCaseUi(),
    client = useQueryClient();
  const workspace = useQuery({
      queryKey: ['legal', 'workspace', id],
      queryFn: () => api(`/v1/cases/${id}/workspace`, caseWorkspaceSchema),
    }),
    persons = useQuery({
      queryKey: ['legal', 'persons', id],
      queryFn: () => api(`/v1/cases/${id}/persons`, personsSchema),
    }),
    references = useQuery({
      queryKey: ['legal', 'reference', id],
      queryFn: () => api(`/v1/admin/cases/${id}/reference-answers`, referencesSchema),
    });
  const [episodeId, setEpisodeId] = useState(''),
    [values, setValues] = useState<
      { episodeId: string; elementType: LegalElement; payload: unknown }[] | null
    >(null),
    [revision, setRevision] = useState(0),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  useEffect(() => {
    if (!workspace.data || !references.data || values) return;
    setEpisodeId(workspace.data.episodes[0]?.id ?? '');
    setRevision(references.data.revision);
    setValues(
      workspace.data.episodes.flatMap((e) =>
        LEGAL_ELEMENTS.map((elementType) => ({
          episodeId: e.id,
          elementType,
          payload:
            references.data.answers.find(
              (a) => a.episodeId === e.id && a.elementType === elementType,
            )?.payload ?? emptyPayloads()[elementType],
        })),
      ),
    );
  }, [workspace.data, references.data, values]);
  if (workspace.isError || persons.isError || references.isError)
    return (
      <CasePending
        error
        retry={() => {
          void workspace.refetch();
          void persons.refetch();
          void references.refetch();
        }}
      />
    );
  if (!workspace.data || !persons.data || !references.data || !values) return <CasePending />;
  const episode = workspace.data.episodes.find((e) => e.id === episodeId),
    subject = (values.find((v) => v.episodeId === episodeId && v.elementType === 'SUBJECT')
      ?.payload ?? []) as PayloadMap['SUBJECT'];
  const disabled = workspace.data.case.status === 'CLOSED';
  return (
    <>
      <div className="case-paper">
        <span className="case-kicker">
          {t('ADMIN')} · {t('substantive')}
        </span>
        <h2>{t('references')}</h2>
        <p>
          {t('revision')}: {revision}. {t('fixedWeights')}
        </p>
        <div className="case-episode-picker">
          {workspace.data.episodes.map((e) => (
            <button
              className="case-button"
              aria-pressed={episodeId === e.id}
              key={e.id}
              onClick={() => setEpisodeId(e.id)}
            >
              {t('episode')} {e.episodeNumber}
            </button>
          ))}
        </div>
        {values
          .filter((v) => v.episodeId === episodeId)
          .map((row) => (
            <details className="case-accordion" open key={row.elementType}>
              <summary>
                {t(row.elementType)} · {ELEMENT_WEIGHTS[row.elementType]}
              </summary>
              <QualificationFields
                element={row.elementType}
                payload={row.payload}
                persons={persons.data}
                subject={subject}
                eventDate={episode?.dateTime ?? workspace.data.case.openedAt}
                disabled={busy || disabled}
                onChange={(payload) =>
                  setValues(
                    values.map((v) =>
                      v.episodeId === episodeId && v.elementType === row.elementType
                        ? { ...v, payload }
                        : v,
                    ),
                  )
                }
              />
            </details>
          ))}
        <button
          className="case-button case-stamp-button"
          disabled={
            busy ||
            disabled ||
            !values.every((v) => completeSchemas[v.elementType].safeParse(v.payload).success)
          }
          onClick={async () => {
            setBusy(true);
            setMessage('');
            try {
              const result = await api(
                `/v1/admin/cases/${id}/reference-answers`,
                z.object({ revision: z.number().int() }),
                { method: 'PUT', body: JSON.stringify({ revision, answers: values }) },
              );
              setRevision(result.revision);
              setMessage('success');
              await client.invalidateQueries({ queryKey: ['legal'] });
            } catch {
              setMessage('error');
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('save')}
        </button>
        {message && <p role="status">{t(message)}</p>}
      </div>
      {workspace.data.case.status === 'NEW' && <AdminMaterials id={id} />}
    </>
  );
}
function CreateCase({ onCreated }: { onCreated: (id: string) => void }) {
  const { t, meta } = useCaseUi();
  const [episodes, setEpisodes] = useState([1]),
    [department, setDepartment] = useState(meta.department.id),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(false);
  return (
    <form
      className="case-paper case-edit-form"
      onSubmit={async (event) => {
        event.preventDefault();
        setBusy(true);
        setError(false);
        const f = new FormData(event.currentTarget),
          get = (key: string) => String(f.get(key) ?? '');
        try {
          const payload = {
            caseNumber: get('caseNumber'),
            title: get('title'),
            summary: get('summary'),
            initialFacts: get('initialFacts'),
            openedAt: new Date(get('openedAt')).toISOString(),
            deadlineAt: new Date(get('deadlineAt')).toISOString(),
            departmentId: department,
            jkArticles: get('articles')
              .split(',')
              .map((a) => a.trim())
              .filter(Boolean),
            episodes: episodes.map((n) => ({
              episodeNumber: n,
              description: get(`description${n}`),
              jkArticle: get(`article${n}`),
              location: get(`location${n}`),
              dateTime: new Date(get(`date${n}`)).toISOString(),
              weight: Number(get(`weight${n}`)),
            })),
          };
          const result = await api('/v1/cases', z.object({ id: z.string().uuid() }).passthrough(), {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          onCreated(result.id);
        } catch {
          setError(true);
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{t('createCase')}</h2>
      <div className="case-form-grid">
        <CaseField label={t('caseNumber')}>
          <input
            name="caseNumber"
            placeholder="1-2026-004"
            required
            pattern="[0-9]{1,3}-[0-9]{4}-[0-9]{3,8}"
          />
        </CaseField>
        <CaseField label={t('title')}>
          <input name="title" required minLength={3} maxLength={160} />
        </CaseField>
        <CaseField label={t('department')}>
          <PaperSelect
            label={t('department')}
            value={department}
            options={meta.departments.map((d) => ({ value: d.id, label: d.name }))}
            onChange={setDepartment}
          />
        </CaseField>
        <CaseField label={t('article')}>
          <input name="articles" placeholder="169, 168" required />
        </CaseField>
        <CaseField label={t('opened')}>
          <input type="datetime-local" name="openedAt" required />
        </CaseField>
        <CaseField label={t('deadline')}>
          <input type="datetime-local" name="deadlineAt" required />
        </CaseField>
      </div>
      <CaseField label={t('summary')}>
        <textarea name="summary" required minLength={20} maxLength={2000} />
      </CaseField>
      <CaseField label={t('initial')}>
        <textarea name="initialFacts" required minLength={20} maxLength={8000} />
      </CaseField>
      {episodes.map((n) => (
        <fieldset className="case-episode-note" key={n}>
          <legend>
            {t('episode')} {n}
          </legend>
          <CaseField label={t('description')}>
            <textarea name={`description${n}`} required minLength={10} maxLength={8000} />
          </CaseField>
          <div className="case-form-grid">
            <CaseField label={t('article')}>
              <input name={`article${n}`} required pattern="[0-9]{1,3}(-[0-9]{1,2})?" />
            </CaseField>
            <CaseField label={t('location')}>
              <input name={`location${n}`} required minLength={2} maxLength={200} />
            </CaseField>
            <CaseField label={t('eventDate')}>
              <input name={`date${n}`} type="datetime-local" required />
            </CaseField>
            <CaseField label={t('weight')}>
              <input
                name={`weight${n}`}
                type="number"
                defaultValue="1"
                min="0.001"
                max="100"
                step="0.001"
                required
              />
            </CaseField>
          </div>
        </fieldset>
      ))}
      <div className="case-actions">
        <button
          type="button"
          className="case-button"
          disabled={episodes.length >= 10}
          onClick={() => setEpisodes([...episodes, episodes.length + 1])}
        >
          + {t('addEpisode')}
        </button>
        <button className="case-button case-stamp-button" disabled={busy}>
          {t('createCase')}
        </button>
      </div>
      {error && <p role="alert">{t('error')}</p>}
    </form>
  );
}
function AdminMaterials({ id }: { id: string }) {
  const { t, v2 } = useCaseUi(),
    client = useQueryClient();
  const [role, setRole] = useState('SUSPECT'),
    [gender, setGender] = useState('UNKNOWN'),
    [docType, setDocType] = useState('PROTOCOL'),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <div className="case-paper">
      <span className="case-kicker">{t('procedural')}</span>
      <details className="case-accordion">
        <summary>{t('addPerson')}</summary>
        <form
          className="case-edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setMessage('');
            const form = event.currentTarget,
              f = new FormData(form);
            try {
              await api(
                `/${v2 ? 'v2' : 'v1'}/cases/${id}/persons`,
                z.object({ id: z.string().uuid() }),
                {
                  method: 'POST',
                  body: JSON.stringify({
                    fullName: f.get('fullName'),
                    birthDate: f.get('birthDate'),
                    address: f.get('address'),
                    pinfl: f.get('pinfl') || null,
                    photoUrl: null,
                    gender,
                    role,
                    ...(v2
                      ? { contact: f.get('contact') || null, note: f.get('note') || null }
                      : {}),
                  }),
                },
              );
              form.reset();
              await client.invalidateQueries({ queryKey: ['legal', 'persons', id] });
              setMessage('success');
            } catch {
              setMessage('error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <CaseField label={t('fullName')}>
            <input name="fullName" required minLength={2} maxLength={160} />
          </CaseField>
          <CaseField label={t('birthDate')}>
            <input
              name="birthDate"
              type="date"
              required
              max={new Date().toISOString().slice(0, 10)}
            />
          </CaseField>
          <CaseField label={t('gender')}>
            <PaperSelect
              label={t('gender')}
              value={gender}
              options={['MALE', 'FEMALE', 'UNKNOWN'].map((value) => ({ value, label: t(value) }))}
              onChange={setGender}
            />
          </CaseField>
          <CaseField label={t('role')}>
            <PaperSelect
              label={t('role')}
              value={role}
              options={['SUSPECT', 'WITNESS', 'VICTIM', 'OTHER'].map((value) => ({
                value,
                label: t(value),
              }))}
              onChange={setRole}
            />
          </CaseField>
          <CaseField label={t('address')}>
            <input name="address" autoComplete="off" required minLength={5} maxLength={500} />
          </CaseField>
          {v2 && (
            <>
              <CaseField label={t('contact')}>
                <input name="contact" autoComplete="off" maxLength={500} />
              </CaseField>
              <CaseField label={t('personNote')}>
                <textarea name="note" maxLength={2000} />
              </CaseField>
            </>
          )}
          <CaseField label={t('pinfl')}>
            <input
              name="pinfl"
              autoComplete="off"
              pattern="[0-9]{14}"
              inputMode="numeric"
              maxLength={14}
            />
          </CaseField>
          <button className="case-button" disabled={busy}>
            {t('addPerson')}
          </button>
        </form>
      </details>
      <details className="case-accordion">
        <summary>{t('upload')}</summary>
        <form
          className="case-edit-form"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            setMessage('');
            const form = event.currentTarget,
              f = new FormData(form),
              file = f.get('file');
            if (!(file instanceof File) || file.size > 4 * 1024 * 1024) {
              setMessage('error');
              setBusy(false);
              return;
            }
            const body = new FormData();
            body.set(
              'data',
              JSON.stringify({
                title: f.get('title'),
                type: docType,
                isEvidence: f.get('evidence') === 'on',
              }),
            );
            body.set('file', file);
            try {
              await api(`/v1/cases/${id}/documents`, z.object({ id: z.string().uuid() }), {
                method: 'POST',
                body,
              });
              form.reset();
              setMessage('success');
              await client.invalidateQueries({ queryKey: ['legal', 'documents', id] });
            } catch {
              setMessage('error');
            } finally {
              setBusy(false);
            }
          }}
        >
          <CaseField label={t('title')}>
            <input name="title" required minLength={3} maxLength={160} />
          </CaseField>
          <CaseField label={t('documentType')}>
            <PaperSelect
              label={t('documentType')}
              value={docType}
              options={CASE_DOCUMENT_TYPES.map((value) => ({ value, label: t(value) }))}
              onChange={setDocType}
            />
          </CaseField>
          <CaseField label={t('file')}>
            <input
              name="file"
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              required
            />
          </CaseField>
          <label>
            <input type="checkbox" name="evidence" /> {t('evidence')}
          </label>
          <button className="case-button" disabled={busy}>
            {t('upload')}
          </button>
        </form>
      </details>
      {message && <p role="status">{t(message)}</p>}
    </div>
  );
}
function Users() {
  const { t } = useCaseUi();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['legal', 'users', page],
    queryFn: () => api(`/v1/admin/users?page=${page}`, adminUsersSchema),
  });
  if (query.isPending) return <CasePending />;
  if (query.isError) return <CasePending error retry={() => void query.refetch()} />;
  return (
    <div className="case-paper">
      <h2>{t('users')}</h2>
      {query.data.items.map((user) => (
        <UserEditor key={user.id} user={user} />
      ))}
      <CasePager page={page} total={query.data.total} size={25} onChange={setPage} />
    </div>
  );
}
function UserEditor({ user }: { user: z.infer<typeof adminUsersSchema>['items'][number] }) {
  const { t, meta } = useCaseUi(),
    client = useQueryClient();
  const [role, setRole] = useState<string>(user.role),
    [department, setDepartment] = useState(user.departmentId),
    [banned, setBanned] = useState(!!user.bannedAt),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  return (
    <details className="case-accordion">
      <summary>
        {user.displayName} · {t(user.role)}
      </summary>
      <form
        className="case-form-grid"
        onSubmit={async (event) => {
          event.preventDefault();
          setBusy(true);
          setMessage('');
          try {
            await api(`/v1/admin/users/${user.id}`, z.object({ updated: z.boolean() }), {
              method: 'PATCH',
              body: JSON.stringify({ role, departmentId: department, banned }),
            });
            setMessage('success');
            await client.invalidateQueries({ queryKey: ['legal'] });
          } catch {
            setMessage('error');
          } finally {
            setBusy(false);
          }
        }}
      >
        <p>{user.email}</p>
        <CaseField label={t('role')}>
          <PaperSelect
            label={t('role')}
            value={role}
            options={['USER', 'HEAD', 'PROSECUTOR', 'ADMIN', 'AUDITOR'].map((value) => ({
              value,
              label: t(value),
            }))}
            onChange={setRole}
          />
        </CaseField>
        <CaseField label={t('department')}>
          <PaperSelect
            label={t('department')}
            value={department}
            options={meta.departments.map((d) => ({ value: d.id, label: d.name }))}
            onChange={setDepartment}
          />
        </CaseField>
        <label>
          <input
            type="checkbox"
            checked={banned}
            onChange={(event) => setBanned(event.target.checked)}
          />
          {t('ban')}
        </label>
        <button className="case-button" disabled={busy}>
          {t('save')}
        </button>
        {message && <p role="status">{t(message)}</p>}
      </form>
    </details>
  );
}
export function CaseAudit() {
  const { t, meta } = useCaseUi();
  const [page, setPage] = useState(1);
  const query = useQuery({
    queryKey: ['legal', 'audit', page],
    queryFn: () => api(`/v1/audit?page=${page}`, auditListSchema),
    enabled: ['ADMIN', 'AUDITOR'].includes(meta.user.role),
  });
  if (!['ADMIN', 'AUDITOR'].includes(meta.user.role))
    return <p className="case-paper">{t('permission')}</p>;
  if (query.isPending) return <CasePending />;
  if (query.isError) return <CasePending error retry={() => void query.refetch()} />;
  return (
    <div className="case-paper">
      <h2>{t('audit')}</h2>
      <div className="case-table-scroll">
        <table>
          <caption>{t('audit')}</caption>
          <thead>
            <tr>
              <th scope="col">{t('time')}</th>
              <th scope="col">{t('actor')}</th>
              <th scope="col">{t('actionLabel')}</th>
              <th scope="col">{t('request')}</th>
            </tr>
          </thead>
          <tbody>
            {query.data.items.map((row) => (
              <tr key={row.id}>
                <td>{new Date(row.createdAt).toLocaleString()}</td>
                <td>{row.actorId ?? '—'}</td>
                <td>{row.action}</td>
                <td>{row.requestId}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {query.data.items.length === 0 && <p>{t('noAudit')}</p>}
      <CasePager page={page} total={query.data.total} size={50} onChange={setPage} />
    </div>
  );
}
