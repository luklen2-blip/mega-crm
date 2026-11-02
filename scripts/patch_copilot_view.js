const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'public', 'index.html');
const appPath = path.join(__dirname, '..', 'public', 'app.js');

let indexContent = fs.readFileSync(indexPath, 'utf8');
let appContent = fs.readFileSync(appPath, 'utf8');

// 1. New view-copilot HTML
const newCopilotView = `      <!-- ============================================== -->
      <!-- VIEW 5: AGENTE COMERCIAL IA & AUTOMAÇÃO DE FECHAMENTO -->
      <!-- ============================================== -->
      <section id="view-copilot" class="hidden space-y-6">
        <!-- Top Header com Fechamento Correto -->
        <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
          <div>
            <h1 class="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <i data-lucide="bot" class="h-6 w-6 text-blue-400"></i>
              <span>Agente Comercial IA & Automação</span>
            </h1>
            <p class="text-xs text-slate-400">Agentes especialistas autônomos (Sofia Closer & Lucas SDR), simulação ao vivo, transbordo humano e diagnóstico BANT.</p>
          </div>

          <div class="flex flex-wrap items-center gap-2">
            <!-- Seletor de Modelo Multi-LLM -->
            <div class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300">
              <i data-lucide="cpu" class="h-3.5 w-3.5 text-blue-400 shrink-0"></i>
              <select id="ai-model-selector" class="bg-transparent text-xs text-white font-semibold focus:outline-none cursor-pointer pr-1">
                <option value="auto">⚡ Automático (Roteamento)</option>
                <option value="claude">🟣 Claude 3.5 Sonnet</option>
                <option value="gemini">🔵 Gemini 1.5 Flash</option>
                <option value="openai">🟢 GPT-4o Mini</option>
                <option value="ollama">🏠 Ollama Local</option>
              </select>
            </div>

            <!-- 4 Níveis Operacionais da IA -->
            <div class="flex items-center gap-1.5 p-1 bg-slate-900 border border-slate-700 rounded-xl">
              <button onclick="setAiLevel('desativada')" id="btn-ai-desativada" class="px-2.5 py-1 text-[11px] rounded-lg font-medium text-slate-400 transition">Desativada</button>
              <button onclick="setAiLevel('assistente')" id="btn-ai-assistente" class="px-2.5 py-1 text-[11px] rounded-lg font-medium text-slate-400 transition">Assistente</button>
              <button onclick="setAiLevel('copiloto')" id="btn-ai-copiloto" class="px-2.5 py-1 text-[11px] rounded-lg font-semibold bg-blue-600 text-white transition">Copiloto</button>
              <button onclick="setAiLevel('autonoma')" id="btn-ai-autonoma" class="px-2.5 py-1 text-[11px] rounded-lg font-medium text-slate-400 transition">Autônoma</button>
            </div>

            <!-- Botão Novo Agente -->
            <button onclick="openNewAiAgentModal()" class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md shadow-blue-600/30 transition border border-blue-400/40">
              <i data-lucide="user-plus" class="h-3.5 w-3.5"></i>
              <span>+ Novo Agente IA</span>
            </button>
          </div>
        </div>

        <!-- Seletor de Sub-Abas do Agente Comercial -->
        <div class="flex items-center gap-2 border-b border-slate-800 pb-2">
          <button id="tab-btn-ai-agents" onclick="switchCopilotTab('agents')" class="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white transition flex items-center gap-1.5">
            <i data-lucide="users" class="h-3.5 w-3.5"></i>
            <span>Equipe de Agentes & Transbordo</span>
          </button>
          <button id="tab-btn-ai-simulator" onclick="switchCopilotTab('simulator')" class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5">
            <i data-lucide="message-square" class="h-3.5 w-3.5"></i>
            <span>Simulador ao Vivo (Sandbox)</span>
          </button>
          <button id="tab-btn-ai-bant" onclick="switchCopilotTab('bant')" class="px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5">
            <i data-lucide="target" class="h-3.5 w-3.5"></i>
            <span>Copiloto de Fechamento & BANT</span>
          </button>
        </div>

        <!-- SUB-ABA 1: EQUIPE DE AGENTES & TRANSBORDO -->
        <div id="copilot-subtab-agents" class="space-y-6">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" id="ai-agents-cards-container">
            <div class="glass-card p-5 rounded-2xl border border-blue-500/20 text-center py-8 text-slate-400 text-xs">
              Carregando agentes de IA...
            </div>
          </div>

          <!-- Card de Regras e Transbordo Humano Inteligente -->
          <div class="glass-card p-5 rounded-2xl border border-amber-500/20 space-y-3 bg-gradient-to-br from-slate-900/90 to-amber-950/20">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div class="flex items-center gap-2">
                <i data-lucide="shield-alert" class="h-5 w-5 text-amber-400"></i>
                <h3 class="text-sm font-bold text-white">Central de Transbordo Humano Inteligente (Handover Engine)</h3>
              </div>
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-300">Proteção Ativa 24/7</span>
            </div>
            <p class="text-xs text-slate-300 leading-relaxed">
              Quando um lead atinge qualquer um dos critérios de segurança abaixo, o Agente de IA pausa o atendimento autônomo e transfere a conversa para um atendente humano instantaneamente, gerando uma <strong>Tarefa Urgente</strong> no painel de vendedores:
            </p>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1">
                <div class="font-bold text-amber-300 flex items-center gap-1.5">
                  <i data-lucide="message-circle" class="h-3.5 w-3.5"></i>
                  <span>1. Palavras de Transbordo</span>
                </div>
                <p class="text-[11px] text-slate-400">Termos como: <code class="text-amber-200">humano</code>, <code class="text-amber-200">atendente</code>, <code class="text-amber-200">gerente</code>, <code class="text-amber-200">reclamação</code>, <code class="text-amber-200">cancelar</code>, <code class="text-amber-200">ouvidoria</code>.</p>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1">
                <div class="font-bold text-rose-300 flex items-center gap-1.5">
                  <i data-lucide="alert-octagon" class="h-3.5 w-3.5"></i>
                  <span>2. Risco Jurídico / Crítico</span>
                </div>
                <p class="text-[11px] text-slate-400">Detecção de menções a processos, Procon, danos morais ou insatisfação severa.</p>
              </div>
              <div class="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs space-y-1">
                <div class="font-bold text-blue-300 flex items-center gap-1.5">
                  <i data-lucide="dollar-sign" class="h-3.5 w-3.5"></i>
                  <span>3. Teto de Autonomia</span>
                </div>
                <p class="text-[11px] text-slate-400">Oportunidades acima do teto definido (ex: &gt; R$ 35.000) requerem aprovação e fechamento humano.</p>
              </div>
            </div>
          </div>
        </div>

        <!-- SUB-ABA 2: SIMULADOR INTERATIVO AO VIVO -->
        <div id="copilot-subtab-simulator" class="hidden space-y-4">
          <div class="glass-card p-5 rounded-2xl border border-blue-500/20 space-y-4">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
              <div>
                <h3 class="text-sm font-bold text-white flex items-center gap-2">
                  <i data-lucide="play-circle" class="h-4 w-4 text-emerald-400"></i>
                  <span>Simulador de Atendimento Comercial ao Vivo</span>
                </h3>
                <p class="text-xs text-slate-400">Teste em tempo real como o seu Agente de IA atende clientes, apresenta produtos e aciona o transbordo.</p>
              </div>
              <div class="flex items-center gap-2">
                <label class="text-xs text-slate-400">Agente em Teste:</label>
                <select id="simulator-agent-select" class="px-3 py-1.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white font-semibold focus:outline-none">
                  <!-- Populado dinamicamente -->
                </select>
              </div>
            </div>

            <!-- Banner de Alerta de Transbordo (Oculto até disparar) -->
            <div id="simulator-handover-alert" class="hidden p-3.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs flex items-start gap-2.5 transition">
              <i data-lucide="bell-ring" class="h-4 w-4 text-amber-400 shrink-0 mt-0.5"></i>
              <div class="flex-1">
                <strong class="font-bold text-amber-300">🚨 Transbordo Humano Acionado com Sucesso!</strong>
                <p id="simulator-handover-reason" class="text-[11px] text-amber-200/90 mt-0.5">Cliente solicitou atendimento humano explícito.</p>
              </div>
            </div>

            <!-- Histórico de Conversa do Simulador -->
            <div id="simulator-chat-box" class="h-80 overflow-y-auto space-y-3 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
              <div class="flex gap-2.5 items-start">
                <div class="h-7 w-7 rounded-full bg-blue-600/30 border border-blue-500/40 text-blue-300 flex items-center justify-center font-bold text-xs shrink-0">IA</div>
                <div class="p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs text-slate-200 max-w-lg leading-relaxed">
                  Olá! Sou a assistente comercial inteligente do Mega CRM. Como posso acelerar os resultados do seu negócio hoje?
                </div>
              </div>
            </div>

            <!-- Botões de Teste Rápido (1 Clique) -->
            <div class="flex flex-wrap items-center gap-1.5 pt-1">
              <span class="text-[11px] text-slate-400">Testes rápidos:</span>
              <button onclick="testQuickSimulatorPrompt('Quais são as condições de pagamento e faturamento no PIX?')" class="px-2.5 py-1 text-[11px] rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition">"Como funciona o pagamento via PIX?"</button>
              <button onclick="testQuickSimulatorPrompt('Quero falar com um atendente humano agora')" class="px-2.5 py-1 text-[11px] rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 transition">"Quero falar com humano" (Transbordo)</button>
              <button onclick="testQuickSimulatorPrompt('Tenho 50 filiais e orçamento de R$ 90.000')" class="px-2.5 py-1 text-[11px] rounded-lg bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 transition">"Orçamento R$ 90.000" (Teto Autonomia)</button>
            </div>

            <!-- Input do Simulador -->
            <div class="flex gap-2">
              <input type="text" id="simulator-message-input" onkeydown="if(event.key==='Enter') sendSimulatorMessage()" placeholder="Digite uma mensagem como se fosse um cliente (ex: quais são os diferenciais do sistema?)..." class="flex-1 px-3.5 py-2.5 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500">
              <button type="button" id="btn-send-simulator" onclick="sendSimulatorMessage()" class="px-5 py-2.5 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition">
                <i data-lucide="send" class="h-3.5 w-3.5"></i>
                <span>Enviar</span>
              </button>
            </div>
          </div>
        </div>

        <!-- SUB-ABA 3: COPILOTO DE FECHAMENTO & BANT -->
        <div id="copilot-subtab-bant" class="hidden">
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <!-- Left: Seletor de Contexto -->
            <div class="lg:col-span-5 glass-card p-5 rounded-2xl border border-blue-500/15 space-y-4">
              <h3 class="text-sm font-bold text-white">Contexto da Negociação</h3>
              <div>
                <label class="block text-xs text-slate-400 mb-1">Selecione o Lead para Diagnóstico</label>
                <select id="copilot-lead-select" onchange="onCopilotLeadChange()" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white">
                  <!-- Preenchido via app.js -->
                </select>
              </div>

              <!-- BANT Breakdown Card -->
              <div id="bant-card" class="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-slate-300">Score BANT Geral</span>
                  <span id="bant-score" class="text-lg font-black text-blue-400">0/100</span>
                </div>
                <div class="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                  <div id="bant-bar" class="bg-blue-500 h-full rounded-full transition-all duration-500" style="width: 0%"></div>
                </div>
                <div class="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>Budget: <strong id="bant-b" class="text-slate-200">0/25</strong></div>
                  <div>Authority: <strong id="bant-a" class="text-slate-200">0/25</strong></div>
                  <div>Need: <strong id="bant-n" class="text-slate-200">0/25</strong></div>
                  <div>Timing: <strong id="bant-t" class="text-slate-200">0/25</strong></div>
                </div>
                <div id="bant-insights" class="text-[11px] text-slate-400 border-t border-slate-800 pt-2 space-y-1"></div>
              </div>
            </div>

            <!-- Right: Ferramentas de Fechamento -->
            <div class="lg:col-span-7 glass-card p-5 rounded-2xl border border-blue-500/15 space-y-4">
              <div class="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 class="text-sm font-bold text-white">Gerador de Mensagem & Quebra de Objeção</h3>
                <div class="flex gap-2">
                  <button onclick="generatePitchAction('primeiro_contato')" class="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Abertura</button>
                  <button onclick="generatePitchAction('apresentacao_valor')" class="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Valor/ROI</button>
                  <button onclick="generatePitchAction('follow_up_proposta')" class="px-2.5 py-1 text-xs rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition">Follow-up</button>
                </div>
              </div>

              <!-- Chat Livre com Copiloto IA -->
              <div class="flex gap-2">
                <input type="text" id="copilot-freeform-input" onkeydown="if(event.key==='Enter') sendFreeformCopilotPrompt()" placeholder="Pergunte ao Copiloto (ex: crie um script para contornar objeção de prazo)..." class="flex-1 px-3 py-2 text-xs rounded-xl bg-slate-900 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500">
                <button type="button" id="btn-send-freeform" onclick="sendFreeformCopilotPrompt()" class="px-3.5 py-2 text-xs font-semibold rounded-xl bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5 transition">
                  <i data-lucide="send" class="h-3.5 w-3.5"></i>
                  <span>Enviar</span>
                </button>
              </div>

              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="block text-xs text-slate-400">Mensagem Gerada pela IA</label>
                  <div id="copilot-meta-badge" class="text-[10px] text-slate-500 flex items-center gap-3">
                    <span>Modelo: <strong id="copilot-used-model" class="text-blue-400">Auto</strong></span>
                    <span>Latência: <strong id="copilot-latency" class="text-emerald-400">-</strong></span>
                  </div>
                </div>
                <textarea id="copilot-output" rows="6" class="w-full p-3 text-xs rounded-xl bg-slate-900 border border-slate-700 text-slate-200 focus:outline-none focus:border-blue-500" placeholder="Aguardando comando do vendedor..."></textarea>
              </div>

              <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                <div class="flex flex-wrap items-center gap-1.5">
                  <span class="text-xs text-slate-400">Contorno rápido:</span>
                  <button onclick="handleObjectionAction('caro')" class="px-2 py-1 text-[11px] rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition">"Está Caro"</button>
                  <button onclick="handleObjectionAction('pensar')" class="px-2 py-1 text-[11px] rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 transition">"Vou Pensar"</button>
                  <button onclick="handleObjectionAction('concorrente')" class="px-2 py-1 text-[11px] rounded-lg bg-blue-500/15 border border-blue-500/30 text-blue-300 hover:bg-blue-500/25 transition">"Concorrente"</button>
                  <button onclick="handleObjectionAction('prazo')" class="px-2 py-1 text-[11px] rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-300 hover:bg-purple-500/25 transition">"Sem Tempo"</button>
                </div>

                <div class="flex items-center gap-2">
                  <button onclick="copyCopilotText()" class="px-3 py-2 text-xs font-semibold rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1.5 transition">
                    <i data-lucide="copy" class="h-3.5 w-3.5"></i>
                    <span>Copiar</span>
                  </button>
                  <button id="btn-send-whatsapp-pitch" onclick="sendPitchWhatsApp()" class="px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition">
                    <i data-lucide="message-circle" class="h-4 w-4"></i>
                    <span>Enviar no WhatsApp</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>`;

