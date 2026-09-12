const { tasksDB, activitiesDB } = require('../database/db');

function onStageChange(deal, oldStage, newStage) {
  const now = new Date().toISOString();

  // 1. Registra atividade no histórico (Timeline)
  activitiesDB.insert({
    dealId: deal.id,
    leadId: deal.leadId,
    type: 'stage_change',
    title: `Oportunidade movida para ${newStage.toUpperCase()}`,
    description: `Estágio alterado de "${oldStage}" para "${newStage}"`,
    timestamp: now
  });

  // 2. Criação automática de tarefas e alertas dependendo do estágio
  if (newStage === 'proposta') {
    tasksDB.insert({
      dealId: deal.id,
      leadId: deal.leadId,
      title: `Gerar e enviar proposta com PIX para ${deal.title}`,
      deadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      completed: false,
      priority: 'alta'
    });
  } else if (newStage === 'negociacao') {
    tasksDB.insert({
      dealId: deal.id,
      leadId: deal.leadId,
      title: `Follow-up estratégico e contorno de objeções com ${deal.title}`,
      deadline: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
      completed: false,
      priority: 'alta'
    });
  } else if (newStage === 'ganho') {
    tasksDB.insert({
      dealId: deal.id,
      leadId: deal.leadId,
      title: `Iniciar Onboarding do cliente e emitir recibo PIX`,
      deadline: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString(),
      completed: false,
      priority: 'urgente'
    });
  }
}

module.exports = {
  onStageChange
};
