import ical from 'node-ical';

export interface ParsedEvent {
  uid: string;
  summary: string;
  checkIn: Date;
  checkOut: Date;
  status: 'UPCOMING' | 'CANCELLED';
}

export async function parseIcal(url: string): Promise<ParsedEvent[]> {
  const data = await ical.async.fromURL(url);
  return Object.values(data)
    .filter((e: any) => e.type === 'VEVENT')
    .map((e: any) => ({
      uid: e.uid,
      summary: e.summary ?? '',
      checkIn: new Date(e.dtstart),
      checkOut: new Date(e.dtend),
      status: (e.status === 'CANCELLED' ? 'CANCELLED' : 'UPCOMING') as ParsedEvent['status'],
    }));
}
