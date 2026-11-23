import { useId } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { completeSchemas, ELEMENT_WEIGHTS } from '@detective/shared';
import type { LegalElement, PersonV2, PayloadMap } from '@detective/shared';
import { QualificationFields } from './QualificationFields';
import { useCaseUi } from './CaseShell';

export function OpeningQualificationSection({
  element,
  payload,
  persons,
  subject,
  eventDate,
  disabled,
  onChange,
}: {
  element: LegalElement;
  payload: unknown;
  persons: PersonV2[];
  subject: PayloadMap['SUBJECT'];
  eventDate: string;
  disabled: boolean;
  onChange: (value: unknown) => void;
}) {
  const { t } = useCaseUi(),
    errorId = useId();
  const schema = z.object({ payload: z.unknown() }).superRefine((value, context) => {
    if (!completeSchemas[element].safeParse(value.payload).success)
      context.addIssue({ code: 'custom', path: ['payload'], message: t('incomplete') });
  });
  const form = useForm<{ payload: unknown }>({
    resolver: zodResolver(schema),
    values: { payload },
    mode: 'onChange',
    resetOptions: { keepErrors: true },
  });
  const error = form.formState.errors.payload?.message;
  return (
    <details className="case-accordion" open>
      <summary>
        {t(element)}{' '}
        <span>
          {ELEMENT_WEIGHTS[element]} {t('score')}
        </span>
      </summary>
      <fieldset
        disabled={disabled}
        aria-describedby={error ? errorId : undefined}
        aria-invalid={!!error}
      >
        <legend className="sr-only">{t(element)}</legend>
        <Controller
          name="payload"
          control={form.control}
          render={({ field }) => (
            <QualificationFields
              element={element}
              payload={field.value}
              persons={persons}
              subject={subject}
              eventDate={eventDate}
              disabled={disabled}
              onChange={(value) => {
                field.onChange(value);
                onChange(value);
              }}
            />
          )}
        />
      </fieldset>
      {error && (
        <p className="opening-form-error" id={errorId} role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
