# 🔍 ANÁLISE COMPLETA: SISTEMA DE PERMISSÕES

**Data:** 2026-01-18  
**Objetivo:** Mapear TODAS as permissões/bloqueios do sistema e verificar cobertura no painel

---

## 📊 RESUMO EXECUTIVO

### ✅ STATUS ATUAL
- **Permissões mapeadas no painel:** 50+
- **Permissões implementadas no código:** 65+
- **Cobertura:** ~77% (GAPS IDENTIFICADOS ⚠️)

### 🎯 CAMADAS DO SISTEMA
1. **Dados do Usuário** (User entity)
2. **Layout.js** (Menu lateral - páginas visíveis)
3. **Central de Comunicação** (3 subcamadas)
   - Visibilidade de threads
   - Interação em threads
   - Funcionalidades/ações

---

## 🗂️ INVENTÁRIO COMPLETO DE PERMISSÕES

### 1️⃣ DADOS DO USUÁRIO (User Entity)

| Campo | Tipo | Onde Usa | Descrição |
|-------|------|----------|-----------|
| **role** | `admin\|user` | Layout, permissionsService | Papel principal (admin = super poder) |
| **attendant_role** | `junior\|pleno\|senior\|coordenador\|gerente` | Layout, presets | Nível hierárquico do atendente |
| **attendant_sector** | `vendas\|assistencia\|financeiro\|fornecedor\|geral` | Layout, threadVisibility | Setor de atuação |
| **paginas_acesso** | `array[string]` | Layout | Override manual - páginas visíveis no menu |
| **permissoes_comunicacao** | `object` | ChatWindow ❌ LEGADO | **DEPRECADO** - migrar para Nexus360 |
| **configuracao_visibilidade_nexus** | `object` | permissionsService ✅ | Regras de bloqueio/liberação |
| **permissoes_acoes_nexus** | `object` | permissionsService ✅ | 50+ flags de ações |
| **whatsapp_permissions** | `array[object]` | ChatWindow, ConfiguracaoPermissoesWhatsApp | Permissões por instância WhatsApp |
| **diagnostico_nexus** | `object` | permissionsService | Logs de debug de decisões |
| **display_name** | `string` | ChatWindow | Nome exibido (sobrescreve full_name) |

---

### 2️⃣ PERMISSÕES DE MENU (Layout.js)

**Lógica:** Hierárquica (paginas_acesso > role > matriz cargo×setor > fallback)

| Página | Admin | Gerente (Vendas) | Senior (Assistência) | Junior (Geral) |
|--------|-------|------------------|----------------------|----------------|
| Dashboard | ✅ | ✅ | ✅ | ✅ |
| Comunicacao | ✅ | ✅ | ✅ | ✅ |
| LeadsQualificados | ✅ | ✅ | ❌ | ❌ |
| Vendedores (Metas) | ✅ | ✅ | ❌ | ❌ |
| Clientes | ✅ | ✅ | ✅ | ✅ |
| Produtos | ✅ | ✅ | ✅ | ✅ |
| Agenda | ✅ | ✅ | ✅ | ✅ |
| Importacao | ✅ | ❌ | ❌ | ❌ |
| AnalyticsAvancado | ✅ | ✅ | ❌ | ❌ |
| Usuarios | ✅ | ❌ | ❌ | ❌ |
| Auditoria | ✅ | ❌ | ❌ | ❌ |

**⚠️ PROBLEMA IDENTIFICADO:** Lógica hardcoded em `Layout.js` - deveria usar `paginas_acesso` do User

---

### 3️⃣ CENTRAL DE COMUNICAÇÃO - CAMADA 1: VISIBILIDADE DE THREADS

**Arquivo:** `components/lib/threadVisibility.js` + `permissionsService.js`

#### Regras de Prioridade (P1-P12)

