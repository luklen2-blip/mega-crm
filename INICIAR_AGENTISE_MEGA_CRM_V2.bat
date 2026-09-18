@echo off
title Agentise Mega CRM V2.0 - Plataforma Comercial AI-First
cd /d "C:\Users\luciano\.gemini\antigravity\scratch\mega-crm"
echo ========================================================
echo   AGENTISE MEGA CRM V2.0 - OPERACAO COMERCIAL COM AGENTES IA
echo   Multi-Tenant 24/7, PIX Bacen, CRM 360 e Motor de Automacao
echo ========================================================
echo.
echo 1. Executando suite de testes de integridade...
node tests/run_all.js
if %errorlevel% neq 0 (
    echo [ERRO] Falha nos testes de integridade. Abortando inicializacao.
    pause
    exit /b %errorlevel%
)
echo.
echo 2. Inicializando servidor de alta performance na porta 3000...
start http://localhost:3000
node server.js
pause
