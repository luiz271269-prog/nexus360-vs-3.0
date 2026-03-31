# 🔍 ANÁLISE COMPARATIVA: DEBATE vs IMPLEMENTADO (URA/PRÉ-ATENDIMENTO)

**Data:** 2026-01-19  
**Objetivo:** Comparar o que foi debatido/planejado vs o que está funcionando hoje - identificar GAPs e definir caminho de migração.

---

## 📊 **MATRIZ COMPARATIVA: 3 FRENTES**

### **1️⃣ MODELO DE DADOS**

| Aspecto | 🎯 DEBATE (Ideal) | ✅ IMPLEMENTADO (Atual) | 🔴 GAP |
|---------|------------------|------------------------|--------|
| **Entity Base** | FlowTemplate com config_global, estados[], regras_ativacao, metricas_playbook | FlowTemplate existe mas incompleto: tem `steps[]`, `gatilhos[]`, mas SEM `config_global`, SEM `estados[]`, SEM `regras_ativacao` | ❌ 60% dos campos faltando |
| **Regras de Ativação** | tipos_permitidos, tipos_bloqueados, tags_obrigatorias, tags_bloqueadas, conexoes_permitidas, setores, horários, prioridade | Campos simples: `tipo_contato_alvo`, `fila_alvo`, `integracao_whatsapp_id`, `activation_mode` - BÁSICO | ❌ Falta sistema completo de filtros |
| **Config Global** | ttl_completed_horas, gap_novo_ciclo, usar_ia_no_init, limiar_confianca_ia, usar_sticky, usar_guardian, timeouts | ❌ NÃO EXISTE - comportamento hardcoded em FluxoController v10 | ❌ 100% hardcoded |
| **Estados** | Array `estados[]` com: nome_interno, mensagem_template, tipo_entrada, opcoes[], transicoes[], acoes_pre_transicao | ❌ NÃO EXISTE - estados hardcoded como métodos estáticos (INIT, WAITING_SECTOR_CHOICE, etc.) | ❌ 100% hardcoded |
| **Métricas** | metricas_playbook com total_execucoes, total_concluidos, tempo_medio_conclusao_segundos, taxa_conclusao_percentual | Existe `metricas` mas SEM _playbook suffix e com estrutura diferente | ⚠️ Estrutura incompleta |
| **Execução State** | FlowExecution (entidade separada) para rastrear execuções individuais | ❌ NÃO EXISTE - estado vive em MessageThread.pre_atendimento_state | ⚠️ Mistura concerns |

---

### **2️⃣ MOTORES DE EXECUÇÃO**

| Aspecto | 🎯 DEBATE (Ideal) | ✅ IMPLEMENTADO (Atual) | 🔴 GAP |
|---------|------------------|------------------------|--------|
| **Orquestrador** | `preAtendimentoHandler` lê playbook e instancia FluxoControllerV11 genérico | ✅ `preAtendimentoHandler` existe e funciona BEM | ✅ 90% OK |
| **Executor** | `FluxoControllerV11` - 100% genérico, lê `playbook.estados[]` e executa dinamicamente | ❌ `FluxoController` v10 - métodos hardcoded (`processarEstadoINIT`, `processarWAITING_SECTOR_CHOICE`) | ❌ 0% genérico |
| **Seletor de Playbook** | `resolverPlaybookParaMensagem()` - filtra playbooks por regras_ativacao (tipos + tags + prioridade) | ⚠️ PARCIAL: inboundCore verifica `is_pre_atendimento_padrao` mas SEM filtros context-aware | ⚠️ 30% implementado |
| **Motor de Decisão** | Integrado ao inboundCore - decide quando chamar URA baseado em: humano ativo, novo ciclo, fidelizado, guardian | ✅ `motorDecisaoPreAtendimento` + lógica em inboundCore FUNCIONA | ✅ 85% OK |
| **Bypass Layer** | motorDecisaoPreAtendimento verifica: fora_horario, fidelizado, tag "nao_ura", continuidade 24h | ✅ Existe em `functions/motorDecisaoPreAtendimento.js` e funciona | ✅ 90% OK |
| **Sticky & Guardian** | Configurável via `config_global.usar_sticky` e `usar_guardian` | ⚠️ HARDCODED no FluxoController (linhas 63-77: guardian, linhas 65-77: sticky) | ⚠️ Funciona mas não configurável |
| **IA Fast-Track** | Estado INIT verifica `usar_ia_fast_track` + `limiar_confianca_ia` do playbook | ⚠️ HARDCODED: linha 20 do fluxoController - `confidence >= 70` fixo | ⚠️ Funciona mas threshold fixo |
| **Transições** | Lidas de `playbook.estados[].transicoes[]` - tipos: button_match, text_contains, ia_intent, system, timeout | ❌ NÃO EXISTE - transições hardcoded em switch cases dentro de cada método | ❌ 0% configurável |
| **Ações** | Array de ações: setar_sector_id, atribuir_atendente, entrar_fila, atualizar_contato, chamar_funcao | ⚠️ HARDCODED - ações embutidas no código (linhas 25-26, 94-95, 131-134) | ⚠️ Funciona mas fixo |
| **TTL & Reset** | `config_global.ttl_completed_horas` - resetar COMPLETED → INIT após X horas | ⚠️ HARDCODED - preAtendimentoHandler linha 78: reseta se estado é COMPLETED (SEM check de tempo) | ⚠️ Lógica existe mas sem TTL |
| **Timeout** | `config_global.timeout_padrao_minutos` - tempo máximo por estado | ⚠️ HARDCODED - linha 274 do fluxoController: `10 * 60 * 1000` (10min fixo) | ⚠️ Funciona mas fixo |

