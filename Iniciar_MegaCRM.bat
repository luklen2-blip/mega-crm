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

echo [1/3] Verificando integridade dos testes locais...
call node tests/run_all.js
if %errorlevel% neq 0 (
    echo [ERRO] Falha nos testes de integridade. Abortando inicialização.
    pause
    exit /b 1
)

echo.
echo [2/3] Iniciando Servidor HTTP na porta 3000...
start "Mega CRM Server" /b node server.js

echo.
echo [3/3] Aguardando 2 segundos para estabilização...
timeout /t 2 /nobreak > nul

echo.
echo Abrindo Mega CRM no navegador...
start http://localhost:3000

echo.
echo =====================================================================
echo  STATUS: Servidor operacional em http://localhost:3000
echo  Health Check: http://localhost:3000/api/health
echo =====================================================================
echo.
echo DICA PARA ACESSO MOBILE / TUNEL SEGURO:
echo Caso deseje expor para smartphones via Cloudflare Tunnel, execute:
echo   npx cloudflared tunnel --url http://localhost:3000 --no-prechecks
echo.
echo Pressione qualquer tecla para encerrar esta janela (o servidor continuará ativo)...
pause > nul
