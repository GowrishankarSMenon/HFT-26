import sqlite3

conn = sqlite3.connect("ev_stations.db")
cursor = conn.cursor()

cursor.execute("SELECT * FROM ev_stations where latitude='10.878265919428571';")
rows = cursor.fetchall()

for row in rows:
    print(row)

conn.close()
