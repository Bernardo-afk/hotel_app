import { CleaningJobStatus } from '@prisma/client';
import { AppError } from '../../errors/AppError';

const TRANSITIONS: Record<CleaningJobStatus, CleaningJobStatus[]> = {
  PENDING: ['ASSIGNED', 'CANCELLED', 'BLOCKED'],
  ASSIGNED: ['IN_PROGRESS', 'CANCELLED', 'PENDING'],
  IN_PROGRESS: ['PARTIAL', 'DONE', 'STAND_BY', 'CANCELLED'],
  PARTIAL: ['IN_PROGRESS', 'DONE', 'CANCELLED'],
  STAND_BY: ['IN_PROGRESS', 'CANCELLED'],
  BLOCKED: ['CANCELLED'],
  DONE: [],
  CANCELLED: [],
};

export function validateTransition(from: CleaningJobStatus, to: CleaningJobStatus): void {
  if (!TRANSITIONS[from].includes(to)) {
    throw new AppError(`Invalid transition ${from} → ${to}`, 422, 'INVALID_TRANSITION');
  }
}
