# MANIFESTO FORMAL DE BACKUP — AGENTISE MEGA CRM V1

**Identificador do Backup**: `AGENTISE_MEGA_CRM_V1_BACKUP`  
**Data do Backup**: 18 de Setembro de 2026 — 10:58 BRT  
**Commit Git Baseline**: `bcc2da5` (main)  
**Status dos Testes no Momento do Backup**: 18/18 testes locais aprovados (100%) e 12/12 verificações de nuvem aprovadas  
**Chave PIX Oficial Preservada**: `luklen2@gmail.com` | **Favorecido**: `LUCIANO SANT ANNA`  
**Localização do Backup Isolado**: `C:\Users\luciano\.gemini\antigravity\scratch\AGENTISE_MEGA_CRM_V1_BACKUP`  
**Pacote Compactado de Segurança**: `C:\Users\luciano\OneDrive\Desktop\AGENTISE_MEGA_CRM_V1_BACKUP.zip`

---

## 1. Estrutura Preservada

```text
AGENTISE_MEGA_CRM_V1_BACKUP/
├── .dockerignore
├── .gitignore
├── ca-bundle.crt
├── CLAUDE.md
├── cloudflared.exe
├── Dockerfile
├── Iniciar_MegaCRM.bat
├── package.json
├── render.yaml
├── server.js                        # Servidor HTTP nativo, Sandbox estático, OWASP Headers, Rotas REST
├── start_tunnel.js                  # Inicializador resiliente Cloudflare Tunnel (--no-prechecks)
├── tunnel_url.txt
├── database/
│   ├── db.js                        # Motor transacional atômico JsonDB com resiliência a file-locks
│   ├── seeds.js                     # Sementes completas multi-tenant e dados corporativos
│   └── data/                        # 19 coleções JSON atômicas
│       ├── activities.json
│       ├── ai_usage.json
│       ├── audit_logs.json
│       ├── automations.json
│       ├── campaigns.json
│       ├── companies.json
│       ├── contacts.json
│       ├── conversations.json
│       ├── deals.json
│       ├── knowledge_base.json
│       ├── leads.json
│       ├── messages.json
│       ├── products.json
│       ├── proposals.json
│       ├── settings.json            # Configuração PIX oficial luklen2@gmail.com / LUCIANO SANT ANNA
│       ├── tasks.json
│       ├── tenants.json
│       ├── users.json
│       └── vehicles.json
├── public/
│   ├── app.js                       # Frontend SPA reativo, Kanban, chat, analytics, PWA controller
│   ├── index.html                   # Casca da aplicação, componentes modais, tabelas, SEO, viewport
│   ├── manifest.json                # PWA Manifest oficial (standalone, cor tema #2563eb)
│   ├── privacidade.html             # Política de privacidade em conformidade com Art. 14 da LGPD
│   ├── style.css                    # Estilização CSS responsiva e temas escuros corporativos
│   ├── sw.js                        # Service Worker para cache estático e funcionamento offline
│   └── termos.html                  # Termos de uso, limites de responsabilidade e faixa etária
├── scripts/
│   ├── audit_codebase.js            # Auditoria estática de código
│   ├── audit_deep.js                # Auditoria profunda de DOM, handlers e dependências
│   ├── pack_desktop.js              # Gerador do arquivo zip limpo na Área de Trabalho
│   └── setup_autostart.js           # Configurador do VBScript em shell:startup
├── services/
│   ├── aiCopilotService.js          # Motor consultivo de IA (BANT, pitch, objeções, análise gerencial)
│   ├── authService.js               # Autenticação, PBKDF2 (100k iter), JWT timing-safe, RBAC, auditoria
│   ├── autoPrimeService.js          # Dados e métricas da concessionária modelo do Teste 16
│   ├── autoVerticalService.js       # Vertical comercial especializada em veículos e financiamentos
│   ├── billingService.js            # Planos SaaS (Starter, Pro, Enterprise), quotas e créditos de IA
│   ├── omnichannelService.js        # Central de mensageria omnichannel (WhatsApp, Instagram, Web)
│   ├── pixService.js                # Gerador oficial de payload EMV (Bacen) com CRC-16 e QR Code
│   ├── recoveryService.js           # RecuperaIA: identificação de oportunidades estagnadas
│   ├── workflowEngine.js            # Construtor de automações (QUANDO -> SE -> ENTÃO)
│   └── workflowService.js           # Execução e gatilhos comerciais
└── tests/
    ├── run_all.js                   # Suíte de 18 testes automatizados de ponta a ponta
    └── test_cloud_live.js           # Suíte de homologação ao vivo na nuvem (12 verificações)
```

---

## 2. Tecnologias e Arquitetura Detectadas

