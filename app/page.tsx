import React from 'react';
import CapsuleSignal from './components/CapsuleSignal';

const HomePage = () => {
  return (
    <main className="main-container">
      <div className="window">
        {/* Message Content */}
        <div className="window-content">
          <h1 className="main-heading">
            Good morning, Vanya
          </h1>
          <p className="main-text">
            Here is your summary AppleTalk. Start exploring your application, customize it by editing the code, and deploy it with ease.
          </p>
          <CapsuleSignal />
        </div>
      </div>
    </main>
  );
};

export default HomePage;
