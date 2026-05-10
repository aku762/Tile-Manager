@echo off
setlocal

cd /d "%~dp0"

if not exist webp600 mkdir webp600
if not exist webp900 mkdir webp900
if not exist og mkdir og

echo Converting tile images...

for %%F in (*.png *.jpg *.jpeg) do (
    echo %%F

    magick "%%F" -resize 600x -quality 82 "webp600\%%~nF.webp"
    magick "%%F" -resize 900x -quality 82 "webp900\%%~nF.webp"
    magick "%%F" -resize 1200x630^ -gravity center -extent 1200x630 -quality 88 "og\%%~nF-og.jpg"
)

echo.
echo Done.
pause