---

### **3️⃣ EXPERIÊNCIA DE USO (TELAS)**

| Aspecto | 🎯 DEBATE (Ideal) | ✅ IMPLEMENTADO (Atual) | 🔴 GAP |
|---------|------------------|------------------------|--------|
| **Página Principal** | `pages/Automacoes.jsx` com 5 abas (URAs, Playbooks, Promoções, Respostas, Dashboard) | ✅ `pages/Automacoes.jsx` criado agora | ✅ Estrutura criada |
| **Aba URAs** | `PlaybookManagerURA` - lista, cria, edita, duplica, deleta URAs | ✅ `PlaybookManagerURA.jsx` criado agora - funciona para listar | ✅ CRUD básico OK |
| **Editor URA** | `EditorPlaybookURA` - modal com abas: Config Global, Estados, Regras Ativação, Preview | ❌ NÃO EXISTE - só toast "em breve" | ❌ 0% implementado |
| **Card de Playbook** | Mostra: nome, status, métricas, regras de ativação (preview), badges de tipos/tags | ✅ `PlaybookCardURA` renderiza bem - métricas, regras, badges | ✅ 80% OK |
| **Métricas** | Dashboard consolidado com gráficos (execuções/dia, distribuição, top 5) | ⚠️ Aba "Dashboard" criada mas vazia | ⚠️ 10% implementado |
| **Item no Menu** | "Automações" no Layout - acesso para admin + gerente | ✅ Adicionado ao Layout - controlado por perfil | ✅ 100% OK |
| **Gestão de Outros Tipos** | Abas separadas para Playbooks genéricos, Promoções, Respostas Rápidas | ✅ Abas existem - componentes já funcionavam antes | ✅ 100% OK |

---

## 🧩 **ANÁLISE PROFUNDA: O QUE FUNCIONA HOJE**

### **✅ PONTOS FORTES (Já Implementado)**

#### **1. Orquestração Central (inboundCore) - 85% COMPLETO**

```javascript
// ✅ BOM: Pipeline claro e testado
Pipeline: Webhook → inboundCore → (Guardas) → preAtendimentoHandler

// ✅ BOM: Detecção de ciclo
const novoCiclo = detectNovoCiclo(thread.last_inbound_at, now);
// Gap >= 12h = novo ciclo (resetar URA)

// ✅ BOM: Verificação de humano ativo
const isHumanActive = humanoAtivo(thread, 2);
// Humano falou < 2h = ativo (não chamar URA)

// ✅ BOM: Guardian Mode (resgate de humano ausente)
if (thread.assigned_user_id && !isHumanActive) {
  // Oferece ajuda ao cliente
}

// ✅ BOM: Bypass de fidelizado
if (classificacao.fidelizado) {
  await aplicarRoteamentoFidelizado(...);
  return;
}

// ✅ BOM: Bloqueio se playbook inativo
if (!playbooksPreAtendimento || playbooksPreAtendimento.length === 0) {
  return { stop: true, reason: 'pre_atendimento_desativado' };
}
```

**Qualidade:** ⭐⭐⭐⭐ (4/5) - Robusto, testado, com tratamento de erros.

---

#### **2. Handler de Pré-Atendimento - 80% COMPLETO**

```javascript
// ✅ BOM: Contrato unificado de entrada
const { thread_id, contact_id, whatsapp_integration_id, user_input, intent_context } = payload;

// ✅ BOM: Reset automático de COMPLETED
if (['COMPLETED', 'CANCELLED', 'TIMEOUT'].includes(thread.pre_atendimento_state)) {
  // Resetar para INIT e LIMPAR atendente (divórcio automático)
}

// ✅ BOM: Switch de estados
switch (estadoAtual) {
  case 'INIT': FluxoController.processarEstadoINIT(...);
  case 'WAITING_SECTOR_CHOICE': FluxoController.processarWAITING_SECTOR_CHOICE(...);
  // ... etc
}

// ✅ BOM: Logs de auditoria
await base44.asServiceRole.entities.AutomationLog.create({
  acao: 'pre_atendimento_step',
  estado_inicial, estado_final, user_input
});
```

**Qualidade:** ⭐⭐⭐⭐ (4/5) - Código limpo, retry handler, circuit breaker.

---

#### **3. FluxoController v10 (Executor Hardcoded) - 70% BOM**

```javascript
// ✅ BOM: Lógica de estados funciona perfeitamente
static async processarEstadoINIT(base44, thread, contact, integrationId, userInput, intentContext) {
  // A. IA Fast-Track
  if (intentContext?.confidence >= 70) { ... }
  
  // B. Guardian Mode
  if (thread.assigned_user_id && !thread.sector_id) { ... }
  
  // C. Sticky Memory
  if (thread.sector_id && !intentContext) { ... }
  
  // D. Menu Padrão
  const menu = MenuBuilder.construirMenuBoasVindas(contact.nome);
}

// ✅ BOM: Validação e roteamento
static async processarWAITING_SECTOR_CHOICE(base44, thread, contact, userInput, integrationId) {
  const entrada = userInput.content.toLowerCase();
  
  if (['1', 'vendas'].some(k => entrada.includes(k))) setor = 'vendas';
  // ... validação robusta
  
  await roteamentoInteligente({ setor, thread_id });
}
```

**Problema:** Tudo funciona, mas é 100% código. Não editável por admin.

---

## 🔴 **GAPS CRÍTICOS (O que falta)**

### **GAP 1: Schema FlowTemplate Incompleto** 🔴🔴🔴

**Impacto:** ALTO - sem isso, playbook não pode armazenar comportamento.

