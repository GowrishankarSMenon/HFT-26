import sqlite3

conn = sqlite3.connect("ev_stations.db")
cursor = conn.cursor()

cursor.execute("SELECT COUNT(*) FROM ev_stations;")
rows = cursor.fetchall()

for row in rows:
    print(row)

conn.close()
