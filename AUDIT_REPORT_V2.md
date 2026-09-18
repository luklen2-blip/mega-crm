# AUDITORIA PROFUNDA DE FUNCIONALIDADES — AGENTISE MEGA CRM V2.0

> **Data da Auditoria:** 18 de Setembro de 2026  
> **Objetivo:** Descobrir o que realmente funciona, identificar pontos parciais ou com risco, eliminar qualquer resquício de simulação/mock e transformar a V2 em um SaaS comercialmente confiável.  
> **Taxonomia Aplicada:**  
> - 🟢 **FUNCIONAL REAL:** Frontend, backend, banco e regras de negócio operando de ponta a ponta.  
> - 🟡 **PARCIAL:** Estrutura existe, mas falta conexão em certas transições, versionamento ou refinamento.  
> - 🟠 **MOCK/DEMONSTRAÇÃO:** Simulação visual ou dados hardcoded sem persistência.  
> - 🔴 **INEXISTENTE:** Previsto conceitualmente, mas sem implementação técnica.  
> - ⚠️ **COM RISCO:** Possui fragilidade de segurança, exposição de credenciais ou ambiguidade de status.

---

## 1. Classificação Detalhada Módulo a Módulo

| # | Módulo | Classificação | Diagnóstico Técnico Profundo | Ação Obrigatória de Hardening |
|---|---|:---:|---|---|
| **01** | **CRM 360°** (Leads, Contatos, Empresas) | 🟢 FUNCIONAL REAL | Entidades `leads`, `contacts`, `companies` e `activities` persistidas no `JsonDB` atômico. Timeline de histórico registra interações. | Manter isolamento estrito de `tenantId`. |
| **02** | **Pipeline & Funis de Vendas** | 🟢 FUNCIONAL REAL | Kanban dinâmico, movimentação de estágios, múltiplos funis configuráveis e eventos registrados na timeline. | Assegurar que exclusão de funil preserve integridade relacional. |
| **03** | **Multi-Tenant Real** | 🟢 FUNCIONAL REAL | Todos os métodos do `db.js` filtram por `tenantId`. Tokens JWT contêm contexto de tenant validado. | Executar teste de penetração formal (Tenant A vs Tenant B) gerando relatório. |
| **04** | **Central Omnichannel** (WhatsApp, Instagram, Webchat) | 🟡 PARCIAL / ⚠️ COM RISCO | Modelos de conversa e mensagens existem. Porém, canais sem credenciais válidas da Meta exibiam "Conectar Canal" com histórico demonstrativo. | **Eliminar fakes.** Canais não autenticados DEVEM exibir explicitamente `"Integração não configurada"`. Proibir envio simulado. |
| **05** | **Agente Comercial IA & Copiloto** | 🟡 PARCIAL | Qualificação BANT, pitch e objeções operam. Porém, perguntas específicas do usuário ("leads quentes", "propostas paradas") dependem de queries estruturadas no banco real. | Implementar queries determinísticas no backend ligadas a leads, deals e propostas reais do tenant. |
| **06** | **Cérebro da Empresa** (Knowledge Base) | 🟡 PARCIAL | Coleção `knowledge_base.json` armazena produtos, políticas e FAQ por tenant. Falta versionamento formal e histórico de quem alterou. | Adicionar versionamento (`version: 1, 2, 3...`) e log de alteração com autor e timestamp. |
| **07** | **RecuperaIA** | 🟡 PARCIAL | Varredura temporal (+48h, +5d, +7d) opera com dados reais. Faltam os indicadores explícitos de `RECEITA EM RISCO` e `RECEITA RECUPERADA` salvando a tag de origem no fechamento. | Criar os dois indicadores formais e registrar `origin: 'RecuperaIA'` nos negócios recuperados. |
| **08** | **Automações Comerciais** (QUANDO/SE/ENTÃO) | 🟡 PARCIAL | Motor visual com 9 gatilhos e 5 ações operando com log em `workflowRunsDB`. Falta trava de idempotência contra repetições acidentais. | Implementar chave de deduplicação temporal para impedir que a mesma automação execute duas vezes no mesmo evento. |
| **09** | **Copiloto BANT & Deal Score** | 🟢 FUNCIONAL REAL | Algoritmo BANT matemático (0 a 100) ponderando Budget, Authority, Need e Timing sobre dados cadastrais e anotações. | Manter sem alterações estruturais. |
| **10** | **Vertical Automotivo (Agentise Auto)** | 🟢 FUNCIONAL REAL | Catálogo de veículos em estoque e calculadora de financiamento com Tabela Price, IOF e CET operando localmente. | Manter sem alterações estruturais. |
| **11** | **Dashboard & BI Avançado** | 🟢 FUNCIONAL REAL | Cálculos reais de CAC, LTV, LTV/CAC, Ciclo de Vendas e Forecast Ponderado a partir das transações. | Integrar diretamente com os indicadores do RecuperaIA. |
| **12** | **Planos SaaS & Quotas de Consumo** | 🟢 FUNCIONAL REAL | 4 Tiers com limites reais (Starter, Pro, Business, Enterprise), cálculo de percentuais e bloqueio elegante HTTP 402. | Manter e expandir com o fluxo de checkout seguro. |
| **13** | **Créditos de IA & Telemetria** | 🟡 PARCIAL | Medição e débito de créditos operam via `ai_usage.json`. Falta enriquecer o log para padrão `AI_USAGE_LOG` com `userId`, `model`, `tokens` e `custo`. | Enriquecer o schema de log de telemetria de IA por requisição. |
| **14** | **PIX Banco Central** (Luciano Sant Anna) | 🟡 PARCIAL / ⚠️ COM RISCO | Geração de payload EMV e CRC-16 operam. Porém, a chave `luklen2@gmail.com` estava hardcoded em HTML público. Ciclo de estados precisa de separação inequívoca entre GERADO e CONFIRMADO. | Migrar chave para `process.env.PIX_KEY`. Implementar máquina de 5 estados: `PENDING`, `PAID`, `EXPIRED`, `CANCELLED`, `FAILED`. Proibir avanço para "ganho" sem confirmação. |
| **15** | **Ciclo de Propostas Comerciais** | 🟡 PARCIAL | Emissão de propostas com múltiplos itens e checkout público `/p/:token` funcionam. Falta registrar a transição explícita para `VISUALIZADA` quando o cliente abre o link. | Atualizar status para `visualizada` e logar atividade na abertura pública do link. |
| **16** | **LGPD & Conformidade Legal** | 🟢 FUNCIONAL REAL | Páginas `/termos` e `/privacidade`, disclaimer médico/psicológico, restrição 18+, e endpoint de anonimização com auditoria delta operantes. | Manter sem quebras. |
| **17** | **Governança de Usuários & 7 Papéis RBAC** | 🟢 FUNCIONAL REAL | 7 papéis implementados no backend com verificação de autorização em todas as rotas sensíveis. | Validar que vendedor não acesse endpoints restritos de gerência. |

---

## 2. Pontos Críticos de Atenção para Correção Imediata

1. **Exposição da Chave PIX e Secrets:**  
   A chave `luklen2@gmail.com` e qualquer API Key externa não devem constar como strings estáticas no frontend ou em respostas de API. Utilizar `process.env.PIX_KEY` e mascarar exibições visuais (`luk***@gmail.com`).
2. **Separação Rigorosa de Pagamento PIX:**  
   Nunca tratar geração de QR Code como pagamento efetuado. O status inicial é estritamente `PENDING` ("Aguardando Confirmação"). Apenas webhooks autenticados ou confirmação administrativa podem emitir a baixa para `PAID`, disparando o avanço automático da oportunidade no CRM.
3. **Canais Omnichannel sem Fake Conexões:**  
   Canais sem credenciais Meta registradas devem portar aviso transparente: `"Integração não configurada"`.
4. **Idempotência de Automações:**  
   Automações devem checar se já executaram para a mesma entidade no intervalo de 60 segundos antes de disparar tarefas ou alertas duplicados.
