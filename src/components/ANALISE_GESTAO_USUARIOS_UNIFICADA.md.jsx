# 📊 ANÁLISE: Gestão de Usuários - Unificação Legado vs Nexus360

**Data:** 2026-01-15  
**Objetivo:** Substituir abas por layout de 2 colunas lado a lado para comparação direta

---

## 1️⃣ ESTADO ATUAL (3 Telas em Abas)

### 📍 Arquitetura Existente

**Componentes envolvidos:**
- `pages/Usuarios.js` → Página principal
- `components/usuarios/GerenciadorUsuariosUnificado` → Gerenciador com 3 colunas
- `components/usuarios/PainelPermissoesUnificado` → Aba Nexus360
- `components/usuarios/ConfiguracaoPermissoesWhatsApp` → Config WhatsApp (isolado)

**Estrutura de dados (User entity):**

```javascript
// ═══════════════════════════════════════════════════════════
// SISTEMA LEGADO (ATIVO)
// ═══════════════════════════════════════════════════════════
{
  // Dados básicos
  full_name: string,              // (readonly - do provedor login)
  display_name: string,            // ✅ editável pelo sistema
  email: string,
  role: 'admin' | 'user',
  is_active: boolean,
  
  // Atendimento WhatsApp
  is_whatsapp_attendant: boolean,
  attendant_sector: 'vendas' | 'assistencia' | 'financeiro' | 'fornecedor' | 'geral',
  attendant_role: 'junior' | 'pleno' | 'senior' | 'coordenador' | 'gerente',
  whatsapp_setores: string[],     // Setores que atende
  max_concurrent_conversations: number,
  
  // Permissões WhatsApp por conexão
  whatsapp_permissions: [
    {
      integration_id: string,
      integration_name: string,
      can_view: boolean,
      can_receive: boolean,
      can_send: boolean
    }
  ],
  
  // Permissões comunicação (simples)
  permissoes_comunicacao: {
    pode_transferir_conversas: boolean
  },
  
  // Acesso a páginas/recursos
  paginas_acesso: string[],       // ['Comunicacao', 'Dashboard', 'Clientes', ...]
  permissoes: string[]             // Alias de paginas_acesso no frontend
}

// ═══════════════════════════════════════════════════════════
// SISTEMA NEXUS360 (PREVIEW/NÃO ATIVO)
// ═══════════════════════════════════════════════════════════
{
  // Configuração de visibilidade (threads)
  configuracao_visibilidade_nexus: {
    modo_visibilidade: 'padrao_liberado' | 'padrao_bloqueado',
    
    regras_bloqueio: [
      {
        tipo: 'setor' | 'integracao' | 'canal',
        valores_bloqueados: string[],
        ativa: boolean,
        prioridade: number,
        descricao: string
      }
    ],
    
    regras_liberacao: [
      {
        tipo: 'janela_24h' | 'gerente_supervisao',
        ativa: boolean,
        prioridade: number,
        configuracao: {
          horas?: number,                  // para janela_24h
          minutos_sem_resposta?: number    // para gerente_supervisao
        }
      }
    ],
    
    deduplicacao: {
      ativa: boolean,
      criterio: 'contact_id',
      manter: 'mais_recente',
      excecoes: [...]
    }
  },
  
  // Permissões granulares de ações (18 flags)
  permissoes_acoes_nexus: {
    podeVerTodasConversas: boolean,
    podeEnviarMensagens: boolean,
    podeEnviarMidias: boolean,
    podeEnviarAudios: boolean,
    podeTransferirConversa: boolean,
    podeApagarMensagens: boolean,
    podeGerenciarFilas: boolean,
    podeAtribuirConversas: boolean,
    podeVerDetalhesContato: boolean,
    podeEditarContato: boolean,
    podeBloquearContato: boolean,
    podeDeletarContato: boolean,
    podeCriarPlaybooks: boolean,
    podeEditarPlaybooks: boolean,
    podeGerenciarConexoes: boolean,
    podeVerRelatorios: boolean,
    podeExportarDados: boolean,
    podeGerenciarPermissoes: boolean,
    podeVerDiagnosticos: boolean
  },
  
  // Diagnóstico avançado
  diagnostico_nexus: {
    ativo: boolean,
    log_level: 'info' | 'debug' | 'warn'
  }
}
```

---

## 2️⃣ PROBLEMA ATUAL

### ❌ Navegação em Abas Esconde Comparação

**Fluxo atual:**
1. Usuário seleciona uma pessoa
2. Clica na aba "Dados & Perfil" → edita dados básicos + WhatsApp legado
3. Clica na aba "Permissões Atuais" → vê resumo legado (não editável aqui)
4. Clica na aba "Nexus360 (Novo)" → configura regras Nexus, mas **não vê o legado**