| Prioridade | Nome | Descrição | Implementado? |
|------------|------|-----------|---------------|
| **P1** | Thread Interna | Se `thread_type=team_internal\|sector_group` → participante? | ✅ |
| **P2** | Admin Total | Se `role=admin` → TUDO | ✅ |
| **P3** | Thread Atribuída | Se `assigned_user_id = meu ID` → SIM | ✅ |
| **P4** | Contato Fidelizado | Se `atendente_fidelizado_* = meu ID` → SIM | ✅ |
| **P5** | Janela 24h | Se msg cliente < 24h → SIM (exceto se fidelizado a outro) | ✅ |
| **P6** | Ver Carteira Outros | Flag: `podeVerCarteiraOutros` → ver fidelizados de colegas | ✅ PAINEL |
| **P7** | Ver Conversas Outros | Flag: `podeVerConversasOutros` → ver atribuídas a colegas | ✅ PAINEL |
| **P8** | Gerente Supervisão | Se gerente + thread sem resposta > 30min → SIM | ✅ |
| **P9** | Bloqueio Canal | Se canal in `canaisBloqueados` → NÃO | ✅ |
| **P10** | Bloqueio Integração | Se integration_id in `integracoesBloqueadas` → NÃO | ✅ |
| **P11** | Bloqueio Setor | Se sector_id in `setoresBloqueados` → NÃO | ✅ |
| **P12** | Nexus360 Default | Nenhuma regra? → LIBERADO | ✅ |

---

### 4️⃣ CENTRAL DE COMUNICAÇÃO - CAMADA 2: INTERAÇÃO EM THREADS

**Arquivo:** `ChatWindow.jsx` → função `podeInteragirNaThread`

| Verificação | Código | No Painel? |
|-------------|--------|------------|
| Admin sempre pode | `role === 'admin'` | ❌ (implícito) |
| Thread atribuída a mim | `assigned_user_id === meu ID` | ❌ (implícito) |
| Contato fidelizado a mim | `atendente_fidelizado_* === meu ID` | ❌ (implícito) |
| Gerente/Coordenador sempre pode | `attendant_role in [gerente, coordenador]` | ❌ (implícito) |
| Thread não atribuída | `!assigned_user_id` | ✅ `podeVerNaoAtribuidas` |

**⚠️ GAP:** Interação não está explícita no painel - está embutida na lógica de visibilidade

---

### 5️⃣ CENTRAL DE COMUNICAÇÃO - CAMADA 3: FUNCIONALIDADES

#### 📤 ENVIO DE MENSAGENS (ChatWindow.jsx)

| Permissão | Campo User | No Painel? | Onde Verifica |
|-----------|------------|------------|---------------|
| Enviar texto | `permissoes_comunicacao.pode_enviar_mensagens` ❌ LEGADO | ✅ | ChatWindow linha ~340 |
| Enviar mídias | `permissoes_comunicacao.pode_enviar_midias` ❌ LEGADO | ✅ | ChatWindow linha ~341 |
| Enviar áudios | `permissoes_comunicacao.pode_enviar_audios` ❌ LEGADO | ✅ | ChatWindow linha ~342 |
| Apagar mensagens | `permissoes_comunicacao.pode_apagar_mensagens` ❌ LEGADO | ✅ | ChatWindow linha ~343 |
| Enviar por instância WhatsApp específica | `whatsapp_permissions[].can_send` | ✅ | ChatWindow linha ~330 |

**⚠️ PROBLEMA CRÍTICO:** ChatWindow ainda usa `permissoes_comunicacao` (legado) - deveria usar `permissoes_acoes_nexus`

---

#### 💬 GESTÃO DE CONVERSAS