// 2. Modal HTML
const newAiAgentModal = `
  <!-- MODAL: NOVO AGENTE COMERCIAL IA -->
  <div id="modal-new-ai-agent" class="fixed inset-0 z-50 modal-backdrop hidden flex items-center justify-center p-3 sm:p-4">
    <div class="glass-card w-full max-w-lg p-5 sm:p-6 rounded-3xl border border-blue-500/25 bg-slate-900/95 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
      <div class="flex items-center justify-between border-b border-slate-800 pb-3">
        <h3 class="text-base font-bold text-white flex items-center gap-2">
          <i data-lucide="bot" class="h-5 w-5 text-blue-400"></i>
          <span>Cadastrar Novo Agente Comercial IA</span>
        </h3>
        <button onclick="closeNewAiAgentModal()" class="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition">
          <i data-lucide="x" class="h-4 w-4"></i>
        </button>
      </div>

      <form id="form-new-ai-agent" onsubmit="event.preventDefault(); submitNewAiAgent();" class="space-y-3.5">
        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Nome do Agente *</label>
          <input type="text" id="ai-agent-name" required placeholder="Ex: Beatriz - Closer VIP" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500">
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Papel Especialista</label>
            <select id="ai-agent-role" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none">
              <option value="CLOSER">CLOSER (Negociação & Fechamento)</option>
              <option value="SDR">SDR (Prospecção & Qualificação)</option>
              <option value="SUPPORT">SUPORTE (Atendimento Pós-Venda)</option>
            </select>
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Nível de Autonomia</label>
            <select id="ai-agent-autonomy" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none">
              <option value="copiloto">Copiloto (Sugere respostas)</option>
              <option value="autonoma">Autônoma (Responde direto)</option>
              <option value="assistente">Assistente (Sob comando)</option>
            </select>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Teto de Autonomia (R$)</label>
            <input type="number" id="ai-agent-max-autonomy" value="25000" min="1000" step="500" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none">
          </div>
          <div>
            <label class="block text-xs font-semibold text-slate-300 mb-1">Tom de Voz</label>
            <select id="ai-agent-tone" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none">
              <option value="consultivo_estrategico">Consultivo & Estratégico</option>
              <option value="dinamico_proativo">Dinâmico & Proativo</option>
              <option value="formal_executivo">Formal Executivo</option>
              <option value="empatico_acolhedor">Empático & Acolhedor</option>
            </select>
          </div>
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Palavras-chave de Transbordo (separadas por vírgula)</label>
          <input type="text" id="ai-agent-handover" value="humano, atendente, gerente, cancelar, processo, procon" class="w-full px-3 py-2 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none">
        </div>

        <div>
          <label class="block text-xs font-semibold text-slate-300 mb-1">Instruções / Prompt do Sistema</label>
          <textarea id="ai-agent-prompt" rows="3" placeholder="Defina a personalidade, regras de faturamento e scripts que o agente deve seguir..." class="w-full p-2.5 text-xs rounded-xl bg-slate-950 border border-slate-800 text-white focus:outline-none focus:border-blue-500">Você é um agente comercial experiente e persuasivo. Seu objetivo é entender o cenário do cliente, tirar dúvidas e conduzir ao fechamento com proposta formal e pagamento via PIX oficial.</textarea>
        </div>

        <div class="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
          <button type="button" onclick="closeNewAiAgentModal()" class="px-4 py-2 text-xs font-medium rounded-xl text-slate-300 hover:bg-slate-800 transition">Cancelar</button>
          <button type="submit" class="px-5 py-2 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-500 text-white transition flex items-center gap-1.5">
            <i data-lucide="check" class="h-3.5 w-3.5"></i>
            <span>Salvar Agente</span>
          </button>
        </div>
      </form>
    </div>
  </div>
`;

