@echo off
setlocal

REM Go to the folder where this BAT file lives: source\tiles
cd /d "%~dp0"

REM Output folder relative to source\wide
set "OUT=..\..\images\wide"

if not exist "%OUT%" mkdir "%OUT%"

echo Converting tile images...
echo.

for %%F in (*.png *.jpg *.jpeg) do (
    echo Processing: %%F
    magick "%%F" -resize 900x -quality 82 "%OUT%\%%~nF.webp"
)

echo.
echo Done.
pause
