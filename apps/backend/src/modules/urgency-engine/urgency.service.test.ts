import { computeUrgency } from './urgency.service';

const now = new Date('2026-07-01T10:00:00Z');
const h = (n: number) => new Date(now.getTime() + n * 60 * 60 * 1000);

test('< 3h → RED', () => expect(computeUrgency(h(2), now)).toBe('RED'));
test('exactly 3h → YELLOW', () => expect(computeUrgency(h(3), now)).toBe('YELLOW'));
test('3h to 8h → YELLOW', () => expect(computeUrgency(h(5), now)).toBe('YELLOW'));
test('exactly 8h → GREEN', () => expect(computeUrgency(h(8), now)).toBe('GREEN'));
test('> 8h → GREEN', () => expect(computeUrgency(h(12), now)).toBe('GREEN'));
test('past checkout → RED', () => expect(computeUrgency(h(-1), now)).toBe('RED'));
