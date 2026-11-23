import { z } from 'zod';

export const BACKGROUNDS = [
  {
    id: 'auth',
    filename: 'bg-auth',
    routes: ['/login', '/register'],
    title: 'Qabul xonasi',
    atmosphere: 'Film noir, stol, fedora va iliq chiroq nuri',
  },
  {
    id: 'board',
    filename: 'bg-board-main',
    routes: ['/board'],
    title: 'Tergov doskasi',
    atmosphere: 'Qizil iplar, mixlar va dalil suratlari',
  },
  {
    id: 'investigation',
    filename: 'bg-investigation',
    routes: ['/investigation-room'],
    title: 'Tergov xonasi',
    atmosphere: 'Sepiya suratlar, eski stol, lupa va chiroq',
  },
  {
    id: 'control',
    filename: 'bg-control',
    routes: ['/control-room'],
    title: 'Nazorat zali',
    atmosphere: 'Tartibli tahlil doskasi va noutbuk',
  },
  {
    id: 'defense',
    filename: 'bg-defense',
    routes: ['/defense-room'],
    title: 'Himoya xonasi',
    atmosphere: 'Yog‘och stol va qonun kitoblari',
  },
  {
    id: 'judgment',
    filename: 'bg-judgment',
    routes: ['/judgment-hall'],
    title: 'Hukm zali',
    atmosphere: 'Sud zali va keskin yorug‘lik',
  },
] as const;

export type SceneId = (typeof BACKGROUNDS)[number]['id'];

export const backgroundVariantSchema = z
  .object({
    src: z.string().regex(/^\/assets\/backgrounds\/bg-[a-z-]+-\d+\.webp$/),
    width: z.number().int().positive().max(1920),
    height: z.number().int().positive(),
    bytes: z.number().int().positive().max(600000),
  })
  .strict();
export const backgroundManifestSchema = z
  .object({
    version: z.literal(1),
    scenes: z
      .object({
        auth: z.array(backgroundVariantSchema).min(1),
        board: z.array(backgroundVariantSchema).min(1),
        investigation: z.array(backgroundVariantSchema).min(1),
        control: z.array(backgroundVariantSchema).min(1),
        defense: z.array(backgroundVariantSchema).min(1),
        judgment: z.array(backgroundVariantSchema).min(1),
      })
      .strict(),
  })
  .strict();

export type BackgroundManifest = z.infer<typeof backgroundManifestSchema>;
