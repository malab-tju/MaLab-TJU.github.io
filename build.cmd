@echo off
chcp 65001 >nul
cd /d "%~dp0"
node tools\build.mjs
if errorlevel 1 (
  echo 更新失败，请检查上面的提示。需要安装 Node.js 18 或更新版本。
  pause
  exit /b 1
)
echo 网页已更新。打开 index.html 即可预览。
pause
