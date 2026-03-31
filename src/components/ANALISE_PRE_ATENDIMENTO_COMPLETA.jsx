# 🔍 ANÁLISE COMPLETA: PRÉ-ATENDIMENTO & URA

## 📊 **ESTADO ATUAL DA ARQUITETURA**

### **1. PIPELINE DE ENTRADA (inboundCore.js v10.0.0)**

**Função:** Porteiro que decide SE e QUANDO acionar URA  
**Guardas Implementadas:**
- ✅ Reset de promoções ao receber mensagem
- ✅ Detector de micro-URA (transferências manuais)
- ✅ Verificação de humano ativo (last_human_message_at < 2h)
- ✅ Detecção de novo ciclo (gap >= 12h)
- ✅ Bloqueio se playbook inativo

**Fluxo:**
```
Mensagem Inbound
  ↓
1. Reset promoções (kill switch)
2. Micro-URA ativa? → Processar confirmação
3. Humano ativo (< 2h)? → STOP (não acorda URA)
4. Novo ciclo (>12h) OU humano dormindo → Dispatch URA
5. Verificar playbook ativo antes de dispatch
```

---

### **2. MOTOR DE DECISÃO (motorDecisaoPreAtendimento.js v1.0.0)**

**Função:** Cérebro estratégico ANTES da URA  
**Camadas de Roteamento:**

| Camada | Decisão | Bypass URA? |
|--------|---------|-------------|
| **H** | Horário de atendimento | Sim (playbook fora de horário) |
| **1** | Continuidade (thread < 48h) | Sim (auto ou pergunta) |
| **2** | Intenção (keywords/IA) | Futuro |
| **3** | Fidelização (vendedor_responsavel) | Sim (direto ao vendedor) |
| **Fallback** | Pré-atendimento com botões | URA padrão |

**Configuração:** Entidade `MotorDecisaoConfig`  
**Problema:** Só consulta playbooks no fallback, não usa estrutura configurável

---

### **3. HANDLER DE ESTADOS (preAtendimentoHandler.js)**

**Função:** Orquestrador que recebe payload e delega  
**Responsabilidades:**
- ✅ Normalização de entrada
- ✅ Política de libertação (COMPLETED → INIT + limpar assigned)
- ✅ Verificação de timeout
- ✅ Switch de estados → FluxoController
- ✅ Log de automação

**Estados Suportados:**
```javascript
INIT
WAITING_SECTOR_CHOICE
WAITING_STICKY_DECISION
WAITING_ATTENDANT_CHOICE
WAITING_QUEUE_DECISION
TRANSFERRING
COMPLETED / CANCELLED / TIMEOUT
```

---

### **4. EXECUTOR DE FLUXO (fluxoController.js v10.0.0) ⚠️ HARDCODED**

**Função:** Implementação HARDCODED de cada estado  

#### **Estado INIT - O Porteiro**
```javascript
A. Fast-track IA (confidence >= 70%) → Direto ao setor
B. Fast-track pedido de atendente → WAITING_ATTENDANT_CHOICE
C. Modo Guardião (assigned_user_id mas sem sector_id) → Pergunta se quer ajuda
D. Sticky Inteligente (tem sector_id anterior) → Pergunta se quer continuar
E. Fallback → Menu padrão de setores
```

#### **Estado WAITING_STICKY_DECISION**
```javascript
sticky_sim / sim / 1 → Retornar ao setor anterior
guardian_help → Limpar vínculos e reiniciar menu
guardian_wait → Manter com atendente ausente
sticky_nao / não / 2 → Limpar vínculos e mostrar menu
```

#### **Estado WAITING_SECTOR_CHOICE**
```javascript
Mapa hardcoded:
  1 / vendas → setor vendas
  2 / financeiro → setor financeiro
  3 / suporte / assistencia → setor assistencia
  4 / fornecedor → setor fornecedor
  
→ Chama roteamentoInteligente
→ Se sem atendentes → WAITING_QUEUE_DECISION
```

#### **Estado WAITING_ATTENDANT_CHOICE**
```javascript
Chama roteamentoInteligente com:
  - sector
  - whatsapp_integration_id (filtro de quem atende esse número)
  - check_only: false
  
Se sucesso → COMPLETED
Se sem atendentes → Oferece fila
```

