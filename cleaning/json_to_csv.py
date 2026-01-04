import json
import pandas as pd

# Read JSON file
with open('kerala_ev_data_with_coordinates.json', 'r') as f:
    data = json.load(f)

# Extract required fields
extracted_data = []

# Iterate through districts
for district_obj in data.get('districts', []):
    district_name = district_obj.get('district')
    
    # Process corporations
    for corp in district_obj.get('corporations', []):
        extracted_data.append({
            'district': district_name,
            'ev_count': corp.get('ev_count'),
            'latitude': corp.get('latitude'),
            'longitude': corp.get('longitude')
        })
    
    # Process municipalities
    for mun in district_obj.get('municipalities', []):
        extracted_data.append({
            'district': district_name,
            'ev_count': mun.get('ev_count'),
            'latitude': mun.get('latitude'),
            'longitude': mun.get('longitude')
        })

# Create DataFrame
df = pd.DataFrame(extracted_data)

# Save to CSV
df.to_csv('kerala_ev_data.csv', index=False)

print(f"JSON converted to CSV successfully: kerala_ev_data.csv")
print(f"Total records: {len(df)}")

