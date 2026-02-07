import L from 'leaflet';
import { districtData } from './districtData';

/* ----------------------------------------------------
   DISTRICT IDENTIFICATION
---------------------------------------------------- */
export const findNearestDistrict = (latlngs) => {
  const center = latlngs.reduce(
    (acc, [lat, lng]) => {
      acc.lat += lat;
      acc.lng += lng;
      return acc;
    },
    { lat: 0, lng: 0 }
  );

  center.lat /= latlngs.length;
  center.lng /= latlngs.length;

  if (center.lat > 11.5) return 'kasaragod';
  if (center.lat > 11.2) return 'kannur';
  if (center.lat > 10.9) return 'kozhikode';
  if (center.lat > 10.7) return 'malappuram';
  if (center.lat > 10.5) return 'thrissur';
  if (center.lat > 10.2) return 'ernakulam';
  if (center.lat > 9.9) return 'kottayam';
  if (center.lat > 9.6) return 'alappuzha';
  if (center.lat > 9.3) return 'pathanamthitta';
  if (center.lat > 9.0) return 'kollam';
  if (center.lng > 76.8) return 'idukki';
  if (center.lng > 76.5) return 'palakkad';
  if (center.lng < 76.3) return 'wayanad';

  return 'thiruvananthapuram';
};

/* ----------------------------------------------------
   ACCURATE GEODESIC AREA (km²)
---------------------------------------------------- */
export const calculateArea = (coords) => {
  if (!coords || coords.length < 3) return 0;

  const R = 6378137;
  let area = 0;

  for (let i = 0; i < coords.length; i++) {
    const [lat1, lng1] = coords[i];
    const [lat2, lng2] = coords[(i + 1) % coords.length];

    area +=
      (lng2 * Math.PI / 180 - lng1 * Math.PI / 180) *
      (2 +
        Math.sin(lat1 * Math.PI / 180) +
        Math.sin(lat2 * Math.PI / 180));
  }

  area = Math.abs(area * R * R / 2);
  return area / 1_000_000;
};

/* ----------------------------------------------------
   POINT IN POLYGON (Ray Casting)
---------------------------------------------------- */
export const pointInPolygon = (point, vs) => {
  const x = point[1];
  const y = point[0];
  let inside = false;

  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1], yi = vs[i][0];
    const xj = vs[j][1], yj = vs[j][0];

    const intersect =
      (yi > y) !== (yj > y) &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
};

