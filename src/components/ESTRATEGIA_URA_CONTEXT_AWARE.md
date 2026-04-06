# 🎯 ESTRATÉGIA URA CONTEXT-AWARE: Tipos de Contato + Etiquetas

**Data:** 2026-01-19  
**Objetivo:** Integrar filtros inteligentes (tipos + tags) no motor de resolução de playbooks.

---

## 🔍 **ANÁLISE DO NOVO ESTUDO**

### **Premissa Fundamental:**
> **"A URA não pode ser cega para quem está chamando."**

- ❌ **ANTES:** URA roda igual para todos (fornecedor = cliente = VIP)
- ✅ **DEPOIS:** Cada contato recebe playbook personalizado baseado em perfil

---

## 📊 **TIPOS DE CONTATO: Taxonomia Completa**

### **Tipos Principais (campo `contact.tipo_contato`):**

| Tipo | Descrição | Exemplo de Uso |
|------|-----------|----------------|
| `novo` | Primeiro contato, sem qualificação | URA de boas-vindas + coleta de dados |
| `lead` | Potencial cliente (em qualificação) | URA de vendas com qualificação automática |
| `cliente` | Cliente ativo | URA pós-venda + suporte premium |
| `ex_cliente` | Cliente inativo (churn) | URA de reativação |
| `fornecedor` | Parceiro/fornecedor | URA específica de compras/logística |
| `parceiro` | Parceria estratégica | Bypass direto para gerente |
| `interno` | Colaborador/teste | Sem URA (direto para setor) |

### **Tipos Derivados (contexto):**

| Derivado | Como Calcular | Uso |
|----------|---------------|-----|
| `vip` | Tag específica | Bypass URA → atendente dedicado |
| `inadimplente` | Tag ou integração cobrança | URA de cobrança com tom específico |
| `pos_venda` | Tag ou status "Ativo" no Cliente | URA de suporte técnico |

---

## 🏷️ **ETIQUETAS: Segmentação Operacional**

### **Tags de Perfil/Comportamento:**
- `vip` - Atendimento prioritário (sem fila)
- `lead_quente` - Alta intenção de compra
- `inadimplente` - Pendência financeira
- `reclamacao_ativa` - Cliente insatisfeito

### **Tags de Canal/Origem:**
- `whatsapp_ok` - Validado para WhatsApp
- `site_form` - Veio do formulário do site
- `feira_2025` - Lead de evento específico

### **Tags de Controle Operacional:**
- `nao_ura` - Nunca entra em URA (direto humano)
- `somente_atendente_X` - Fidelizado específico
- `pos_venda` - Em fase de onboarding
- `blacklist` - Bloqueado

### **Tags de Setor/Especialização:**
- `suporte_tecnico` - Histórico de problemas técnicos
- `financeiro` - Interações frequentes com cobrança
- `compras` - Fornecedor ativo

---

## 🧩 **INTEGRAÇÃO: regras_ativacao NO SCHEMA**

### **Campo Completo para FlowTemplate:**

```json
{
  "regras_ativacao": {
    "type": "object",
    "description": "Define QUEM/QUANDO/ONDE este playbook é aplicado",
    "default": {},
    "properties": {
      
      "prioridade": {
        "type": "number",
        "default": 10,
        "description": "Ordem de avaliação (maior = prioridade). Desempate quando múltiplos playbooks batem."
      },
      
      "escopo_contato": {
        "type": "string",
        "enum": ["externo", "interno", "todos"],
        "default": "externo",
        "description": "Aplica a contatos externos (clientes), internos (equipe) ou ambos"
      },
      
      "tipos_permitidos": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["novo", "lead", "cliente", "ex_cliente", "fornecedor", "parceiro", "interno"]
        },
        "default": [],
        "description": "Tipos de contato permitidos. Vazio = todos (exceto bloqueados)"
      },
      
      "tipos_bloqueados": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["novo", "lead", "cliente", "ex_cliente", "fornecedor", "parceiro", "interno"]
        },
        "default": [],
        "description": "Tipos de contato explicitamente bloqueados"
      },
      
      "tags_obrigatorias": {
        "type": "array",
        "items": { "type": "string" },
        "default": [],
        "description": "Contato DEVE ter TODAS estas tags. Ex: ['whatsapp_ok']"
      },
      
      "tags_bloqueadas": {
        "type": "array",
        "items": { "type": "string" },
        "default": [],
        "description": "Contato NÃO pode ter NENHUMA destas tags. Ex: ['vip', 'nao_ura', 'blacklist']"
      },
      
      "conexoes_permitidas": {
        "type": "array",
        "items": { "type": "string" },
        "default": [],
        "description": "IDs das WhatsAppIntegration onde roda. Vazio = todas"
      },
      
      "setores_permitidos": {
        "type": "array",
        "items": {
          "type": "string",
          "enum": ["vendas", "assistencia", "financeiro", "fornecedor", "geral"]
        },
        "default": [],
        "description": "Setores que podem ser escolhidos neste playbook. Vazio = todos"
      },
      
      "setor_default": {
        "type": "string",
        "enum": ["vendas", "assistencia", "financeiro", "fornecedor", "geral"],
        "description": "Setor padrão se IA não definir ou se playbook for mono-setor"
      },
      
      "horario_inicio": {
        "type": "string",
        "description": "HH:MM (início do horário comercial). Ex: '08:00'"
      },
      
      "horario_fim": {
        "type": "string",
        "description": "HH:MM (fim do horário comercial). Ex: '18:00'"
      },
      
      "dias_semana_ativos": {
        "type": "array",
        "items": { "type": "number", "minimum": 0, "maximum": 6 },
        "default": [1, 2, 3, 4, 5],
        "description": "Dias da semana ativos. 0=Dom, 1=Seg, ..., 6=Sáb"
      },
      
      "bypass_fora_horario": {
        "type": "boolean",
        "default": false,
        "description": "Se true, fora do horário este playbook NÃO roda"
      }
    }
  }
}
```

