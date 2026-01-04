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

  const R = 6378137; // meters
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

  area = Math.abs(area * R * R / 2); // m²
  return area / 1_000_000;           // km²
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
  // Any cell corner inside polygon
  for (const corner of cellCorners) {
    if (pointInPolygon(corner, polygon)) return true;
  }

  // Any polygon vertex inside cell bbox
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
   GRID GENERATION (50 m² base, 2× side, cost = 0)
---------------------------------------------------- */
export const generateGridCells = (polygonCoords) => {
  if (!polygonCoords || polygonCoords.length < 3) return [];

  const lats = polygonCoords.map(p => p[0]);
  const lngs = polygonCoords.map(p => p[1]);

  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);

  // Calculate center of polygon
  const centerLat = (minLat + maxLat) / 2;
  const centerLng = (minLng + maxLng) / 2;

  // Expand bounding box by 2x from center
  const latRange = (maxLat - minLat);
  const lngRange = (maxLng - minLng);

  const expandedMinLat = centerLat - latRange;
  const expandedMaxLat = centerLat + latRange;
  const expandedMinLng = centerLng - lngRange;
  const expandedMaxLng = centerLng + lngRange;

  const BASE_CELL_AREA = 50;
  const CELL_SIDE = Math.sqrt(BASE_CELL_AREA) * 2;

  const METERS_PER_DEGREE_LAT = 111320;
  const METERS_PER_DEGREE_LNG =
    111320 * Math.cos(10.85 * Math.PI / 180);

  const latStep = CELL_SIDE / METERS_PER_DEGREE_LAT;
  const lngStep = CELL_SIDE / METERS_PER_DEGREE_LNG;

  const cells = [];

  for (let lat = expandedMinLat; lat < expandedMaxLat; lat += latStep) {
    for (let lng = expandedMinLng; lng < expandedMaxLng; lng += lngStep) {

      const cellCorners = [
        [lat, lng],
        [lat + latStep, lng],
        [lat + latStep, lng + lngStep],
        [lat, lng + lngStep]
      ];

      // Generate all cells in expanded area
      if (
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        Number.isFinite(lat + latStep) &&
        Number.isFinite(lng + lngStep)
      ) {
        cells.push({
          minLat: lat,
          minLng: lng,
          maxLat: lat + latStep,
          maxLng: lng + lngStep,
          centerLat: lat + latStep / 2,
          centerLng: lng + lngStep / 2,
          cost: 0,
          inPolygon: cellIntersectsPolygon(cellCorners, polygonCoords)
        });
      }
    }
  }

  return cells;
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
  // Log grid cells matrix to console
  console.log('=== GRID CELLS MATRIX ===');
  console.log(`Total cells: ${cells.length}`);
  console.log(`Cells in polygon: ${cells.filter(c => c.inPolygon).length}`);
  console.log(`Buffer cells: ${cells.filter(c => !c.inPolygon).length}`);
  console.log('');
  
  // Log as table
  console.table(cells.map((cell, idx) => ({
    id: idx,
    centerLat: cell.centerLat.toFixed(6),
    centerLng: cell.centerLng.toFixed(6),
    minLat: cell.minLat.toFixed(6),
    minLng: cell.minLng.toFixed(6),
    maxLat: cell.maxLat.toFixed(6),
    maxLng: cell.maxLng.toFixed(6),
    cost: cell.cost,
    inPolygon: cell.inPolygon ? 'Yes' : 'No'
  })));
  
  // Log raw cells array
  console.log('Raw cells array:', cells);
  console.log('');

  const gridLayer = L.layerGroup();

  cells.forEach((cell, idx) => {
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
        color: cell.inPolygon ? '#7c3aed' : '#d1d5db',
        weight: 1,
        fillColor: cell.inPolygon ? '#a78bfa' : '#f3f4f6',
        fillOpacity: cell.inPolygon ? 0.35 : 0.15
      }
    );

    rect.bindPopup(
      `<strong>Grid Cell ${idx + 1}</strong><br/>Cost: ${cell.cost}<br/>In Polygon: ${cell.inPolygon}`
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
