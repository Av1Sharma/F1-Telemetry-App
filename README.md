# Lap Lab — F1 Telemetry

A static React + TypeScript telemetry workspace. Browse race results from 1950 onward and load available OpenF1 sessions from 2023 onward. Choose drivers and laps, switch speed/throttle/brake traces, scrub or replay a lap, inspect sectors, and export driver A's samples to CSV.

Live demo: https://av1sharma.github.io/lap-lab/

## Run and build

```sh
cd web
npm ci
npm run dev
npm test
npm run build
```

The `web/dist` directory is deployable on any static host. Relative asset URLs support a subdirectory. The portfolio publishes this build at `/lap-lab/`.

## Data and methodology

`web/public/monza-2024.json` contains real historical data from [OpenF1](https://openf1.org/), session 9586. The Python standard-library script `scripts/fetch_demo.py` reproduces the dataset, with bounded requests, retries, and response checks. Each driver's two fastest recorded non-out laps are included. The feed may include deleted laps; this is not an official qualifying classification.

The default Monza example and race-results archive work without an external API. Other sessions fetch historical OpenF1 data on demand, without an account or paid subscription. Requests are queued, cached, cancellable, and rate-limited. Live sessions are not supported; missing telemetry is reported instead of invented.

Race results are a reduced [F1DB](https://github.com/f1db/f1db) archive under CC BY 4.0. Regenerate with `python3 scripts/build_archive.py`; the script verifies the pinned release checksum and writes attribution alongside the data. The current archive covers 1950–2026; future results require an archive update.

Distances are estimated with trapezoidal integration of sampled speed, then normalized to the archived circuit length. Driver traces share estimated distance, not elapsed time. Position samples are nearest timestamp matches. Interpolation is linear for continuous channels; gear/brake are discrete. Official lap and sector durations are kept separate from approximated telemetry. No fabricated telemetry is used.

## Demo video (60–90 seconds)

1. Open the default Norris/Leclerc comparison and explain the 0.134 s difference.
2. Play at 2×; pause near a braking zone and move the distance slider.
3. Switch between speed, throttle, and brake. Point out synchronized values and map markers.
4. Change driver B to Piastri and compare sector differences.
5. Select 2025, Great Britain, Qualifying and load the session. Compare another driver or lap.
6. Switch to 1950 race results, then use Example to return to Monza.

## Architecture / validation

React maintains driver/lap/channel/replay state. SVG renders responsive traces and the track; binary search interpolates telemetry by distance. TypeScript checks the data interface. Node tests cover interpolation boundaries and CSV/time formatting. Additional tests cover session matching, driver/lap metadata, telemetry normalization, incomplete recordings, and the archive. A live API smoke check loaded 20 drivers, 251 timed laps, and 307 telemetry points for Norris at Silverstone 2025 qualifying.

`app.py` and `backend.py` are the legacy Streamlit implementation, retained for history. The supported application is `web/`; the old Streamlit deployment is no longer the portfolio demo.
