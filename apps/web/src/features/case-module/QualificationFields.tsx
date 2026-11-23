import { useId } from 'react';
import {
  PARTICIPANT_ROLES,
  OBJECT_TYPES,
  CONSEQUENCES,
  MOTIVES,
  PURPOSES,
} from '@detective/shared';
import type { CasePersonView, PayloadMap, LegalElement } from '@detective/shared';
import { PaperSelect } from '../../shared/ui/PaperSelect';
import { useCaseUi, CaseField } from './CaseShell';
type Props = {
  element: LegalElement;
  payload: unknown;
  persons: CasePersonView[];
  subject: PayloadMap['SUBJECT'];
  eventDate: string;
  disabled: boolean;
  onChange: (payload: unknown) => void;
};
export function ageAt(birthDate: string, eventDate: string) {
  const b = new Date(birthDate),
    e = new Date(eventDate);
  return (
    e.getUTCFullYear() -
    b.getUTCFullYear() -
    (e.getUTCMonth() < b.getUTCMonth() ||
    (e.getUTCMonth() === b.getUTCMonth() && e.getUTCDate() < b.getUTCDate())
      ? 1
      : 0)
  );
}
export function QualificationFields({
  element,
  payload,
  persons,
  subject,
  eventDate,
  disabled,
  onChange,
}: Props) {
  const { t } = useCaseUi();
  const prefix = useId();
  const select = (
    key: string,
    value: string,
    values: readonly string[],
    change: (value: string) => void,
  ) => (
    <CaseField label={t(key)}>
      <PaperSelect
        label={t(key)}
        value={value || 'EMPTY'}
        options={[
          { value: 'EMPTY', label: t('select') },
          ...values.map((v) => ({ value: v, label: t(v) })),
        ]}
        onChange={(v) => {
          if (!disabled) change(v === 'EMPTY' ? '' : v);
        }}
      />
    </CaseField>
  );
  const notes = (value: string, change: (value: string) => void) => (
    <CaseField label={t('note')}>
      <textarea
        maxLength={2000}
        value={value}
        onChange={(e) => change(e.target.value)}
        disabled={disabled}
      />
      <small>{value.length}/2000</small>
    </CaseField>
  );
  if (element === 'SUBJECT') {
    const value = payload as PayloadMap['SUBJECT'];
    return (
      <fieldset disabled={disabled}>
        <legend>{t('SUBJECT')}</legend>
        {persons.length === 0 ? (
          <p>{t('noPersons')}</p>
        ) : (
          persons.map((p) => {
            const row = value.find((r) => r.personId === p.id),
              young = ageAt(p.birthDate, eventDate) < 16;
            return (
              <div className="case-subject-row" key={p.id}>
                <label>
                  <input
                    type="checkbox"
                    checked={!!row}
                    onChange={(e) =>
                      onChange(
                        e.target.checked
                          ? [...value, { personId: p.id, role: 'IJROCHI' }]
                          : value.filter((r) => r.personId !== p.id),
                      )
                    }
                  />
                  <span>
                    {p.fullName} <small>{t(p.role)}</small>
                  </span>
                </label>
                {row &&
                  select('participantType', row.role, PARTICIPANT_ROLES, (role) =>
                    onChange(value.map((r) => (r.personId === p.id ? { ...r, role } : r))),
                  )}
                {row && young && (
                  <p className="case-warning">
                    {t('under16')}{' '}
                    <a href="https://www.lex.uz/uz/acts/-111453" target="_blank" rel="noreferrer">
                      JK 17
                    </a>
                  </p>
                )}
              </div>
            );
          })
        )}
      </fieldset>
    );
  }
  if (element === 'PARTICIPATION') {
    const value = payload as PayloadMap['PARTICIPATION'];
    return (
      <fieldset disabled={disabled}>
        <legend>{t('PARTICIPATION')}</legend>
        {value.map((row, index) => (
          <div key={index} className="case-participation-row">
            {select('participantType', row.role, PARTICIPANT_ROLES, (role) =>
              onChange(value.map((r, i) => (i === index ? { ...r, role } : r))),
            )}
            <CaseField label={t('person')}>
              <PaperSelect
                label={`${t('person')} ${index + 1}`}
                value={row.personId || 'EMPTY'}
                options={[
                  { value: 'EMPTY', label: t('select') },
                  ...persons.map((p) => ({ value: p.id, label: p.fullName })),
                ]}
                onChange={(personId) => {
                  if (!disabled)
                    onChange(
                      value.map((r, i) =>
                        i === index ? { ...r, personId: personId === 'EMPTY' ? '' : personId } : r,
                      ),
                    );
                }}
              />
            </CaseField>
            <button
              className="case-button"
              type="button"
              onClick={() => onChange(value.filter((_, i) => i !== index))}
            >
              {t('remove')} {index + 1}
            </button>
            {row.personId &&
              (subject.some((s) => s.personId === row.personId) ||
                value.some((r, i) => i !== index && r.personId === row.personId)) && (
                <p className="case-warning">{t('duplicate')}</p>
              )}
          </div>
        ))}
        <button
          className="case-button"
          type="button"
          disabled={value.length >= 50}
          onClick={() => onChange([...value, { personId: '', role: '' }])}
        >
          + {t('addRow')}
        </button>
      </fieldset>
    );
  }
  if (element === 'OBJECT') {
    const value = payload as PayloadMap['OBJECT'];
    return (
      <fieldset disabled={disabled}>
        <legend>{t('OBJECT')}</legend>
        <div className="case-checkboxes">
          {OBJECT_TYPES.map((v) => (
            <label key={v} htmlFor={prefix + v}>
              <input
                id={prefix + v}
                type="checkbox"
                checked={value.includes(v)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...value, v] : value.filter((i) => i !== v))
                }
              />
              {t(v)}
            </label>
          ))}
        </div>
      </fieldset>
    );
  }
  if (element === 'OBJECTIVE') {
    const v = payload as PayloadMap['OBJECTIVE'];
    return (
      <fieldset disabled={disabled}>
        <legend>{t('OBJECTIVE')}</legend>
        {select('action', v.action, ['HARAKAT', 'HARAKATSIZLIK'], (action) =>
          onChange({ ...v, action }),
        )}
        <fieldset>
          <legend>{t('consequences')}</legend>
          <div className="case-checkboxes">
            {CONSEQUENCES.map((c) => (
              <label key={c}>
                <input
                  type="checkbox"
                  checked={v.consequences.includes(c)}
                  onChange={(e) =>
                    onChange({
                      ...v,
                      consequences: e.target.checked
                        ? [...v.consequences, c]
                        : v.consequences.filter((i) => i !== c),
                    })
                  }
                />
                {t(c)}
              </label>
            ))}
          </div>
        </fieldset>
        {select('causality', v.causality, ['MAVJUD', 'YOQ'], (causality) =>
          onChange({ ...v, causality }),
        )}
        {notes(v.note, (note) => onChange({ ...v, note }))}
      </fieldset>
    );
  }
  const v = payload as PayloadMap['SUBJECTIVE'];
  return (
    <fieldset disabled={disabled}>
      <legend>{t('SUBJECTIVE')}</legend>
      {select('guilt', v.guilt, ['QASDDAN', 'EHTIYOTSIZLIKDAN'], (guilt) =>
        onChange({ ...v, guilt, intent: guilt === 'QASDDAN' ? v.intent : '' }),
      )}
      {v.guilt === 'QASDDAN' &&
        select('intent', v.intent, ['TOGRI', 'EGRI'], (intent) => onChange({ ...v, intent }))}
      {select('motive', v.motive, MOTIVES, (motive) => onChange({ ...v, motive }))}
      {notes(v.motiveNote, (motiveNote) => onChange({ ...v, motiveNote }))}
      {select('purpose', v.purpose, PURPOSES, (purpose) => onChange({ ...v, purpose }))}
      {notes(v.purposeNote, (purposeNote) => onChange({ ...v, purposeNote }))}
    </fieldset>
  );
}
