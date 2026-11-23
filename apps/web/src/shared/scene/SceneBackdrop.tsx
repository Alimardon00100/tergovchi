export type Scene = 'board' | 'desk' | 'control' | 'defense' | 'judgment' | 'vault';
export const SCENE_IMAGES: Readonly<Record<Scene, string>> = {
  board: '/scenes/board.webp',
  vault: '/scenes/control-v9.webp',
  desk: '/scenes/desk.webp',
  control: '/scenes/control-v9.webp',
  defense: '/scenes/defense-v9.webp',
  judgment: '/scenes/judgment-v9.webp',
};
export function sceneForPath(path: string): Scene {
  if (path === '/board') return 'board';
  if (path === '/profile') return 'vault';
  if (path === '/control-room') return 'control';
  if (path === '/defense-room') return 'defense';
  if (path === '/judgment-hall') return 'judgment';
  return 'desk';
}
export function SceneBackdrop({ scene, dark = false }: { scene: Scene; dark?: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        className={`scene-backdrop ${dark ? 'scene-backdrop--dark' : ''}`}
        style={{ backgroundImage: `url("${SCENE_IMAGES[scene]}")` }}
      />
      <div className="scene-vignette" aria-hidden="true" />
      <div className="film-grain" aria-hidden="true" />
    </>
  );
}
