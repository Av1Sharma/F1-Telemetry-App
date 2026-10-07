# Lap Lab — F1 Telemetry

Lap Lab is a React and TypeScript app for comparing Formula 1 lap telemetry and exploring race results. Browse race results from 1950 onward and available OpenF1 sessions from 2023 onward. Select drivers and laps, compare speed, throttle, and brake traces, replay a lap, inspect sectors, and export driver A's samples as CSV.

Live app: https://av1sharma.github.io/lap-lab/

## Develop

The supported app is in `web/`. From the repository root:

```sh
cd web
npm ci
npm run dev
npm test
npm run build
```

The generated `web/dist/` directory can be deployed to a static host. Relative asset URLs allow deployment below a path prefix. The portfolio publishes this build at `/lap-lab/`.

## Data and methodology

`web/public/monza-2024.json` contains historical data from OpenF1 session 9586. `scripts/fetch_demo.py` reproduces this bundled example with bounded requests, retries, and response checks. The example includes each driver's two fastest recorded non-out laps; the feed may include deleted laps, so it is not an official qualifying classification.

The default Monza example and race-results archive work without an external API. Other historical OpenF1 sessions load on demand without an account or paid subscription. Requests are queued, cached, cancellable, and rate-limited. Live sessions are not supported. Missing telemetry is reported rather than filled with fabricated values.

Race results come from a reduced [F1DB](https://github.com/f1db/f1db) archive under CC BY 4.0. Regenerate the archive with `python3 scripts/build_archive.py`; the script verifies the pinned release checksum and writes attribution alongside the data. The checked-in archive covers 1950–2026; updating it is required for future seasons.

Distance is estimated by trapezoidal integration of sampled speed and normalized to archived circuit length. Driver traces share estimated distance, not elapsed time. Position samples use the nearest timestamp. Continuous channels are linearly interpolated; gear and brake are discrete. Official lap and sector durations remain separate from approximated telemetry.

## Implementation and tests

The React app tracks driver, lap, channel, and replay state. SVG renders telemetry traces and the circuit. TypeScript checks the data interfaces. Run `npm test` in `web/` for the Node test suite, which covers interpolation boundaries and CSV/time formatting. Additional tests cover session matching, driver and lap metadata, telemetry normalization, incomplete recordings, and archive data.

`app.py` and `backend.py` are the legacy Streamlit implementation. They are retained for reference; the supported application is `web/`.
