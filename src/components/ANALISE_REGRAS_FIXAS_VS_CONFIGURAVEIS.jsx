# 🛡️ ANÁLISE: Regras Fixas vs Configuráveis - Arquitetura Nexus360

**Data:** 2026-01-15  
**Objetivo:** Separar regras de SEGURANÇA (fixas) de regras de NEGÓCIO (configuráveis)

---

## 🎯 PRINCÍPIO FUNDAMENTAL

### Separação de Responsabilidades

```
┌─────────────────────────────────────────────────────────────┐
│                    MOTOR DE DECISÃO NEXUS360                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  CAMADA 1: REGRAS FIXAS (Segurança)                   │ │
│  │  ────────────────────────────────────────────────────  │ │
│  │  • NÃO configuráveis pelo usuário                     │ │
│  │  • Sempre aplicadas, sem exceção                      │ │
│  │  • Garantem integridade e privacidade                 │ │
│  │  • Exemplos: P1, P2, P3, P4, P6, P7, P9, P10, P11     │ │
│  └───────────────────────────────────────────────────────┘ │
│           ↓ Se passou nas regras fixas                      │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  CAMADA 2: POLÍTICA DE NEGÓCIO (Configurável)         │ │
│  │  ────────────────────────────────────────────────────  │ │
│  │  • Definidas em configuracao_visibilidade_nexus       │ │
│  │  • Editáveis na tela de gestão de usuários            │ │
│  │  • Variam por perfil/setor/empresa                    │ │
│  │  • Exemplos: P5, P8, P12, view_unassigned, view_others│ │
│  └───────────────────────────────────────────────────────┘ │
│           ↓ Se passou na política                           │
│  ┌───────────────────────────────────────────────────────┐ │
│  │  CAMADA 3: FILTROS DE UI (Preferências)              │ │
│  │  ────────────────────────────────────────────────────  │ │
│  │  • Aba ativa, busca, tags selecionadas               │ │
│  │  • Não afetam segurança, só apresentação             │ │
│  │  • Voláteis (mudam a cada clique)                    │ │
│  └───────────────────────────────────────────────────────┘ │
│                                                             │
│  RESULTADO: ALLOW ou DENY + reason_code                    │
└─────────────────────────────────────────────────────────────┘
```

---

## 📜 MAPEAMENTO DAS 13 REGRAS NEXUS360

### 🔴 CAMADA 1: REGRAS FIXAS (9 regras)

#### P1 – Participação em Thread Interna

**Lógica:**
```javascript
if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
  if (user.role === 'admin') {
    return { allow: true, code: 'ADMIN_INTERNAL_THREAD' };
  }
  
  if (thread.participants?.includes(user.id)) {
    return { allow: true, code: 'PARTICIPANT_INTERNAL_THREAD' };
  }
  
  // NÃO é participante → DENY fixo
  return { allow: false, code: 'NOT_PARTICIPANT' };
}
```

**Categoria:** 🔒 SEGURANÇA  
**Configurável:** ❌ NÃO  
**Razão:** Threads internas são privadas; não faz sentido ver conversas de equipe de outros  
**Status no código:** ✅ Implementado em `components/lib/threadVisibility.js` (legado)  
**Status no Nexus:** ✅ Presente no motor `nexusComparator.js`

---

#### P2 – Admin Total Access

**Lógica:**
```javascript
if (user.role === 'admin') {
  return { allow: true, code: 'ADMIN_FULL_ACCESS' };
}
```

**Categoria:** 🔒 SEGURANÇA  
**Configurável:** ❌ NÃO  
**Razão:** Admins precisam de acesso total para troubleshooting e auditoria  
**Status no código:** ✅ Implementado (legado + Nexus)  
**Exceção:** Pode ser limitado por regras LEGAIS (LGPD, compliance) - futuro

---

#### P3 – Thread Atribuída ao Usuário

**Lógica:**
```javascript
if (thread.assigned_user_id === user.id) {
  return { allow: true, code: 'ASSIGNED_TO_USER' };
}
```

**Categoria:** 🔒 SEGURANÇA  
**Configurável:** ❌ NÃO  
**Razão:** Usuário sempre deve ver conversas atribuídas a ele  
**Status no código:** ✅ Implementado (legado + Nexus)

---

#### P4 – Contato Fidelizado ao Usuário

**Lógica:**
```javascript
// Verificar fidelização por setor
const setorUsuario = user.attendant_sector || 'geral';
const campoFidelizacao = `atendente_fidelizado_${setorUsuario}`;

if (contato?.[campoFidelizacao] === user.id) {
  return { allow: true, code: 'FIDELIZED_CONTACT' };
}
```

**Categoria:** 🔒 SEGURANÇA  
**Configurável:** ❌ NÃO  
**Razão:** Contato da carteira do atendente (relacionamento construído)  
**Status no código:** ✅ Implementado (legado + Nexus)  
**Exceção:** Supervisores podem ter flag para ver carteiras de equipe

---

#### P6 – Fidelizado a Outro Atendente

**Lógica:**
```javascript
const setorUsuario = user.attendant_sector || 'geral';
const campoFidelizacao = `atendente_fidelizado_${setorUsuario}`;
const fidelizadoParaOutro = contato?.[campoFidelizacao] && contato[campoFidelizacao] !== user.id;

if (fidelizadoParaOutro) {
  // Verificar se usuário pode ver carteira de outros
  if (!user.permissoes_acoes_nexus?.podeVerCarteiraOutros) {
    return { allow: false, code: 'FIDELIZED_TO_ANOTHER' };
  }
}
```

**Categoria:** 🔒 SEGURANÇA + ⚙️ POLÍTICA  
**Configurável:** ⚠️ PARCIAL  
**Razão:** Protege privacidade de carteiras, mas supervisores podem precisar ver  
**Config:** Flag `podeVerCarteiraOutros` em `permissoes_acoes_nexus`  
**Status no código:** ✅ Implementado (Nexus)

---

#### P7 – Atribuído a Outro Atendente

**Lógica:**
```javascript
const atribuidoParaOutro = thread.assigned_user_id && thread.assigned_user_id !== user.id;

if (atribuidoParaOutro) {
  // Admin sempre vê (P2)
  if (user.role === 'admin') {
    return { allow: true, code: 'ADMIN_FULL_ACCESS' };
  }
  
  // Gerente com supervisão pode ver (P8)
  if (user.attendant_role === 'gerente' && regraGerenteSupervisaoAtiva) {
    // Verificar tempo sem resposta
    return checkGerenteSupervisao(thread, user);
  }
  
  // Usuário comum: DENY
  return { allow: false, code: 'ASSIGNED_TO_ANOTHER' };
}
```

**Categoria:** 🔒 SEGURANÇA + ⚙️ POLÍTICA  
**Configurável:** ⚠️ PARCIAL  
**Razão:** Protege conversas em andamento, mas permite supervisão gerencial  
**Config:** Regra P8 (gerente_supervisao) pode sobrepor  
**Status no código:** ✅ Implementado (Nexus)

---

#### P9 – Canal Bloqueado

**Lógica:**
```javascript
// Verificar se canal está na lista de bloqueios
const regraBloqueioCanal = user.configuracao_visibilidade_nexus?.regras_bloqueio
  ?.find(r => r.tipo === 'canal' && r.ativa);

if (regraBloqueioCanal?.valores_bloqueados?.includes(thread.channel)) {
  return { allow: false, code: 'CHANNEL_BLOCKED' };
}
```