| Permissão | No Painel? | Implementado? | Arquivo |
|-----------|------------|---------------|---------|
| Transferir conversas | ✅ | ✅ | ChatWindow, AtribuirConversaModal |
| Atribuir conversas | ✅ | ✅ | AtribuirConversaModal |
| Marcar como lida | ✅ NOVO | ✅ | ChatWindow (mutation) |
| Encerrar conversa | ✅ NOVO | ❌ **FALTA IMPLEMENTAR** | - |
| Reabrir arquivadas | ✅ NOVO | ❌ **FALTA IMPLEMENTAR** | - |
| Assumir fila | ❌ **FALTA** | ✅ | CentralControleOperacional |
| Criar notas internas | ❌ **FALTA** | ✅ | ChatWindow (visibility=internal_only) |

---

#### 👤 GESTÃO DE CONTATOS

| Permissão | No Painel? | Implementado? | Arquivo |
|-----------|------------|---------------|---------|
| Ver detalhes | ✅ | ✅ | ContactInfoPanel |
| Editar contato | ✅ | ✅ | ContactInfoPanel |
| Criar contato | ✅ NOVO | ✅ | ContactInfoPanel |
| Bloquear/Desbloquear | ✅ | ✅ | ContactInfoPanel |
| Deletar contato | ✅ | ✅ | ContactInfoPanel |
| Alterar fidelização | ✅ NOVO | ✅ | ContactInfoPanel |
| Alterar tipo | ✅ NOVO | ✅ | ContactInfoPanel |
| Adicionar tags | ✅ NOVO | ✅ | SeletorEtiquetasContato |

---

#### ⚙️ CONFIGURAÇÕES E SISTEMA

| Permissão | No Painel? | Implementado? | Arquivo |
|-----------|------------|---------------|---------|
| Gerenciar conexões WhatsApp | ✅ | ✅ | ConfiguracaoWhatsApp |
| Gerenciar filas | ✅ | ✅ | CentralControleOperacional |
| Gerenciar permissões | ✅ | ✅ | Usuarios.jsx |
| Ver diagnósticos | ✅ | ✅ | DiagnosticoCirurgicoEmbed |
| Ver relatórios | ✅ | ✅ | Dashboard |
| Exportar dados | ✅ | ✅ | Dashboard, Clientes, etc. |

---

#### ⚡ AUTOMAÇÃO E PLAYBOOKS

| Permissão | No Painel? | Implementado? | Arquivo |
|-----------|------------|---------------|---------|
| Criar playbooks | ✅ | ✅ | PlaybookManager |
| Editar playbooks | ✅ | ✅ | PlaybookManager |
| Ativar/Desativar | ✅ NOVO | ✅ | PlaybookManager |
| Ver estatísticas | ✅ NOVO | ✅ | DashboardPlaybooks |
| Criar promoções | ✅ NOVO | ✅ | GerenciadorPromocoes |
| Enviar promoções manuais | ✅ NOVO | ✅ | GerenciadorPromocoes |

---

#### 📢 BROADCAST E ENVIOS EM MASSA

| Permissão | No Painel? | Implementado? | Arquivo |
|-----------|------------|---------------|---------|
| Broadcast externo (clientes) | ✅ NOVO | ✅ | ChatWindow (modoSelecaoMultipla) |
| Broadcast interno (equipe) | ✅ NOVO | ✅ | ChatWindow (broadcastInterno) |
| Selecionar múltiplos | ✅ NOVO | ✅ | Comunicacao.jsx |
| Enviar para setor completo | ✅ NOVO | ✅ | InternalMessageComposer |

---

#### 🔵 CHAT INTERNO (Team)

| Permissão | No Painel? | Implementado? | Arquivo |
|-----------|------------|---------------|---------|
| Enviar mensagens 1:1 | ✅ NOVO | ✅ | sendInternalMessage |
| Criar grupos customizados | ✅ NOVO | ✅ | CriarGrupoModal |
| Participar grupos de setor | ✅ NOVO | ✅ | getOrCreateSectorThread |
| Adicionar membros | ✅ NOVO | ❌ **FALTA** | - |

---

#### 🤖 INTELIGÊNCIA ARTIFICIAL

