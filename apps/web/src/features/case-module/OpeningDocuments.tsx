import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { documentsV2Schema } from '@detective/shared';
import { api, ApiError } from '../../shared/api/client';
import { PaperSelect } from '../../shared/ui/PaperSelect';
import { useCaseUi, CasePending } from './CaseShell';
import { OpeningSkeleton } from './OpeningTab';

export function OpeningDocuments({ id, owner }: { id: string; owner: boolean }) {
  const { t } = useCaseUi(),
    client = useQueryClient();
  const [type, setType] = useState('ALL'),
    [current, setCurrent] = useState<{ url: string; title: string; mime: string } | null>(null),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false);
  const query = useQuery({
    queryKey: ['case-opening-v2', 'documents', id],
    queryFn: () => api(`/v2/cases/${id}/documents`, documentsV2Schema),
    enabled: owner,
    staleTime: 60000,
  });
  useEffect(
    () => () => {
      if (current) URL.revokeObjectURL(current.url);
    },
    [current],
  );
  useEffect(() => {
    if (!owner) setCurrent(null);
  }, [owner]);
  if (!owner)
    return (
      <p className="case-paper" role="status">
        {t('ownerOnly')}
      </p>
    );
  if (query.isPending) return <OpeningSkeleton />;
  if (query.isError) return <CasePending error retry={() => void query.refetch()} />;
  const types = [...new Set(query.data.map((doc) => doc.type))];
  return (
    <div className="case-paper">
      <h2>{t('documents')}</h2>
      <PaperSelect
        label={t('documentType')}
        value={type}
        options={['ALL', ...types].map((value) => ({
          value,
          label: t(value === 'ALL' ? 'all' : value),
        }))}
        onChange={setType}
      />
      {query.data
        .filter((d) => type === 'ALL' || d.type === type)
        .map((doc) => (
          <article key={doc.id} className="case-document-row">
            <div>
              <h3>{doc.title}</h3>
              <p>
                {t(doc.type)}{' '}
                {doc.isEvidence && <span className="case-evidence">{t('evidence')}</span>}
              </p>
            </div>
            <button
              className="case-button"
              disabled={busy}
              aria-label={`${t('openDocument')}: ${doc.title}`}
              onClick={async () => {
                setBusy(true);
                setError('');
                try {
                  const documents = await query.refetch();
                  const fresh = documents.data?.find((d) => d.id === doc.id);
                  if (!fresh) throw Error('Document unavailable');
                  const response = await fetch(fresh.signedUrl, {
                    credentials: 'same-origin',
                    cache: 'no-store',
                  });
                  if (!response.ok) throw new ApiError('Document unavailable', response.status);
                  setCurrent({
                    url: URL.createObjectURL(await response.blob()),
                    title: doc.title,
                    mime: doc.mime,
                  });
                  await client.invalidateQueries({
                    queryKey: ['case-opening-v2', 'workspace', id],
                  });
                } catch (failure) {
                  setError(
                    failure instanceof ApiError && failure.status === 409
                      ? 'lockLost'
                      : 'documentFailed',
                  );
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
        <p role="alert" className="case-warning">
          {t(error)}
        </p>
      )}
      {current && (
        <div className="case-document-viewer">
          <h3>{current.title}</h3>
          <button className="case-button" aria-label={t('close')} onClick={() => setCurrent(null)}>
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
