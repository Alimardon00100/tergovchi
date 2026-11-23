import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, Fingerprint } from 'lucide-react';
import { publicUserSchema, emailSchema, passwordSchema } from '@detective/shared';
import { api } from '../../shared/api/client';
import { useMe } from '../../shared/api/queries';
import { Button } from '../../shared/ui/primitives';
import { SceneBackdrop } from '../../shared/scene/SceneBackdrop';
const formSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  displayName: z.string().trim().max(80, 'Ko‘pi bilan 80 belgi.').optional(),
});
type Form = z.infer<typeof formSchema>;
export function AuthPage({ register = false }: { register?: boolean }) {
  const me = useMe();
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();
  const client = useQueryClient();
  const form = useForm<Form>({
    resolver: zodResolver(formSchema),
    defaultValues: { email: '', password: '', displayName: '' },
  });
  const mutation = useMutation({
    mutationFn: (values: Form) =>
      api(register ? '/auth/register' : '/auth/login', publicUserSchema, {
        method: 'POST',
        body: JSON.stringify(
          register ? values : { email: values.email, password: values.password },
        ),
      }),
    onSuccess: (user) => {
      client.removeQueries({ queryKey: ['workspace'] });
      client.setQueryData(['me'], user);
      navigate('/board');
    },
  });
  if (me.data) return <Navigate to="/board" replace />;
  return (
    <main id="main-content" className="auth-scene game-scene">
      <SceneBackdrop scene="desk" dark />
      <div className="auth-title">
        <span>HAQIQAT IZIDAN</span>
        <h1>TERGOVCHI</h1>
        <p>Har bir izning ortida bir hikoya bor.</p>
      </div>
      <section className={`auth-paper paper ${register ? 'auth-paper--register' : ''}`}>
        <span className="paperclip" aria-hidden="true" />
        <div className="department-seal">
          <Fingerprint size={37} />
          <span>
            TERGOV
            <br />
            BO‘LIMI
          </span>
        </div>
        <span className="eyebrow">
          {register ? 'YANGI XIZMAT VARAQASI' : 'SHAXSIY ISHGA KIRISH'}
        </span>
        <h2>{register ? 'Safimizga qo‘shiling.' : 'Xush kelibsiz, tergovchi.'}</h2>
        <p className="auth-intro">
          {register
            ? 'Birinchi unvoningiz — Leytenant. Birinchi izingiz shu yerdan boshlanadi.'
            : 'Xizmat guvohnomangizni tasdiqlang. Doskada sizni ochilmagan sirlar kutmoqda.'}
        </p>
        <form
          onSubmit={form.handleSubmit((values) => {
            if (register && (!values.displayName || values.displayName.trim().length < 2)) {
              form.setError('displayName', { message: 'Ismingizni kiriting, kamida 2 belgi.' });
              return;
            }
            mutation.mutate(values);
          })}
          noValidate
        >
          {register && (
            <label className="form-field">
              Ism va familiya
              <input
                {...form.register('displayName')}
                autoComplete="name"
                placeholder="Ism va familiyangiz"
                aria-invalid={!!form.formState.errors.displayName}
              />
              <small className="field-error">{form.formState.errors.displayName?.message}</small>
            </label>
          )}
          <label className="form-field">
            Elektron pochta
            <input
              {...form.register('email')}
              type="email"
              autoComplete="email"
              placeholder="ism@example.com"
              aria-invalid={!!form.formState.errors.email}
            />
            <small className="field-error">{form.formState.errors.email?.message}</small>
          </label>
          <label className="form-field">
            Parol
            <span className="password-field">
              <input
                {...form.register('password')}
                type={visible ? 'text' : 'password'}
                autoComplete={register ? 'new-password' : 'current-password'}
                placeholder="Kamida 12 belgi"
                aria-invalid={!!form.formState.errors.password}
              />
              <button
                type="button"
                onClick={() => setVisible(!visible)}
                aria-label={visible ? 'Parolni yashirish' : 'Parolni ko‘rsatish'}
              >
                {visible ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
            <small className="field-error">{form.formState.errors.password?.message}</small>
          </label>
          {mutation.error && (
            <div className="form-error" role="alert">
              {mutation.error.message}
            </div>
          )}
          <Button type="submit" busy={mutation.isPending} className="auth-submit">
            {register ? 'Tergovchi bo‘lish' : 'Ish maydoniga kirish'}
          </Button>
        </form>
        <p className="auth-switch">
          {register ? 'Guvohnomangiz bormi?' : 'Xizmatga ilk bor keldingizmi?'}
          <Link to={register ? '/login' : '/register'}>
            {register ? 'Hisobga kirish' : 'Ro‘yxatdan o‘tish'}
          </Link>
        </p>
        <span className="auth-paper-foot">IMZO O‘RNIDA · SHAXSIY SESSIYA</span>
      </section>
      <span className="auth-quote">“Haqiqat tafsilotlarda yashirin.”</span>
    </main>
  );
}