**Consequências:**
- ⚠️ Impossível comparar lado a lado
- ⚠️ Usuário não entende as diferenças entre os sistemas
- ⚠️ Decisões são feitas "às cegas" (toggle entre sistemas sem ver diferenças)
- ⚠️ Configuração WhatsApp está misturada com dados básicos

---

## 3️⃣ PROPOSTA: TELA UNIFICADA - 2 COLUNAS LADO A LADO

### 🎯 Objetivo

**Uma tela onde:**
- Coluna ESQUERDA = Sistema LEGADO (atual, ativo)
- Coluna DIREITA = Sistema NEXUS360 (novo, preview)
- Toggle no topo: "🔴 Usar Legado" ◄─► "🟢 Usar Nexus360"
- Seções sincronizadas verticalmente para comparação

---

### 📐 Layout Proposto

```
┌──────────────────────────────────────────────────────────────────┐
│  👤 [Nome do Usuário] - [email@empresa.com]                      │
│                                                                   │
│  ┌─────────────────────────────────────────┐                     │
│  │ Sistema Ativo:  [●Legado] [○Nexus360]   │ ← Toggle principal  │
│  └─────────────────────────────────────────┘                     │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌───────────────────────────┬───────────────────────────────┐  │
│  │  📌 SISTEMA LEGADO        │  ⚡ SISTEMA NEXUS360         │  │
│  │  (Ativo até migração)     │  (Preview - Não afeta ainda) │  │
│  ├───────────────────────────┼───────────────────────────────┤  │
│  │                           │                               │  │
│  │ ══ DADOS BÁSICOS ══       │ ══ DADOS BÁSICOS ══           │  │
│  │ • Nome: [________]        │ • (mesmos campos)             │  │
│  │ • Email: [_______]        │ • (compartilhados)            │  │
│  │ • Setor: [Vendas ▼]       │                               │  │
│  │ • Função: [Pleno ▼]       │                               │  │
│  │ • Ativo: [✓]              │                               │  │
│  │                           │                               │  │
│  ├───────────────────────────┼───────────────────────────────┤  │
│  │                           │                               │  │
│  │ ══ COMUNICAÇÃO ══         │ ══ VISIBILIDADE ══            │  │
│  │                           │                               │  │
│  │ 📱 Atendente WhatsApp     │ 🎯 Modo Base                  │  │
│  │ • Habilitado: [✓]         │ • [●] Liberado por padrão     │  │
│  │                           │ • [○] Bloqueado por padrão    │  │
│  │ 🏢 Setores Atendidos      │                               │  │
│  │ • [✓] Vendas              │ 🚫 Bloqueios Explícitos       │  │
│  │ • [ ] Assistência         │ • [+] Bloquear Setor          │  │
│  │ • [✓] Financeiro          │   - Setor: Assistência        │  │
│  │                           │   - [Ativa ✓] [Remover ×]     │  │
│  │ 📞 Conexões WhatsApp      │ • [+] Bloquear Integração     │  │
│  │                           │   - Int: #6820 (Vendas)       │  │
│  │ ┌─────────────────────┐   │   - [Ativa ✓] [Remover ×]     │  │
│  │ │ Vendas Principal    │   │                               │  │
│  │ │ #5548999322400      │   │ ✅ Liberações Especiais       │  │
│  │ │ [✓Ver][✓Rec][✓Env] │   │ • [+] Janela 24h              │  │
│  │ └─────────────────────┘   │   - Janela: 24 horas          │  │
│  │                           │   - [Ativa ✓] [Remover ×]     │  │
│  │ ┌─────────────────────┐   │ • [+] Supervisão Gerencial    │  │
│  │ │ Suporte Geral       │   │   - Tempo: 30 minutos         │  │
│  │ │ #5548988776655      │   │   - [Ativa ✓] [Remover ×]     │  │
│  │ │ [ Ver][ Rec][✓Env] │   │                               │  │
│  │ └─────────────────────┘   │                               │  │
│  │                           │                               │  │
│  │ 🎯 Capacidades            │                               │  │
│  │ • Máx conversas: [5__]    │                               │  │
│  │ • Transferir: [✓]         │                               │  │
│  │                           │                               │  │
│  ├───────────────────────────┼───────────────────────────────┤  │
│  │                           │                               │  │
│  │ ══ PERMISSÕES PÁGINAS ══  │ ══ AÇÕES GRANULARES ══        │  │
│  │                           │                               │  │
│  │ 📄 Páginas Acessíveis     │ 🔐 Permissões Detalhadas      │  │
│  │ • [✓] Comunicacao         │                               │  │
│  │ • [✓] Dashboard           │ ┌─ Conversas ─────────────┐   │  │
│  │ • [✓] Clientes            │ │ [✓] Ver todas conversas  │   │  │
│  │ • [ ] Vendedores          │ │ [✓] Enviar mensagens     │   │  │
│  │ • [✓] Produtos            │ │ [✓] Enviar mídias        │   │  │
│  │ • [✓] Agenda              │ │ [✓] Enviar áudios        │   │  │
│  │ • [ ] Importacao          │ │ [✓] Transferir conversa  │   │  │
│  │ • [ ] Usuarios            │ │ [ ] Apagar mensagens     │   │  │
│  │ • [ ] Auditoria           │ └─────────────────────────┘   │  │
│  │                           │                               │  │
│  │ 🚀 Perfis Rápidos         │ ┌─ Contatos ───────────────┐  │  │
│  │ [Admin] [Gerente]         │ │ [✓] Ver detalhes contato │  │  │
│  │ [Vendedor] [Suporte]      │ │ [✓] Editar contato       │  │  │
│  │                           │ │ [ ] Bloquear contato     │  │  │
│  │                           │ │ [ ] Deletar contato      │  │  │
│  │                           │ └─────────────────────────┘   │  │
│  │                           │                               │  │
│  │                           │ ┌─ Gestão ─────────────────┐  │  │
│  │                           │ │ [✓] Gerenciar filas      │  │  │
│  │                           │ │ [✓] Atribuir conversas   │  │  │
│  │                           │ │ [ ] Criar playbooks      │  │  │
│  │                           │ │ [ ] Editar playbooks     │  │  │
│  │                           │ │ [ ] Gerenciar conexões   │  │  │
│  │                           │ └─────────────────────────┘   │  │
│  │                           │                               │  │
│  │                           │ ┌─ Admin ──────────────────┐  │  │
│  │                           │ │ [ ] Ver relatórios       │  │  │
│  │                           │ │ [ ] Exportar dados       │  │  │
│  │                           │ │ [ ] Ger. permissões      │  │  │
│  │                           │ │ [ ] Ver diagnósticos     │  │  │
│  │                           │ └─────────────────────────┘   │  │
│  │                           │                               │  │
│  │                           │ 🎨 Perfis Rápidos Nexus       │  │
│  │                           │ [Admin] [Gerente]             │  │
│  │                           │ [Coord.] [Senior]             │  │
│  │                           │ [Pleno] [Junior]              │  │
│  │                           │                               │  │
│  ├───────────────────────────┼───────────────────────────────┤  │
│  │                           │                               │  │
│  │ ══ RESUMO ══              │ ══ PREVIEW PROCESSADO ══      │  │
│  │                           │                               │  │
│  │ ✅ Permissões ativas: 8   │ 🎯 Bloqueios: 2 ativos        │  │
│  │ 📱 WhatsApp: Sim          │ 🔓 Liberações: 1 ativa        │  │
│  │ 📞 Conexões: 2            │ ⚙️ Ações permitidas: 12/19    │  │
│  │ 📄 Páginas: 6             │ 🔍 Diagnóstico: Desativado    │  │
│  │                           │                               │  │
│  └───────────────────────────┴───────────────────────────────┘  │
│                                                                   │
│  ┌─────────────────┐  ┌─────────────────────────────────────┐   │
│  │ [💾 Salvar      │  │ [🚀 Salvar Nexus360]  [Migrar →]   │   │
│  │     Legado]     │  │                                      │   │
│  └─────────────────┘  └─────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

---

## 2️⃣ MAPEAMENTO DE FUNCIONALIDADES

### 📋 SEÇÃO 1: Dados Básicos (COMPARTILHADO)

**Campos únicos** (aparecem apenas 1 vez, não duplicados):
- Nome (`display_name`) → Input
- Email (`email`) → Input (readonly se não isNovo)
- Setor (`attendant_sector`) → Select
- Função (`attendant_role`) → Select
- Status (`is_active`) → Switch
- Tipo Acesso (`role`) → Select [admin/user]

> **Decisão:** Esses campos ficam FORA das colunas, no topo da tela  
> **Razão:** São independentes do sistema de permissões usado

---

### 📱 SEÇÃO 2A: COMUNICAÇÃO (Coluna LEGADO)

**Configuração WhatsApp Atual:**

```javascript
// Toggle principal
is_whatsapp_attendant: boolean

