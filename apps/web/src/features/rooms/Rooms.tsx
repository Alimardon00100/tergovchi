import { PaperSelect } from '../../shared/ui/PaperSelect';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useBoard } from '../../app/Layout';
import { CaseCard } from '../cases/CaseCard';
import { caseCode } from '../../shared/lib/presentation';
import { SceneHeading, PaperPager, useSmallScene } from '../../shared/scene/SceneObjects';
import { Empty } from '../../shared/ui/primitives';
type Room = 'investigation' | 'control' | 'defense' | 'judgment';
const copy = {
  investigation: {
    title: 'Tergov xonasi',
    eyebrow: 'OCHILMAGAN JINOYAT ISHLARI',
    description: 'Bir papkani tanlang. Birinchi izni toping.',
  },
  control: {
    title: 'Nazorat zali',
    eyebrow: 'JARAYONDAGI TERGOVLAR',
    description: 'Hech bir iz nazoratsiz qolmasin.',
  },
  defense: {
    title: 'Himoya xonasi',
    eyebrow: 'DALILLAR GAPIRSIN',
    description: 'Materiallarni solishtiring. Xulosani tekshiring.',
  },
  judgment: {
    title: 'Hukm zali',
    eyebrow: 'YAKUNLANGAN TERGOVLAR',
    description: 'Ochilgan sirlar. Saqlangan haqiqatlar.',
  },
};
export function Rooms({ room }: { room: Room }) {
  const data = useBoard();
  const [search, setSearch] = useState('');
  const [difficulty, setDifficulty] = useState('ALL');
  const [status, setStatus] = useState('ALL');
  const [page, setPage] = useState(0);
  const small = useSmallScene();
  const capacity = small ? 2 : 6;
  const entries = data.cases.filter(
    (entry) =>
      (room === 'investigation' ||
        (room === 'judgment'
          ? entry.progress?.status === 'CLOSED'
          : entry.progress?.status === 'IN_PROGRESS')) &&
      (difficulty === 'ALL' || entry.difficulty === difficulty) &&
      (status === 'ALL' ||
        (status === 'NEW' ? !entry.progress : entry.progress?.status === status)) &&
      `${entry.title} ${caseCode(entry)} ${entry.summary}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(entries.length / capacity));
  const current = Math.min(page, pages - 1);
  return (
    <div className={`room-stage room-stage--${room}`}>
      <SceneHeading {...copy[room]} />
      <form className="filter-slip paper" onSubmit={(event) => event.preventDefault()}>
        <span className="paperclip" aria-hidden="true" />
        <input
          aria-label="Xonadagi ishlarni qidirish"
          placeholder="Ish nomi yoki raqami..."
          value={search}
          onChange={(event) => {
            setSearch(event.target.value);
            setPage(0);
          }}
        />
        <PaperSelect
          label="Qiyinchilik bo‘yicha saralash"
          value={difficulty}
          onChange={(value) => {
            setDifficulty(value);
            setPage(0);
          }}
          options={[
            { value: 'ALL', label: small ? 'Darajalar' : 'Barcha darajalar' },
            { value: 'EASY', label: 'Oson' },
            { value: 'MEDIUM', label: 'O‘rta' },
            { value: 'HARD', label: 'Murakkab' },
          ]}
        />
        {room === 'investigation' && (
          <PaperSelect
            label="Holat bo‘yicha saralash"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setPage(0);
            }}
            options={[
              { value: 'ALL', label: small ? 'Holatlar' : 'Barcha holatlar' },
              { value: 'NEW', label: 'Boshlanmagan' },
              { value: 'IN_PROGRESS', label: 'Jarayonda' },
              { value: 'CLOSED', label: 'Yakunlangan' },
            ]}
          />
        )}
      </form>
      <div className="desk-folders">
        {entries.slice(current * capacity, (current + 1) * capacity).map((entry, index) => (
          <CaseCard key={entry.id} entry={entry} index={index} />
        ))}
        {!entries.length && (
          <Empty
            title={
              search || difficulty !== 'ALL' || status !== 'ALL'
                ? 'Mos ish topilmadi'
                : room === 'judgment'
                  ? 'Birinchi yakun hali oldinda'
                  : 'Bu yerda hozircha ish yo‘q'
            }
            action={
              <Link className="button button--secondary" to="/investigation-room">
                Tergov xonasiga o‘tish
              </Link>
            }
          >
            {search || difficulty !== 'ALL' || status !== 'ALL'
              ? 'Qidiruvni yoki filtrni o‘zgartiring.'
              : 'Tergov xonasidan ish boshlang. Natija shu yerda saqlanadi.'}
          </Empty>
        )}
      </div>
      <PaperPager page={current} total={pages} change={setPage} />
      <p className="room-count-note">
        {entries.length} ta ish ·{' '}
        {room === 'investigation'
          ? 'Birinchi ochishda ball beriladi.'
          : 'Shaxsiy tergov materiallaringiz.'}
      </p>
    </div>
  );
}
