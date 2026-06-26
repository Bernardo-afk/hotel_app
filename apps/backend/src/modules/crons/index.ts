import { register as urgencyRecalc } from './urgency-recalc.job';
import { register as pendingTimeout } from './pending-timeout.job';
import { register as notificationFallback } from './notification-fallback.job';
import { register as dailyDigest } from './daily-digest.job';
import { register as propertyUnblock } from './property-unblock.job';
import { register as streakReset } from './streak-reset.job';
import { register as standbyTimeout } from './standby-timeout.job';

export function startCrons(): void {
  urgencyRecalc();
  pendingTimeout();
  notificationFallback();
  dailyDigest();
  propertyUnblock();
  streakReset();
  standbyTimeout();
  console.log('All cron jobs started');
}
