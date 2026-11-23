import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { caseWorkspaceSchema, personsV2Schema } from '@detective/shared';
import { api } from '../../shared/api/client';
import { useCaseUi, CasePending, Deadline } from './CaseShell';
import { General, Results } from './CaseWorkspace';
import { OpeningTab, OpeningSkeleton } from './OpeningTab';
import { OpeningDocuments } from './OpeningDocuments';
import { OpeningPersons } from './OpeningPersons';
import { OpeningQualification } from './OpeningQualification';
import './opening-v2.css';

export function CaseWorkspaceV2() {
  const { id = '' } = useParams(),
    { t, meta } = useCaseUi();
  const [tab, setTab] = useState('general'),
    [visited, setVisited] = useState(['general']),
    [telemetryError, setTelemetryError] = useState(false),
    [now, setNow] = useState(Date.now);
  const query = useQuery({
    queryKey: ['case-opening-v2', 'workspace', id],
    queryFn: () => api(`/v2/cases/${id}/workspace`, caseWorkspaceSchema),
    refetchInterval: 10000,
  });
  const persons = useQuery({
    queryKey: ['case-opening-v2', 'persons', id],
    queryFn: () => api(`/v2/cases/${id}/persons`, personsV2Schema),
    enabled: !!query.data,
  });
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const ready = !!query.data;
  useEffect(() => {
    setVisited((current) => (current.includes(tab) ? current : [...current, tab]));
  }, [tab]);
  useEffect(() => {
    if (!ready) return;
    setTelemetryError(false);
    void api('/case-opening/events', z.unknown(), {
      method: 'POST',
      body: JSON.stringify({ caseId: id, tab }),
    }).catch(() => setTelemetryError(true));
  }, [id, tab, ready]);
  if (query.isPending) return <OpeningSkeleton />;
  if (query.isError) return <CasePending error retry={() => void query.refetch()} />;
  const workspace = query.data,
    owner =
      meta.user.role === 'USER' &&
      workspace.case.lock?.lockedBy === meta.user.id &&
      Date.parse(workspace.case.lock.expiresAt) > now;
  const tabs = [
    'general',
    'documents',
    'persons',
    'qualification',
    ...(workspace.attemptsUsed > 0 ? ['results'] : []),
  ];
  const people = (qualification: boolean) =>
    persons.isPending ? (
      <OpeningSkeleton />
    ) : persons.isError ? (
      <CasePending error retry={() => void persons.refetch()} />
    ) : !qualification ? (
      <OpeningPersons persons={persons.data} />
    ) : (
      <OpeningQualification
        key={id}
        workspace={workspace}
        persons={persons.data}
        onSubmitted={() => setTab('results')}
      />
    );
  return (
    <>
      <div className="case-paper case-workspace-heading">
        <Link to="/case-files">← {t('registry')}</Link>
        <span className="case-kicker">{workspace.case.caseNumber}</span>
        <h2>{workspace.case.title}</h2>
        <span className="case-stamp">{t(workspace.case.status)}</span>
        <Deadline date={workspace.case.deadlineAt} />
      </div>
      <div role="tablist" aria-label={t('cases')} className="case-tabs">
        {tabs.map((name, index) => (
          <button
            key={name}
            role="tab"
            id={'opening-tab-' + name}
            aria-controls={'opening-panel-' + name}
            aria-selected={name === tab}
            aria-label={t(name)}
            tabIndex={name === tab ? 0 : -1}
            onClick={() => setTab(name)}
            onKeyDown={(event) => {
              if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
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
                document.getElementById('opening-tab-' + target)?.focus();
              }
            }}
          >
            {t(name)}
          </button>
        ))}
      </div>
      {telemetryError && (
        <p className="case-paper case-warning" role="alert">
          {t('telemetryFailed')}
        </p>
      )}
      {tabs
        .filter((name) => name === tab || visited.includes(name))
        .map((name) => (
          <div
            key={name}
            role="tabpanel"
            hidden={name !== tab}
            id={'opening-panel-' + name}
            aria-labelledby={'opening-tab-' + name}
            tabIndex={0}
          >
            <OpeningTab key={id + ':' + name}>
              {name === 'general' && <General key={id} workspace={workspace} />}
              {name === 'documents' && <OpeningDocuments id={id} owner={owner} />}
              {name === 'persons' && people(false)}
              {name === 'qualification' &&
                (['USER', 'HEAD', 'PROSECUTOR'].includes(meta.user.role) ? (
                  people(true)
                ) : (
                  <p className="case-paper">{t('permission')}</p>
                ))}
              {name === 'results' && workspace.attemptsUsed > 0 && <Results id={id} />}
            </OpeningTab>
          </div>
        ))}
    </>
  );
}
