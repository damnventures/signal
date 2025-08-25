'use client';

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';

const inter = Inter({ subsets: ["latin"] });



export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [loading, setLoading] = useState(true);
  const [speedUp, setSpeedUp] = useState(false);

  useEffect(() => {
    const initialLoadTimer = setTimeout(() => {
      setSpeedUp(true); // Trigger speed-up animation
      const hideOverlayTimer = setTimeout(() => {
        setLoading(false); // Hide overlay after speed-up
      }, 500); // Adjust this duration to match your speed-up animation time
      return () => clearTimeout(hideOverlayTimer);
    }, 3000); // Initial loading for 3 seconds

    return () => clearTimeout(initialLoadTimer);
  }, []);

  return (
    <html lang="en">
      <body className={inter.className}>
        {loading && (
          <div className="loading-overlay">
            <div className={`loading-bar ${speedUp ? 'speed-up' : ''}`}></div>
          </div>
        )}
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
