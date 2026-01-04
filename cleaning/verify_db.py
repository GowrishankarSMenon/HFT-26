import json
import csv
import sqlite3

# Load the JSON file
with open("kerala_local_body_indicators_with_coordinates.json", "r") as f:
    data = json.load(f)

# Prepare data for CSV
csv_data = []

# Extract data from all districts
for district in data["districts"]:
    # Process corporations
    for corp in district.get("corporations", []):
        csv_data.append({
            "latitude": corp.get("latitude"),
            "longitude": corp.get("longitude"),
            "ev_adoption_likelihood_score": corp.get("ev_adoption_likelihood_score"),
            "density_per_km2": corp.get("density_per_km2"),
            "population": corp.get("population"),
            "per_capita_income": corp.get("per_capita_income")
        })
    
    # Process municipalities
    for muni in district.get("municipalities", []):
        csv_data.append({
            "latitude": muni.get("latitude"),
            "longitude": muni.get("longitude"),
            "ev_adoption_likelihood_score": muni.get("ev_adoption_likelihood_score"),
            "density_per_km2": muni.get("density_per_km2"),
            "population": muni.get("population"),
            "per_capita_income": muni.get("per_capita_income")
        })
    
    # Process panchayats (aggregate data)
    panchayats = district.get("panchayats", {})
    if panchayats:
        csv_data.append({
            "latitude": None,
            "longitude": None,
            "ev_adoption_likelihood_score": panchayats.get("ev_adoption_likelihood_score"),
            "density_per_km2": panchayats.get("avg_density"),
            "population": panchayats.get("avg_population"),
            "per_capita_income": panchayats.get("avg_income")
        })

# Write to CSV file
csv_columns = ["latitude", "longitude", "ev_adoption_likelihood_score", "density_per_km2", "population", "per_capita_income"]
with open("kerala_ev_adoption_data.csv", "w", newline="") as csvfile:
    writer = csv.DictWriter(csvfile, fieldnames=csv_columns)
    writer.writeheader()
    writer.writerows(csv_data)

print(f"CSV file created: kerala_ev_adoption_data.csv")
print(f"Total records: {len(csv_data)}")

# Create SQLite database and tables
conn = sqlite3.connect("source.db")
cursor = conn.cursor()

# Create population_density table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS population_density (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL,
        longitude REAL,
        density REAL
    )
""")

# Create adoption_likelihood table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS adoption_likelihood (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL,
        longitude REAL,
        likelihood REAL
    )
""")

# Read CSV and populate tables
with open("kerala_ev_adoption_data.csv", "r") as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        latitude = row.get("latitude")
        longitude = row.get("longitude")
        density = row.get("density_per_km2")
        likelihood = row.get("ev_adoption_likelihood_score")
        
        # Convert empty strings to None
        latitude = float(latitude) if latitude else None
        longitude = float(longitude) if longitude else None
        density = float(density) if density else None
        likelihood = float(likelihood) if likelihood else None
        
        # Insert into population_density table
        cursor.execute("""
            INSERT INTO population_density (latitude, longitude, density)
            VALUES (?, ?, ?)
        """, (latitude, longitude, density))
        
        # Insert into adoption_likelihood table
        cursor.execute("""
            INSERT INTO adoption_likelihood (latitude, longitude, likelihood)
            VALUES (?, ?, ?)
        """, (latitude, longitude, likelihood))

conn.commit()

# Clean up rows with null latitude or longitude from all tables
tables_to_clean = ["EV_STATIONS", "SUBSTATIONS", "population_density", "adoption_likelihood"]

for table_name in tables_to_clean:
    try:
        # Check if table exists
        cursor.execute(f"SELECT name FROM sqlite_master WHERE type='table' AND name='{table_name}'")
        if cursor.fetchone():
            # Delete rows where latitude or longitude is NULL
            cursor.execute(f"""
                DELETE FROM {table_name}
                WHERE latitude IS NULL OR longitude IS NULL
            """)
            rows_deleted = cursor.rowcount
            print(f"Deleted {rows_deleted} rows with null latitude/longitude from {table_name}")
        else:
            print(f"Table {table_name} does not exist")
    except sqlite3.OperationalError as e:
        print(f"Error cleaning table {table_name}: {e}")

conn.commit()
conn.close()

print("Database tables created and data populated in source.db")
print("Tables created: population_density, adoption_likelihood")
print("Cleanup complete: Removed rows with null latitude/longitude")
