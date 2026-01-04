import pandas as pd

# Load the original dataset
input_csv = "ev-charging-station.csv"   # replace with your file name
output_csv = "filtered_ev_data.csv"

df = pd.read_csv(input_csv)

# Required features for the project
required_columns = [
    "Latitude",
    "Longitude",
    "Status Code",
    "Access Code"
]

# Keep only required columns
filtered_df = df[required_columns]

# Optional: drop rows with missing location data
filtered_df = filtered_df.dropna(subset=["Latitude", "Longitude"])

# Save the filtered dataset
filtered_df.to_csv(output_csv, index=False)

print("Filtered dataset saved as:", output_csv)
print("Number of rows:", len(filtered_df))
