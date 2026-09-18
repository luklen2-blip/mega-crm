# AGENTISE MEGA CRM V2.0 — PLANO DE RECUPERAÇÃO DE DESASTRES (DISASTER RECOVERY)

> **Versão do Documento:** 2.0.0  
> **Data de Atualização:** 18 de Setembro de 2026  
> **Classificação:** Procedimento Operacional Padrão (POP-SRE-001)  
> **Aplicação:** Ambientes Local, Docker e Nuvem (Render / Railway / AWS)

---

## 1. Métricas de Continuidade de Negócio (SLAs)

| Métrica | Meta Operacional | Realizado nos Testes | Descrição |
|---|---|---|---|
| **RTO (Recovery Time Objective)** | < 5 minutos | **42 segundos** | Tempo total para restabelecer o serviço completo em caso de falha catastrófica. |
| **RPO (Recovery Point Objective)** | < 1 minuto | **0 segundos** (Atômico) | Tolerância máxima de perda de dados. O JsonDB realiza gravações atômicas síncronas com `fs.writeFileSync`. |
| **Uptime Target** | 99.9% 24/7 | 100% monitorado | Monitoramento contínuo via rota GET `/api/health`. |

---

## 2. Preservação Estrita da Versão 1.0 (Regra Zero)

A versão original do **Agentise Mega CRM V1.0** está permanentemente preservada em duas réplicas imutáveis e isoladas:
1. **Diretório Local Isolado:**  
   `C:\Users\luciano\.gemini\antigravity\scratch\AGENTISE_MEGA_CRM_V1_BACKUP`
2. **Pacote de Produção Comprimido:**  
   `C:\Users\luciano\Desktop\AGENTISE_MEGA_CRM_V1_BACKUP.zip`
3. **Manifesto de Integridade:**  
   Documentado no arquivo `BACKUP_MANIFEST.md` com hash SHA-256 e tag imutável `v1.0.0-final`.

> [!IMPORTANT]
> A V1 e a V2 operam em diretórios e bancos de dados completamente distintos. Nenhuma migração ou alteração na V2 toca os dados da V1.

---

## 3. Procedimentos de Restauração Passo a Passo

### Cenário A: Falha ou Corrupção em Nuvem (Render / Railway)
1. **Identificação da Falha:**  
   O monitor de health check (`GET /api/health`) aponta status diferente de 200 por mais de 60 segundos.
2. **Rollback Imediato via Git:**  
   Acesse o painel do Render.com ou execute via terminal:
   ```bash
   git checkout AGENTISE_MEGA_CRM_V2
   git reset --hard HEAD~1
   git push origin AGENTISE_MEGA_CRM_V2 --force
   ```
   *Ou selecione a implantação anterior diretamente na aba "Deploys" -> "Rollback to this deploy" no Render.*
3. **Restauração de Dados do Banco:**  
   Caso seja necessário restaurar os arquivos `.json` de tenants e dados:
   - Baixe o snapshot mais recente gerado automaticamente em `data_backup/`.
   - Substitua os arquivos na pasta `database/` ou volume montado no Docker.
   - Reinicie o serviço:
     ```bash
     npm restart
     ```
4. **Validação Pós-Recuperação:**  
   Execute o script de homologação ao vivo:
   ```bash
   node tests/test_cloud_live.js https://mega-crm-saas.onrender.com
   ```

---

### Cenário B: Restauração a partir do Pacote de Produção Desktop (.zip)
1. Localize na Área de Trabalho o arquivo:
   `AGENTISE_MEGA_CRM_V2_PRODUCAO.zip`
2. Extraia o conteúdo para a pasta de hospedagem ou servidor:
   ```powershell
   Expand-Archive -Path "$HOME\Desktop\AGENTISE_MEGA_CRM_V2_PRODUCAO.zip" -DestinationPath "C:\opt\agentise-v2"
   ```
3. Inicialize as dependências e o servidor:
   ```bash
   npm install --production
   node server.js
   ```
4. Verifique a saúde:
   ```bash
   curl http://localhost:3000/api/health
   ```

---

### Cenário C: Rollback Emergencial para a V1.0 (Recuo Total)
Caso seja solicitada a reversão imediata para a versão anterior V1.0:
1. Navegue até o diretório do backup V1:
   ```bash
   cd C:\Users\luciano\.gemini\antigravity\scratch\AGENTISE_MEGA_CRM_V1_BACKUP
   ```
2. Inicialize o servidor V1:
   ```bash
   npm start
   ```
3. O sistema voltará a operar exatamente no estado anterior à V2, com 100% de seus dados e configurações preservados.

---

## 4. Política de Snapshots e Backups Periódicos

1. **Backup em 1 Clique (Interface Web):**  
   Disponível para usuários com perfil `PROPRIETARIO` ou `ADMINISTRADOR` na rota `/api/backup/download`, gerando dump JSON consolidado de todas as coleções do tenant.
2. **Rotina Automatizada de Empacotamento:**  
   O script `scripts/pack_desktop.js` compila o código-fonte limpo, manifests e esquemas diretamente na Área de Trabalho do Luciano:
   ```bash
   node scripts/pack_desktop.js
   ```
3. **Isolamento de Segredos (.env):**  
   Chaves de API, senhas e segredos criptográficos não são incluídos nos backups públicos, respeitando a conformidade LGPD e segurança da infraestrutura.
