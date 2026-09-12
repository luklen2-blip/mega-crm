# CLAUDE.md - Mega CRM AI-First (Agentise Standard)

Este documento orienta o agente autônomo Claude Code e qualquer copiloto de IA no desenvolvimento, evolução e manutenção do Mega CRM.

## Visão do Projeto
O **Mega CRM** é um sistema comercial AI-First desenvolvido segundo a metodologia ensinada no **Desafio Claude Code da Agentise**, projetado para rodar em nuvem 24/7 com disponibilidade ininterrupta, conformidade integral com a LGPD e suporte nativo ao ecossistema comercial brasileiro (PIX e WhatsApp).

## Comandos Principais
- **Iniciar Servidor Local**: `npm start` ou `node server.js` (Porta padrão: `3000` ou variável de ambiente `PORT`)
- **Executar Testes de Integridade**: `npm test` ou `node tests/run_all.js`
- **Executar Testes Live Cloud E2E**: `npm run test:live -- <URL_DE_PRODUCAO>`
- **Gerar Pacote de Deploy (.zip na Área de Trabalho)**: `npm run pack` ou `node scripts/pack_desktop.js`

## Arquitetura e Diretrizes Obrigatórias
1. **Nuvem 24/7 (Luciano Standard)**:
   - Toda API/Servidor deve expor `GET /api/health` retornando HTTP 200 JSON com:
     `{ status: "ok", app: "Agentise Mega CRM", version: "2.0.0", uptime_seconds: ..., timestamp: ... }`
   - O servidor deve resolver arquivos estáticos de forma resiliente tanto na raiz quanto na pasta `public/`, além de fornecer fallback SPA para `index.html`.
2. **Persistência Atômica com JsonDB**:
   - Sempre salvar alterações via arquivo temporário `.tmp` e substituição atômica (`renameSync`) para prevenir corrupção no Windows e em containers.
3. **Fintech e Comercial Brasileiro**:
   - Suporte oficial a PIX com payload EMV (Banco Central) e cálculo de CRC-16/CCITT-FALSE.
   - Links diretos com formatação brasileira para WhatsApp (`wa.me/55...`).
4. **Copiloto de Vendas Claude AI**:
   - Qualificação preditiva BANT (Budget, Authority, Need, Timing).
   - Gerador de abordagem e quebra de objeções.
   - Analisador de risco da oportunidade.
5. **Conformidade Legal Brasileira (LGPD)**:
   - Rotas `/termos` e `/privacidade` disponíveis publicamente.
   - Gestão de consentimento e atendimento aos direitos do titular (Art. 18 LGPD).
   - Indicação de faixa etária e software empresarial.

## Estrutura de Pastas
- `server.js`: Servidor HTTP/Express resiliente e rotas REST.
- `database/`: Motor `db.js` (JsonDB atômico) e sementes `seeds.js`.
- `services/`:
  - `aiCopilotService.js`: Motor de inteligência comercial.
  - `pixService.js`: Geração de PIX EMV e QR Code.
  - `workflowService.js`: Automações de estágios e tarefas.
- `public/`: Interface SPA moderna em modo escuro/glassmorphism (Tailwind + Lucide).
- `tests/`: Suíte local (`run_all.js`) e remota (`test_cloud_live.js`).
- `scripts/`: Empacotador e configuradores para Windows.
