import React from 'react';

const CoordinatesCard = ({ coordinates }) => (
  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
    <h3 className="font-semibold text-gray-900 mb-3">Polygon Coordinates</h3>
    <div className="space-y-1 max-h-48 overflow-y-auto text-xs font-mono text-gray-600">
      {coordinates?.map((coord, i) => (
        <div key={i} className="py-1">
          Point {i + 1}: {coord}
        </div>
      ))}
    </div>
  </div>
);

export default CoordinatesCard;