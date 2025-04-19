# 🏎️ F1 Telemetry App

This is a Streamlit web app using my Python scripts [here](https://github.com/Av1Sharma/F1-Telemetry-Visualization) that lets users visualize Formula 1 telemetry data in 3D and view detailed race statistics for individual drivers during specific sessions. Powered by FastF1, Plotly, and Streamlit, it provides a unique interactive experience for fans and analysts alike. View it live [here](https://f1telemetry-app.streamlit.app/)!

## 🚀 Features

- 📊 **3D Animated Track Visualization**: See your selected driver's telemetry data animate across the track.
- 📈 **Telemetry Breakdown**: Includes X, Y, Z position data and speed.
- 🏁 **Session Stats Display**: Shows driver name, team, grid position, final position, points, fastest lap time, and lap number.
- 🔍 **User Input Controls**: Easily select season, race, session, and driver.
- ⚡ **FastF1 Caching**: Speeds up repeated queries using local caching.


## 📦 Installation

### Requirements

- Python 3.8+
- [FastF1](https://docs.fastf1.dev/)
- Streamlit
- Plotly
- Pandas

### Installation Steps

```bash
git clone https://github.com/Av1Sharma/F1-Telemetry-App.git
cd F1-Telemetry-App
pip install -r requirements.txt
```

### Running Locally
```bash 
streamlit run app.py
```
Make sure to create a cache directory
```bash 
mkdir cache
```

## ⚠️ Notes
If deploying locally, ensure the cache/ directory exists before running the app.

Grid positions and lap times may return "N/A" for some drivers or sessions if FastF1 data is incomplete.


