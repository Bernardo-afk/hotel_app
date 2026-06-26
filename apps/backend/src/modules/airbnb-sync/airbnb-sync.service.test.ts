import { parseIcal } from './ical.parser';
import * as ical from 'node-ical';

jest.mock('node-ical');

test('parseIcal maps VEVENT to ParsedEvent', async () => {
  (ical.async.fromURL as jest.Mock).mockResolvedValue({
    evt1: {
      type: 'VEVENT',
      uid: 'abc123',
      summary: 'Airbnb - Apt 101',
      dtstart: new Date('2026-07-01'),
      dtend: new Date('2026-07-05'),
    },
  });
  const events = await parseIcal('http://fake.url');
  expect(events).toHaveLength(1);
  expect(events[0].uid).toBe('abc123');
  expect(events[0].status).toBe('UPCOMING');
});
