import sqlite3
import pandas as pd

# File paths
csv_file = "kerala_substations_with_latlong.csv"
db_file = "substations.db"

# Read CSV
df = pd.read_csv(csv_file)

# Extract latitude, longitude, and voltage_kv columns (omit place_name)
df_to_insert = pd.DataFrame({
    'Latitude': df['latitude'],
    'Longitude': df['longitude'],
    'Voltage_kV': df['voltage_kv']
})

# Connect to SQLite database
conn = sqlite3.connect(db_file)

# Insert rows into new table
df_to_insert.to_sql(
    name="kerala_substations",
    con=conn,
    if_exists="replace",
    index=False
)

# Close connection
conn.close()

print("Data inserted into SQLite database successfully:", db_file)