| Permissão | No Painel? | Implementado? | Arquivo |
|-----------|------------|---------------|---------|
| Sugestor de respostas | ✅ NOVO | ✅ | SugestorRespostasRapidas |
| Ver score do contato | ✅ NOVO | ✅ | CentralInteligenciaContato |
| Forçar requalificação | ✅ NOVO | ✅ | CentralInteligenciaContato |
| Ver insights IA | ✅ NOVO | ✅ | PainelInsightsIA |

---

#### 🔗 INTEGRAÇÃO COM MÓDULOS

| Permissão | No Painel? | Implementado? | Arquivo |
|-----------|------------|---------------|---------|
| Criar orçamento do chat | ✅ NOVO | ✅ | ChatWindow (window.handleCriarOportunidade) |
| Converter em cliente | ✅ NOVO | ✅ | ContactInfoPanel |
| Registrar interação | ✅ NOVO | ✅ | RegistroInteracaoModal |
| Acessar agenda | ✅ NOVO | ✅ | Layout menu |

---

## 🚨 GAPS IDENTIFICADOS (Funcionalidades SEM Controle de Permissão)

### ❌ CRÍTICOS

1. **Assumir da fila**
   - Implementado: ✅ `CentralControleOperacional.jsx` (botão "Assumir Próximo")
   - Permissão no painel: ❌ FALTA
   - **RISCO:** Qualquer usuário pode pegar conversas da fila

2. **Criar notas internas**
   - Implementado: ✅ `ChatWindow.jsx` (visibility=internal_only)
   - Permissão no painel: ❌ FALTA
   - **RISCO:** Qualquer atendente pode adicionar notas privadas

3. **Ver histórico de chamadas**
   - Implementado: ✅ `CallHistoryPanel.jsx`
   - Permissão no painel: ❌ FALTA
   - **RISCO:** Privacidade - atendente júnior vendo ligações de outros

4. **Adicionar membros em grupos**
   - Implementado: ❌ PARCIAL (falta lógica)
   - Permissão no painel: ✅ (adicionei)
   - **RISCO:** Funcionalidade incompleta

---

### ⚠️ MÉDIOS

5. **Responder mensagens (reply)**
   - Implementado: ✅ Sempre disponível
   - Permissão no painel: ❌ FALTA
   - **Sugestão:** `podeResponderMensagens` (caso queira bloquear júnior)

6. **Usar templates WhatsApp**
   - Implementado: ✅ `GerenciadorTemplates.jsx`
   - Permissão no painel: ✅ (adicionei)
   - Status: ✅ OK

7. **Encaminhar mensagens**
   - Implementado: ✅ `MessageBubble.jsx` (ícone ➡️)
   - Permissão no painel: ❌ FALTA
   - **RISCO:** Júnior encaminhando conversas sensíveis

8. **Categorizar mensagens**
   - Implementado: ✅ `MessageBubble.jsx` (menu contexto)
   - Permissão no painel: ❌ FALTA
   - **Sugestão:** `podeCategorizarMensagens`

9. **Ver logs de webhook**
   - Implementado: ✅ `AnalisadorLogsWebhook.jsx`
   - Permissão no painel: ❌ FALTA (coberto por podeVerDiagnosticos?)
   - Status: ⚠️ Verificar se `podeVerDiagnosticos` cobre

10. **Alterar status de contato**
    - Implementado: ✅ `ContactInfoPanel.jsx`
    - Permissão no painel: ❌ FALTA
    - **Sugestão:** `podeAlterarStatusContato`

---

### 🔵 BAIXOS

11. **Ver threads arquivadas**
    - Implementado: ❌ FALTA
    - Permissão no painel: ❌ FALTA

12. **Criar respostas rápidas**
    - Implementado: ✅ `QuickRepliesManager.jsx`
    - Permissão no painel: ❌ FALTA
    - **Sugestão:** `podeCriarRespostasRapidas`

