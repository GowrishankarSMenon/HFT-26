import React from 'react';
import { Maximize2 } from 'lucide-react';

const AreaCard = ({ area }) => (
  <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
    <div className="flex items-center gap-2 mb-2">
      <Maximize2 size={20} className="text-blue-600" />
      <h3 className="font-semibold text-gray-900">Area</h3>
    </div>
    <p className="text-2xl font-bold text-blue-600">{area} km²</p>
  </div>
);

export default AreaCard;