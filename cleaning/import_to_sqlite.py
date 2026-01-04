import sqlite3
import pandas as pd

# File paths
csv_file = "ev_station_detail.csv"
db_file = "ev_stations.db"

# Read CSV
df = pd.read_csv(csv_file)

# Extract only lat and long columns and rename them
df_to_insert = pd.DataFrame({
    'Latitude': df['lat'],
    'Longitude': df['long'],
    'Status Code': 'E',
    'Access Code': 'public'
})

# Connect to SQLite database
conn = sqlite3.connect(db_file)

# Insert new rows into existing table (append mode)
df_to_insert.to_sql(
    name="ev_stations",
    con=conn,
    if_exists="append",
    index=False
)

# Close connection
conn.close()

print("Data inserted into SQLite database successfully:", db_file)
