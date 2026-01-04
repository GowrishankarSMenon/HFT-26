import React from "react";
import { Info } from "lucide-react";

const MapView = ({ mapRef, drawing, pointCount }) => (
  <div className="flex-1 relative z-0">
    <div ref={mapRef} className="w-full h-full" />
    {drawing && (
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg font-medium z-10">
        Click on map to draw polygon • {pointCount} points
      </div>
    )}
    <div className="absolute bottom-4 left-4 bg-white px-3 py-2 rounded-lg shadow-md text-xs text-gray-600 flex items-center gap-2 max-w-xs z-10">
      <Info size={14} className="shrink-0" />
      <span>
        Data based on Kerala Census 2024, RBI income reports, and KSEB EV
        infrastructure
      </span>
    </div>
  </div>
);

export default MapView;
