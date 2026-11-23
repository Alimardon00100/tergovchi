import type { SafeCase } from '@detective/shared';
import { SafeEquipment } from './SafeEquipment';
import { SafeShelf } from './SafeShelf';
export function SafeShelves({
  opened,
  unopened,
  hidden,
  onViewAll,
}: {
  opened: SafeCase[];
  unopened: SafeCase[];
  hidden: boolean;
  onViewAll: () => void;
}) {
  return (
    <div className="metal-cabinet" aria-hidden={hidden}>
      <div className="metal-cabinet-skin" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <section className="metal-tool-shelf" aria-label="Maxsus vositalar">
        <h2>MAXSUS VOSITALAR</h2>
        <SafeEquipment />
      </section>
      <SafeShelf
        title="OCHILGAN ISHLAR"
        entries={opened.filter((entry) => entry.progress?.status === 'CLOSED')}
        opened
        onViewAll={onViewAll}
      />
      <SafeShelf
        title="OCHILMAGAN ISHLAR"
        entries={unopened}
        opened={false}
        onViewAll={onViewAll}
      />
    </div>
  );
}
