# Game scene assets

Created 2026-11-22 using the built-in image_gen tool. Final images were copied into the project and optimized to WebP with Sharp. Original generated PNGs remain in the tool output location. No API/CLI fallback was used. These newly generated backgrounds are not the missing original reference photographs.

| Scene        | Saved project path                     | CSS use                                                                           |
| ------------ | -------------------------------------- | --------------------------------------------------------------------------------- |
| Cork board   | `apps/web/public/scenes/board.webp`    | `/board`                                                                          |
| Noir desk    | `apps/web/public/scenes/desk.webp`     | `/login`, `/register`, `/investigation-room`, `/profile`, `/statistics`, `/admin` |
| Surveillance | `apps/web/public/scenes/control.webp`  | `/control-room`                                                                   |
| Legal study  | `apps/web/public/scenes/defense.webp`  | `/defense-room`                                                                   |
| Judge desk   | `apps/web/public/scenes/judgment.webp` | `/judgment-hall`                                                                  |

All plates leave space for live HTML/CSS/SVG paper objects. Lettering, pins, strings, folders and charts are rendered by the application. Board thumbnails use CSS crops focused on physical objects.

## Final prompt set

### board.webp

Use case: stylized-concept. Asset type: full-screen background plate for a polished point-and-click detective game, landscape 16:9. Primary request: a completely EMPTY richly textured warm brown cork investigation board inside a thick aged dark walnut wooden frame, nearly front-facing with subtle lens perspective, the cork board fills 90% of image, dim detective office visible only at outer edges, warm amber tungsten illumination from upper left, deep noir shadows at lower corners, tactile fine cork grain, subtly worn edges, cinematic photorealistic premium adventure-game environment. Keep the broad central cork area EMPTY for actual interactive paper objects to be overlaid by code. No papers, no photos, no strings, no pins, no UI, no text, no lettering, no watermark. Not a web mockup. Frame fully visible inside image.

### desk.webp

Use case: stylized-concept. Asset type: full-screen environment background for a point-and-click film-noir detective game, landscape 16:9. Primary request: an overhead view of an authentic 1940s detective's dark weathered walnut desk at night. Warm brass desk lamp glowing at upper left, vintage black rotary telephone at upper right, black fedora partly visible at lower left, old magnifying glass and fountain pen close to lower right edge, subtle scattered old blank documents only along outer edges, atmospheric smoke and shadow, beautifully realistic aged wood scratches, chiaroscuro light, sepia brown amber black palette, cinematic photography. The entire central 65 percent of the desk MUST be EMPTY bare wood for interactive case folders and a paper form. No UI, no text, no lettering, no logos, no watermarks. No modern devices. Full-screen game background, not a website screenshot.

### control.webp

Use case: stylized-concept. Asset type: cinematic 16:9 background plate for point-and-click detective adventure. A dark mid-century police surveillance room seen from slightly overhead toward a broad empty scratched wooden worktable occupying the central 70 percent. Vintage CRT surveillance monitors, reel-to-reel recorder and control switches along top edge in deep shadow, tiny amber phosphor screens, stacks of case files along extreme sides. Warm desk-lamp light across the EMPTY central tabletop reserved for code-rendered interactive papers. Rich brown, black, muted sepia, dusty photographic texture, realistic cinematic noir, no people, no text, no UI or web elements, no watermarks.

### defense.webp

Use case: stylized-concept. Asset type: cinematic 16:9 game background plate. A moody mid-century legal study for a detective point-and-click adventure: overhead view of an EMPTY dark oxblood leather writing blotter across a large scratched mahogany table, antique leather-bound law books and bronze balance scales positioned at extreme left and upper-right edges only, dim bookshelves beyond the rear edge, warm amber pool of lamplight, dust motes, deep noir shadows. Leave central 70 percent broad empty usable surface for code-rendered evidence papers. Luxurious worn leather, realistic paper and wood, sepia browns and black. No readable text, no UI, no people, no watermarks.

### judgment.webp

Use case: stylized-concept. Asset type: cinematic 16:9 game background. A mid-century empty courtroom judge's walnut desk viewed from overhead/front oblique angle for a noir point-and-click adventure. A wooden gavel and block at extreme upper right, a few closed legal books at far left, hint of dark court benches in the far background. The wide central 70 percent of the heavy worn wooden desktop must be EMPTY for interactive archived case files to be overlaid in code. Dramatic golden amber sidelight, deep sepia brown and black shadows, tactile realistic scratches, restrained cinematic film grain, no text, no logos, no people, no web UI, no watermark.

## Verified asset metadata

| File          | Dimensions | Bytes  | SHA-256                                                          |
| ------------- | ---------- | ------ | ---------------------------------------------------------------- |
| board.webp    | 1672x941   | 448464 | 28bcb6a490b80ec4aa04a32bd8076121ec58ae5d807d757e869d33c540f3ed2f |
| desk.webp     | 1672x941   | 235352 | 150c0049e019be1ab85044278548b48bc1cb7a89e4cbf421782051b044eea583 |
| control.webp  | 1672x941   | 253908 | 67ccd416b5cd9a48a6e966360b86be3975214270511ee322e689d1925d45f989 |
| defense.webp  | 1672x941   | 248674 | 2d5f1d0755e86abb01125c7fabc8d38ca167cd97acd7dd98e9ade48b42ed17bc |
| judgment.webp | 1672x941   | 233626 | 487268bdb945913e129c61d976fae62a3f695884dd9049e9130d23b922fd5f03 |

## Fictional case portraits

