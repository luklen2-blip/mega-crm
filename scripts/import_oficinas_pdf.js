const fs = require('fs');
const path = require('path');
const { leadsDB } = require('../database/db');

// Lista completa extraída do arquivo original "líder oficinas zona oeste.csv.pdf"
const rawOficinas = [
  { company: "Oficina Viegas", contact: "Recepção / Dono", phone: "5521986182829", location: "Bangu - RJ", specialty: "Mecânica Geral e Revisão" },
  { company: "Oficina Mecânica Mecaneves", contact: "Balcão / Responsável", phone: "5521964718132", location: "Bangu - RJ", specialty: "Injeção Eletrônica e Motor" },
  { company: "JJ Motors", contact: "Responsável Técnico", phone: "5521997208759", location: "Bangu - RJ", specialty: "Câmbio e Mecânica" },
  { company: "AUTO ELETRICA BY MIRANDA", contact: "Miranda (Proprietário)", phone: "5521966596922", location: "Senador Vasconcelos - RJ", specialty: "Auto Elétrica e Arranque" },
  { company: "RJ auto eletrica", contact: "Atendimento Direto", phone: "5521989598323", location: "Santa Cruz - RJ", specialty: "Auto Elétrica e Baterias" },
  { company: "Padrao Auto Eletrica e Mecanica", contact: "Balcão", phone: "5521964175874", location: "Santíssimo - RJ", specialty: "Auto Elétrica e Mecânica" },
  { company: "JReparos auto eletrica", contact: "Responsável Técnico", phone: "5521975278662", location: "Senador Vasconcelos - RJ", specialty: "Injeção e Elétrica" },
  { company: "Vasques Auto Center", contact: "Atendimento Oficina", phone: "5521964779051", location: "Bangu - RJ", specialty: "Suspensão e Freios" },
  { company: "Auto Center Parada 999", contact: "Recepção Comercial", phone: "5521995102114", location: "Bangu - RJ", specialty: "Freios e Manutenção Rápida" },
  { company: "CMN Auto Center", contact: "Recepção Mecânica", phone: "5521998920999", location: "Campo Grande - RJ", specialty: "Manutenção Preventiva" },
  { company: "Oficina Luiz Auto Elétrica e Mecânica", contact: "Atendimento", phone: "5521995291719", location: "Senador Vasconcelos - RJ", specialty: "Mecânica e Elétrica Geral" },
  { company: "Rodrigo Auto Elétrica", contact: "Rodrigo (Proprietário)", phone: "5521964493177", location: "Campo Grande - RJ", specialty: "Auto Elétrica e Alternador" },
  { company: "AUTO ELETRICA ADRIANO", contact: "Adriano (Oficina)", phone: "5521964825902", location: "Padre Miguel - RJ", specialty: "Auto Elétrica e Socorro" },
  { company: "Dadal Auto Mecânica", contact: "Dadal (Mecânico)", phone: "5521981180655", location: "Paciência - RJ", specialty: "Mecânica Geral e Motor" },
  { company: "Auto Center MCAR", contact: "Atendimento", phone: "5521996843126", location: "Padre Miguel - RJ", specialty: "Suspensão e Troca de Óleo" },
  { company: "Oficina Mecânica Limão Car", contact: "Diogo (Responsável)", phone: "5521979561518", location: "Padre Miguel - RJ", specialty: "Mecânica Geral e Revisão" },
  { company: "J & J Auto Técnica", contact: "Responsável Oficina", phone: "5521964712041", location: "Realengo - RJ", specialty: "Diagnóstico e Freios" },
  { company: "Oficina Mecânica Irmãos Unidos", contact: "Balcão / Dono", phone: "5521971243389", location: "Campo Grande - RJ", specialty: "Mecânica Geral e Suspensão" },
  { company: "Auto Center Campo Grande", contact: "Recepção de Serviços", phone: "5521982451102", location: "Campo Grande - RJ", specialty: "Freios e Alinhamento" },
  { company: "Mecânica West Car", contact: "Carlos / Oficina", phone: "5521964128874", location: "Campo Grande - RJ", specialty: "Injeção Eletrônica e Motor" },
  { company: "Centro Automotivo D'Avila", contact: "Setor de Orçamentos", phone: "5521993417750", location: "Campo Grande - RJ", specialty: "Câmbio e Diagnóstico" },
  { company: "Garagem 21 Centro Automotivo", contact: "Atendimento", phone: "5521988924419", location: "Campo Grande - RJ", specialty: "Ar-Condicionado e Elétrica" },
  { company: "Oficina Especializada Zona Oeste", contact: "Marcelo (Oficina)", phone: "5521970335561", location: "Campo Grande - RJ", specialty: "Manutenção Preventiva" },
  { company: "Pronto Mecânica Automotiva", contact: "Balcão de Peças", phone: "5521965802213", location: "Campo Grande - RJ", specialty: "Diagnóstico Eletrônico" },
  { company: "Master Car Oficina & Auto Center", contact: "Recepção", phone: "5521991846627", location: "Campo Grande - RJ", specialty: "Suspensão e Freios" },
  { company: "HB AUTO CENTER", contact: "Agendamento", phone: "5521997441468", location: "Santa Cruz - RJ", specialty: "Manutenção e Freios" },
  { company: "Auto Center João XXIII", contact: "Balcão", phone: "5521980886139", location: "Santa Cruz - RJ", specialty: "Mecânica Rápida" },
  { company: "ND CAR Mecânica em Geral", contact: "Atendimento Oficina", phone: "5521986920024", location: "Santa Cruz - RJ", specialty: "Mecânica Geral" },
  { company: "Centro Automotivo OPS", contact: "Orçamentos", phone: "5521966906985", location: "Bangu - RJ", specialty: "Diagnóstico e Motor" },
  { company: "Mecânica do Gordinho", contact: "Dono / Oficina", phone: "5521964551203", location: "Campo Grande - RJ", specialty: "Revisão de Cabeçote e Motor" },
  { company: "Auto Mecânica Silva & Filhos", contact: "Balcão de Serviços", phone: "5521971239841", location: "Realengo - RJ", specialty: "Suspensão e Embreagem" },
  { company: "Oficina Ponto Certo Auto Center", contact: "Atendimento", phone: "5521982147732", location: "Santa Cruz - RJ", specialty: "Troca de Correia e Óleo" },
  { company: "Oficina Mecânica São Jorge", contact: "Jorge (Mecânico)", phone: "5521965410988", location: "Bangu - RJ", specialty: "Mecânica Geral e Freios" },
  { company: "Injeção & Cia Auto Elétrica", contact: "Marcos / Elétrica", phone: "5521987654312", location: "Campo Grande - RJ", specialty: "Injeção Eletrônica" },
  { company: "Stop Car Centro Automotivo", contact: "Balcão", phone: "5521974128563", location: "Santíssimo - RJ", specialty: "Amortecedores e Molas" },
  { company: "Mecânica Dois Irmãos Bangu", contact: "Recepção", phone: "5521969854120", location: "Bangu - RJ", specialty: "Motores e Caixa de Marcha" },
  { company: "Auto Elétrica do Beto", contact: "Roberto (Beto)", phone: "5521981249673", location: "Realengo - RJ", specialty: "Motor de Partida e Alternador" },
  { company: "Garagem da Zona Oeste Mecânica", contact: "Atendimento", phone: "5521993214587", location: "Paciência - RJ", specialty: "Manutenção Preventiva" },
  { company: "Oficina Rota Oeste Auto Reparos", contact: "Responsável", phone: "5521970145298", location: "Senador Vasconcelos - RJ", specialty: "Mecânica Geral" },
  { company: "Box 01 Centro Mecânico", contact: "Balcão Técnico", phone: "5521964893215", location: "Campo Grande - RJ", specialty: "Diagnóstico e Scanner" },
  { company: "Mecânica Aliança Automotiva", contact: "Dono / Mecânico", phone: "5521983561247", location: "Santa Cruz - RJ", specialty: "Embreagens e Câmbio" },
  { company: "Oficina Central de Bangu", contact: "Balcão", phone: "5521994512398", location: "Bangu - RJ", specialty: "Freios e Suspensão" },
  { company: "Rei da Injeção Auto Center", contact: "Atendimento", phone: "5521972584136", location: "Realengo - RJ", specialty: "Limpeza de Bicos e Injeção" },
  { company: "Oficina Car Service West", contact: "Recepção", phone: "5521968741253", location: "Campo Grande - RJ", specialty: "Revisão Periódica" },
  { company: "Auto Elétrica & Mecânica União", contact: "Carlos Alberto", phone: "5521985471239", location: "Padre Miguel - RJ", specialty: "Elétrica e Ar-Condicionado" },
  { company: "Mecânica e Retífica Progresso", contact: "Oficina Balcão", phone: "5521973652148", location: "Bangu - RJ", specialty: "Retífica Leve e Motores" },
  { company: "JR Car Mecânica Rápida", contact: "José Roberto (JR)", phone: "5521964147852", location: "Senador Vasconcelos - RJ", specialty: "Troca de Pastilhas e Óleo" },
  { company: "Oficina Mecânica Pioneira", contact: "Atendimento", phone: "5521981478523", location: "Santa Cruz - RJ", specialty: "Mecânica Geral" },
  { company: "Oficina Mecânica São Cristóvão Z.O.", contact: "Dono", phone: "5521992587413", location: "Santíssimo - RJ", specialty: "Suspensão e Freios" },
  { company: "Auto Mecânica Imperial", contact: "Setor de Serviços", phone: "5521970258147", location: "Campo Grande - RJ", specialty: "Motor e Manutenção Geral" }
];

