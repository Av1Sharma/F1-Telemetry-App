import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { atDistance, lapTime, csv, type Session, type Lap, type Point } from './telemetry';
import { api, localJSON, sessionsForRace, sessionMetadata, fastestLap, loadLap, type Archive, type Race, type EventSession, type ApiDriver, type ApiLap } from './data';
import './style.css';

const colors = ['#98cbb8', '#c2b4e3'];
const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Try again.';

function App() {
  const [archive, setArchive] = useState<Archive | null>(null);
  const [year, setYear] = useState(2024);
  const [races, setRaces] = useState<Race[]>([]);
  const [raceId, setRaceId] = useState(0);
  const [events, setEvents] = useState<EventSession[]>([]);
  const [sessionKey, setSessionKey] = useState(9586);
  const [catalogBusy, setCatalogBusy] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [eventError, setEventError] = useState('');
  const [eventBusy, setEventBusy] = useState(false);
  const [catalogRetry, setCatalogRetry] = useState(0);
  const [mode, setMode] = useState<'telemetry' | 'results'>('telemetry');
  const [data, setData] = useState<Session | null>(null);
  const [example, setExample] = useState(true);
  const [a, setA] = useState(0), [b, setB] = useState(2);
  const [la, setLa] = useState(0), [lb, setLb] = useState(0);
  const [laps, setLaps] = useState<[Lap, Lap] | null>(null);
  const [loading, setLoading] = useState(false), [traceBusy, setTraceBusy] = useState(false);
  const [error, setError] = useState(''), [traceRetry, setTraceRetry] = useState(0);
  const [distance, setDistance] = useState(0), [playing, setPlaying] = useState(false), [rate, setRate] = useState(2);
  const [channel, setChannel] = useState<'speed' | 'throttle' | 'brake'>('speed');
  const loader = useRef<AbortController | null>(null);
  const initial = useRef(true);
  const race = races.find(r => r.id === raceId);
  const sessions = race ? sessionsForRace(events, race) : [];
  const selectedSession = sessions.find(s => s.session_key === sessionKey);

  useEffect(() => {
    const controller = new AbortController();
    localJSON<Archive>('./archive/index.json', controller.signal).then(setArchive).catch(e => { if (!isAbort(e)) setCatalogError(message(e)); });
    localJSON<Session>('./monza-2024.json', controller.signal).then(snapshot => {
      if (initial.current) setData(snapshot);
    }).catch(e => { if (!isAbort(e)) setError(message(e)); });
    return () => controller.abort();
  }, [catalogRetry]);

  useEffect(() => {
    const controller = new AbortController();
    setCatalogBusy(true); setCatalogError('');
    localJSON<Race[]>(`./archive/${year}.json`, controller.signal).then(rows => {
      setRaces(rows);
      const selected = year === 2024 ? rows.find(r => /monza/i.test(r.circuit)) : rows.filter(r => r.results.length).at(-1);
      setRaceId(current => rows.some(r => r.id === current) ? current : (selected ?? rows[0])?.id ?? 0);
    }).catch(e => { if (!isAbort(e)) setCatalogError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setCatalogBusy(false); });
    return () => controller.abort();
  }, [year, catalogRetry]);

  useEffect(() => {
    if (year < 2023) { setEventBusy(false); return; }
    const controller = new AbortController();
    setEventError(''); setEventBusy(true);
    api<EventSession>('sessions', { year }, controller.signal).then(setEvents)
      .catch(e => { if (!isAbort(e)) setEventError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setEventBusy(false); });
    return () => controller.abort();
  }, [year, catalogRetry]);

  useEffect(() => {
    setSessionKey(current => sessions.some(s => s.session_key === current) ? current :
      (sessions.find(s => s.session_name === 'Qualifying') ?? sessions.at(-1))?.session_key ?? 0);
  }, [events, raceId]);

  useEffect(() => {
    if (!data || !data.drivers[a]?.laps[la] || !data.drivers[b]?.laps[lb]) return;
    const controller = new AbortController();
    setTraceBusy(true); setLaps(null); setError(''); setPlaying(false); setDistance(0);
    Promise.all([loadLap(data, data.drivers[a], data.drivers[a].laps[la], controller.signal),
      loadLap(data, data.drivers[b], data.drivers[b].laps[lb], controller.signal)])
      .then(result => { if (!controller.signal.aborted) setLaps(result); })
      .catch(e => { if (!isAbort(e)) setError(message(e)); })
      .finally(() => { if (!controller.signal.aborted) setTraceBusy(false); });
    return () => controller.abort();
  }, [data, a, b, la, lb, traceRetry]);

  useEffect(() => {
    if (!playing || !data || !laps) return;
    let last = performance.now();
    const timer = setInterval(() => {
      const now = performance.now(), dt = Math.min((now - last) / 1000, .25); last = now;
      setDistance(d => Math.min(data.distance, d + dt * atDistance(laps[0].points, d).speed / 3.6 * rate));
    }, 40);
    return () => clearInterval(timer);
  }, [playing, data, laps, rate]);
  useEffect(() => { if (data && distance >= data.distance) setPlaying(false); }, [distance, data]);
  useEffect(() => () => loader.current?.abort(), []);

  function clearComparison() {
    initial.current = false; loader.current?.abort(); setLoading(false); setData(null); setLaps(null); setError(''); setPlaying(false); setTraceBusy(false);
  }
  async function loadSession() {
    if (!race || !selectedSession) return;
    clearComparison();
    const controller = new AbortController(); loader.current = controller;
    setLoading(true);
    try {
      const drivers = await api<ApiDriver>('drivers', { session_key: sessionKey }, controller.signal);
      const rows = await api<ApiLap>('laps', { session_key: sessionKey }, controller.signal);
      const next = sessionMetadata(selectedSession, race, drivers, rows);
      const choices = next.drivers.map((driver, i) => ({ driver, i })).filter(d => d.driver.laps.length)
        .sort((x, y) => x.driver.laps[fastestLap(x.driver)].time - y.driver.laps[fastestLap(y.driver)].time);
      if (controller.signal.aborted) return;
      const first = choices[0], second = choices[1] ?? first;
      setA(first.i); setB(second.i); setLa(fastestLap(first.driver)); setLb(fastestLap(second.driver)); setExample(false); setData(next);
    } catch (e) { if (!isAbort(e)) setError(message(e)); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }
  function chooseDriver(side: number, value: number) {
    if (!data) return;
    const index = fastestLap(data.drivers[value]);
    if (side === 0) { setA(value); setLa(index); } else { setB(value); setLb(index); }
  }
  function exportCSV() {
    if (!laps || !data) return;
    const url = URL.createObjectURL(new Blob([csv(laps[0])], { type: 'text/csv' }));
    const link = document.createElement('a'); link.href = url;
    link.download = `${data.title}-${data.year}-${data.session}-${data.drivers[a].code}-lap-${laps[0].number}.csv`;
    link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function openExample() {
    clearComparison(); setYear(2024); setRaceId(0); setSessionKey(9586); setEvents([]); setMode('telemetry'); setCatalogRetry(n => n + 1);
    const controller = new AbortController(); loader.current = controller;
    try {
      const snapshot = await localJSON<Session>('./monza-2024.json', controller.signal);
      if (controller.signal.aborted) return;
      setA(0); setB(2); setLa(0); setLb(0); setExample(true); setData(snapshot);
    } catch (e) { if (!isAbort(e)) setError(message(e)); }
  }
  const da = data?.drivers[a], db = data?.drivers[b];
  const pa = laps ? atDistance(laps[0].points, distance) : null, pb = laps ? atDistance(laps[1].points, distance) : null;
  const gap = laps ? laps[1].time - laps[0].time : 0;
  const unavailable = selectedSession && Date.parse(selectedSession.date_end) + 30 * 60 * 1000 > Date.now();

  return <>
    <header><a className="brand" href="./">Lap Lab</a><nav><button className="text-button" onClick={openExample}>Example</button><a href="/projects/f1.html">About</a></nav></header>
    <main>
      <section className="event-picker" aria-label="Event selection">
        <label>Year<select value={year} onChange={e => { clearComparison(); setYear(+e.target.value); setRaces([]); setEvents([]); setRaceId(0); setSessionKey(0); if (+e.target.value < 2023) setMode('results'); }}>
          {(archive?.years ?? [2024]).map(y => <option key={y} value={y}>{y}</option>)}
        </select></label>
        <label className="race-picker">Race<select value={raceId} disabled={catalogBusy || !races.length} onChange={e => { clearComparison(); setRaceId(+e.target.value); setSessionKey(0); }}>
          {!races.length && <option value="0">{catalogBusy ? 'Loading…' : 'No races'}</option>}
          {races.map(r => <option key={r.id} value={r.id}>{r.round}. {r.name}</option>)}
        </select></label>
        {mode === 'telemetry' && year >= 2023 && <><label>Session<select value={sessionKey} disabled={!sessions.length} onChange={e => { clearComparison(); setSessionKey(+e.target.value); }}>
          {!sessions.length && <option value="0">{eventBusy ? 'Loading…' : eventError ? 'Unavailable' : 'No sessions available'}</option>}
          {sessions.map(s => <option key={s.session_key} value={s.session_key}>{s.session_name}</option>)}
        </select></label><button className="primary" onClick={loadSession} disabled={loading || !selectedSession || !!unavailable}>{loading ? 'Loading…' : 'Load session'}</button></>}
      </section>
      {catalogError && <div className="notice" role="alert">{catalogError} <button onClick={() => setCatalogRetry(n => n + 1)}>Retry</button></div>}
      <div className="view-tabs"><button aria-pressed={mode === 'telemetry'} onClick={() => setMode('telemetry')}>Telemetry</button><button aria-pressed={mode === 'results'} onClick={() => { setMode('results'); setPlaying(false); }}>Race results</button></div>
      {mode === 'results' ? <section className="results-view">
        <div className="title-row"><h1>{race?.name ?? 'Race results'}</h1><span>{race?.date}</span></div>
        {race?.results.length ? <div className="table-scroll"><table><thead><tr><th scope="col">Pos.</th><th scope="col">Driver</th><th scope="col">Team</th><th scope="col">Grid</th><th scope="col">Laps</th><th scope="col">Time / status</th><th scope="col">Pts.</th></tr></thead><tbody>
          {race.results.map((r, i) => <tr key={i}><td>{r.position}</td><th scope="row">{r.driver}</th><td>{r.team}</td><td>{r.grid ?? '—'}</td><td>{r.laps ?? '—'}</td><td>{r.result}</td><td>{r.points ?? '—'}</td></tr>)}
        </tbody></table></div> : <p className="empty">{catalogBusy ? 'Loading races…' : 'Results are not available for this race yet.'}</p>}
      </section> : <>
        {year < 2023 ? <p className="empty">Telemetry starts in 2023. <button className="text-button" onClick={() => setMode('results')}>View {year} results</button></p> : <>
          {eventError && <div className="notice" role="alert">{eventError} <button onClick={() => setCatalogRetry(n => n + 1)}>Retry</button></div>}
          {unavailable && <p className="notice">Telemetry becomes public after the session finishes.</p>}
          {error && <div className="notice" role="alert">{error} <button onClick={() => data ? setTraceRetry(n => n + 1) : loadSession()}>Retry</button></div>}
          {data && da && db && <>
            <div className="title-row"><h1>{data.title}</h1><span>{data.year} · {data.session}{example ? ' · Example' : ''}</span></div>
            <section className="selector" aria-label="Lap comparison">
              {[da, db].map((driver, side) => <div className={`driver driver-${side}`} key={side}>
                <label>Driver {side === 0 ? 'A' : 'B'}<select value={side === 0 ? a : b} onChange={e => chooseDriver(side, +e.target.value)}>
                  {data.drivers.map((d, i) => <option key={d.number} value={i} disabled={!d.laps.length}>{d.name}{!d.laps.length ? ' · no timed laps' : ''}</option>)}
                </select></label>
                <label>Lap<select value={side === 0 ? la : lb} onChange={e => side === 0 ? setLa(+e.target.value) : setLb(+e.target.value)}>
                  {driver.laps.map((lap, i) => <option key={lap.number} value={i}>{lap.number} · {lapTime(lap.time)}{lap.outLap ? ' · out lap' : ''}</option>)}
                </select></label>
              </div>)}
            </section>
          </>}
          {(loading || traceBusy) && <p className="empty" role="status">{loading ? 'Loading drivers and laps…' : 'Loading telemetry…'}</p>}
          {!data && !loading && !error && <p className="empty">Choose a session to compare laps.</p>}
          {data && da && db && laps && pa && pb && <>
            <section className="metrics"><div><span>{da.code}</span><strong>{lapTime(laps[0].time)}</strong></div><div><span>{db.code}</span><strong>{lapTime(laps[1].time)}</strong></div><div><span>Difference</span><strong>{Math.abs(gap).toFixed(3)}<small> s</small></strong><p>{gap === 0 ? 'Equal' : `${gap > 0 ? da.code : db.code} faster`}</p></div></section>
            <div className="workspace"><section className="trace">
              <div className="panel-heading"><h2>Telemetry</h2><div className="tabs">{(['speed', 'throttle', 'brake'] as const).map(c => <button key={c} aria-pressed={channel === c} onClick={() => setChannel(c)}>{c}</button>)}</div></div>
              <div className="legend">{[pa, pb].map((point, i) => <span style={{ color: colors[i] }} key={i}>{i === 0 ? '━' : '┄'} {i === 0 ? da.code : db.code} <b>{channel === 'brake' ? point.brake ? 'On' : 'Off' : `${Math.round(point[channel])}${channel === 'speed' ? ' km/h' : '%'}`}</b></span>)}</div>
              <Chart laps={laps} channel={channel} distance={distance} total={data.distance} onSeek={d => { setDistance(d); setPlaying(false); }} />
              <div className="playback"><button className="primary" onClick={() => { if (distance >= data.distance) setDistance(0); setPlaying(!playing); }}>{playing ? 'Pause' : 'Play'}</button><button aria-label="Restart lap" onClick={() => { setDistance(0); setPlaying(false); }}>↺</button><label className="scrubber"><span>{Math.round(distance).toLocaleString()} m</span><input aria-label="Lap position" type="range" min="0" max={data.distance} value={distance} onChange={e => { setDistance(+e.target.value); setPlaying(false); }} /></label><select aria-label="Playback speed" value={rate} onChange={e => setRate(+e.target.value)}><option value="1">1×</option><option value="2">2×</option><option value="4">4×</option></select></div>
            </section><section className="map"><h2>Circuit</h2><Track lap={laps[0]} points={[pa, laps[1].hasLocation === false ? null : pb]} name={data.title} /><div className="readout"><span>{da.code}</span><span>Gear <b>{pa.gear}</b></span><span><b>{Math.round(pa.rpm).toLocaleString()}</b> rpm</span></div></section></div>
            <section className="sectors"><h2>Sectors</h2><div className="sector-grid">{[0, 1, 2].map(i => {
              const sa = laps[0].sectors[i], sb = laps[1].sectors[i], diff = sa != null && sb != null ? sb - sa : null;
              return <div key={i}><span>S{i + 1}</span><strong>{diff == null ? '—' : `${Math.abs(diff).toFixed(3)} s`}</strong><p>{diff == null ? 'Unavailable' : diff === 0 ? 'Equal' : `${diff > 0 ? da.code : db.code} faster`}</p><small>{da.code} {sa?.toFixed(3) ?? '—'} · {db.code} {sb?.toFixed(3) ?? '—'}</small></div>;
            })}</div></section>
            <button className="text-button export" onClick={exportCSV}>Export {da.code} CSV</button>
          </>}
        </>}
      </>}
      <footer><details><summary>Data &amp; coverage</summary><p>Historical telemetry from <a href="https://openf1.org/">OpenF1</a>, 2023 onward. Sessions load on demand and may have gaps. Live sessions require a paid feed and are not supported here. The example works without the API.</p><p>Distance is integrated from speed and normalized to circuit length. Position and traces are approximate; lap and sector times come from timing data. Recorded laps may include deleted times.</p><p>Race results: <a href="https://github.com/f1db/f1db">F1DB</a>, {archive?.version ?? ''}, <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a>. Fields simplified and grouped by season. Future results appear with archive updates.</p></details><a href="https://github.com/Av1Sharma/F1-Telemetry-App">Source</a></footer>
    </main>
  </>;
}

function Chart({ laps, channel, distance, total, onSeek }: { laps: Lap[]; channel: 'speed' | 'throttle' | 'brake'; distance: number; total: number; onSeek: (d: number) => void }) {
  const max = channel === 'speed' ? Math.max(360, ...laps.flatMap(l => l.points.map(p => p.speed))) : channel === 'throttle' ? 100 : 1;
  const x = (d: number) => 48 + d / total * 840, y = (v: number) => 218 - v / max * 180;
  return <svg className="chart" viewBox="0 0 910 255" role="img" aria-label={`${channel} by lap distance. Inspect values with the lap position slider.`} onPointerDown={e => {
    const r = e.currentTarget.getBoundingClientRect(); onSeek(Math.max(0, Math.min(total, ((e.clientX - r.left) / r.width * 910 - 48) / 840 * total)));
  }}>
    {[0, .25, .5, .75, 1].map(f => <g key={f}><line x1="48" x2="888" y1={y(f * max)} y2={y(f * max)} stroke="#303536" /><text x="36" y={y(f * max) + 4} textAnchor="end">{Math.round(f * max * 100) / 100}</text></g>)}
    {[0, .2, .4, .6, .8, 1].map(f => <text key={f} x={x(f * total)} y="245" textAnchor="middle">{Math.round(f * total)} m</text>)}
    {laps.map((lap, i) => <polyline key={i} fill="none" stroke={colors[i]} strokeWidth="2.2" strokeDasharray={i === 1 ? '7 4' : undefined} points={lap.points.map(p => `${x(p.d)},${y(p[channel])}`).join(' ')} />)}
    <line x1={x(distance)} x2={x(distance)} y1="25" y2="223" stroke="#cbd1cd" strokeDasharray="3 4" />
    {laps.map((lap, i) => <circle key={i} cx={x(distance)} cy={y(atDistance(lap.points, distance)[channel])} r="4" fill={colors[i]} />)}
  </svg>;
}

function Track({ lap, points, name }: { lap: Lap; points: (Point | null)[]; name: string }) {
  const xs = lap.points.map(p => p.x), ys = lap.points.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  if (lap.hasLocation === false || maxX === minX || maxY === minY) return <p className="empty">Position unavailable.</p>;
  const scale = Math.min(310 / (maxX - minX), 195 / (maxY - minY));
  const x = (n: number) => 25 + (n - minX) * scale + (310 - (maxX - minX) * scale) / 2, y = (n: number) => 220 - (n - minY) * scale;
  return <svg viewBox="0 0 360 250" role="img" aria-label={`${name} circuit and driver positions`}>
    <polyline fill="none" stroke="#535f59" strokeWidth="5" strokeLinejoin="round" points={lap.points.map(p => `${x(p.x)},${y(p.y)}`).join(' ')} />
    {points.map((p, i) => p && <g key={i}><circle cx={x(p.x)} cy={y(p.y)} r={i === 0 ? 6 : 4} fill={colors[i]} stroke="#15191a" strokeWidth="2" /><text x={x(p.x) + 10} y={y(p.y) + (i === 0 ? -10 : 17)} fill={colors[i]}>{i === 0 ? 'A' : 'B'}</text></g>)}
  </svg>;
}

createRoot(document.getElementById('root')!).render(<App />);
