# Lap Lab — F1 Telemetry

A static React + TypeScript telemetry workspace. Compare eight recorded laps from Monza 2024 qualifying (Norris, Piastri, Leclerc, Sainz), switch speed/throttle/brake traces, scrub or replay a lap, inspect sectors, and export driver A's samples to CSV.

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

The dashboard runs without an API, account, paid subscription, or server. Source data is bundled, not fetched during playback. It does not claim live race coverage.

Distances are estimated with trapezoidal integration of sampled speed, then normalized to the published 5,793 m circuit length. Driver traces share estimated distance, not elapsed time. Position samples are nearest timestamp matches. Interpolation is linear for continuous channels; gear/brake are discrete. Official lap and sector durations are kept separate from approximated telemetry. No fabricated telemetry is used.

## Demo video (60–90 seconds)

1. Open the default Norris/Leclerc comparison and explain the 0.134 s difference.
2. Play at 2×; pause near a braking zone and move the distance slider.
3. Switch between speed, throttle, and brake. Point out synchronized values and map markers.
4. Change driver B to Piastri and compare sector differences.
5. Select an alternate lap and download driver A's CSV.

## Architecture / validation

React maintains driver/lap/channel/replay state. SVG renders responsive traces and the track; binary search interpolates telemetry by distance. TypeScript checks the data interface. Node tests cover interpolation boundaries and CSV/time formatting. The production dataset has four drivers and eight laps.

`app.py` and `backend.py` are the legacy Streamlit implementation, retained for history. The supported application is `web/`; the old Streamlit deployment is no longer the portfolio demo.
