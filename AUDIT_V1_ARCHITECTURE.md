# AUDITORIA TÉCNICA E ARQUITETURAL COMPLETA — AGENTISE MEGA CRM (BASELINE V1)

**Data da Auditoria**: 18 de Setembro de 2026  
**Versão Auditada**: Baseline V1 (Commit `bcc2da5` / Tag `v1.0.0-final`)  
**Ambiente**: Branch `AGENTISE_MEGA_CRM_V2`  
**Objetivo**: Mapeamento exaustivo de páginas, rotas, banco, regras, componentes e segurança antes da evolução para a V2.0.

---

## 1. Mapeamento de Páginas e Casca da Aplicação (Frontend)

| Página / Recurso | Tipo | Função / Conteúdo |
| :--- | :--- | :--- |
| `public/index.html` | SPA Principal | 12 visões operacionais (Dashboard, Kanban, Leads, Tarefas, Copiloto IA, Chat Omnichannel, RecuperaIA, Automações, Agentise Auto, Billing SaaS, PIX / Propostas, Vendedores). Inclui modais de Onboarding, BANT, Pitch, Objeções, Consulta Gerencial, Novo Vendedor, Configurações e Banner de Cookies LGPD. |
| `public/app.js` | Controlador SPA | 60 KB de JavaScript puro nativo. Gerencia roteamento de views, renderização com sanitização XSS (`escapeHtml`), chamadas REST autenticadas com JWT, drag-and-drop Kanban, filtro em tempo real de leads e controle do Service Worker. |
| `public/style.css` | Estilos | Design System corporativo dark/clean com variáveis CSS, suporte responsivo para mobile/tablet/desktop. |
| `public/manifest.json` | PWA Manifest | Especificação de aplicação instalável (standalone, tema `#2563eb`, background `#07090e`, ícones e atalhos). |
| `public/sw.js` | Service Worker | Cache inteligente de casca estática (App Shell) com bypass para rotas dinâmicas `/api/*`. |
| `public/termos.html` | Página Legal | Termos de uso formalizados em conformidade com Código Civil, ECA (faixa etária 13+ anos, compras 18+) e limites de responsabilidade de IA. |
| `public/privacidade.html`| Página Legal | Política de privacidade em estrita conformidade com a LGPD (Lei nº 13.709/2018), bases legais, direitos do titular e encarregado DPO. |

---

## 2. Mapeamento de Rotas e Endpoints da API (Backend `server.js`)