// Replace view-copilot in index.html
const startTag = '<!-- VIEW 5: AGENTE COMERCIAL CLAUDE AI -->';
const endTag = '<!-- VIEW 6: CÉREBRO DA EMPRESA (KNOWLEDGE BASE) -->';

const startIndex = indexContent.indexOf(startTag);
const endIndex = indexContent.indexOf(endTag);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find view-copilot bounds in index.html!');
  process.exit(1);
}

// Find previous line boundary before startTag
const prevComment = '<!-- ============================================== -->';
const realStart = indexContent.lastIndexOf(prevComment, startIndex);

indexContent = indexContent.substring(0, realStart) + newCopilotView + '\n\n' + indexContent.substring(endIndex - prevComment.length - 1);

// Add modal if not already present
if (!indexContent.includes('id="modal-new-ai-agent"')) {
  const modalAnchor = '<!-- ============================================== -->\n  <!-- MODAIS DO SISTEMA -->';
  const modalIndex = indexContent.indexOf(modalAnchor);
  if (modalIndex !== -1) {
    indexContent = indexContent.substring(0, modalIndex + modalAnchor.length) + '\n' + newAiAgentModal + '\n' + indexContent.substring(modalIndex + modalAnchor.length);
  } else {
    indexContent = indexContent.replace('</body>', newAiAgentModal + '\n</body>');
  }
}