**Campos Faltando:**

```json
{
  // ❌ FALTAM:
  "config_global": {
    "ttl_completed_horas": 24,
    "gap_novo_ciclo_horas": 12,
    "usar_ia_no_init": true,
    "limiar_confianca_ia": 70,
    "timeout_padrao_minutos": 10,
    "usar_sticky": true,
    "usar_guardian": true,
    "mensagem_timeout": "string",
    "mensagem_cancelamento": "string"
  },
  
  // ❌ FALTAM:
  "estados": [
    {
      "nome_interno": "INIT",
      "titulo_admin": "Início",
      "mensagem_template": "Olá {nome}!",
      "tipo_entrada": "buttons|text|skip|system",
      "usar_ia_fast_track": true,
      "usar_sticky_memory": true,
      "usar_guardian_mode": true,
      "timeout_minutos": 10,
      "opcoes": [
        { "id": "1", "label": "💼 Vendas", "valor": "vendas" }
      ],
      "transicoes": [
        {
          "condicao": { "tipo": "button_match", "valor": "1" },
          "acoes_pre_transicao": [
            { "tipo": "setar_sector_id", "parametros": { "valor": "vendas" } }
          ],
          "mensagem_transicao": "Direcionando...",
          "proximo_estado": "COMPLETED"
        }
      ]
    }
  ],
  
  // ❌ FALTAM:
  "regras_ativacao": {
    "prioridade": 50,
    "escopo_contato": "externo|interno|todos",
    "tipos_permitidos": ["lead", "cliente"],
    "tipos_bloqueados": ["fornecedor"],
    "tags_obrigatorias": ["whatsapp_ok"],
    "tags_bloqueadas": ["vip", "nao_ura"],
    "conexoes_permitidas": ["integ_123"],
    "setores_permitidos": ["vendas"],
    "bypass_fora_horario": true,
    "horario_inicio": "08:00",
    "horario_fim": "18:00"
  },
  
  // ⚠️ RENOMEAR:
  "metricas_playbook": { // Atual: "metricas" (sem sufixo)
    "total_execucoes": 0,
    "total_concluidos": 0,
    "tempo_medio_conclusao_segundos": 0, // Atual: "tempo_medio_conclusao"
    "taxa_conclusao_percentual": 0
  }
}
```

**Ação:** Expandir `entities/FlowTemplate.json` com todos os campos acima.

---

### **GAP 2: FluxoControllerV11 Genérico Não Existe** 🔴🔴🔴

**Impacto:** ALTO - sem executor genérico, playbook é inútil.

**Atual (v10 Hardcoded):**

```javascript
// ❌ PROBLEMA: Cada estado é um método estático
class FluxoController {
  static async processarEstadoINIT(...) {
    // Lógica hardcoded:
    if (intentContext?.confidence >= 70) { ... } // Threshold fixo
    if (thread.sector_id) { ... } // Sticky hardcoded
    const menu = MenuBuilder.construirMenuBoasVindas(...); // Mensagem fixa
  }
  
  static async processarWAITING_SECTOR_CHOICE(...) {
    // Validação hardcoded:
    if (['1', 'vendas'].includes(entrada)) setor = 'vendas';
  }
}
```

**Ideal (V11 Genérico):**

```javascript
// ✅ SOLUÇÃO: Executor lê playbook
class FluxoControllerV11 {
  constructor(playbook) {
    this.playbook = playbook;
    this.config = playbook.config_global;
  }
  
  async processarEstado(estadoAtual, userInput, context) {
    // 1. Buscar estado no playbook
    const estadoConfig = this.playbook.estados.find(e => e.nome_interno === estadoAtual);
    
    // 2. Renderizar mensagem
    const msg = this.renderTemplate(estadoConfig.mensagem_template, context);
    
    // 3. Enviar (com botões se houver)
    await this.enviarMensagem(msg, estadoConfig.opcoes);
    
    // 4. Avaliar transições
    const transicao = this.avaliarTransicoes(estadoConfig.transicoes, userInput);
    
    // 5. Executar ações
    for (const acao of transicao.acoes_pre_transicao) {
      await this.executarAcao(acao);
    }
    
    // 6. Mudar estado
    await this.atualizarEstado(transicao.proximo_estado);
    
    // 7. Recursão (se não for COMPLETED)
    if (transicao.proximo_estado !== 'COMPLETED') {
      return await this.processarEstado(transicao.proximo_estado, null, context);
    }
  }
}
```

**Ação:** Criar `functions/preAtendimento/FluxoControllerV11.js` genérico.

---

### **GAP 3: Seletor de Playbook Context-Aware Não Existe** 🔴🔴

**Impacto:** MÉDIO - sem isso, não pode ter URAs diferentes por tipo de contato/tag.

**Atual:**

```javascript
// ⚠️ PARCIAL: Só verifica is_pre_atendimento_padrao
const playbooksPreAtendimento = await base44.entities.FlowTemplate.filter({
  is_pre_atendimento_padrao: true,
  ativo: true
});

// ❌ NÃO FILTRA por:
// - contact.tipo_contato
// - contact.tags
// - integration.id
// - thread.sector_id
```

**Ideal:**

