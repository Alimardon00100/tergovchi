import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { LoaderCircle, Fingerprint, RefreshCw, SearchX } from 'lucide-react';
import { clsx } from 'clsx';

export function Button({
  children,
  className,
  variant = 'primary',
  busy = false,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={props.disabled || busy}
      className={clsx('button', `button--${variant}`, className)}
    >
      {busy && <LoaderCircle size={17} className="spin" />}
      {children}
    </button>
  );
}
export function Brand({ small = false }: { small?: boolean }) {
  return (
    <div className={clsx('brand', small && 'brand--small')}>
      <div className="brand-seal">
        <Fingerprint size={small ? 25 : 31} strokeWidth={1.3} />
      </div>
      <div>
        <span>TERGOVCHI</span>
        <small>HAQIQAT IZIDAN</small>
      </div>
    </div>
  );
}
export function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
export function Empty({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <div className="empty-icon">
        <SearchX size={28} strokeWidth={1.3} />
      </div>
      <h3>{title}</h3>
      <p>{children}</p>
      {action}
    </div>
  );
}
export function Loading({ full = false }: { full?: boolean }) {
  return (
    <div className={clsx('loading-state', full && 'loading-state--full')} role="status">
      <Fingerprint size={38} strokeWidth={1.2} />
      <span>Ish maydoni tayyorlanmoqda...</span>
      <LoaderCircle size={20} className="spin" />
    </div>
  );
}
export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return (
    <div className="error-state" role="alert">
      <h2>Ulanishni tiklaymiz</h2>
      <p>{message}</p>
      <Button variant="secondary" onClick={retry}>
        <RefreshCw size={17} />
        Qayta urinish
      </Button>
    </div>
  );
}
