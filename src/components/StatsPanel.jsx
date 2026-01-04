import React from 'react';
import AreaCard from './stats/AreaCard';
import EVInfrastructureCard from './stats/EVInfrastructureCard';
import VehicleDistributionCard from './stats/VehicleDistributionCard';
import DemographicsCard from './stats/DemographicsCard';
import IncomeCard from './stats/IncomeCard';
import CoordinatesCard from './stats/CoordinatesCard';
import DataSourcesCard from './stats/DataSourcesCard';

const StatsPanel = ({ stats }) => {
  if (!stats) return null;

  return (
    <div className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900">Area Analysis</h2>
          <p className="text-sm text-gray-600 mt-1">District: {stats.district}</p>
        </div>
        
        <AreaCard area={stats.area} />
        <EVInfrastructureCard stats={stats} />
        <VehicleDistributionCard stats={stats} />
        <DemographicsCard stats={stats} />
        <IncomeCard avgIncome={stats.avgIncome} />
        <CoordinatesCard coordinates={stats.coordinates} />
        <DataSourcesCard />
      </div>
    </div>
  );
};

export default StatsPanel;