13. **Deletar respostas rápidas**
    - Implementado: ✅ `QuickRepliesManager.jsx`
    - Permissão no painel: ❌ FALTA
    - **Sugestão:** `podeDeletarRespostasRapidas`

---

## 📋 PERMISSÕES DO PAINEL vs CÓDIGO

### ✅ COBERTAS (Painel + Código Funcionando)

- [x] Enviar mensagens (texto)
- [x] Enviar mídias (imagem/vídeo/doc)
- [x] Enviar áudios (gravação)
- [x] Transferir conversas
- [x] Atribuir conversas
- [x] Apagar mensagens
- [x] Ver detalhes do contato
- [x] Editar contato
- [x] Bloquear/Desbloquear contato
- [x] Deletar contato
- [x] Criar playbooks
- [x] Editar playbooks
- [x] Gerenciar conexões WhatsApp
- [x] Ver relatórios
- [x] Exportar dados
- [x] Gerenciar permissões de outros
- [x] Ver diagnósticos

### ✅ NOVAS (Adicionadas no Painel - Aguardando Implementação)

- [x] Usar templates WhatsApp - ✅ JÁ IMPLEMENTADO
- [x] Usar respostas rápidas - ✅ JÁ IMPLEMENTADO
- [ ] **Marcar como lida** - ✅ JÁ IMPLEMENTADO (só falta conectar permissão)
- [ ] **Encerrar conversa** - ❌ FALTA IMPLEMENTAR
- [ ] **Reabrir arquivadas** - ❌ FALTA IMPLEMENTAR
- [x] Alterar fidelização - ✅ JÁ IMPLEMENTADO
- [x] Alterar tipo de contato - ✅ JÁ IMPLEMENTADO
- [x] Adicionar tags - ✅ JÁ IMPLEMENTADO
- [x] Ver score do contato - ✅ JÁ IMPLEMENTADO
- [x] Forçar requalificação - ✅ JÁ IMPLEMENTADO
- [x] Criar orçamento do chat - ✅ JÁ IMPLEMENTADO
- [x] Converter em cliente - ✅ JÁ IMPLEMENTADO
- [x] Registrar interação - ✅ JÁ IMPLEMENTADO

### ❌ GAPS (Funcionalidade Existe - Falta Permissão)

- [ ] **Assumir da fila** - Implementado sem controle de permissão
- [ ] **Criar notas internas** - Implementado sem controle
- [ ] **Ver histórico de chamadas** - Implementado sem controle
- [ ] **Encaminhar mensagens** - Implementado sem controle
- [ ] **Categorizar mensagens individuais** - Implementado sem controle
- [ ] **Alterar status do contato** - Implementado sem controle
- [ ] **Criar respostas rápidas** - Implementado sem controle
- [ ] **Deletar respostas rápidas** - Implementado sem controle

---

## 🎯 PERMISSÕES POR INSTÂNCIA WHATSAPP

**Arquivo:** `ConfiguracaoPermissoesWhatsApp.jsx` + `User.whatsapp_permissions`

### Modelo de Dados
```json
{
  "integration_id": "uuid-integracao",
  "integration_name": "Vendas Principal",
  "can_view": true,    // Ver conversas desta instância
  "can_receive": true, // Receber atribuições automáticas
  "can_send": true     // Enviar mensagens por este canal
}
```

### Onde é Usado
- **ChatWindow:** Verifica `can_send` antes de enviar
- **ChatSidebar:** Filtra threads por `can_view`
- **RoteamentoInteligente:** Considera `can_receive` na distribuição

### ✅ Status: FUNCIONANDO - Mas isolado do Nexus360

**⚠️ SUGESTÃO:** Integrar `whatsapp_permissions` dentro do Nexus360 (regras_bloqueio tipo='integracao')

---

## 🔥 PRIORIDADES DE IMPLEMENTAÇÃO