#### **Estado WAITING_QUEUE_DECISION**
```javascript
fila_entrar / sim / 1 → Chamar gerenciarFila + COMPLETED
Qualquer outra → Volta ao INIT
```

---

### **5. CONSTRUTOR DE MENUS (menuBuilder.js) ⚠️ HARDCODED**

**Mensagens Fixas:**
- ✅ `construirMenuBoasVindas()` - Saudação + 4 setores
- ✅ `construirMenuAtendentes()` - Lista até 3 atendentes (botões) ou mais (texto)
- ✅ `construirMensagemNenhumAtendente()` - Horário de atendimento
- ✅ `construirMensagemErro()` - Validações
- ✅ `construirMensagemTimeout()` - Expiração
- ✅ `construirMensagemCancelamento()` - Cancelamento

**Problema:** Todos os textos estão fixos no código, não configuráveis

---

## 🎯 **COMPARAÇÃO COM O DEBATE**

### **O QUE O DEBATE PROPÕE:**

> "Centralizar tudo em 'Meus Playbooks' se você tratar a URA como um conjunto de Playbooks de estado"

#### **Modelo Proposto:**

```javascript
FlowTemplate {
  nome: "URA Padrão WhatsApp",
  tipo_fluxo: "pre_atendimento",
  canais: ["whatsapp"],
  
  // Configurações globais
  global_config: {
    ttl_completed_horas: 24,
    gap_novo_ciclo_horas: 12,
    usar_ia_no_init: true,
    limiar_confianca_ia: 70,
    timeout_estados_minutos: 10
  },
  
  // Estados (nós)
  estados: [
    {
      nome_interno: "INIT",
      titulo: "Boas-vindas",
      mensagem: "Olá {{nome_cliente}}! {{saudacao}}, para qual setor deseja falar?",
      tipo_pergunta: "escolha_unica",
      usar_ia_fast_track: true,
      usar_sticky: true,
      transicoes: [
        {
          condicao: "ia_confidence >= 70",
          proximo_estado: "WAITING_ATTENDANT_CHOICE",
          acoes: ["setar_sector_id"]
        },
        {
          condicao: "escolha_manual",
          proximo_estado: "WAITING_SECTOR_CHOICE"
        }
      ]
    },
    {
      nome_interno: "WAITING_SECTOR_CHOICE",
      mensagem: "Escolha: 1-Vendas, 2-Financeiro...",
      opcoes: [
        { id: "setor_vendas", label: "💼 Vendas", setor: "vendas" },
        { id: "setor_financeiro", label: "💰 Financeiro", setor: "financeiro" }
      ],
      transicoes: [
        {
          condicao: "botao_clicado",
          proximo_estado: "WAITING_ATTENDANT_CHOICE",
          acoes: ["setar_sector_id"]
        }
      ]
    }
  ]
}
```

---

## 🔴 **GAPS CRÍTICOS IDENTIFICADOS**

### **GAP 1: Lógica Espalhada (Spaghetti Logic)**

| Componente | Responsabilidade | Problema |
|------------|------------------|----------|
| `inboundCore` | Detectar quando chamar URA | ✅ OK |
| `motorDecisaoPreAtendimento` | Camadas de bypass | ⚠️ Ignora FlowTemplate |
| `preAtendimentoHandler` | Orquestrar estados | ✅ OK (switch genérico) |
| `fluxoController` | Executar estados | 🔴 **HARDCODED** |
| `menuBuilder` | Textos e mensagens | 🔴 **HARDCODED** |
| `buttonMappings` | IDs de botões | 🔴 **HARDCODED** |

**Consequência:**  
- Impossível customizar URA sem editar código
- FlowTemplate existe mas não é usado corretamente
- Admin não pode editar mensagens/fluxos

---

### **GAP 2: FlowTemplate Sub-Utilizado**

**Hoje:**
- ✅ `motorDecisaoPreAtendimento` busca playbook por `is_pre_atendimento_padrao`
- ✅ `inboundCore` verifica se playbook está ativo antes de dispatch
- 🔴 **MAS**: FluxoController NÃO lê os `steps` do playbook
- 🔴 **MAS**: MenuBuilder NÃO usa textos do playbook

