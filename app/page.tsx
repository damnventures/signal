import React from 'react';

const HomePage = async () => {
  let capsuleContent = "";
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL || 'http://localhost:3000'}/api/capsule-signal`);
    if (!response.ok) {
      throw new Error(`Failed to fetch capsule signal: ${response.statusText}`);
    }
    const data = await response.json();
    capsuleContent = data.signal || JSON.stringify(data, null, 2);
  } catch (error: any) {
    capsuleContent = `Error fetching capsule content: ${error.message}`;
  }

  return (
    <main className="main-container">
      <div className="window">
        {/* Message Content */}
        <div className="window-content">
          <h1 className="main-heading">
            Good morning, Vanya
          </h1>
          <p className="main-text">
            {capsuleContent}
          </p>
        </div>
      </div>
    </main>
  );
};

export default HomePage;