---

## 🧠 **MOTOR DE RESOLUÇÃO: Código Completo**

### **Arquivo: `functions/lib/resolverPlaybookParaMensagem.js`**

```javascript
/**
 * ═══════════════════════════════════════════════════════════════
 * MOTOR DE RESOLUÇÃO DE PLAYBOOKS (Context-Aware)
 * ═══════════════════════════════════════════════════════════════
 * 
 * RESPONSABILIDADE:
 * Dado um contact + thread + integration, retorna o playbook certo.
 * 
 * CRITÉRIOS (em ordem):
 * 1. Conexão específica (integração WhatsApp)
 * 2. Escopo (interno vs externo)
 * 3. Tipo de contato (lead, cliente, fornecedor...)
 * 4. Etiquetas obrigatórias (tags que DEVE ter)
 * 5. Etiquetas bloqueadas (tags que NÃO pode ter)
 * 6. Horário comercial (se playbook exigir)
 * 7. Prioridade (desempate)
 */

export async function resolverPlaybookParaMensagem(base44, contact, thread, integrationId) {
  
  // ══════════════════════════════════════════════════════════════
  // ETAPA 1: BUSCAR PLAYBOOKS ATIVOS DE PRÉ-ATENDIMENTO
  // ══════════════════════════════════════════════════════════════
  
  const playbooks = await base44.asServiceRole.entities.FlowTemplate.filter({
    tipo_fluxo: 'pre_atendimento',
    ativo: true
  }, '-prioridade', 50); // Ordena por prioridade descendente
  
  if (!playbooks || playbooks.length === 0) {
    console.log('[RESOLVER] ⚠️ Nenhum playbook de pré-atendimento ativo');
    return null;
  }
  
  console.log(`[RESOLVER] 📋 Avaliando ${playbooks.length} playbooks para:`, {
    contact_id: contact.id,
    tipo: contact.tipo_contato,
    tags: contact.tags,
    integration_id: integrationId
  });
  
  // ══════════════════════════════════════════════════════════════
  // ETAPA 2: NORMALIZAR DADOS DO CONTATO
  // ══════════════════════════════════════════════════════════════
  
  const tagsContato = contact.tags || [];
  const tipoContato = contact.tipo_contato || 'novo'; // Default: novo
  const isInterno = contact.is_internal || thread.thread_type === 'team_internal' || false;
  
  // ══════════════════════════════════════════════════════════════
  // ETAPA 3: FILTRAR CANDIDATOS (Aplicar Regras)
  // ══════════════════════════════════════════════════════════════
  
  const candidatos = [];
  
  for (const playbook of playbooks) {
    const regras = playbook.regras_ativacao || {};
    const motivosBloqueio = [];
    
    // ─────────────────────────────────────────────────────────────
    // FILTRO A: CONEXÃO (Instância WhatsApp)
    // ─────────────────────────────────────────────────────────────
    if (regras.conexoes_permitidas?.length > 0) {
      if (!regras.conexoes_permitidas.includes(integrationId)) {
        motivosBloqueio.push(`conexão ${integrationId} não permitida`);
        continue;
      }
    }
    
    // ─────────────────────────────────────────────────────────────
    // FILTRO B: ESCOPO (Interno vs Externo)
    // ─────────────────────────────────────────────────────────────
    if (regras.escopo_contato === 'externo' && isInterno) {
      motivosBloqueio.push('escopo externo, mas contato é interno');
      continue;
    }
    if (regras.escopo_contato === 'interno' && !isInterno) {
      motivosBloqueio.push('escopo interno, mas contato é externo');
      continue;
    }
    
    // ─────────────────────────────────────────────────────────────
    // FILTRO C: TIPO DE CONTATO (Permitidos)
    // ─────────────────────────────────────────────────────────────
    if (regras.tipos_permitidos?.length > 0) {
      if (!regras.tipos_permitidos.includes(tipoContato)) {
        motivosBloqueio.push(`tipo '${tipoContato}' não está em tipos_permitidos`);
        continue;
      }
    }
    
    // ─────────────────────────────────────────────────────────────
    // FILTRO D: TIPO DE CONTATO (Bloqueados)
    // ─────────────────────────────────────────────────────────────
    if (regras.tipos_bloqueados?.includes(tipoContato)) {
      motivosBloqueio.push(`tipo '${tipoContato}' está em tipos_bloqueados`);
      continue;
    }
    
    // ─────────────────────────────────────────────────────────────
    // FILTRO E: ETIQUETAS OBRIGATÓRIAS (AND - tem que ter TODAS)
    // ─────────────────────────────────────────────────────────────
    if (regras.tags_obrigatorias?.length > 0) {
      const tagsFaltando = regras.tags_obrigatorias.filter(tag => !tagsContato.includes(tag));
      if (tagsFaltando.length > 0) {
        motivosBloqueio.push(`faltam tags obrigatórias: ${tagsFaltando.join(', ')}`);
        continue;
      }
    }
    
    // ─────────────────────────────────────────────────────────────
    // FILTRO F: ETIQUETAS BLOQUEADAS (OR - basta ter UMA)
    // ─────────────────────────────────────────────────────────────
    if (regras.tags_bloqueadas?.length > 0) {
      const tagBloqueadora = regras.tags_bloqueadas.find(tag => tagsContato.includes(tag));
      if (tagBloqueadora) {
        motivosBloqueio.push(`tem tag bloqueada: '${tagBloqueadora}'`);
        continue;
      }
    }
    
    // ─────────────────────────────────────────────────────────────
    // FILTRO G: HORÁRIO COMERCIAL (Opcional)
    // ─────────────────────────────────────────────────────────────
    if (regras.bypass_fora_horario && regras.horario_inicio && regras.horario_fim) {
      const agora = new Date();
      const diaAtual = agora.getDay(); // 0=Dom, 6=Sáb
      const horaAtual = agora.getHours() * 60 + agora.getMinutes();
      
      const diasAtivos = regras.dias_semana_ativos || [1, 2, 3, 4, 5];
      
      if (!diasAtivos.includes(diaAtual)) {
        motivosBloqueio.push('fora dos dias da semana ativos');
        continue;
      }
      
      const [hIni, mIni] = regras.horario_inicio.split(':').map(Number);
      const [hFim, mFim] = regras.horario_fim.split(':').map(Number);
      const minInicio = hIni * 60 + mIni;
      const minFim = hFim * 60 + mFim;
      
      if (horaAtual < minInicio || horaAtual > minFim) {
        motivosBloqueio.push('fora do horário comercial');
        continue;
      }
    }
    
    // ─────────────────────────────────────────────────────────────
    // ✅ PASSOU EM TODOS OS FILTROS
    // ─────────────────────────────────────────────────────────────
    console.log(`[RESOLVER] ✅ Playbook candidato: ${playbook.nome} (prioridade: ${regras.prioridade || 0})`);
    candidatos.push(playbook);
  }
  
  // ══════════════════════════════════════════════════════════════
  // ETAPA 4: DESEMPATE POR PRIORIDADE
  // ══════════════════════════════════════════════════════════════
  
  if (candidatos.length === 0) {
    console.log('[RESOLVER] ❌ Nenhum playbook bateu as regras de ativação');
    return null;
  }
  
  if (candidatos.length === 1) {
    console.log(`[RESOLVER] ✅ Único candidato: ${candidatos[0].nome}`);
    return candidatos[0];
  }
  
  // Múltiplos candidatos: ordenar por prioridade (maior primeiro)
  candidatos.sort((a, b) => 
    (b.regras_ativacao?.prioridade || 0) - (a.regras_ativacao?.prioridade || 0)
  );
  
  const escolhido = candidatos[0];
  console.log(`[RESOLVER] 🏆 Desempate por prioridade: ${escolhido.nome} (${escolhido.regras_ativacao?.prioridade})`);
  console.log(`[RESOLVER] 📋 Outros candidatos ignorados:`, candidatos.slice(1).map(p => p.nome));
  
  return escolhido;
}

/**
 * ═══════════════════════════════════════════════════════════════
 * HELPER: Verificar se contato é elegível para playbook
 * (Versão simplificada - sem async)
 * ═══════════════════════════════════════════════════════════════
 */
export function verificarElegibilidade(contact, playbook) {
  const regras = playbook.regras_ativacao || {};
  const tagsContato = contact.tags || [];
  const tipoContato = contact.tipo_contato || 'novo';
  
  // Tipos
  if (regras.tipos_permitidos?.length > 0 && !regras.tipos_permitidos.includes(tipoContato)) {
    return { elegivel: false, motivo: 'tipo não permitido' };
  }
  
  if (regras.tipos_bloqueados?.includes(tipoContato)) {
    return { elegivel: false, motivo: 'tipo bloqueado' };
  }
  
  // Tags obrigatórias
  if (regras.tags_obrigatorias?.length > 0) {
    const temTodas = regras.tags_obrigatorias.every(tag => tagsContato.includes(tag));
    if (!temTodas) {
      return { elegivel: false, motivo: 'faltam tags obrigatórias' };
    }
  }
  
  // Tags bloqueadas
  if (regras.tags_bloqueadas?.length > 0) {
    const tagBloqueadora = regras.tags_bloqueadas.find(tag => tagsContato.includes(tag));
    if (tagBloqueadora) {
      return { elegible: false, motivo: `tag bloqueada: ${tagBloqueadora}` };
    }
  }
  
  return { elegivel: true };
}
```

