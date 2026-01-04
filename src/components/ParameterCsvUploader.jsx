'use client';

import { useState } from 'react';
import Papa from 'papaparse';

const REQUIRED = ['latitude', 'longitude', 'parameter', 'weight', 'proportionality'];

export default function ParameterCsvUploader({ userId }) {
  const [raw, setRaw] = useState([]);
  const [cols, setCols] = useState([]);
  const [map, setMap] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const upload = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: r => {
        setRaw(r.data);
        setCols(Object.keys(r.data[0]));
      }
    });
  };

  const submit = async () => {
    if (!map.latitude || !map.longitude) {
      setError('Latitude & Longitude mapping is required');
      return;
    }

    const rows = raw.map(r => ({
      latitude: Number(r[map.latitude]),
      longitude: Number(r[map.longitude]),
      parameter: r[map.parameter],
      weight: r[map.weight],
      proportionality: r[map.proportionality]
    }));

    if (rows.some(r => isNaN(r.latitude) || isNaN(r.longitude))) {
      setError('Invalid latitude / longitude values');
      return;
    }

    setLoading(true);
    setError('');

    const res = await fetch('/api/user-params-csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, rows })
    });

    setLoading(false);

    if (!res.ok) {
      setError('Failed to save data');
      return;
    }

    alert('CSV processed & saved!');
  };

  return (
    <div className="bg-black text-white p-8 rounded-xl space-y-6">
      <h2 className="text-2xl font-semibold text-green-400">
        Upload Parameter CSV
      </h2>

      <input type="file" accept=".csv" onChange={upload} className="text-white" />

      {cols.length > 0 && (
        <div className="space-y-4">
          {REQUIRED.map(f => (
            <div key={f} className="flex items-center gap-4">
              <span className="w-48 capitalize">{f}</span>
              <select
                className="bg-black border border-green-500 p-2 rounded w-full"
                onChange={e => setMap(m => ({ ...m, [f]: e.target.value }))}
              >
                <option value="">Select column</option>
                {cols.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      )}

      {error && <p className="text-red-400">{error}</p>}

      <button
        onClick={submit}
        disabled={loading}
        className="bg-green-600 text-black px-6 py-2 rounded font-semibold"
      >
        {loading ? 'Saving...' : 'Submit'}
      </button>
    </div>
  );
}
