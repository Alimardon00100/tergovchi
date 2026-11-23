import { clearCaseDrafts } from '../case-module/local-drafts';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { z } from 'zod';
import { passwordChangeSchema, passwordChangedSchema } from '@detective/shared';
import { api } from '../../shared/api/client';
import { Button } from '../../shared/ui/primitives';
const schema = passwordChangeSchema
  .safeExtend({ confirmPassword: z.string().min(1, 'Yangi parolni takrorlang.') })
  .refine((value) => value.newPassword === value.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Yangi parol va takroriy parol mos emas.',
  });
type Values = z.infer<typeof schema>;
export function PasswordForm({
  onChanged,
  onBusyChange,
  beforeChange,
  formId,
}: {
  beforeChange?: () => Promise<boolean>;
  formId?: string;
  onChanged: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const client = useQueryClient();
  const navigate = useNavigate();
  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { oldPassword: '', newPassword: '', confirmPassword: '' },
  });
  const change = useMutation({
    mutationFn: async (values: Values) => {
      let identitySaved = false;
      try {
        identitySaved = (await beforeChange?.()) ?? false;
        return await api('/users/me/password', passwordChangedSchema, {
          method: 'PATCH',
          body: JSON.stringify({
            oldPassword: values.oldPassword,
            newPassword: values.newPassword,
          }),
        });
      } catch (error) {
        if (identitySaved)
          throw new Error(
            `Guvohnoma saqlandi. ${error instanceof Error ? error.message : 'Parolni qayta saqlang.'}`,
            { cause: error },
          );
        throw error;
      }
    },
    onSuccess: () => {
      form.reset();
      onChanged();
      clearCaseDrafts();
      client.clear();
      toast.success('Parol o‘zgartirildi. Yangi parol bilan kiring.');
      navigate('/login', { replace: true });
    },
    onError: (error) => form.setError('root', { message: error.message }),
  });
  useEffect(() => onBusyChange(change.isPending), [change.isPending, onBusyChange]);
  return (
    <form
      id={formId}
      className="profile-password-form"
      aria-label="Parolni almashtirish formasi"
      aria-busy={change.isPending}
      onSubmit={form.handleSubmit((values) => {
        form.clearErrors('root');
        change.mutate(values);
      })}
    >
      {(
        [
          { name: 'oldPassword', label: 'Amaldagi parol', autoComplete: 'current-password' },
          { name: 'newPassword', label: 'Yangi parol', autoComplete: 'new-password' },
          {
            name: 'confirmPassword',
            label: 'Yangi parolni takrorlang',
            autoComplete: 'new-password',
          },
        ] as const
      ).map((field) => (
        <label className="metal-paper-field" key={field.name}>
          {field.label}
          <input
            type="password"
            aria-label={field.label}
            autoComplete={field.autoComplete}
            aria-required="true"
            disabled={change.isPending}
            aria-invalid={!!form.formState.errors[field.name]}
            aria-describedby={`password-${field.name}-error`}
            {...form.register(field.name)}
          />
          <small id={`password-${field.name}-error`}>
            {form.formState.errors[field.name]?.message}
          </small>
        </label>
      ))}
      <p className="metal-password-hint">
        Kamida 12 belgi. Parol saqlangach, barcha qurilmalardagi sessiyalar yopiladi.
      </p>
      {form.formState.errors.root && (
        <p role="alert" className="metal-password-error">
          {form.formState.errors.root.message}
        </p>
      )}
      <Button className="metal-password-stamp" type="submit" busy={change.isPending}>
        {change.isPending ? 'Saqlanmoqda...' : 'Parolni saqlash'}
      </Button>
    </form>
  );
}
