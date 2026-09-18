const fs = require('fs');
const path = require('path');

class JsonDB {
  constructor(collectionName, baseDir = path.join(__dirname, 'data')) {
    this.collectionName = collectionName;
    this.baseDir = baseDir;
    this.filePath = path.join(this.baseDir, `${collectionName}.json`);
    this.cache = [];
    this._init();
  }

  _init() {
    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }
    if (!fs.existsSync(this.filePath)) {
      this._persist([]);
    } else {
      try {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        this.cache = JSON.parse(raw);
      } catch (err) {
        console.error(`[JsonDB] Erro ao carregar coleção ${this.collectionName}:`, err.message);
        this.cache = [];
      }
    }
  }

  _persist(data) {
    this.cache = data;
    const tempPath = `${this.filePath}.tmp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    fs.writeFileSync(tempPath, JSON.stringify(this.cache, null, 2), 'utf-8');
    try {
      fs.renameSync(tempPath, this.filePath);
    } catch (err) {
      try {
        fs.copyFileSync(tempPath, this.filePath);
        fs.unlinkSync(tempPath);
      } catch (e) {
        fs.writeFileSync(this.filePath, JSON.stringify(this.cache, null, 2), 'utf-8');
      }
    }
  }

  findAll(predicate) {
    return predicate ? this.cache.filter(predicate) : [...this.cache];
  }

  findByTenant(tenantId, predicate) {
    if (!tenantId) return this.findAll(predicate);
    return this.cache.filter(item => {
      const matchesTenant = item.tenantId === tenantId;
      return matchesTenant && (predicate ? predicate(item) : true);
    });
  }

  findById(id) {
    return this.cache.find(item => item.id === id) || null;
  }

  findOne(predicate) {
    return this.cache.find(predicate) || null;
  }

  insert(record) {
    const id = record.id || `${this.collectionName.slice(0, 3)}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();
    const doc = {
      ...record,
      id,
      createdAt: record.createdAt || now,
      updatedAt: now
    };
    this._persist([...this.cache, doc]);
    return doc;
  }

  update(id, updates) {
    const idx = this.cache.findIndex(item => item.id === id);
    if (idx === -1) return null;
    const existing = this.cache[idx];
    const updated = {
      ...existing,
      ...updates,
      id: existing.id, // IMMUTABLE: Primary key cannot be altered via mass assignment
      tenantId: existing.tenantId !== undefined ? existing.tenantId : updates.tenantId, // IMMUTABLE: Tenant ownership cannot be transferred
      updatedAt: new Date().toISOString()
    };
    const newCache = [...this.cache];
    newCache[idx] = updated;
    this._persist(newCache);
    return updated;
  }

  delete(id) {
    const initialLen = this.cache.length;
    const filtered = this.cache.filter(item => item.id !== id);
    if (filtered.length === initialLen) return false;
    this._persist(filtered);
    return true;
  }

  deleteWhere(predicate) {
    if (!predicate) return 0;
    const initialLen = this.cache.length;
    const filtered = this.cache.filter(item => !predicate(item));
    const deletedCount = initialLen - filtered.length;
    if (deletedCount > 0) {
      this._persist(filtered);
    }
    return deletedCount;
  }

  count(predicate) {
    return predicate ? this.cache.filter(predicate).length : this.cache.length;
  }

  countByTenant(tenantId, predicate) {
    return this.findByTenant(tenantId, predicate).length;
  }
}

// Inicializa e exporta todas as coleções do SaaS Multi-Tenant (V2.0 Paridade PostgreSQL)
const tenantsDB = new JsonDB('tenants');
const usersDB = new JsonDB('users');
const membershipsDB = new JsonDB('memberships');
const contactsDB = new JsonDB('contacts');
const companiesDB = new JsonDB('companies');
const leadsDB = new JsonDB('leads');
const pipelinesDB = new JsonDB('pipelines');
const pipelineStagesDB = new JsonDB('pipeline_stages');
const dealsDB = new JsonDB('deals');
const activitiesDB = new JsonDB('activities');
const tasksDB = new JsonDB('tasks');
const proposalsDB = new JsonDB('proposals');
const paymentsDB = new JsonDB('payments');
const productsDB = new JsonDB('products');
const conversationsDB = new JsonDB('conversations');
const messagesDB = new JsonDB('messages');
const campaignsDB = new JsonDB('campaigns');
const automationsDB = new JsonDB('automations');
const workflowRunsDB = new JsonDB('workflow_runs');
const aiAgentsDB = new JsonDB('ai_agents');
const aiConversationsDB = new JsonDB('ai_conversations');
const aiUsageDB = new JsonDB('ai_usage');
const knowledgeBaseDB = new JsonDB('knowledge_base');
const vehiclesDB = new JsonDB('vehicles');
const auditLogsDB = new JsonDB('audit_logs');
const consentsDB = new JsonDB('consents');
const settingsDB = new JsonDB('settings');

module.exports = {
  JsonDB,
  tenantsDB,
  usersDB,
  membershipsDB,
  contactsDB,
  companiesDB,
  leadsDB,
  pipelinesDB,
  pipelineStagesDB,
  dealsDB,
  activitiesDB,
  tasksDB,
  proposalsDB,
  paymentsDB,
  productsDB,
  conversationsDB,
  messagesDB,
  campaignsDB,
  automationsDB,
  workflowRunsDB,
  aiAgentsDB,
  aiConversationsDB,
  aiUsageDB,
  knowledgeBaseDB,
  vehiclesDB,
  auditLogsDB,
  consentsDB,
  settingsDB
};
