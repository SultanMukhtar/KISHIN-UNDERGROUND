@echo off
setlocal
cd /d "%~dp0"
title Underground - Server Lokal

where node >nul 2>nul
if errorlevel 1 goto nonode

set "ENVF="
if exist ".env.local" set "ENVF=.env.local"
if not defined ENVF if exist ".env" set "ENVF=.env"
if defined ENVF goto checksecret

echo.
echo ================================================================
echo  Kunci Supabase belum diisi. Ambil di Supabase - Project Settings:
echo   1. Data API  : Project URL (https://xxxx.supabase.co)
echo   2. API Keys  : Publishable key (sb_publishable_...)
echo   3. API Keys  : Secret key (sb_secret_...)
echo ================================================================
echo.
set /p SB_URL=1. Paste Project URL: 
set /p SB_KEY=2. Paste publishable key: 
set /p SB_SECRET=3. Paste secret key: 
if "%SB_URL%"=="" goto nokey
if "%SB_KEY%"=="" goto nokey
if "%SB_SECRET%"=="" goto nokey
> .env.local echo NEXT_PUBLIC_SUPABASE_URL=%SB_URL%
>> .env.local echo NEXT_PUBLIC_SUPABASE_ANON_KEY=%SB_KEY%
>> .env.local echo SUPABASE_SECRET_KEY=%SB_SECRET%
echo Kunci disimpan ke .env.local
goto install

:checksecret
findstr /b /c:"SUPABASE_SECRET_KEY=sb_secret_" "%ENVF%" >nul && goto install
findstr /b /c:"SUPABASE_SECRET_KEY=eyJ" "%ENVF%" >nul && goto install
echo.
echo ================================================================
echo  %ENVF% belum punya SUPABASE_SECRET_KEY (buat login ^& akun admin).
echo  Ambil di Supabase - Project Settings - API Keys - Secret key.
echo  Aman: key ini cuma dibaca server, gak dikirim ke browser.
echo ================================================================
echo.
set /p SB_SECRET=Paste secret key (sb_secret_...): 
if "%SB_SECRET%"=="" goto nokey
>> "%ENVF%" echo.
>> "%ENVF%" echo SUPABASE_SECRET_KEY=%SB_SECRET%
echo Secret key ditambahkan ke %ENVF%

:install
if not exist "node_modules\next" goto doinstall
if exist "node_modules\@fontsource-variable\archivo" goto run
:doinstall
echo Install paket dulu, sekali aja, kira-kira 1-2 menit...
call npm install
if errorlevel 1 goto failinstall

:run
echo.
echo ================================================================
echo  Halaman penonton : http://localhost:3000
echo  Panel panitia    : http://localhost:3000/admin
echo  Tutup jendela ini (atau Ctrl+C) buat matiin server.
echo ================================================================
echo.
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3000/admin"
call npm run dev
pause
exit /b 0

:nonode
echo Node.js belum terinstall. Download versi LTS di https://nodejs.org lalu jalankan file ini lagi.
start "" https://nodejs.org
pause
exit /b 1

:nokey
echo Ada yang kosong. Jalankan file ini lagi dan paste semuanya.
pause
exit /b 1

:failinstall
echo npm install gagal. Cek koneksi internet lalu coba lagi.
pause
exit /b 1
