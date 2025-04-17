import streamlit as st
import pandas as pd
from backend import load_telemetry_data
import plotly.graph_objects as go

st.set_page_config(layout="wide", page_title="F1 Telemetry Visualizer")

st.title("🏎️ F1 Telemetry Visualizer")

# split the layout into two columns
col1, col2 = st.columns([1, 3])

with col1:
    st.header("Select Telemetry Options")

    year = st.number_input("Year", min_value=2018, max_value=2025, value=2024)
    race = st.text_input("Race Name", value="Monza")
    session = st.selectbox("Session Type", options=["R", "Q", "FP1", "FP2", "FP3"])
    driver = st.text_input("Driver Last Name", value="Verstappen")
    step = st.slider("Animation Granularity (higher = faster)", min_value=10, max_value=200, value=50, step=10)

    load_clicked = st.button("Load and Animate")

with col2:
    if 'load_clicked' not in st.session_state:
        st.session_state.load_clicked = False

    if load_clicked:
        st.session_state.load_clicked = True

    if st.session_state.load_clicked:
        with st.spinner("Loading telemetry..."):
            data, stats = load_telemetry_data(year, race, session, driver)

        if data is None or stats is None:
            st.error("Error loading data.")
        else:
            st.subheader(f"📊 Race Summary: {driver.title()} in {race.title()} {year}")
            st.markdown(f"- **Driver**: {stats['Driver']}")
            st.markdown(f"- **Team**: {stats['Team']}")
            st.markdown(f"- **Grid Position**: {stats['Grid Position']}")
            st.markdown(f"- **Finish Position**: {stats['Finish Position']}")
            st.markdown(f"- **Points**: {stats['Points']}")
            st.markdown(f"- **Fastest Lap**: {stats['Fastest Lap Time']} (Lap {stats['Fastest Lap Number']})")

            data['X'] -= data['X'].min()
            data['Y'] -= data['Y'].min()
            data = data.iloc[::step].reset_index(drop=True)
            data['Z'] = 0 # tracks are flat, data is weird with this being retrieved

            trace_path = go.Scatter3d(
                x=data['X'], y=data['Y'], z=data['Z'],
                mode='lines', line=dict(color='blue', width=4),
                name="Track Path"
            )

            trace_car = go.Scatter3d(
                x=[data['X'][0]], y=[data['Y'][0]], z=[0],
                mode='markers', marker=dict(size=6, color='red'),
                name="Car"
            )

            frames = [
                go.Frame(
                    data=[
                        go.Scatter3d(
                            x=data['X'][:i+1],
                            y=data['Y'][:i+1],
                            z=[0] * (i+1),
                            mode='lines+markers',
                            marker=dict(size=6, color='red'),
                            line=dict(color='red', width=2),
                        )
                    ],
                    name=str(i)
                )
                for i in range(1, len(data))
            ]

            layout = go.Layout(
                title="F1 Car Telemetry Animation (X-Y Track)",
                scene=dict(
                    xaxis_title="X Position",
                    yaxis_title="Y Position",
                    zaxis_title="Ground Level",
                    camera=dict(up=dict(x=0, y=0, z=1)),
                ),
                updatemenus=[
                    dict(
                        type="buttons",
                        showactive=True,
                        buttons=[
                            dict(label="Play", method="animate",
                                 args=[None, dict(frame=dict(duration=30, redraw=True), fromcurrent=True)]),
                            dict(label="Pause", method="animate",
                                 args=[[None], dict(frame=dict(duration=0, redraw=False), mode="immediate")]),
                            dict(label="Restart", method="animate",
                                 args=[None, dict(frame=dict(duration=30, redraw=True), fromcurrent=False)]),
                        ]
                    )
                ],
                showlegend=True
            )

            fig = go.Figure(data=[trace_path, trace_car], layout=layout, frames=frames)
            st.plotly_chart(fig, use_container_width=True)
