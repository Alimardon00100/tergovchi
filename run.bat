@echo off
setlocal EnableExtensions DisableDelayedExpansion
chcp 65001 >nul
title Tergov doskasi
set "RUN_EXIT_CODE=1"
set "PROJECT_DIRECTORY_ENTERED="
set "NO_PAUSE="
if /I "%~1"=="--no-pause" set "NO_PAUSE=1"
if /I "%~2"=="--no-pause" set "NO_PAUSE=1"

if /I "%~1"=="--help" goto :help
if /I "%~1"=="--stop" goto :stop_services

pushd "%~dp0" >nul 2>&1
if errorlevel 1 goto :directory_failed
set "PROJECT_DIRECTORY_ENTERED=1"

echo.
echo Tergov doskasi ishga tushirilmoqda...
echo.

where node.exe >nul 2>&1
if errorlevel 1 goto :node_missing
if exist ".tools\node_modules\pnpm\bin\pnpm.cjs" goto :package_manager_ready
where npm.cmd >nul 2>&1
if errorlevel 1 goto :npm_missing
echo pnpm 9.15.9 loyiha ichiga o'rnatilmoqda...
call npm.cmd install --prefix ".tools" --cache ".cache/npm" --no-audit --no-fund pnpm@9.15.9
if errorlevel 1 goto :package_manager_failed

:package_manager_ready
node scripts\start-local.mjs %*
set "RUN_EXIT_CODE=%ERRORLEVEL%"
if not "%RUN_EXIT_CODE%"=="0" goto :startup_failed

echo.
echo Tayyor: PostgreSQL va Redis ishlayapti.
echo Migratsiya, boshlang'ich ma'lumotlar va ulanishlar tekshirildi.
echo Brauzer interfeysi terminalda ko'rsatilgan manzilda tayyor.
echo Ishlatish bo'yicha ma'lumot: README.md
goto :finish

:help
echo Foydalanish: run.bat [--no-pause]
echo.
echo PostgreSQL 16 va Redis 7 ni loyiha ichida tayyorlaydi va ishga tushiradi.
echo Birinchi ishga tushirishda internet ulanishi kerak.
echo --stop mahalliy xizmatlarni ma'lumotlarni saqlagan holda to'xtatadi.
echo --no-browser brauzerni avtomatik ochmaydi.
echo --no-pause tugagach oynada tugma bosilishini kutmaydi.
echo Mavjud .env va bazadagi ma'lumotlar saqlanadi.
endlocal
exit /b 0

:stop_services
pushd "%~dp0" >nul 2>&1
if errorlevel 1 goto :directory_failed
set "PROJECT_DIRECTORY_ENTERED=1"
node scripts\stop-local.mjs
set "RUN_EXIT_CODE=%ERRORLEVEL%"
goto :finish

:node_missing
echo XATO: Node.js topilmadi. Node.js 22.13 yoki yangi 22.x ni o'rnating.
goto :finish

:npm_missing
echo XATO: npm topilmadi. Node.js ni npm bilan birga o'rnating.
goto :finish

:package_manager_failed
echo XATO: pnpm o'rnatilmadi. Tarmoq va yuqoridagi xatoni tekshiring.
goto :finish

:startup_failed
echo.
echo XATO: Loyiha ishga tushmadi. Yuqoridagi xato va README.md ni tekshiring.
goto :finish

:directory_failed
echo XATO: Loyiha papkasini ochib bo'lmadi.

:finish
if defined PROJECT_DIRECTORY_ENTERED popd
echo.
if not defined NO_PAUSE pause
endlocal & exit /b %RUN_EXIT_CODE%
