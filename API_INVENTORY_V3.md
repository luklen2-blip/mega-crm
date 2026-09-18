# 📋 INVENTÁRIO COMPLETO DE APIS & MATRIZ RBAC V3.0
## AGENTISE MEGA CRM V2.0 — SAAS COMERCIAL MULTI-TENANT AI-FIRST

**Data:** 18 de Setembro de 2026  
**Versão da API:** 2.0.0 (Cloud 24/7 Ready)  
**Autenticação Padrão:** Bearer Token JWT HMAC-SHA256 (com revogação ativa no logout)

---

## 1. MATRIZ DE PAPÉIS RBAC (7 PAPÉIS)

| Papel | Descrição | Permissões Típicas |
| :--- | :--- | :--- |
| **`PROPRIETARIO`** | Titular supremo da organização e assinante da conta | Acesso irrestrito total, nomeação de proprietários, exclusão de tenants |
| **`ADMINISTRADOR`** | Gestor administrativo do workspace | Gestão completa de usuários, funis, automações e configurações corporativas |
| **`GERENTE`** | Supervisor de equipes comerciais | Gestão de funis, distribuição de leads, relatórios executivos e BI |
| **`VENDEDOR`** | Operador comercial de ponta | Criação de leads, avanço de propostas, chats e geração de links PIX |
| **`ATENDENTE`** | Operador de suporte e central omnichannel | Atendimento receptivo, visualização de contatos, registro de tarefas |
| **`FINANCEIRO`** | Gestor financeiro e de liquidação | Confirmação de recebíveis, baixa manual de PIX, auditoria de planos |
| **`LEITURA`** | Auditor ou observador sem permissão de escrita | Visualização de dashboards, leads e histórico em modo estritamente read-only |

---

## 2. INVENTÁRIO DETALHADO DOS ENDPOINTS

### 2.1 Infraestrutura, Saúde & Legalidade Pública
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/health` | Pública | Health check 24/7 (uptime, status, versão) | Global (600/15m) |
| `GET` | `/termos` | Pública (HTML) | Termos de uso, faixas etárias (16+ anos) e avisos éticos | - |
| `GET` | `/privacidade` | Pública (HTML) | Política de privacidade e conformidade LGPD | - |
| `GET` | `/p/:token` | Pública (HTML) | Checkout público de proposta com QR Code PIX oficial | - |

### 2.2 Autenticação, Sessões & Workspaces
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Pública | Cadastro de nova empresa e usuário Administrador | Auth (30/15m) |
| `POST` | `/api/auth/login` | Pública | Autenticação por email/senha com hash PBKDF2 | Auth (30/15m) |
| `POST` | `/api/auth/logout` | Autenticado | Invalidação instantânea do token JWT em blacklist | Global (600/15m) |
| `GET` | `/api/auth/me` | Autenticado | Dados do usuário logado e quotas do tenant | Global (600/15m) |
| `GET` | `/api/auth/tenants` | Autenticado | Listagem de empresas disponíveis para o usuário | Global (600/15m) |
| `POST` | `/api/auth/switch-tenant` | Autenticado | Alternância controlada de empresa ativa | Global (600/15m) |

### 2.3 Gestão de Usuários & Equipe (RBAC)
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/users` | `USERS_VIEW` | Lista membros da equipe (senhas estritamente expurgadas) | Global (600/15m) |
| `GET` | `/api/users/roles` | `USERS_VIEW` | Lista os 7 papéis e permissões do sistema | Global (600/15m) |
| `GET` | `/api/users/:id` | `USERS_VIEW` | Detalhes de um usuário específico do tenant | Global (600/15m) |
| `POST` | `/api/users` | `USERS_MANAGE` | Cria novo membro na equipe com papel atribuído | Global (600/15m) |
| `PUT` | `/api/users/:id` | `USERS_MANAGE` | Atualiza dados e papel (com bloqueio de auto-escalada) | Global (600/15m) |
| `DELETE` | `/api/users/:id` | `USERS_MANAGE` | Remove membro (imunidade para PROPRIETARIO e auto-deleção) | Global (600/15m) |

