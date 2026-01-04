import React, { useState, useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import Header from './Header';
import MapView from './MapView';
import StatsPanel from './StatsPanel';
import {
  generateStats,
  fetchStationsFromDB,
  generateGridCells,
  visualizeGridCells,
  pointInPolygon,
  calculateChargingStationProximityCost
} from '../utils/mapUtils';
import { generateHeatMapLayer, addHeatMapLegend } from '../utils/heatMapLayer';
import { fetchPopulationDensityData, calculatePopulationDensityCost } from '../utils/populationDensityLayer';

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
  const [showHeatMap, setShowHeatMap] = useState(false);
  const [showDensityLayer, setShowDensityLayer] = useState(false);
  const gridLayerRef = useRef(null);
  const heatMapLayerRef = useRef(null);
  const heatMapLegendRef = useRef(null);
  const currentCellsRef = useRef(null);

  useEffect(() => {
    const mapInstance = L.map(mapRef.current).setView([10.8505, 76.2711], 8);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(mapInstance);

    setMap(mapInstance);

    return () => mapInstance.remove();
  }, []);

  const plotMarkersFromDB = async (type) => {
    if (!map || !currentPath || currentPath.length < 3) return;

    const stations = await fetchStationsFromDB(currentPath, type);

    if (stations.length === 0) {
      console.warn(`No ${type} stations found in the database for this area`);
      return;
    }

    // Filter stations to only those inside the polygon
    const filteredStations = stations.filter(station =>
      pointInPolygon(station, currentPath)
    );

    const layer = L.layerGroup();

    filteredStations.forEach((station, i) => {
      const marker = L.circleMarker(station, {
        radius: type === 'charging' ? 6 : 5,
        color: type === 'charging' ? '#059669' : '#b91c1c',
        fillColor: type === 'charging' ? '#10b981' : '#ef4444',
        fillOpacity: 0.9
      });

      marker.bindPopup(
        `<strong>${type === 'charging' ? 'Charging' : 'Petrol'} Station</strong><br/>ID: ${type === 'charging' ? 'CH' : 'P'}-${i + 1}<br/>Lat: ${station[0].toFixed(6)}<br/>Lng: ${station[1].toFixed(6)}`
      );

      layer.addLayer(marker);
    });

    layer.addTo(map);

    if (type === 'charging') {
      setChargingLayer(layer);
    } else {
      setPetrolLayer(layer);
    }

    console.log(`Plotted ${filteredStations.length} ${type} stations from database`);
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

  const finishDrawing = async () => {
    if (currentPath.length < 3) {
      alert('Please draw at least 3 points to create a polygon');
      return;
    }

    setDrawing(false);

    const generatedStats = generateStats(currentPath);
    setStats(generatedStats);

    // Check area size and warn user
    const area = parseFloat(generatedStats.area);
    if (area > 200) {
      const proceed = window.confirm(
        `Warning: This is a very large area (${area.toFixed(2)} km²).\n\n` +
        `Processing may take some time and use larger grid cells.\n\n` +
        `For best results, consider drawing a smaller area.\n\n` +
        `Continue anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    console.log(`Processing area: ${area.toFixed(2)} km²`);

    let cells = generateGridCells(currentPath);
    console.log('Total grid cells generated:', cells.length);

    // Fetch charging stations and calculate proximity costs
    const chargingStations = await fetchStationsFromDB(currentPath, 'charging');
    const filteredStations = chargingStations.filter(station =>
      pointInPolygon(station, currentPath)
    );

    console.log(`Applying proximity penalties based on ${filteredStations.length} charging stations`);
    cells = calculateChargingStationProximityCost(cells, filteredStations);

    // Fetch population density data and calculate density cost if layer is enabled
    if (showDensityLayer) {
      const densityData = await fetchPopulationDensityData(currentPath);
      console.log(`Applying population density cost based on ${densityData.length} density zones`);
      cells = calculatePopulationDensityCost(cells, densityData);
    }

    // Store cells for heat map toggle
    currentCellsRef.current = cells;

    // Don't show grid by default - user can toggle it on
    if (gridLayerRef.current) {
      gridLayerRef.current.remove();
      gridLayerRef.current = null;
    }

    // Only show grid if already toggled on
    if (showGrid) {
      gridLayerRef.current = visualizeGridCells(map, cells);
    }
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
      if (heatMapLayerRef.current) { heatMapLayerRef.current.remove(); heatMapLayerRef.current = null; }
      if (heatMapLegendRef.current) { heatMapLegendRef.current.remove(); heatMapLegendRef.current = null; }
      currentCellsRef.current = null;
      setShowPetrol(false);
      setShowCharging(false);
      setShowGrid(false);
      setShowHeatMap(false);
      setShowDensityLayer(false);
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

  const handleToggleCharging = async () => {
    const next = !showCharging;
    setShowCharging(next);
    if (!next) {
      if (chargingLayer) { chargingLayer.remove(); setChargingLayer(null); }
    } else {
      await plotMarkersFromDB('charging');
    }
  };

  const handleTogglePetrol = async () => {
    const next = !showPetrol;
    setShowPetrol(next);
    if (!next) {
      if (petrolLayer) { petrolLayer.remove(); setPetrolLayer(null); }
    } else {
      await plotMarkersFromDB('petrol');
    }
  };

  const handleToggleGrid = () => {
    const next = !showGrid;
    setShowGrid(next);
    if (!next) {
      if (gridLayerRef.current) { gridLayerRef.current.remove(); gridLayerRef.current = null; }
    } else {
      if (currentCellsRef.current) {
        gridLayerRef.current = visualizeGridCells(map, currentCellsRef.current);
      } else if (stats && currentPath.length >= 3) {
        const cells = generateGridCells(currentPath);
        gridLayerRef.current = visualizeGridCells(map, cells);
      }
    }
  };

  const handleToggleDensityLayer = async () => {
    const next = !showDensityLayer;
    setShowDensityLayer(next);

    if (!currentPath || currentPath.length < 3) {
      alert('Please draw and finish a polygon first');
      setShowDensityLayer(false);
      return;
    }

    // Recalculate costs with or without density layer
    let cells = generateGridCells(currentPath);

    // Always apply charging station proximity
    const chargingStations = await fetchStationsFromDB(currentPath, 'charging');
    const filteredStations = chargingStations.filter(station =>
      pointInPolygon(station, currentPath)
    );
    cells = calculateChargingStationProximityCost(cells, filteredStations);

    // Apply density cost if toggled on
    if (next) {
      const densityData = await fetchPopulationDensityData(currentPath);
      console.log(`Toggling ON population density layer with ${densityData.length} zones`);
      cells = calculatePopulationDensityCost(cells, densityData);
    } else {
      console.log('Toggling OFF population density layer');
    }

    // Update stored cells
    currentCellsRef.current = cells;

    // Update heat map if it's currently showing
    if (showHeatMap && heatMapLayerRef.current) {
      heatMapLayerRef.current.remove();
      heatMapLayerRef.current = generateHeatMapLayer(map, cells);
    }

    // Update grid if it's currently showing
    if (showGrid && gridLayerRef.current) {
      gridLayerRef.current.remove();
      gridLayerRef.current = visualizeGridCells(map, cells);
    }
  };

  const handleToggleHeatMap = () => {
    const next = !showHeatMap;
    setShowHeatMap(next);

    if (!next) {
      // Hide heat map
      if (heatMapLayerRef.current) {
        heatMapLayerRef.current.remove();
        heatMapLayerRef.current = null;
      }
      if (heatMapLegendRef.current) {
        heatMapLegendRef.current.remove();
        heatMapLegendRef.current = null;
      }
    } else {
      // Show heat map
      if (!currentCellsRef.current) {
        alert('Please draw and finish a polygon first to generate the heat map');
        setShowHeatMap(false);
        return;
      }

      if (heatMapLayerRef.current) {
        heatMapLayerRef.current.remove();
      }
      if (heatMapLegendRef.current) {
        heatMapLegendRef.current.remove();
      }

      heatMapLayerRef.current = generateHeatMapLayer(map, currentCellsRef.current);
      heatMapLegendRef.current = addHeatMapLegend(map);
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
        showHeatMap={showHeatMap}
        onToggleHeatMap={handleToggleHeatMap}
        showDensityLayer={showDensityLayer}
        onToggleDensityLayer={handleToggleDensityLayer}
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