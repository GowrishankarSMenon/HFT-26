'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CsvUploadDashboard from '../../components/CsvUploadDashboard';

export default function UploadPage() {
  const router = useRouter();
  const [mapData, setMapData] = useState([]);

  const handleDataReady = (data) => {
    setMapData(data);

    // OPTION 1: store in localStorage (simple & hackathon-safe)
    localStorage.setItem('ev_map_data', JSON.stringify(data));

    // redirect to map page
    router.push('/');
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-semibold mb-6">
        Upload EV CSV Data
      </h1>

      <CsvUploadDashboard onDataReady={handleDataReady} />
    </div>
  );
}