/* ----------------------------------------------------
   CELL–POLYGON INTERSECTION (PARTIAL OVERLAP)
---------------------------------------------------- */
const cellIntersectsPolygon = (cellCorners, polygon) => {
  for (const corner of cellCorners) {
    if (pointInPolygon(corner, polygon)) return true;
  }

  const lats = cellCorners.map(p => p[0]);
  const lngs = cellCorners.map(p => p[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  for (const [plat, plng] of polygon) {
    if (
      plat >= minLat && plat <= maxLat &&
      plng >= minLng && plng <= maxLng
    ) {
      return true;
    }
  }

  return false;
};

/* ----------------------------------------------------
   GRID GENERATION (Adaptive cell size for large areas)
---------------------------------------------------- */
export const generateGridCells = (polygonCoords) => {
  if (!polygonCoords || polygonCoords.length < 3) return [];

  const lats = polygonCoords.map(p => p[0]);
  const lngs = polygonCoords.map(p => p[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Calculate area to determine appropriate cell size
  const area = calculateArea(polygonCoords);

  // Adaptive cell size based on area
  let BASE_CELL_AREA;
  let MAX_CELLS;

  if (area > 100) { // Very large area (> 100 km²)
    BASE_CELL_AREA = 500; // 500 m² cells
    MAX_CELLS = 5000;
    console.warn(`Large area detected (${area.toFixed(2)} km²). Using larger cell size to prevent overflow.`);
  } else if (area > 50) { // Large area (50-100 km²)
    BASE_CELL_AREA = 200; // 200 m² cells
    MAX_CELLS = 8000;
  } else if (area > 10) { // Medium area (10-50 km²)
    BASE_CELL_AREA = 100; // 100 m² cells
    MAX_CELLS = 10000;
  } else { // Small area (< 10 km²)
    BASE_CELL_AREA = 50; // 50 m² cells (original)
    MAX_CELLS = 15000;
  }

  const CELL_SIDE = Math.sqrt(BASE_CELL_AREA) * 2;

  const METERS_PER_DEGREE_LAT = 111320;
  const METERS_PER_DEGREE_LNG =
    111320 * Math.cos(10.85 * Math.PI / 180);

  const latStep = CELL_SIDE / METERS_PER_DEGREE_LAT;
  const lngStep = CELL_SIDE / METERS_PER_DEGREE_LNG;

  const originalLatCells = Math.ceil((maxLat - minLat) / latStep);
  const originalLngCells = Math.ceil((maxLng - minLng) / lngStep);
  const estimatedCells = originalLatCells * originalLngCells;

  // Safety check: if estimated cells exceed limit, increase cell size
  if (estimatedCells > MAX_CELLS) {
    const scaleFactor = Math.sqrt(estimatedCells / MAX_CELLS);
    BASE_CELL_AREA *= scaleFactor;
    console.warn(`Adjusting cell size to prevent overflow. New cell area: ${BASE_CELL_AREA.toFixed(0)} m²`);
  }

  // Reduce buffer for large areas
  const TOTAL_BUFFER_CELLS = area > 50 ? 500 : (area > 10 ? 1000 : 1400);
  const bufferLayers = Math.max(1, Math.round(Math.sqrt(TOTAL_BUFFER_CELLS / 4)));

  const expandedMinLat = minLat - (bufferLayers * latStep);
  const expandedMaxLat = maxLat + (bufferLayers * latStep);
  const expandedMinLng = minLng - (bufferLayers * lngStep);
  const expandedMaxLng = maxLng + (bufferLayers * lngStep);

  const cells = [];

  for (let lat = expandedMinLat; lat < expandedMaxLat; lat += latStep) {
    for (let lng = expandedMinLng; lng < expandedMaxLng; lng += lngStep) {

      const cellCorners = [
        [lat, lng],
        [lat + latStep, lng],
        [lat + latStep, lng + lngStep],
        [lat, lng + lngStep]
      ];

      const isInOriginalBounds =
        lat >= minLat && lat < maxLat &&
        lng >= minLng && lng < maxLng;

      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Number.isFinite(lat + latStep) &&
        Number.isFinite(lng + lngStep)
      ) {
        const inPolygon = cellIntersectsPolygon(cellCorners, polygonCoords);

        cells.push({
          minLat: lat,
          minLng: lng,
          maxLat: lat + latStep,
          maxLng: lng + lngStep,
          centerLat: lat + latStep / 2,
          centerLng: lng + lngStep / 2,
          cost: 0,
          inPolygon: inPolygon,
          isBuffer: !isInOriginalBounds
        });
      }
    }
  }

  const bufferCells = cells.filter(c => c.isBuffer).length;
  const polygonCells = cells.filter(c => c.inPolygon).length;

  console.log(`Area: ${area.toFixed(2)} km²`);
  console.log(`Cell size: ${BASE_CELL_AREA.toFixed(0)} m² (${CELL_SIDE.toFixed(1)}m x ${CELL_SIDE.toFixed(1)}m)`);
  console.log(`Buffer layers added: ${bufferLayers}`);
  console.log(`Original grid: ${originalLatCells} x ${originalLngCells} = ${originalLatCells * originalLngCells} cells`);
  console.log(`Expanded grid: ${Math.ceil((expandedMaxLat - expandedMinLat) / latStep)} x ${Math.ceil((expandedMaxLng - expandedMinLng) / lngStep)}`);
  console.log(`Total cells: ${cells.length} (${polygonCells} in polygon, ${bufferCells} buffer)`);

  // Display initial cost matrix (all zeros) - limit to prevent console overflow
  const displayLimit = Math.min(20, polygonCells);
  console.log('\n=== INITIAL COST MATRIX (After Initialization) ===');
  console.log(`All cells initialized with cost = 0`);
  console.table(cells.filter(c => c.inPolygon).slice(0, displayLimit).map((cell, idx) => ({
    id: idx,
    centerLat: cell.centerLat.toFixed(6),
    centerLng: cell.centerLng.toFixed(6),
    cost: cell.cost,
    inPolygon: cell.inPolygon ? 'Yes' : 'No'
  })));
  console.log(`(Showing first ${displayLimit} cells in polygon, total: ${polygonCells})\n`);

  return cells;
};

/* ----------------------------------------------------
   EXPAND BOUNDS TO INCLUDE SURROUNDING AREA
   Polygon is for visualization, but costs are affected by surroundings
---------------------------------------------------- */
export const expandBounds = (bounds, bufferKm = 5) => {
  // Calculate buffer in degrees (approximate)
  // 1 degree latitude ≈ 111 km
  // 1 degree longitude varies with latitude, but we'll use a conservative estimate
  const bufferDegrees = bufferKm / 111;

  const lats = bounds.map(coord => coord[0]);
  const lngs = bounds.map(coord => coord[1]);

  const minLat = Math.min(...lats) - bufferDegrees;
  const maxLat = Math.max(...lats) + bufferDegrees;
  const minLng = Math.min(...lngs) - bufferDegrees;
  const maxLng = Math.max(...lngs) + bufferDegrees;

  // Return expanded rectangular bounds
  return [
    [minLat, minLng],
    [minLat, maxLng],
    [maxLat, maxLng],
    [maxLat, minLng]
  ];
};

/* ----------------------------------------------------
   FETCH REAL STATIONS FROM DATABASE
   Fetches from expanded area (polygon + buffer) to account for surroundings
---------------------------------------------------- */
export const fetchStationsFromDB = async (bounds, type = 'charging', includeBuffer = true) => {
  try {
    // Expand bounds to include surrounding area for cost calculations
    const searchBounds = includeBuffer ? expandBounds(bounds, 5) : bounds;

    const response = await fetch('/api/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounds: searchBounds, type })
    });

    if (!response.ok) throw new Error('Failed to fetch stations');

    const { stations } = await response.json();
    console.log(`Fetched ${stations.length} ${type} stations from ${includeBuffer ? 'expanded' : 'polygon'} area`);
    return stations.map(s => [s.latitude, s.longitude]);
  } catch (error) {
    console.error('Error fetching stations:', error);
    return [];
  }
};

/* ----------------------------------------------------
   STATS GENERATION
---------------------------------------------------- */
export const generateStats = (bounds) => {
  const area = calculateArea(bounds);
  const district = findNearestDistrict(bounds);
  const data = districtData[district];

  const population = Math.floor(area * data.density);
  const totalVehicles = Math.floor(population * 0.114);
  const evVehicles = Math.floor(totalVehicles * data.evPenetration);
  const petrolVehicles = totalVehicles - evVehicles;
  const evStations = Math.max(1, Math.floor(area * data.evStationsPerKm));

  return {
    area: area.toFixed(2),
    evStations,
    petrolVehicles,
    evVehicles,
    population,
    avgIncome: data.income,
    district: district.charAt(0).toUpperCase() + district.slice(1),
    evPenetration: (data.evPenetration * 100).toFixed(1),
    density: Math.floor(population / area)
  };
};

/* ----------------------------------------------------
   HAVERSINE DISTANCE CALCULATION (in km)
---------------------------------------------------- */
const calculateDistance = (lat1, lng1, lat2, lng2) => {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

/* ----------------------------------------------------
   COST CALCULATION - CHARGING STATION PROXIMITY PENALTY
   Radial decay: Higher penalty near stations, decreasing with distance
   INVERTED: Low cost = far from stations (good), High cost = near stations (bad)
---------------------------------------------------- */
export const calculateChargingStationProximityCost = (cells, chargingStations) => {
  if (!chargingStations || chargingStations.length === 0) {
    console.log('No charging stations provided for cost calculation');
    return cells;
  }

  // Maximum penalty distance in km (beyond this, no penalty is applied)
  const MAX_PENALTY_DISTANCE = 2.0; // 2 km radius
  const MAX_PENALTY_COST = 100; // Maximum penalty cost at station location

  console.log('\n=== APPLYING CHARGING STATION PROXIMITY PENALTIES ===');
  console.log(`Processing ${cells.length} cells based on ${chargingStations.length} charging stations`);
  console.log(`Penalty parameters: Max distance = ${MAX_PENALTY_DISTANCE} km, Max penalty = ${MAX_PENALTY_COST}`);
  console.log(`Cost model: INVERTED - Low cost = far from stations (good), High cost = near stations (bad)\n`);

  cells.forEach((cell, idx) => {
    let minDistance = Infinity;

    // Find minimum distance to any charging station
    chargingStations.forEach(station => {
      const distance = calculateDistance(
        cell.centerLat,
        cell.centerLng,
        station[0],
        station[1]
      );
      minDistance = Math.min(minDistance, distance);
    });

    // Calculate penalty using radial decay model
    // INVERTED: Cells near stations get HIGH POSITIVE cost (bad for new stations)
    // Cells far from stations get LOW/NEGATIVE cost (good for new stations)
    if (minDistance <= MAX_PENALTY_DISTANCE) {
      // Quadratic decay: penalty² decreases with distance
      const distanceRatio = minDistance / MAX_PENALTY_DISTANCE; // 0 (at station) to 1 (at max distance)
      const penaltyRatio = 1 - Math.pow(distanceRatio, 2); // Quadratic decay
      cell.cost += Math.round(penaltyRatio * MAX_PENALTY_COST);
    } else {
      // Cells far from stations get NEGATIVE cost (good for placement)
      // The farther, the more negative (better)
      const excessDistance = minDistance - MAX_PENALTY_DISTANCE;
      const negativeBonus = Math.min(50, excessDistance * 10); // Cap at -50
      cell.cost -= Math.round(negativeBonus);
    }

    cell.nearestStationDistance = minDistance;
  });

  // Log statistics
  const cellsInPolygon = cells.filter(c => c.inPolygon);
  const avgCost = cellsInPolygon.reduce((sum, c) => sum + c.cost, 0) / cellsInPolygon.length;
  const maxCost = Math.max(...cellsInPolygon.map(c => c.cost));
  const minCost = Math.min(...cellsInPolygon.map(c => c.cost));
  const cellsWithPenalty = cellsInPolygon.filter(c => c.cost > 0).length;

  console.log('=== PENALTY CALCULATION RESULTS ===');
  console.log(`Cells in polygon: ${cellsInPolygon.length}`);
  console.log(`Cells with penalty (within ${MAX_PENALTY_DISTANCE} km): ${cellsWithPenalty}`);
  console.log(`Cells without penalty (beyond ${MAX_PENALTY_DISTANCE} km): ${cellsInPolygon.length - cellsWithPenalty}`);
  console.log(`Cost statistics:`);
  console.log(`  - Min cost: ${minCost}`);
  console.log(`  - Max cost: ${maxCost}`);
  console.log(`  - Average cost: ${avgCost.toFixed(2)}`);
  console.log('');

  // Display sample of cells with various penalty levels
  const sortedCells = cellsInPolygon.slice().sort((a, b) => b.cost - a.cost);
  const sampleSize = Math.min(30, cellsInPolygon.length);

  console.log(`=== COST MATRIX AFTER PROXIMITY PENALTY (Top ${sampleSize} by cost) ===`);
  console.table(sortedCells.slice(0, sampleSize).map((cell, idx) => ({
    rank: idx + 1,
    centerLat: cell.centerLat.toFixed(6),
    centerLng: cell.centerLng.toFixed(6),
    cost: cell.cost,
    nearestStation_km: cell.nearestStationDistance.toFixed(3),
    favorability: maxCost > 0 ? `${(100 * (1 - cell.cost / maxCost)).toFixed(1)}%` : '100%'
  })));

  // Display full cost distribution
  const costDistribution = {};
  cellsInPolygon.forEach(cell => {
    const costBucket = Math.floor(cell.cost / 10) * 10;
    costDistribution[costBucket] = (costDistribution[costBucket] || 0) + 1;
  });

  console.log('\n=== COST DISTRIBUTION ===');
  const distTable = Object.entries(costDistribution)
    .sort((a, b) => parseInt(b[0]) - parseInt(a[0])) // Sort by cost descending
    .map(([cost, count]) => ({
      costRange: `${cost}-${parseInt(cost) + 9}`,
      cellCount: count,
      percentage: `${(100 * count / cellsInPolygon.length).toFixed(1)}%`
    }));

  console.table(distTable);

  console.log('\n'); return cells;
};

/* ----------------------------------------------------
   GRID VISUALIZATION (RECTANGLES)
---------------------------------------------------- */
export const visualizeGridCells = (map, cells) => {
  const visibleCells = cells.filter(c => c.inPolygon);

  console.log('=== GRID CELLS COST MATRIX ===');
  console.log(`Total cells: ${cells.length}`);
  console.log(`Cells in polygon: ${cells.filter(c => c.inPolygon).length}`);
  console.log(`Buffer cells: ${cells.filter(c => c.isBuffer).length}`);
  console.log('');

  // Limit console.table to prevent overflow
  const tableLimit = Math.min(50, cells.length);
  console.table(cells.slice(0, tableLimit).map((cell, idx) => ({
    id: idx,
    centerLat: cell.centerLat.toFixed(6),
    centerLng: cell.centerLng.toFixed(6),
    cost: cell.cost,
    nearestStation: cell.nearestStationDistance ? `${cell.nearestStationDistance.toFixed(3)} km` : 'N/A',
    inPolygon: cell.inPolygon ? 'Yes' : 'No',
    isBuffer: cell.isBuffer ? 'Yes' : 'No'
  })));

  if (cells.length > tableLimit) {
    console.log(`(Showing first ${tableLimit} of ${cells.length} cells to prevent console overflow)`);
  }
  console.log('');

  const gridLayer = L.layerGroup();

  visibleCells.forEach((cell, idx) => {
    if (
      !Number.isFinite(cell.minLat) ||
      !Number.isFinite(cell.minLng) ||
      !Number.isFinite(cell.maxLat) ||
      !Number.isFinite(cell.maxLng)
    ) return;

    const rect = L.rectangle(
      [
        [cell.minLat, cell.minLng],
        [cell.maxLat, cell.maxLng]
      ],
      {
        color: '#7c3aed',
        weight: 1,
        fillColor: '#a78bfa',
        fillOpacity: 0.35
      }
    );

    rect.bindPopup(
      `<strong>Grid Cell ${idx + 1}</strong><br/>` +
      `Cost: ${cell.cost}<br/>` +
      `Nearest Station: ${cell.nearestStationDistance ? cell.nearestStationDistance.toFixed(3) + ' km' : 'N/A'}<br/>` +
      `In Polygon: Yes`
    );

    gridLayer.addLayer(rect);
  });

  gridLayer.addTo(map);
  return gridLayer;
};

export const randomPointInBounds = (bounds) => {
  const lats = bounds.map(b => b[0]);
  const lngs = bounds.map(b => b[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const lat = minLat + Math.random() * (maxLat - minLat);
  const lng = minLng + Math.random() * (maxLng - minLng);

  return [lat, lng];
};

export const generateRandomPointsInPolygon = (polyCoords, count) => {
  if (!polyCoords || polyCoords.length < 3) return [];

  const points = [];
  let attempts = 0;

  while (points.length < count && attempts < count * 50) {
    const p = randomPointInBounds(polyCoords);
    if (pointInPolygon(p, polyCoords)) {
      points.push(p);
    }
    attempts++;
  }

  return points;
};