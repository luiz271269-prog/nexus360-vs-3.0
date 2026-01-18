# 🔐 ARQUITETURA COMPLETA DE PERMISSÕES - SISTEMA DE COMUNICAÇÃO

**Data:** 2026-01-18  
**Status:** Documentação Cirúrgica Completa

---

## 📊 VISÃO GERAL

O sistema de comunicação possui **3 CAMADAS** de controle de permissões que funcionam em conjunto:

```
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 1: VISIBILIDADE (Quem VÊ a thread?)                │
│  📍 Local: components/lib/threadVisibility.js              │
│  🎯 Aplicado em: Comunicacao.jsx (filtro de lista)         │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 2: INTERAÇÃO (Quem pode ENVIAR mensagens?)         │
│  📍 Local: ChatWindow.jsx → podeInteragirNaThread()         │
│  🎯 Aplicado em: ChatWindow.jsx (input de mensagem)        │
└─────────────────────────────────────────────────────────────┘
              ↓
┌─────────────────────────────────────────────────────────────┐
│  CAMADA 3: FUNCIONALIDADES (Mídia, Áudio, Apagar, etc.)    │
│  📍 Local: ChatWindow.jsx → permissoes.pode_*               │
│  🎯 Aplicado em: ChatWindow.jsx (botões específicos)       │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔍 CAMADA 1: VISIBILIDADE DE THREADS

### 📂 Arquivo: `components/lib/threadVisibility.js`

Esta camada determina **quais conversas aparecem na lista** para cada usuário.

### 🎯 Função Principal: `baseVisibilityRule(thread, usuario)`

**Regras Hierárquicas (ordem de prioridade):**

1. **Admin → VÊ TUDO**
   - `if (usuario.role === 'admin') return true`

2. **Thread ATRIBUÍDA ao usuário → VÊ**
   ```javascript
   assigned_user_id === usuario.id ||
   assigned_user_email === usuario.email ||
   assigned_user_name === usuario.full_name
   ```

3. **Contato FIDELIZADO ao usuário → VÊ**
   ```javascript
   // Verifica TODOS os campos de fidelização:
   - atendente_fidelizado_vendas
   - atendente_fidelizado_assistencia
   - atendente_fidelizado_financeiro
   - atendente_fidelizado_fornecedor
   - vendedor_responsavel
   ```

4. **Thread NÃO ATRIBUÍDA → VÊ** (qualquer um pode assumir)
   ```javascript
   !assigned_user_id && !assigned_user_email
   ```

5. **Gerente/Coordenador → VÊ TODAS do setor**
   ```javascript
   if (['gerente', 'coordenador'].includes(usuario.attendant_role))
   ```

6. **Thread teve interação do usuário → VÊ**
   ```javascript
   // Verifica mensagens enviadas anteriormente
   ```

7. **Fallback → NÃO VÊ**

### 🎯 Função: `filteredVisibilityRule(thread, usuario, filters)`

Aplica **5 ESTÁGIOS de filtros** sobre a visibilidade base:

**Estágio 1: Barreira de Segurança**
```javascript
// Threads internas: só participantes veem
if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
  return thread.participants?.includes(usuario.id)
}
```

**Estágio 2: Escopo (My Inbox vs All)**
```javascript
if (filters.scope === 'mine') {
  // Aplicar baseVisibilityRule()
}
if (filters.scope === 'all') {
  // Admin vê tudo, outros veem o que baseVisibilityRule permite
}
```

**Estágio 3: Filtro de Atribuição**
```javascript
if (filters.assignee) {
  // Filtrar por assigned_user_id/email/name
}
```

**Estágio 4: Filtro de Integração**
```javascript
if (filters.integration_id) {
  // Verificar permissões WhatsApp do usuário
  usuario.whatsapp_permissions.find(p => 
    p.integration_id === thread.whatsapp_integration_id &&
    p.can_view === true
  )
}
```

**Estágio 5: Filtros de Conexão e Setor**
```javascript
if (filters.connection_id) { /* verificar phone_number */ }
if (filters.sector_id) { /* verificar sector_id ou tags */ }
```

### 📍 Onde é Aplicado:
- **Comunicacao.jsx** (linha ~850-900)
- Filtra `allThreads` antes de exibir na lista

---

## 🔐 CAMADA 2: INTERAÇÃO (ENVIO DE MENSAGENS)

### 📂 Arquivo: `components/comunicacao/ChatWindow.jsx`

Esta camada determina **quem pode ENVIAR mensagens** numa thread específica.

### 🎯 Função: `podeInteragirNaThread` (useMemo)

**Regras Hierárquicas (ordem de prioridade):**

1. **Admin → PODE SEMPRE**
   ```javascript
   if (usuario.role === 'admin') return true
   ```

2. **Thread ATRIBUÍDA ao usuário → PODE**
   ```javascript
   // Normalização de identidade (case-insensitive, trim)
   norm(thread.assigned_user_id) === norm(usuario.id) ||
   norm(thread.assigned_user_email) === norm(usuario.email) ||
   norm(thread.assigned_user_name) === norm(usuario.full_name)
   ```

3. **Contato FIDELIZADO ao usuário → PODE**
   ```javascript
   // Verifica TODOS os campos de fidelização em TODOS os setores
   const camposFidelizacao = [
     'atendente_fidelizado_vendas',
     'atendente_fidelizado_assistencia',
     'atendente_fidelizado_financeiro',
     'atendente_fidelizado_fornecedor',
     'vendedor_responsavel'
   ]
   
   // Se QUALQUER campo bater → PODE
   ```

4. **Gerente/Coordenador → PODE SEMPRE** ✅ (MODIFICAÇÃO RECENTE)
   ```javascript
   const isGerente = ['gerente', 'coordenador', 'supervisor'].includes(usuario.attendant_role)
   if (isGerente) return true // ✅ LIBERADO - mesmo após transferência
   ```

5. **Thread NÃO ATRIBUÍDA → PODE** (auto-atribui ao enviar)
   ```javascript
   const isNaoAtribuida = !thread.assigned_user_id && 
                          !thread.assigned_user_name && 
                          !thread.assigned_user_email
   if (isNaoAtribuida) return true
   ```

6. **Fallback → NÃO PODE**
   - Thread atribuída a outro
   - Contato fidelizado a outro
   - Sem permissão específica

### 📍 Onde é Aplicado:
- **ChatWindow.jsx** (linha ~180)
- Usado para calcular `podeEnviarMensagens`
- Bloqueia input de mensagem se `false`

---

## ⚡ CAMADA 3: FUNCIONALIDADES ESPECÍFICAS

### 📂 Arquivo: `components/comunicacao/ChatWindow.jsx`

Esta camada controla **funcionalidades específicas** dentro de uma conversa.

### 🎯 Variáveis Calculadas:

```javascript
// 1. PERMISSÕES GERAIS (vêm do User)
const permissoes = usuario?.permissoes_comunicacao || {}
const temPermissaoGeralEnvio = permissoes.pode_enviar_mensagens !== false
const temPermissaoGeralMidia = permissoes.pode_enviar_midias !== false
const temPermissaoGeralAudio = permissoes.pode_enviar_audios !== false
const podeApagarMensagens = permissoes.pode_apagar_mensagens === true

