# 🗺️ MAPA COMPLETO: PERMISSÕES DO SISTEMA DE COMUNICAÇÃO

**Data:** 2026-01-18  
**Status:** Mapeamento Cirúrgico Completo  
**Objetivo:** Documentar TODA a lógica de permissões e bloqueios aplicados no sistema

---

## 📊 VISÃO EXECUTIVA

O sistema possui **3 CAMADAS** de controle funcionando em CASCATA:

```
┌─────────────────────────────────────────────────────────────────┐
│ 🔐 CAMADA 1: VISIBILIDADE (Quem VÊ a thread na lista?)         │
│ ────────────────────────────────────────────────────────────── │
│ Onde: threadVisibility.js + Comunicacao.jsx (linha 1153-1594) │
│ Efeito: Thread NÃO APARECE na lista se bloqueado              │
│ Configuração: MISTA (fixa + User.whatsapp_permissions)        │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ 🚪 CAMADA 2: INTERAÇÃO (Quem pode ENVIAR mensagens?)           │
│ ────────────────────────────────────────────────────────────── │
│ Onde: ChatWindow.jsx → podeInteragirNaThread() (linha 165-450)│
│ Efeito: Input BLOQUEADO + mensagem "Sem permissão"            │
│ Configuração: FIXA (hierarquia hardcoded)                     │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│ ⚡ CAMADA 3: FUNCIONALIDADES (Mídia, Áudio, Apagar, etc.)      │
│ ────────────────────────────────────────────────────────────── │
│ Onde: ChatWindow.jsx (linha 211-250)                          │
│ Efeito: Botões específicos desabilitados                      │
│ Configuração: User.permissoes_comunicacao (editável na UI)    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎛️ TELA DE CONFIGURAÇÃO

### 📍 `pages/Usuarios.jsx` - Gerenciamento de Usuários & Acessos

**ESTA É A CENTRAL DE CONTROLE** onde TODAS as permissões são configuradas.

```
Usuarios.jsx (150 linhas)
  │
  ├─ carregarUsuarios() → busca User.list()
  ├─ salvarUsuario() → atualiza campos de permissões
  │
  └─ <GerenciadorUsuariosUnificado /> (componente principal)
      │
      ├─ TabelaUsuarios.jsx → lista de todos os users
      │
      ├─ SecaoDadosUsuario.jsx → formulário básico
      │   ├─ display_name (nome editável)
      │   ├─ role (admin/user)
      │   ├─ attendant_sector (vendas/assistencia/etc)
      │   └─ attendant_role (junior/pleno/senior/coordenador/gerente)
      │
      └─ PainelPermissoesUnificado.jsx ⭐ PAINEL DE PERMISSÕES
          │
          ├─ ABA 1: Comunicação (permissoes_comunicacao)
          │   ├─ ✅ Pode enviar mensagens
          │   ├─ ✅ Pode enviar mídias
          │   ├─ ✅ Pode enviar áudios
          │   ├─ ✅ Pode apagar mensagens
          │   └─ ✅ Pode transferir conversas
          │
          ├─ ABA 2: Conexões WhatsApp (whatsapp_permissions)
          │   └─ Por cada WhatsAppIntegration:
          │       ├─ 👁️ can_view (vê conversas)
          │       ├─ 📤 can_send (envia mensagens)
          │       └─ ⚙️ can_manage (configura conexão)
          │
          ├─ ABA 3: Visualização (Nexus360) ⚡ FUTURO
          │   ├─ Regras de Bloqueio
          │   │   ├─ 🚫 Setores bloqueados
          │   │   ├─ 🚫 Integrações bloqueadas
          │   │   ├─ 🚫 Canais bloqueados
          │   │   └─ 🚫 Provedores bloqueados
          │   │
          │   └─ Regras de Liberação
          │       ├─ ✅ Janela 24h (hours)
          │       └─ ✅ Gerente Supervisão (minutos)
          │
          └─ ABA 4: Ações (93 flags) ⚡ FUTURO
              └─ Todas as permissões de funcionalidades
