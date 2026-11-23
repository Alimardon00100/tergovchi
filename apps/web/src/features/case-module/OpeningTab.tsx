import { Component } from 'react';
import type { ReactNode } from 'react';
import { useCaseUi } from './CaseShell';

class Boundary extends Component<
  { children: ReactNode; message: string; retry: string },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    return this.state.failed ? (
      <div className="case-paper" role="alert">
        <p>{this.props.message}</p>
        <button
          className="case-button"
          aria-label={this.props.retry}
          onClick={() => this.setState({ failed: false })}
        >
          {this.props.retry}
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
export function OpeningTab({ children }: { children: ReactNode }) {
  const { t } = useCaseUi();
  return (
    <Boundary message={t('tabFailed')} retry={t('retry')}>
      {children}
    </Boundary>
  );
}
export function OpeningSkeleton() {
  const { t } = useCaseUi();
  return (
    <div className="case-paper opening-skeleton" role="status" aria-label={t('loading')}>
      <span>{t('loading')}</span>
      {[1, 2, 3].map((i) => (
        <div key={i} aria-hidden="true" />
      ))}
    </div>
  );
}
