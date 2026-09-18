-- =============================================================================
-- AGENTISE V2.0 — SCHEMA RELACIONAL POSTGRESQL (PRODUÇÃO & NUVEM)
-- Padrão de Engenharia Multi-Tenant com Isolamento Estrito por tenant_id
-- Compatibilidade: PostgreSQL 14, 15, 16
-- NUNCA EXECUTA DROPS DESTRUTIVOS EM PRODUÇÃO
-- =============================================================================

-- Extensões seguras
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TENANTS (Empresas / Contratantes do SaaS)
CREATE TABLE IF NOT EXISTS tenants (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    segment VARCHAR(100) DEFAULT 'Geral',
    team_size VARCHAR(50) DEFAULT '1-5',
    plan VARCHAR(50) DEFAULT 'starter',
    status VARCHAR(50) DEFAULT 'active',
    trial_ends_at TIMESTAMPTZ,
    ai_credits INTEGER DEFAULT 1000,
    ai_credits_used INTEGER DEFAULT 0,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tenants_status ON tenants(status);
CREATE INDEX IF NOT EXISTS idx_tenants_plan ON tenants(plan);

-- 2. USERS (Membros da Equipe Multi-Tenant com 7 Papéis RBAC)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL DEFAULT 'VENDEDOR', -- PROPRIETARIO, ADMINISTRADOR, GERENTE, VENDEDOR, SDR, FINANCEIRO, ATENDIMENTO
    phone VARCHAR(50),
    avatar VARCHAR(500),
    status VARCHAR(50) DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_users_tenant_email UNIQUE (tenant_id, email)
);

CREATE INDEX IF NOT EXISTS idx_users_tenant_id ON users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 3. MEMBERSHIPS (Vínculos Multi-Tenant para Franquias e Contas Empresariais)
CREATE TABLE IF NOT EXISTS memberships (
    id VARCHAR(64) PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'VENDEDOR',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_user_tenant_membership UNIQUE (user_id, tenant_id)
);

CREATE INDEX IF NOT EXISTS idx_memberships_tenant ON memberships(tenant_id);
CREATE INDEX IF NOT EXISTS idx_memberships_user ON memberships(user_id);