```

---

## 🗂️ ESTRUTURA DE DADOS NO USER

### Campos Configuráveis (Banco de Dados):

```javascript
// entities/User.json (campos adicionais)
{
  // ─────────────────────────────────────────────────────
  // IDENTIFICAÇÃO BÁSICA
  // ─────────────────────────────────────────────────────
  "display_name": "Nome editável do usuário",
  "role": "admin | user",
  "attendant_role": "junior | pleno | senior | coordenador | gerente",
  "attendant_sector": "vendas | assistencia | financeiro | fornecedor | geral",
  "is_active": true,
  
  // ─────────────────────────────────────────────────────
  // CAMADA 3: FUNCIONALIDADES (Editável na UI)
  // ─────────────────────────────────────────────────────
  "permissoes_comunicacao": {
    "pode_enviar_mensagens": true,    // ✅ Texto
    "pode_enviar_midias": true,       // ✅ Imagens, vídeos, docs
    "pode_enviar_audios": true,       // ✅ Gravação de voz
    "pode_apagar_mensagens": false,   // ❌ Deletar msgs
    "pode_transferir_conversas": true // ✅ Transferir para outro atendente
  },
  
  // ─────────────────────────────────────────────────────
  // CAMADA 1: VISIBILIDADE POR INTEGRAÇÃO (Editável na UI)
  // ─────────────────────────────────────────────────────
  "whatsapp_permissions": [
    {
      "integration_id": "695f988cba647445cca9a6d2",
      "integration_name": "Chip Vendas Principal",
      "can_view": true,    // 👁️ Vê conversas desta instância
      "can_send": true,    // 📤 Envia mensagens por esta instância
      "can_manage": false  // ⚙️ Configura/reinicia conexão
    }
  ],
  
  // ─────────────────────────────────────────────────────
  // NEXUS360: REGRAS AVANÇADAS (Futuro - parcialmente implementado)
  // ─────────────────────────────────────────────────────
  "configuracao_visibilidade_nexus": {
    "modo_visibilidade": "padrao_liberado",
    "regras_bloqueio": [
      {
        "tipo": "setor | integracao | canal | provedor",
        "valores_bloqueados": ["vendas", "assistencia"],
        "ativa": true,
        "prioridade": 10,
        "observacao": "Bloquear vendas para júnior"
      }
    ],
    "regras_liberacao": [
      {
        "tipo": "janela_24h",
        "configuracao": { "horas": 24 },
        "ativa": true,
        "observacao": "Atendente vê threads com msg recente"
      },
      {
        "tipo": "gerente_supervisao",
        "configuracao": { "minutos_sem_resposta": 30 },
        "ativa": true,
        "observacao": "Gerente vê threads sem resposta"
      }
    ],
    "deduplicacao": {
      "ativa": true,
      "criterio": "contact_id",
      "excecoes": ["admin_com_busca"]
    }
  },
  
  "permissoes_acoes_nexus": {
    // 93 flags de permissões granulares
    "podeVerTodasConversas": true,
    "podeEnviarMensagens": true,
    // ... (resto dos flags)
  },
  
  "diagnostico_nexus": {
    "ativo": false // Se true, loga decisões no console
  },
  
  // ─────────────────────────────────────────────────────
  // OUTRAS PERMISSÕES
  // ─────────────────────────────────────────────────────
  "paginas_acesso": [
    "Comunicacao",
    "Dashboard",
    "Clientes",
    "Vendedores"
  ],
  
  "max_concurrent_conversations": 5
}
```

---

## 🔐 CAMADA 1: VISIBILIDADE DE THREADS

### 📂 Arquivos Envolvidos:
1. `components/lib/threadVisibility.js` (lógica de negócio)
2. `pages/Comunicacao.jsx` (aplicação dos filtros - linha 1153-1594)

### 🎯 Hierarquia de Decisão (ordem de prioridade):

```javascript
// threadVisibility.js → baseVisibilityRule()
function baseVisibilityRule(usuario, thread) {
  
  // 1️⃣ ADMIN → VÊ TUDO (absoluto)
  if (usuario.role === 'admin') {
    return { visible: true, motivo: 'Admin tem acesso total' }
  }
  
  // 2️⃣ THREAD INTERNA → Só participantes veem
  if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
    return thread.participants?.includes(usuario.id)
  }
  
  // 3️⃣ THREAD ATRIBUÍDA ao usuário → VÊ
  if (
    thread.assigned_user_id === usuario.id ||
    thread.assigned_user_email === usuario.email ||
    thread.assigned_user_name === usuario.full_name
  ) {
    return { visible: true, motivo: 'Thread atribuída ao usuário' }
  }
  
  // 4️⃣ CONTATO FIDELIZADO ao usuário → VÊ (chave mestra)
  const camposFidelizacao = [
    'atendente_fidelizado_vendas',
    'atendente_fidelizado_assistencia',
    'atendente_fidelizado_financeiro',
    'atendente_fidelizado_fornecedor',
    'vendedor_responsavel'
  ]
  
  for (const campo of camposFidelizacao) {
    if (contato[campo] === usuario.id || 
        contato[campo] === usuario.email ||
        contato[campo] === usuario.full_name) {
      return { visible: true, motivo: `Fidelizado via ${campo}` }
    }
  }
  
  // 5️⃣ THREAD NÃO ATRIBUÍDA → VÊ (qualquer um pode assumir)
  if (!thread.assigned_user_id && !thread.assigned_user_email) {
    return { visible: true, motivo: 'Thread não atribuída (órfã)' }
  }
  
  // 6️⃣ GERENTE/COORDENADOR → VÊ TODAS do setor
  if (['gerente', 'coordenador'].includes(usuario.attendant_role)) {
    return { visible: true, motivo: 'Gerente/Coordenador - supervisão' }
  }
  
  // 7️⃣ JÁ INTERAGIU antes → VÊ
  // (verifica se enviou mensagem anteriormente)
  
  // 8️⃣ FALLBACK → NÃO VÊ
  return { visible: false, motivo: 'Sem permissão específica' }
}
```

### 📍 Filtros Adicionais (Comunicacao.jsx linha 1235-1437):

Após passar pela visibilidade base, aplicam-se **5 ESTÁGIOS**:

**ESTÁGIO 1: Verificação de Integração WhatsApp**
```javascript
// Comunicacao.jsx - linha 1235
// Bloqueia se usuário não tem can_view na integração da thread

