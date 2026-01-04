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
   GRID GENERATION (50 m² base, +1400 buffer cells)
---------------------------------------------------- */
export const generateGridCells = (polygonCoords) => {
  if (!polygonCoords || polygonCoords.length < 3) return [];

  const lats = polygonCoords.map(p => p[0]);
  const lngs = polygonCoords.map(p => p[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  const BASE_CELL_AREA = 50;
  const CELL_SIDE = Math.sqrt(BASE_CELL_AREA) * 2;

  const METERS_PER_DEGREE_LAT = 111320;
  const METERS_PER_DEGREE_LNG =
    111320 * Math.cos(10.85 * Math.PI / 180);

  const latStep = CELL_SIDE / METERS_PER_DEGREE_LAT;
  const lngStep = CELL_SIDE / METERS_PER_DEGREE_LNG;

  const originalLatCells = Math.ceil((maxLat - minLat) / latStep);
  const originalLngCells = Math.ceil((maxLng - minLng) / lngStep);

  const TOTAL_BUFFER_CELLS = 1400;
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

  console.log(`Buffer layers added: ${bufferLayers}`);
  console.log(`Original grid: ${originalLatCells} x ${originalLngCells} = ${originalLatCells * originalLngCells} cells`);
  console.log(`Expanded grid: ${Math.ceil((expandedMaxLat - expandedMinLat) / latStep)} x ${Math.ceil((expandedMaxLng - expandedMinLng) / lngStep)}`);
  console.log(`Total cells: ${cells.length} (${polygonCells} in polygon, ${bufferCells} buffer)`);

  return cells;
};

/* ----------------------------------------------------
   FETCH REAL STATIONS FROM DATABASE
---------------------------------------------------- */
export const fetchStationsFromDB = async (bounds, type = 'charging') => {
  try {
    const response = await fetch('/api/stations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bounds, type })
    });

    if (!response.ok) throw new Error('Failed to fetch stations');

    const { stations } = await response.json();
    return stations.map(s => [s.Latitude, s.Longitude]);
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
   GRID VISUALIZATION (RECTANGLES)
---------------------------------------------------- */
export const visualizeGridCells = (map, cells) => {
  const visibleCells = cells.filter(c => c.inPolygon);

  console.log('=== GRID CELLS MATRIX ===');
  console.log(`Total cells: ${cells.length}`);
  console.log(`Cells in polygon: ${cells.filter(c => c.inPolygon).length}`);
  console.log(`Buffer cells: ${cells.filter(c => c.isBuffer).length}`);
  console.log('');

  console.table(cells.map((cell, idx) => ({
    id: idx,
    centerLat: cell.centerLat.toFixed(6),
    centerLng: cell.centerLng.toFixed(6),
    minLat: cell.minLat.toFixed(6),
    minLng: cell.minLng.toFixed(6),
    maxLat: cell.maxLat.toFixed(6),
    maxLng: cell.maxLng.toFixed(6),
    cost: cell.cost,
    inPolygon: cell.inPolygon ? 'Yes' : 'No',
    isBuffer: cell.isBuffer ? 'Yes' : 'No'
  })));

  console.log('Raw cells array:', cells);
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
      `<strong>Grid Cell ${idx + 1}</strong><br/>Cost: ${cell.cost}<br/>In Polygon: Yes`
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