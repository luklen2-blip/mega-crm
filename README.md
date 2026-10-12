# 🚀 Agentise Mega CRM — Self-Hosted & White-Label Edition

> **Plataforma Completa de Gestão Comercial, Inteligência Artificial Multimodal, WhatsApp Cloud e Cobranças PIX do Banco Central.**  
> **Versão:** 2.0.0 (Self-Hosted / White-Label Edition) | **Licença:** Comercial Perpétua "As-Is" (R$ 67,00)

---

## 🌟 Visão Geral

O **Agentise Mega CRM** foi desenvolvido para empresas, agências e consultorias que buscam uma solução comercial completa, independente e sem custos recorrentes de mensalidade de software.

Com a arquitetura **BYOK (Bring Your Own Key)** e **Self-Hosted**, você roda a aplicação na sua própria infraestrutura em poucos minutos, conectando diretamente suas próprias contas da OpenAI, Google Gemini, Anthropic Claude e WhatsApp Cloud API.

### Principais Funcionalidades:
- 📊 **Kanban Visual de Oportunidades:** Arraste e solte negócios entre estágios, prioridades e estimativas financeiras.
- 🤖 **Copiloto Comercial com IA Multimodal (BYOK):** Qualificação automática de leads (BANT), sugestões de abordagem e geração de resumos estratégicos via OpenAI GPT-4o, Claude 3.5 Sonnet ou Google Gemini.
- 💬 **WhatsApp Cloud API Nativo:** Envio de mensagens comerciais e automações diretamente pela API oficial da Meta (Graph API).
- ⚡ **PIX Oficial do Banco Central:** Geração instantânea de QR Code dinâmico e payload Copia-e-Cola EMV oficial (sem intermediários e sem taxas percentuais sobre vendas).
- 📄 **Gerador de Propostas Comerciais:** Envie propostas completas com link de aceite e pagamento integrado.
- 🛡️ **Painel de Governança de Créditos:** Administre limites de consumo de tokens de IA para os membros da sua equipe sem faturamento externo.
- 🎨 **White-Label Completo:** Altere nome da marca, cores, logotipo e domínio próprio em segundos.
- 📱 **PWA Mobile-First:** Instale como aplicativo nativo no smartphone (Android e iOS) com suporte offline resiliente.
- 🔒 **Conformidade LGPD:** Políticas de privacidade, termos de uso, logs de auditoria e revogação de dados.

---

## 🛠️ Requisitos Mínimos

- **Node.js:** Versão 20 LTS ou superior.
- **Banco de Dados:** PostgreSQL 14+ (ou banco JsonDB atômico nativo para testes locais).
- **Docker & Docker Compose:** *(Opcional, para VPS / Servidores Dedicados).*

---

## 🚀 Opções de Instalação e Deploy

### Opção 1: Deploy em 1-Clique na Nuvem (Render.com)

1. Crie uma conta gratuita em [Render.com](https://render.com).
2. Conecte seu repositório Git onde subiu os arquivos deste projeto.
3. No painel da Render, clique em **Blueprints** e selecione o arquivo `render.yaml` contido na raiz do projeto.
4. Preencha as variáveis de ambiente com suas chaves de API (OpenAI, Gemini, Meta WhatsApp, Chave PIX).
5. O Render provisionará o Web Service e o Banco PostgreSQL automaticamente com monitoramento de saúde 24/7 (`/api/health`).

---

### Opção 2: Deploy em VPS / Servidor Próprio com Docker Compose

Para rodar em qualquer VPS (Ubuntu, Debian, CentOS, AWS EC2, DigitalOcean, Hetzner):

1. Clone ou descompacte o projeto no seu servidor:
   ```bash
   cd mega-crm
   ```
2. Crie seu arquivo de variáveis de ambiente:
   ```bash
   cp .env.example .env
   nano .env
   ```
3. Suba a aplicação e o banco PostgreSQL 16 Alpine:
   ```bash
   docker compose up -d --build
   ```
4. A aplicação estará ativa e disponível na porta `3000` (ou na porta configurada).

---

### Opção 3: Execução Local / Desenvolvimento

1. Instale as dependências:
   ```bash
   npm install
   ```
2. Configure o arquivo `.env`:
   ```bash
   cp .env.example .env
   ```
3. Inicie o servidor:
   ```bash
   npm start
   ```
4. Abra o navegador em `http://localhost:3000`.

---

## 🔑 Credenciais Padrão do Administrador

Ao iniciar a aplicação pela primeira vez, as credenciais padrão de acesso são:

- **E-mail:** `admin@crm.com`
- **Senha:** `Admin@1234`

> ⚠️ **IMPORTANTE:** Altere a senha e o e-mail no primeiro login acessando as **Configurações** no topo direito da plataforma.

---

## ⚙️ Variáveis de Ambiente (`.env`)

Copie o arquivo `.env.example` para `.env` e preencha conforme suas necessidades:

```env
# Servidor e Ambiente
PORT=3000
NODE_ENV=production
APP_NAME=Agentise Mega CRM
APP_URL=https://seu-dominio.com
JWT_SECRET=gere_uma_chave_secreta_forte_aqui_minimo_32_caracteres

# Banco de Dados PostgreSQL (Opcional - se ausente, utiliza JsonDB local)
DATABASE_URL=postgres://usuario:senha@host:5432/nome_banco

# Inteligência Artificial (BYOK - Bring Your Own Key)
OPENAI_API_KEY=sk-...
GEMINI_API_KEY=AIzaSy...
ANTHROPIC_API_KEY=sk-ant-...

# WhatsApp Cloud API (Meta Graph API)
META_WHATSAPP_TOKEN=EAAG...
META_PHONE_NUMBER_ID=100000000000000

# Pagamentos PIX Oficial Banco Central
PIX_CHAVE=financeiro@suaempresa.com.br
PIX_BENEFICIARIO=Sua Empresa LTDA
PIX_CIDADE=SAO PAULO

# Governança de Créditos de IA para a Equipe
TEAM_AI_CREDITS_LIMIT=50000
```

---

## 🧪 Testes de Qualidade e Segurança

O projeto inclui suíte completa de testes automatizados e testes de invasão (OWASP):

```bash
# Executa todos os testes de rotas, banco e integração (30 testes)
npm test

# Executa testes comerciais de propostas, PIX e BYOK (14 testes)
npm run test:commercial

# Executa bateria de pentest e segurança cibernética (51 testes)
npm run test:pentest
```

---

## 📖 Guia Passo a Passo no Sistema

O sistema inclui uma página interna didática e amigável para clientes e usuários:
- Acesse pelo navegador: `http://localhost:3000/guia-instalacao`

---

## ⚖️ Termos da Licença Comercial (Self-Hosted)

Este software é comercializado sob a licença de uso perpétua "as-is":

> *"Licença de uso de software comercial perpétua em modalidade 'as-is' (no estado em que se encontra). A aquisição pelo valor promocional de R$ 67,00 concede o direito de uso e hospedagem em infraestrutura própria do adquirente. Custos de hospedagem em nuvem, consumo de tokens de inteligência artificial (APIs de terceiros) e taxas de mensageria são de responsabilidade integral do comprador. O produto não inclui suporte técnico contínuo, manutenção ou consultoria de implementação individualizada."*

Para termos completos, consulte o arquivo [`LICENSE.md`](LICENSE.md) e [`public/termos.html`](public/termos.html).