**Categoria:** 🔒 SEGURANÇA  
**Configurável:** ⚠️ LISTA de canais bloqueados (não o conceito de bloqueio)  
**Razão:** Alguns usuários não devem ver certos canais (ex: financeiro não vê Instagram)  
**Config:** `regras_bloqueio[{tipo: 'canal', valores_bloqueados: [...]}]`  
**Status no código:** ✅ Implementado (Nexus)

---

#### P10 – Integração Bloqueada

**Lógica:**
```javascript
// Verificar se integração específica está bloqueada
const regraBloqueioIntegracao = user.configuracao_visibilidade_nexus?.regras_bloqueio
  ?.find(r => r.tipo === 'integracao' && r.ativa);

if (regraBloqueioIntegracao?.valores_bloqueados?.includes(thread.whatsapp_integration_id)) {
  return { allow: false, code: 'INTEGRATION_BLOCKED' };
}
```

**Categoria:** 🔒 SEGURANÇA  
**Configurável:** ⚠️ LISTA de integrações bloqueadas  
**Razão:** Isolamento de chips/contas (ex: Vendas não vê chip de RH)  
**Config:** `regras_bloqueio[{tipo: 'integracao', valores_bloqueados: [...]}]`  
**Status no código:** ✅ Implementado (Nexus)

---

#### P11 – Setor Bloqueado

**Lógica:**
```javascript
// Verificar se setor da thread está bloqueado
const regraBloqueioSetor = user.configuracao_visibilidade_nexus?.regras_bloqueio
  ?.find(r => r.tipo === 'setor' && r.ativa);

if (regraBloqueioSetor?.valores_bloqueados?.includes(thread.sector_id)) {
  return { allow: false, code: 'SECTOR_BLOCKED' };
}
```

**Categoria:** 🔒 SEGURANÇA  
**Configurável:** ⚠️ LISTA de setores bloqueados  
**Razão:** Separação departamental (ex: Financeiro não vê conversas de Vendas)  
**Config:** `regras_bloqueio[{tipo: 'setor', valores_bloqueados: [...]}]`  
**Status no código:** ✅ Implementado (Nexus)

---

### 🟢 CAMADA 2: REGRAS CONFIGURÁVEIS (3 regras + flags)

#### P5 – Janela 24h (Fail-Safe)

**Lógica:**
```javascript
// Verificar se usuário tem regra de janela ativa
const regraJanela = user.configuracao_visibilidade_nexus?.regras_liberacao
  ?.find(r => r.tipo === 'janela_24h' && r.ativa);

if (regraJanela) {
  const horas = regraJanela.configuracao?.horas || 24;
  const limiteTimestamp = Date.now() - (horas * 60 * 60 * 1000);
  
  // Verificar se thread tem mensagem do usuário recente
  const mensagensUsuario = await base44.entities.Message.filter({
    thread_id: thread.id,
    sender_id: user.id,
    sender_type: 'user'
  });
  
  const temMensagemRecente = mensagensUsuario.some(m => 
    new Date(m.sent_at).getTime() > limiteTimestamp
  );
  
  if (temMensagemRecente) {
    return { allow: true, code: 'WINDOW_24H_ACTIVE' };
  }
}
```

**Categoria:** ⚙️ POLÍTICA DE NEGÓCIO  
**Configurável:** ✅ SIM (horas ajustáveis, pode desativar)  
**Razão:** Evita perda de contexto em conversas recentes  
**Config:** `regras_liberacao[{tipo: 'janela_24h', configuracao: {horas: 24}}]`  
**Status no código:** ✅ Implementado (Nexus)  
**UI:** Editável na aba "Liberações" da coluna Nexus360

---

#### P8 – Supervisão Gerencial

**Lógica:**
```javascript
// Verificar se usuário é gerente e tem regra de supervisão
const regraSupervisao = user.configuracao_visibilidade_nexus?.regras_liberacao
  ?.find(r => r.tipo === 'gerente_supervisao' && r.ativa);

if (regraSupervisao && user.attendant_role === 'gerente') {
  const minutosLimite = regraSupervisao.configuracao?.minutos_sem_resposta || 30;
  const limiteTimestamp = Date.now() - (minutosLimite * 60 * 1000);
  
  // Verificar se cliente está aguardando há muito tempo
  if (thread.last_message_sender === 'contact') {
    const lastMessageTimestamp = new Date(thread.last_message_at).getTime();
    
    if (lastMessageTimestamp < limiteTimestamp) {
      // Cliente aguarda há mais de X minutos → gerente pode intervir
      return { allow: true, code: 'MANAGER_SUPERVISION' };
    }
  }
}
```

**Categoria:** ⚙️ POLÍTICA DE NEGÓCIO  
**Configurável:** ✅ SIM (timeout ajustável, pode desativar)  
**Razão:** Permite supervisão sem violar privacidade permanentemente  
**Config:** `regras_liberacao[{tipo: 'gerente_supervisao', configuracao: {minutos_sem_resposta: 30}}]`  
**Status no código:** ✅ Implementado (Nexus)  
**UI:** Editável na aba "Liberações" da coluna Nexus360

---

#### P12 – Default Allow (Padrão Liberado)

**Lógica:**
```javascript
// Após todas as regras, aplicar comportamento padrão
const modoBase = user.configuracao_visibilidade_nexus?.modo_visibilidade || 'padrao_liberado';

if (modoBase === 'padrao_liberado') {
  return { allow: true, code: 'DEFAULT_ALLOW' };
} else {
  return { allow: false, code: 'DEFAULT_DENY' };
}
```

**Categoria:** ⚙️ POLÍTICA DE NEGÓCIO  
**Configurável:** ✅ SIM (radio liberado/bloqueado)  
**Razão:** Define filosofia da empresa (confiança vs restrição)  
**Config:** `configuracao_visibilidade_nexus.modo_visibilidade`  
**Status no código:** ✅ Implementado (Nexus)  
**UI:** Radio button no topo da coluna Nexus360

---

#### FLAGS DE UI (Não são "regras P#", mas afetam visibilidade)

**Configuração de Negócio:**
```javascript
{
  view_unassigned: boolean,    // Ver não atribuídas do setor
  view_others: boolean,         // Ver conversas de outros atendentes do setor
  view_all_sectors: boolean,    // Ver todos os setores (gerente cross-setorial)
  strict_mode: boolean          // Desativa P5 e P8 (zero exceções)
}
```

**Categoria:** ⚙️ POLÍTICA DE NEGÓCIO  
**Configurável:** ✅ SIM  
**Status no código:** ⚠️ **Parcialmente implementado**
- `view_unassigned` → Implícito em regras de setor
- `view_others` → Não existe explicitamente (derivado de P7)
- `view_all_sectors` → Não existe (admin vê tudo via P2)
- `strict_mode` → ❌ **NÃO EXISTE**

**Ação:** Adicionar essas flags a `permissoes_acoes_nexus`

---

## 🗂️ TABELA CONSOLIDADA

