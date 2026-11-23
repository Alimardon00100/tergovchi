import { useState } from 'react';
import type { ReactNode } from 'react';
import type { BackgroundManifest, SceneId } from '@detective/shared';

type SceneBackgroundProps = {
  scene: SceneId;
  manifest: BackgroundManifest | null;
  children: ReactNode;
  priority?: boolean;
};

export function SceneBackground({
  scene,
  manifest,
  children,
  priority = false,
}: SceneBackgroundProps) {
  const variants = manifest?.scenes[scene];
  const image = variants?.at(-1);
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const hasImage = image !== undefined && failedSource !== image.src;

  return (
    <div className="scene" data-scene={scene}>
      <div className="scene__background" aria-hidden="true">
        {hasImage && (
          <picture>
            <source
              type="image/webp"
              srcSet={variants?.map((variant) => `${variant.src} ${variant.width}w`).join(', ')}
              sizes="100vw"
            />
            <img
              src={image.src}
              width={image.width}
              height={image.height}
              alt=""
              loading={priority ? 'eager' : 'lazy'}
              {...{ fetchpriority: priority ? 'high' : 'auto' }}
              decoding="async"
              onError={() => {
                setFailedSource(image.src);
              }}
            />
          </picture>
        )}
      </div>
      <div className="scene__content">{children}</div>
    </div>
  );
}