// SE habilitado:
whatsapp_setores: string[]              // Checkboxes: vendas, assistencia, etc.
max_concurrent_conversations: number    // Input numérico
permissoes_comunicacao.pode_transferir_conversas: boolean

// POR CADA WhatsAppIntegration:
whatsapp_permissions: [
  {
    integration_id: "abc123",
    can_view: boolean,      // Switch
    can_receive: boolean,   // Switch
    can_send: boolean       // Switch
  }
]
```

**Renderização:**
- Card por integração
- 3 switches inline: Ver | Receber | Enviar
- Setores atendidos como badges clicáveis

---

### 🔒 SEÇÃO 2B: VISIBILIDADE (Coluna NEXUS360)

**Configuração Nexus360:**

```javascript
configuracao_visibilidade_nexus: {
  // Radio principal
  modo_visibilidade: 'padrao_liberado' | 'padrao_bloqueado',
  
  // Lista dinâmica
  regras_bloqueio: [
    {
      tipo: 'setor',
      valores_bloqueados: ['assistencia'],
      ativa: true,
      descricao: ''
    },
    {
      tipo: 'integracao',
      valores_bloqueados: ['integration-xyz'],
      ativa: true
    }
  ],
  
  // Lista dinâmica
  regras_liberacao: [
    {
      tipo: 'janela_24h',
      configuracao: { horas: 24 },
      ativa: true
    },
    {
      tipo: 'gerente_supervisao',
      configuracao: { minutos_sem_resposta: 30 },
      ativa: true
    }
  ]
}
```

**Renderização:**
- Radio: Liberado/Bloqueado
- Botões: [+ Bloquear Setor] [+ Bloquear Integração] [+ Bloquear Canal]
- Cards colapsáveis por regra (com switches ativa/inativa e botão remover)
- Botões: [+ Janela 24h] [+ Supervisão Gerencial]
- Inputs dinâmicos (horas, minutos)

---

### 🔑 SEÇÃO 3A: PERMISSÕES PÁGINAS (Coluna LEGADO)

**Array simples de strings:**

```javascript
paginas_acesso: [
  'Comunicacao',
  'Dashboard', 
  'Clientes',
  'Produtos',
  'Agenda'
]
```

**Renderização:**
- Checkboxes por página/recurso do menu
- Botões de perfil rápido: [Admin] [Gerente] [Vendedor] [Suporte]

---

### 🎯 SEÇÃO 3B: AÇÕES GRANULARES (Coluna NEXUS360)

**Objeto com 19 flags booleanas:**

```javascript
permissoes_acoes_nexus: {
  // Conversas
  podeVerTodasConversas: true,
  podeEnviarMensagens: true,
  podeEnviarMidias: true,
  podeEnviarAudios: true,
  podeTransferirConversa: true,
  podeApagarMensagens: false,
  
  // Contatos
  podeVerDetalhesContato: true,
  podeEditarContato: true,
  podeBloquearContato: false,
  podeDeletarContato: false,
  
  // Gestão
  podeGerenciarFilas: true,
  podeAtribuirConversas: true,
  podeCriarPlaybooks: false,
  podeEditarPlaybooks: false,
  podeGerenciarConexoes: false,
  
  // Admin
  podeVerRelatorios: true,
  podeExportarDados: false,
  podeGerenciarPermissoes: false,
  podeVerDiagnosticos: false
}
```

**Renderização:**
- Grupos colapsáveis:
  - ▼ Conversas (6 switches)
  - ▼ Contatos (4 switches)
  - ▼ Gestão (5 switches)
  - ▼ Admin (4 switches)
- Botões de perfil rápido Nexus: [Admin] [Gerente] [Coordenador] [Senior] [Pleno] [Junior]

---

## 4️⃣ ARQUITETURA DO COMPONENTE UNIFICADO

### 📦 Novo Componente

**Nome:** `GerenciadorUsuariosComparativo.jsx`

**Props:**
```javascript
{
  usuario: User,              // Usuário selecionado
  integracoes: WhatsAppIntegration[],
  onSalvarLegado: (userId, dadosLegado) => Promise<void>,
  onSalvarNexus: (userId, dadosNexus) => Promise<void>,
  onToggleSistema: (userId, sistemaAtivo: 'legado' | 'nexus360') => Promise<void>
}
```

**State interno:**
```javascript
const [dadosBasicos, setDadosBasicos] = useState({
  nome: '',
  email: '',
  setor: 'geral',
  funcao: 'pleno',
  ativo: true,
  tipoAcesso: 'user'
});