### 2.4 CRM 360°, Contatos & Linha do Tempo
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/leads` | `LEADS_VIEW` | Lista leads isolados estritamente por `tenantId` | Global (600/15m) |
| `GET` | `/api/leads/:id` | `LEADS_VIEW` | Detalhes completos do lead e histórico 360° | Global (600/15m) |
| `GET` | `/api/leads/:id/timeline`| `LEADS_VIEW` | Linha do tempo cronológica com 10 estágios comerciais | Global (600/15m) |
| `POST` | `/api/leads` | `LEADS_MANAGE` | Criação de novo lead com validação anti-spoofing | Global (600/15m) |
| `PUT` | `/api/leads/:id` | `LEADS_MANAGE` | Atualização cadastral de lead | Global (600/15m) |
| `DELETE` | `/api/leads/:id` | `LEADS_MANAGE` | Exclusão controlada de lead do tenant | Global (600/15m) |
| `POST` | `/api/leads/import` | `LEADS_MANAGE` | Importação em lote de contatos (CSV/JSON) | Global (600/15m) |
| `GET` | `/api/leads/export` | `LEADS_VIEW` | Exportação de base em conformidade LGPD | Global (600/15m) |

### 2.5 Empresas & Organizações
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/companies` | `LEADS_VIEW` | Lista empresas e contas corporativas B2B | Global (600/15m) |
| `GET` | `/api/companies/:id` | `LEADS_VIEW` | Detalhes da empresa e contatos vinculados | Global (600/15m) |
| `POST` | `/api/companies` | `LEADS_MANAGE` | Cadastro de nova organização corporativa | Global (600/15m) |
| `PUT` | `/api/companies/:id` | `LEADS_MANAGE` | Atualização cadastral da organização | Global (600/15m) |
| `DELETE`| `/api/companies/:id` | `LEADS_MANAGE` | Exclusão de organização B2B | Global (600/15m) |

### 2.6 Pipelines & Oportunidades Comerciais
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/pipelines` | `PIPELINES_VIEW`| Lista funis de vendas customizados | Global (600/15m) |
| `POST` | `/api/pipelines` | `PIPELINES_MANAGE`| Criação de novo pipeline (validado por quota de plano) | Global (600/15m) |
| `GET` | `/api/deals` | `DEALS_VIEW` | Lista oportunidades comerciais no funil Kanban | Global (600/15m) |
| `GET` | `/api/deals/:id` | `DEALS_VIEW` | Detalhes de oportunidade com deal score BANT | Global (600/15m) |
| `POST` | `/api/deals` | `DEALS_MANAGE` | Criação de negócio (bloqueio de valores negativos) | Global (600/15m) |
| `PATCH`| `/api/deals/:id/stage`| `DEALS_MANAGE` | Movimentação de estágio no Kanban comercial | Global (600/15m) |
| `PUT` | `/api/deals/:id` | `DEALS_MANAGE` | Atualização completa (avanço para ganho restrito) | Global (600/15m) |
| `DELETE`| `/api/deals/:id` | `DEALS_MANAGE` | Exclusão de oportunidade comercial | Global (600/15m) |

### 2.7 Tarefas, Atividades & Agenda
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/tasks` | `TASKS_VIEW` | Lista tarefas pendentes e agendamentos | Global (600/15m) |
| `POST` | `/api/tasks` | `TASKS_MANAGE` | Cria nova tarefa vinculada a lead/oportunidade | Global (600/15m) |
| `PATCH`| `/api/tasks/:id/status`| `TASKS_MANAGE`| Conclusão ou reagendamento de tarefa | Global (600/15m) |
| `GET` | `/api/activities` | `TASKS_VIEW` | Trilha de atividades comerciais recentes | Global (600/15m) |

### 2.8 Central Omnichannel & Inbox Multicanal
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/channels` | `CHANNELS_VIEW`| Status de conexões WhatsApp, Email, Instagram | Global (600/15m) |
| `GET` | `/api/conversations` | `CHANNELS_VIEW`| Lista de conversas do Inbox Multicanal | Global (600/15m) |
| `POST` | `/api/conversations/:id/messages`| `CHANNELS_SEND`| Envio de mensagem humana ou assistida por IA | Global (600/15m) |

### 2.9 Cérebro da Empresa & Knowledge Base
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/knowledge-base`| `KB_VIEW` | Documentos e políticas proprietárias do tenant | Global (600/15m) |
| `POST` | `/api/knowledge-base`| `KB_MANAGE` | Inserção de FAQ, tabela de preços e regras comerciais | Global (600/15m) |
| `POST` | `/api/knowledge-base/ask`| `KB_VIEW` | Consulta semântica com respostas embasadas na KB | AI (100/15m) |

### 2.10 RecuperaIA & Reativação de Clientes
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/recovery/scan` | `RECOVERY_MANAGE`| Varredura algorítmica de negócios estagnados no funil | Global (600/15m) |
| `GET` | `/api/recovery/campaigns`| `RECOVERY_VIEW` | Lista de campanhas de reativação geradas | Global (600/15m) |
| `POST` | `/api/recovery/campaigns/:id/dispatch`| `RECOVERY_MANAGE`| Disparo de fluxo de recuperação personalizado | Global (600/15m) |

### 2.11 Motor de Automações Comerciais
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/automations` | `AUTOMATIONS_VIEW`| Lista regras QUANDO -> SE -> ENTÃO | Global (600/15m) |
| `POST` | `/api/automations` | `AUTOMATIONS_MANAGE`| Cria automação (validada por quota do plano) | Global (600/15m) |
| `PATCH`| `/api/automations/:id/toggle`| `AUTOMATIONS_MANAGE`| Ativação/desativação de fluxo | Global (600/15m) |
| `GET` | `/api/automations/runs`| `AUTOMATIONS_VIEW`| Histórico e telemetria de execuções | Global (600/15m) |