* **Runtime**: Node.js v20+ / v24+
* **Dependências de Produção**: **Zero dependências externas** (`package.json` limpo; utiliza exclusivamente os módulos padrão `http`, `https`, `crypto`, `fs`, `path`).
* **Segurança e Criptografia**:
  * Hashing de senhas: `PBKDF2` com sal dinâmico de 16 bytes e 100.000 iterações.
  * Assinatura de tokens: HMAC-SHA256 validado com `crypto.timingSafeEqual`.
  * Cabeçalhos OWASP: `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `X-XSS-Protection: 1; mode=block`, `Referrer-Policy: strict-origin-when-cross-origin`.
  * Rate Limiting: In-memory sliding window para autenticação (30 req/15min) e API geral (600 req/15min).
  * Sandbox de Estáticos: Isolamento restrito a `public/` com whitelist e bloqueio categórico de traversal.
* **Persistência de Dados**:
  * `JsonDB`: Persistência atômica com isolamento multi-tenant (`tenantId`), transações ACID simuladas, gravação segura em arquivo temporário com fallback contra travas de arquivos no Windows (`EPERM`).
* **Meios de Pagamento**:
  * PIX Oficial Banco Central: Geração matemática do payload EMV com cálculo de CRC-16 pelo polinômio `0x1021`, QR Code dinâmico e cópia de chave `luklen2@gmail.com` para `LUCIANO SANT ANNA`.
* **Mobile / PWA**:
  * Service Worker e Manifest para instalação móvel e desktop com cache de aplicação.

---

## 3. Funcionalidades Existentes Catalogadas

1. **Gestão de Leads e Contatos**: Cadastro, edição, busca em tempo real, visualização de tags e histórico.
2. **Pipeline de Oportunidades (Kanban)**: Movimentação de estágios (Novo Lead, Qualificado, Proposta, Negociação, Ganho, Perdido), contagem de negócios e valor total.
3. **Gestão de Tarefas**: Criação, prioridades, datas de entrega, vinculação a leads e deleção.
4. **Inteligência Artificial (Claude AI Copilot)**:
   - Qualificação BANT (Budget, Authority, Need, Timing).
   - Gerador de Pitch comercial personalizado.
   - Tratamento dinâmico de objeções.
   - Analista IA para gestores com consultas em linguagem natural.
5. **Central Omnichannel**: Monitoramento de canais (WhatsApp Business, Instagram Direct, Web Chat, E-mail, Mercado Livre), histórico e envio de mensagens.
6. **Módulo RecuperaIA**: Varredura automática de negócios estagnados e disparador de campanhas de reativação.
7. **Construtor de Automações**: Workflows orientados a eventos (ex: novo lead via site, proposta aprovada, venda fechada).
8. **Propostas e Cobrança PIX**:
   - Emissão de propostas com valor e descrição.
   - Geração de QR Code e Copia-e-Cola oficial com chave `luklen2@gmail.com`.
   - Confirmação de recebimento com avanço automático do Deal para "Ganho" e atualização do pipeline.
9. **Painel de Configurações e Governança**:
   - Chave PIX e favorecido customizáveis.
   - Conexão e status dos canais omnichannel.
   - Exportação de dados do titular (Art. 18 LGPD).
   - Backup completo dos dados do tenant em formato JSON.
10. **Conformidade Legal**:
    - Banner de consentimento de cookies.
    - Páginas `/termos` e `/privacidade` em conformidade com o Código Civil, ECA e LGPD.
    - Anonimização e exclusão de dados de leads.
11. **Vertical Automotiva (Agentise Auto / Auto Prime Veículos)**: Catálogo de veículos, cálculo de financiamento simulado e métricas do Teste 16.

---

## 4. Instruções Formais para Restauração da V1

Caso seja necessário restaurar o ambiente original V1 a qualquer momento:

1. **A partir do diretório de backup**:
   - Os arquivos em `C:\Users\luciano\.gemini\antigravity\scratch\AGENTISE_MEGA_CRM_V1_BACKUP` estão 100% prontos para execução imediata.
   - Para iniciar o servidor a partir do backup:
     ```powershell
     cd C:\Users\luciano\.gemini\antigravity\scratch\AGENTISE_MEGA_CRM_V1_BACKUP
     node server.js
     ```
2. **A partir do pacote ZIP da Área de Trabalho**:
   - Descompactar `C:\Users\luciano\OneDrive\Desktop\AGENTISE_MEGA_CRM_V1_BACKUP.zip` em qualquer diretório desejado.
   - Executar `node server.js` ou clicar duas vezes em `Iniciar_MegaCRM.bat`.
3. **A partir do Git**:
   - No repositório, alternar para a tag de congelamento:
     ```powershell
     git checkout v1.0.0-final
     ```
4. **Validação da Restauração**:
   - Executar `node tests/run_all.js` para certificar que os testes continuam passando com 100% de sucesso.
   - Conferir que o banco de dados original está intacto e independente.