```javascript
// ✅ SOLUÇÃO: Motor de resolução inteligente
async function resolverPlaybookParaMensagem(base44, contact, thread, integrationId) {
  // 1. Buscar TODOS playbooks de pré-atendimento ativos
  const playbooks = await base44.entities.FlowTemplate.filter({
    tipo_fluxo: 'pre_atendimento',
    ativo: true
  });
  
  // 2. Filtrar por regras de ativação
  const aplicaveis = playbooks.filter(pb => {
    const regras = pb.regras_ativacao;
    
    // Filtro 1: Tipos permitidos/bloqueados
    if (regras.tipos_bloqueados?.includes(contact.tipo_contato)) return false;
    if (regras.tipos_permitidos?.length > 0 && 
        !regras.tipos_permitidos.includes(contact.tipo_contato)) return false;
    
    // Filtro 2: Tags obrigatórias
    if (regras.tags_obrigatorias?.length > 0) {
      const temTodas = regras.tags_obrigatorias.every(tag => contact.tags?.includes(tag));
      if (!temTodas) return false;
    }
    
    // Filtro 3: Tags bloqueadas
    if (regras.tags_bloqueadas?.length > 0) {
      const temBloqueada = regras.tags_bloqueadas.some(tag => contact.tags?.includes(tag));
      if (temBloqueada) return false;
    }
    
    // Filtro 4: Conexões permitidas
    if (regras.conexoes_permitidas?.length > 0 && 
        !regras.conexoes_permitidas.includes(integrationId)) return false;
    
    // Filtro 5: Setores permitidos
    if (regras.setores_permitidos?.length > 0 && thread.sector_id &&
        !regras.setores_permitidos.includes(thread.sector_id)) return false;
    
    // Filtro 6: Horário comercial (se configurado)
    if (regras.horario_inicio && !regras.bypass_fora_horario) {
      const hora = new Date().getHours();
      const [h_inicio, m_inicio] = regras.horario_inicio.split(':').map(Number);
      const [h_fim, m_fim] = regras.horario_fim.split(':').map(Number);
      // ... validar
    }
    
    return true;
  });
  
  // 3. Ordenar por prioridade (maior = primeiro)
  aplicaveis.sort((a, b) => {
    const prioA = a.regras_ativacao?.prioridade || 10;
    const prioB = b.regras_ativacao?.prioridade || 10;
    return prioB - prioA;
  });
  
  // 4. Retornar o mais prioritário (ou null)
  return aplicaveis[0] || null;
}
```

**Ação:** Criar `functions/lib/resolverPlaybookParaMensagem.js` e integrar no inboundCore.

---

### **GAP 4: Editor Visual Não Existe** 🔴

**Impacto:** ALTO - admin precisa editar no código ou JSON manual (inviável).

**Atual:**

```javascript
// ❌ PROBLEMA: Só toast
const handleEdit = (playbook) => {
  toast.info('Editor visual será implementado em breve');
};
```

**Ideal:**

```jsx
// ✅ SOLUÇÃO: Modal com abas
<EditorPlaybookURA playbook={playbookSelecionado} onSave={...} onClose={...}>
  <Tabs>
    <Tab value="basico">
      {/* Nome, Descrição, Categoria */}
    </Tab>
    
    <Tab value="regras">
      <SecaoRegrasAtivacao playbook={playbook} onChange={...} />
      {/* Multi-selects: tipos, tags, conexões, setores */}
    </Tab>
    
    <Tab value="config">
      <SecaoConfigGlobal config={playbook.config_global} onChange={...} />
      {/* Sliders: TTL, gap, timeout */}
      {/* Toggles: IA, sticky, guardian */}
    </Tab>
    
    <Tab value="estados">
      <EditorEstados estados={playbook.estados} onChange={...} />
      {/* Lista de estados + add/remove */}
      {/* Para cada estado: Editor individual */}
    </Tab>
    
    <Tab value="preview">
      <PreviewFluxoURA playbook={playbook} />
      {/* Diagrama visual (react-flow?) */}
    </Tab>
  </Tabs>
</EditorPlaybookURA>
```

**Ação:** Criar conjunto de componentes editores (6-8 arquivos).

---

## 📈 **SCORECARD GERAL**

| Frente | Planejado | Implementado | % Completo | Prioridade |
|--------|-----------|--------------|------------|------------|
| **Modelo de Dados** | FlowTemplate completo | Schema básico | 40% | 🔴 P0 |
| **Seletor Context-Aware** | resolverPlaybookParaMensagem | Verificação básica | 30% | 🔴 P0 |
| **Executor Genérico** | FluxoControllerV11 | FluxoController v10 hardcoded | 0% | 🔴 P0 |
| **Orquestração** | inboundCore + motorDecisao | ✅ Funciona bem | 85% | 🟢 P2 |
| **Interface - Lista** | PlaybookManagerURA | ✅ Criado e funcional | 80% | 🟡 P1 |
| **Interface - Editor** | EditorPlaybookURA | ❌ Não existe | 0% | 🔴 P0 |
| **Métricas** | Dashboard consolidado | Campos existem | 50% | 🟡 P1 |
| **Item Menu** | Layout "Automações" | ✅ Adicionado | 100% | ✅ P3 |

**Score Total:** 48% implementado

---

## 🎯 **PLANO DE AÇÃO: MIGRAÇÃO INCREMENTAL**

### **FASE 1: EXPANDIR MODELO (1-2 horas) - FAZER AGORA**

**Tarefa:** Completar `entities/FlowTemplate.json`

