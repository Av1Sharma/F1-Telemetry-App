import type { Driver, Lap, Point, Session } from './telemetry';

export type RaceResult = { position: string; driver: string; team: string; grid: string | null; laps: number | null; result: string; points: number };
export type Race = { id: number; round: number; name: string; circuit: string; date: string; distance: number; results: RaceResult[] };
export type Archive = { version: string; years: number[]; source: string; license: string };
export type EventSession = { session_key: number; meeting_key: number; session_name: string; date_start: string; date_end: string; circuit_short_name: string; year: number };
export type ApiDriver = { driver_number: number; full_name: string; name_acronym: string; team_name: string };
export type ApiLap = { driver_number: number; lap_number: number; lap_duration: number | null; date_start: string | null; duration_sector_1: number | null; duration_sector_2: number | null; duration_sector_3: number | null; is_pit_out_lap: boolean };
export type CarSample = { date: string; speed: number; throttle: number; brake: number; n_gear: number; rpm: number };
export type Location = { date: string; x: number; y: number };

const memory = new Map<string, unknown>();
let queue: Promise<unknown> = Promise.resolve();
let nextRequest = 0;
const aborted = () => new DOMException('Cancelled', 'AbortError');
const pause = (ms: number, signal: AbortSignal) => new Promise<void>((resolve, reject) => {
  if (signal.aborted) return reject(aborted());
  const cancel = () => { clearTimeout(timer); reject(aborted()); };
  const timer = setTimeout(() => { signal.removeEventListener('abort', cancel); resolve(); }, ms);
  signal.addEventListener('abort', cancel, { once: true });
});

export async function localJSON<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(path, { signal });
  if (!response.ok) throw new Error('Could not load the archive. Try again.');
  return response.json();
}

export function api<T>(endpoint: string, params: Record<string, string | number>, signal: AbortSignal): Promise<T[]> {
  const url = `https://api.openf1.org/v1/${endpoint}?${new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]))}`;
  const task = queue.catch(() => {}).then(async () => {
    if (signal.aborted) throw aborted();
    if (memory.has(url)) return memory.get(url) as T[];
    await pause(Math.max(0, nextRequest - Date.now()), signal);
    nextRequest = Date.now() + 2100; // Free historical quota: under 30 requests/minute.
    const timeout = new AbortController();
    const cancel = () => timeout.abort();
    signal.addEventListener('abort', cancel, { once: true });
    const timer = setTimeout(cancel, 25000);
    try {
      const response = await fetch(url, { signal: timeout.signal });
      if (response.status === 404) return [];
      if (response.status === 429) throw new Error('OpenF1 is busy. Retry in a minute.');
      if (response.status === 401 || response.status === 403) throw new Error('This session is not public yet. Try after it finishes.');
      if (!response.ok) throw new Error(`OpenF1 could not load this data (${response.status}).`);
      const data: unknown = await response.json();
      if (!Array.isArray(data)) throw new Error('Unexpected response from OpenF1.');
      memory.set(url, data);
      // Bound memory when exploring many sessions.
      if (memory.size > 80) memory.delete(memory.keys().next().value!);
      return data as T[];
    } catch (error) {
      if (signal.aborted) throw aborted();
      if (timeout.signal.aborted) throw new Error('OpenF1 took too long. Retry or choose another session.');
      if (error instanceof TypeError) throw new Error('Cannot reach OpenF1. Check your connection and retry.');
      throw error;
    } finally { clearTimeout(timer); signal.removeEventListener('abort', cancel); }
  });
  queue = task;
  return task;
}

export function sessionsForRace(sessions: EventSession[], race: Race): EventSession[] {
  const raceDay = Date.parse(race.date);
  const closest = sessions.filter(s => s.session_name === 'Race')
    .map(s => ({ s, distance: Math.abs(Date.parse(s.date_start) - raceDay) }))
    .filter(s => s.distance < 48 * 3600 * 1000).sort((a, b) => a.distance - b.distance)[0];
  return closest ? sessions.filter(s => s.meeting_key === closest.s.meeting_key)
    .sort((a, b) => a.date_start.localeCompare(b.date_start)) : [];
}