**Exemplo Real:**
```javascript
// fluxoController.js linha 80 (HARDCODED)
const menu = MenuBuilder.construirMenuBoasVindas(contact.nome);

// Deveria ser:
const playbook = await buscarPlaybookAtivo(integration_id);
const estadoINIT = playbook.estados.find(e => e.nome_interno === 'INIT');
const menu = renderizarEstado(estadoINIT, { nome_cliente: contact.nome });
```

---

### **GAP 3: Estados Fixos vs Configuráveis**

**Hoje (Fixo):**
```javascript
INIT → WAITING_SECTOR_CHOICE → WAITING_ATTENDANT_CHOICE → COMPLETED
```

**Debate Propõe (Dinâmico):**
```javascript
Playbook A: INIT → QUALIFICACAO → ROTEAMENTO → COMPLETED
Playbook B: INIT → MENU_STICKY → ESCOLHA_SETOR → COMPLETED
Playbook C: INIT → IA_DIRETO → COMPLETED
```

---

## 🎯 **PLANO ESTRATÉGICO DE MIGRAÇÃO**

### **FASE 1: ESTRUTURA DE DADOS (Sem quebrar nada)**

#### **1.1 Expandir FlowTemplate**
```javascript
// Adicionar campos faltantes
FlowTemplate {
  // ... campos existentes ...
  
  // NOVO: Configurações globais
  config_global: {
    ttl_completed_horas: 24,
    gap_novo_ciclo_horas: 12,
    usar_ia_no_init: true,
    limiar_confianca_ia: 70,
    timeout_padrao_minutos: 10,
    mensagem_timeout: "⏰ Tempo esgotado...",
    mensagem_cancelamento: "❌ Atendimento cancelado..."
  },
  
  // NOVO: Estados configuráveis
  estados: [
    {
      id: "state_init_001",
      nome_interno: "INIT",
      titulo_admin: "Boas-vindas e Detecção",
      
      // Comportamento
      usar_ia_fast_track: true,
      usar_sticky_memory: true,
      usar_guardian_mode: true,
      
      // Mensagem
      mensagem_template: "Olá {{nome_cliente}}! {{saudacao}}, para qual setor?",
      tipo_entrada: "buttons", // buttons | text | number | skip
      
      // Opções (se tipo_entrada = buttons)
      opcoes: [
        { 
          id: "btn_vendas", 
          label: "💼 Vendas",
          emoji: "💼",
          acao: "setar_setor",
          valor: "vendas"
        }
      ],
      
      // Transições
      transicoes: [
        {
          condicao_tipo: "ia_confianca_alta",
          condicao_valor: 70,
          proximo_estado: "WAITING_ATTENDANT_CHOICE",
          acoes_pre: ["setar_sector_id_da_ia"]
        },
        {
          condicao_tipo: "sticky_aceito",
          proximo_estado: "WAITING_ATTENDANT_CHOICE",
          acoes_pre: ["manter_sector_id_anterior"]
        },
        {
          condicao_tipo: "escolha_manual",
          proximo_estado: "WAITING_SECTOR_CHOICE"
        }
      ],
      
      // Validações
      max_tentativas: 3,
      mensagem_erro: "❌ Opção inválida. Tente novamente."
    }
  ]
}
```

#### **1.2 Criar SubFlowTemplate (Estados Reutilizáveis)**
```javascript
SubFlowTemplate {
  nome: "Menu 4 Setores Padrão",
  tipo: "menu_escolha",
  estado_equivalente: "WAITING_SECTOR_CHOICE",
  
  mensagem: "Escolha o setor:",
  opcoes: [
    { id: "setor_vendas", label: "💼 Vendas", valor: "vendas" },
    { id: "setor_financeiro", label: "💰 Financeiro", valor: "financeiro" }
  ],
  
  validacao: {
    aceita_texto: true,
    aceita_numero: true,
    keywords: { "vendas": "vendas", "1": "vendas" }
  }
}
```

---

### **FASE 2: REFATORAÇÃO DO EXECUTOR (Mantém Retrocompatibilidade)**

#### **2.1 FluxoController Híbrido**

**Arquivo:** `functions/preAtendimento/fluxoControllerV11.js`

