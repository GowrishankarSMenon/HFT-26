import sqlite3
import pandas as pd

# File paths
target_db = "source.db"

# Function to copy table from source to target database
def copy_table(source_db, target_table_name):
    # Connect to source database
    conn_source = sqlite3.connect(source_db)
    
    # Get table names from source database
    cursor = conn_source.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    tables = cursor.fetchall()
    
    if tables:
        # Read the first table (assuming single table)
        table_name = tables[0][0]
        df = pd.read_sql_query(f"SELECT * FROM {table_name}", conn_source)
        
        # Connect to target database
        conn_target = sqlite3.connect(target_db)
        
        # Write to target database with new table name
        df.to_sql(
            name=target_table_name,
            con=conn_target,
            if_exists="replace",
            index=False
        )
        
        conn_target.close()
        print(f"Table '{table_name}' from {source_db} copied to {target_db} as '{target_table_name}'")
        print(f"Total records: {len(df)}")
    else:
        print(f"No tables found in {source_db}")
    
    conn_source.close()

# Copy EV_STATIONS
copy_table("ev_stations.db", "EV_STATIONS")

# Copy SUBSTATIONS
copy_table("substations.db", "SUBSTATIONS")
