@echo off
setlocal
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
    echo [LOI] Khong tim thay Node.js tren may.
    echo Vui long cai dat Node.js LTS tai https://nodejs.org roi chay lai file nay.
    pause
    exit /b 1
)

if not exist ".env" (
    if exist ".env.example" (
        copy ".env.example" ".env" >nul
        echo Da tao file .env moi. Vui long mo file .env va dien GEMINI_API_KEY truoc khi dung chatbot.
        echo Lay API key mien phi tai: https://aistudio.google.com/apikey
        echo.
    )
)

if not exist "node_modules" (
    echo Dang cai dat thu vien lan dau tien, vui long doi...
    call npm install
    if errorlevel 1 (
        echo Cai dat that bai. Kiem tra ket noi mang roi chay lai start.bat.
        pause
        exit /b 1
    )
)

echo Dang khoi dong Chatbot sua loi dien dat...
start "Chatbot sua loi dien dat - server" cmd /k "npm start"
timeout /t 3 >nul
start "" http://localhost:3099

endlocal
