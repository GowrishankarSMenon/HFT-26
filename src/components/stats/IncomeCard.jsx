import React from 'react';
import { DollarSign } from 'lucide-react';

const IncomeCard = ({ avgIncome }) => (
  <div className="mb-6 p-4 bg-yellow-50 rounded-lg border border-yellow-200">
    <div className="flex items-center gap-2 mb-2">
      <DollarSign size={20} className="text-yellow-600" />
      <h3 className="font-semibold text-gray-900">Average Income</h3>
    </div>
    <p className="text-2xl font-bold text-yellow-600">₹{avgIncome.toLocaleString()}/month</p>
    <div className="mt-3 text-xs text-gray-500">
      District per capita NSDP (2024): ₹{(avgIncome * 12).toLocaleString()}/year
    </div>
  </div>
);

export default IncomeCard;