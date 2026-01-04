import json
import sqlite3

# Create SQLite database and tables
conn = sqlite3.connect("source.db")
cursor = conn.cursor()

# Drop tables if they exist to ensure clean schema
cursor.execute("DROP TABLE IF EXISTS population_density")
cursor.execute("DROP TABLE IF EXISTS adoption_likelihood")

# Create population_density table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS population_density (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL,
        longitude REAL,
        population INTEGER,
        density_per_m2 REAL,
        per_capita_income REAL,
        area REAL
    )
""")

# Create adoption_likelihood table
cursor.execute("""
    CREATE TABLE IF NOT EXISTS adoption_likelihood (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        latitude REAL,
        longitude REAL,
        population INTEGER,
        ev_adoption_likelihood_score REAL,
        per_capita_income REAL,
        area REAL
    )
""")

# Process Kerala local body indicators JSON
print("Processing Kerala Local Body Indicators...")

with open("kerala_local_body_indicators_with_coordinates.json", "r", encoding="utf-8") as jsonfile:
    data = json.load(jsonfile)

population_density_rows = 0
adoption_likelihood_rows = 0

# Extract data from all districts
for district in data.get("districts", []):
    # Process corporations
    for corp in district.get("corporations", []):
        latitude = corp.get("latitude")
        longitude = corp.get("longitude")
        population = corp.get("population")
        density_per_km2 = corp.get("density_per_km2")
        ev_adoption_likelihood_score = corp.get("ev_adoption_likelihood_score")
        per_capita_income = corp.get("per_capita_income")
        
        if latitude and longitude and population and density_per_km2:
            # Convert density from per km2 to per m2
            density_per_m2 = density_per_km2 / 1_000_000
            # Calculate area as population / density_per_m2
            area = population / density_per_m2 if density_per_m2 > 0 else 0
            
            # Insert into population_density table
            cursor.execute("""
                INSERT INTO population_density (latitude, longitude, population, density_per_m2, per_capita_income, area)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (latitude, longitude, population, round(density_per_m2, 8), per_capita_income, round(area, 2)))
            population_density_rows += 1
            
            # Insert into adoption_likelihood table
            cursor.execute("""
                INSERT INTO adoption_likelihood (latitude, longitude, population, ev_adoption_likelihood_score, per_capita_income, area)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (latitude, longitude, population, ev_adoption_likelihood_score, per_capita_income, round(area, 2)))
            adoption_likelihood_rows += 1
    
    # Process municipalities
    for muni in district.get("municipalities", []):
        latitude = muni.get("latitude")
        longitude = muni.get("longitude")
        population = muni.get("population")
        density_per_km2 = muni.get("density_per_km2")
        ev_adoption_likelihood_score = muni.get("ev_adoption_likelihood_score")
        per_capita_income = muni.get("per_capita_income")
        
        if latitude and longitude and population and density_per_km2:
            # Convert density from per km2 to per m2
            density_per_m2 = density_per_km2 / 1_000_000
            # Calculate area as population / density_per_m2
            area = population / density_per_m2 if density_per_m2 > 0 else 0
            
            # Insert into population_density table
            cursor.execute("""
                INSERT INTO population_density (latitude, longitude, population, density_per_m2, per_capita_income, area)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (latitude, longitude, population, round(density_per_m2, 8), per_capita_income, round(area, 2)))
            population_density_rows += 1
            
            # Insert into adoption_likelihood table
            cursor.execute("""
                INSERT INTO adoption_likelihood (latitude, longitude, population, ev_adoption_likelihood_score, per_capita_income, area)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (latitude, longitude, population, ev_adoption_likelihood_score, per_capita_income, round(area, 2)))
            adoption_likelihood_rows += 1

conn.commit()

print(f"population_density table: {population_density_rows} records inserted")
print(f"adoption_likelihood table: {adoption_likelihood_rows} records inserted")

conn.close()