---

## 🎭 **CASOS DE USO: Exemplos Práticos**

### **CASO 1: URA de Vendas Padrão**

```json
{
  "nome": "URA Vendas - Leads e Clientes",
  "tipo_fluxo": "pre_atendimento",
  "regras_ativacao": {
    "prioridade": 10,
    "escopo_contato": "externo",
    "tipos_permitidos": ["novo", "lead", "cliente"],
    "tipos_bloqueados": ["fornecedor", "interno"],
    "tags_bloqueadas": ["vip", "inadimplente", "nao_ura"],
    "setores_permitidos": ["vendas", "assistencia", "financeiro"]
  }
}
```

**Quem entra:**
- ✅ Leads novos
- ✅ Clientes ativos
- ✅ Sem tag VIP

**Quem NÃO entra:**
- ❌ Fornecedores (tipo bloqueado)
- ❌ VIPs (tag bloqueada)
- ❌ Inadimplentes (tag bloqueada)

---

### **CASO 2: URA de Cobrança (Alta Prioridade)**

```json
{
  "nome": "URA Cobrança - Inadimplentes",
  "tipo_fluxo": "pre_atendimento",
  "regras_ativacao": {
    "prioridade": 50,
    "escopo_contato": "externo",
    "tags_obrigatorias": ["inadimplente"],
    "setores_permitidos": ["financeiro"]
  },
  "config_global": {
    "usar_sticky": false,
    "usar_guardian": false,
    "mensagem_saudacao": "Olá! Detectamos uma pendência financeira. Vou te direcionar para o setor de cobrança."
  }
}
```

