# 🛡️ Agentise Mega CRM V2 — Inventário Oficial de Endpoints

> **Ambiente:** SaaS Comercial Multi-Tenant AI-First  
> **Documento Gerado:** Pentest V3 — Fase 1 (Mapeamento do Sistema Real)  
> **Data:** 22 de Setembro de 2026  

---

## 1. Mapeamento Completo de Rotas e Endpoints (Backend)

| Método | Endpoint | Auth | Role | Tenant Check | Rate Limit | Validação |
| :--- | :--- | :---: | :--- | :---: | :---: | :--- |
| **GET** | `/api/health` | Não | Público | N/A | Global (600/15m) | Status, Uptime e Integridade |
| **GET** | `/p/:token` | Não | Público | Token público | Global (600/15m) | Validação de token público (16 bytes hex) |
| **GET** | `/api/public/proposals/:token` | Não | Público | Token público | Global (600/15m) | Validação de token público da proposta |
| **POST** | `/api/pix/webhook` | Segredo | Webhook PSP/Bacen | Strict (proposal.tenantId) | PIX (60/15m) | Assinatura/Secret, amount divergence (<=0.01), txId, state machine |
| **GET** | `/termos` | Não | Público | N/A | N/A | Documento legal estático |
| **GET** | `/privacidade` | Não | Público | N/A | N/A | Documento LGPD estático |
| **POST** | `/api/auth/register` | Não | Público | Criação do Tenant | Auth (30/15m) | Email, senha min 8 chars, companyName, segment |
| **POST** | `/api/auth/login` | Não | Público | Email/Password | Auth (30/15m) | Email e senha, hash PBKDF2 |
| **POST** | `/api/auth/logout` | Sim | Qualquer | Sessão JWT | Global (600/15m) | Revogação de token na blacklist |
| **POST** | `/api/auth/change-password` | Sim | Qualquer | Sessão JWT | Auth (30/15m) | Senha atual, nova senha min 6 chars |
| **GET** | `/api/auth/me` | Sim | Qualquer | Sessão JWT | Global (600/15m) | Extração de claims seguras |
| **GET** | `/api/users/roles` | Sim | Qualquer | Sessão JWT | Global (600/15m) | Retorna matriz de 7 papéis RBAC |
| **GET** | `/api/users` | Sim | USERS_MANAGE | Tenant da sessão | Global (600/15m) | Sanitização (exclusão de passwordHash) |
| **POST** | `/api/users` | Sim | USERS_MANAGE | Tenant da sessão | Global (600/15m) | Nome, email, senha min 8, validação de role, cota de plano |
| **GET** | `/api/users/:id` | Sim | USERS_MANAGE | Tenant da sessão | Global (600/15m) | ID do usuário no tenant, ocultação de senha |
| **PUT** | `/api/users/:id` | Sim | USERS_MANAGE | Tenant da sessão | Global (600/15m) | Imutabilidade de tenantId/id, regras de promoção para PROPRIETARIO |
| **DELETE** | `/api/users/:id` | Sim | USERS_MANAGE | Tenant da sessão | Global (600/15m) | Bloqueio de auto-exclusão e proteção do PROPRIETARIO |
| **GET** | `/api/auth/tenants` | Sim | Qualquer | Sessão JWT | Global (600/15m) | Lista tenants vinculados ao email |
| **POST** | `/api/auth/switch-tenant` | Sim | Qualquer | Verificação de Vínculo | Auth (30/15m) | Rejeita troca arbitrária sem vínculo comprovado |
| **POST** | `/api/autoprime/execute-flow` | Sim | Qualquer | Tenant Auto Prime | Global (600/15m) | Fluxo guiado da vertical automotiva |
| **GET** | `/api/autoprime/metrics` | Sim | FINANCIAL_VIEW | Tenant da sessão | Global (600/15m) | Métricas automotivas consolidadas |
| **POST** | `/api/onboarding/complete` | Sim | SETTINGS_MANAGE | Tenant da sessão | Global (600/15m) | Atualização de perfil do tenant |
| **GET** | `/api/companies` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Filtro por tenant |
| **POST** | `/api/companies` | Sim | LEADS_MANAGE | Tenant da sessão | Global (600/15m) | Nome da empresa obrigatório |
| **GET** | `/api/contacts` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Filtro por tenant |
| **POST** | `/api/contacts` | Sim | LEADS_MANAGE | Tenant da sessão | Global (600/15m) | Nome e dados do contato |
| **GET** | `/api/leads` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Isolamento total por tenant |
| **POST** | `/api/leads` | Sim | LEADS_MANAGE | Tenant forçado (token) | Global (600/15m) | Anti parameter-spoofing, validação de campos, cota de plano |
| **POST** | `/api/leads/:id/anonymize` | Sim | LGPD_MANAGE | Tenant da sessão | Global (600/15m) | Anonimização Art. 18 LGPD com trilha de auditoria |
| **POST** | `/api/lgpd/consent` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Registro formal de consentimento |
| **GET** | `/api/lgpd/consents` | Sim | LGPD_MANAGE | Tenant da sessão | Global (600/15m) | Histórico de consentimentos do titular |
| **GET** | `/api/leads/:id/timeline` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | 10 estágios padronizados da timeline CRM 360° |
| **POST** | `/api/leads/:id/activities` | Sim | LEADS_MANAGE | Tenant da sessão | Global (600/15m) | Tipo e descrição da atividade |
| **GET** | `/api/leads/:id` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Bloqueio anti-IDOR (404 se pertencer a outro tenant) |
| **PUT** | `/api/leads/:id` | Sim | LEADS_MANAGE | Tenant da sessão | Global (600/15m) | Imutabilidade de id e tenantId |
| **DELETE** | `/api/leads/:id` | Sim | LEADS_MANAGE | Tenant da sessão | Global (600/15m) | Bloqueio de exclusão por papéis de leitura (403/404) |
| **GET** | `/api/pipelines` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Listagem de pipelines do tenant |
| **POST** | `/api/pipelines` | Sim | SETTINGS_MANAGE | Tenant da sessão | Global (600/15m) | Criação de novos pipelines customizados |
| **GET** | `/api/pipelines/:id/stages` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Estágios do pipeline |
| **POST** | `/api/pipelines/:id/stages` | Sim | SETTINGS_MANAGE | Tenant da sessão | Global (600/15m) | Adição de estágios com ordenação |
| **GET** | `/api/deals` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Isolamento por tenant |
| **POST** | `/api/deals` | Sim | DEALS_MANAGE | Tenant forçado (token) | Global (600/15m) | Validação de valor >= 0, leadId, cota de plano |
| **PATCH/PUT** | `/api/deals/:id/stage` | Sim | DEALS_MANAGE | Tenant da sessão | Global (600/15m) | Bloqueio de avanço para 'ganho' sem quitação financeira |
| **GET** | `/api/deals/:id` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Anti-IDOR (404 para deals de outros tenants) |
| **PUT/PATCH**| `/api/deals/:id` | Sim | DEALS_MANAGE | Tenant da sessão | Global (600/15m) | Validação de valor financeiro positivo |
| **DELETE** | `/api/deals/:id` | Sim | DEALS_MANAGE | Tenant da sessão | Global (600/15m) | Deleção de oportunidade do tenant |
| **POST** | `/api/deals/:id/ai-score` | Sim | DEALS_MANAGE | Tenant da sessão | AI (100/15m) | Cálculo BANT e consumo de créditos de IA |
| **GET** | `/api/tasks` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Tarefas do tenant |
| **POST** | `/api/tasks` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Título obrigatório |
| **PATCH** | `/api/tasks/:id` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Atualização de status da tarefa |
| **DELETE** | `/api/tasks/:id` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Exclusão de tarefa do tenant |
| **GET** | `/api/omnichannel/channels` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Status real dos canais (WhatsApp, Email, etc.) |
| **GET** | `/api/omnichannel/conversations`| Sim | Qualquer | Tenant da sessão | Global (600/15m) | Histórico de conversas do tenant |
| **GET** | `/api/omnichannel/conversations/:id/messages` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Mensagens do thread |
| **POST** | `/api/omnichannel/messages` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Envio de mensagem com gravação de atividade |
| **GET** | `/api/inbox/conversations` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Listagem do inbox multicanal |
| **POST** | `/api/inbox/conversations/:id/suggest` | Sim | Qualquer | Tenant da sessão | AI (100/15m) | Sugestão por IA Human-in-the-Loop |
| **POST** | `/api/inbox/conversations/:id/messages` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Resposta no canal com transbordo humano |
| **PATCH/PUT**| `/api/inbox/conversations/:id/mode` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Alternância de modo (IA vs Humano) |
| **GET** | `/api/knowledge-base` | Sim | KNOWLEDGE_VIEW | Tenant da sessão | Global (600/15m) | RAG isolado por tenant |
| **POST** | `/api/knowledge-base` | Sim | KNOWLEDGE_MANAGE | Tenant da sessão | Global (600/15m) | Inserção de artigos no Cérebro da Empresa |
| **PUT/PATCH**| `/api/knowledge-base/:id` | Sim | KNOWLEDGE_MANAGE | Tenant da sessão | Global (600/15m) | Edição de artigo da base de conhecimento |
| **DELETE** | `/api/knowledge-base/:id` | Sim | KNOWLEDGE_MANAGE | Tenant da sessão | Global (600/15m) | Exclusão com verificação de tenant |
| **GET** | `/api/recovery/scan` | Sim | DEALS_MANAGE | Tenant da sessão | Global (600/15m) | Varredura de oportunidades estagnadas |
| **POST** | `/api/recovery/generate-campaign` | Sim | DEALS_MANAGE | Tenant da sessão | AI (100/15m) | Geração de régua de recuperação por IA |
| **GET** | `/api/recovery/campaigns` | Sim | DEALS_MANAGE | Tenant da sessão | Global (600/15m) | Campanhas de recuperação geradas |
| **POST** | `/api/recovery/recover-deal` | Sim | DEALS_MANAGE | Tenant da sessão | Global (600/15m) | Reativação de oportunidade no funil |
| **GET** | `/api/automations/runs` | Sim | AUTOMATIONS_MANAGE | Tenant da sessão | Global (600/15m) | Telemetria de execuções de automação |
| **POST** | `/api/automations/test-trigger` | Sim | AUTOMATIONS_MANAGE | Tenant da sessão | Global (600/15m) | Simulação controlada de gatilho comercial |
| **GET** | `/api/automations` | Sim | AUTOMATIONS_MANAGE | Tenant da sessão | Global (600/15m) | Regras ativas (QUANDO -> SE -> ENTÃO) |
| **POST** | `/api/automations` | Sim | AUTOMATIONS_MANAGE | Tenant da sessão | Global (600/15m) | Criação de automação com cota de plano |
| **PATCH** | `/api/automations/:id/toggle` | Sim | AUTOMATIONS_MANAGE | Tenant da sessão | Global (600/15m) | Ativação/Desativação de automação |
| **PUT/PATCH**| `/api/automations/:id` | Sim | AUTOMATIONS_MANAGE | Tenant da sessão | Global (600/15m) | Edição de nós e ações |
| **DELETE** | `/api/automations/:id` | Sim | AUTOMATIONS_MANAGE | Tenant da sessão | Global (600/15m) | Exclusão de automação |
| **POST** | `/api/copilot/analyst` | Sim | FINANCIAL_VIEW | Tenant da sessão | AI (100/15m) | Consulta analítica por linguagem natural |
| **GET** | `/api/billing/subscription` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Status do plano, cotas e créditos de IA |
| **GET** | `/api/billing/plans` | Sim | Qualquer | N/A | Global (600/15m) | Catálogo de planos SaaS (Starter, Business, Enterprise) |
| **POST** | `/api/billing/upgrade` | Sim | PLANS_MANAGE | Tenant da sessão | PIX (60/15m) | Emissão de upgrade de plano via PIX |
| **GET** | `/api/workspace` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Visão consolidada 360° da empresa |
| **PUT** | `/api/workspace` | Sim | SETTINGS_MANAGE | Tenant da sessão | Global (600/15m) | Atualização de dados corporativos |
| **GET** | `/api/auto/vehicles` | Sim | Qualquer | N/A | Global (600/15m) | Estoque da vertical automotiva |
| **POST** | `/api/auto/financing` | Sim | Qualquer | N/A | Global (600/15m) | Simulador de financiamento com cálculo de CET |
| **GET** | `/api/ai/models` | Sim | Qualquer | N/A | AI (100/15m) | Modelos disponíveis (Claude, GPT, Gemini, Llama) |
| **POST** | `/api/ai/chat` | Sim | Qualquer | Tenant da sessão | AI (100/15m) | AI Guardrails, sanitização de prompt, créditos |
| **GET** | `/api/ai/usage` | Sim | FINANCIAL_VIEW | Tenant da sessão | AI (100/15m) | Telemetria de consumo de tokens e custos |
| **GET** | `/api/ai/agents` | Sim | Qualquer | Tenant da sessão | AI (100/15m) | Agentes autônomos configurados |
| **POST** | `/api/ai/agents` | Sim | SETTINGS_MANAGE | Tenant da sessão | AI (100/15m) | Criação de novo agente comercial com teto de autonomia |
| **POST** | `/api/ai/agents/:id/interact` | Sim | Qualquer | Tenant da sessão | AI (100/15m) | Interação autônoma com teto e transbordo |
| **GET** | `/api/ai/conversations` | Sim | Qualquer | Tenant da sessão | AI (100/15m) | Histórico de conversas da IA |
| **POST** | `/api/copilot/bant` | Sim | Qualquer | Tenant da sessão | AI (100/15m) | Avaliação BANT assistida |
| **POST** | `/api/copilot/pitch` | Sim | Qualquer | Tenant da sessão | AI (100/15m) | Geração de pitch comercial |
| **POST** | `/api/copilot/objection` | Sim | Qualquer | Tenant da sessão | AI (100/15m) | Contorno de objeções de vendas |
| **POST** | `/api/pix/generate` / `/api/proposals` | Sim | PROPOSALS_CREATE | Tenant da sessão | PIX (60/15m) | Geração EMV oficial Bacen, itens, validação positiva |
| **GET** | `/api/proposals/:id` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Anti-IDOR em propostas |
| **GET** | `/api/proposals` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Listagem de propostas do tenant |
| **PATCH** | `/api/proposals/:id/confirm` | Sim | PROPOSALS_CONFIRM | Tenant da sessão | PIX (60/15m) | Baixa manual protegida por RBAC, mutex e OS lock |
| **GET** | `/api/analytics/bi` | Sim | FINANCIAL_VIEW | Tenant da sessão | Global (600/15m) | BI avançado (CAC, LTV, Previsibilidade Ponderada) |
| **GET** | `/api/analytics` | Sim | Qualquer | Tenant da sessão | Global (600/15m) | Métricas operacionais de pipeline |
| **GET** | `/api/settings` | Sim | SETTINGS_VIEW | Tenant da sessão | Global (600/15m) | Mascaramento de segredos (***) |
| **POST/PUT**| `/api/settings` | Sim | SETTINGS_MANAGE | Tenant da sessão | Global (600/15m) | Edição de configurações gerais |
| **GET** | `/api/lgpd/export` | Sim | LGPD_MANAGE | Tenant da sessão | Global (600/15m) | Exportação de dados do titular (Art. 18 LGPD) |
| **POST** | `/api/lgpd/anonymize` | Sim | LGPD_MANAGE | Tenant da sessão | Global (600/15m) | Anonimização irreversível |
| **GET** | `/api/backup` | Sim | BACKUP_MANAGE | Tenant da sessão | Global (600/15m) | Exportação de snapshot das coleções JsonDB |
| **GET** | `/api/audit-logs` | Sim | AUDIT_VIEW | Tenant da sessão | Global (600/15m) | Trilha de auditoria completa com delta |
| **GET** | Estáticos (`/*`) | Não | Público | Sandbox seguro | Global (600/15m) | Bloqueio estrito de Directory Traversal e código backend |

---
*Mapeamento concluído com 104 endpoints auditados no servidor HTTP nativo.*
