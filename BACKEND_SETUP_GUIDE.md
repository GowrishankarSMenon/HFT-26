# Python Backend for Optimal Location Finding

This backend provides fast, scalable computation for finding optimal EV charging station locations using Python Flask and NumPy/SciPy.

## Features

- **Fast Computation**: Uses NumPy vectorization and SciPy's KDTree for O(n log n) complexity
- **No UI Blocking**: Heavy calculations run on backend server
- **Large Grid Support**: Can handle 10k+ grid cells efficiently
- **Progress Tracking**: Real-time execution metrics

## Prerequisites

- Python 3.8 or later
- Windows PowerShell or Command Prompt

## Setup Instructions

### First Time Setup (One-time)

Open PowerShell or Command Prompt and navigate to the project's `backend` directory:

```bash
cd "backend"
```

Run the setup script to create virtual environment and install dependencies:

```bash
setup.bat
```

This will:

1. Create a Python virtual environment
2. Install Flask, NumPy, and SciPy
3. Display setup completion message

### Starting the Backend Server

Every time you want to use the optimal location finder:

```bash
cd "backend"
start.bat
```

You should see:

```
Starting Flask Backend Server
=========================================
http://localhost:5000
Press Ctrl+C to stop
```

The backend is now running and ready to receive requests from the Next.js frontend.

## API Endpoints

### POST /api/find-optimal-locations

Find optimal charging station locations.

**Request Body:**

```json
{
  "cells": [
    {
      "centerLat": 10.123,
      "centerLng": 76.456,
      "cost": 45.2,
      "density": 5000,
      "inPolygon": true,
      "nearestStationDistance": 2.5,
      "adoptionLikelihood": 0.85
    }
  ],
  "n": 3,
  "minDistanceKm": 0.5
}
```

**Response:**

```json
{
  "success": true,
  "locations": [
    {
      "stationNumber": 1,
      "latitude": 10.123,
      "longitude": 76.456,
      "cost": 45.2,
      "score": 35.5,
      "density": 5000,
      "nearestStationDistance": 2.5,
      "adoptionLikelihood": 0.85
    }
  ],
  "executionTime": 1.234,
  "cellsProcessed": 1500,
  "locationsFound": 3
}
```

### GET /health

Check if backend is running.

**Response:**

```json
{
  "status": "healthy",
  "service": "Optimal Location Finder API",
  "version": "1.0"
}
```

### GET /

Get API documentation.

## Frontend Integration

The frontend automatically calls the backend when you click "Find Optimal Locations" in the map interface.

### How It Works

1. **Frontend sends**: Grid cells with cost data, number of stations, minimum distance
2. **Backend processes**: Uses spatial indexing to find optimal placements
3. **Backend returns**: Optimal station coordinates with metadata
4. **Frontend displays**: Green pulsing markers on the map

## Troubleshooting

### "Cannot connect to backend"

**Problem**: Frontend can't reach the Flask server

**Solution**:

1. Make sure `start.bat` is running in the backend folder
2. Check that the terminal shows `http://localhost:5000`
3. Open http://localhost:5000 in your browser to verify

### "Backend returned an error"

**Problem**: The calculation failed

**Solution**:

1. Check the backend terminal for error messages
2. Make sure the polygon has at least some cells
3. Try with fewer stations (e.g., 3 instead of 10)

### Python module not found errors

**Problem**: "ModuleNotFoundError: No module named 'flask'"

**Solution**:

1. Run `setup.bat` again to reinstall dependencies
2. Make sure virtual environment is activated (you should see `(venv)` in the terminal)

### Port 5000 already in use

**Problem**: "Address already in use"

**Solution**:

1. Close any other Flask instances running on port 5000
2. Or modify the port in `app.py` line: `app.run(debug=True, port=5001)`

## Performance Characteristics

| Grid Size   | Processing Time | Status           |
| ----------- | --------------- | ---------------- |
| 100 cells   | < 0.1s          | ✅ Instant       |
| 500 cells   | 0.2-0.5s        | ✅ Fast          |
| 1000 cells  | 0.5-1.5s        | ✅ Good          |
| 5000+ cells | 2-5s            | ✅ Responsive UI |

## Architecture

```
Frontend (Next.js)
    ↓
OptimalLocationFinderAPI.js (HTTP POST)
    ↓
Flask Backend (app.py)
    ↓
OptimalLocationFinder class
    ├─ KDTree (spatial indexing)
    ├─ NumPy (vectorized calculations)
    └─ SciPy (distance algorithms)
```

## Development

To modify the algorithm or add features:

1. Edit `backend/app.py`
2. Restart the backend with `start.bat`
3. Changes take effect immediately (Flask debug mode enabled)

## Files

- `app.py` - Main Flask application and algorithm
- `requirements.txt` - Python dependencies
- `setup.bat` - Initial setup script
- `start.bat` - Run backend server
- `README.md` - This file

## Future Optimizations

- Caching of grid calculations
- Redis for distributed processing
- Celery for background tasks
- PostgreSQL + PostGIS for spatial data
- Parallel processing for multiple requests

---

**Backend Service Running** ✅ When you see the Flask server running with "http://localhost:5000"