### 🚨 URGENTE (Segurança)

1. **Migrar ChatWindow de `permissoes_comunicacao` para `permissoes_acoes_nexus`**
   - Arquivo: `ChatWindow.jsx` linhas ~330-343
   - Impacto: ALTO - permissões atuais não funcionam corretamente

2. **Adicionar controle para "Assumir da fila"**
   - Criar flag: `podeAssumir DaFila`
   - Implementar em: `CentralControleOperacional.jsx`

3. **Adicionar controle para "Criar notas internas"**
   - Criar flag: `podeCriarNotasInternas`
   - Implementar em: `ChatWindow.jsx` (verificar antes de visibility=internal_only)

### 🔶 MÉDIO (Funcionalidades)

4. **Implementar "Encerrar/Arquivar conversa"**
   - Backend: criar função `arquivarThread`
   - Frontend: botão no ChatWindow
   - Permissão: `podeEncerrarConversa` (já no painel)

5. **Implementar "Reabrir arquivadas"**
   - Backend: filtrar por `status=arquivada`
   - Frontend: aba "Arquivadas"
   - Permissão: `podeReabrirConversa` (já no painel)

6. **Adicionar controle para "Encaminhar mensagens"**
   - Criar flag: `podeEncaminharMensagens`
   - Implementar em: `MessageBubble.jsx` (modal de forward)

### 🔵 BAIXO (Organização)

7. **Migrar `Layout.js` para usar `User.paginas_acesso`**
   - Remover lógica hardcoded
   - Usar array do banco de dados

8. **Criar gerenciador de "Respostas Rápidas"**
   - Flags: `podeCriarRespostasRapidas`, `podeDeletarRespostasRapidas`
   - Já existe componente, falta conectar permissões

---

## 🎨 CATEGORIAS FALTANDO NO PAINEL

### 📞 TELEFONIA (GoTo Integration)
- [ ] Realizar chamadas outbound
- [ ] Ver histórico de chamadas
- [ ] Escutar gravações
- [ ] Ver métricas de atendimento telefônico

### 📊 ANALYTICS E MÉTRICAS
- [ ] Ver métricas individuais (próprio desempenho)
- [ ] Ver métricas da equipe (supervisão)
- [ ] Ver métricas globais (diretoria)
- [ ] Exportar relatórios customizados

### 🎛️ CONFIGURAÇÕES AVANÇADAS
- [ ] Configurar URA (pré-atendimento)
- [ ] Configurar horários de atendimento
- [ ] Configurar mensagens automáticas
- [ ] Configurar regras de roteamento

### 🔔 NOTIFICAÇÕES
- [ ] Receber notificações de novas mensagens
- [ ] Receber notificações de transferências
- [ ] Receber alertas de SLA
- [ ] Receber insights da IA

---

## 🏗️ ARQUITETURA RECOMENDADA

### CONSOLIDAÇÃO EM 1 ÚNICO OBJETO

Ao invés de:
```json
{
  "permissoes_comunicacao": {...},  // ❌ Legado
  "permissoes_acoes_nexus": {...},  // ✅ Novo
  "whatsapp_permissions": [...],    // ⚠️ Isolado
  "configuracao_visibilidade_nexus": {...}
}
```

Propor:
```json
{
  "nexus360_permissions": {
    "visibility": {
      "mode": "padrao_liberado",
      "regras_bloqueio": [...],
      "regras_liberacao": [...]
    },
    "actions": {
      // Todas as 65+ flags
      "podeEnviarMensagens": true,
      ...
    },
    "integracoes": {
      // Migrar whatsapp_permissions para cá
      "uuid-integracao-1": {
        "can_view": true,
        "can_send": true,
        "can_receive": true
      }
    },
    "diagnostico": {
      "ativo": false,
      "log_level": "info"
    }
  }
}
```

**Benefício:** Single source of truth

---

## 📝 CHECKLIST FINAL