const whatsappPerms = usuario.whatsapp_permissions || []
const perm = whatsappPerms.find(p => p.integration_id === thread.whatsapp_integration_id)

// ✅ REGRA NEXUS360: Se não tem permissões configuradas, LIBERA
if (whatsappPerms.length === 0) return true

// ❌ Se tem permissões mas can_view=false, BLOQUEIA
if (perm?.can_view === false) return false
```

**ESTÁGIO 2: Filtro de Escopo (UI)**
```javascript
// Comunicacao.jsx
if (filterScope === 'my') {
  // Mostrar só atribuídas + fidelizadas
}
if (filterScope === 'unassigned') {
  // Mostrar só não atribuídas
}
if (filterScope === 'all') {
  // Aplicar baseVisibilityRule()
}
```

**ESTÁGIO 3: Filtros de Categoria/Tipo/Tag**
```javascript
// selectedCategoria !== 'all' → filtra por etiqueta de mensagem
// selectedTipoContato !== 'all' → filtra por tipo do contato
// selectedTagContato !== 'all' → filtra por tag do contato
```

**ESTÁGIO 4: Busca por Texto**
```javascript
// Se tem termo de busca, aplica matchBuscaGoogle()
// Relaxa permissões (modal de bloqueio aparece ao clicar)
```

**ESTÁGIO 5: Deduplicação**
```javascript
// Comunicacao.jsx - linha 1139-1203
// REGRA: 1 thread por contato (contact_id)
// EXCEÇÃO: Admin + busca ativa → desativa dedup (vê duplicatas)
```

### 🔒 Tipos de Bloqueio (Camada 1):

| Situação | Bloqueio | Configurável? | Onde |
|----------|----------|---------------|------|
| Thread atribuída a outro | ✅ | ❌ Fixo | `threadVisibility.js:478` |
| Contato fidelizado a outro | ✅ | ❌ Fixo | `threadVisibility.js:456` |
| Integração sem can_view | ✅ | ✅ `User.whatsapp_permissions` | `threadVisibility.js:96-106` |
| Thread interna sem participação | ✅ | ❌ Fixo | `threadVisibility.js:349-373` |
| Setor bloqueado (Nexus360) | 🔜 | ✅ `User.configuracao_visibilidade_nexus` | `permissionsService.js:566-581` |

---

## 🚪 CAMADA 2: INTERAÇÃO (ENVIO DE MENSAGENS)

### 📂 Arquivo: `ChatWindow.jsx` (linha 165-450)

Esta camada decide **quem pode DIGITAR e ENVIAR** mensagens numa thread.

### 🎯 Hierarquia de Decisão (hardcoded):

```javascript
// ChatWindow.jsx → podeInteragirNaThread (useMemo)

