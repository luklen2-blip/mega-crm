/**
 * Serviço de Autenticação, RBAC e Isolamento Multi-Tenant
 * Utiliza módulos criptográficos padrão do Node.js (crypto) sem dependências externas.
 */

const crypto = require('crypto');
const { usersDB, tenantsDB, auditLogsDB } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'agentise-mega-crm-secret-salt-2026-luciano-cloud';
const TOKEN_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias

// 7 Níveis de Acesso RBAC Oficiais (Agentise V2.0)
const ROLES = {
  PROPRIETARIO: 'PROPRIETARIO',   // Acesso total irrestrito
  ADMINISTRADOR: 'ADMINISTRADOR', // Gestão operacional, usuários e integrações
  GERENTE: 'GERENTE',             // Gestão da equipe, pipeline e relatórios
  VENDEDOR: 'VENDEDOR',           // Seus próprios leads, clientes e oportunidades
  SDR: 'SDR',                     // Leads, qualificação e prospecção inicial
  FINANCEIRO: 'FINANCEIRO',       // Propostas, cobranças e conciliação de pagamentos
  ATENDIMENTO: 'ATENDIMENTO'      // Conversas omnichannel e suporte a clientes
};

const VALID_ROLES = Object.values(ROLES);

const PERMISSIONS = {
  // Configurações & Governança do Tenant
  SETTINGS_VIEW: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR],
  SETTINGS_EDIT: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR],
  USERS_MANAGE: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR],
  BILLING_MANAGE: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.FINANCEIRO],
  BACKUP_DOWNLOAD: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR],
  AUDIT_VIEW: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR],
  
  // Leads, Contatos e CRM 360°
  LEADS_VIEW_ALL: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.FINANCEIRO],
  LEADS_CREATE: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.VENDEDOR, ROLES.SDR, ROLES.ATENDIMENTO],
  LEADS_EDIT: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.VENDEDOR, ROLES.SDR],
  LEADS_DELETE: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR],
  
  // Pipeline & Oportunidades
  DEALS_VIEW_ALL: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.FINANCEIRO],
  DEALS_MANAGE: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.VENDEDOR],
  
  // Propostas & Pagamentos PIX
  PROPOSALS_VIEW: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.VENDEDOR, ROLES.FINANCEIRO],
  PROPOSALS_CREATE: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.VENDEDOR, ROLES.FINANCEIRO],
  PROPOSALS_CONFIRM: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.FINANCEIRO],
  
  // Conversas & Omnichannel Inbox
  CONVERSATIONS_VIEW: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.VENDEDOR, ROLES.SDR, ROLES.ATENDIMENTO],
  CONVERSATIONS_REPLY: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.VENDEDOR, ROLES.SDR, ROLES.ATENDIMENTO],
  
  // Automações & Agentes IA
  AUTOMATIONS_MANAGE: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE],
  AI_EXECUTE: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR, ROLES.GERENTE, ROLES.VENDEDOR, ROLES.SDR, ROLES.ATENDIMENTO],
  AI_CONFIG: [ROLES.PROPRIETARIO, ROLES.ADMINISTRADOR]
};

function hasPermission(userRole, permissionKey) {
  if (!userRole) return false;
  // Compatibilidade: PROPRIETARIO e ADMINISTRADOR possuem acesso mestre
  if (userRole === ROLES.PROPRIETARIO || userRole === 'PROPRIETARIO' || userRole === ROLES.ADMINISTRADOR || userRole === 'ADMINISTRADOR') {
    return true;
  }
  const allowed = PERMISSIONS[permissionKey];
  return allowed ? allowed.includes(userRole) : false;
}

// Funções criptográficas nativas
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(':')) return false;
  const [salt, originalHash] = storedHash.split(':');
  const checkHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(originalHash, 'hex'), Buffer.from(checkHash, 'hex'));
}

function generateToken(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + TOKEN_EXPIRY_MS;
  const data = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `${header}.${data}.${signature}`;
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, data, signature] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

// Registro de Auditoria Aprofundada com Rastreamento de Delta (Valor Anterior vs Novo)
function logAudit(paramsOrTenantId, userId, action, resource, details = {}) {
  try {
    let entry = {};
    if (typeof paramsOrTenantId === 'object' && paramsOrTenantId !== null) {
      entry = {
        tenantId: paramsOrTenantId.tenantId || 'system',
        userId: paramsOrTenantId.userId || 'system',
        userName: paramsOrTenantId.userName || 'Sistema',
        action: paramsOrTenantId.action || 'ACTION',
        resource: paramsOrTenantId.resource || 'general',
        entityId: paramsOrTenantId.entityId || null,
        ip: paramsOrTenantId.ip || '127.0.0.1',
        description: paramsOrTenantId.description || '',
        oldValues: paramsOrTenantId.oldValues || {},
        newValues: paramsOrTenantId.newValues || {},
        details: paramsOrTenantId.details || {},
        timestamp: new Date().toISOString()
      };
    } else {
      entry = {
        tenantId: paramsOrTenantId || 'system',
        userId: userId || 'anonymous',
        userName: details.userName || 'Usuário',
        action: action || 'ACTION',
        resource: resource || 'general',
        entityId: details.entityId || null,
        ip: details.ip || '127.0.0.1',
        description: details.description || '',
        oldValues: details.oldValues || {},
        newValues: details.newValues || {},
        details,
        timestamp: new Date().toISOString()
      };
    }
    return auditLogsDB.insert(entry);
  } catch (err) {
    console.error('[AuditLog] Erro ao registrar log:', err.message);
    return null;
  }
}

