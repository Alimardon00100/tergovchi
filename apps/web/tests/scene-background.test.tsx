import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { BACKGROUNDS, backgroundManifestSchema } from '@detective/shared';
import { SceneBackground } from '../src/shared/ui/SceneBackground';

describe('Vizual poydevor', () => {
  it('rasmsiz holatda buzilgan img va bo‘sh havola chiqarmaydi', () => {
    const html = renderToStaticMarkup(
      createElement(SceneBackground, { scene: 'auth', manifest: null, children: 'Kirish' }),
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('Kirish');
    expect(html).toContain('aria-hidden="true"');
  });
  it('olti sahnani yettita marshrutga biriktiradi', () => {
    expect(BACKGROUNDS).toHaveLength(6);
    expect(BACKGROUNDS.flatMap((background) => [...background.routes])).toHaveLength(7);
  });
  it('yetishmayotgan sahna va tashqi manbali rasm manifestini rad etadi', () => {
    expect(backgroundManifestSchema.safeParse({ version: 1, scenes: {} }).success).toBe(false);
    const variant = {
      src: 'https://example.test/unsafe.webp',
      width: 640,
      height: 360,
      bytes: 100,
    };
    const scenes = Object.fromEntries(BACKGROUNDS.map((background) => [background.id, [variant]]));
    expect(backgroundManifestSchema.safeParse({ version: 1, scenes }).success).toBe(false);
  });
  it('responsive WebP, o‘lcham va ustuvor yuklashni chiqaradi', () => {
    const scenes = Object.fromEntries(
      BACKGROUNDS.map((background) => [
        background.id,
        [
          {
            src: `/assets/backgrounds/${background.filename}-640.webp`,
            width: 640,
            height: 360,
            bytes: 100,
          },
        ],
      ]),
    );
    const manifest = backgroundManifestSchema.parse({ version: 1, scenes });
    const html = renderToStaticMarkup(
      createElement(SceneBackground, {
        scene: 'board',
        manifest,
        priority: true,
        children: 'Doska',
      }),
    );
    expect(html).toContain('srcSet="/assets/backgrounds/bg-board-main-640.webp 640w"');
    expect(html).toContain('loading="eager"');
    expect(html).toContain('alt=""');
    expect(html).toContain('width="640"');
  });
});
