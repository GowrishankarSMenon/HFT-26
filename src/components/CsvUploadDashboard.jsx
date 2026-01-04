'use client';

import { useState } from 'react';
import Papa from 'papaparse';

const REQUIRED_FIELDS = [
  'latitude',
  'longitude',
  'ev_adoption_likelihood_score',
  'density_per_km2',
  'population',
  'per_capita_income'
];

export default function CsvUploadDashboard() {
  const [rawData, setRawData] = useState([]);
  const [userColumns, setUserColumns] = useState([]);
  const [mapping, setMapping] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        if (!results.data.length) {
          setError('CSV is empty');
          return;
        }
        setRawData(results.data);
        setUserColumns(Object.keys(results.data[0]));
        setError('');
      }
    });
  };

  const handleAddData = async () => {
    // Mandatory mapping check
    if (!mapping.latitude || !mapping.longitude) {
      setError('Latitude and Longitude are required');
      return;
    }

    const transformed = rawData.map(row => ({
      latitude: Number(row[mapping.latitude]),
      longitude: Number(row[mapping.longitude]),
      ev_adoption_likelihood_score: Number(row[mapping.ev_adoption_likelihood_score] ?? 0),
      density_per_km2: Number(row[mapping.density_per_km2] ?? 0),
      population: Number(row[mapping.population] ?? 0),
      per_capita_income: Number(row[mapping.per_capita_income] ?? 0)
    }));

    if (transformed.some(d => isNaN(d.latitude) || isNaN(d.longitude))) {
      setError('Invalid latitude or longitude found');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/ev-data', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: transformed })
    });

    setLoading(false);

    if (!res.ok) {
      setError('Failed to save data');
      return;
    }

    alert('Data added successfully!');
  };

  return (
    <div className="p-8 bg-white text-black rounded-xl shadow space-y-6">
      <h2 className="text-2xl font-semibold">Upload EV CSV</h2>

      <input type="file" accept=".csv" onChange={handleFileUpload} />

      {userColumns.length > 0 && (
        <>
          {REQUIRED_FIELDS.map(field => (
            <div key={field} className="flex gap-4 items-center">
              <span className="w-64">{field}</span>
              <select
                className="border p-2 rounded w-full"
                onChange={(e) =>
                  setMapping(prev => ({ ...prev, [field]: e.target.value }))
                }
              >
                <option value="">Select column</option>
                {userColumns.map(col => (
                  <option key={col} value={col}>{col}</option>
                ))}
              </select>
            </div>
          ))}
        </>
      )}

      {error && <p className="text-red-600">{error}</p>}

      <button
        onClick={handleAddData}
        disabled={loading}
        className="bg-green-600 text-white px-6 py-2 rounded"
      >
        {loading ? 'Saving...' : 'Add Data'}
      </button>
    </div>
  );
}
