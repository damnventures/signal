import Image from "next/image";

export default function Home() {
  return (
    <div className="font-sans flex items-center justify-center min-h-screen p-4 sm:p-8 md:p-20 bg-gray-100 dark:bg-gray-900">
      <style jsx global>{`
        @font-face {
          font-family: 'ChicagoFLF';
          src: url('/fonts/ChicagoFLF.woff2') format('woff2'),
              url('/fonts/ChicagoFLF.woff') format('woff');
          font-weight: 500;
          font-style: normal;
          font-display: swap;
        }
      `}</style>
      <main className="flex flex-col gap-8 items-center w-full max-w-2xl">
        {/* Welcome Message with OS Window Style */}
        <div className="w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-md overflow-hidden mb-24">
          {/* OS Window Top Bar */}
          <div className="flex items-center bg-gray-200 dark:bg-gray-700 px-4 py-2">
            <div className="flex space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500"></div>
              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
            </div>
            <span className="flex-1 text-center text-sm font-medium text-gray-700 dark:text-gray-300 font-[ChicagoFLF]">
              Welcome to Your App
            </span>
          </div>
          {/* Message Content */}
          <div className="p-6 sm:p-8">
            <h1 className="text-2xl sm:text-3xl font-[ChicagoFLF] text-center sm:text-left text-gray-900 dark:text-white mb-4">
              Good morning, User
            </h1>
            <p className="text-base sm:text-lg font-['Geneva',_sans-serif] text-gray-700 dark:text-gray-300 text-center sm:text-left">
              Here is your summary AppleTalk. Start exploring your application, customize it by editing the code, and deploy it with ease.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}