// Criação de Tenant & Usuário Administrador Inicial
function registerTenant({ companyName, adminName, email, password, segment = 'Geral', teamSize = '1-5' }) {
  const existingUser = usersDB.findAll(u => u.email.toLowerCase() === email.toLowerCase());
  if (existingUser.length > 0) {
    throw new Error('Já existe um usuário cadastrado com este e-mail.');
  }

  // 1. Cria Tenant com 7 dias de trial e plano Starter inicial
  const tenant = tenantsDB.insert({
    name: companyName,
    segment,
    teamSize,
    plan: 'starter',
    trialEndsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'active',
    aiCredits: 1000, // Créditos gratuitos iniciais
    aiCreditsUsed: 0,
    settings: {
      currency: 'BRL',
      timezone: 'America/Sao_Paulo',
      aiLevel: 'copiloto', // desativada | assistente | copiloto | autonoma
      autoRecoveryEnabled: true
    }
  });

  // 2. Cria Usuário Administrador
  const user = usersDB.insert({
    tenantId: tenant.id,
    name: adminName,
    email: email.toLowerCase(),
    passwordHash: hashPassword(password),
    role: 'ADMINISTRADOR', // ADMINISTRADOR, GERENTE, VENDEDOR, ATENDENTE
    status: 'active',
    avatar: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(adminName)}`
  });

  logAudit(tenant.id, user.id, 'TENANT_REGISTERED', 'tenants', { companyName, segment });

  const token = generateToken({
    userId: user.id,
    tenantId: tenant.id,
    role: user.role,
    name: user.name,
    email: user.email
  });

  return { tenant, user: sanitizeUser(user), token };
}

function login(email, password) {
  const user = usersDB.findAll(u => u.email.toLowerCase() === email.toLowerCase())[0];
  if (!user) {
    throw new Error('E-mail ou senha incorretos.');
  }

  if (user.status !== 'active') {
    throw new Error('Esta conta de usuário está desativada.');
  }

  if (!verifyPassword(password, user.passwordHash)) {
    throw new Error('E-mail ou senha incorretos.');
  }

  const tenant = tenantsDB.findById(user.tenantId);
  if (tenant && tenant.status === 'suspended') {
    throw new Error('A assinatura desta empresa está suspensa. Entre em contato com o suporte.');
  }

  logAudit(user.tenantId, user.id, 'USER_LOGIN', 'users', { email });

  const token = generateToken({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    name: user.name,
    email: user.email
  });

  return {
    token,
    user: sanitizeUser(user),
    tenant: tenant || { id: user.tenantId, name: 'Empresa Principal' }
  };
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, resetToken, ...safe } = user;
  return safe;
}

// Extrai contexto da requisição (Auth Header Bearer ou fallback demo seguro)
function getRequestContext(req) {
  const authHeader = req.headers['authorization'] || '';
  let token = '';
  if (authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7).trim();
  } else if (req.headers['x-auth-token']) {
    token = req.headers['x-auth-token'];
  }

  if (token) {
    const verified = verifyToken(token);
    if (verified) {
      return {
        isAuthenticated: true,
        userId: verified.userId,
        tenantId: verified.tenantId,
        role: verified.role,
        name: verified.name,
        email: verified.email
      };
    }
  }

  // Fallback transparente para o Tenant Demonstração Oficial caso nenhuma credencial seja enviada
  const defaultTenant = tenantsDB.findAll()[0];
  const defaultUser = usersDB.findAll()[0];

  return {
    isAuthenticated: false,
    userId: defaultUser ? defaultUser.id : 'usr_demo_admin',
    tenantId: defaultTenant ? defaultTenant.id : 'ten_default_agentise',
    role: defaultUser ? defaultUser.role : 'ADMINISTRADOR',
    name: defaultUser ? defaultUser.name : 'Luciano (Demo)',
    email: defaultUser ? defaultUser.email : 'luciano@recuperaia.local'
  };
}

module.exports = {
  ROLES,
  VALID_ROLES,
  PERMISSIONS,
  hasPermission,
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  registerTenant,
  login,
  sanitizeUser,
  getRequestContext,
  logAudit
};