const podeInteragirNaThread = React.useMemo(() => {
  
  // 🔴 BLOQUEIO 0: Sem usuário ou thread
  if (!usuario || !thread) return false
  
  // ✅ PRIORIDADE 1: ADMIN → PODE SEMPRE (absoluto)
  if (usuario.role === 'admin') {
    console.log('[PODE_INTERAGIR] ✅ Admin - LIBERADO')
    return true
  }
  
  // ✅ PRIORIDADE 2: Thread ATRIBUÍDA ao usuário → PODE
  const norm = (v) => String(v || '').toLowerCase().trim()
  const isAtribuidoAoUsuario = 
    norm(thread.assigned_user_id) === norm(usuario.id) ||
    norm(thread.assigned_user_email) === norm(usuario.email) ||
    norm(thread.assigned_user_name) === norm(usuario.full_name)
  
  if (isAtribuidoAoUsuario) {
    console.log('[PODE_INTERAGIR] ✅ Thread atribuída - LIBERADO')
    return true
  }
  
  // ✅ PRIORIDADE 3: Contato FIDELIZADO ao usuário → PODE (chave mestra)
  // ⚠️ CRÍTICO: Aguarda contato carregar antes de bloquear
  if (contatoCompleto) {
    const camposFidelizacao = [
      'atendente_fidelizado_vendas',
      'atendente_fidelizado_assistencia',
      'atendente_fidelizado_financeiro',
      'atendente_fidelizado_fornecedor',
      'vendedor_responsavel'
    ]
    
    for (const campo of camposFidelizacao) {
      const isFidelizado = 
        norm(contatoCompleto[campo]) === norm(usuario.id) ||
        norm(contatoCompleto[campo]) === norm(usuario.email) ||
        norm(contatoCompleto[campo]) === norm(usuario.full_name)
      
      if (isFidelizado) {
        console.log(`[PODE_INTERAGIR] ✅ Fidelizado (${campo}) - LIBERADO`)
        return true
      }
    }
  } else if (carregandoContato) {
    // ✅ FIX: Libera temporariamente enquanto contato carrega
    console.log('[PODE_INTERAGIR] ⏳ Contato carregando - liberando temp')
    return true
  }
  
  // ✅ PRIORIDADE 4: GERENTE/COORDENADOR → PODE SEMPRE
  // ✅ MODIFICAÇÃO RECENTE (2026-01-18): Mesmo após transferência
  const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuario.attendant_role)
  if (isGerente) {
    console.log('[PODE_INTERAGIR] ✅ Gerente - LIBERADO (mesmo após transferência)')
    return true
  }
  
  // ✅ PRIORIDADE 5: Thread NÃO ATRIBUÍDA → PODE (auto-atribui ao enviar)
  const isNaoAtribuida = 
    !thread.assigned_user_id && 
    !thread.assigned_user_name && 
    !thread.assigned_user_email
  
  if (isNaoAtribuida) {
    console.log('[PODE_INTERAGIR] ✅ Thread órfã - LIBERADO (auto-atribui)')
    return true
  }
  
  // 🔴 FALLBACK: BLOQUEADO
  console.log('[PODE_INTERAGIR] ❌ BLOQUEADO - Sem permissão')
  return false
  
}, [usuario, thread, contatoCompleto, carregandoContato])
```

### 🔒 Tipos de Bloqueio (Camada 2):

| Situação | Bloqueio | Mensagem na UI | Configurável? |
|----------|----------|----------------|---------------|
| Thread atribuída a outro | ✅ | "Sem permissão para enviar mensagens" | ❌ Fixo |
| Contato fidelizado a outro | ✅ | "Sem permissão para enviar mensagens" | ❌ Fixo |
| Sem role/setor/thread | ✅ | "Sem permissão para enviar mensagens" | ❌ Fixo |

**⚠️ IMPORTANTE:** Esta camada é **100% hardcoded** no `ChatWindow.jsx`. NÃO há campos no banco que controlem essa lógica.

---

## ⚡ CAMADA 3: FUNCIONALIDADES ESPECÍFICAS

### 📂 Arquivo: `ChatWindow.jsx` (linha 211-250)

Esta camada controla **botões e recursos específicos** dentro de uma conversa.

### 🎯 Lógica de Permissões:

```javascript
// ChatWindow.jsx (linha 211-250)