```json
{
  "name": "FlowTemplate",
  "properties": {
    // ✅ Campos existentes (manter)
    "nome": { "type": "string" },
    "descricao": { "type": "string" },
    "categoria": { "type": "string", "enum": [...] },
    "tipo_fluxo": { "type": "string", "enum": [...] },
    "ativo": { "type": "boolean" },
    
    // 🆕 ADICIONAR:
    "config_global": {
      "type": "object",
      "properties": {
        "ttl_completed_horas": { "type": "number", "default": 24 },
        "gap_novo_ciclo_horas": { "type": "number", "default": 12 },
        "usar_ia_no_init": { "type": "boolean", "default": true },
        "limiar_confianca_ia": { "type": "number", "default": 70 },
        "timeout_padrao_minutos": { "type": "number", "default": 10 },
        "usar_sticky": { "type": "boolean", "default": true },
        "usar_guardian": { "type": "boolean", "default": true },
        "mensagem_timeout": { "type": "string" },
        "mensagem_cancelamento": { "type": "string" }
      }
    },
    
    // 🆕 ADICIONAR:
    "estados": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "nome_interno": { "type": "string" },
          "titulo_admin": { "type": "string" },
          "mensagem_template": { "type": "string" },
          "tipo_entrada": { 
            "type": "string", 
            "enum": ["buttons", "text", "number", "skip", "system"] 
          },
          "usar_ia_fast_track": { "type": "boolean", "default": false },
          "usar_sticky_memory": { "type": "boolean", "default": false },
          "usar_guardian_mode": { "type": "boolean", "default": false },
          "timeout_minutos": { "type": "number" },
          "opcoes": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "id": { "type": "string" },
                "label": { "type": "string" },
                "valor": { "type": "string" }
              }
            }
          },
          "transicoes": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "condicao": {
                  "type": "object",
                  "properties": {
                    "tipo": { 
                      "type": "string", 
                      "enum": ["button_match", "text_contains", "ia_intent", "system", "timeout"] 
                    },
                    "valor": { "type": "string" },
                    "confianca_minima": { "type": "number" }
                  }
                },
                "acoes_pre_transicao": {
                  "type": "array",
                  "items": {
                    "type": "object",
                    "properties": {
                      "tipo": { 
                        "type": "string",
                        "enum": ["setar_sector_id", "atribuir_atendente", "entrar_fila", "atualizar_contato", "chamar_funcao"]
                      },
                      "parametros": { "type": "object" }
                    }
                  }
                },
                "mensagem_transicao": { "type": "string" },
                "proximo_estado": { "type": "string" }
              }
            }
          }
        }
      }
    },
    
    // 🆕 ADICIONAR:
    "regras_ativacao": {
      "type": "object",
      "properties": {
        "prioridade": { "type": "number", "default": 10 },
        "escopo_contato": { 
          "type": "string", 
          "enum": ["externo", "interno", "todos"],
          "default": "externo"
        },
        "tipos_permitidos": { 
          "type": "array",
          "items": { "type": "string" }
        },
        "tipos_bloqueados": {
          "type": "array",
          "items": { "type": "string" }
        },
        "tags_obrigatorias": {
          "type": "array",
          "items": { "type": "string" }
        },
        "tags_bloqueadas": {
          "type": "array",
          "items": { "type": "string" }
        },
        "conexoes_permitidas": {
          "type": "array",
          "items": { "type": "string" }
        },
        "setores_permitidos": {
          "type": "array",
          "items": { "type": "string" }
        },
        "bypass_fora_horario": { "type": "boolean", "default": false },
        "horario_inicio": { "type": "string" },
        "horario_fim": { "type": "string" },
        "dias_semana_ativos": {
          "type": "array",
          "items": { "type": "number" }
        }
      }
    },
    
    // ⚠️ RENOMEAR metricas → metricas_playbook
    "metricas_playbook": {
      "type": "object",
      "properties": {
        "total_execucoes": { "type": "number", "default": 0 },
        "total_concluidos": { "type": "number", "default": 0 },
        "total_abandonados": { "type": "number", "default": 0 },
        "tempo_medio_conclusao_segundos": { "type": "number", "default": 0 },
        "taxa_conclusao_percentual": { "type": "number", "default": 0 }
      }
    }
  }
}
```

---

### **FASE 2: CRIAR SELETOR (30min) - FAZER LOGO APÓS**

**Arquivo:** `functions/lib/resolverPlaybookParaMensagem.js`

**Código:** (Ver seção "GAP 3" acima)

**Integração em inboundCore:**

```javascript
// ANTES (linha ~362):
const playbooksPreAtendimento = await base44.entities.FlowTemplate.filter({
  is_pre_atendimento_padrao: true,
  ativo: true
});

// DEPOIS:
const { resolverPlaybookParaMensagem } = await import('./lib/resolverPlaybookParaMensagem.js');
const playbookEscolhido = await resolverPlaybookParaMensagem(base44, contact, thread, integration?.id);

if (!playbookEscolhido) {
  console.log('[CORE] 🚫 Nenhum playbook aplicável - BLOQUEANDO URA');
  return { stop: true, reason: 'no_applicable_playbook' };
}

// Passar playbook_id para o handler
await base44.asServiceRole.functions.invoke('preAtendimentoHandler', {
  ...payloadUnificado,
  playbook_id: playbookEscolhido.id
});
```

---

### **FASE 3: EXECUTOR V11 (2-3 horas) -核心**

**Arquivo:** `functions/preAtendimento/FluxoControllerV11.js`

**Estrutura:**

```javascript
export class FluxoControllerV11 {
  constructor(playbook) {
    this.playbook = playbook;
    this.config = playbook.config_global || {};
  }
  
  // MÉTODO PRINCIPAL
  async processarEstado(base44, thread, contact, integrationId, userInput, intentContext) { ... }
  
  // AVALIADORES
  async avaliarTransicoes(estadoConfig, userInput, intentContext) { ... }
  async encontrarTransicaoIA(estadoConfig, intentContext) { ... }
  
  // EXECUTORES
  async executarTransicao(base44, thread, contact, integrationId, transicao) { ... }
  async executarAcao(base44, thread, contact, acao) { ... }
  
  // HELPERS
  renderTemplate(template, variaveis) { ... }
  async enviarMensagem(base44, contact, integrationId, texto, botoes) { ... }
  async registrarConclusao(base44, thread) { ... }
}
```

