@echo off
chcp 65001 > nul
title Agentise Mega CRM - Servidor 24/7
color 0B

echo =====================================================================
echo    🚀 AGENTISE MEGA CRM AI-FIRST - MODELO DESAFIO CLAUDE CODE
echo    Disponibilidade 24/7 na Nuvem e Resiliência Local Windows
echo =====================================================================
echo.

cd /d "C:\Users\luciano\.gemini\antigravity\scratch\mega-crm"

echo [1/3] Executando testes de integridade e auditoria...
call node tests/run_all.js
if %errorlevel% neq 0 (
    echo [ERRO] Falha nos testes de integridade. Abortando inicialização.
    pause
    exit /b 1
)

echo.
echo [2/3] Iniciando Servidor HTTP (com fallback inteligente de porta)...
start "Mega CRM Server" /b node server.js

echo.
echo [3/3] Aguardando estabilização do servidor...
timeout /t 2 /nobreak > nul

echo.
echo Abrindo Mega CRM no navegador...
powershell -Command "if (Test-NetConnection -ComputerName 127.0.0.1 -Port 3001 -InformationLevel Quiet) { Start-Process 'http://localhost:3001' } else { Start-Process 'http://localhost:3000' }"

echo.
echo =====================================================================
echo  STATUS: Servidor operacional e protegido contra conflito de portas!
echo  Health Check: http://localhost:3001/api/health ou http://localhost:3000/api/health
echo =====================================================================
echo.
echo DICA PARA ACESSO MOBILE / TUNEL SEGURO:
echo Caso deseje expor para smartphones via Cloudflare Tunnel, execute:
echo   npx cloudflared tunnel --url http://localhost:3001 --no-prechecks
echo.
echo Pressione qualquer tecla para encerrar esta janela (o servidor continuará ativo)...
pause > nul