```javascript
export class FluxoControllerV11 {
  
  // Construtor recebe playbook (novo) ou usa lógica legada
  constructor(playbook = null) {
    this.playbook = playbook;
    this.usarPlaybook = playbook !== null;
  }
  
  async processarEstado(base44, thread, contact, integrationId, userInput, intentContext) {
    const estadoAtual = thread.pre_atendimento_state || 'INIT';
    
    // MODO NOVO: Ler do playbook
    if (this.usarPlaybook) {
      const estadoConfig = this.playbook.estados.find(e => e.nome_interno === estadoAtual);
      
      if (!estadoConfig) {
        throw new Error(`Estado ${estadoAtual} não encontrado no playbook`);
      }
      
      return await this.executarEstadoConfiguravel(
        base44, thread, contact, integrationId, 
        estadoConfig, userInput, intentContext
      );
    }
    
    // MODO LEGADO: Hardcoded (retrocompatibilidade)
    return await this.executarEstadoLegado(
      base44, thread, contact, integrationId, 
      estadoAtual, userInput, intentContext
    );
  }
  
  async executarEstadoConfiguravel(base44, thread, contact, integrationId, estadoConfig, userInput, intentContext) {
    // 1. Avaliar transições
    for (const transicao of estadoConfig.transicoes) {
      const match = await this.avaliarCondicao(transicao, userInput, intentContext, thread);
      
      if (match) {
        // Executar ações pré-transição
        for (const acao of transicao.acoes_pre || []) {
          await this.executarAcao(base44, thread, contact, acao, match.valor);
        }
        
        // Enviar mensagem do estado destino
        const proximoEstado = this.playbook.estados.find(e => e.nome_interno === transicao.proximo_estado);
        if (proximoEstado) {
          const mensagem = this.renderizarMensagem(proximoEstado.mensagem_template, {
            nome_cliente: contact.nome,
            saudacao: this.gerarSaudacao()
          });
          
          await this.enviarMensagem(base44, contact, integrationId, mensagem, proximoEstado.opcoes);
        }
        
        // Atualizar estado
        await this.atualizarEstado(base44, thread.id, transicao.proximo_estado);
        
        return { success: true, transicao: transicao.proximo_estado };
      }
    }
    
    // Nenhuma transição ativa → mensagem de erro
    const mensagemErro = estadoConfig.mensagem_erro || "Entrada inválida.";
    await this.enviarMensagem(base44, contact, integrationId, mensagemErro);
    return { success: false, erro: 'transicao_nao_encontrada' };
  }
  
  async avaliarCondicao(transicao, userInput, intentContext, thread) {
    switch (transicao.condicao_tipo) {
      case 'ia_confianca_alta':
        if (intentContext?.confidence >= transicao.condicao_valor) {
          return { match: true, valor: intentContext.sector_slug };
        }
        break;
      
      case 'sticky_aceito':
        const entrada = userInput.content?.toLowerCase() || userInput.id || '';
        if (['sticky_sim', 'sim', '1'].some(x => entrada.includes(x))) {
          return { match: true, valor: thread.sector_id };
        }
        break;
      
      case 'botao_clicado':
        if (userInput.type === 'button' && userInput.id) {
          // Buscar opção correspondente no estado atual
          const opcao = estadoConfig.opcoes?.find(o => o.id === userInput.id);
          if (opcao) {
            return { match: true, valor: opcao.valor };
          }
        }
        break;
      
      case 'escolha_manual':
        return { match: true }; // Sempre aceita
    }
    
    return { match: false };
  }
  
  async executarAcao(base44, thread, contact, acao, valor) {
    switch (acao) {
      case 'setar_sector_id':
      case 'setar_sector_id_da_ia':
      case 'manter_sector_id_anterior':
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          sector_id: valor || thread.sector_id
        });
        break;
      
      case 'limpar_assigned':
        await base44.asServiceRole.entities.MessageThread.update(thread.id, {
          assigned_user_id: null,
          assigned_user_name: null
        });
        break;
      
      case 'chamar_roteamento':
        await base44.asServiceRole.functions.invoke('roteamentoInteligente', {
          thread_id: thread.id,
          contact_id: contact.id,
          sector: valor
        });
        break;
    }
  }
  
  // ... resto do código legado ...
}
```

---