// 2. PERMISSÕES POR INSTÂNCIA WHATSAPP
function getPermissaoInstancia(permissionKey) {
  if (usuario.role === 'admin') return true
  
  const whatsappPerms = usuario.whatsapp_permissions || []
  if (whatsappPerms.length === 0) return true // ✅ Padrão: liberado
  
  const perm = whatsappPerms.find(p => 
    p.integration_id === thread.whatsapp_integration_id
  )
  return perm ? perm[permissionKey] : false
}

const podeEnviarPorInstancia = getPermissaoInstancia('can_send')

// 3. PERMISSÕES FINAIS COMBINADAS
const podeEnviarMensagens = podeInteragirNaThread && 
                            temPermissaoGeralEnvio && 
                            podeEnviarPorInstancia

const podeEnviarMidias = podeInteragirNaThread && 
                         temPermissaoGeralMidia && 
                         podeEnviarPorInstancia

const podeEnviarAudios = podeInteragirNaThread && 
                         temPermissaoGeralAudio && 
                         podeEnviarPorInstancia
```

### 📊 Campos de Permissão no User:

**1. Permissões Gerais de Comunicação:**
```javascript
usuario.permissoes_comunicacao = {
  pode_enviar_mensagens: true/false,
  pode_enviar_midias: true/false,
  pode_enviar_audios: true/false,
  pode_apagar_mensagens: true/false,
  pode_transferir_conversas: true/false
}
```

**2. Permissões por Integração WhatsApp:**
```javascript
usuario.whatsapp_permissions = [
  {
    integration_id: "695f988cba647445cca9a6d2",
    can_view: true,    // Vê conversas desta instância
    can_send: true,    // Envia mensagens por esta instância
    can_manage: false  // Gerencia configurações
  }
]
```

### 📍 Onde é Aplicado:
- **ChatWindow.jsx** (linhas ~220-250)
- Controla visibilidade de botões:
  - `<Button disabled={!podeEnviarMensagens}>`
  - `<Paperclip disabled={!podeEnviarMidias} />`
  - `<Mic disabled={!podeEnviarAudios} />`

---

## 🚫 BLOQUEIOS FIXOS NO CÓDIGO

### ❌ Bloqueios que NÃO podem ser contornados:

1. **Threads Internas (team_internal/sector_group)**
   ```javascript
   // FIXO: Só participantes podem ver/enviar
   if (!thread.participants.includes(usuario.id)) return false
   ```

2. **Auto-Atribuição ao Enviar**
   ```javascript
   // FIXO: Thread órfã é atribuída ao primeiro que responder
   if (!thread.assigned_user_id) {
     await base44.entities.MessageThread.update(thread.id, {
       assigned_user_id: usuario.id
     })
   }
   ```

3. **Hierarquia Fixa de Prioridades**
   ```
   Admin > Atribuído > Fidelizado > Gerente > Não Atribuída > Bloqueado
   ```

4. **Normalização de Identidade**
   ```javascript
   // FIXO: Comparação case-insensitive + trim
   const norm = (v) => String(v || '').toLowerCase().trim()
   ```

---

## 🔄 FLUXO COMPLETO DE UMA AÇÃO

### Exemplo: Usuário tenta enviar mensagem

```
1️⃣ USUÁRIO CLICA NA THREAD
   ↓
   Comunicacao.jsx verifica:
   → filteredVisibilityRule(thread, usuario, filters)
   → Se FALSE: thread não aparece na lista
   ↓