Six imaginary characters created with the same built-in image_gen tool. These are game illustrations, not photographs of real suspects. Saved files and exact prompts:

### apps/web/public/suspects/letter.webp

Use case: stylized-concept. Asset type: in-world vintage portrait photograph clipped to a fictional detective-game case folder. A single head-and-shoulders archival portrait of a fictional woman about 35, thoughtful expression, dark bob haircut, plain 1940s blouse. Entirely imaginary person, not based on any real individual. Front facing or very slight three-quarter turn, eyes visible, neutral unadorned dark studio wall, 1940s film-noir photography, sepia toned black-and-white silver-gelatin print with subtle film grain and gently worn edges. Realistic human proportions and expressive face. Vertical portrait 3:4 composition, face fully visible with comfortable headroom, chest included. No prison signs, no identification placards, no lettering, no text, no numbers, no watermarks, no UI, no objects covering face.

600x800, 55106 bytes, SHA-256: f8c7d4b607a08ae6b171e9c3d1eda5127e96b6908afcfe4f7e766e1ce288194b.

### apps/web/public/suspects/station.webp

Use case: stylized-concept. Asset type: in-world vintage portrait photograph clipped to a fictional detective-game case folder. A single head-and-shoulders archival portrait of a fictional man about 50, narrow moustache, worn railway worker jacket and open collar. Entirely imaginary person, not based on any real individual. Front facing or very slight three-quarter turn, eyes visible, neutral unadorned dark studio wall, 1940s film-noir photography, sepia toned black-and-white silver-gelatin print with subtle film grain and gently worn edges. Realistic human proportions and expressive face. Vertical portrait 3:4 composition, face fully visible with comfortable headroom, chest included. No prison signs, no identification placards, no lettering, no text, no numbers, no watermarks, no UI, no objects covering face.

600x800, 51110 bytes, SHA-256: 504d886f287eae69780b7800ecd1b47d937c4f44c53eb3e33860d4566ab7e338.

### apps/web/public/suspects/museum.webp

Use case: stylized-concept. Asset type: in-world vintage portrait photograph clipped to a fictional detective-game case folder. A single head-and-shoulders archival portrait of a fictional woman about 45, round spectacles, wavy pinned hair, dark restorer work coat. Entirely imaginary person, not based on any real individual. Front facing or very slight three-quarter turn, eyes visible, neutral unadorned dark studio wall, 1940s film-noir photography, sepia toned black-and-white silver-gelatin print with subtle film grain and gently worn edges. Realistic human proportions and expressive face. Vertical portrait 3:4 composition, face fully visible with comfortable headroom, chest included. No prison signs, no identification placards, no lettering, no text, no numbers, no watermarks, no UI, no objects covering face.

600x800, 47576 bytes, SHA-256: 66aeb6284c8c5615350285b1834c1ccef78874fbba913b63100c093d311d5994.

### apps/web/public/suspects/phone.webp

Use case: stylized-concept. Asset type: in-world vintage portrait photograph clipped to a fictional detective-game case folder. A single head-and-shoulders archival portrait of a fictional man about 30, short dark hair, plain suit jacket and loosened tie, reserved expression. Entirely imaginary person, not based on any real individual. Front facing or very slight three-quarter turn, eyes visible, neutral unadorned dark studio wall, 1940s film-noir photography, sepia toned black-and-white silver-gelatin print with subtle film grain and gently worn edges. Realistic human proportions and expressive face. Vertical portrait 3:4 composition, face fully visible with comfortable headroom, chest included. No prison signs, no identification placards, no lettering, no text, no numbers, no watermarks, no UI, no objects covering face.

600x800, 60534 bytes, SHA-256: bf71bd92bbe903181f0bcb486490e30cc77a509dcdc9ef373e84c6c026e3487c.

### apps/web/public/suspects/room.webp

Use case: stylized-concept. Asset type: in-world vintage portrait photograph clipped to a fictional detective-game case folder. A single head-and-shoulders archival portrait of a fictional older man about 62, greying hair, thin spectacles, simple waistcoat over a light shirt. Entirely imaginary person, not based on any real individual. Front facing or very slight three-quarter turn, eyes visible, neutral unadorned dark studio wall, 1940s film-noir photography, sepia toned black-and-white silver-gelatin print with subtle film grain and gently worn edges. Realistic human proportions and expressive face. Vertical portrait 3:4 composition, face fully visible with comfortable headroom, chest included. No prison signs, no identification placards, no lettering, no text, no numbers, no watermarks, no UI, no objects covering face.

600x800, 58772 bytes, SHA-256: 54383d0d77b6e620d08e2b51667f7b6d620836d731c3e87a32233819f79dd60e.

### apps/web/public/suspects/thread.webp

Use case: stylized-concept. Asset type: in-world vintage portrait photograph clipped to a fictional detective-game case folder. A single head-and-shoulders archival portrait of a fictional woman about 28, short wavy dark hair, dark coat, calm observant expression. Entirely imaginary person, not based on any real individual. Front facing or very slight three-quarter turn, eyes visible, neutral unadorned dark studio wall, 1940s film-noir photography, sepia toned black-and-white silver-gelatin print with subtle film grain and gently worn edges. Realistic human proportions and expressive face. Vertical portrait 3:4 composition, face fully visible with comfortable headroom, chest included. No prison signs, no identification placards, no lettering, no text, no numbers, no watermarks, no UI, no objects covering face.

600x800, 44316 bytes, SHA-256: 710f76055e915f26b7527eedc24e5ce997ac9aee87d4fbad698ce1b4a203884b.
