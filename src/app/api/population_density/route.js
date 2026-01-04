import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let db = null;

async function getDb() {
    if (db) return db;
    const dbPath = path.join(process.cwd(), "cleaning", 'source.db');
    console.log('Population Density DB Path:', dbPath);

    const fs = require('fs');
    if (!fs.existsSync(dbPath)) {
        throw new Error(`Database file not found at ${dbPath}`);
    }

    db = await open({
        filename: dbPath,
        driver: sqlite3.Database,
        mode: sqlite3.OPEN_READWRITE,
        fileMustExist: true
    });

    return db;
}

export async function POST(request) {
    try {
        const { bounds } = await request.json();

        if (!bounds || bounds.length < 3) {
            return NextResponse.json({ error: 'Invalid bounds' }, { status: 400 });
        }

        const lats = bounds.map(b => b[0]);
        const lngs = bounds.map(b => b[1]);
        const minLat = Math.min(...lats);
        const maxLat = Math.max(...lats);
        const minLng = Math.min(...lngs);
        const maxLng = Math.max(...lngs);

        const database = await getDb();

        const query = `
          SELECT 
            latitude, 
            longitude, 
            population, 
            density_per_m2, 
            per_capita_income, 
            area
          FROM population_density
          WHERE latitude BETWEEN ? AND ?
            AND longitude BETWEEN ? AND ?
            AND density_per_m2 > 0;
        `;

        const densityData = await database.all(query, [minLat, maxLat, minLng, maxLng]);

        console.log(`Found ${densityData.length} population density zones in bounds`);

        return NextResponse.json({ densityData });
    } catch (error) {
        console.error('Population density database error:', error);
        return NextResponse.json({
            error: 'Database query failed',
            details: error.message
        }, { status: 500 });
    }
}