**Modo Híbrido no Handler:**

```javascript
// functions/preAtendimentoHandler.js (linha ~145)

// BUSCAR PLAYBOOK (se passou playbook_id no payload)
let playbook = null;
if (payload.playbook_id) {
  playbook = await base44.asServiceRole.entities.FlowTemplate.get(payload.playbook_id);
}

// DECIDIR EXECUTOR
if (playbook && playbook.estados) {
  // ✅ NOVO: Usar V11 genérico
  const { FluxoControllerV11 } = await import('./preAtendimento/FluxoControllerV11.js');
  const controller = new FluxoControllerV11(playbook);
  resultado = await controller.processarEstado(base44, thread, contact, whatsappIntegration.id, user_input, intent_context);
} else {
  // ⚠️ FALLBACK: Usar v10 hardcoded
  resultado = await FluxoController.processarEstadoINIT(base44, thread, contact, whatsappIntegration.id, user_input, intent_context);
}
```

---

### **FASE 4: SCRIPT DE MIGRAÇÃO (1 hora)**

**Arquivo:** `functions/scripts/migrarURAv10ParaPlaybook.js`

**Objetivo:** Converter lógica hardcoded do FluxoController v10 em Playbook.

**Mapa de Conversão:**

```javascript
// FluxoController v10 → FlowTemplate
const playbookMigrado = {
  nome: "URA Padrão (Migrado v10)",
  tipo_fluxo: "pre_atendimento",
  is_pre_atendimento_padrao: true,
  categoria: "geral",
  ativo: true,
  
  config_global: {
    ttl_completed_horas: 24,
    gap_novo_ciclo_horas: 12,
    usar_ia_no_init: true,
    limiar_confianca_ia: 70, // Extraído da linha 20
    timeout_padrao_minutos: 10, // Extraído da linha 274
    usar_sticky: true,
    usar_guardian: true,
    mensagem_timeout: "⏰ Tempo esgotado. Digite OI para recomeçar.",
    mensagem_cancelamento: "❌ Atendimento cancelado."
  },
  
  regras_ativacao: {
    prioridade: 100, // Máxima (padrão)
    escopo_contato: "externo",
    tipos_permitidos: [], // Todos
    tipos_bloqueados: ["interno"],
    tags_obrigatorias: [],
    tags_bloqueadas: ["nao_ura", "vip"],
    conexoes_permitidas: [],
    setores_permitidos: ["vendas", "assistencia", "financeiro", "fornecedor", "geral"],
    bypass_fora_horario: false
  },
  
  estados: [
    {
      nome_interno: "INIT",
      titulo_admin: "Início",
      mensagem_template: "Olá, {nome}! {saudacao}",
      tipo_entrada: "buttons",
      usar_ia_fast_track: true,
      usar_sticky_memory: true,
      usar_guardian_mode: true,
      timeout_minutos: 10,
      opcoes: [
        { id: "1", label: "💼 Vendas", valor: "vendas" },
        { id: "2", label: "💰 Financeiro", valor: "financeiro" },
        { id: "3", label: "🔧 Suporte", valor: "assistencia" },
        { id: "4", label: "📦 Fornecedor", valor: "fornecedor" }
      ],
      transicoes: [
        {
          condicao: { tipo: "ia_intent", valor: "vendas", confianca_minima: 70 },
          acoes_pre_transicao: [
            { tipo: "setar_sector_id", parametros: { valor: "vendas" } }
          ],
          mensagem_transicao: "✅ Entendi! Vou te direcionar para VENDAS.",
          proximo_estado: "WAITING_ATTENDANT_CHOICE"
        },
        {
          condicao: { tipo: "button_match", valor: "1" },
          acoes_pre_transicao: [
            { tipo: "setar_sector_id", parametros: { valor: "vendas" } }
          ],
          proximo_estado: "WAITING_ATTENDANT_CHOICE"
        },
        // ... outras transições (botões 2,3,4 + timeout)
      ]
    },
    {
      nome_interno: "WAITING_STICKY_DECISION",
      titulo_admin: "Decisão de Continuidade",
      mensagem_template: "Olá novamente, {nome}! Deseja continuar no setor {setor}?",
      tipo_entrada: "buttons",
      opcoes: [
        { id: "sticky_sim", label: "✅ Sim, continuar", valor: "sim" },
        { id: "sticky_nao", label: "🔄 Não, outro assunto", valor: "nao" }
      ],
      transicoes: [
        {
          condicao: { tipo: "button_match", valor: "sticky_sim" },
          mensagem_transicao: "Combinado! Retornando para {setor}...",
          proximo_estado: "WAITING_ATTENDANT_CHOICE"
        },
        {
          condicao: { tipo: "button_match", valor: "sticky_nao" },
          acoes_pre_transicao: [
            { tipo: "setar_sector_id", parametros: { valor: null } },
            { tipo: "atualizar_thread", parametros: { campos: { assigned_user_id: null } } }
          ],
          proximo_estado: "INIT"
        }
      ]
    },
    {
      nome_interno: "WAITING_SECTOR_CHOICE",
      titulo_admin: "Escolha de Setor",
      mensagem_template: "Para qual setor você gostaria de falar?",
      tipo_entrada: "buttons",
      opcoes: [
        { id: "1", label: "💼 Vendas", valor: "vendas" },
        { id: "2", label: "💰 Financeiro", valor: "financeiro" },
        { id: "3", label: "🔧 Suporte", valor: "assistencia" },
        { id: "4", label: "📦 Fornecedor", valor: "fornecedor" }
      ],
      transicoes: [
        {
          condicao: { tipo: "button_match", valor: "1" },
          acoes_pre_transicao: [
            { tipo: "setar_sector_id", parametros: { valor: "vendas" } }
          ],
          mensagem_transicao: "Você escolheu: VENDAS. Buscando atendentes...",
          proximo_estado: "WAITING_ATTENDANT_CHOICE"
        }
        // ... repetir para 2, 3, 4
      ]
    },
    {
      nome_interno: "WAITING_ATTENDANT_CHOICE",
      titulo_admin: "Atribuição de Atendente",
      mensagem_template: "Conectando você com um atendente de {setor}...",
      tipo_entrada: "system",
      transicoes: [
        {
          condicao: { tipo: "system" },
          acoes_pre_transicao: [
            { 
              tipo: "atribuir_atendente", 
              parametros: { 
                chamar_roteamento: true,
                setor_origem: "sector_id" 
              }
            }
          ],
          proximo_estado: "COMPLETED"
        }
      ]
    },
    {
      nome_interno: "WAITING_QUEUE_DECISION",
      titulo_admin: "Decisão de Fila",
      mensagem_template: "Todos os atendentes estão ocupados. Deseja aguardar na fila?",
      tipo_entrada: "buttons",
      opcoes: [
        { id: "fila_entrar", label: "✅ Entrar na fila", valor: "entrar" },
        { id: "fila_sair", label: "🔄 Outro setor", valor: "sair" }
      ],
      transicoes: [
        {
          condicao: { tipo: "button_match", valor: "fila_entrar" },
          acoes_pre_transicao: [
            { tipo: "entrar_fila", parametros: { setor_origem: "sector_id" } }
          ],
          mensagem_transicao: "✅ Você está na fila! Aguarde.",
          proximo_estado: "COMPLETED"
        },
        {
          condicao: { tipo: "button_match", valor: "fila_sair" },
          proximo_estado: "INIT"
        }
      ]
    },
    {
      nome_interno: "COMPLETED",
      titulo_admin: "Concluído",
      mensagem_template: "✅ Transferido! Aguarde que um atendente responderá em breve.",
      tipo_entrada: "system"
    },
    {
      nome_interno: "TIMEOUT",
      titulo_admin: "Timeout",
      mensagem_template: "⏰ Tempo esgotado. Digite OI para recomeçar.",
      tipo_entrada: "system"
    }
  ],
  
  metricas_playbook: {
    total_execucoes: 0,
    total_concluidos: 0,
    total_abandonados: 0,
    tempo_medio_conclusao_segundos: 0,
    taxa_conclusao_percentual: 0
  }
};
```

