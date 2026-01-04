import React from "react";
import {
  MapPin,
  Zap,
  Car,
  Maximize2,
  Trash2,
  Download,
  Grid3x3,
  Flame,
  Users,
} from "lucide-react";

const Header = ({
  drawing,
  onStartDrawing,
  onFinishDrawing,
  showCharging,
  showPetrol,
  onToggleCharging,
  onTogglePetrol,
  hasPolygon,
  onClear,
  onExport,
  showGrid,
  onToggleGrid,
  showHeatMap,
  onToggleHeatMap,
  showDensityLayer,
  onToggleDensityLayer,
}) => (
  <div className="bg-white border-b border-gray-200 px-6 py-4 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Kerala Map Analyzer
        </h1>
        <p className="text-sm text-gray-600 mt-1">
          Draw polygons to analyze EV infrastructure and demographics using real
          Kerala data
        </p>
      </div>
      <div className="flex gap-3">
        {!drawing ? (
          <button
            onClick={onStartDrawing}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <MapPin size={18} />
            Start Drawing
          </button>
        ) : (
          <button
            onClick={onFinishDrawing}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <Maximize2 size={18} />
            Finish Polygon
          </button>
        )}
        <button
          onClick={onToggleCharging}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium ${
            showCharging
              ? "bg-green-600 text-white hover:bg-green-700"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Zap size={16} />
          {showCharging ? "Hide Charging" : "Show Charging"}
        </button>
        <button
          onClick={onTogglePetrol}
          className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium ${
            showPetrol
              ? "bg-red-600 text-white hover:bg-red-700"
              : "bg-white text-gray-700 hover:bg-gray-100"
          }`}
        >
          <Car size={16} />
          {showPetrol ? "Hide Petrol" : "Show Petrol"}
        </button>
        {hasPolygon && (
          <button
            onClick={onToggleGrid}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium ${
              showGrid
                ? "bg-purple-600 text-white hover:bg-purple-700"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Grid3x3 size={16} />
            {showGrid ? "Hide Grid" : "Show Grid"}
          </button>
        )}
        {hasPolygon && (
          <button
            onClick={onToggleDensityLayer}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium ${
              showDensityLayer
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Users size={16} />
            {showDensityLayer ? "Density ON" : "Density OFF"}
          </button>
        )}
        {hasPolygon && (
          <button
            onClick={onToggleHeatMap}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors font-medium ${
              showHeatMap
                ? "bg-orange-600 text-white hover:bg-orange-700"
                : "bg-white text-gray-700 hover:bg-gray-100"
            }`}
          >
            <Flame size={16} />
            {showHeatMap ? "Hide Heat Map" : "Show Heat Map"}
          </button>
        )}
        {hasPolygon && (
          <>
            <button
              onClick={onClear}
              className="flex items-center gap-2 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors font-medium"
            >
              <Trash2 size={18} />
              Clear
            </button>
            <button
              onClick={onExport}
              className="flex items-center gap-2 bg-gray-700 text-white px-4 py-2 rounded-lg hover:bg-gray-800 transition-colors font-medium"
            >
              <Download size={18} />
              Export
            </button>
          </>
        )}
      </div>
    </div>
  </div>
);

export default Header;