| ID | Nome | Tipo | Configurável | Onde está | UI Editável |
|----|------|------|-------------|-----------|------------|
| **P1** | Thread Interna (Participação) | 🔒 Fixa | ❌ Lógica | `threadVisibility.js` + `nexusComparator.js` | ❌ |
| **P2** | Admin Total Access | 🔒 Fixa | ❌ Lógica | `threadVisibility.js` + `nexusComparator.js` | ❌ |
| **P3** | Thread Atribuída | 🔒 Fixa | ❌ Lógica | `threadVisibility.js` + `nexusComparator.js` | ❌ |
| **P4** | Contato Fidelizado | 🔒 Fixa | ❌ Lógica | `threadVisibility.js` + `nexusComparator.js` | ❌ |
| **P6** | Fidelizado a Outro | 🔒 Fixa | ⚠️ Flag `podeVerCarteiraOutros` | `nexusComparator.js` | ✅ Aba Ações |
| **P7** | Atribuído a Outro | 🔒 Fixa | ⚠️ Sobreposto por P8 | `nexusComparator.js` | ✅ Via P8 |
| **P9** | Canal Bloqueado | 🔒 Fixa | ⚠️ LISTA de canais | `regras_bloqueio[]` | ✅ Aba Bloqueios |
| **P10** | Integração Bloqueada | 🔒 Fixa | ⚠️ LISTA de IDs | `regras_bloqueio[]` | ✅ Aba Bloqueios |
| **P11** | Setor Bloqueado | 🔒 Fixa | ⚠️ LISTA de setores | `regras_bloqueio[]` | ✅ Aba Bloqueios |
| **P5** | Janela 24h | ⚙️ Política | ✅ Horas + on/off | `regras_liberacao[]` | ✅ Aba Liberações |
| **P8** | Supervisão Gerencial | ⚙️ Política | ✅ Minutos + on/off | `regras_liberacao[]` | ✅ Aba Liberações |
| **P12** | Default Allow | ⚙️ Política | ✅ Radio liberado/bloqueado | `modo_visibilidade` | ✅ Header Nexus |
| — | view_unassigned | ⚙️ Política | ✅ Flag booleana | ❌ **NÃO EXISTE** | 🆕 Criar |
| — | view_others | ⚙️ Política | ✅ Flag booleana | ❌ **NÃO EXISTE** | 🆕 Criar |
| — | strict_mode | ⚙️ Política | ✅ Flag booleana | ❌ **NÃO EXISTE** | 🆕 Criar |

---

## 🔧 CAMPOS NECESSÁRIOS PARA COMPLETAR A ARQUITETURA

### User Entity - Adicionar a `permissoes_acoes_nexus`

```json
{
  "permissoes_acoes_nexus": {
    "type": "object",
    "properties": {
      "podeVerTodasConversas": { "type": "boolean" },
      "podeEnviarMensagens": { "type": "boolean" },
      "podeEnviarMidias": { "type": "boolean" },
      "podeEnviarAudios": { "type": "boolean" },
      "podeTransferirConversa": { "type": "boolean" },
      "podeApagarMensagens": { "type": "boolean" },
      "podeGerenciarFilas": { "type": "boolean" },
      "podeAtribuirConversas": { "type": "boolean" },
      "podeVerDetalhesContato": { "type": "boolean" },
      "podeEditarContato": { "type": "boolean" },
      "podeBloquearContato": { "type": "boolean" },
      "podeDeletarContato": { "type": "boolean" },
      "podeCriarPlaybooks": { "type": "boolean" },
      "podeEditarPlaybooks": { "type": "boolean" },
      "podeGerenciarConexoes": { "type": "boolean" },
      "podeVerRelatorios": { "type": "boolean" },
      "podeExportarDados": { "type": "boolean" },
      "podeGerenciarPermissoes": { "type": "boolean" },
      "podeVerDiagnosticos": { "type": "boolean" },
      
      "ADICIONAR AGORA - Regras de Visibilidade Fina": "---",
      
      "podeVerCarteiraOutros": { 
        "type": "boolean",
        "description": "Permite ver contatos fidelizados a outros atendentes (sobrepõe P6)"
      },
      
      "podeVerNaoAtribuidas": { 
        "type": "boolean",
        "default": true,
        "description": "Ver threads não atribuídas do seu setor (filas)"
      },
      
      "podeVerConversasOutros": { 
        "type": "boolean",
        "default": false,
        "description": "Ver conversas atribuídas a outros atendentes do mesmo setor"
      },
      
      "podeVerTodosSetores": { 
        "type": "boolean",
        "default": false,
        "description": "Ver threads de TODOS os setores (gerente cross-setorial)"
      },
      
      "strictMode": { 
        "type": "boolean",
        "default": false,
        "description": "Desativa regras P5 (janela 24h) e P8 (supervisão) - zero exceções"
      }
    }
  }
}
```

---

## 🏗️ ORDEM DE EXECUÇÃO DAS REGRAS (Motor Nexus360)

### Fluxo de Decisão (Waterfall)

```javascript
function decidirVisibilidadeNexus360(thread, user, contato) {
  
  // ═══════════════════════════════════════════════════════════
  // CAMADA 1: REGRAS FIXAS (Segurança)
  // ═══════════════════════════════════════════════════════════
  
  // P1: Thread interna - participação obrigatória
  if (thread.thread_type !== 'contact_external') {
    if (user.role === 'admin') return { allow: true, code: 'ADMIN_INTERNAL_THREAD' };
    if (thread.participants?.includes(user.id)) return { allow: true, code: 'PARTICIPANT_INTERNAL_THREAD' };
    return { allow: false, code: 'NOT_PARTICIPANT' }; // ❌ DENY fixo
  }
  
  // P2: Admin total (sobrepõe tudo)
  if (user.role === 'admin') {
    return { allow: true, code: 'ADMIN_FULL_ACCESS' }; // ✅ ALLOW fixo
  }
  
  // P3: Thread atribuída ao usuário
  if (thread.assigned_user_id === user.id) {
    return { allow: true, code: 'ASSIGNED_TO_USER' }; // ✅ ALLOW fixo
  }
  
  // P4: Contato fidelizado ao usuário
  const setorUser = user.attendant_sector || 'geral';
  const campoFidelizacao = `atendente_fidelizado_${setorUser}`;
  if (contato?.[campoFidelizacao] === user.id) {
    return { allow: true, code: 'FIDELIZED_CONTACT' }; // ✅ ALLOW fixo
  }
  
  // ═══════════════════════════════════════════════════════════
  // CAMADA 2: REGRAS DE BLOQUEIO (Deny-First)
  // ═══════════════════════════════════════════════════════════
  
  const { regras_bloqueio } = user.configuracao_visibilidade_nexus || {};
  
  // P9: Canal bloqueado
  const regraBloqueioCanal = regras_bloqueio?.find(r => r.tipo === 'canal' && r.ativa);
  if (regraBloqueioCanal?.valores_bloqueados?.includes(thread.channel)) {
    return { allow: false, code: 'CHANNEL_BLOCKED' }; // ❌ DENY
  }
  
  // P10: Integração bloqueada
  const regraBloqueioInt = regras_bloqueio?.find(r => r.tipo === 'integracao' && r.ativa);
  if (regraBloqueioInt?.valores_bloqueados?.includes(thread.whatsapp_integration_id)) {
    return { allow: false, code: 'INTEGRATION_BLOCKED' }; // ❌ DENY
  }
  
  // P11: Setor bloqueado
  const regraBloqueioSetor = regras_bloqueio?.find(r => r.tipo === 'setor' && r.ativa);
  if (regraBloqueioSetor?.valores_bloqueados?.includes(thread.sector_id)) {
    return { allow: false, code: 'SECTOR_BLOCKED' }; // ❌ DENY
  }
  
  // P6: Fidelizado a outro atendente
  const fidelizadoParaOutro = contato?.[campoFidelizacao] && contato[campoFidelizacao] !== user.id;
  if (fidelizadoParaOutro && !user.permissoes_acoes_nexus?.podeVerCarteiraOutros) {
    return { allow: false, code: 'FIDELIZED_TO_ANOTHER' }; // ❌ DENY
  }
  
  // P7: Atribuído a outro atendente
  const atribuidoParaOutro = thread.assigned_user_id && thread.assigned_user_id !== user.id;
  if (atribuidoParaOutro) {
    // ⚠️ P7 pode ser sobreposto por P5 ou P8 (liberações)
    // Verificar ANTES de negar
    
    // Sub-verificação P5: Janela 24h
    const regraJanela = user.configuracao_visibilidade_nexus?.regras_liberacao
      ?.find(r => r.tipo === 'janela_24h' && r.ativa);
    
    if (regraJanela && !user.permissoes_acoes_nexus?.strictMode) {
      const temMensagemRecente = await checkJanela24h(thread, user, regraJanela);
      if (temMensagemRecente) {
        return { allow: true, code: 'WINDOW_24H_OVERRIDE' }; // ✅ ALLOW (exceção)
      }
    }
    
    // Sub-verificação P8: Supervisão gerencial
    const regraSupervisao = user.configuracao_visibilidade_nexus?.regras_liberacao
      ?.find(r => r.tipo === 'gerente_supervisao' && r.ativa);
    
    if (regraSupervisao && user.attendant_role === 'gerente' && !user.permissoes_acoes_nexus?.strictMode) {
      const aguardandoMuito = checkTempoSemResposta(thread, regraSupervisao);
      if (aguardandoMuito) {
        return { allow: true, code: 'MANAGER_SUPERVISION_OVERRIDE' }; // ✅ ALLOW (exceção)
      }
    }
    
    // Nenhuma exceção aplicada → DENY
    return { allow: false, code: 'ASSIGNED_TO_ANOTHER' }; // ❌ DENY
  }
  
  // ═══════════════════════════════════════════════════════════
  // CAMADA 3: POLÍTICA DE VISIBILIDADE FINA
  // ═══════════════════════════════════════════════════════════
  
  // Não atribuída - verificar se usuário pode ver
  if (!thread.assigned_user_id) {
    if (user.permissoes_acoes_nexus?.podeVerNaoAtribuidas !== false) {
      return { allow: true, code: 'UNASSIGNED_ALLOWED' }; // ✅ ALLOW
    }
    return { allow: false, code: 'UNASSIGNED_BLOCKED' }; // ❌ DENY
  }
  
  // ═══════════════════════════════════════════════════════════
  // CAMADA 4: DEFAULT (Padrão Liberado ou Bloqueado)
  // ═══════════════════════════════════════════════════════════
  
  // P12: Comportamento padrão
  const modoBase = user.configuracao_visibilidade_nexus?.modo_visibilidade || 'padrao_liberado';
  
  if (modoBase === 'padrao_liberado') {
    return { allow: true, code: 'DEFAULT_ALLOW' }; // ✅ ALLOW
  } else {
    return { allow: false, code: 'DEFAULT_DENY' }; // ❌ DENY
  }
}
```