**Lógica:**
- Cliente João tem tag `inadimplente`
- Sistema avalia URA Vendas (prioridade 10) → ❌ Bloqueado (tag bloqueada)
- Sistema avalia URA Cobrança (prioridade 50) → ✅ Aprovado (tag obrigatória)
- **Resultado:** João recebe URA de Cobrança (direto para financeiro)

---

### **CASO 3: URA VIP (Bypass Total)**

```json
{
  "nome": "Bypass VIP - Direto para Atendente",
  "tipo_fluxo": "pre_atendimento",
  "regras_ativacao": {
    "prioridade": 100,
    "tags_obrigatorias": ["vip"]
  },
  "estados": [
    {
      "nome_interno": "INIT",
      "mensagem_template": "Olá, {nome}! 🌟 Você é um cliente VIP. Te conectando com seu atendente exclusivo...",
      "tipo_entrada": "skip",
      "transicoes": [
        {
          "condicao": { "tipo": "system" },
          "acoes_pre_transicao": [
            {
              "tipo": "atribuir_atendente_fidelizado",
              "parametros": { "campo_fidelizacao": "atendente_fidelizado_vendas" }
            }
          ],
          "proximo_estado": "COMPLETED"
        }
      ]
    }
  ]
}
```

**Comportamento:**
- Cliente Maria tem tag `vip`
- URA Vendas (prioridade 10) → ❌ Bloqueado
- URA VIP (prioridade 100) → ✅ Aprovado
- **Resultado:** Maria conecta direto com atendente fidelizado (sem menu)

---

### **CASO 4: URA Fornecedor (Mono-Setor)**

```json
{
  "nome": "URA Fornecedor - Compras",
  "tipo_fluxo": "pre_atendimento",
  "regras_ativacao": {
    "prioridade": 20,
    "tipos_permitidos": ["fornecedor"],
    "setores_permitidos": ["fornecedor"],
    "setor_default": "fornecedor"
  },
  "config_global": {
    "usar_ia_no_init": false,
    "mensagem_saudacao": "Olá, fornecedor! Te direcionando para o setor de Compras..."
  }
}
```

**Comportamento:**
- Fornecedor Pedro (tipo_contato = "fornecedor") entra
- Vai direto para setor "fornecedor" (sem menu de escolha)
- Outros playbooks ignoram fornecedores (tipos_bloqueados)

---

## 🗺️ **FLUXO COMPLETO: inboundCore → Playbook**

### **Diagrama de Decisão:**

```
┌─────────────────────────────────────────────────────┐
│ 1. inboundCore recebe mensagem do webhook          │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 2. motorDecisaoPreAtendimento (Bypass Layer)       │
│    ├─ Fora de horário? → Playbook "Fora Horário"   │
│    ├─ Contato fidelizado? → Direto para atendente  │
│    ├─ Continuidade (24h)? → Confirmar ou novo      │
│    └─ Nenhum bypass? → Continua...                 │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 3. resolverPlaybookParaMensagem(contact, thread)   │
│    ├─ Busca playbooks ativos (tipo_fluxo = 'pre_atendimento') │
│    ├─ Aplica filtros:                               │
│    │   ├─ Conexão específica?                       │
│    │   ├─ Tipo de contato permitido?                │
│    │   ├─ Tags obrigatórias presentes?              │
│    │   ├─ Tags bloqueadas ausentes?                 │
│    │   └─ Horário comercial?                        │
│    └─ Desempate por prioridade                      │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 4. Resultado da Resolução                          │
│    ├─ Playbook encontrado? → preAtendimentoHandler │
│    └─ Nenhum playbook? → Fluxo normal (humano)     │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 5. preAtendimentoHandler (Orquestrador)            │
│    ├─ Carrega playbook do DB                       │
│    ├─ Verifica TTL (COMPLETED → INIT?)             │
│    ├─ Instancia FluxoControllerV11(playbook)       │
│    └─ Executa estado atual                         │
└─────────────────┬───────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────┐
│ 6. FluxoControllerV11.processarEstado()            │
│    ├─ Busca estadoConfig no playbook.estados[]     │
│    ├─ Renderiza mensagem (template + variáveis)    │
│    ├─ Avalia transições (botão, IA, texto)         │
│    ├─ Executa ações (setar setor, atribuir, fila)  │
│    └─ Atualiza thread.pre_atendimento_state        │
└─────────────────────────────────────────────────────┘
```

