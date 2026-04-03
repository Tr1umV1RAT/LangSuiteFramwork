@echo off
setlocal
where pyw >nul 2>nul
if %errorlevel%==0 (
  pyw "%~dp0LangSuiteLauncher.pyw"
  exit /b %errorlevel%
)
where pythonw >nul 2>nul
if %errorlevel%==0 (
  pythonw "%~dp0LangSuiteLauncher.pyw"
  exit /b %errorlevel%
)
where py >nul 2>nul
if %errorlevel%==0 (
  py -3 "%~dp0LangSuiteLauncher.pyw"
  exit /b %errorlevel%
)
python "%~dp0LangSuiteLauncher.pyw"
