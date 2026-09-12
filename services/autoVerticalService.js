/**
 * Módulo Vertical Agentise Auto (Concessionárias, Lojas e Revendas Automotivas)
 * Estoque de veículos, simulação de financiamento, avaliação de troca e test-drive.
 */

const { vehiclesDB, dealsDB, leadsDB } = require('../database/db');

function getVehicles(tenantId, filters = {}) {
  let list = vehiclesDB.findByTenant(tenantId);
  if (filters.status) {
    list = list.filter(v => v.status === filters.status);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    list = list.filter(v => 
      v.model.toLowerCase().includes(q) || 
      v.brand.toLowerCase().includes(q) || 
      (v.plate && v.plate.toLowerCase().includes(q))
    );
  }
  return list;
}

function calculateFinancing({ vehiclePrice, downPayment = 0, termMonths = 48, monthlyInterestRate = 0.0159 }) {
  const financedAmount = Math.max(0, vehiclePrice - downPayment);
  if (financedAmount === 0) {
    return { financedAmount: 0, monthlyInstallment: 0, totalPayable: downPayment };
  }

  // Fórmula Tabela Price (Amortização Francesa)
  const i = monthlyInterestRate;
  const n = termMonths;
  const factor = (Math.pow(1 + i, n) * i) / (Math.pow(1 + i, n) - 1);
  const monthlyInstallment = financedAmount * factor;
  const totalPayable = downPayment + (monthlyInstallment * n);

  return {
    vehiclePrice,
    downPayment,
    financedAmount,
    termMonths,
    monthlyInterestRate: (monthlyInterestRate * 100).toFixed(2) + '% a.m.',
    monthlyInstallment: Math.round(monthlyInstallment * 100) / 100,
    totalPayable: Math.round(totalPayable * 100) / 100
  };
}

function seedAutoDemoData(tenantId) {
  if (vehiclesDB.findByTenant(tenantId).length > 0) return;

  const demoVehicles = [
    {
      tenantId,
      brand: 'Toyota',
      model: 'Corolla Cross XRE 2.0 Flex',
      year: 2024,
      color: 'Branco Pérola',
      km: 14200,
      price: 158900,
      plate: 'R**-4B21',
      fuel: 'Flex',
      transmission: 'Automático CVT',
      bodyType: 'SUV',
      status: 'disponivel',
      features: ['Teto Solar', 'Bancos em Couro', 'Controle de Cruzeiro Adaptativo', 'Multimídia 10"']
    },
    {
      tenantId,
      brand: 'Jeep',
      model: 'Compass Longitude T270 Turbo',
      year: 2023,
      color: 'Cinza Granite',
      km: 26500,
      price: 149900,
      plate: 'S**-7F89',
      fuel: 'Flex',
      transmission: 'Automático 6 marchas',
      bodyType: 'SUV',
      status: 'disponivel',
      features: ['Painel Full Digital 10.25"', 'Carregador por Indução', 'Faróis Full LED', 'Park Assist']
    },
    {
      tenantId,
      brand: 'BMW',
      model: '320i M Sport 2.0 Turbo',
      year: 2023,
      color: 'Azul Portimao',
      km: 19800,
      price: 289000,
      plate: 'B**-9A10',
      fuel: 'Gasolina',
      transmission: 'Automático 8 marchas',
      bodyType: 'Sedan',
      status: 'reservado',
      features: ['Pacote M Sport', 'Som Harman Kardon', 'Head-up Display', 'GPS com Realidade Aumentada']
    }
  ];

  for (const v of demoVehicles) {
    vehiclesDB.insert(v);
  }
}

module.exports = {
  getVehicles,
  calculateFinancing,
  seedAutoDemoData
};
