import { useState } from 'react';
import type { CaseWorkspace, PayloadMap, PersonV2 } from '@detective/shared';
import { CasePending, useCaseUi } from './CaseShell';
import { OpeningSkeleton } from './OpeningTab';
import { OpeningQualificationSection } from './OpeningQualificationSection';
import { useOpeningDraft } from './useOpeningDraft';

export function OpeningQualification({
  workspace,
  persons,
  onSubmitted,
}: {
  workspace: CaseWorkspace;
  persons: PersonV2[];
  onSubmitted: () => void;
}) {
  const { t } = useCaseUi(),
    draft = useOpeningDraft(workspace);
  const [episodeId, setEpisodeId] = useState(workspace.episodes[0]?.id ?? ''),
    [busy, setBusy] = useState(false);
  if (draft.query.isError) return <CasePending error retry={() => void draft.query.refetch()} />;
  if (!draft.rows) return <OpeningSkeleton />;
  const episode = workspace.episodes.find((item) => item.id === episodeId);
  const subject = (draft.rows.find(
    (row) => row.episodeId === episodeId && row.element === 'SUBJECT',
  )?.payload ?? []) as PayloadMap['SUBJECT'];
  return (
    <div className="case-paper case-qualification">
      <h2>{t('qualification')}</h2>
      <p>{t('independent')}</p>
      <p>
        {t('attempts')}: {workspace.attemptsUsed}/3
      </p>
      {!draft.canEdit && <p className="case-warning">{t('readOnly')}</p>}
      <div className="case-episode-picker">
        {workspace.episodes.map((item) => (
          <button
            className="case-button"
            key={item.id}
            aria-pressed={item.id === episodeId}
            onClick={() => setEpisodeId(item.id)}
          >
            {t('episode')} {item.episodeNumber}
          </button>
        ))}
      </div>
      {draft.rows
        .filter((row) => row.episodeId === episodeId)
        .map((row) => (
          <OpeningQualificationSection
            key={row.element}
            element={row.element}
            payload={row.payload}
            persons={persons}
            subject={subject}
            eventDate={episode?.dateTime ?? workspace.case.openedAt}
            disabled={busy || !draft.canEdit}
            onChange={(value) => draft.change(episodeId, row.element, value)}
          />
        ))}
      <div className="case-save-status" role="status" aria-live="polite">
        {t(draft.state)}
        {draft.warning && <p className="case-warning">{t(draft.warning)}</p>}
        {!workspace.referenceReady && <p>{t('noReference')}</p>}
      </div>
      {draft.error && (
        <p className="case-warning" role="alert">
          {t(draft.error)}
        </p>
      )}
      <div className="case-actions">
        <button
          className="case-button"
          disabled={busy || !draft.canEdit}
          onClick={() => void draft.flush().catch(() => undefined)}
          aria-label={t('sync')}
        >
          {t('sync')}
        </button>
        <button
          className="case-button case-stamp-button"
          disabled={busy || !draft.canEdit || !draft.valid || !workspace.referenceReady}
          title={!workspace.referenceReady ? t('noReference') : undefined}
          aria-label={t('submit')}
          onClick={async () => {
            setBusy(true);
            try {
              if (await draft.submit()) onSubmitted();
            } finally {
              setBusy(false);
            }
          }}
        >
          {t('submit')}
        </button>
      </div>
    </div>
  );
}
