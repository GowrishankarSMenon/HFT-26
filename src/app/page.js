'use client';

import dynamic from 'next/dynamic';

const KeralMapAnalyzer = dynamic(() => import('../components/KeralMapAnalyzer'), { ssr: false });

export default function Home() {
  return <KeralMapAnalyzer />;
}
