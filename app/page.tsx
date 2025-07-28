import React from 'react';
import DraggableWindow from './components/DraggableWindow';

const HomePage = async () => {
  let capsuleContent = "";
  try {
    const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000';
    const apiUrl = `${baseUrl}/api/capsule-signal`;

    console.log(`[HomePage] Attempting to fetch from: ${apiUrl}`);

    const response = await fetch(apiUrl, {
      cache: 'no-store', // Ensure fresh data
      next: { revalidate: 0 }, // Always revalidate on access
    });

    console.log(`[HomePage] Received response status: ${response.status} ${response.statusText}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[HomePage] Failed to fetch capsule signal: ${response.status} ${response.statusText} - ${errorText}`);
      throw new Error(`Failed to fetch capsule signal: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    capsuleContent = data.highlights || data.signal || JSON.stringify(data, null, 2);
    console.log(`[HomePage] Successfully fetched capsule content: ${capsuleContent}`);
  } catch (error: any) {
    console.error(`[HomePage] Error fetching capsule content: ${error.message}`);
    capsuleContent = 'Unable to load capsule content. Please try again later.';
  }

  return (
    <main className="main-container">
      <DraggableWindow>
        <div className="window-content">
          <h1 className="main-heading">Good morning, Vanya</h1>
          <p className={`main-text ${capsuleContent.startsWith('Unable') ? 'text-red-500' : ''}`}>
            {capsuleContent}
          </p>
        </div>
      </DraggableWindow>
    </main>
  );
};

export default HomePage;
