import type { PersonV2 } from '@detective/shared';
import { useCaseUi } from './CaseShell';

export function OpeningPersons({ persons }: { persons: PersonV2[] }) {
  const { t } = useCaseUi();
  return (
    <div className="case-person-grid">
      {persons.map((person) => (
        <article key={person.id} className="case-person-sheet case-paper">
          {person.photoUrl && <img src={person.photoUrl} alt={person.fullName} />}
          <span className="case-kicker">{t(person.role)}</span>
          <h3>{person.fullName}</h3>
          <dl>
            {[
              ['birthDate', person.birthDate],
              ['gender', t(person.gender)],
              ['address', person.masked ? t('masked') : person.address],
              ['pinfl', person.pinfl],
              ['contact', person.masked && person.contact ? t('masked') : person.contact],
              ['personNote', person.masked && person.note ? t('masked') : person.note],
            ].map(([label, value]) => (
              <div key={label}>
                <dt>{t(label ?? '')}</dt>
                <dd>{value || '—'}</dd>
              </div>
            ))}
          </dl>
        </article>
      ))}
      {persons.length === 0 && <p className="case-paper">{t('noPersons')}</p>}
    </div>
  );
}
