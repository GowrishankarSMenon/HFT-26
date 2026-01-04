import sqlite3
import pandas as pd

# File paths
csv_file = "filtered_ev_data.csv"
db_file = "ev_stations.db"

# Read CSV
df = pd.read_csv(csv_file)

# Connect to SQLite database (creates file if it doesn't exist)
conn = sqlite3.connect(db_file)

# Write to SQLite
df.to_sql(
    name="ev_stations",
    con=conn,
    if_exists="replace",
    index=False
)

# Close connection
conn.close()

print("SQLite database created successfully:", db_file)