### Para o Painel Estar 100% Completo:

**CAMADA: Visibilidade de Threads**
- [x] Ver threads não atribuídas
- [x] Ver conversas de outros
- [x] Ver carteiras de outros
- [x] Ver todos os setores
- [x] Strict mode (desativar P5/P8)
- [x] Bloqueio por setor
- [x] Bloqueio por integração
- [x] Bloqueio por canal
- [x] Janela 24h
- [x] Supervisão gerencial

**CAMADA: Interação em Threads**
- [x] Enviar texto
- [x] Enviar mídias
- [x] Enviar áudios
- [ ] **FALTA:** Responder mensagens
- [ ] **FALTA:** Encaminhar mensagens

**CAMADA: Gestão de Conversas**
- [x] Transferir
- [x] Atribuir
- [x] Marcar como lida
- [x] Apagar mensagens
- [ ] **FALTA:** Encerrar/Arquivar
- [ ] **FALTA:** Reabrir arquivadas
- [ ] **FALTA:** Assumir da fila
- [ ] **FALTA:** Criar notas internas

**CAMADA: Gestão de Contatos**
- [x] Ver detalhes
- [x] Editar
- [x] Criar
- [x] Bloquear
- [x] Deletar
- [x] Alterar fidelização
- [x] Alterar tipo
- [x] Adicionar tags
- [ ] **FALTA:** Alterar status
- [ ] **FALTA:** Ver histórico completo

**CAMADA: Automação**
- [x] Criar playbooks
- [x] Editar playbooks
- [x] Ativar/Desativar
- [x] Ver estatísticas
- [x] Criar promoções
- [x] Enviar promoções
- [ ] **FALTA:** Deletar playbooks
- [ ] **FALTA:** Duplicar playbooks

**CAMADA: Broadcast**
- [x] Broadcast externo
- [x] Broadcast interno
- [x] Seleção múltipla
- [x] Enviar para setor

**CAMADA: Chat Interno**
- [x] Mensagens 1:1
- [x] Criar grupos
- [x] Participar grupos setor
- [ ] **FALTA:** Adicionar membros (implementação incompleta)
- [ ] **FALTA:** Remover membros
- [ ] **FALTA:** Sair de grupo

**CAMADA: IA**
- [x] Sugestor respostas
- [x] Ver score
- [x] Forçar requalificação
- [x] Ver insights

**CAMADA: Integrações**
- [x] Criar orçamento
- [x] Converter em cliente
- [x] Registrar interação
- [x] Acessar agenda

**CAMADA: Telefonia**
- [ ] **FALTA:** Realizar chamadas
- [ ] **FALTA:** Ver histórico chamadas
- [ ] **FALTA:** Escutar gravações

**CAMADA: Analytics**
- [ ] **FALTA:** Ver métricas individuais
- [ ] **FALTA:** Ver métricas equipe
- [ ] **FALTA:** Ver métricas globais

**CAMADA: Configurações**
- [x] Gerenciar conexões
- [x] Gerenciar filas
- [ ] **FALTA:** Configurar URA
- [ ] **FALTA:** Configurar horários
- [ ] **FALTA:** Configurar auto-respostas

---

## 🎯 RESUMO: O QUE ADICIONAR AO PAINEL

### PERMISSÕES CRÍTICAS FALTANDO (15):

1. `podeAssumir DaFila` - Pegar conversas da fila
2. `podeCriarNotasInternas` - Notas privadas (visibility=internal_only)
3. `podeVerHistoricoChamadas` - Ver CallHistoryPanel
4. `podeResponderMensagens` - Reply em mensagens
5. `podeEncaminharMensagens` - Forward para outro contato
6. `podeCategorizarMensagensIndividuais` - Tags em msgs específicas
7. `podeAlterarStatusContato` - Mudar status do lead/cliente
8. `podeCriarRespostasRapidas` - QuickReplies
9. `podeDeletarRespostasRapidas` - QuickReplies
10. `podeDeletarPlaybooks` - Remover fluxos
11. `podeDuplicarPlaybooks` - Clonar fluxos
12. `podeRealizarChamadas` - Telefonia outbound
13. `podeVerMetricasIndividuais` - Próprio desempenho
14. `podeVerMetricasEquipe` - Dashboard supervisão
15. `podeConfigurarURA` - Editar pré-atendimento

