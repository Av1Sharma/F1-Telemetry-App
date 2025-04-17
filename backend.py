import fastf1
import pandas as pd

DRIVER_CODES = {
    "verstappen": "VER", "perez": "PER", "hamilton": "HAM", "russell": "RUS", "leclerc": "LEC", 
    "sainz": "SAI", "norris": "NOR", "piastri": "PIA", "alonso": "ALO", "stroll": "STR", 
    "ocon": "OCO", "gasly": "GAS", "bottas": "BOT", "zhou": "ZHO", "magnussen": "MAG", 
    "hulkenberg": "HUL", "tsunoda": "TSU", "ricciardo": "RIC", "albon": "ALB", "sargeant": "SAR"
}

def load_telemetry_data(year, race, session_type, driver_name):
    try:
        driver_code = DRIVER_CODES.get(driver_name.lower())
        if not driver_code:
            print(f"Driver '{driver_name}' not found.")
            return None, None

        session = fastf1.get_session(year, race, session_type)
        session.load()

        # Telemetry
        laps = session.laps.pick_driver(driver_code)
        telemetry = laps.get_telemetry()

        data = pd.DataFrame({
            'Timestamp': telemetry['Time'],
            'Speed': telemetry['Speed'] / 3.6,
            'X': telemetry['X'],
            'Y': telemetry['Y'],
            'Z': telemetry['Z']
        })
        data.to_csv('data/telemetry.csv', index=False)

        # Stats
        fastest_lap = laps.pick_fastest()
        results = session.results
        driver_result = results[results['Abbreviation'] == driver_code].iloc[0]

        stats = {
            "Driver": driver_result.FullName,
            "Team": driver_result.TeamName,
            "Grid Position": int(driver_result.GridPosition),
            "Finish Position": int(driver_result.Position),
            "Points": float(driver_result.Points),
            "Fastest Lap Time": str(fastest_lap['LapTime']) if not pd.isna(fastest_lap['LapTime']) else "N/A",
            "Fastest Lap Number": int(fastest_lap['LapNumber']) if not pd.isna(fastest_lap['LapNumber']) else "N/A"
        }

        return data, stats

    except Exception as e:
        print(f"Error: {e}")
        return None, None