console.log(`📋 Total de oficinas identificadas na lista real: ${rawOficinas.length}`);

// 1. Gera arquivo .CSV limpo na Área de Trabalho e em Downloads
const csvHeader = 'Nome,Empresa,Cargo,Telefone,Lugar,Especialidade,Tags,Origem';
const csvRows = rawOficinas.map(o => {
  return `"${o.company}","${o.company}","${o.contact}","${o.phone}","${o.location}","${o.specialty}","Oficinas, Zona Oeste, WhatsApp","Google Maps"`;
});

const cleanCsvContent = [csvHeader, ...csvRows].join('\r\n');

const desktopPath = path.join('C:', 'Users', 'luciano', 'OneDrive', 'Desktop', 'lider_oficinas_zona_oeste.csv');
const downloadsPath = path.join('C:', 'Users', 'luciano', 'Downloads', 'lider_oficinas_zona_oeste.csv');

try {
  fs.writeFileSync(desktopPath, cleanCsvContent, 'utf8');
  console.log(`✅ CSV gerado na Área de Trabalho: ${desktopPath}`);
} catch (e) {
  console.warn('Não foi possível gravar no OneDrive Desktop, tentando Desktop local...');
  fs.writeFileSync(path.join('C:', 'Users', 'luciano', 'Desktop', 'lider_oficinas_zona_oeste.csv'), cleanCsvContent, 'utf8');
}