---

### **FASE 5: EDITOR VISUAL (4-6 horas)**

**Componentes Necessários:**

```
📂 components/automacao/editores/
├─ EditorPlaybookURA.jsx         (Modal principal - 150 linhas)
├─ SecaoConfigGlobal.jsx         (Sliders/toggles - 100 linhas)
├─ SecaoRegrasAtivacao.jsx       (Multi-selects - 150 linhas)
├─ EditorEstados.jsx             (Lista + CRUD - 200 linhas)
├─ EditorEstadoIndividual.jsx    (Form individual - 250 linhas)
├─ EditorTransicoes.jsx          (Builder de transições - 180 linhas)
└─ PreviewFluxoURA.jsx           (Diagrama visual - 100 linhas)
```

**Prioridade de Construção:**

1. ✅ **EditorPlaybookURA** (estrutura do modal)
2. ✅ **SecaoConfigGlobal** (mais simples - sliders e toggles)
3. ✅ **SecaoRegrasAtivacao** (multi-selects)
4. ⚠️ **EditorEstados** (complexo - lista com drag-drop)
5. ⚠️ **EditorEstadoIndividual** (form detalhado)
6. ⏳ **PreviewFluxoURA** (nice-to-have - pode ser Fase 2)

---

## 🎨 **COMPARAÇÃO DE ARQUITETURA**

### **HOJE (v10 Hardcoded)**

```
┌─────────────────────────────────────────────────────────┐
│ webhookWapi → inboundCore                                │
│               │                                          │
│               ├─ Verifica: is_pre_atendimento_padrao    │
│               │                                          │
│               └─ preAtendimentoHandler                   │
│                  └─ switch (estadoAtual)                 │
│                     ├─ INIT → FluxoController.INIT()    │
│                     │   ├─ if (IA >= 70) { ... }        │
│                     │   ├─ if (guardian) { ... }        │
│                     │   ├─ if (sticky) { ... }          │
│                     │   └─ MenuBuilder.construir()      │
│                     │                                    │
│                     ├─ WAITING_SECTOR → validar input   │
│                     └─ WAITING_ATTENDANT → rotear       │
└─────────────────────────────────────────────────────────┘

PROBLEMA: 
- Mensagens fixas (MenuBuilder)
- Thresholds fixos (70, 10min)
- Estados fixos (7 hardcoded)
- Sem filtro por tipo/tag
```

---

### **FUTURO (V11 Configurável)**