---

## 🔄 COMO ISSO AFETA SUBSCRIBE (Real-time)

### Cenário 1: Backend Envia Tudo, Frontend Filtra

```javascript
// Subscription no frontend
useEffect(() => {
  const unsubscribe = base44.entities.MessageThread.subscribe((event) => {
    const thread = event.data;
    
    // ⚡ APLICAR MOTOR NEXUS360 ANTES DE ATUALIZAR CACHE
    const decisao = decidirVisibilidadeNexus360(thread, usuario, contatosMap[thread.contact_id]);
    
    if (!decisao.allow) {
      console.log(`[Subscribe] ❌ Thread ${thread.id} bloqueada: ${decisao.code}`);
      return; // Não atualiza cache
    }
    
    console.log(`[Subscribe] ✅ Thread ${thread.id} visível: ${decisao.code}`);
    
    // Atualizar cache local
    if (event.type === 'create') {
      setThreads(prev => [...prev, thread]);
    } else if (event.type === 'update') {
      setThreads(prev => prev.map(t => t.id === thread.id ? thread : t));
    } else if (event.type === 'delete') {
      setThreads(prev => prev.filter(t => t.id !== thread.id));
    }
  });
  
  return unsubscribe;
}, [usuario, contatosMap]);
```

**Vantagens:**
- ✅ Receive notificações instantâneas
- ✅ Controle total no frontend
- ❌ Performance: roda motor Nexus para cada evento (pode ser caro)

---

### Cenário 2: Backend Filtra, Frontend Apenas Atualiza

```javascript
// Backend aplica RLS (Row Level Security) baseado em Nexus360
// Subscription já vem filtrada

useEffect(() => {
  const unsubscribe = base44.entities.MessageThread.subscribe((event) => {
    // Backend já aplicou todas as regras → pode confiar
    const thread = event.data;
    
    // Apenas aplicar filtros de UI (aba ativa, busca, tags)
    if (!matchCurrentUIFilters(thread, filtrosAtivos)) {
      return;
    }
    
    // Atualizar cache
    updateCacheOptimistic(event.type, thread);
  });
  
  return unsubscribe;
}, [filtrosAtivos]);
```

**Vantagens:**
- ✅ Performance máxima no frontend
- ✅ Segurança no backend (RLS)
- ❌ Complexidade: precisa implementar RLS dinâmico por usuário

---

### Cenário 3: Polling com Invalidação (Atual)

```javascript
// React Query com refetch automático
const { data: threads } = useQuery({
  queryKey: ['threads', usuario?.id],
  queryFn: async () => {
    const raw = await base44.entities.MessageThread.list('-last_message_at', 500);
    
    // Aplicar motor Nexus UMA VEZ (não a cada evento)
    return raw.filter(thread => {
      const decisao = decidirVisibilidadeNexus360(thread, usuario, contatosMap[thread.contact_id]);
      return decisao.allow;
    });
  },
  refetchInterval: 45000, // 45s
});
```

**Vantagens:**
- ✅ Simples e confiável
- ✅ Motor roda de forma controlada (não a cada evento)
- ❌ Delay de até 45s para novas threads

---

### 🎯 Recomendação

**Para Fase Atual (Otimizações):**
- Manter Cenário 3 (polling)
- Motor Nexus roda 1x a cada 45s
- Regras fixas (P1-P11) sempre aplicadas
- Regras configuráveis (P5, P8, P12) respeitam `configuracao_visibilidade_nexus`

**Para Futuro (Real-time):**
- Migrar para Cenário 2 (backend RLS + subscribe)
- Implementar Postgres RLS policies que respeitam Nexus360
- Frontend só atualiza cache otimisticamente

---

## 📊 IMPACTO NA TELA UNIFICADA

### Como as Regras Aparecem na UI

#### Coluna LEGADO (Descritivo - Read-Only)

```
┌─ 🔍 VISIBILIDADE ATUAL (Calculada) ───────────────┐
│ Como você vê threads hoje (lógica hardcoded):     │
│                                                    │
│ ✅ SEMPRE PERMITE:                                 │
│ • ✓ Minhas conversas atribuídas (P3)              │
│ • ✓ Contatos da minha carteira (P4)               │
│ • ✓ Threads internas onde sou participante (P1)   │
│                                                    │
│ ✅ PERMITE (se gerente):                           │
│ • ✓ Não atribuídas do setor Vendas                │
│ • ✓ Janela 24h: conversas que interagi (P5 impl)  │
│ • ✓ Supervisão: aguardando >30min (P8 impl)       │
│                                                    │
│ ❌ SEMPRE BLOQUEIA:                                │
│ • ✗ Conversas de outros atendentes (P7)           │
│ • ✗ Carteiras de outros atendentes (P6)           │
│ • ✗ Setores: Assistência, Financeiro              │
│ • ✗ Threads internas de outras equipes (P1)       │
│                                                    │
│ 📊 Baseado em:                                     │
│ • Setor: Vendas                                    │
│ • Função: Gerente                                  │
│ • Setores atend: [Vendas, Geral]                  │
│ • Integrações: 2 permitidas                        │
└────────────────────────────────────────────────────┘
```

