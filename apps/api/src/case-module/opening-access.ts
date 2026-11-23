import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { CaseActor, FileRow } from './case.service';

export function assertDocumentOwner(actor: CaseActor, file: FileRow) {
  if (actor.role !== 'USER' || file.assignedTergovchiId !== actor.id)
    throw new ForbiddenException('Dalillar faqat ishni olgan tergovchiga ochiladi.');
  if (
    !file.lock ||
    file.lock.lockedBy !== actor.id ||
    file.lock.expiresAt <= new Date() ||
    ['CLOSED', 'SUSPENDED'].includes(file.status)
  )
    throw new ConflictException('Ishni qayta oling');
}