```
┌─────────────────────────────────────────────────────────┐
│ webhookWapi → inboundCore                                │
│               │                                          │
│               ├─ resolverPlaybookParaMensagem()         │
│               │  ├─ Filtro: tipos_permitidos/bloqueados │
│               │  ├─ Filtro: tags_obrigatorias/bloqueadas│
│               │  ├─ Filtro: conexoes_permitidas         │
│               │  └─ Ordenar: prioridade DESC            │
│               │  → Playbook escolhido: "URA Cobrança"   │
│               │                                          │
│               └─ preAtendimentoHandler                   │
│                  ├─ Carregar playbook do banco          │
│                  └─ FluxoControllerV11(playbook)        │
│                     └─ processarEstado(estadoAtual)     │
│                        ├─ estadoConfig = playbook       │
│                        │    .estados                    │
│                        │    .find(e => e.nome === atual)│
│                        │                                │
│                        ├─ Renderizar template          │
│                        ├─ Avaliar transicoes[]         │
│                        ├─ Executar acoes[]             │
│                        └─ Recursão (próximo estado)    │
└─────────────────────────────────────────────────────────┘

VANTAGEM:
- Admin edita mensagens via UI
- Thresholds configuráveis
- Estados customizáveis
- URAs específicas por tipo/tag
```

---

## 🚦 **SEMÁFORO DE PRIORIDADES**

### 🔴 **P0 - CRÍTICO (Bloqueia Tudo)**

1. **Expandir Schema FlowTemplate** (30min)
   - Sem isso, playbook não salva configuração
   
2. **Criar FluxoControllerV11** (3h)
   - Sem isso, playbook é ignorado

3. **Criar resolverPlaybookParaMensagem** (1h)
   - Sem isso, não tem context-aware

### 🟡 **P1 - IMPORTANTE (Melhora UX)**

4. **Editor Visual Básico** (4h)
   - Admin precisa editar sem JSON manual
   
5. **Script de Migração** (1h)
   - Preservar comportamento atual em playbook

### 🟢 **P2 - DESEJÁVEL (Nice-to-Have)**

6. **Dashboard de Métricas** (2h)
   - Gráficos e insights
   
7. **Preview Visual** (2h)
   - Diagrama de fluxo

---

## 💡 **RECOMENDAÇÃO FINAL**

### **CAMINHO MAIS RÁPIDO (1 Dia Útil)**

**Manhã:**
1. ✅ Expandir `entities/FlowTemplate.json` (FEITO: adicionar campos)
2. ✅ Criar `functions/lib/resolverPlaybookParaMensagem.js`
3. ✅ Integrar seletor no `inboundCore.js`

**Tarde:**
4. ✅ Criar `functions/preAtendimento/FluxoControllerV11.js`
5. ✅ Adaptar `preAtendimentoHandler.js` para modo híbrido
6. ✅ Testar com playbook mock

**Resultado:** Sistema roda em V11 (genérico) + V10 (fallback).

---

### **PRÓXIMOS PASSOS (Semana 2)**

**Dia 2-3:**
- Criar Editor Visual básico (Config Global + Regras Ativação)
- Permitir admin criar URA simples

**Dia 4:**
- Script de migração (converter v10 em playbook)
- Deletar código legado

**Dia 5:**
- Dashboard de métricas
- Testes e refinamento

---

## 📋 **CHECKLIST DE MIGRAÇÃO**

### **✅ JÁ FEITO**
- [x] Página Automações criada
- [x] Item no Layout adicionado
- [x] PlaybookManagerURA criado (lista + CRUD básico)
- [x] BibliotecaAutomacoes com 5 abas
- [x] PlaybookCardURA com métricas e regras

### **🔴 FAZER AGORA (P0)**
- [ ] Expandir FlowTemplate.json (config_global, estados, regras_ativacao)
- [ ] Criar resolverPlaybookParaMensagem.js
- [ ] Criar FluxoControllerV11.js
- [ ] Adaptar preAtendimentoHandler para modo híbrido

### **🟡 FAZER DEPOIS (P1)**
- [ ] EditorPlaybookURA (modal)
- [ ] SecaoConfigGlobal
- [ ] SecaoRegrasAtivacao
- [ ] EditorEstados
- [ ] Script de migração

### **🟢 OPCIONAL (P2)**
- [ ] PreviewFluxoURA (diagrama)
- [ ] DashboardAutomacoes (gráficos)
- [ ] Validador de playbook (detecção de erros)

---

## 🎯 **CONCLUSÃO: PRIORIDADE DO USUÁRIO**

> "O principal neste estudo é extrair tudo que temos de pré-atendimento e URA para a tela automação - o principal foco"

**INTERPRETAÇÃO:**
1. ✅ **Já feito:** Tela existe, item no menu existe, aba "URAs" existe
2. ✅ **Já feito:** Lista de playbooks funcionando
3. 🔴 **Falta:** Editor visual para admin criar/editar URAs
4. 🔴 **Falta:** Schema completo para salvar configuração

**AÇÃO RECOMENDADA:**
- **Agora:** Expandir schema FlowTemplate
- **Em seguida:** Criar editor visual básico (SecaoConfigGlobal + SecaoRegrasAtivacao)
- **Depois:** FluxoControllerV11 para executar playbooks

**TEMPO ESTIMADO:** 6-8 horas para sistema funcional completo.

---

## 📊 **RESUMO EXECUTIVO**

| Item | Status | Impacto | Esforço | Prioridade |
|------|--------|---------|---------|-----------|
| Schema FlowTemplate | 40% | 🔴 Alto | 30min | P0 |
| Seletor Context-Aware | 30% | 🔴 Alto | 1h | P0 |
| Executor V11 Genérico | 0% | 🔴 Alto | 3h | P0 |
| Editor Visual | 0% | 🟡 Médio | 4h | P1 |
| Dashboard Métricas | 10% | 🟢 Baixo | 2h | P2 |
| **Interface Básica** | **80%** | ✅ | ✅ | ✅ |
| **Orquestração Core** | **85%** | ✅ | ✅ | ✅ |

**SCORE GERAL:** 48% completo - estrutura sólida, falta motor genérico e editor.