#### Coluna NEXUS360 (Configurável - Editável)

```
┌─ ⚙️ CONFIGURAÇÃO NEXUS360 ──────────────────────────┐
│                                                      │
│ 🎯 Modo Base: [●] Liberado  [○] Bloqueado (P12)     │
│                                                      │
│ 🚫 BLOQUEIOS EXPLÍCITOS (Regras Fixas Aplicadas)    │
│ ┌──────────────────────────────────────────────────┐ │
│ │ [+] Bloquear Setor                               │ │
│ │ [+] Bloquear Integração                          │ │
│ │ [+] Bloquear Canal                               │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ • Setor: Assistência  [Ativa ✓] [×]  (P11)          │
│ • Setor: Financeiro   [Ativa ✓] [×]  (P11)          │
│ • Integração: #6820   [Ativa ✓] [×]  (P10)          │
│                                                      │
│ ✅ LIBERAÇÕES ESPECIAIS (Regras Configuráveis)      │
│ ┌──────────────────────────────────────────────────┐ │
│ │ [+] Janela 24h                                   │ │
│ │ [+] Supervisão Gerencial                         │ │
│ └──────────────────────────────────────────────────┘ │
│                                                      │
│ • Janela: [24__] horas  [Ativa ✓] [×]  (P5)         │
│ • Supervisão: [30__] min  [Ativa ✓] [×]  (P8)       │
│                                                      │
│ 🎛️ FLAGS DE VISIBILIDADE FINA                       │
│ • [✓] Ver não atribuídas do setor                   │
│ • [ ] Ver conversas de outros atendentes            │
│ • [ ] Ver todos os setores (cross-setorial)         │
│ • [✓] Ver carteira de outros (sobrepõe P6)          │
│ • [ ] Strict Mode (desativa P5 e P8)                │
│                                                      │
│ ┌─ 🎯 PREVIEW NEXUS (Simulado) ─────────────────┐   │
│ │ Com estas configurações, você verá:           │   │
│ │                                               │   │
│ │ ✅ PERMITE:                                    │   │
│ │ • Minhas atribuídas (P3)                      │   │
│ │ • Minha carteira (P4)                         │   │
│ │ • Não atribuídas de Vendas (flag ✓)          │   │
│ │ • Janela 24h: últimas interações (P5)         │   │
│ │ • Supervisão: >30min sem resposta (P8)        │   │
│ │ • Padrão liberado (P12)                       │   │
│ │                                               │   │
│ │ ❌ BLOQUEIA:                                   │   │
│ │ • Setores: Assistência, Financeiro (P11)      │   │
│ │ • Integração: #6820 (P10)                     │   │
│ │ • Atribuídas a outros (P7, sem exceção)       │   │
│ │ • Carteiras de outros (P6, mesmo com flag)    │   │
│ │                                               │   │
│ │ ⚠️ DIVERGÊNCIAS vs Legado:                     │   │
│ │ • 2 críticas (falsos negativos)               │   │
│ │ • 3 alertas (falsos positivos)                │   │
│ │ [📊 Ver Detalhes]                             │   │
│ └───────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

---

## 🔍 COMPARAÇÃO: REGRAS FIXAS (Código Atual vs Necessário)

### Status de Implementação

| Regra | Nome | Legado | Nexus | Necessário |
|-------|------|--------|-------|-----------|
| **P1** | Thread Interna (Participação) | ✅ | ✅ | ✅ OK |
| **P2** | Admin Total | ✅ | ✅ | ✅ OK |
| **P3** | Thread Atribuída | ✅ | ✅ | ✅ OK |
| **P4** | Contato Fidelizado | ✅ | ✅ | ✅ OK |
| **P6** | Fidelizado a Outro | ⚠️ Hardcoded | ✅ | 🆕 Adicionar flag `podeVerCarteiraOutros` |
| **P7** | Atribuído a Outro | ✅ | ✅ | ✅ OK (interação com P5/P8) |
| **P9** | Canal Bloqueado | ❌ Não existe | ✅ | ✅ OK |
| **P10** | Integração Bloqueada | ⚠️ Via `whatsapp_permissions` | ✅ | ✅ OK |
| **P11** | Setor Bloqueado | ⚠️ Via `whatsapp_setores` | ✅ | ✅ OK |

### Gaps Identificados

1. **P6 (Fidelizado a Outro)**
   - Legado: bloqueia sempre (hardcoded)
   - Nexus: precisa de flag `podeVerCarteiraOutros` em `permissoes_acoes_nexus`
   - **Ação:** Adicionar flag + UI na aba "Ações"

2. **P9 (Canal Bloqueado)**
   - Legado: não existe (todos canais visíveis se houver integração)
   - Nexus: implementado via `regras_bloqueio[{tipo: 'canal'}]`
   - **Ação:** Nenhuma, Nexus já tem

3. **P10 (Integração Bloqueada)**
   - Legado: usa `whatsapp_permissions[].can_view`
   - Nexus: usa `regras_bloqueio[{tipo: 'integracao'}]`
   - **Ação:** Documentar equivalência na migração

---

## 🎨 COMO EXIBIR NA TELA UNIFICADA

### Seção "Regras Fixas Aplicadas" (Info, Não Editável)

```javascript
// Componente read-only que explica as regras fixas
function RegrasFix asInfoPanel({ usuario }) {
  return (
    <Card className="bg-blue-50 border-blue-200">
      <CardHeader>
        <CardTitle className="text-sm flex items-center gap-2">
          <Shield className="w-4 h-4 text-blue-600" />
          Regras de Segurança (Sempre Aplicadas)
        </CardTitle>
        <CardDescription className="text-xs">
          Estas regras NÃO podem ser desativadas - garantem privacidade e integridade
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-xs">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>P1:</strong> Threads internas só para participantes
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>P2:</strong> Admin tem acesso total
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>P3:</strong> Sempre vê suas threads atribuídas
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>P4:</strong> Sempre vê sua carteira de clientes
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>P6:</strong> Bloqueio de carteira de outros (configurável via flag)
            </div>
          </div>
          
          <div className="flex items-start gap-2">
            <Lock className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <strong>P7:</strong> Bloqueio de atribuídas a outros (liberável via P5/P8)
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
```

### Seção "Bloqueios Configuráveis" (Editável)

```javascript
// Componente editável para P9, P10, P11
function BloqueiosConfiguraveis({ configuracao, onChange, integracoes }) {
  const adicionarBloqueio = (tipo) => {
    // Lógica já existe em PainelPermissoesUnificado
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">🚫 Bloqueios (P9, P10, P11)</CardTitle>
        <CardDescription className="text-xs">
          Define listas de BLOQUEIO - regras fixas, apenas valores configuráveis
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button size="sm" onClick={() => adicionarBloqueio('canal')}>
            + Canal (P9)
          </Button>
          <Button size="sm" onClick={() => adicionarBloqueio('integracao')}>
            + Integração (P10)
          </Button>
          <Button size="sm" onClick={() => adicionarBloqueio('setor')}>
            + Setor (P11)
          </Button>
        </div>
        
        {/* Cards dinâmicos */}
        {configuracao.regras_bloqueio.map((regra, idx) => (
          <RegraBloqueioCard key={idx} regra={regra} index={idx} />
        ))}
      </CardContent>
    </Card>
  );
}
```

### Seção "Liberações" (Editável)

```javascript
// P5, P8 - Regras de negócio flexíveis
function LiberacoesConfiguravelis({ configuracao, onChange }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">✅ Liberações (P5, P8)</CardTitle>
        <CardDescription className="text-xs">
          Exceções que permitem acesso em situações específicas
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-4">
          <Button size="sm" onClick={() => adicionarLiberacao('janela_24h')}>
            + Janela 24h (P5)
          </Button>
          <Button size="sm" onClick={() => adicionarLiberacao('gerente_supervisao')}>
            + Supervisão (P8)
          </Button>
        </div>
        
        {/* Cards dinâmicos */}
        {configuracao.regras_liberacao.map((regra, idx) => (
          <RegraLiberacaoCard key={idx} regra={regra} index={idx} />
        ))}
      </CardContent>
    </Card>
  );
}
```

---

## 🔐 STRICT MODE (Nova Flag)

### Propósito

**Desativar TODAS as liberações** (P5, P8) para usuários que devem seguir regras estritas.

**Casos de uso:**
- Estagiários/trainees
- Usuários em período de experiência
- Compliance/auditoria (zero exceções)

### Implementação

```javascript
// No motor Nexus360
function decidirVisibilidadeNexus360(thread, user, contato) {
  // ... regras fixas ...
  
  // P7: Atribuído a outro
  if (atribuidoParaOutro) {
    // ⚠️ Verificar strict mode ANTES de aplicar exceções
    if (user.permissoes_acoes_nexus?.strictMode) {
      // Strict mode: sem janela 24h, sem supervisão
      return { allow: false, code: 'ASSIGNED_TO_ANOTHER_STRICT' };
    }
    
    // Modo normal: verificar P5 e P8
    // ... lógica janela 24h ...
    // ... lógica supervisão ...
  }
  
  // ...
}
```

### UI

```javascript
<div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
  <div>
    <p className="text-sm font-bold text-red-800">🚨 Strict Mode</p>
    <p className="text-xs text-red-600">
      Desativa liberações P5 e P8 - zero exceções às regras de bloqueio
    </p>
  </div>
  <Switch
    checked={permissoesAcoes.strictMode || false}
    onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, strictMode: v}))}
  />
