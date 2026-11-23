import { useState } from 'react';
import type { SafeCase } from '@detective/shared';
import { SafeCaseFolder } from './SafeCaseFolder';
export function SafeShelf({
  title,
  entries,
  opened,
  onViewAll,
}: {
  title: string;
  entries: SafeCase[];
  opened: boolean;
  onViewAll: () => void;
}) {
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(entries.length / 2));
  const current = Math.min(page, pages - 1);
  return (
    <section
      className={`metal-case-shelf ${opened ? 'metal-opened' : 'metal-unopened'}`}
      aria-label={title}
    >
      <h2>
        {title}
        <small>{entries.length} ta ish</small>
      </h2>
      <div className="metal-folders">
        {entries.slice(current * 2, current * 2 + 2).map((entry, index) => (
          <SafeCaseFolder key={entry.id} entry={entry} index={index} />
        ))}
        {!entries.length && (
          <p className="metal-empty">
            {opened ? 'Yakunlangan ishlar shu yerda saqlanadi.' : 'Barcha ishlar boshlangan.'}
          </p>
        )}
      </div>
      <div className="metal-pagination" aria-label={`${title} varaqlash`}>
        <button type="button" disabled={!current} onClick={() => setPage(current - 1)}>
          Oldingi
        </button>
        <span>
          {current + 1}/{pages}
        </span>
        <button type="button" disabled={current + 1 >= pages} onClick={() => setPage(current + 1)}>
          Keyingi
        </button>
        <button
          type="button"
          className="shelf-all-button"
          onClick={onViewAll}
          aria-label={`${title}: Hammasi`}
        >
          Hammasi
        </button>
      </div>
    </section>
  );
}