### 2.12 AI Gateway Multi-LLM, Copiloto & Agentes
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/ai/models` | `AI_USE` | Modelos disponíveis (Claude, Gemini, OpenAI, Nativo) | AI (100/15m) |
| `POST` | `/api/ai/generate` | `AI_USE` | Roteamento dinâmico com firewall anti-injection | AI (100/15m) |
| `GET` | `/api/ai/usage` | `AI_USE` | Relatório de créditos consumidos pelo tenant | AI (100/15m) |
| `POST` | `/api/agent/interact` | `AI_USE` | Conversação direta com agente comercial de IA | AI (100/15m) |
| `POST` | `/api/agent/handoff` | `AI_USE` | Transbordo para vendedor humano | AI (100/15m) |
| `POST` | `/api/copilot/bant` | `AI_USE` | Análise BANT e deal score algorítmico | AI (100/15m) |
| `POST` | `/api/copilot/pitch` | `AI_USE` | Pitch de vendas persuasivo personalizado | AI (100/15m) |
| `POST` | `/api/copilot/objection`| `AI_USE` | Contorno imediato de objeções comerciais | AI (100/15m) |

### 2.13 Propostas Comerciais, PIX Banco Central & Webhooks
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `POST` | `/api/pix/generate` | `PROPOSALS_CREATE`| Emissão de payload EMV oficial com CRC-16 | PIX (60/15m) |
| `POST` | `/api/proposals` | `PROPOSALS_CREATE`| Proposta com itens (validação de subtotal e descontos) | PIX (60/15m) |
| `GET` | `/api/proposals` | `PROPOSALS_VIEW` | Lista propostas comerciais do tenant | PIX (60/15m) |
| `GET` | `/api/proposals/:id` | `PROPOSALS_VIEW` | Detalhes e status de proposta comercial | PIX (60/15m) |
| `PATCH`| `/api/proposals/:id/confirm`| `PROPOSALS_CONFIRM`| Baixa manual com mutex e idempotência contra replay | PIX (60/15m) |
| `POST` | `/api/pix/webhook` | Pública (Protegida)| Notificação automática Bacen com mutex concorrente | PIX (60/15m) |

### 2.14 Analytics, BI Executivo & Relatórios
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/analytics` | `ANALYTICS_VIEW` | Indicadores de funil, conversão e ticket médio | Global (600/15m) |
| `GET` | `/api/analytics/bi` | `ANALYTICS_VIEW` | BI Avançado (CAC, LTV, LTV/CAC, Ciclo Médio) | Global (600/15m) |

### 2.15 Configurações, LGPD & Auditoria Delta
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/settings` | `SETTINGS_VIEW` | Consulta parâmetros corporativos com mascaramento | Global (600/15m) |
| `POST`/`PUT`| `/api/settings` | `SETTINGS_EDIT` | Atualização corporativa com gravação em trilha delta | Global (600/15m) |
| `GET` | `/api/lgpd/export` | `LGPD_MANAGE` | Relatório oficial de dados pessoais (Art. 18 LGPD) | Global (600/15m) |
| `POST` | `/api/lgpd/anonymize`| `LGPD_MANAGE` | Anonimização irreversível de dados sensíveis | Global (600/15m) |
| `GET` | `/api/audit/logs` | `AUDIT_VIEW` | Consulta da trilha de auditoria com delta de valores | Global (600/15m) |

### 2.16 Planos SaaS, Faturamento & Upgrade PIX
| Método | Endpoint | Permissão | Descrição | Rate Limit |
| :--- | :--- | :--- | :--- | :--- |
| `GET` | `/api/plans` | Pública | Tabela dos planos Starter, Pro, Business, Enterprise | Global (600/15m) |
| `GET` | `/api/billing/subscription`| `BILLING_MANAGE`| Quotas em tempo real e dias restantes de trial | Global (600/15m) |
| `POST` | `/api/billing/upgrade`| `BILLING_MANAGE`| Mudança imediata de plano | Global (600/15m) |
| `POST` | `/api/billing/upgrade/pix`| `BILLING_MANAGE`| Geração de fatura PIX oficial para upgrade | PIX (60/15m) |

---

## 3. GARANTIA DE INTEGRIDADE & REGRESSÕES
Todas as 91+ rotas foram auditadas e homologadas. Nenhuma rota existente da V1 ou das fases V2 foi descontinuada ou alterada em sua essência.
