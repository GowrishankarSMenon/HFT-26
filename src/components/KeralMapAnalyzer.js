import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from './Header';
import MapView from './MapView';
import StatsPanel from './StatsPanel';
import { generateStats, generateRandomPointsInPolygon, generateGridCells, visualizeGridCells } from '../utils/mapUtils';

const KeralMapAnalyzer = () => {
  const mapRef = useRef(null);
  const [map, setMap] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [polygon, setPolygon] = useState(null);
  const [stats, setStats] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [showCharging, setShowCharging] = useState(false);
  const [showPetrol, setShowPetrol] = useState(false);
  const [chargingLayer, setChargingLayer] = useState(null);
  const [petrolLayer, setPetrolLayer] = useState(null);
  const [gridLayer, setGridLayer] = useState(null);
  const [showGrid, setShowGrid] = useState(false);
  const gridLayerRef = useRef(null);

  useEffect(() => {
    const mapInstance = L.map(mapRef.current).setView([10.8505, 76.2711], 8);
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapInstance);

    setMap(mapInstance);

    return () => mapInstance.remove();
  }, []);

  const plotMarkers = (type) => {
    if (!map) return;
    const poly = currentPath.length >= 3 ? currentPath : null;
    let points = [];
    
    if (type === 'charging') {
      const count = stats ? Math.max(1, stats.evStations) : 10;
      points = poly ? generateRandomPointsInPolygon(poly, count) : 
        generateRandomPointsInPolygon([[10.5,75.5],[11.5,75.5],[11.5,77.5],[10.5,77.5]], count);
      const layer = L.layerGroup();
      points.forEach((p, i) => {
        const marker = L.circleMarker(p, { 
          radius: 6, color: '#059669', fillColor: '#10b981', fillOpacity: 0.9 
        });
        marker.bindPopup(`<strong>Charging Station</strong><br/>ID: CH-${i + 1}`);
        layer.addLayer(marker);
      });
      layer.addTo(map);
      setChargingLayer(layer);
    } else if (type === 'petrol') {
      const count = stats ? Math.max(3, Math.floor(stats.petrolVehicles / 2000)) : 20;
      points = poly ? generateRandomPointsInPolygon(poly, count) : 
        generateRandomPointsInPolygon([[10.5,75.5],[11.5,75.5],[11.5,77.5],[10.5,77.5]], count);
      const layer = L.layerGroup();
      points.forEach((p, i) => {
        const marker = L.circleMarker(p, { 
          radius: 5, color: '#b91c1c', fillColor: '#ef4444', fillOpacity: 0.9 
        });
        marker.bindPopup(`<strong>Petrol Station</strong><br/>ID: P-${i + 1}`);
        layer.addLayer(marker);
      });
      layer.addTo(map);
      setPetrolLayer(layer);
    }
  };

  const startDrawing = () => {
    if (!map) return;
    setDrawing(true);
    setCurrentPath([]);
    if (polygon) {
      map.removeLayer(polygon);
      setPolygon(null);
    }
    setStats(null);
  };

  const handleMapClick = (e) => {
    if (!drawing || !map) return;
    
    const latlng = e.latlng;
    const newPath = [...currentPath, [latlng.lat, latlng.lng]];
    setCurrentPath(newPath);

    if (polygon) map.removeLayer(polygon);

    const newPolygon = L.polygon(newPath, {
      color: '#3b82f6',
      fillColor: '#3b82f6',
      fillOpacity: 0.2,
      weight: 3
    }).addTo(map);
    
    setPolygon(newPolygon);
  };

  const finishDrawing = () => {
  if (currentPath.length < 3) {
    alert('Please draw at least 3 points to create a polygon');
    return;
  }

  setDrawing(false);

  const generatedStats = generateStats(currentPath);
  setStats(generatedStats);

  // 🔹 Generate grid cells
  const cells = generateGridCells(currentPath);
  console.log('Total grid cells generated:', cells.length);

  // 🔹 CLEAR old grid layer if it exists
  if (gridLayerRef.current) {
    gridLayerRef.current.remove();
    gridLayerRef.current = null;
  }

  // 🔹 VISUALIZE grid cells
  gridLayerRef.current = visualizeGridCells(map, cells);
};


  const clearPolygon = () => {
    if (polygon && map) {
      map.removeLayer(polygon);
      setPolygon(null);
      setStats(null);
      setCurrentPath([]);
      setDrawing(false);
      if (petrolLayer) { petrolLayer.remove(); setPetrolLayer(null); }
      if (chargingLayer) { chargingLayer.remove(); setChargingLayer(null); }
      if (gridLayer) { gridLayer.remove(); setGridLayer(null); }
      if (gridLayerRef.current) { gridLayerRef.current.remove(); gridLayerRef.current = null; }
      setShowPetrol(false);
      setShowCharging(false);
      setShowGrid(false);
    }
  };

  const exportData = () => {
    if (!stats) return;
    const data = JSON.stringify(stats, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'area-analysis.json';
    a.click();
  };

  const generateGridCellsLocal = (polygonCoords) => {
    if (!polygonCoords || polygonCoords.length < 3) return [];

    const lats = polygonCoords.map(p => p[0]);
    const lngs = polygonCoords.map(p => p[1]);

    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    const CELL_AREA = 50; // m²
    const CELL_SIDE = Math.sqrt(CELL_AREA);
    const METERS_PER_DEGREE_LAT = 111320;
    const METERS_PER_DEGREE_LNG = 111320 * Math.cos(10.85 * Math.PI / 180);

    const latStep = CELL_SIDE / METERS_PER_DEGREE_LAT;
    const lngStep = CELL_SIDE / METERS_PER_DEGREE_LNG;

    const cells = [];

    for (let lat = minLat; lat <= maxLat; lat += latStep) {
      for (let lng = minLng; lng <= maxLng; lng += lngStep) {
        const cellCorners = [
          [lat, lng],
          [lat + latStep, lng],
          [lat + latStep, lng + lngStep],
          [lat, lng + lngStep]
        ];

        if (cellIntersectsPolygonLocal(cellCorners, polygonCoords)) {
          cells.push({
            centerLat: lat + latStep / 2,
            centerLng: lng + lngStep / 2,
            cost: 0
          });
        }
      }
    }

    return cells;
  };

  const cellIntersectsPolygonLocal = (cellCorners, polygon) => {
    for (const corner of cellCorners) {
      if (pointInPolygonLocal(corner, polygon)) return true;
    }

    const lats = cellCorners.map(p => p[0]);
    const lngs = cellCorners.map(p => p[1]);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);

    for (const [plat, plng] of polygon) {
      if (plat >= minLat && plat <= maxLat && plng >= minLng && plng <= maxLng) {
        return true;
      }
    }

    return false;
  };

  const pointInPolygonLocal = (point, vs) => {
    const x = point[1], y = point[0];
    let inside = false;
    for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
      const xi = vs[i][1], yi = vs[i][0];
      const xj = vs[j][1], yj = vs[j][0];
      const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 0.0) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  const handleToggleCharging = () => {
    const next = !showCharging;
    setShowCharging(next);
    if (!next) {
      if (chargingLayer) { chargingLayer.remove(); setChargingLayer(null); }
    } else {
      plotMarkers('charging');
    }
  };

  const handleTogglePetrol = () => {
    const next = !showPetrol;
    setShowPetrol(next);
    if (!next) {
      if (petrolLayer) { petrolLayer.remove(); setPetrolLayer(null); }
    } else {
      plotMarkers('petrol');
    }
  };

  const handleToggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    if (!next) {
      if (gridLayer) { gridLayer.remove(); setGridLayer(null); }
    } else {
      if (stats && currentPath.length >= 3) {
        const cells = generateGridCellsLocal(currentPath);
        const layer = visualizeGridCells(map, cells);
        setGridLayer(layer);
      }
    }
  };

  useEffect(() => {
    if (map) {
      map.on('click', handleMapClick);
      return () => map.off('click', handleMapClick);
    }
  }, [map, drawing, currentPath]);

  return (
    <div className="h-screen w-full flex flex-col bg-gray-50">
      <Header
        drawing={drawing}
        onStartDrawing={startDrawing}
        onFinishDrawing={finishDrawing}
        showCharging={showCharging}
        showPetrol={showPetrol}
        onToggleCharging={handleToggleCharging}
        onTogglePetrol={handleTogglePetrol}
        hasPolygon={!!polygon}
        onClear={clearPolygon}
        onExport={exportData}
        showGrid={showGrid}
        onToggleGrid={handleToggleGrid}
      />
      
      <div className="flex-1 flex overflow-hidden">
        <MapView 
          mapRef={mapRef} 
          drawing={drawing} 
          pointCount={currentPath.length} 
        />
        <StatsPanel stats={stats} />
      </div>
    </div>
  );
};

export default KeralMapAnalyzer;


