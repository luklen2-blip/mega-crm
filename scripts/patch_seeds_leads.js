const fs = require('fs');
const path = require('path');

const seedsPath = path.join(__dirname, '..', 'database', 'seeds.js');
let content = fs.readFileSync(seedsPath, 'utf8');

const regex = /(\/\/\s*5\.\s*Leads B2B Brasileiros Realistas\r?\n)(\s*const l1 = leadsDB\.insert\(\{[\s\S]*?notes: 'Distribuidor para 120 oficinas na região de Campinas\. Vendedores gastam 3h\/dia montando orçamentos manuais\.'\r?\n\s*\}\);)/;

if (regex.test(content)) {
  const replacement = `$1  let l1, l2, l3, l4, l5;
  if (leadsDB.countByTenant(tenantId) === 0) {
$2
  } else {
    const existing = leadsDB.findByTenant(tenantId);
    l1 = existing[0] || {};
    l2 = existing[1] || {};
    l3 = existing[2] || {};
    l4 = existing[3] || {};
    l5 = existing[4] || {};
  }`;
  
  // Replace only the const l1... with let l1...
  const updated = content.replace(regex, (match, p1, p2) => {
    const p2WithLets = p2
      .replace('const l1 =', 'l1 =')
      .replace('const l2 =', 'l2 =')
      .replace('const l3 =', 'l3 =')
      .replace('const l4 =', 'l4 =')
      .replace('const l5 =', 'l5 =');
    return `${p1}  let l1, l2, l3, l4, l5;
  if (leadsDB.countByTenant(tenantId) === 0) {
  ${p2WithLets}
  } else {
    const existing = leadsDB.findByTenant(tenantId);
    l1 = existing[0] || {};
    l2 = existing[1] || {};
    l3 = existing[2] || {};
    l4 = existing[3] || {};
    l5 = existing[4] || {};
  }`;
  });

  fs.writeFileSync(seedsPath, updated, 'utf8');
  console.log('✅ database/seeds.js patched with idempotent leads guard!');
} else {
  console.log('⚠️ Pattern not matched in database/seeds.js');
}