| Método | Endpoint | Permissão Atual | Função / Regra de Negócio |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Pública (sem rate limit) | Health check ininterrupto 24/7 para Render/Uptime (status, app, version, uptime, timestamp). |
| `POST` | `/api/auth/register` | Rate Limit (30/15m) | Registro de nova empresa (Tenant), usuário Administrador e sementes automáticas do segmento. |
| `POST` | `/api/auth/login` | Rate Limit (30/15m) | Autenticação com PBKDF2 (100k iterações) e emissão de JWT assinado timing-safe. |
| `GET` | `/api/auth/me` | JWT Obrigatório | Retorna usuário logado, tenant e permissões sanitizadas. |
| `GET` | `/api/leads` | JWT Obrigatório | Lista leads filtrados estritamente pelo `tenantId`. |
| `POST` | `/api/leads` | JWT Obrigatório | Cria novo lead, calcula score inicial e dispara gatilho comercial. |
| `GET` | `/api/deals` | JWT Obrigatório | Lista oportunidades do Kanban agrupadas por tenant e estágio. |
| `POST` | `/api/deals` | JWT Obrigatório | Cria nova oportunidade vinculada a lead e estágio do funil. |
| `PATCH`| `/api/deals/:id` | JWT Obrigatório | Atualiza estágio (Kanban drag-and-drop), valor, responsável e dispara workflows. |
| `GET` | `/api/tasks` | JWT Obrigatório | Lista tarefas pendentes e concluídas do tenant. |
| `POST` | `/api/tasks` | JWT Obrigatório | Cria tarefa com prioridade, data de entrega e vinculação a lead. |
| `PATCH`| `/api/tasks/:id` | JWT Obrigatório | Marca tarefa como concluída ou altera dados. |
| `DELETE`| `/api/tasks/:id` | JWT Obrigatório | Exclui tarefa com verificação de posse do tenant. |
| `GET` | `/api/analytics` | JWT Obrigatório | Agrega métricas executivas (leads, negócios, conversão, faturamento, ranking). |
| `POST` | `/api/copilot/bant` | JWT Obrigatório | Avalia qualificação BANT (Budget, Authority, Need, Timing) via motor consultivo de IA. |
| `POST` | `/api/copilot/pitch` | JWT Obrigatório | Gera pitch comercial personalizado baseado nas dores e segmento do lead. |
| `POST` | `/api/copilot/objection`| JWT Obrigatório | Retorna contra-argumentos estratégicos para objeções de preço, prazo ou concorrência. |
| `POST` | `/api/copilot/manager-query`| JWT Obrigatório | Analista de IA para gestores que responde consultas executivas em linguagem natural. |
| `GET` | `/api/omnichannel/channels` | JWT Obrigatório | Retorna status real dos canais integrados (WhatsApp, Instagram, Chat, etc.). |
| `GET` | `/api/omnichannel/conversations`| JWT Obrigatório | Lista conversas ativas com histórico de mensagens do tenant. |
| `POST` | `/api/omnichannel/send`| JWT Obrigatório | Envia mensagem no canal especificado e atualiza histórico. |
| `GET` | `/api/recovery/scan` | JWT Obrigatório | RecuperaIA: varre oportunidades paradas há mais de 3 dias no pipeline. |
| `POST` | `/api/recovery/campaign`| JWT Obrigatório | Gera e dispara campanha de recuperação com mensagem contextualizada por IA. |
| `GET` | `/api/automations` | JWT Obrigatório | Lista automações configuradas no tenant. |
| `POST` | `/api/automations` | JWT Obrigatório | Cria regra de automação (QUANDO -> SE -> ENTÃO). |
| `POST` | `/api/automations/seed`| JWT Obrigatório | Cria automações modelo baseadas no segmento de mercado. |
| `GET` | `/api/auto/vehicles` | JWT Obrigatório | Catálogo de veículos da vertical automotiva. |
| `POST` | `/api/auto/financing`| JWT Obrigatório | Simulador de parcelamento e financiamento com taxas de juros. |
| `GET` | `/api/autoprime/metrics`| JWT Obrigatório | Métricas consolidadas da Auto Prime Veículos (Teste 16). |
| `GET` | `/api/billing/subscription`| JWT Obrigatório| Retorna plano SaaS ativo, dias de trial restantes e saldo de créditos de IA. |
| `POST` | `/api/billing/upgrade` | JWT Obrigatório | Atualiza tier do plano SaaS (Starter, Pro, Enterprise). |
| `GET` | `/api/settings` | JWT Obrigatório | Retorna parâmetros corporativos com mascaramento de credenciais. |
| `POST` | `/api/settings` | RBAC Admin | Altera parâmetros do sistema (PIX, canais, integrações). |
| `POST` | `/api/lgpd/anonymize` | Anti-IDOR | Anonimiza irreversivelmente dados sensíveis de lead (Art. 18 LGPD). |
| `DELETE`| `/api/lgpd/delete` | Anti-IDOR | Exclui lead e histórico com registro em log de auditoria. |
| `GET` | `/api/lgpd/export` | JWT Obrigatório | Exporta todos os dados do titular em JSON estruturado. |
| `POST` | `/api/pix/generate` | JWT Obrigatório | Gera payload EMV oficial Bacen com CRC-16 e QR Code (`luklen2@gmail.com`). |
| `GET` | `/api/proposals` | JWT Obrigatório | Lista propostas comerciais emitidas com status e dados de leads vinculados. |
| `PATCH`| `/api/proposals/:id/confirm`| JWT Obrigatório| Confirma pagamento do PIX, **avança automaticamente Deal para 'Ganho'** e atualiza pipeline. |
| `GET` | `/api/users` | JWT Obrigatório | Lista usuários e vendedores da equipe. |
| `POST` | `/api/users` | RBAC Admin | Cria novo vendedor com validação de limites de assento do plano SaaS. |
| `GET` | `/api/backup` | JWT Obrigatório | Gera backup completo e estruturado de todas as entidades do tenant em JSON. |