### **FASE 3: INTERFACE "MEUS PLAYBOOKS" (Nova Página)**

#### **3.1 Componente: PlaybookEditorURA**

**Arquivo:** `components/automacao/PlaybookEditorURA.jsx`

**Funcionalidades:**
- 📝 Editar mensagens de cada estado (com variáveis {{nome_cliente}})
- 🔘 Configurar botões e suas ações
- 🔀 Definir transições entre estados (diagrama visual ou lista)
- ⚙️ Configurar TTL, gap de ciclo, limiar IA
- 🧪 Testar fluxo (simulador)
- 📊 Ver métricas (taxa de abandono por estado)

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ [Meus Playbooks de URA]            [+ Novo Playbook]│
├─────────────────────────────────────────────────────┤
│                                                      │
│  📋 URA Padrão WhatsApp              [✏️ Editar]   │
│  ├─ INIT (Boas-vindas)               [▼]           │
│  ├─ WAITING_SECTOR_CHOICE            [▼]           │
│  ├─ WAITING_ATTENDANT_CHOICE         [▼]           │
│  └─ WAITING_QUEUE_DECISION           [▼]           │
│                                                      │
│  [Configurações Globais]             [▼]           │
│  ├─ TTL COMPLETED: 24h               [Edit]        │
│  ├─ Gap Novo Ciclo: 12h              [Edit]        │
│  ├─ Usar IA no INIT: ✅              [Toggle]      │
│  └─ Limiar IA: 70%                   [Slider]      │
│                                                      │
│  [Métricas]                          [Ver Relatório]│
│  ├─ Taxa Conclusão: 87%                             │
│  ├─ Taxa Abandono: 13%                              │
│  └─ Tempo Médio: 2min 34s                           │
└─────────────────────────────────────────────────────┘
```

---

#### **3.2 Componente: EstadoEditor**

**Expandível ao clicar em cada estado:**

```
┌─────────────────────────────────────────────────────┐
│ Estado: INIT (Boas-vindas)           [🗑️ Deletar]  │
├─────────────────────────────────────────────────────┤
│                                                      │
│ 📝 Mensagem:                                        │
│ ┌───────────────────────────────────────────────┐  │
│ │ Olá {{nome_cliente}}! {{saudacao}},           │  │
│ │ para qual setor você gostaria de falar?       │  │
│ └───────────────────────────────────────────────┘  │
│                                                      │
│ 🎛️ Comportamento:                                   │
│ ☑️ Usar IA Fast-Track (>=70% confiança)            │
│ ☑️ Oferecer Sticky (se tem setor anterior)         │
│ ☑️ Modo Guardião (se humano ausente)               │
│                                                      │
│ 🔘 Tipo de Entrada:                                 │
│ ( ) Texto livre  (•) Botões  ( ) Número  ( ) Skip  │
│                                                      │
│ 📋 Opções de Botão:                                 │
│ ┌─────────────────────────────────────────────┐    │
│ │ 1. 💼 Vendas     → setor: vendas           │    │
│ │ 2. 💰 Financeiro → setor: financeiro       │    │
│ │ 3. 🔧 Suporte    → setor: assistencia      │    │
│ │                           [+ Adicionar]     │    │
│ └─────────────────────────────────────────────┘    │
│                                                      │
│ 🔀 Transições:                                      │
│ ┌─────────────────────────────────────────────┐    │
│ │ SE: IA Confiança >= 70%                     │    │
│ │ ENTÃO: WAITING_ATTENDANT_CHOICE             │    │
│ │ AÇÕES: [Setar sector_id da IA]             │    │
│ │                                              │    │
│ │ SE: Escolha manual                          │    │
│ │ ENTÃO: WAITING_SECTOR_CHOICE                │    │
│ └─────────────────────────────────────────────┘    │
│                           [+ Nova Transição]        │
│                                                      │
│ ⏱️ Timeout: 10 minutos                              │
│ ❌ Máx Tentativas: 3                                │
│                                                      │
│             [💾 Salvar]  [🧪 Testar Estado]         │
└─────────────────────────────────────────────────────┘
```

---

### **FASE 2: MIGRAÇÃO DO EXECUTOR (Gradual)**

#### **2.1 Criar FluxoControllerV11 (Híbrido)**

**Estratégia:** Suporta AMBOS os modos (legado + configurável)

```javascript
// preAtendimentoHandler.js (MUDANÇA MÍNIMA)

