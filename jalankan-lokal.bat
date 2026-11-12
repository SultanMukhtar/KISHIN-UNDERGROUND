@echo off
setlocal
cd /d "%~dp0"
title 1C Underground Fight - Server Lokal

where node >nul 2>nul
if errorlevel 1 goto nonode

if exist ".env.local" goto install
if exist ".env" goto install
echo.
echo ================================================================
echo  Kunci Supabase belum diisi.
echo  Project URL    : Project Settings - Data API (https://xxxx.supabase.co)
echo  Publishable key: Project Settings - API Keys (sb_publishable_...)
echo  JANGAN pakai secret key (sb_secret_...)
echo ================================================================
echo.
set /p SB_URL=Paste Project URL (https://xxxx.supabase.co): 
set /p SB_KEY=Paste publishable key: 
if "%SB_URL%"=="" goto nokey
if "%SB_KEY%"=="" goto nokey
> .env.local echo NEXT_PUBLIC_SUPABASE_URL=%SB_URL%
>> .env.local echo NEXT_PUBLIC_SUPABASE_ANON_KEY=%SB_KEY%
echo Kunci disimpan ke .env.local
echo.

:install
if exist "node_modules\next" goto run
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
start "" cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:3000"
call npm run dev
pause
exit /b 0

:nonode
echo Node.js belum terinstall. Download versi LTS di https://nodejs.org lalu jalankan file ini lagi.
start "" https://nodejs.org
pause
exit /b 1

:nokey
echo URL atau key kosong. Jalankan file ini lagi dan paste dua-duanya.
pause
exit /b 1

:failinstall
echo npm install gagal. Cek koneksi internet lalu coba lagi.
pause
exit /b 1