---

## 3. Mapeamento do Banco de Dados (`database/data/*.json`)

| Coleção | Registros Atuais | Estrutura Principal |
| :--- | :---: | :--- |
| `tenants.json` | 2 | `id`, `name`, `segment`, `plan`, `trialExpiresAt`, `aiCredits`, `createdAt` |
| `users.json` | 6 | `id`, `tenantId`, `name`, `email`, `role` (ADMINISTRADOR, VENDEDOR), `passwordHash`, `salt` |
| `leads.json` | 55+ | `id`, `tenantId`, `name`, `email`, `phone`, `company`, `role`, `status`, `score`, `tags` |
| `deals.json` | 26+ | `id`, `tenantId`, `leadId`, `title`, `value`, `stage`, `probability`, `assignedTo` |
| `tasks.json` | 20+ | `id`, `tenantId`, `leadId`, `title`, `dueDate`, `priority`, `completed` |
| `proposals.json`| 10+ | `id`, `tenantId`, `dealId`, `leadId`, `amount`, `status` (aberta, paga), `pixPayload`, `txId` |
| `settings.json` | 2 | `id`, `tenantId`, `pixKey` (`luklen2@gmail.com`), `pixRecipient` (`LUCIANO SANT ANNA`), `pixCity` |
| `activities.json`| 30+ | `id`, `tenantId`, `leadId`, `type`, `description`, `timestamp` |
| `ai_usage.json` | 15+ | `id`, `tenantId`, `userId`, `actionType`, `creditsConsumed`, `timestamp` |
| `audit_logs.json`| 12+ | `id`, `tenantId`, `userId`, `action`, `entityType`, `entityId`, `details`, `timestamp` |
| `automations.json`| 6+ | `id`, `tenantId`, `name`, `trigger`, `action`, `active` |
| `campaigns.json`| 4+ | `id`, `tenantId`, `name`, `status`, `leadsCount`, `template` |
| `conversations.json`| 2+ | `id`, `tenantId`, `channel`, `contactName`, `lastMessage`, `unreadCount` |
| `messages.json` | 6+ | `id`, `tenantId`, `conversationId`, `sender`, `text`, `timestamp` |
| `vehicles.json` | 4 | `id`, `brand`, `model`, `year`, `price`, `bodyType`, `features` |
| `knowledge_base.json`| 3 | `id`, `tenantId`, `category`, `title`, `content` |
| `companies.json`| - | Preparado para expansão relacional CRM 360° |
| `contacts.json` | - | Preparado para expansão relacional CRM 360° |
| `products.json` | - | Preparado para catálogo de itens e propostas multi-itens |

---

## 4. Auditoria de Segurança e Conformidade

1. **Isolamento Multi-Tenant**: 100% das operações filtram registros utilizando `tenantId` extraído de JWT validado no backend. Teste 15 e Teste 17 validam bloqueio anti-IDOR.
2. **Sandbox de Arquivos Estáticos**: Bloqueio ativo de acesso a `/database/*`, `/server.js`, `/package.json`, `.git`, `node_modules` com retorno HTTP 404 (sem vazamento de erros de sistema).
3. **Criptografia & Tokens**: Assinatura JWT validada com `crypto.timingSafeEqual`. Hashing PBKDF2 com 100.000 iterações.
4. **Proteção contra DoS**: Rate limiting nativo em memória via sliding window (30 req/15min para login/registro, 600 req/15min para APIs gerais). Rota `/api/health` liberada para monitoramento de uptime 24/7.
5. **PIX Oficial**: Chave `luklen2@gmail.com` para `LUCIANO SANT ANNA` integrada com gerador EMV oficial e CRC-16 validado matematicamente.
6. **LGPD**: Rotas de anonimização, exclusão, exportação e cookies 100% integradas.

---

## 5. Conclusão da Auditoria

A base V1 é sólida, possui arquitetura limpa em Node.js puro sem dependências externas frágeis, passa em 18 de 18 testes automatizados e encontra-se congelada e preservada em `AGENTISE_MEGA_CRM_V1_BACKUP`.
A V2 poderá evoluir sobre essa estrutura de forma incremental e segura.
