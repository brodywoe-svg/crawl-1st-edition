@echo off
title Crawl 1st Edition Installer
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0install.ps1"
if errorlevel 1 (echo. & echo Something went wrong. See the message above.)
echo.
pause