const playbook = await buscarPlaybookAtivo(base44, whatsapp_integration_id);

const controller = playbook 
  ? new FluxoControllerV11(playbook)  // Modo novo
  : new FluxoController();             // Modo legado

const resultado = await controller.processarEstado(
  base44, thread, contact, whatsapp_integration_id, 
  user_input, intent_context
);
```

**Benefício:**  
- ✅ Apps antigos continuam funcionando (sem playbook = legado)
- ✅ Apps novos usam configuração (com playbook = novo)
- ✅ Migração gradual sem big bang

---

#### **2.2 MenuBuilder Dinâmico**

```javascript
// menuBuilder.js V11

export class MenuBuilderV11 {
  
  static renderizarEstado(estadoConfig, variaveis = {}) {
    // Substituir variáveis
    let mensagem = estadoConfig.mensagem_template;
    
    for (const [chave, valor] of Object.entries(variaveis)) {
      mensagem = mensagem.replaceAll(`{{${chave}}}`, valor);
    }
    
    // Se tem botões
    if (estadoConfig.tipo_entrada === 'buttons' && estadoConfig.opcoes) {
      return {
        type: 'interactive_buttons',
        body: mensagem,
        buttons: estadoConfig.opcoes.map(opcao => ({
          id: opcao.id,
          text: `${opcao.emoji || ''} ${opcao.label}`.trim()
        }))
      };
    }
    
    // Se é texto livre
    return mensagem;
  }
  
  // Manter métodos legados para retrocompatibilidade
  static construirMenuBoasVindas(nomeContato) {
    // Código antigo...
  }
}
```

---

### **FASE 3: TELA DE GESTÃO (Interface)**

#### **3.1 Página: MeusPlaybooksURA**

**Arquivo:** `pages/MeusPlaybooksURA.js`

**Funcionalidades:**
1. **Lista de Playbooks**
   - Ver todos os playbooks tipo `pre_atendimento`
   - Ativar/desativar
   - Duplicar
   - Deletar

2. **Editor de Playbook**
   - Aba "Estados" → Lista expandível com EstadoEditor
   - Aba "Configurações Globais" → TTL, gap, IA
   - Aba "Métricas" → Taxa conclusão, abandono, tempo médio
   - Aba "Simulador" → Testar fluxo passo a passo

3. **Wizard de Criação**
   - Template pré-pronto: "URA 4 Setores", "URA com IA", "URA Minimalista"
   - Clonar existente e customizar

---

### **FASE 4: MIGRAÇÃO DE DADOS (Script Único)**

#### **4.1 Converter Código Legado → FlowTemplate**

**Arquivo:** `functions/migrarURAParaPlaybook.js`

```javascript
// Ler lógica hardcoded do fluxoController
// Gerar FlowTemplate equivalente
// Inserir no banco

const playbookPadrao = {
  nome: "URA Padrão Migrada (v10 → v11)",
  tipo_fluxo: "pre_atendimento",
  is_pre_atendimento_padrao: true,
  ativo: true,
  
  config_global: {
    ttl_completed_horas: 24,
    gap_novo_ciclo_horas: 12,
    usar_ia_no_init: true,
    limiar_confianca_ia: 70
  },
  
  estados: [
    // Extraído do código atual
    { nome_interno: "INIT", ... },
    { nome_interno: "WAITING_SECTOR_CHOICE", ... }
  ]
};