// 1. CARREGAR PERMISSÕES GERAIS DO USER
const permissoes = usuario?.permissoes_comunicacao || {}
const temPermissaoGeralEnvio = permissoes.pode_enviar_mensagens !== false
const temPermissaoGeralMidia = permissoes.pode_enviar_midias !== false
const temPermissaoGeralAudio = permissoes.pode_enviar_audios !== false
const podeApagarMensagens = permissoes.pode_apagar_mensagens === true

// 2. VERIFICAR PERMISSÕES POR INSTÂNCIA WHATSAPP
function getPermissaoInstancia(permissionKey) {
  if (usuario.role === 'admin') return true
  
  const whatsappPerms = usuario.whatsapp_permissions || []
  
  // ✅ NEXUS360: Default liberado se não há restrições
  if (whatsappPerms.length === 0) return true
  
  const perm = whatsappPerms.find(p => 
    p.integration_id === thread.whatsapp_integration_id
  )
  
  // ❌ Se tem permissão configurada, respeitar valor
  return perm ? perm[permissionKey] : false
}

const podeEnviarPorInstancia = getPermissaoInstancia('can_send')

// 3. COMBINAR TODAS AS CAMADAS (AND lógico)
const podeEnviarMensagens = 
  podeInteragirNaThread &&        // ✅ CAMADA 2
  temPermissaoGeralEnvio &&       // ✅ CAMADA 3
  podeEnviarPorInstancia          // ✅ CAMADA 1 (instância)

const podeEnviarMidias = 
  podeInteragirNaThread && 
  temPermissaoGeralMidia && 
  podeEnviarPorInstancia

const podeEnviarAudios = 
  podeInteragirNaThread && 
  temPermissaoGeralAudio && 
  podeEnviarPorInstancia
```

### 🎨 Efeitos na UI:

| Permissão | Efeito no ChatWindow | Linha |
|-----------|----------------------|-------|
| `podeEnviarMensagens = false` | Input de texto DESABILITADO + mensagem "Sem permissão" | 215-220 |
| `podeEnviarMidias = false` | Botão 📎 DESABILITADO | 225 |
| `podeEnviarAudios = false` | Botão 🎤 DESABILITADO | 226 |
| `podeApagarMensagens = false` | Botão de seleção DESABILITADO | 227 |

---

## 🔄 FLUXO COMPLETO: EXEMPLO PRÁTICO

### Cenário: Luiz (gerente/geral) tenta enviar mensagem para Tifhany (vendas)

```
┌─────────────────────────────────────────────────────────────┐
│ 1️⃣ CAMADA 1: Thread aparece na lista?                        │
└─────────────────────────────────────────────────────────────┘
  ↓
  Comunicacao.jsx executa:
  → baseVisibilityRule(luiz, thread_tifhany)
  → luiz.role === 'admin'? NÃO
  → thread.assigned_user_id === luiz.id? SIM ✅
  → RESULTADO: VISÍVEL
  
  ↓ Thread APARECE na lista
  
┌─────────────────────────────────────────────────────────────┐
│ 2️⃣ CAMADA 2: Pode enviar mensagem?                           │
└─────────────────────────────────────────────────────────────┘
  ↓
  ChatWindow.jsx executa:
  → podeInteragirNaThread (useMemo)
  → luiz.role === 'admin'? NÃO
  → thread.assigned_user_id === luiz.id? SIM ✅
  → RESULTADO: PODE INTERAGIR
  
  ↓ Input HABILITADO
  
┌─────────────────────────────────────────────────────────────┐
│ 3️⃣ CAMADA 3: Botões específicos habilitados?                │
└─────────────────────────────────────────────────────────────┘
  ↓
  ChatWindow.jsx calcula:
  → permissoes.pode_enviar_mensagens? SIM ✅
  → whatsappPerms.can_send? SIM ✅
  → podeEnviarMensagens = true AND true AND true = TRUE ✅
  
  ↓ Botão ENVIAR habilitado
  
┌─────────────────────────────────────────────────────────────┐
│ 4️⃣ BACKEND: Validação final                                 │
└─────────────────────────────────────────────────────────────┘
  ↓
  functions/enviarWhatsApp.js valida:
  → Token da integração válido?
  → Telefone formatado corretamente?
  → Rate limits OK?
  
  ↓ MENSAGEM ENVIADA ✅
