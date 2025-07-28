<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Retro Apple OS</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Press+Start+2P&display=swap');
        
        /* ChicagoFLF and Geneva font fallbacks */
        @font-face {
            font-family: 'ChicagoFLF';
            src: local('Chicago'), local('ChicagoFLF');
            font-display: swap;
        }
        
        @font-face {
            font-family: 'Geneva';
            src: local('Geneva');
            font-display: swap;
        }

        body {
            margin: 0;
            padding: 0;
            font-family: sans-serif;
            background: #c0c0c0;
            background-image: 
                radial-gradient(circle, #000 1px, transparent 1px);
            background-size: 4px 4px;
            background-position: 0 0, 2px 2px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 16px;
            box-sizing: border-box;
        }

        .main-container {
            display: flex;
            flex-direction: column;
            gap: 32px;
            align-items: center;
            width: 100%;
            max-width: 672px;
        }

        .window {
            width: 100%;
            background: #ffffff;
            border: 2px solid #000000;
            box-shadow: 
                2px 2px 0px #808080,
                4px 4px 0px #404040;
            overflow: hidden;
            margin-bottom: 96px;
            position: relative;
        }

        .window-top-bar {
            display: flex;
            align-items: center;
            background: #e5e5e5;
            padding: 8px 16px;
        }

        .window-controls {
            display: flex;
            gap: 8px;
        }

        .window-control {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }

        .control-red { background: #ef4444; }
        .control-yellow { background: #eab308; }
        .control-green { background: #22c55e; }

        .window-title-bar {
            flex: 1;
            text-align: center;
            font-size: 14px;
            font-weight: 500;
            color: #374151;
            font-family: 'ChicagoFLF', 'Press Start 2P', monospace;
        }

        .window-content {
            padding: 40px 30px 30px 30px;
            background: #ffffff;
        }

        .main-heading {
            font-size: 18px;
            font-weight: bold;
            font-family: 'ChicagoFLF', 'Press Start 2P', monospace;
            text-align: center;
            color: #000000;
            margin: 0 0 15px 0;
            line-height: 1.2;
        }

        .main-text {
            font-size: 14px;
            font-family: 'Geneva', sans-serif;
            color: #000000;
            text-align: center;
            margin: 0;
            line-height: 1.4;
        }

        .app-name {
            font-size: 12px;
            color: #000000;
            margin: 10px 0 0 0;
            font-weight: normal;
            font-family: 'Geneva', sans-serif;
        }

        /* Responsive styles */
        @media (min-width: 640px) {
            body {
                padding: 32px;
            }
            
            .window-content {
                padding: 32px;
            }
            
            .main-heading {
                font-size: 24px;
                text-align: left;
            }
            
            .main-text {
                font-size: 16px;
                text-align: left;
            }
        }

        @media (min-width: 768px) {
            body {
                padding: 80px;
            }
            
            .main-heading {
                font-size: 30px;
            }
            
            .main-text {
                font-size: 18px;
            }
        }

        @media (max-width: 600px) {
            .window {
                margin: 10px;
            }
            
            .window-content {
                padding: 30px 20px 20px 20px;
            }
            
            .main-heading {
                font-size: 16px;
            }
            
            .main-text {
                font-size: 13px;
            }
        }
    </style>
</head>
<body>
    <main class="main-container">
        <div class="window">
            <!-- Message Content -->
            <div class="window-content">
                <h1 class="main-heading">
                    Good morning, Vanya
                </h1>
                <p class="main-text">
                    Here is your summary AppleTalk. Start exploring your application, customize it by editing the code, and deploy it with ease.
                </p>
            </div>
        </div>
    </main>
</body>
</html>