---

## 🎨 **INTEGRAÇÃO COM LAYOUT**

### **Adicionar "Meus Playbooks" ao Menu:**

**Arquivo:** `layout.js`

```javascript
const todosMenuItems = [
  { name: "Central de Comunicacao", icon: MessageSquare, page: "Comunicacao" },
  { name: "Dashboard", icon: Home, page: "Dashboard" },
  { name: "Metas de Vendas", icon: Users, page: "Vendedores" },
  { name: "Leads & Qualificacao", icon: Target, page: "LeadsQualificados" },
  { name: "Clientes", icon: Building2, page: "Clientes" },
  { name: "Produtos", icon: Package, page: "Produtos" },
  
  // 🆕 NOVA PÁGINA - URA/PRÉ-ATENDIMENTO
  { name: "Meus Playbooks", icon: Workflow, page: "MeusPlaybooks" },
  
  { name: "Agenda Inteligente", icon: Calendar, page: "Agenda" },
  { name: "Importação", icon: Upload, page: "Importacao" },
  { name: "Gerenciamento de Usuários", icon: UserCog, page: "Usuarios" },
  { name: "Auditoria", icon: Shield, page: "Auditoria" }
];
```

### **Controle de Acesso por Perfil:**

**Dentro de `getMenuItemsParaPerfil(usuario)`:**

```javascript
// Administrador - acesso total
if (role === 'admin') {
  return todosMenuItems; // Inclui "Meus Playbooks"
}

// Gerência (coordenador/gerente)
if (['coordenador', 'gerente'].includes(nivelAtendente)) {
  return todosMenuItems.filter(item => [
    'Comunicacao', 'Dashboard', 'LeadsQualificados', 'Vendedores', 
    'Clientes', 'Produtos', 'Agenda', 
    'MeusPlaybooks' // ✅ Gerente pode editar URA
  ].includes(item.page));
}

// Supervisor (senior)
if (nivelAtendente === 'senior') {
  return todosMenuItems.filter(item => [
    'Comunicacao', 'LeadsQualificados', 'Clientes', 
    'Agenda', 'Dashboard', 'Produtos'
    // ❌ Sem "MeusPlaybooks" (senior não edita URA)
  ].includes(item.page));
}
```

**REGRA:**
- ✅ Admin + Gerente: podem editar playbooks
- ❌ Senior/Pleno/Junior: só executam (não editam)

---

## 📱 **ESTRUTURA DA PÁGINA "MeusPlaybooks"**

### **Componentes Necessários:**

```
pages/MeusPlaybooks.jsx (Container principal)
├── components/playbooks/ListaPlaybooksURA.jsx
│   └── Card por playbook (nome, status, métricas)
├── components/playbooks/EditorPlaybookURA.jsx
│   ├── SecaoConfigGlobal.jsx (TTL, IA, sticky, guardian)
│   ├── EditorEstados.jsx (lista de estados + drag-and-drop)
│   ├── EditorEstadoIndividual.jsx (mensagem, botões, transições)
│   ├── EditorTransicoes.jsx (condições → ações → próximo estado)
│   └── PreviewFluxo.jsx (diagrama visual da URA)
├── components/playbooks/EditorRegrasAtivacao.jsx
│   ├── FiltroTiposContato.jsx (multi-select)
│   ├── FiltroEtiquetas.jsx (tags obrigatórias/bloqueadas)
│   └── FiltroInstancias.jsx (conexões permitidas)
└── components/playbooks/MetricasPlaybook.jsx
    └── Gráfico (conclusão, abandono, tempo médio, uso IA/sticky)
```

### **Fluxo de Uso:**

