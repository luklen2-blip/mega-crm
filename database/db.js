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
    fs.renameSync(tempPath, this.filePath);
  }

  findAll(predicate) {
    return predicate ? this.cache.filter(predicate) : [...this.cache];
  }

  findByTenant(tenantId, predicate) {
    if (!tenantId) return this.findAll(predicate);
    return this.cache.filter(item => {
      const matchesTenant = !item.tenantId || item.tenantId === tenantId;
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
    const updated = {
      ...this.cache[idx],
      ...updates,
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

// Inicializa e exporta todas as coleções do SaaS Multi-Tenant
const tenantsDB = new JsonDB('tenants');
const usersDB = new JsonDB('users');
const contactsDB = new JsonDB('contacts');
const companiesDB = new JsonDB('companies');
const leadsDB = new JsonDB('leads');
const dealsDB = new JsonDB('deals');
const activitiesDB = new JsonDB('activities');
const tasksDB = new JsonDB('tasks');
const proposalsDB = new JsonDB('proposals');
const productsDB = new JsonDB('products');
const conversationsDB = new JsonDB('conversations');
const messagesDB = new JsonDB('messages');
const campaignsDB = new JsonDB('campaigns');
const automationsDB = new JsonDB('automations');
const knowledgeBaseDB = new JsonDB('knowledge_base');
const vehiclesDB = new JsonDB('vehicles');
const aiUsageDB = new JsonDB('ai_usage');
const auditLogsDB = new JsonDB('audit_logs');
const settingsDB = new JsonDB('settings');

module.exports = {
  JsonDB,
  tenantsDB,
  usersDB,
  contactsDB,
  companiesDB,
  leadsDB,
  dealsDB,
  activitiesDB,
  tasksDB,
  proposalsDB,
  productsDB,
  conversationsDB,
  messagesDB,
  campaignsDB,
  automationsDB,
  knowledgeBaseDB,
  vehiclesDB,
  aiUsageDB,
  auditLogsDB,
  settingsDB
};
