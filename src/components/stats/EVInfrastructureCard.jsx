import React from 'react';
import { Zap } from 'lucide-react';
import StatCard from './StatCard';

const EVInfrastructureCard = ({ stats }) => (
  <StatCard 
    title="EV Infrastructure" 
    icon={Zap} 
    color="green"
    footer="Based on Kerala's 13.5% avg EV adoption rate (FY24)"
  >
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-gray-600">Charging Stations</span>
        <span className="font-semibold text-gray-900">{stats.evStations}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">EV Vehicles</span>
        <span className="font-semibold text-gray-900">{stats.evVehicles.toLocaleString()}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">EV Penetration</span>
        <span className="font-semibold text-gray-900">{stats.evPenetration}%</span>
      </div>
    </div>
  </StatCard>
);

export default EVInfrastructureCard;