const [configLegado, setConfigLegado] = useState({
  is_whatsapp_attendant: false,
  whatsapp_setores: [],
  whatsapp_permissions: [],
  permissoes_comunicacao: {},
  paginas_acesso: [],
  max_concurrent_conversations: 5
});

const [configNexus, setConfigNexus] = useState({
  configuracao_visibilidade_nexus: {
    modo_visibilidade: 'padrao_liberado',
    regras_bloqueio: [],
    regras_liberacao: []
  },
  permissoes_acoes_nexus: {},
  diagnostico_nexus: { ativo: false, log_level: 'info' }
});

const [sistemaAtivo, setSistemaAtivo] = useState('legado'); // ou 'nexus360'
```

---

## 5️⃣ LÓGICA DE FUNCIONAMENTO

### 🔄 Toggle Sistema Ativo

```javascript
const handleToggleSistema = async (novoSistema) => {
  const confirmar = window.confirm(
    `⚠️ ALTERAÇÃO DE SISTEMA\n\n` +
    `Mudar de "${sistemaAtivo}" para "${novoSistema}"?\n\n` +
    `Isso afetará como as threads são filtradas e exibidas para este usuário.\n\n` +
    `Continue?`
  );
  
  if (!confirmar) return;
  
  await onToggleSistema(usuario.id, novoSistema);
  setSistemaAtivo(novoSistema);
  toast.success(`Sistema alterado para ${novoSistema}`);
};
```

**Campo no banco:**
```javascript
// Adicionar ao User entity
{
  sistema_permissoes_ativo: 'legado' | 'nexus360'  // Default: 'legado'
}
```

---

### 💾 Salvamento Independente

**Botão "Salvar Legado":**
```javascript
const handleSalvarLegado = async () => {
  await onSalvarLegado(usuario.id, {
    display_name: dadosBasicos.nome,
    attendant_sector: dadosBasicos.setor,
    attendant_role: dadosBasicos.funcao,
    is_active: dadosBasicos.ativo,
    role: dadosBasicos.tipoAcesso,
    ...configLegado
  });
};
```

**Botão "Salvar Nexus360":**
```javascript
const handleSalvarNexus = async () => {
  await onSalvarNexus(usuario.id, {
    ...configNexus
  });
};
```

**Botão "Migrar →":**
```javascript
// Converter automaticamente permissões legado → nexus360
const handleMigrar = async () => {
  const configConvertida = buildPolicyFromLegacyUser(usuario);
  setConfigNexus(prev => ({ ...prev, ...configConvertida }));
  toast.success('Configuração Nexus360 gerada a partir do perfil legado');
};
```

---

## 6️⃣ COMPONENTES REUTILIZÁVEIS

### 🧩 Subcomponentes Necessários

#### A) `SecaoDadosBasicos.jsx`
```javascript
// Campos compartilhados (fora das colunas)
- Input nome
- Input email (readonly se existente)
- Select setor
- Select função
- Switch ativo
- Select tipoAcesso
```

#### B) `ColunaComunicacaoLegado.jsx`
```javascript
// Coluna esquerda - WhatsApp atual
- Switch is_whatsapp_attendant
- Badges setores (clicáveis)
- Input max_concurrent_conversations
- Switch pode_transferir_conversas
- Cards por integração com 3 switches
```

#### C) `ColunaVisibilidadeNexus.jsx`
```javascript
// Coluna direita - Visibilidade Nexus
- Radio modo_visibilidade
- Seção "Bloqueios":
  - Botões [+ Setor] [+ Integração] [+ Canal]
  - Cards dinâmicos por regra
