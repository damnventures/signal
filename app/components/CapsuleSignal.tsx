"use client";

import React, { useState, useEffect } from 'react';

const CapsuleSignal = () => {
  const [signal, setSignal] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSignal = async () => {
      try {
        const response = await fetch('/api/capsule-signal');
        if (!response.ok) {
          throw new Error('Failed to fetch signal');
        }
        const data = await response.json();
        setSignal(data);
      } catch (error: unknown) {
        setError((error as Error).message);
      }
    };

    fetchSignal();
  }, []);

  return (
    <div>
      {error && <p>Error: {error}</p>}
      {signal && <pre>{JSON.stringify(signal, null, 2)}</pre>}
    </div>
  );
};

export default CapsuleSignal;