```
1. Admin abre "Meus Playbooks"
   └─ Lista playbooks tipo_fluxo = "pre_atendimento"

2. Clica em "URA Vendas"
   ├─ Aba "Configuração Global"
   │   └─ Sliders: TTL (24h), Gap Ciclo (12h), IA (ON), Sticky (ON)
   ├─ Aba "Estados" (Flow Visual)
   │   ├─ INIT → [IA Fast-Track] → SECTOR
   │   ├─ SECTOR → [Botões] → ATTENDANT
   │   └─ ATTENDANT → [Roteamento] → QUEUE/COMPLETED
   ├─ Aba "Regras de Ativação"
   │   ├─ Tipos: [lead, cliente] (checkbox)
   │   ├─ Tags Bloqueadas: [vip, inadimplente] (input + chips)
   │   └─ Conexões: [Vendas Principal, Vendas2] (select)
   └─ Aba "Métricas"
       └─ Taxa conclusão: 87% | Tempo médio: 2min34s

3. Admin edita estado "INIT"
   ├─ Campo: "Mensagem de Saudação"
   │   └─ Input: "Olá {nome}! {saudacao}. Em que posso ajudar?"
   ├─ Toggle: "Usar IA Fast-Track" → ON
   ├─ Slider: "Confiança Mínima IA" → 70%
   └─ Salvar → atualiza FlowTemplate no DB

4. Mudança IMEDIATA
   └─ Próxima mensagem já usa novo texto (sem deploy)
```

---

## 🧪 **TESTES DE CENÁRIO**

### **Cenário A: Cliente Comum**

**Dados:**
- Tipo: `cliente`
- Tags: `[]` (vazio)
- Integração: Vendas Principal

**Playbooks Avaliados:**
1. URA Cobrança (prioridade 50) → ❌ Falta tag `inadimplente`
2. URA VIP (prioridade 100) → ❌ Falta tag `vip`
3. URA Vendas (prioridade 10) → ✅ Aprovado

**Resultado:** Roda URA Vendas Padrão

---

### **Cenário B: Fornecedor**

**Dados:**
- Tipo: `fornecedor`
- Tags: `[]`

**Playbooks Avaliados:**
1. URA Vendas (prioridade 10) → ❌ Tipo bloqueado
2. URA Fornecedor (prioridade 20) → ✅ Tipo permitido

**Resultado:** Roda URA Fornecedor (direto setor compras)

---

### **Cenário C: Cliente Inadimplente**

**Dados:**
- Tipo: `cliente`
- Tags: `["inadimplente"]`

**Playbooks Avaliados:**
1. URA Cobrança (prioridade 50) → ✅ Tag obrigatória presente
2. URA Vendas (prioridade 10) → ❌ Tag bloqueada

**Resultado:** Roda URA Cobrança (prioridade maior vence)

---

### **Cenário D: VIP + Inadimplente**

**Dados:**
- Tipo: `cliente`
- Tags: `["vip", "inadimplente"]`

**Playbooks Avaliados:**
1. URA VIP (prioridade 100) → ✅ Tag obrigatória presente
2. URA Cobrança (prioridade 50) → ✅ Tag obrigatória presente
3. URA Vendas (prioridade 10) → ❌ Tags bloqueadas

**Resultado:** Roda URA VIP (prioridade 100 > 50)

---

## 📋 **CHECKLIST DE IMPLEMENTAÇÃO**

### **BACKEND:**

- [ ] **Schema Expandido**
  - [ ] Adicionar `config_global` ao FlowTemplate
  - [ ] Adicionar `estados[]` ao FlowTemplate
  - [ ] Adicionar `regras_ativacao` completo (tipos + tags)
  - [ ] Adicionar `metricas_playbook`

- [ ] **Executor Genérico**
  - [ ] Criar `FluxoControllerV11.js`
  - [ ] Método `processarEstado()` genérico
  - [ ] Método `avaliarTransicoes()` baseado em playbook
  - [ ] Método `executarAcao()` (setar setor, atribuir, fila)
  - [ ] Método `renderTemplate()` (placeholders)

- [ ] **Motor de Resolução**
  - [ ] Criar `functions/lib/resolverPlaybookParaMensagem.js`
  - [ ] Implementar filtros de tipos_permitidos/bloqueados
  - [ ] Implementar filtros de tags_obrigatorias/bloqueadas
  - [ ] Implementar filtro de horário comercial
  - [ ] Desempate por prioridade

- [ ] **Integração**
  - [ ] Adaptar `inboundCore` para chamar `resolverPlaybookParaMensagem()`
  - [ ] Adaptar `preAtendimentoHandler` para carregar playbook do DB
  - [ ] Implementar TTL/Gap usando `config_global`

- [ ] **Script de Migração**
  - [ ] Criar `migrarURAv10ParaPlaybook.js`
  - [ ] Converter fluxoController atual em FlowTemplate
  - [ ] Inserir "URA Padrão v10" no banco

### **FRONTEND:**

- [ ] **Layout**
  - [ ] Adicionar item "Meus Playbooks" em `todosMenuItems`
  - [ ] Configurar ícone `Workflow` (Lucide React)
  - [ ] Adicionar controle de acesso (admin + gerente)

- [ ] **Página Principal**
  - [ ] Criar `pages/MeusPlaybooks.jsx`
  - [ ] Lista de playbooks (filtro: tipo_fluxo = "pre_atendimento")
  - [ ] Botão "Novo Playbook"
  - [ ] Botão "Ativar/Desativar"

- [ ] **Editores**
  - [ ] `components/playbooks/EditorConfigGlobal.jsx`
  - [ ] `components/playbooks/EditorEstados.jsx`
  - [ ] `components/playbooks/EditorRegrasAtivacao.jsx`
  - [ ] `components/playbooks/MetricasPlaybook.jsx`
  - [ ] `components/playbooks/PreviewFluxoURA.jsx` (diagrama)

