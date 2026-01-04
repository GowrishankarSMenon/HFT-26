import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let db = null;

async function getDb() {
    if (!db) {
        const dbPath = path.join(process.cwd(), 'cleaning', 'source.db');
        db = await open({
            filename: dbPath,
            driver: sqlite3.Database
        });
    }
    return db;
}

export async function POST(request) {
    try {
        const { bounds } = await request.json();

        if (!bounds || bounds.length < 3) {
            return NextResponse.json({ error: 'Invalid bounds' }, { status: 400 });
        }

        const lats = bounds.map(coord => coord[0]);
        const lngs = bounds.map(coord => coord[1]);

        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const database = await getDb();

        const substations = await database.all(
            `SELECT Latitude, Longitude, Voltage_kV 
             FROM SUBSTATIONS 
             WHERE Latitude BETWEEN ? AND ? 
             AND Longitude BETWEEN ? AND ?`,
            [minLat, maxLat, minLng, maxLng]
        );

        console.log(`Found ${substations.length} substations in bounds`);

        return NextResponse.json({ substations });
    } catch (error) {
        console.error('Error fetching substations:', error);
        return NextResponse.json(
            { error: 'Failed to fetch substations', details: error.message },
            { status: 500 }
        );
    }
}
