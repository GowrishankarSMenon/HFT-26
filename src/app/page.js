'use client';

import dynamic from 'next/dynamic';

const KeralMapAnalyzer = dynamic(
  () => import('../components/KeralMapAnalyzer'),
  { ssr: false }
);

export default function Home() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Kerala EV Map</h1>
      <KeralMapAnalyzer />
    </div>
  );
}
