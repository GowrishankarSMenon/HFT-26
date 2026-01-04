'use client';

import ParameterCsvUploader from '../../components/ParameterCsvUploader';

export default function ParametersUploadPage() {
 const userId = `user_${Math.random().toString(36).substring(2, 8)}_${Date.now()}`;
 // replace later with auth

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6">
      <ParameterCsvUploader userId={userId} />
    </div>
  );
}
