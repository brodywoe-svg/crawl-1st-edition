@echo off
title Crawl Spell Compendium Installer
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (echo. & echo Something went wrong. See the message above.)
echo.
pause