export function sessionMetadata(event: EventSession, race: Race, drivers: ApiDriver[], laps: ApiLap[]): Session {
  const available: Driver[] = drivers.map(d => ({
    number: d.driver_number, name: d.full_name, code: d.name_acronym || String(d.driver_number), team: d.team_name || '',
    laps: laps.filter(l => l.driver_number === d.driver_number && l.date_start && Number.isFinite(l.lap_duration) && l.lap_duration! > 0)
      .sort((a, b) => a.lap_number - b.lap_number).map(l => ({
        number: l.lap_number, time: l.lap_duration!, start: l.date_start!, outLap: l.is_pit_out_lap,
        sectors: [l.duration_sector_1, l.duration_sector_2, l.duration_sector_3], points: [],
      })),
  })).sort((a, b) => a.name.localeCompare(b.name));
  if (!available.some(d => d.laps.length)) throw new Error('No timed laps are available for this session.');
  return { title: race.circuit, year: event.year, session: event.session_name, sessionKey: event.session_key, source: 'https://openf1.org/', distance: race.distance, drivers: available };
}

export function fastestLap(driver: Driver): number {
  const valid = driver.laps.map((lap, i) => ({ lap, i })).filter(({ lap }) => !lap.outLap);
  return (valid.length ? valid : driver.laps.map((lap, i) => ({ lap, i }))).sort((a, b) => a.lap.time - b.lap.time)[0]?.i ?? 0;
}

export function prepareTelemetry(car: CarSample[], location: Location[], lap: Lap, distance: number): Lap {
  const start = Date.parse(lap.start!);
  if (!Number.isFinite(start) || !Number.isFinite(distance) || distance <= 0) throw new Error('Invalid lap metadata.');
  const samples = [...new Map(car.filter(p => Number.isFinite(Date.parse(p.date)) && [p.speed, p.throttle, p.rpm, p.n_gear, p.brake].every(Number.isFinite) && p.speed >= 0)
    .map(p => [Date.parse(p.date), p])).values()].sort((a, b) => Date.parse(a.date) - Date.parse(b.date))
    .filter(p => Date.parse(p.date) >= start && Date.parse(p.date) <= start + lap.time * 1000);
  if (samples.length < 10 || Date.parse(samples[0].date) - start > 3000 || start + lap.time * 1000 - Date.parse(samples.at(-1)!.date) > 3000) {
    throw new Error('Telemetry is missing or incomplete for this lap. Choose another lap.');
  }
  const locations = location.filter(p => Number.isFinite(Date.parse(p.date)) && Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
  let meters = 0, previousTime = 0, previousSpeed = samples[0].speed, positionIndex = 0;
  const points: Point[] = samples.map(sample => {
    const timestamp = Date.parse(sample.date), t = (timestamp - start) / 1000;
    meters += (sample.speed + previousSpeed) / 7.2 * (t - previousTime);
    while (positionIndex + 1 < locations.length && Math.abs(Date.parse(locations[positionIndex + 1].date) - timestamp) <= Math.abs(Date.parse(locations[positionIndex].date) - timestamp)) positionIndex++;
    previousTime = t; previousSpeed = sample.speed;
    return { t, d: meters, speed: sample.speed, throttle: Math.min(100, Math.max(0, sample.throttle)), brake: Number(sample.brake > 0), gear: sample.n_gear, rpm: sample.rpm, x: locations[positionIndex]?.x ?? 0, y: locations[positionIndex]?.y ?? 0 };
  });
  const first = points[0].d, length = points.at(-1)!.d - first;
  if (length <= 0) throw new Error('This lap has no usable distance samples.');
  for (const point of points) point.d = (point.d - first) / length * distance;
  // Stopped samples can share distance: retain the last sample at each distance.
  return { ...lap, points: [...new Map(points.map(p => [p.d, p])).values()], hasLocation: locations.length > 1 };
}

export async function loadLap(session: Session, driver: Driver, lap: Lap, signal: AbortSignal): Promise<Lap> {
  if (lap.points.length) return lap;
  const start = new Date(lap.start!);
  const end = new Date(start.getTime() + lap.time * 1000);
  const params = { session_key: session.sessionKey, driver_number: driver.number, 'date>': start.toISOString().replace('Z', ''), 'date<': end.toISOString().replace('Z', '') };
  const car = await api<CarSample>('car_data', params, signal);
  const positions = await api<Location>('location', params, signal);
  return prepareTelemetry(car, positions, lap, session.distance);
}
