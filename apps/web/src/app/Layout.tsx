import { Suspense, useEffect } from 'react';
import { Link, useLocation, useNavigate, useOutlet, useOutletContext } from 'react-router-dom';
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion';
import type { Workspace } from '@detective/shared';
import { useMe, useWorkspace } from '../shared/api/queries';
import { ErrorState, Loading } from '../shared/ui/primitives';
import { useQuietMotion } from '../shared/lib/motion';
import { useUi } from './store';
import { SceneBackdrop, sceneForPath } from '../shared/scene/SceneBackdrop';
import { CaseDialog } from '../features/cases/CaseDialog';
import { RankCelebration } from '../features/board/RankCelebration';
export const useBoard = () => useOutletContext<Workspace>();
function WorkArea() {
  const workspace = useWorkspace();
  const { pathname, search } = useLocation();
  const outlet = useOutlet(workspace.data);
  const quiet = useQuietMotion();
  useEffect(() => {
    document.documentElement.dataset['motion'] = quiet ? 'reduce' : 'auto';
  }, [pathname, quiet]);
  useEffect(() => {
    if (workspace.isPending) return;
    const requested = new URLSearchParams(search).get('case');
    const valid =
      pathname === '/investigation-room' &&
      workspace.data?.cases.some((entry) => entry.id === requested);
    useUi.getState().selectCase(valid ? requested : null);
  }, [pathname, search, workspace.isPending]);
  if (workspace.isPending) return <Loading full />;
  if (workspace.isError)
    return (
      <ErrorState
        message={workspace.error.message}
        retry={() => {
          void workspace.refetch();
        }}
      />
    );
  return (
    <LayoutGroup id="detective-scenes">
      <div className="game-world">
        <AnimatePresence initial={false} mode="popLayout">
          <motion.main
            key={pathname}
            id="main-content"
            tabIndex={-1}
            className={`game-scene scene-${sceneForPath(pathname)}`}
            layoutId={`scene-${pathname}`}
            initial={quiet ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{
              duration: quiet ? 0 : 0.5,
              layout: { duration: quiet ? 0 : 0.65, ease: [0.22, 1, 0.36, 1] },
            }}
          >
            <SceneBackdrop scene={sceneForPath(pathname)} />
            {pathname !== '/board' && (
              <Link to="/board" className="back-dossier" aria-label="Tergov doskasiga qaytish">
                <span className="wax-seal">T</span>
                <span>Doska</span>
                <kbd>Esc</kbd>
              </Link>
            )}
            <Suspense fallback={<Loading />}>{outlet}</Suspense>
          </motion.main>
        </AnimatePresence>
        <CaseDialog data={workspace.data} />
        <RankCelebration />
      </div>
    </LayoutGroup>
  );
}
export function Protected() {
  const me = useMe();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  useEffect(() => {
    if (me.isError && 'status' in me.error && me.error.status === 401)
      navigate('/login', { replace: true });
  }, [me.isError, me.error, navigate]);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (
        event.key === 'Escape' &&
        pathname !== '/board' &&
        !useUi.getState().selectedCase &&
        !document.querySelector('[role="dialog"], [role="listbox"]')
      )
        navigate('/board');
    };
    window.addEventListener('keydown', escape, true);
    return () => window.removeEventListener('keydown', escape, true);
  }, [pathname, navigate]);
  if (me.isPending) return <Loading full />;
  if (me.isError)
    return 'status' in me.error && me.error.status === 401 ? null : (
      <ErrorState
        message={me.error.message}
        retry={() => {
          void me.refetch();
        }}
      />
    );
  return <WorkArea />;
}
