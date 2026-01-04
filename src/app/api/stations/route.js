import { NextResponse } from 'next/server';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';
import path from 'path';

let db = null;

async function getDb() {
  if (db) return db;
  
  db = await open({
    filename: path.join(process.cwd(), 'ev_stations.db'),
    driver: sqlite3.Database
  });
  
  return db;
}

export async function POST(request) {
  try {
    const { bounds, type } = await request.json();
    
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
      SELECT COUNT(*) FROM 
    `;

    const stations = await database.all(query, [minLat, maxLat, minLng, maxLng]);

    console.log(`Found ${stations.length} stations in bounds`);

    return NextResponse.json({ stations });
  } catch (error) {
    console.error('Database error:', error);
    return NextResponse.json({ 
      error: 'Database query failed', 
      details: error.message 
    }, { status: 500 });
  }
}