'use client';

import { useEffect, useState } from 'react';

export default function DeploymentTest() {
  const [timestamp, setTimestamp] = useState('');
  
  useEffect(() => {
    setTimestamp(new Date().toISOString());
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-50 p-4 bg-gradient-to-r from-green-500 to-blue-500 text-white rounded-lg shadow-2xl animate-bounce">
      <div className="font-bold text-lg">✅ DEPLOYMENT VERIFIED</div>
      <div className="text-sm">Version: 2025.01.14</div>
      <div className="text-xs opacity-90">Deployed: {timestamp}</div>
      <div className="text-xs mt-2 bg-black/20 rounded p-1">
        synthex.social is receiving updates!
      </div>
    </div>
  );
}