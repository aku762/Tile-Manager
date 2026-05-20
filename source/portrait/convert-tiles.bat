@echo off
setlocal

REM Go to the folder where this BAT file lives: source\portrait
cd /d "%~dp0"

REM Output folder relative to source\portrait
set "OUT=..\..\site\images\portrait"

if not exist "%OUT%" mkdir "%OUT%"

echo Converting tile images to portrait (1080x1920)...
echo.

for %%F in (*.png *.jpg *.jpeg) do (
    echo Processing: %%F
    magick "%%F" -resize 1080x1920^ -gravity center -extent 1080x1920 -quality 82 "%OUT%\%%~nF.webp"
)

echo.
echo Done.
pause
