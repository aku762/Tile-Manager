@echo off
setlocal

REM Go to the folder where this BAT file lives: source\square
cd /d "%~dp0"

REM Output folder relative to source\square
set "OUT=..\..\site\images\square"

if not exist "%OUT%" mkdir "%OUT%"

echo Converting tile images to square (512x512)...
echo.

for %%F in (*.png *.jpg *.jpeg) do (
    echo Processing: %%F
    magick "%%F" -resize 512x512^ -gravity center -extent 512x512 -quality 82 "%OUT%\%%~nF.webp"
)

echo.
echo Done.
pause