- Seção "Liberações":
  - Botões [+ Janela 24h] [+ Supervisão]
  - Cards dinâmicos com inputs configuração
```

#### D) `ColunaPermissoesPaginasLegado.jsx`
```javascript
// Coluna esquerda - Páginas
- Checkboxes por página
- Grid de perfis rápidos
```

#### E) `ColunaAcoesNexus.jsx`
```javascript
// Coluna direita - Ações granulares
- Grupos colapsáveis:
  - Conversas (6 flags)
  - Contatos (4 flags)
  - Gestão (5 flags)
  - Admin (4 flags)
- Grid de perfis Nexus
```

---

## 7️⃣ FLUXO DE DADOS

### 🔄 Carregamento Inicial

```javascript
useEffect(() => {
  if (!usuario) return;
  
  // Dados básicos (compartilhados)
  setDadosBasicos({
    nome: usuario.display_name || usuario.full_name || '',
    email: usuario.email || '',
    setor: usuario.attendant_sector || 'geral',
    funcao: usuario.attendant_role || 'pleno',
    ativo: usuario.is_active !== false,
    tipoAcesso: usuario.role || 'user'
  });
  
  // Config Legado
  setConfigLegado({
    is_whatsapp_attendant: usuario.is_whatsapp_attendant || false,
    whatsapp_setores: usuario.whatsapp_setores || [],
    whatsapp_permissions: usuario.whatsapp_permissions || [],
    permissoes_comunicacao: usuario.permissoes_comunicacao || {},
    paginas_acesso: usuario.paginas_acesso || [],
    max_concurrent_conversations: usuario.max_concurrent_conversations || 5
  });
  
  // Config Nexus
  setConfigNexus({
    configuracao_visibilidade_nexus: usuario.configuracao_visibilidade_nexus || {
      modo_visibilidade: 'padrao_liberado',
      regras_bloqueio: [],
      regras_liberacao: []
    },
    permissoes_acoes_nexus: usuario.permissoes_acoes_nexus || {},
    diagnostico_nexus: usuario.diagnostico_nexus || { ativo: false }
  });
  
  // Sistema ativo
  setSistemaAtivo(usuario.sistema_permissoes_ativo || 'legado');
}, [usuario]);
```

---

### ✍️ Edição e Auto-Save

**Dados básicos:**
```javascript
// Auto-save imediato (compartilhado)
const handleChangeDadosBasicos = (campo, valor) => {
  setDadosBasicos(prev => ({ ...prev, [campo]: valor }));
  
  // Salvar no banco (debounced)
  debounceSave({
    display_name: campo === 'nome' ? valor : dadosBasicos.nome,
    attendant_sector: campo === 'setor' ? valor : dadosBasicos.setor,
    // ...
  });
};
```

**Config Legado:**
```javascript
// Salvar apenas quando clica no botão "Salvar Legado"
const handleChangeLegado = (campo, valor) => {
  setConfigLegado(prev => ({ ...prev, [campo]: valor }));
  // NÃO auto-save - aguarda clique no botão
};
```

**Config Nexus:**
```javascript
// Salvar apenas quando clica no botão "Salvar Nexus360"
const handleChangeNexus = (campo, valor) => {
  setConfigNexus(prev => ({ ...prev, [campo]: valor }));
  // NÃO auto-save - aguarda clique no botão
};
```

---

## 8️⃣ COMPARAÇÃO VISUAL

### 🎨 Elementos de UI

| Recurso | Legado | Nexus360 |
|---------|--------|----------|
| **WhatsApp Habilitado** | Switch `is_whatsapp_attendant` | Implícito (regras definem) |
| **Setores Atendidos** | Checkboxes multi-select | Regras de bloqueio/liberação por setor |
| **Conexões Permitidas** | 3 switches por integração | Regras de bloqueio de integração |
| **Permissões Páginas** | Array `paginas_acesso` | (Nexus não mexe nisso - separado) |
| **Ações Granulares** | 1 flag `pode_transferir_conversas` | 19 flags em `permissoes_acoes_nexus` |
| **Visibilidade Threads** | Lógica hardcoded `threadVisibility.js` | Motor de decisão Nexus360 |

---

### 🔍 Indicadores de Divergência

**Quando legado ≠ nexus:**
```javascript
// Exemplo: Legado permite Assistência, mas Nexus bloqueia

