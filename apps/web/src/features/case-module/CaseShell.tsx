import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { caseMetaSchema } from '@detective/shared';
import type { CaseMeta } from '@detective/shared';
import { api } from '../../shared/api/client';
import { PaperSelect } from '../../shared/ui/PaperSelect';
import { translate } from './i18n';
import type { CaseLocale } from './i18n';
import './case-module.css';
type Context = {
  locale: CaseLocale;
  theme: 'light' | 'dark';
  t: (key: string) => string;
  meta: CaseMeta;
};
const Context = createContext<Context | null>(null);
export function useCaseUi() {
  const value = useContext(Context);
  if (!value) throw Error('Missing case module context');
  return value;
}
const preference = (key: string, fallback: string) => {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};
export function CaseShell() {
  const [locale, setLocale] = useState<CaseLocale>(() => {
    const value = preference('case-locale', 'uz-Latn');
    return ['uz-Latn', 'uz-Cyrl', 'ru'].includes(value) ? (value as CaseLocale) : 'uz-Latn';
  });
  const [theme, setTheme] = useState<'light' | 'dark'>(() =>
    preference('case-theme', 'light') === 'dark' ? 'dark' : 'light',
  );
  const t = (key: string) => translate(locale, key);
  const meta = useQuery({
    queryKey: ['legal', 'meta'],
    queryFn: () => api('/v1/meta', caseMetaSchema),
    staleTime: 60000,
  });
  useEffect(() => {
    try {
      localStorage.setItem('case-locale', locale);
      localStorage.setItem('case-theme', theme);
    } catch {
      /* Preferences are optional. */
    }
  }, [locale, theme]);
  return (
    <section
      className={`case-module theme-${theme}`}
      lang={locale === 'ru' ? 'ru' : locale === 'uz-Cyrl' ? 'uz-Cyrl' : 'uz-Latn'}
    >
      <header className="case-nameplate">
        <span>{t('eyebrow')}</span>
        <h1>{t('registry')}</h1>
        <p>{t('subtitle')}</p>
      </header>
      <div className="case-toolbar case-paper">
        <nav aria-label={t('cases')}>
          <Link to="/case-files">{t('cases')}</Link>
          {meta.data?.user.role === 'ADMIN' && (
            <Link to="/case-files/admin">{t('administration')}</Link>
          )}
          {['ADMIN', 'AUDITOR'].includes(meta.data?.user.role ?? '') && (
            <Link to="/case-files/audit">{t('audit')}</Link>
          )}
        </nav>
        <div className="case-preferences">
          <PaperSelect
            label={t('language')}
            value={locale}
            options={[
              { value: 'uz-Latn', label: 'O‘zbekcha' },
              { value: 'uz-Cyrl', label: 'Ўзбекча' },
              { value: 'ru', label: 'Русский' },
            ]}
            onChange={(value) => setLocale(value as CaseLocale)}
          />
          <button
            className="case-button"
            aria-label={`${t('theme')}: ${t(theme === 'light' ? 'dark' : 'light')}`}
            onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          >
            {t(theme === 'light' ? 'dark' : 'light')}
          </button>
        </div>
      </div>
      {meta.isPending ? (
        <p className="case-paper" role="status">
          {t('loading')}
        </p>
      ) : meta.isError ? (
        <div className="case-paper" role="alert">
          <p>{t('error')}</p>
          <button className="case-button" onClick={() => void meta.refetch()}>
            {t('retry')}
          </button>
        </div>
      ) : (
        <Context.Provider value={{ locale, theme, t, meta: meta.data }}>
          <div className="case-actor case-paper">
            <span>{meta.data.user.displayName}</span>
            <span>
              {t(meta.data.user.role)} · {meta.data.department.name}
            </span>
          </div>
          <Outlet />
        </Context.Provider>
      )}
    </section>
  );
}
export function CasePending({
  error,
  retry,
}: {
  error?: boolean;
  retry?: (() => void) | undefined;
}) {
  const { t } = useCaseUi();
  return (
    <div className="case-paper" role={error ? 'alert' : 'status'}>
      <p>{t(error ? 'error' : 'loading')}</p>
      {retry && (
        <button className="case-button" onClick={retry}>
          {t('retry')}
        </button>
      )}
    </div>
  );
}
export function CasePager({
  page,
  total,
  size,
  onChange,
}: {
  page: number;
  total: number;
  size: number;
  onChange: (page: number) => void;
}) {
  const { t } = useCaseUi();
  return (
    <nav className="case-pagination" aria-label={t('page')}>
      <button className="case-button" disabled={page <= 1} onClick={() => onChange(page - 1)}>
        {t('previous')}
      </button>
      <span>
        {page} / {Math.max(1, Math.ceil(total / size))} · {t('total')} {total}
      </span>
      <button
        className="case-button"
        disabled={page * size >= total}
        onClick={() => onChange(page + 1)}
      >
        {t('next')}
      </button>
    </nav>
  );
}
export function CaseField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="case-field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function Deadline({ date }: { date: string }) {
  const { t, locale } = useCaseUi();
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(timer);
  }, []);
  const remaining = Math.max(0, Date.parse(date) - now);
  return (
    <span className={remaining ? 'case-deadline' : 'case-warning'}>
      <time dateTime={date}>
        {new Date(date).toLocaleString(locale === 'ru' ? 'ru-RU' : 'uz-UZ')}
      </time>
      <small>
        {remaining
          ? `${t('left')}: ${Math.floor(remaining / 86400000)} ${locale === 'ru' ? 'д.' : 'k.'} ${Math.floor(remaining / 3600000) % 24} ${locale === 'ru' ? 'ч.' : 's.'}`
          : t('expired')}
      </small>
    </span>
  );
}
