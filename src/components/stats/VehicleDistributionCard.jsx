import React from 'react';
import { Car } from 'lucide-react';
import StatCard from './StatCard';

const VehicleDistributionCard = ({ stats }) => (
  <StatCard 
    title="Vehicle Distribution" 
    icon={Car} 
    color="orange"
    footer="Based on Kerala's vehicle ownership rate of 11.4%"
  >
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-gray-600">Petrol/Diesel</span>
        <span className="font-semibold text-gray-900">{stats.petrolVehicles.toLocaleString()}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Total Vehicles</span>
        <span className="font-semibold text-gray-900">
          {(stats.evVehicles + stats.petrolVehicles).toLocaleString()}
        </span>
      </div>
    </div>
  </StatCard>
);

export default VehicleDistributionCard;