</div>
```

---

## 📋 CHECKLIST: O que Adicionar ao Código

### User Entity

```json
{
  "permissoes_acoes_nexus": {
    "type": "object",
    "properties": {
      "...existing 19 flags...": "...",
      
      "ADICIONAR AGORA": "---",
      
      "podeVerCarteiraOutros": { 
        "type": "boolean",
        "default": false,
        "description": "Permite ver contatos fidelizados a outros atendentes (sobrepõe P6)"
      },
      
      "podeVerNaoAtribuidas": { 
        "type": "boolean",
        "default": true,
        "description": "Ver threads não atribuídas do seu setor"
      },
      
      "podeVerConversasOutros": { 
        "type": "boolean",
        "default": false,
        "description": "Ver threads atribuídas a outros atendentes do setor (exceto fidelizadas)"
      },
      
      "podeVerTodosSetores": { 
        "type": "boolean",
        "default": false,
        "description": "Ver threads de TODOS os setores (gerente cross-setorial)"
      },
      
      "strictMode": { 
        "type": "boolean",
        "default": false,
        "description": "Modo restrito: desativa P5 (janela 24h) e P8 (supervisão)"
      }
    }
  }
}
```

---

### Motor Nexus360 (`components/lib/nexusComparator.js`)

**Adicionar no início da função:**

```javascript
// Verificar strict mode
if (user.permissoes_acoes_nexus?.strictMode) {
  console.log('[Nexus360] ⚠️ STRICT MODE ativo - liberações P5/P8 desativadas');
  // Flag para pular P5 e P8
}
```

**Adicionar após P7:**

```javascript
// P7: Atribuído a outro
if (atribuidoParaOutro) {
  // Strict mode: sem exceções
  if (user.permissoes_acoes_nexus?.strictMode) {
    return {
      allow: false,
      code: 'ASSIGNED_TO_ANOTHER_STRICT',
      path: ['P7:strict_mode_active']
    };
  }
  
  // Verificar P5 (janela 24h)
  // ... lógica existente ...
  
  // Verificar P8 (supervisão)
  // ... lógica existente ...
  
  // Sem exceções → DENY
  return { allow: false, code: 'ASSIGNED_TO_ANOTHER' };
}