-- 4. COMPANIES (Empresas Clientes - CRM 360°)
CREATE TABLE IF NOT EXISTS companies (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(32),
    industry VARCHAR(100),
    website VARCHAR(255),
    annual_revenue NUMERIC(15, 2),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_companies_tenant ON companies(tenant_id);

-- 5. CONTACTS (Pessoas de Contato - CRM 360°)
CREATE TABLE IF NOT EXISTS contacts (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_id VARCHAR(64) REFERENCES companies(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    whatsapp VARCHAR(50),
    role VARCHAR(100),
    is_decision_maker BOOLEAN DEFAULT FALSE,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_contacts_tenant ON contacts(tenant_id);
CREATE INDEX IF NOT EXISTS idx_contacts_company ON contacts(company_id);

-- 6. LEADS (Entrada de Oportunidades & Qualificação)
CREATE TABLE IF NOT EXISTS leads (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    contact_id VARCHAR(64) REFERENCES contacts(id) ON DELETE SET NULL,
    company_id VARCHAR(64) REFERENCES companies(id) ON DELETE SET NULL,
    assigned_to VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    role VARCHAR(100),
    origin VARCHAR(100) DEFAULT 'Site',
    status VARCHAR(50) DEFAULT 'novo',
    score INTEGER DEFAULT 50,
    score_reason TEXT,
    estimated_budget NUMERIC(15, 2) DEFAULT 0,
    bant_data JSONB DEFAULT '{}'::jsonb,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    notes TEXT,
    last_contact_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads(tenant_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_score ON leads(score);
CREATE INDEX IF NOT EXISTS idx_leads_assigned ON leads(assigned_to);

-- 7. PIPELINES (Múltiplos Funis de Venda)
CREATE TABLE IF NOT EXISTS pipelines (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pipelines_tenant ON pipelines(tenant_id);

-- 8. PIPELINE STAGES (Etapas Personalizadas por Funil)
CREATE TABLE IF NOT EXISTS pipeline_stages (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pipeline_id VARCHAR(64) NOT NULL REFERENCES pipelines(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0,
    probability INTEGER DEFAULT 20,
    is_won BOOLEAN DEFAULT FALSE,
    is_lost BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages ON pipeline_stages(pipeline_id, order_index);

-- 9. DEALS (Oportunidades de Negócio no Kanban)
CREATE TABLE IF NOT EXISTS deals (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    pipeline_id VARCHAR(64) REFERENCES pipelines(id) ON DELETE SET NULL,
    stage_id VARCHAR(64) REFERENCES pipeline_stages(id) ON DELETE SET NULL,
    lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
    assigned_to VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    value NUMERIC(15, 2) NOT NULL DEFAULT 0,
    stage VARCHAR(50) NOT NULL DEFAULT 'novo',
    probability INTEGER DEFAULT 20,
    ai_deal_score INTEGER DEFAULT 50,
    ai_deal_reason TEXT,
    expected_close_date DATE,
    closed_at TIMESTAMPTZ,
    lost_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_deals_tenant ON deals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_deals_stage ON deals(stage);
CREATE INDEX IF NOT EXISTS idx_deals_assigned ON deals(assigned_to);

-- 10. TASKS (Tarefas e Follow-ups Comerciais)
CREATE TABLE IF NOT EXISTS tasks (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE CASCADE,
    deal_id VARCHAR(64) REFERENCES deals(id) ON DELETE CASCADE,
    assigned_to VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    priority VARCHAR(50) DEFAULT 'media',
    completed BOOLEAN DEFAULT FALSE,
    due_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed ON tasks(completed);

-- 11. ACTIVITIES (Linha do Tempo CRM 360°)
CREATE TABLE IF NOT EXISTS activities (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE CASCADE,
    deal_id VARCHAR(64) REFERENCES deals(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    type VARCHAR(50) NOT NULL, -- call, email, whatsapp, meeting, note, stage_change
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activities_lead ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_activities_deal ON activities(deal_id);

-- 12. PROPOSALS & PIX (Cobranças e Contratos Comerciais)
CREATE TABLE IF NOT EXISTS proposals (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    deal_id VARCHAR(64) REFERENCES deals(id) ON DELETE SET NULL,
    lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0,
    items JSONB DEFAULT '[]'::jsonb,
    status VARCHAR(50) DEFAULT 'pendente', -- rascunho, enviada, visualizada, aprovada, pendente, paga, cancelada
    pix_key VARCHAR(255) DEFAULT 'luklen2@gmail.com',
    pix_recipient VARCHAR(255) DEFAULT 'LUCIANO SANT ANNA',
    pix_payload TEXT,
    qr_code_url TEXT,
    tx_id VARCHAR(64),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_proposals_tenant ON proposals(tenant_id);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status);

-- 13. PAYMENTS (Histórico e Webhooks de Conciliação)
CREATE TABLE IF NOT EXISTS payments (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    proposal_id VARCHAR(64) REFERENCES proposals(id) ON DELETE SET NULL,
    amount NUMERIC(15, 2) NOT NULL,
    method VARCHAR(50) DEFAULT 'PIX',
    status VARCHAR(50) DEFAULT 'PENDING', -- PENDING, PAID, EXPIRED, CANCELLED
    gateway_id VARCHAR(100),
    raw_payload JSONB DEFAULT '{}'::jsonb,
    confirmed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payments_tenant ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- 14. OMNICHANNEL CONVERSATIONS & MESSAGES
CREATE TABLE IF NOT EXISTS conversations (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE SET NULL,
    assigned_to VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    channel VARCHAR(50) NOT NULL, -- whatsapp, instagram, email, chat
    contact_name VARCHAR(255),
    contact_phone VARCHAR(50),
    status VARCHAR(50) DEFAULT 'nova', -- nova, em_atendimento, aguardando_cliente, follow_up, resolvida, transferida
    unread_count INTEGER DEFAULT 0,
    last_message TEXT,
    ai_summary TEXT,
    ai_intent VARCHAR(50),
    ai_suggested_reply TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id);
CREATE INDEX IF NOT EXISTS idx_conversations_status ON conversations(status);

CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    conversation_id VARCHAR(64) NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR(50) NOT NULL, -- customer, agent, ai
    sender_name VARCHAR(255),
    text TEXT NOT NULL,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id);

-- 15. WORKFLOWS & AUTOMATIONS (Motor QUANDO -> SE -> ENTÃO -> AGUARDAR)
CREATE TABLE IF NOT EXISTS workflows (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    trigger_type VARCHAR(100) NOT NULL,
    conditions JSONB DEFAULT '[]'::jsonb,
    actions JSONB DEFAULT '[]'::jsonb,
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);

CREATE TABLE IF NOT EXISTS workflow_runs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    workflow_id VARCHAR(64) NOT NULL REFERENCES workflows(id) ON DELETE CASCADE,
    entity_id VARCHAR(64),
    status VARCHAR(50) DEFAULT 'completed',
    logs JSONB DEFAULT '[]'::jsonb,
    executed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_workflow_runs ON workflow_runs(workflow_id);

-- 16. AI AGENTS & KNOWLEDGE BASE
CREATE TABLE IF NOT EXISTS ai_agents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    role VARCHAR(100) DEFAULT 'Assistente de Vendas',
    provider VARCHAR(50) DEFAULT 'anthropic', -- anthropic, openai, gemini
    model VARCHAR(100) DEFAULT 'claude-3-7-sonnet',
    system_prompt TEXT,
    voice_tone VARCHAR(100) DEFAULT 'Consultivo e Profissional',
    require_human_approval BOOLEAN DEFAULT TRUE,
    tools_enabled TEXT[] DEFAULT ARRAY['qualificar_lead', 'sugerir_resposta', 'criar_tarefa']::TEXT[],
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant ON ai_agents(tenant_id);

CREATE TABLE IF NOT EXISTS knowledge_base (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_kb_tenant ON knowledge_base(tenant_id);

-- 17. AI USAGE & QUOTA CONTROL
CREATE TABLE IF NOT EXISTS ai_usage (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
    agent_id VARCHAR(64) REFERENCES ai_agents(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    action_type VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER DEFAULT 0,
    completion_tokens INTEGER DEFAULT 0,
    credits_consumed INTEGER DEFAULT 1,
    cost_estimated NUMERIC(10, 6) DEFAULT 0,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_tenant ON ai_usage(tenant_id);

-- 18. AUDIT LOGS (Trilha de Governança com Valor Anterior e Novo)
CREATE TABLE IF NOT EXISTS audit_logs (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    user_id VARCHAR(64) NOT NULL,
    user_name VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource VARCHAR(100) NOT NULL,
    entity_id VARCHAR(64),
    ip VARCHAR(64),
    description TEXT,
    old_values JSONB DEFAULT '{}'::jsonb,
    new_values JSONB DEFAULT '{}'::jsonb,
    details JSONB DEFAULT '{}'::jsonb,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_tenant ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp DESC);

-- 19. CONSENTS (LGPD & Central de Privacidade)
CREATE TABLE IF NOT EXISTS consents (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    lead_id VARCHAR(64) REFERENCES leads(id) ON DELETE CASCADE,
    purpose VARCHAR(255) NOT NULL,
    accepted BOOLEAN NOT NULL DEFAULT TRUE,
    ip VARCHAR(64),
    user_agent TEXT,
    accepted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_consents_lead ON consents(lead_id);

-- 20. SETTINGS (Configurações Gerais do Tenant)
CREATE TABLE IF NOT EXISTS settings (
    id VARCHAR(64) PRIMARY KEY,
    tenant_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    company_name VARCHAR(255),
    pix_key VARCHAR(255) DEFAULT 'luklen2@gmail.com',
    pix_name VARCHAR(255) DEFAULT 'LUCIANO SANT ANNA',
    pix_city VARCHAR(100) DEFAULT 'SAO PAULO',
    currency VARCHAR(10) DEFAULT 'BRL',
    language VARCHAR(10) DEFAULT 'pt-BR',
    ai_model VARCHAR(100) DEFAULT 'Claude 3.7 Sonnet / Claude Code Engine',
    custom_channels JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_settings_tenant ON settings(tenant_id);

-- =============================================================================
-- FIM DO SCHEMA POSTGRESQL AGENTISE V2.0 (Zero comandos DROP executados)
-- =============================================================================
