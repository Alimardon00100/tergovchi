import { lazy, Suspense } from 'react';
import { useCaseUi } from './CaseShell';
import { OpeningSkeleton } from './OpeningTab';
const Legacy = lazy(() =>
  import('./CaseWorkspace').then((module) => ({ default: module.CaseWorkspacePage })),
);
const V2 = lazy(() =>
  import('./CaseWorkspaceV2').then((module) => ({ default: module.CaseWorkspaceV2 })),
);
export function CaseWorkspaceEntry() {
  const { v2 } = useCaseUi();
  return <Suspense fallback={<OpeningSkeleton />}>{v2 ? <V2 /> : <Legacy />}</Suspense>;
}
