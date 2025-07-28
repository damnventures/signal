<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Retro Apple OS</title>
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Monaco', 'Menlo', monospace;
            background: #c0c0c0;
            background-image: 
                radial-gradient(circle, #000 1px, transparent 1px);
            background-size: 4px 4px;
            background-position: 0 0, 2px 2px;
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            padding: 20px;
            box-sizing: border-box;
        }

        .window {
            background: #ffffff;
            border: 2px solid #000000;
            box-shadow: 
                2px 2px 0px #808080,
                4px 4px 0px #404040;
            max-width: 500px;
            width: 100%;
            position: relative;
        }

        .window-content {
            padding: 40px 30px 30px 30px;
            background: #ffffff;
        }

        .window-title {
            font-size: 18px;
            font-weight: bold;
            color: #000000;
            margin: 0 0 15px 0;
            line-height: 1.2;
        }

        .window-text {
            font-size: 14px;
            color: #000000;
            margin: 0;
            line-height: 1.4;
        }

        .app-name {
            font-size: 12px;
            color: #000000;
            margin: 10px 0 0 0;
            font-weight: normal;
        }

        /* Responsive adjustments */
        @media (max-width: 600px) {
            .window {
                margin: 10px;
            }
            
            .window-content {
                padding: 30px 20px 20px 20px;
            }
            
            .window-title {
                font-size: 16px;
            }
            
            .window-text {
                font-size: 13px;
            }
        }
    </style>
</head>
<body>
    <div class="window">
        <div class="window-content">
            <h1 class="window-title">Good morning, Vanya.<br>Here is your summary</h1>
            <p class="app-name">AppleTalk</p>
        </div>
    </div>
</body>
</html>