{/* Badge de alerta */}
<Badge className="bg-red-500 text-white">
  <AlertTriangle className="w-3 h-3 mr-1" />
  Divergência detectada
</Badge>

{/* Tooltip explicando */}
<Tooltip>
  <p>Sistema Legado: Assistência permitida</p>
  <p>Sistema Nexus360: Assistência bloqueada (regra #2)</p>
</Tooltip>
```

---

## 9️⃣ MIGRAÇÃO AUTOMÁTICA

### 🤖 Função de Conversão

**Arquivo:** `components/lib/nexusLegacyConverter.js` (JÁ EXISTE)

```javascript
export function buildPolicyFromLegacyUser(usuario) {
  // Gera configuração Nexus360 baseada no perfil legado
  
  return {
    configuracao_visibilidade_nexus: {
      modo_visibilidade: 'padrao_liberado',
      regras_bloqueio: [...], // Inferido de whatsapp_permissions
      regras_liberacao: [...]  // Inferido de attendant_role
    },
    permissoes_acoes_nexus: {...} // Inferido de permissoes_comunicacao + paginas_acesso
  };
}
```

**Uso na UI:**
```javascript
<Button onClick={handleMigrar} className="bg-indigo-600">
  🔄 Migrar Configuração Legado → Nexus360
</Button>
```

---

## 🔟 VANTAGENS DA NOVA ARQUITETURA

### ✅ Benefícios

1. **Comparação Visual Direta**
   - Ver legado e Nexus lado a lado
   - Identificar divergências antes de ativar
   - Entender diferenças conceituais

2. **Migração Segura**
   - Testar Nexus sem afetar produção
   - Rollback instantâneo (toggle)
   - Validação em shadow mode

3. **Eficiência Operacional**
   - Uma tela, sem navegação entre abas
   - Scroll sincronizado verticalmente
   - Decisões mais rápidas

4. **Educação do Usuário**
   - Entender diferença "setores atendidos" (legado) vs "bloqueios de setor" (nexus)
   - Ver como permissões granulares substituem arrays simples

5. **Flexibilidade**
   - Manter legado ativo enquanto testa Nexus
   - Editar ambas configurações sem conflito
   - Perfis rápidos em ambos sistemas

---

## 1️⃣1️⃣ PLANO DE IMPLEMENTAÇÃO

### 📅 Fases

#### Fase 1: Estrutura Base (30min)
- Criar `GerenciadorUsuariosComparativo.jsx`
- Layout 2 colunas responsivo
- Migrar `SecaoDadosBasicos` (compartilhado)
- Toggle sistema ativo no header

#### Fase 2: Coluna Legado (45min)
- `ColunaComunicacaoLegado.jsx`
  - WhatsApp habilitado
  - Setores atendidos
  - Cards de integração (3 switches)
  - Capacidade conversas
- `ColunaPermissoesPaginasLegado.jsx`
  - Checkboxes páginas
  - Perfis rápidos

#### Fase 3: Coluna Nexus (60min)
- `ColunaVisibilidadeNexus.jsx`
  - Radio modo base
  - Seção bloqueios dinâmica
  - Seção liberações dinâmica
- `ColunaAcoesNexus.jsx`
  - Grupos colapsáveis (4 seções)
  - Perfis rápidos Nexus

#### Fase 4: Integração (30min)
- Conectar saves aos handlers da página `Usuarios.js`
- Adicionar campo `sistema_permissoes_ativo` ao User entity
- Testar fluxo completo

#### Fase 5: UX e Polish (20min)
- Badges de divergência
- Tooltips explicativos
- Scroll sincronizado
- Loading states

**Tempo total estimado:** ~3 horas

---

## 1️⃣2️⃣ CONSIDERAÇÕES TÉCNICAS

### ⚙️ Performance

- Uso de `useMemo` para cálculos de divergência
- Debounce em dados básicos (1.2s)
- Save explícito para configs (botões)

### 🔒 Segurança

- Validar `role === 'admin'` antes de permitir toggle sistema
- Exibir alerta se divergências críticas forem detectadas
- Prevenir ativação Nexus se há falsos negativos

### 📱 Responsividade

- Desktop: 2 colunas lado a lado (50/50)
- Tablet: 2 colunas estreitas (scroll horizontal)
- Mobile: Colapsar em tabs (fallback)

---

## 1️⃣3️⃣ CAMPOS ADICIONAIS NECESSÁRIOS

### 🗃️ User Entity

**Adicionar:**
```json
{
  "sistema_permissoes_ativo": {
    "type": "string",
    "enum": ["legado", "nexus360"],
    "default": "legado",
    "description": "Define qual sistema de permissões está ativo para este usuário"
  }
}
```

**Justificativa:**
- Permite transição gradual (alguns usuários em legado, outros em Nexus)
- A/B testing em produção
- Rollback individual se um usuário tiver problemas

---

## 1️⃣4️⃣ EXEMPLO DE USO

### 🎬 Cenário: Gerente de Vendas

**Configuração Legado:**
```javascript
{
  attendant_sector: 'vendas',
  attendant_role: 'gerente',
  is_whatsapp_attendant: true,
  whatsapp_setores: ['vendas', 'geral'],
  whatsapp_permissions: [
    { integration_id: 'vendas-principal', can_view: true, can_receive: true, can_send: true },
    { integration_id: 'suporte-geral', can_view: true, can_receive: false, can_send: true }
  ],
  paginas_acesso: ['Comunicacao', 'Dashboard', 'Clientes', 'Vendedores', 'Produtos']
}
```

**Equivalente Nexus360:**
```javascript
{
  configuracao_visibilidade_nexus: {
    modo_visibilidade: 'padrao_liberado',
    regras_bloqueio: [
      {
        tipo: 'setor',
        valores_bloqueados: ['assistencia', 'financeiro', 'fornecedor'],
        ativa: true
      }
    ],
    regras_liberacao: [
      {
        tipo: 'gerente_supervisao',
        configuracao: { minutos_sem_resposta: 30 },
        ativa: true
      }
    ]
  },
  permissoes_acoes_nexus: {
    podeVerTodasConversas: false,        // Gerente vê apenas seu setor (+ supervisão)
    podeEnviarMensagens: true,
    podeEnviarMidias: true,
    podeEnviarAudios: true,
    podeTransferirConversa: true,
    podeApagarMensagens: false,
    podeGerenciarFilas: true,
    podeAtribuirConversas: true,
    podeVerDetalhesContato: true,
    podeEditarContato: true,
    podeBloquearContato: true,
    podeDeletarContato: false,
    podeCriarPlaybooks: true,
    podeEditarPlaybooks: true,
    podeGerenciarConexoes: false,
    podeVerRelatorios: true,
    podeExportarDados: true,
    podeGerenciarPermissoes: false,
    podeVerDiagnosticos: true
  }
}
```

**Na tela unificada, o usuário verá:**

| Legado (Esquerda) | Nexus360 (Direita) |
|-------------------|-------------------|
| ✓ WhatsApp habilitado | (Implícito) |
| Setores: Vendas, Geral | Bloqueios: Assistência, Financeiro, Fornecedor |
| Conexão Vendas: Ver✓ Rec✓ Env✓ | (Sem bloqueio de integração) |
| Conexão Suporte: Ver✓ Rec✗ Env✓ | (Nexus: Ver/Enviar controlado por ações) |
| Páginas: 5 selecionadas | Ações: 13/19 permitidas |
| Transferir: ✓ | Transferir: ✓ (granular) |

**Divergências detectadas:**
- ⚠️ Legado permite receber de "Suporte Geral", mas Nexus não define flag `podeReceberSuporte` específica
- ⚠️ Páginas vs Ações: conceitos diferentes (Nexus não substitui `paginas_acesso`)

---

## 1️⃣5️⃣ CAMPOS QUE PERMANECEM DUPLICADOS

### 🔀 Legado E Nexus Coexistem

**Importante:** Nexus360 NÃO substitui completamente o legado. Alguns campos são exclusivos:

| Campo | Sistema | Uso |
|-------|---------|-----|
| `paginas_acesso` | Legado | Controle menu lateral (não mexer) |
| `whatsapp_permissions` | Legado | Controle conexões (pode ser substituído) |
| `configuracao_visibilidade_nexus` | Nexus | Motor visibilidade threads |
| `permissoes_acoes_nexus` | Nexus | Controle ações comunicação |

**Decisão de arquitetura:**
- Durante transição: AMBOS sistemas salvos no banco
- Campo `sistema_permissoes_ativo` define qual é usado na runtime
- Após 100% migrado: remover campos legado (futuro)

---

## 1️⃣6️⃣ VALIDAÇÕES NECESSÁRIAS

### ✅ Regras de Negócio

1. **Não pode desativar último admin:**
   ```javascript
   if (usuario.role === 'admin' && !dadosBasicos.ativo) {
     const outrosAdmins = usuarios.filter(u => u.id !== usuario.id && u.role === 'admin' && u.ativo);
     if (outrosAdmins.length === 0) {
       toast.error('Não é possível desativar o último administrador');
       return;
     }
   }
   ```

2. **Nexus360 requer ao menos 1 permissão de ação:**
   ```javascript
   if (sistemaAtivo === 'nexus360') {
     const temAlgumaAcao = Object.values(configNexus.permissoes_acoes_nexus).some(v => v === true);
     if (!temAlgumaAcao) {
       toast.error('Configure ao menos 1 ação permitida antes de ativar Nexus360');
       return false;
     }
   }
   ```

3. **Não pode ativar Nexus se há divergências críticas:**
   ```javascript
   if (novoSistema === 'nexus360' && temDivergenciasCriticas) {
     toast.error('Corrija as divergências críticas antes de ativar Nexus360');
     return;
   }
   ```

---

## 1️⃣7️⃣ PRÓXIMOS PASSOS (Implementação)

### 📝 Checklist

- [ ] Adicionar campo `sistema_permissoes_ativo` ao User entity
- [ ] Criar `GerenciadorUsuariosComparativo.jsx`
- [ ] Criar subcomponentes das 2 colunas
- [ ] Implementar lógica de toggle sistema ativo
- [ ] Implementar salvamento independente (2 botões)
- [ ] Adicionar cálculo de divergências
- [ ] Testar com usuário real
- [ ] Migrar página `Usuarios.js` para usar novo componente
- [ ] Deprecar `GerenciadorUsuariosUnificado` antigo

### 🚀 Quando Implementar

**Aguardando aprovação do usuário** para:
1. Confirmar arquitetura proposta
2. Decidir layout exato (50/50 ou 40/60?)
3. Definir se dados básicos ficam fora ou duplicados
4. Escolher estratégia de scroll (sincronizado ou independente)

---

## 🎯 RESUMO EXECUTIVO

**O que temos hoje:**
- 3 abas separadas (Dados, Legado, Nexus) → navegação fragmentada
- Impossível comparar lado a lado
- Configuração WhatsApp misturada com dados básicos

**O que será:**
- 1 tela com 2 colunas paralelas (Legado | Nexus360)
- Toggle no topo define qual sistema está ativo
- Comparação visual direta
- Detecção automática de divergências
- Migração assistida (botão "Migrar →")
- Salvamento independente (sem conflito)

**Benefício principal:**
🎯 Transparência total na transição Legado → Nexus360, permitindo validação e teste antes de ativar em produção.

---

**FIM DA ANÁLISE** 🎉