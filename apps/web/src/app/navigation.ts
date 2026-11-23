import {
  LayoutDashboard,
  FolderSearch,
  Radio,
  Scale,
  Gavel,
  ChartNoAxesCombined,
  UserRound,
  ShieldCheck,
} from 'lucide-react';
export const navigation = [
  { path: '/board', label: 'Tergov doskasi', icon: LayoutDashboard, short: 'Doska' },
  { path: '/investigation-room', label: 'Tergov xonasi', icon: FolderSearch, short: 'Tergov' },
  { path: '/control-room', label: 'Nazorat zali', icon: Radio, short: 'Nazorat' },
  { path: '/defense-room', label: 'Himoya xonasi', icon: Scale, short: 'Himoya' },
  { path: '/judgment-hall', label: 'Hukm zali', icon: Gavel, short: 'Hukm' },
  { path: '/statistics', label: 'Statistika', icon: ChartNoAxesCombined, short: 'Statistika' },
];
export const personalNavigation = [
  { path: '/profile', label: 'Shaxsiy profil', icon: UserRound, short: 'Profil' },
  { path: '/admin', label: 'Ishlarni boshqarish', icon: ShieldCheck, short: 'Boshqaruv' },
];