2️⃣ THREAD APARECE, USUÁRIO ABRE CHAT
   ↓
   ChatWindow.jsx calcula:
   → podeInteragirNaThread (useMemo)
   → Se FALSE: input bloqueado, mensagem "Sem permissão"
   ↓

3️⃣ INPUT HABILITADO, USUÁRIO DIGITA
   ↓
   ChatWindow.jsx verifica:
   → podeEnviarMensagens (combinação de 3 checks)
   → podeEnviarMidias (se anexou arquivo)
   → Se FALSE: botão enviar desabilitado
   ↓

4️⃣ USUÁRIO CLICA EM ENVIAR
   ↓
   handleEnviarFromInput() executa:
   → autoAtribuirThreadSeNecessario(thread)
   → Atribui thread ao usuário se órfã
   → Envia mensagem via backend
   ↓

5️⃣ BACKEND (functions/enviarWhatsApp.js)
   ↓
   Valida novamente:
   → Token da integração
   → Telefone válido
   → Rate limits
   ↓

6️⃣ MENSAGEM ENVIADA ✅
```

---

## 🏗️ ONDE ESTÃO AS CONFIGURAÇÕES?

### 1. **Configurações Fixas no Código**
- ❌ **NÃO editáveis pelo admin**
- 📍 Localizadas em:
  - `ChatWindow.jsx` → lógica `podeInteragirNaThread`
  - `threadVisibility.js` → lógica de visibilidade
  - Hierarquia de prioridades hardcoded

### 2. **Configurações no User (Banco de Dados)**
- ✅ **Editáveis pelo admin**
- 📍 Gerenciadas em:
  - `pages/Usuarios.jsx` → tela de gestão
  - `components/usuarios/PainelPermissoesUnificado.jsx` → UI de permissões
- 📊 Campos:
  ```json
  {
    "role": "admin | user",
    "attendant_role": "junior | pleno | senior | coordenador | gerente",
    "attendant_sector": "vendas | assistencia | financeiro | fornecedor | geral",
    "permissoes_comunicacao": {
      "pode_enviar_mensagens": true,
      "pode_enviar_midias": true,
      "pode_enviar_audios": true,
      "pode_apagar_mensagens": false
    },
    "whatsapp_permissions": [
      {
        "integration_id": "xyz",
        "can_view": true,
        "can_send": true,
        "can_manage": false
      }
    ]
  }
  ```

### 3. **Configurações no Contact (Banco de Dados)**
- ✅ **Editáveis pelo admin/atendente**
- 📍 Gerenciadas em:
  - `components/comunicacao/ContactInfoPanel.jsx` → edição de contato
- 📊 Campos de Fidelização:
  ```json
  {
    "atendente_fidelizado_vendas": "user_id ou email",
    "atendente_fidelizado_assistencia": "user_id ou email",
    "atendente_fidelizado_financeiro": "user_id ou email",
    "atendente_fidelizado_fornecedor": "user_id ou email",
    "vendedor_responsavel": "user_id ou email"
  }
  ```

---

## 🐛 PROBLEMAS CONHECIDOS

### 1. **Contato "Preso" Após Transferência** ✅ CORRIGIDO
- **Causa:** Gerentes não podiam enviar após transferir thread
- **Fix:** Gerentes agora têm permissão permanente (PRIORIDADE 3)
- **Commit:** 2026-01-18 - linha 403 ChatWindow.jsx

### 2. **ReferenceError: Building2** ✅ CORRIGIDO
- **Causa:** Ícone inexistente importado do lucide-react
- **Fix:** Substituído `Building2` por `Building`
- **Commit:** 2026-01-18 - MessageBubble.jsx

### 3. **Visibilidade vs Interação Desalinhadas**
- **Status:** 🟡 EM MONITORAMENTO
- **Descrição:** Thread aparece na lista mas bloqueia envio
- **Causa Raiz:** Filtros diferentes em Camada 1 e 2
- **Solução Proposta:** Unificar lógica em um único módulo

---

## 📈 MÉTRICAS DE COMPLEXIDADE

```
Total de Arquivos Envolvidos: 6
Linhas de Código de Permissões: ~850
Pontos de Decisão: 47
Camadas de Validação: 3
Hierarquias de Prioridade: 2 (visibilidade + interação)
Campos de Configuração: 15+
```

---

## 🎯 RECOMENDAÇÕES

### ✅ Prioridade Alta
1. **Unificar Lógica de Permissões**
   - Criar módulo único `permissionsEngine.js`
   - Eliminar duplicação entre threadVisibility e ChatWindow

2. **Logs de Auditoria**
   - Registrar bloqueios de permissão
   - Facilitar debugging de "Sem permissão"

3. **UI de Feedback**
   - Mensagens claras sobre POR QUÊ foi bloqueado
   - Ex: "Thread atribuída a João" em vez de "Sem permissão"

### 🔄 Prioridade Média
4. **Testes Automatizados**
   - Criar suite de testes para cada camada
   - Validar hierarquias de prioridade

5. **Documentação In-App**
   - Tooltip explicando permissões ao hover
   - Guia interativo para admins

### 📊 Prioridade Baixa
6. **Painel de Permissões Avançado**
   - Visualizar matriz de permissões
   - Simular "o que usuário X vê?"

---

## 🔗 REFERÊNCIAS

- **Código Principal:** `ChatWindow.jsx` (linhas 165-450)
- **Visibilidade:** `threadVisibility.js` (arquivo completo)
- **Gestão de Usuários:** `Usuarios.jsx` + `PainelPermissoesUnificado.jsx`
- **Logs de Debug:** Search por `[VISIBILIDADE]` e `[PODE_INTERAGIR]`

---

**Fim do Documento**  
Última atualização: 2026-01-18 18:45 BRT