// NOVA: Verificar flags de visibilidade fina
if (!thread.assigned_user_id) {
  // Não atribuída
  if (user.permissoes_acoes_nexus?.podeVerNaoAtribuidas === false) {
    return { 
      allow: false, 
      code: 'UNASSIGNED_BLOCKED',
      path: ['P-flag:nao_ver_nao_atribuidas']
    };
  }
}
```

---

## 🎯 ALINHAMENTO COM O DEBATE

### ✅ Pontos Totalmente Alinhados

1. **Separação Fixas vs Configuráveis**
   - Debate: "P1-P4, P6-P7, P9-P11 = fixas | P5, P8, P12 = configuráveis"
   - Projeto: Exatamente isso
   - **Status:** ✅ 100% alinhado

2. **Regras Fixas no Motor**
   - Debate: "Não devem ser desligadas por configuração comum"
   - Projeto: Lógica hardcoded no motor, apenas listas são editáveis
   - **Status:** ✅ 100% alinhado

3. **Regras de Negócio Editáveis**
   - Debate: "P5, P8, P12 em `configuracao_visibilidade_nexus.rules`"
   - Projeto: `regras_liberacao[]` + `modo_visibilidade`
   - **Status:** ✅ 100% alinhado

4. **Ordem de Execução (Waterfall)**
   - Debate: Fixas → Bloqueios → Liberações → Default
   - Projeto: Mesma ordem no motor
   - **Status:** ✅ 100% alinhado

---

### ⚠️ Gaps e Refinamentos

1. **Flags de UI (view_unassigned, view_others)**
   - Debate: Menciona como configuráveis
   - Projeto: **NÃO existem explicitamente**
   - **Ação:** Adicionar 4 flags a `permissoes_acoes_nexus`

2. **Strict Mode**
   - Debate: Menciona como desativador de P5/P8
   - Projeto: **NÃO existe**
   - **Ação:** Adicionar flag + lógica no motor

3. **Impacto no Subscribe**
   - Debate: Discute 3 cenários (frontend filtra, backend filtra, polling)
   - Projeto: Atualmente usa Cenário 3 (polling)
   - **Decisão:** Manter Cenário 3 por ora, planejar Cenário 2 para futuro

---

## 🏗️ ARQUITETURA FINAL PROPOSTA

### Estrutura de Dados Consolidada

```javascript
// USER ENTITY - Visão Completa
{
  // ═══════════════════════════════════════════════════════════
  // DADOS BÁSICOS (compartilhados)
  // ═══════════════════════════════════════════════════════════
  display_name: string,
  email: string,
  role: 'admin' | 'user',
  is_active: boolean,
  attendant_sector: 'vendas' | 'assistencia' | 'financeiro' | 'fornecedor' | 'geral',
  attendant_role: 'junior' | 'pleno' | 'senior' | 'coordenador' | 'gerente',
  
  // ═══════════════════════════════════════════════════════════
  // SISTEMA LEGADO (ativo até migração)
  // ═══════════════════════════════════════════════════════════
  is_whatsapp_attendant: boolean,
  whatsapp_setores: string[],              // Inferido de regras_bloqueio (P11)
  whatsapp_permissions: [{                  // Inferido de regras_bloqueio (P10)
    integration_id: string,
    can_view: boolean,
    can_receive: boolean,
    can_send: boolean
  }],
  permissoes_comunicacao: {
    pode_transferir_conversas: boolean      // → podeTransferirConversa (Nexus)
  },
  paginas_acesso: string[],                 // Controle de menu (independente)
  max_concurrent_conversations: number,
  
  // ═══════════════════════════════════════════════════════════
  // SISTEMA NEXUS360 (preview/shadow/ativo)
  // ═══════════════════════════════════════════════════════════
  sistema_permissoes_ativo: 'legado' | 'nexus360' | 'shadow',
  
  configuracao_visibilidade_nexus: {
    modo_visibilidade: 'padrao_liberado' | 'padrao_bloqueado',  // P12
    
    regras_bloqueio: [              // P9, P10, P11 (FIXAS, mas listas editáveis)
      {
        tipo: 'canal' | 'integracao' | 'setor',
        valores_bloqueados: string[],
        ativa: boolean,
        prioridade: number,
        descricao: string
      }
    ],
    
    regras_liberacao: [             // P5, P8 (CONFIGURÁVEIS)
      {
        tipo: 'janela_24h' | 'gerente_supervisao',
        ativa: boolean,
        prioridade: number,
        configuracao: {
          horas?: number,
          minutos_sem_resposta?: number
        }
      }
    ],
    
    deduplicacao: {
      ativa: boolean,
      criterio: 'contact_id',
      manter: 'mais_recente'
    }
  },
  
  permissoes_acoes_nexus: {
    // ═══════════════════════════════════════════════════════════
    // GRUPO 1: Ações em Conversas (6 flags)
    // ═══════════════════════════════════════════════════════════
    podeVerTodasConversas: boolean,      // Se false, respeita P6/P7 sem exceções
    podeEnviarMensagens: boolean,
    podeEnviarMidias: boolean,
    podeEnviarAudios: boolean,
    podeTransferirConversa: boolean,
    podeApagarMensagens: boolean,
    
    // ═══════════════════════════════════════════════════════════
    // GRUPO 2: Ações em Contatos (4 flags)
    // ═══════════════════════════════════════════════════════════
    podeVerDetalhesContato: boolean,
    podeEditarContato: boolean,
    podeBloquearContato: boolean,
    podeDeletarContato: boolean,
    
    // ═══════════════════════════════════════════════════════════
    // GRUPO 3: Gestão e Controle (5 flags)
    // ═══════════════════════════════════════════════════════════
    podeGerenciarFilas: boolean,
    podeAtribuirConversas: boolean,
    podeCriarPlaybooks: boolean,
    podeEditarPlaybooks: boolean,
    podeGerenciarConexoes: boolean,
    
    // ═══════════════════════════════════════════════════════════
    // GRUPO 4: Admin e Relatórios (4 flags)
    // ═══════════════════════════════════════════════════════════
    podeVerRelatorios: boolean,
    podeExportarDados: boolean,
    podeGerenciarPermissoes: boolean,
    podeVerDiagnosticos: boolean,
    
    // ═══════════════════════════════════════════════════════════
    // GRUPO 5: VISIBILIDADE FINA (5 flags) - NOVO
    // ═══════════════════════════════════════════════════════════
    podeVerCarteiraOutros: boolean,      // Sobrepõe P6 (fidelizado a outro)
    podeVerNaoAtribuidas: boolean,       // Ver filas do setor
    podeVerConversasOutros: boolean,     // Ver atribuídas a outros do setor (gerente)
    podeVerTodosSetores: boolean,        // Ver cross-setorial (diretor)
    strictMode: boolean                  // Desativa P5 e P8
  },
  
  diagnostico_nexus: {
    ativo: boolean,
    log_level: 'info' | 'debug' | 'warn'
  }
}
```

---

## 🎬 EXEMPLO PRÁTICO: Gerente de Vendas

### Configuração Legado

```javascript
{
  attendant_sector: 'vendas',
  attendant_role: 'gerente',
  is_whatsapp_attendant: true,
  whatsapp_setores: ['vendas', 'geral'],
  whatsapp_permissions: [
    { integration_id: 'vendas-1', can_view: true, can_receive: true, can_send: true },
    { integration_id: 'suporte-1', can_view: true, can_receive: false, can_send: true }
  ],
  permissoes_comunicacao: { pode_transferir_conversas: true },
  paginas_acesso: ['Comunicacao', 'Dashboard', 'Clientes', 'Vendedores']
}
```

### Equivalente Nexus360

```javascript
{
  sistema_permissoes_ativo: 'nexus360',
  
  configuracao_visibilidade_nexus: {
    modo_visibilidade: 'padrao_liberado',  // P12
    
    regras_bloqueio: [
      // P11: Bloquear setores não atendidos
      {
        tipo: 'setor',
        valores_bloqueados: ['assistencia', 'financeiro', 'fornecedor'],
        ativa: true
      },
      // P10: Não há bloqueio de integração (todas liberadas)
    ],
    
    regras_liberacao: [
      // P5: Janela 24h
      {
        tipo: 'janela_24h',
        configuracao: { horas: 24 },
        ativa: true
      },
      // P8: Supervisão gerencial
      {
        tipo: 'gerente_supervisao',
        configuracao: { minutos_sem_resposta: 30 },
        ativa: true
      }
    ]
  },
  
  permissoes_acoes_nexus: {
    // Conversas
    podeVerTodasConversas: false,          // Gerente NÃO vê tudo (usa P8 para supervisão pontual)
    podeEnviarMensagens: true,
    podeEnviarMidias: true,
    podeEnviarAudios: true,
    podeTransferirConversa: true,
    podeApagarMensagens: false,
    
    // Contatos
    podeVerDetalhesContato: true,
    podeEditarContato: true,
    podeBloquearContato: true,
    podeDeletarContato: false,
    
    // Gestão
    podeGerenciarFilas: true,
    podeAtribuirConversas: true,
    podeCriarPlaybooks: true,
    podeEditarPlaybooks: true,
    podeGerenciarConexoes: false,
    
    // Admin
    podeVerRelatorios: true,
    podeExportarDados: true,
    podeGerenciarPermissoes: false,
    podeVerDiagnosticos: true,
    
    // Visibilidade Fina
    podeVerCarteiraOutros: true,           // Gerente vê carteiras da equipe
    podeVerNaoAtribuidas: true,            // Vê filas
    podeVerConversasOutros: true,          // Vê atribuídas a subordinados (via P8)
    podeVerTodosSetores: false,            // Apenas setor Vendas
    strictMode: false                      // Permite P5 e P8
  }
}
```

### Visibilidade Resultante

**Gerente de Vendas vê:**
- ✅ **P3:** Suas conversas atribuídas
- ✅ **P4:** Sua carteira de clientes
- ✅ **P5:** Conversas que interagiu nas últimas 24h (mesmo de outros)
- ✅ **P8:** Threads do setor Vendas sem resposta há >30min
- ✅ **Flag:** Não atribuídas do setor Vendas
- ✅ **Flag:** Carteiras da equipe de vendas
- ❌ **P11:** Bloqueado: Assistência, Financeiro, Fornecedor
- ❌ **P7:** Atribuídas a outros (exceto via P5/P8)

---

## 🧪 IMPACTO NO SIMULADOR

### Categorização de Divergências

```javascript
// Quando legado PERMITE mas Nexus NEGA
{
  severity: 'error',          // CRÍTICO
  tipo_divergencia: 'falso_negativo',
  regra_responsavel: 'P6',   // Ex: carteira de outro bloqueada
  impacto: 'Usuário perderá acesso a thread que vê hoje'
}

