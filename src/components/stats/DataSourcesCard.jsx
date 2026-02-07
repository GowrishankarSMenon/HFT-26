import React from 'react';

const DataSourcesCard = () => (
  <div className="mt-6 p-3 bg-gray-100 rounded-lg text-xs text-gray-600">
    <p className="font-semibold mb-2">Data Sources:</p>
    <ul className="space-y-1 list-disc list-inside">
      <li>Kerala Census 2024 (35.3M population)</li>
      <li>RBI Kerala Income Report 2024</li>
      <li>KSEB EV Infrastructure (960 stations)</li>
      <li>Kerala MVD Vehicle Statistics</li>
    </ul>
  </div>
);

export default DataSourcesCard;