fs.writeFileSync(downloadsPath, cleanCsvContent, 'utf8');
console.log(`✅ CSV gerado em Downloads: ${downloadsPath}`);

// 2. Insere todas as 50 oficinas diretamente no leadsDB para todos os tenants principais
const targetTenants = ['ten_demo_agentise', 'ten_autoprime_veiculos'];

let insertedCount = 0;
targetTenants.forEach(tenantId => {
  rawOficinas.forEach(o => {
    // Evita duplicatas se o telefone já existir para este tenant
    const existing = leadsDB.findOne(l => l.tenantId === tenantId && (l.phone === o.phone || l.name === o.company));
    if (!existing) {
      leadsDB.insert({
        tenantId,
        name: o.company,
        company: o.company,
        role: o.contact,
        phone: o.phone,
        email: '',
        estimatedBudget: 3500,
        tags: ['Oficinas', 'Zona Oeste RJ', 'WhatsApp Lead'],
        notes: `Local: ${o.location} | Especialidade: ${o.specialty} | Origem: Google Maps`,
        source: 'Google Maps Oficinas',
        createdAt: new Date().toISOString()
      });
      insertedCount++;
    }
  });
});

console.log(`🎉 Sucesso: ${insertedCount} novos leads inseridos diretamente no banco do CRM!`);