fs.writeFileSync(indexPath, indexContent, 'utf8');
console.log('✅ public/index.html updated successfully with complete view-copilot and modal!');

// Update public/app.js
// 1. In switchView, ensure loadCopilotView is triggered
if (!appContent.includes("if (viewName === 'copilot') loadCopilotView();")) {
  appContent = appContent.replace(
    "if (viewName === 'pix') loadProposals();",
    "if (viewName === 'pix') loadProposals();\n  if (viewName === 'copilot') loadCopilotView();"
  );
}

// 2. Add client functions for AI Agents, Simulator, and Tabs
const appAddition = `

// ==============================================================================
// 13. AGENTE COMERCIAL IA - GESTÃO, SIMULADOR AO VIVO & COPILOTO
// ==============================================================================
let globalAiAgents = [];
let activeCopilotSubtab = 'agents';

async function loadCopilotView() {
  populateLeadSelects();
  await loadAiAgents();
  if (window.lucide) lucide.createIcons();
}

function switchCopilotTab(tab) {
  activeCopilotSubtab = tab;
  const tabs = ['agents', 'simulator', 'bant'];
  tabs.forEach(t => {
    const el = document.getElementById(\`copilot-subtab-\${t}\`);
    const btn = document.getElementById(\`tab-btn-ai-\${t}\`);
    if (el) el.classList.toggle('hidden', t !== tab);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-bold bg-blue-600 text-white transition flex items-center gap-1.5 shadow-sm';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-xl text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 transition flex items-center gap-1.5';
      }
    }
  });
  if (window.lucide) lucide.createIcons();
}

async function loadAiAgents() {
  try {
    const res = await fetch('/api/ai/agents', { headers: authHeaders() });
    const json = await res.json();
    globalAiAgents = json.data || [];
    renderAiAgentsCards();
    populateSimulatorAgentSelect();
  } catch (err) {
    console.error('Erro ao carregar agentes de IA:', err);
  }
}

function renderAiAgentsCards() {
  const container = document.getElementById('ai-agents-cards-container');
  if (!container) return;

  if (globalAiAgents.length === 0) {
    container.innerHTML = \`
      <div class="col-span-full glass-card p-6 rounded-2xl border border-slate-800 text-center text-slate-400 text-xs">
        Nenhum agente comercial configurado no momento. Clique em "+ Novo Agente IA" para cadastrar.
      </div>
    \`;
    return;
  }

  container.innerHTML = globalAiAgents.map(agt => {
    const isCloser = agt.role === 'CLOSER';
    const roleBadge = isCloser 
      ? '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">CLOSER CONSULTIVO</span>'
      : '<span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">SDR HUNTER</span>';
    
    const roleIcon = isCloser ? 'briefcase' : 'target';
    const maxAutonomyFormatted = formatBRL ? formatBRL(agt.maxDealAutonomy || 30000) : \`R$ \${Number(agt.maxDealAutonomy || 30000).toLocaleString('pt-BR')}\`;

    return \`
      <div class="glass-card p-5 rounded-2xl border border-blue-500/20 flex flex-col justify-between space-y-4 hover:border-blue-500/40 transition shadow-lg">
        <div>
          <div class="flex items-center justify-between pb-2 border-b border-slate-800">
            <div class="flex items-center gap-2.5">
              <div class="h-9 w-9 rounded-xl \${isCloser ? 'bg-purple-600/20 border-purple-500/30 text-purple-300' : 'bg-emerald-600/20 border-emerald-500/30 text-emerald-300'} border flex items-center justify-center font-black text-sm">
                <i data-lucide="\${roleIcon}" class="h-4 w-4"></i>
              </div>
              <div>
                <h4 class="text-sm font-bold text-white">\${escapeHtml(agt.name)}</h4>
                <div class="flex items-center gap-1.5 pt-0.5">
                  \${roleBadge}
                </div>
              </div>
            </div>
            <span class="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold">
              <span class="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Ativo
            </span>
          </div>

          <div class="space-y-2 pt-3 text-xs">
            <div class="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Autonomia:</span>
              <strong class="text-white capitalize">\${agt.autonomyLevel || 'Copiloto'}</strong>
            </div>
            <div class="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Teto de Negociação:</span>
              <strong class="text-emerald-400">\${maxAutonomyFormatted}</strong>
            </div>
            <div class="flex items-center justify-between text-slate-400 text-[11px]">
              <span>Tom de Voz:</span>
              <strong class="text-slate-300 capitalize">\${(agt.tone || 'Consultivo').replace(/_/g, ' ')}</strong>
            </div>

            <p class="text-[11px] text-slate-400 pt-2 line-clamp-2 leading-relaxed italic border-t border-slate-800/80">
              "\${escapeHtml(agt.systemPrompt || '')}"
            </p>
          </div>
        </div>

        <div class="pt-2 border-t border-slate-800 flex items-center gap-2">
          <button onclick="openSimulatorForAgent('\${agt.id}')" class="flex-1 py-2 rounded-xl text-xs font-bold bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/30 transition flex items-center justify-center gap-1.5">
            <i data-lucide="play" class="h-3.5 w-3.5"></i>
            <span>Testar no Simulador</span>
          </button>
        </div>
      </div>
    \`;
  }).join('');

  if (window.lucide) lucide.createIcons();
}

function populateSimulatorAgentSelect() {
  const sel = document.getElementById('simulator-agent-select');
  if (!sel) return;
  sel.innerHTML = globalAiAgents.map(a => \`<option value="\${a.id}">\${escapeHtml(a.name)} (\${a.role})</option>\`).join('');
}

function openSimulatorForAgent(agentId) {
  switchCopilotTab('simulator');
  const sel = document.getElementById('simulator-agent-select');
  if (sel && agentId) sel.value = agentId;
  const input = document.getElementById('simulator-message-input');
  if (input) input.focus();
}

function openNewAiAgentModal() {
  const m = document.getElementById('modal-new-ai-agent');
  if (m) m.classList.remove('hidden');
}

function closeNewAiAgentModal() {
  const m = document.getElementById('modal-new-ai-agent');
  if (m) m.classList.add('hidden');
}

async function submitNewAiAgent() {
  const name = document.getElementById('ai-agent-name')?.value?.trim();
  const role = document.getElementById('ai-agent-role')?.value || 'CLOSER';
  const autonomyLevel = document.getElementById('ai-agent-autonomy')?.value || 'copiloto';
  const maxDealAutonomy = Number(document.getElementById('ai-agent-max-autonomy')?.value || 25000);
  const tone = document.getElementById('ai-agent-tone')?.value || 'consultivo_estrategico';
  const handoverStr = document.getElementById('ai-agent-handover')?.value || '';
  const handoverKeywords = handoverStr.split(',').map(s => s.trim()).filter(Boolean);
  const systemPrompt = document.getElementById('ai-agent-prompt')?.value?.trim() || '';

  if (!name) return showToast('Nome do agente é obrigatório.', 'warning');

  try {
    const res = await fetch('/api/ai/agents', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({
        name,
        role,
        autonomyLevel,
        maxDealAutonomy,
        tone,
        handoverKeywords,
        systemPrompt,
        active: true
      })
    });
    const json = await res.json();
    if (json.success) {
      showToast(\`Agente "\${name}" cadastrado com sucesso!\`, 'success');
      closeNewAiAgentModal();
      await loadAiAgents();
    } else {
      showToast(json.error || 'Erro ao salvar agente.', 'error');
    }
  } catch (err) {
    showToast('Falha na comunicação com o servidor.', 'error');
  }
}

async function sendSimulatorMessage() {
  const input = document.getElementById('simulator-message-input');
  const text = input?.value?.trim();
  if (!text) return;

  const agentId = document.getElementById('simulator-agent-select')?.value;
  if (!agentId) return showToast('Selecione um agente de IA para o teste.', 'warning');

  const chatBox = document.getElementById('simulator-chat-box');
  const btn = document.getElementById('btn-send-simulator');
  const handoverAlert = document.getElementById('simulator-handover-alert');

  // Adiciona balão do cliente
  const userBubble = document.createElement('div');
  userBubble.className = 'flex gap-2.5 items-start justify-end';
  userBubble.innerHTML = \`
    <div class="p-3 rounded-2xl bg-blue-600 text-xs text-white max-w-lg leading-relaxed shadow-sm">
      \${escapeHtml(text)}
    </div>
    <div class="h-7 w-7 rounded-full bg-slate-800 border border-slate-700 text-slate-300 flex items-center justify-center font-bold text-xs shrink-0">VC</div>
  \`;
  chatBox.appendChild(userBubble);
  input.value = '';
  chatBox.scrollTop = chatBox.scrollHeight;

  if (btn) btn.disabled = true;

  try {
    const res = await fetch(\`/api/ai/agents/\${agentId}/interact\`, {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ message: text, channel: 'whatsapp' })
    });
    const json = await res.json();

    const reply = json.reply || json.response || 'Sem resposta do agente.';
    const isHandover = Boolean(json.handover || json.handoverRequired);

    if (isHandover && handoverAlert) {
      handoverAlert.classList.remove('hidden');
      const rEl = document.getElementById('simulator-handover-reason');
      if (rEl) rEl.textContent = json.reason || 'Critério de transbordo humano atingido.';
    }

    const aiBubble = document.createElement('div');
    aiBubble.className = 'flex gap-2.5 items-start';
    aiBubble.innerHTML = \`
      <div class="h-7 w-7 rounded-full \${isHandover ? 'bg-amber-600/30 border-amber-500/40 text-amber-300' : 'bg-blue-600/30 border-blue-500/40 text-blue-300'} border flex items-center justify-center font-bold text-xs shrink-0">
        \${isHandover ? '⚠️' : 'IA'}
      </div>
      <div class="p-3 rounded-2xl \${isHandover ? 'bg-amber-950/40 border border-amber-500/40 text-amber-100' : 'bg-slate-900 border border-slate-800 text-slate-200'} text-xs max-w-lg leading-relaxed shadow-sm space-y-1">
        <div>\${escapeHtml(reply)}</div>
        \${isHandover ? \`<div class="text-[10px] text-amber-300 font-bold pt-1 border-t border-amber-500/30">🚨 Transbordo Humano: \${escapeHtml(json.reason || 'Acionado')}</div>\` : ''}
      </div>
    \`;
    chatBox.appendChild(aiBubble);
    chatBox.scrollTop = chatBox.scrollHeight;
  } catch (err) {
    showToast('Erro ao simular interação com o Agente de IA.', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

function testQuickSimulatorPrompt(text) {
  const input = document.getElementById('simulator-message-input');
  if (input) {
    input.value = text;
    sendSimulatorMessage();
  }
}

function copyCopilotText() {
  const text = document.getElementById('copilot-output')?.value;
  if (!text) return showToast('Nenhum texto para copiar.', 'warning');
  navigator.clipboard.writeText(text).then(() => {
    showToast('Mensagem copiada para a área de transferência!', 'success');
  }).catch(() => {
    showToast('Não foi possível copiar o texto.', 'error');
  });
}
`;

if (!appContent.includes('function loadCopilotView()')) {
  appContent += '\n' + appAddition;
  fs.writeFileSync(appPath, appContent, 'utf8');
  console.log('✅ public/app.js updated successfully with full Agente Comercial engine!');
} else {
  console.log('ℹ️ public/app.js already has loadCopilotView');
}