```

---

## 🐛 PROBLEMA REPORTADO: "Contato Fica Preso"

### 📸 Screenshot Analisado:
```
Thread: Tifhany Santana
Status: "4 mensagens não lidas"
Setor transferido: → financeiro
Problema: "Sem permissão para enviar mensagens"
```

### 🔍 Análise do Log:
```
[WAPI] 📊 Diagnóstico Thread: {
  thread_id: "69667e0467f0b2064320fc7d",
  assigned_user_id: "68f952ffee1c76fe83e79840",  // ← Atribuída a usuário específico
  pre_atendimento_ativo: false,
  last_human_message_at: "2026-01-16T21:45:02.090Z",
  last_inbound_at: "2026-01-16T21:45:34.047Z",
  unread_count: 8
}
```

### 🎯 Causa Raiz Identificada:

**ANTES DA CORREÇÃO:**
```javascript
// ChatWindow.jsx - PRIORIDADE 3 (ANTES)
const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuario.attendant_role)
if (isGerente) {
  // ❌ PROBLEMA: Gerente bloqueado se thread atribuída a outro
  if (thread.assigned_user_id && !isAtribuidoAoUsuario) {
    return false // ❌ BLOQUEIO INCORRETO
  }
  return true
}
```

**DEPOIS DA CORREÇÃO (2026-01-18 18:45):**
```javascript
// ChatWindow.jsx - PRIORIDADE 4 (CORRIGIDO)
const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuario.attendant_role)
if (isGerente) {
  // ✅ GERENTES SEMPRE PODEM ENVIAR - mesmo se thread transferida
  return true
}
```

### ✅ Solução Aplicada:
- Gerentes/Coordenadores agora têm permissão **permanente** de envio
- Mesmo após transferir thread para outro setor/usuário, podem continuar respondendo
- Fix aplicado em `ChatWindow.jsx` linha 403

---

## 📊 MATRIZ DE CONFIGURAÇÃO vs FIXO

| Controle | Tipo | Configurável em | Afeta |
|----------|------|-----------------|-------|
| **role** | Fixo (escolha admin/user) | `Usuarios.jsx` → role | TODAS as camadas |
| **attendant_role** | Fixo (escolha nível) | `Usuarios.jsx` → attendant_role | Camada 2 (gerente override) |
| **attendant_sector** | Fixo (escolha setor) | `Usuarios.jsx` → attendant_sector | Camada 1 (filtro setor) |
| **permissoes_comunicacao** | ✅ Toggle ON/OFF | `PainelPermissoesUnificado.jsx` | Camada 3 (botões) |
| **whatsapp_permissions** | ✅ Checkboxes por integração | `PainelPermissoesUnificado.jsx` | Camada 1 + 3 (instância) |
| **Hierarquia de Prioridades** | ❌ Hardcoded | `ChatWindow.jsx` linha 165-450 | Camada 2 (interação) |
| **Fidelização** | ✅ Campo no Contact | `ContactInfoPanel.jsx` | Camada 1 + 2 (override) |
| **Deduplicação** | ✅ Futuramente | `Nexus360` (não implementado) | Camada 1 (lista) |

---

## 🎯 PRESETS DE PERMISSÕES (permissionsService.js)

Quando um usuário é criado/editado, o sistema aplica **presets automáticos** baseados no `attendant_role`:

```javascript
// permissionsService.js - PERMISSIONS_PRESETS

ADMIN → {
  podeVerTodasConversas: true,
  podeEnviarMensagens: true,
  podeEnviarMidias: true,
  podeEnviarAudios: true,
  podeApagarMensagens: true,
  podeTransferirConversa: true,
  podeGerenciarConexoes: true,
  // ... TUDO TRUE
}

GERENTE → {
  podeVerTodasConversas: true,        // ✅ Vê tudo
  podeEnviarMensagens: true,
  podeApagarMensagens: false,         // ❌ Não pode apagar
  podeGerenciarConexoes: false,       // ❌ Não configura WhatsApp
  podeGerenciarPermissoes: false,     // ❌ Não edita permissões
  // ...
}

COORDENADOR → {
  podeVerTodasConversas: true,
  podeEnviarMensagens: true,
  podeBloquearContato: false,         // ❌ Não bloqueia
  podeDeletarContato: false,          // ❌ Não deleta
  podeGerenciarConexoes: false,
  // ...
}

SENIOR → {
  podeVerTodasConversas: false,       // ❌ Só vê atribuídas
  podeEnviarMensagens: true,
  podeTransferirConversa: true,
  podeAtribuirConversas: true,        // ✅ Pode atribuir
  // ...
}

