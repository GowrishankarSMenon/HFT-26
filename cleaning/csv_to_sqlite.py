import sqlite3
import pandas as pd

# File paths
csv_file = "kerala_ev_data.csv"
db_file = "source.db"

# Read CSV
df = pd.read_csv(csv_file)

# Connect to SQLite database
conn = sqlite3.connect(db_file)

# Insert data into table
df.to_sql(
    name="EV_VEHICLES_PER_DISTRICT",
    con=conn,
    if_exists="replace",
    index=False
)

# Close connection
conn.close()

print(f"Data uploaded to SQLite database successfully: {db_file}")
print(f"Table: EV_VEHICLES_PER_DISTRICT")
print(f"Total records: {len(df)}")
