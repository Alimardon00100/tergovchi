import type { CaseView } from '@detective/shared';
export const difficultyLabels = { EASY: 'Oson', MEDIUM: 'O‘rta', HARD: 'Murakkab' } as const;
const portraits: Readonly<Record<string, string>> = {
  'songgi-maktub': '/suspects/letter.webp',
  'bekatdagi-jomadon': '/suspects/station.webp',
  'muzeydagi-soya': '/suspects/museum.webp',
  'yarim-tundagi-qongiroq': '/suspects/phone.webp',
  'yopiq-xona-siri': '/suspects/room.webp',
  'qizil-ip': '/suspects/thread.webp',
};
export const casePhoto = (slug: string, coverImageUrl?: string | null) =>
  coverImageUrl ?? portraits[slug] ?? '/photos/letter.webp';
export const caseCode = (entry: CaseView) =>
  `ISH-${new Date(entry.createdAt).getFullYear()}-${entry.id.slice(0, 4).toUpperCase()}`;
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
const months = [
  'yanvar',
  'fevral',
  'mart',
  'aprel',
  'may',
  'iyun',
  'iyul',
  'avgust',
  'sentabr',
  'oktabr',
  'noyabr',
  'dekabr',
];
const shortMonths = [
  'yan',
  'fev',
  'mar',
  'apr',
  'may',
  'iyn',
  'iyl',
  'avg',
  'sen',
  'okt',
  'noy',
  'dek',
];
// Some Chromium builds have no Uzbek month names in their Intl locale data.
export function formatDate(date: string | Date, compact = false) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tashkent',
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
  }).formatToParts(new Date(date));
  const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const month = Number(value('month')) - 1;
  const day = Number(value('day'));
  return compact ? `${day} ${shortMonths[month]}` : `${day}-${months[month]} ${value('year')}-yil`;
}
export const formatNumber = (value: number) => new Intl.NumberFormat('uz-UZ').format(value);