PLENO → {
  podeVerTodasConversas: false,
  podeEnviarMensagens: true,
  podeTransferirConversa: true,
  podeAtribuirConversas: false,       // ❌ Não pode atribuir
  // ...
}

JUNIOR → {
  podeVerTodasConversas: false,
  podeEnviarMensagens: true,
  podeEnviarAudios: false,            // ❌ Sem áudio
  podeTransferirConversa: false,      // ❌ Sem transferir
  podeEditarContato: false,           // ❌ Só leitura
  // ...
}
```

**⚠️ NOTA:** Esses presets estão **definidos no código** (`permissionsService.js`) mas **ainda não são aplicados automaticamente**. Por enquanto, as permissões são configuradas manualmente no `PainelPermissoesUnificado.jsx`.

---

## 🚀 AUTO-ATRIBUIÇÃO AO ENVIAR

### 📂 Arquivo: `ChatWindow.jsx` (linha 1043-1078)

Quando um atendente envia mensagem para thread **não atribuída**, o sistema **automaticamente atribui** a thread a ele.

```javascript
// ChatWindow.jsx → autoAtribuirThreadSeNecessario()

const autoAtribuirThreadSeNecessario = async (threadAtual) => {
  if (!threadAtual || !usuario) return
  
  const isThreadOrfa = !threadAtual.assigned_user_id && 
                       !threadAtual.assigned_user_email
  
  if (isThreadOrfa) {
    console.log('[CHAT] 🎯 Auto-atribuindo thread ao responder...')
    
    await base44.entities.MessageThread.update(threadAtual.id, {
      assigned_user_id: usuario.id,
      status: 'aberta'
    })
    
    // Registrar log de auditoria
    await base44.entities.AutomationLog.create({
      acao: 'auto_atribuicao_resposta',
      thread_id: threadAtual.id,
      usuario_id: usuario.id,
      resultado: 'sucesso',
      detalhes: {
        mensagem: 'Conversa auto-atribuída ao responder',
        atendente: usuario.full_name || usuario.email,
        trigger: 'primeira_resposta'
      }
    })
    
    return true
  }
  return false
}
```

**Onde é chamado:**
- Antes de enviar texto: linha 1298
- Antes de enviar imagem: linha 1456
- Antes de enviar áudio: linha 1654

---

## 🔧 FIDELIZAÇÃO DE CONTATOS

### 📂 Arquivos: `ContactInfoPanel.jsx` + `Contact` Entity

Fidelização é configurada **por contato** e funciona como **chave mestra** de permissões.

### 🎯 Campos de Fidelização (no Contact):

```javascript
// entities/Contact.json
{
  "is_cliente_fidelizado": true, // Flag geral
  
  // Atendentes fixos por setor
  "atendente_fidelizado_vendas": "user_id ou email",
  "atendente_fidelizado_assistencia": "user_id ou email",
  "atendente_fidelizado_financeiro": "user_id ou email",
  "atendente_fidelizado_fornecedor": "user_id ou email",
  
  // Campo legado (ainda suportado)
  "vendedor_responsavel": "user_id ou email"
}
```

### 🎯 Como Funciona:

1. Admin/atendente edita contato em `ContactInfoPanel.jsx`
2. Seleciona atendente fixo para cada setor
3. Campo é salvo no banco (ex: `atendente_fidelizado_vendas = "luiz@empresa.com"`)
4. **TODAS as threads** desse contato ficam acessíveis ao atendente fidelizado
5. **IGNORADO:** Atribuições, setores, integrações → Fidelização override tudo

### 🔑 Poder da Fidelização:

```javascript
// ChatWindow.jsx - linha 364-391
// Se QUALQUER campo de fidelização bater → LIBERADO TOTAL

const camposFidelizacao = [
  'atendente_fidelizado_vendas',
  'atendente_fidelizado_assistencia',
  'atendente_fidelizado_financeiro',
  'atendente_fidelizado_fornecedor',
  'vendedor_responsavel'
]

