import React from 'react';
import { Users } from 'lucide-react';
import StatCard from './StatCard';

const DemographicsCard = ({ stats }) => (
  <StatCard 
    title="Demographics" 
    icon={Users} 
    color="purple"
    footer="Kerala state avg: 859 per km² (Census 2024)"
  >
    <div className="space-y-2">
      <div className="flex justify-between">
        <span className="text-gray-600">Population</span>
        <span className="font-semibold text-gray-900">{stats.population.toLocaleString()}</span>
      </div>
      <div className="flex justify-between">
        <span className="text-gray-600">Density</span>
        <span className="font-semibold text-gray-900">{stats.density} per km²</span>
      </div>
    </div>
  </StatCard>
);

export default DemographicsCard;