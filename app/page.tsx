import React from 'react';

const HomePage = async () => {
  let capsuleContent = "";
  try {
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/capsule-signal`;

    console.log(`[HomePage] Attempting to fetch from: ${apiUrl}`);

    const response = await fetch(apiUrl);

    console.log(`[HomePage] Received response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HomePage] Failed to fetch capsule signal: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Failed to fetch capsule signal: ${response.statusText} - ${errorText}`);
    }
    const data = await response.json();
    capsuleContent = data.highlights || JSON.stringify(data, null, 2);
    console.log(`[HomePage] Successfully fetched capsule content.`);
  } catch (error: any) {
    console.error(`[HomePage] Error fetching capsule content: ${error.message}`);
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
