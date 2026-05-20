@echo off
setlocal

REM Go to the folder where this BAT file lives: source\wide
cd /d "%~dp0"

REM Output folder relative to source\wide
set "OUT=..\..\site\images\wide"

if not exist "%OUT%" mkdir "%OUT%"

echo Converting tile images...
echo.

for %%F in (*.png *.jpg *.jpeg) do (
    echo Processing: %%F
    magick "%%F" -resize 1200x -quality 82 "%OUT%\%%~nF.webp"
)

echo.
echo Done.
pause