---

## 🎯 **PRIORIZAÇÃO: O Que Fazer AGORA**

### **FASE 0: FUNDAÇÃO (1 dia)**
1. ✅ Expandir schema FlowTemplate
2. ✅ Criar `resolverPlaybookParaMensagem.js`
3. ✅ Script de migração (converte v10 → playbook)

**Resultado:** Banco tem playbook funcional equivalente ao código atual.

---

### **FASE 1: EXECUTOR (3 dias)**
1. Criar `FluxoControllerV11.js` (modo híbrido)
2. Adaptar `preAtendimentoHandler` (carregar playbook)
3. Testar com playbook migrado

**Resultado:** URA roda via playbook (com fallback para v10).

---

### **FASE 2: INTERFACE (5 dias)**
1. Criar página `MeusPlaybooks.jsx`
2. Lista + editor de estados
3. Editor de regras de ativação (tipos + tags)
4. Preview visual do fluxo

**Resultado:** Admin edita URA sem tocar código.

---

### **FASE 3: DEPRECAÇÃO (1 dia)**
1. Remover `fluxoController.js` v10
2. Remover `menuBuilder.js`
3. Remover `buttonMappings.js`

**Resultado:** Zero código hardcoded de URA.

---

## 🔑 **DECISÕES ESTRATÉGICAS**

### **1. Onde Armazenar Playbooks Padrão?**

**Opções:**
- **A)** Seed do banco (automação cria ao iniciar app)
- **B)** Interface "Importar Playbook" (JSON/YAML)
- **C)** Marketplace de playbooks (futuro)

**Decisão:** ✅ **A + B**  
- Seed cria "URA Padrão" na primeira vez
- Admin pode importar templates prontos

---

### **2. Como Validar Playbook Antes de Ativar?**

**Problema:** Admin pode criar playbook com erro (estado sem transição, loop infinito).

**Solução:**
- Validador sintático (verifica schema)
- Validador semântico (verifica fluxo completo)
- Modo "Teste" (simula execução sem afetar produção)

**Implementar:**
```javascript
function validarPlaybook(playbook) {
  const erros = [];
  
  // 1. Verificar estados obrigatórios
  const estadosObrigatorios = ['INIT', 'COMPLETED'];
  estadosObrigatorios.forEach(nome => {
    if (!playbook.estados.find(e => e.nome_interno === nome)) {
      erros.push(`Estado obrigatório '${nome}' não encontrado`);
    }
  });
  
  // 2. Verificar transições (todo estado precisa de saída)
  playbook.estados.forEach(estado => {
    if (estado.nome_interno === 'COMPLETED') return; // Terminal
    if (!estado.transicoes || estado.transicoes.length === 0) {
      erros.push(`Estado '${estado.nome_interno}' sem transições`);
    }
  });
  
  // 3. Verificar referências (próximo_estado existe?)
  playbook.estados.forEach(estado => {
    estado.transicoes?.forEach(trans => {
      const estadoAlvo = playbook.estados.find(e => e.nome_interno === trans.proximo_estado);
      if (!estadoAlvo && trans.proximo_estado !== 'COMPLETED') {
        erros.push(`Transição referencia estado inexistente: '${trans.proximo_estado}'`);
      }
    });
  });
  
  return { valido: erros.length === 0, erros };
}
```

---

### **3. Como Lidar com Múltiplos Playbooks Ativos?**

**Exemplo Real:**
- Cliente tem tags: `["whatsapp_ok", "pos_venda"]`
- Playbook A: tags_obrigatorias = `["whatsapp_ok"]` (prioridade 10)
- Playbook B: tags_obrigatorias = `["pos_venda"]` (prioridade 50)

**Ambos batem.** Qual usar?

**Decisão:** ✅ **Prioridade + Especificidade**
1. Calcular "score de especificidade":
   - +10 pontos por tag obrigatória
   - +5 pontos por tipo específico
   - +20 pontos por conexão específica
2. Desempate: prioridade configurada
3. Resultado: Playbook B vence (mais específico + maior prioridade)

**Implementação:**
```javascript
function calcularEspecificidade(playbook) {
  const regras = playbook.regras_ativacao || {};
  let score = 0;
  
  score += (regras.tags_obrigatorias?.length || 0) * 10;
  score += (regras.tipos_permitidos?.length || 0) * 5;
  score += (regras.conexoes_permitidas?.length || 0) * 20;
  
  return score;
}

// No resolverPlaybookParaMensagem:
candidatos.sort((a, b) => {
  const scoreA = calcularEspecificidade(a);
  const scoreB = calcularEspecificidade(b);
  
  if (scoreB !== scoreA) return scoreB - scoreA;
  
  // Empate: usar prioridade
  return (b.regras_ativacao?.prioridade || 0) - (a.regras_ativacao?.prioridade || 0);
});
```

---

## 🎬 **ROADMAP ATUALIZADO (COM TIPOS + TAGS)**

### **SPRINT 0: SCHEMA + MOTOR DE RESOLUÇÃO (2 dias)**