for (const campo of camposFidelizacao) {
  if (contato[campo] === usuario.id || 
      contato[campo] === usuario.email ||
      contato[campo] === usuario.full_name) {
    // ✅ CHAVE MESTRA: Ignora TUDO (atribuição, setor, integração)
    return true
  }
}
```

---

## 🎛️ COMO CONFIGURAR PERMISSÕES NA PRÁTICA

### Passo-a-Passo (Admin):

1. **Acessar:** `pages/Usuarios.jsx`
2. **Clicar:** No usuário desejado na tabela
3. **Editar Dados Básicos:**
   - `role`: admin (vê tudo) ou user (regras aplicam)
   - `attendant_role`: junior/pleno/senior/coordenador/gerente
   - `attendant_sector`: vendas/assistencia/financeiro/fornecedor/geral

4. **Configurar Permissões de Comunicação:**
   - Aba "Comunicação" em `PainelPermissoesUnificado`
   - Checkboxes:
     ```
     ✅ Pode enviar mensagens
     ✅ Pode enviar mídias
     ✅ Pode enviar áudios
     ❌ Pode apagar mensagens
     ✅ Pode transferir conversas
     ```

5. **Configurar Integrações WhatsApp:**
   - Aba "Conexões WhatsApp"
   - Por cada chip/conexão:
     ```
     Chip Vendas Principal
       ✅ Pode ver conversas (can_view)
       ✅ Pode enviar mensagens (can_send)
       ❌ Pode gerenciar conexão (can_manage)
     ```

6. **Salvar:** Botão "Salvar" atualiza banco de dados

7. **Resultado:** Permissões aplicadas INSTANTANEAMENTE (cache 5min)

---

## 📈 LOGS DE DEBUG

### Como Ativar:

```javascript
// No console do navegador:
localStorage.setItem('DEBUG_VIS', '1')
location.reload()
```

### O que Aparece:

```
[VISIBILIDADE] ✅ LIBERADO por FIDELIZAÇÃO (atendente_fidelizado_vendas) - Usuário: luiz@empresa.com
[PODE_INTERAGIR] ✅ Admin - LIBERADO
[PODE_INTERAGIR] ✅ Thread atribuída - LIBERADO
[PODE_INTERAGIR] ✅ Fidelizado (atendente_fidelizado_vendas) - LIBERADO
[PODE_INTERAGIR] ✅ Gerente - LIBERADO (mesmo após transferência)
[PODE_INTERAGIR] ❌ BLOQUEADO - Sem permissão
```

### Logs Disponíveis:

- `[VISIBILIDADE]` → Camada 1 (threadVisibility.js)
- `[PODE_INTERAGIR]` → Camada 2 (ChatWindow.jsx)
- `[COMUNICACAO]` → Filtragem de threads (Comunicacao.jsx)
- `window._logsFiltragem` → Array com logs de cada thread (linha 1454)
- `window._diagnosticoData` → Snapshot completo dos dados (linha 1572-1591)

---

## 🔗 REFERÊNCIAS RÁPIDAS

| Componente | Arquivo | Linhas Chave | Função |
|------------|---------|--------------|--------|
| **Tela de Config** | `pages/Usuarios.jsx` | 1-151 | Interface de gestão |
| **Painel de Perms** | `PainelPermissoesUnificado.jsx` | - | Checkboxes de config |
| **Visibilidade** | `threadVisibility.js` | 290-451 | Regras base |
| **Interação** | `ChatWindow.jsx` | 165-450 | podeInteragirNaThread |
| **Funcionalidades** | `ChatWindow.jsx` | 211-250 | Botões específicos |
| **Fidelização** | `ContactInfoPanel.jsx` | - | Edição de atendentes fixos |
| **Presets** | `permissionsService.js` | 17-155 | Templates de permissões |

---

## 🎯 CHECKLIST: VALIDAR PERMISSÕES

Quando usuário reporta "Sem permissão", verificar NESTA ORDEM:

- [ ] **1. Role:** É admin? Se sim, DEVE ter acesso
- [ ] **2. Thread Atribuída:** `assigned_user_id` bate com `usuario.id`?
- [ ] **3. Fidelização:** Contato tem campo `atendente_fidelizado_*` com ID/email do usuário?
- [ ] **4. Gerente:** `attendant_role` é gerente/coordenador? Deve poder SEMPRE
- [ ] **5. Thread Órfã:** `assigned_user_id` é null? Deve poder enviar
- [ ] **6. WhatsApp Permissions:** Array vazio OU `can_send=true` para integração?
- [ ] **7. Permissões Comunicação:** Campos `pode_enviar_*` são true?
- [ ] **8. Contato Carregado:** `contatoCompleto` existe? Ou está carregando?

---

**Fim do Documento**  
Última atualização: 2026-01-18 18:50 BRT  
Versão: 2.0 (Completa com UI de Config)