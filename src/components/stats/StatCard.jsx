import React from 'react';

const StatCard = ({ title, icon: Icon, color, children, footer }) => (
  <div className={`mb-6 p-4 bg-${color}-50 rounded-lg border border-${color}-200`}>
    <div className="flex items-center gap-2 mb-3">
      <Icon size={20} className={`text-${color}-600`} />
      <h3 className="font-semibold text-gray-900">{title}</h3>
    </div>
    {children}
    {footer && <div className="mt-3 text-xs text-gray-500">{footer}</div>}
  </div>
);

export default StatCard;