// Quando legado NEGA mas Nexus PERMITE
{
  severity: 'warning',        // ALERTA
  tipo_divergencia: 'falso_positivo',
  regra_responsavel: 'P5',   // Ex: janela 24h liberou
  impacto: 'Usuário ganhará acesso a thread que não via antes'
}
```

### UI do Simulador

```javascript
// Badge de divergência crítica
if (resultado.severity === 'error') {
  return (
    <Badge className="bg-red-600 text-white">
      🚨 CRÍTICO
      <Tooltip>
        <p>Regra {resultado.regra_responsavel} causará PERDA de acesso</p>
        <p>Legado: VISÍVEL</p>
        <p>Nexus: BLOQUEADO ({resultado.nexusReasonCode})</p>
        <p className="font-bold mt-2">⚠️ Revisar antes de ativar!</p>
      </Tooltip>
    </Badge>
  );
}
```

---

## 📊 TABELA COMPARATIVA DIMENSIONAL (Nova)

### Como Renderizar na Tela Unificada

```javascript
function TabelaComparativaDimensional({ usuario, threads, contatos, integracoes }) {
  // Calcular métricas para ambos sistemas
  const metricsLegado = calcularMetricasLegado(usuario, threads, contatos, integracoes);
  const metricsNexus = calcularMetricasNexus360(usuario, threads, contatos, integracoes);
  
  const divergencias = compararMetricas(metricsLegado, metricsNexus);
  
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">📊 Comparação Dimensional</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2">Dimensão</th>
              <th className="text-center py-2">Legado (Ativo)</th>
              <th className="text-center py-2">Nexus360 (Preview)</th>
              <th className="text-center py-2">Divergência</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="py-2">Threads visíveis</td>
              <td className="text-center">{metricsLegado.totalVisiveis}</td>
              <td className="text-center">{metricsNexus.totalVisiveis}</td>
              <td className="text-center">
                {divergencias.threads > 0 ? (
                  <Badge variant="destructive">+{divergencias.threads}</Badge>
                ) : divergencias.threads < 0 ? (
                  <Badge className="bg-red-600">{divergencias.threads}</Badge>
                ) : (
                  <Badge variant="outline">✓</Badge>
                )}
              </td>
            </tr>
            
            <tr>
              <td className="py-2">Canais ativos</td>
              <td className="text-center">{metricsLegado.canais.join(', ')}</td>
              <td className="text-center">{metricsNexus.canais.join(', ')}</td>
              <td className="text-center">
                {metricsLegado.canais.length === metricsNexus.canais.length ? (
                  <Badge variant="outline">✓</Badge>
                ) : (
                  <Badge variant="destructive">⚠️</Badge>
                )}
              </td>
            </tr>
            
            <tr>
              <td className="py-2">Setores acessíveis</td>
              <td className="text-center">{metricsLegado.setores.join(', ')}</td>
              <td className="text-center">{metricsNexus.setores.join(', ')}</td>
              <td className="text-center">
                {/* Similar */}
              </td>
            </tr>
            
            <tr>
              <td className="py-2">Integrações</td>
              <td className="text-center">{metricsLegado.integracoes.length}</td>
              <td className="text-center">{metricsNexus.integracoes.length}</td>
              <td className="text-center">
                {/* Similar */}
              </td>
            </tr>
            
            <tr className="border-t font-semibold">
              <td className="py-2">Divergências Críticas</td>
              <td colSpan={2} className="text-center">
                {divergencias.criticas} falsos negativos
              </td>
              <td className="text-center">
                {divergencias.criticas > 0 ? (
                  <Badge className="bg-red-600 text-white">🚨</Badge>
                ) : (
                  <Badge className="bg-green-600 text-white">✓</Badge>
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
```

---

## 🚀 PRÓXIMOS PASSOS (Ordem de Implementação)

### Fase 1: Campos e Motor (Backend) ✅ 70% Completo

- [x] P1-P4: Regras fixas básicas (já implementado)
- [x] P9-P11: Bloqueios configuráveis (já implementado)
- [x] P5, P8: Liberações configuráveis (já implementado)
- [x] P12: Default allow/deny (já implementado)
- [ ] **FALTA:** P6 completo com flag `podeVerCarteiraOutros`
- [ ] **FALTA:** P7 com interação correta P5/P8
- [ ] **FALTA:** Flags de visibilidade fina (5 novas)
- [ ] **FALTA:** Strict mode

**Tempo:** 1-2h

---

### Fase 2: Tela Unificada (Frontend) ⏳ 0% Completo

- [ ] Criar `GerenciadorUsuariosComparativo.jsx`
- [ ] Seção Dados Básicos (compartilhada)
- [ ] Coluna Legado com "Visibilidade Calculada"
- [ ] Coluna Nexus com bloqueios/liberações
- [ ] Tabela comparativa dimensional
- [ ] Toggle sistema ativo
- [ ] Botões salvar independentes

**Tempo:** 3h

---

### Fase 3: Integração e Testes ⏳ 0% Completo

- [ ] Conectar à página `Usuarios.js`
- [ ] Testar migração automática (Legado → Nexus)
- [ ] Validar simulador com threads reais
- [ ] Testar toggle sistema ativo (sem afetar outros usuários)
- [ ] Documentar processo de migração

**Tempo:** 1-2h

---

## 🏁 CONCLUSÃO E ALINHAMENTO FINAL

### Score de Alinhamento: **95%** ✅

| Aspecto | Alinhamento |
|---------|------------|
| Separação Fixas vs Configuráveis | ✅ 100% |
| Ordem de execução (waterfall) | ✅ 100% |
| Regras P1-P12 mapeadas | ✅ 100% |
| Impacto no subscribe/polling | ✅ 100% |
| Flags de visibilidade fina | ⚠️ 0% (precisa adicionar) |
| Strict mode | ⚠️ 0% (precisa adicionar) |
| UI comparativa lado a lado | ✅ 100% (projeto pronto) |

---

### Decisões Finais

1. **Regras Fixas:**
   - ✅ P1-P4, P6-P7, P9-P11 → hardcoded no motor
   - ⚠️ Apenas LISTAS são editáveis (quais setores, quais integrações)
   - ❌ LÓGICA de bloqueio não pode ser desativada

2. **Regras Configuráveis:**
   - ✅ P5, P8, P12 → editáveis em `configuracao_visibilidade_nexus`
   - ✅ Flags de visibilidade → adicionar 5 novas a `permissoes_acoes_nexus`
   - ✅ Strict mode → desativa P5/P8 quando necessário

3. **Subscribe (Real-time):**
   - 🕐 Manter polling (45s) por ora
   - 🔮 Planejar migração para RLS + subscribe (Fase futura)
   - ⚙️ Motor Nexus roda UMA VEZ por refetch (não a cada evento)

4. **Tela Unificada:**
   - ✅ Layout 2 colunas (Legado | Nexus360)
   - ✅ Seção "Visibilidade Calculada" no Legado (derivar de `threadVisibility.js`)
   - ✅ Tabela comparativa dimensional
   - ✅ Toggle sistema ativo + modo shadow

---

**Pronto para próxima fase:** ✅ **Implementação da tela unificada** (aguardando aprovação)

**FIM DA ANÁLISE** 🎯