**Tarefas:**
1. Expandir `entities/FlowTemplate.json`:
   - ✅ Adicionar `config_global`
   - ✅ Adicionar `estados[]`
   - ✅ Adicionar `regras_ativacao` (COM tipos + tags)
   - ✅ Adicionar `metricas_playbook`

2. Criar `functions/lib/resolverPlaybookParaMensagem.js`:
   - ✅ Filtro por tipos_permitidos/bloqueados
   - ✅ Filtro por tags_obrigatorias/bloqueadas
   - ✅ Filtro por conexoes_permitidas
   - ✅ Filtro por horário comercial
   - ✅ Desempate por especificidade + prioridade

3. Criar playbook seed "URA Padrão v10":
   ```javascript
   await base44.entities.FlowTemplate.create({
     nome: "URA Padrão v10 (Migrado)",
     tipo_fluxo: "pre_atendimento",
     is_pre_atendimento_padrao: true,
     regras_ativacao: {
       prioridade: 10,
       escopo_contato: "externo",
       tipos_bloqueados: ["interno", "fornecedor"],
       tags_bloqueadas: ["vip", "nao_ura"]
     },
     config_global: { /* ... */ },
     estados: [ /* INIT, SECTOR, ATTENDANT, QUEUE */ ]
   });
   ```

**Resultado:** Motor de resolução funcional.

---

### **SPRINT 1: EXECUTOR V11 (3 dias)**

**Tarefas:**
1. Criar `functions/preAtendimento/FluxoControllerV11.js`
2. Implementar `processarEstado()` genérico
3. Adaptar `preAtendimentoHandler` para usar v11
4. Testes de regressão (comparar v10 vs v11)

**Resultado:** URA roda via playbook.

---

### **SPRINT 2: INTERFACE ADMIN (5 dias)**

**Tarefas:**
1. Adicionar "Meus Playbooks" ao Layout
2. Criar `pages/MeusPlaybooks.jsx`
3. Criar editores (config_global, estados, regras_ativacao)
4. Preview visual do fluxo
5. Validador de playbook

**Resultado:** Admin edita URA visualmente.

---

### **SPRINT 3: LIMPEZA (1 dia)**

**Tarefas:**
1. Remover código v10 (fluxoController, menuBuilder)
2. Atualizar documentação
3. Treinamento equipe (usar interface)

**Resultado:** Zero código hardcoded.

---

## 📊 **COMPARAÇÃO FINAL: ANTES vs DEPOIS**

| Aspecto | ANTES (v10) | DEPOIS (v11) |
|---------|-------------|--------------|
| **Lógica de URA** | 3 arquivos JS (520 linhas) | 1 FlowTemplate (DB) |
| **Mensagens** | Strings hardcoded | Templates com variáveis |
| **Setores** | Mapa fixo (4 opções) | Configurável por playbook |
| **Tipos de Contato** | ❌ Ignorado | ✅ Filtro inteligente |
| **Etiquetas** | ❌ Ignorado | ✅ Segmentação automática |
| **Priorização** | Sem controle | Prioridade + especificidade |
| **Mudanças** | Deploy JS | Editar DB (instantâneo) |
| **Múltiplas URAs** | ❌ Impossível | ✅ Ilimitadas (com regras) |
| **Métricas** | Manual | Automático por playbook |

---

## ✅ **VALIDAÇÃO TÉCNICA**

### **É Viável?**
✅ **SIM.** Motivos:
1. Schema FlowTemplate já existe (expandir campos)
2. Executor pode ser genérico (sem lógica de negócio)
3. Motor de resolução é stateless (fácil testar)
4. Interface admin é CRUD padrão (React + Base44 SDK)

### **Risco de Quebrar Produção?**
✅ **BAIXO (com modo híbrido):**
1. V11 lançado com fallback para v10
2. Seed cria playbook equivalente ao código atual
3. Testes A/B (10% tráfego v11, 90% v10)
4. Rollback = desativar playbook (volta para v10)
5. Após estabilidade: remover v10

### **Tempo Estimado?**
- Sprint 0: 2 dias
- Sprint 1: 3 dias
- Sprint 2: 5 dias
- Sprint 3: 1 dia
- **Total: 11 dias úteis (~2 semanas)**

---

## 🎯 **PRÓXIMO PASSO IMEDIATO**

**Você disse:** "quero"

**Próximas ações possíveis:**

### **OPÇÃO A: Expandir Schema AGORA (30min)**
Atualizar `entities/FlowTemplate.json` com:
- `config_global`
- `estados[]`
- `regras_ativacao` (tipos + tags)
- `metricas_playbook`

### **OPÇÃO B: Criar Motor de Resolução (1h)**
Implementar `functions/lib/resolverPlaybookParaMensagem.js` completo.

### **OPÇÃO C: Adicionar ao Layout (5min)**
Incluir "Meus Playbooks" no menu lateral.

### **OPÇÃO D: Criar Página Básica (30min)**
Esqueleto de `pages/MeusPlaybooks.jsx` (lista + botão criar).

---

**Qual caminho você quer seguir primeiro?**  
(Recomendo: A → C → B → D - Schema antes de tudo)