await base44.asServiceRole.entities.FlowTemplate.create(playbookPadrao);
```

---

## 🚀 **ROADMAP DE IMPLEMENTAÇÃO**

### **Sprint 1: Fundação (1 semana)**
- [ ] Expandir schema `FlowTemplate` com campos novos
- [ ] Criar entidade `SubFlowTemplate` (estados reutilizáveis)
- [ ] Script de migração: converter lógica atual → playbook no banco
- [ ] Teste: playbook gerado funciona no modo legado

### **Sprint 2: Executor Híbrido (1 semana)**
- [ ] Criar `FluxoControllerV11` com suporte dual
- [ ] Refatorar `preAtendimentoHandler` para detectar playbook
- [ ] Criar `MenuBuilderV11` com renderização dinâmica
- [ ] Teste: app funciona em AMBOS os modos (com/sem playbook)

### **Sprint 3: Interface (2 semanas)**
- [ ] Criar página `MeusPlaybooksURA`
- [ ] Componente `PlaybookEditorURA` (lista + editor)
- [ ] Componente `EstadoEditor` (mensagem + opções + transições)
- [ ] Componente `SimuladorURA` (teste interativo)
- [ ] Métricas e analytics por playbook

### **Sprint 4: Deprecação do Legado (1 semana)**
- [ ] Migrar TODOS os apps para playbook
- [ ] Marcar `fluxoController.js` como deprecated
- [ ] Remover código legado do `FluxoControllerV11`
- [ ] Documentação completa

---

## 📋 **CHECKLIST DE VALIDAÇÃO**

### **Antes da Migração:**
- [x] Lógica atual funciona (v10 estável)
- [x] Estados mapeados: INIT, WAITING_SECTOR_CHOICE, WAITING_STICKY_DECISION, WAITING_ATTENDANT_CHOICE, WAITING_QUEUE_DECISION
- [x] Guardas identificadas: humano ativo, novo ciclo, micro-URA
- [x] Bypass identificados: continuidade, fidelização, horário

### **Durante a Migração:**
- [ ] Schema FlowTemplate expandido SEM quebrar existente
- [ ] Playbook padrão gerado corretamente
- [ ] FluxoControllerV11 funciona em modo legado
- [ ] FluxoControllerV11 funciona em modo configurável
- [ ] Interface permite edição completa

### **Após a Migração:**
- [ ] Admin pode criar playbook sem código
- [ ] Admin pode editar mensagens sem deploy
- [ ] Admin pode adicionar novo setor sem código
- [ ] Métricas por playbook funcionando
- [ ] Código legado removido

---

## 🎯 **RESUMO EXECUTIVO**

### **O QUE TEMOS HOJE:**
✅ URA funcional com estados bem definidos  
✅ Pipeline robusto (inboundCore + motorDecisao)  
✅ Guardas inteligentes (humano ativo, novo ciclo)  
🔴 **Tudo HARDCODED** - impossível customizar

### **O QUE O DEBATE PROPÕE:**
✅ FlowTemplate como "cérebro configurável"  
✅ Estados viram nós editáveis  
✅ Transições viram regras configuráveis  
✅ Interface unificada "Meus Playbooks"

### **SOLUÇÃO HÍBRIDA:**
1. **Expandir FlowTemplate** com campos faltantes
2. **Criar FluxoControllerV11** que lê do banco OU usa legado
3. **Migrar dados** via script (código → playbook)
4. **Criar interface** para edição visual
5. **Deprecar legado** após migração completa

### **BENEFÍCIOS:**
- 🚀 Zero downtime (migração gradual)
- 🎨 Customização sem código (admin edita UI)
- 🔄 Retrocompatibilidade (legado funciona)
- 📊 Métricas granulares por playbook
- 🧪 Facilita A/B testing de fluxos

---

## ⚠️ **PONTOS DE ATENÇÃO**

### **1. Backward Compatibility**
- Apps sem playbook devem continuar funcionando
- Migração opcional, não forçada
- Modo legado marcado como deprecated mas funcional

### **2. Performance**
- Carregar playbook 1x por conversa (cache)
- Não buscar estados a cada mensagem
- Índice em `FlowTemplate.is_pre_atendimento_padrao`

### **3. Validação**
- Schema JSON para validar estrutura de estados
- Validar loops infinitos nas transições
- Prevenir estados órfãos (sem transição de entrada)

### **4. Testes**
- Simulador visual antes de deploy
- Teste unitário de cada estado
- Teste E2E do fluxo completo

---

## 🎬 **PRÓXIMOS PASSOS IMEDIATOS**

1. **Validar entendimento** com o usuário
2. **Definir prioridade** (qual sprint começar)
3. **Expandir schema** FlowTemplate
4. **Criar script de migração** (código → playbook)
5. **Prototipar interface** básica

**Pergunta para o usuário:**  
Por onde começamos? Prefere ver a interface primeiro (mockup) ou expandir o schema + script de migração?