---

## ✅ RECOMENDAÇÃO FINAL

### Ação Imediata:
1. ✅ **Expandir painel com 15 permissões faltantes** (organizar em categorias)
2. 🔴 **Migrar ChatWindow para Nexus360** (trocar `permissoes_comunicacao` por `permissoes_acoes_nexus`)
3. ⚠️ **Implementar controles faltantes** (assumir fila, notas internas, etc.)

### Estrutura Final do Painel:
```
PainelPermissoesUnificado.jsx
├── Perfil Predefinido (Presets)
├── Modo de Visibilidade (P12)
├── Bloqueios Explícitos (P9/P10/P11)
├── Liberações Especiais (P5/P8)
├── Visibilidade Fina (P6/P7)
├── ✅ 10 CATEGORIAS DE PERMISSÕES:
│   ├── 📤 Envio de Mensagens (7 flags)
│   ├── 💬 Gestão de Conversas (8 flags) ← +2 faltantes
│   ├── 👤 Gestão de Contatos (9 flags) ← +1 faltante
│   ├── 👁️ Visibilidade (7 flags)
│   ├── ⚡ Automação (8 flags) ← +2 faltantes
│   ├── ⚙️ Configurações (7 flags) ← +1 faltante
│   ├── 📢 Broadcast (4 flags)
│   ├── 🔵 Chat Interno (5 flags) ← +3 faltantes
│   ├── 🤖 IA (4 flags)
│   ├── 🔗 Integrações (4 flags)
│   ├── 📞 Telefonia (3 flags) ← CATEGORIA NOVA
│   ├── 📊 Analytics (3 flags) ← CATEGORIA NOVA
│   └── 🎛️ Config Avançadas (3 flags) ← CATEGORIA NOVA
└── Preview Consolidado
```

**TOTAL:** ~80 permissões mapeadas (vs 50 atuais)

---

## 🔧 CÓDIGO A MODIFICAR

### Prioridade 1: ChatWindow.jsx
```javascript
// TROCAR (linha ~330):
const permissoes = usuario?.permissoes_comunicacao || {};
const temPermissaoGeralEnvio = permissoes.pode_enviar_mensagens !== false;

// POR:
const permissoes = usuario?.permissoes_acoes_nexus || {};
const temPermissaoGeralEnvio = permissoes.podeEnviarMensagens ?? true;
```

### Prioridade 2: CentralControleOperacional.jsx
```javascript
// ADICIONAR (antes do botão "Assumir Próximo"):
const podeAssumir = usuario?.permissoes_acoes_nexus?.podeAssumir DaFila ?? true;

if (!podeAssumir) {
  // Desabilitar botão
}
```

### Prioridade 3: MessageBubble.jsx
```javascript
// ADICIONAR (antes do botão de encaminhar):
const podeEncaminhar = usuario?.permissoes_acoes_nexus?.podeEncaminharMensagens ?? true;

if (!podeEncaminhar) {
  // Esconder opção de forward
}
```

---

## 📌 CONCLUSÃO

✅ **O painel está 77% completo** - tem as permissões principais mas falta:
- **15 permissões críticas** de funcionalidades já implementadas
- **3 categorias novas** (Telefonia, Analytics, Config Avançadas)
- **Integração real no código** - muita coisa usa lógica legado ou sem verificação

🎯 **Próximo passo:** Expandir `PainelPermissoesUnificado.jsx` com as 15 flags faltantes organizadas nas 3 novas categorias.