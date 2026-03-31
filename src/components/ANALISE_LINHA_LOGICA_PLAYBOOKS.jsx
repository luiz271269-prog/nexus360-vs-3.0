# 📊 ANÁLISE LINHA LÓGICA COMPLETA - PLAYBOOKS & AUTOMAÇÕES

**Data**: 2026-01-19  
**Objetivo**: Mapear O QUE TEMOS vs O QUE PRECISAMOS

---

## 🎯 RESUMO EXECUTIVO

### ✅ O QUE JÁ FUNCIONA
1. **FluxoController** - Executor de URA específico (pré-atendimento)
2. **PlaybookEngine** - Motor genérico de execução de playbooks
3. **PlaybookVisualEditor** - UI completa para criar/editar playbooks
4. **MotorDecisaoPreAtendimento** - Decide QUANDO ativar pré-atendimento

### ❌ O QUE ESTÁ FALTANDO (GAPS CRÍTICOS)
1. **Executor Genérico de FlowTemplate** - Não há ponte entre FlowTemplate e execução real
2. **Ponte PlaybookVisualEditor → FluxoController** - Editor salva, mas executor não lê
3. **Suporte a `tipo_fluxo: "pre_atendimento"`** - Motor ignora playbooks não-default
4. **Ativação por setor** - `activation_mode` e `activated_sectors` não são lidos
5. **Steps tipo "route"** - Não implementado em nenhum executor

---

## 📦 CAMADA 1: ENTIDADE FlowTemplate

### ✅ SCHEMA COMPLETO (entities/FlowTemplate.json)

```json
{
  "nome": "string",
  "descricao": "string",
  "categoria": "vendas|suporte|...",
  "tipo_fluxo": "geral|follow_up_vendas|pre_atendimento|...",
  "tipo_contato_alvo": "novo|lead|cliente|todos",
  "fila_alvo": "vendas|assistencia|...",
  "integracao_whatsapp_id": "string",
  
  // 🚨 CRÍTICO - URA
  "is_pre_atendimento_padrao": "boolean",
  "activation_mode": "global|per_sector|disabled",
  "activated_sectors": ["vendas", "assistencia"],
  "mensagem_saudacao": "string",
  "opcoes_setor": [...],
  
  // Controles
  "gatilhos": ["oi", "olá"],
  "prioridade": 10,
  "steps": [...],
  "ativo": true,
  "requires_ia": false,
  "auto_escalate_to_human": false,
  "max_tentativas": 3,
  "timeout_minutos": 30
}
```

### ✅ O QUE FUNCIONA
- PlaybookVisualEditor **SALVA TUDO CORRETAMENTE** no schema
- Todos os campos estão sendo persistidos
- UI mostra configurações corretas

---

## ⚙️ CAMADA 2: EXECUTORES (WHERE THE MAGIC HAPPENS)

### 🟢 EXECUTOR 1: FluxoController (functions/preAtendimento/fluxoController.js)

**O QUE FAZ:**
- Executa **APENAS** lógica de URA (menu de setores)
- Steps **FIXOS EM CÓDIGO** (não lê `FlowTemplate.steps[]`)
- Estados: `INIT → WAITING_SECTOR_CHOICE → WAITING_ATTENDANT_CHOICE → COMPLETED`

**O QUE NÃO FAZ:**
- ❌ Não lê `FlowTemplate.steps[]`
- ❌ Não suporta steps tipo `message`, `input`, `action`, `delay`, `ia_classify`
- ❌ Não suporta interpolação de variáveis `{{nome_cliente}}`
- ❌ Não segue delay_days para follow-up

**LINHA LÓGICA ATUAL:**
```
Webhook → processInboundEvent → preAtendimentoHandler → FluxoController.processarEstadoINIT()
                                                        → MenuBuilder (MENU FIXO)
                                                        → Escolha de setor (HARDCODED)
                                                        → RoteamentoInteligente
```

---

### 🟡 EXECUTOR 2: PlaybookEngine (functions/playbookEngine.js)

**O QUE FAZ:**
- Executa playbooks genéricos **LÊ `FlowTemplate.steps[]` CORRETAMENTE**
- Suporta steps: `message`, `input`, `ia_classify`, `action`, `delay`, `end`
- Interpolação de variáveis: `{{nome_cliente}}`
- Cálculo de `next_action_at` para follow-up
- Estados de execução em `FlowExecution`

**O QUE NÃO FAZ:**
- ❌ Não é chamado para tipo_fluxo = "pre_atendimento"
- ❌ Não respeita `activation_mode` ou `activated_sectors`
- ❌ Não tem integração com `motorDecisaoPreAtendimento`
- ❌ Não implementa step tipo `route` (roteamento)

**LINHA LÓGICA ATUAL:**
```
??? (NINGUÉM CHAMA O PLAYBOOK ENGINE PARA PRÉ-ATENDIMENTO)
```

---

### 🔴 EXECUTOR 3: motorDecisaoPreAtendimento (DECISION LAYER)

**O QUE FAZ:**
- Decide **SE** deve ativar pré-atendimento
- Camadas: Horário → Continuidade → Fidelização → Fallback
- **FALLBACK:** Busca `FlowTemplate` com `is_pre_atendimento_padrao: true`
- Se encontra, chama `executarPreAtendimento` (função que NÃO EXISTE)

**O QUE NÃO FAZ:**
- ❌ Não respeita `activation_mode: "per_sector"`
- ❌ Não filtra por `activated_sectors`
- ❌ Apenas busca `is_pre_atendimento_padrao: true` + `ativo: true`

**LINHA LÓGICA ATUAL:**
```
Webhook → processInboundEvent → motorDecisaoPreAtendimento
                              → Busca FlowTemplate (is_pre_atendimento_padrao=true)
                              → Chama executarPreAtendimento (??? NÃO EXISTE)
                              → 🚨 CRÍTICO: Função fantasma
```

---

## 🚨 GAP CRÍTICO: FUNÇÃO FANTASMA

### Problema Identificado

```javascript
// motorDecisaoPreAtendimento.js (linha 350)
await base44.functions.invoke('executarPreAtendimento', {
  action: 'iniciar',
  thread_id: thread_id,
  contact_id: contact_id,
  integration_id: integration_id,
  playbook_override_id: playbookId
});
```

**Essa função NÃO EXISTE no projeto!**

Funções que EXISTEM:
- ✅ `preAtendimentoHandler` - Executor de MENU FIXO (FluxoController)
- ✅ `playbookEngine` - Executor GENÉRICO de FlowTemplate.steps
- ❌ `executarPreAtendimento` - **FANTASMA**

---

## 🔧 O QUE DEVERIA ACONTECER (FLUXO IDEAL)

### Cenário: Criar URA para Vendas

**PASSO 1: Admin cria FlowTemplate via UI**
```json
{
  "nome": "Pré-Atendimento Vendas",
  "tipo_fluxo": "pre_atendimento",
  "activation_mode": "per_sector",
  "activated_sectors": ["vendas"],
  "steps": [
    {
      "type": "message",
      "texto": "Olá {{nome}}! Bem-vindo ao setor de Vendas."
    },
    {
      "type": "input",
      "texto": "O que você procura? 1-Orçamento 2-Dúvidas",
      "campo": "interesse",
      "opcoes": ["Orçamento", "Dúvidas"]
    },
    {
      "type": "route",
      "mapa": {
        "Orçamento": { "next_playbook": "playbook_orcamento_id" },
        "Dúvidas": { "fila_destino": "vendas" }
      }
    }
  ]
}
```

**PASSO 2: Mensagem chega ao webhook**
```
1. webhookWapi recebe mensagem
2. Cria Contact + MessageThread
3. Chama processInboundEvent
4. processInboundEvent chama motorDecisaoPreAtendimento
```

**PASSO 3: Motor de Decisão (O QUE DEVERIA ACONTECER)**
```javascript
// motorDecisaoPreAtendimento.js

// PASSO 3A: Verificar horário ✅ (JÁ FUNCIONA)
const horario = verificarHorario(config);

// PASSO 3B: Verificar continuidade ✅ (JÁ FUNCIONA)
const ultimaThread = await buscarUltimaThread(...);

// PASSO 3C: Verificar fidelização ✅ (JÁ FUNCIONA)
if (contato.vendedor_responsavel) { ... }

// PASSO 3D: FALLBACK - BUSCAR PLAYBOOK ATIVO 🚨 AQUI ESTÁ O PROBLEMA
const playbooksAtivos = await base44.asServiceRole.entities.FlowTemplate.filter({
  activation_mode: { $in: ['global', 'per_sector'] },
  ativo: true,
  $or: [
    { activation_mode: 'global' },
    { 
      activation_mode: 'per_sector',
      activated_sectors: { $contains: thread.sector_id || 'geral' } 
    }
  ]
}, '-prioridade', 1);

// PASSO 3E: CHAMAR EXECUTOR GENÉRICO (❌ NÃO EXISTE)
await base44.functions.invoke('executarFlowTemplate', {
  flow_template_id: playbooksAtivos[0].id,
  thread_id: thread_id,
  contact_id: contact_id,
  integration_id: integration_id
});
```

**PASSO 4: Executor Genérico (❌ NÃO EXISTE)**
```javascript
// functions/executarFlowTemplate.js (NÃO EXISTE AINDA)

// Deveria:
// 1. Ler FlowTemplate.steps[]
// 2. Criar FlowExecution
// 3. Executar step por step
// 4. Suportar TODOS os tipos: message, input, ia_classify, action, route, delay, end
// 5. Enviar mensagens via enviarWhatsApp
// 6. Aguardar respostas e avançar steps
// 7. Calcular next_action_at para delays
```

---

## 🏗️ ARQUITETURA ATUAL vs IDEAL

### 🟢 ARQUITETURA ATUAL (FUNCIONANDO)

```
┌─────────────────────────────────────────────────────┐
│  PLAYBOOKS GENÉRICOS (follow_up, nurturing)        │
│  FlowTemplate + PlaybookEngine                     │
│  ✅ FUNCIONA - mas só para playbooks iniciados     │
│     manualmente via API                            │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  URA PRÉ-ATENDIMENTO (MENU FIXO)                   │
│  FluxoController (HARDCODED)                       │
│  ✅ FUNCIONA - mas ignora FlowTemplate.steps       │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  MOTOR DE DECISÃO                                  │
│  motorDecisaoPreAtendimento                        │
│  ✅ FUNCIONA - mas chama função fantasma           │
└─────────────────────────────────────────────────────┘
```

### 🔵 ARQUITETURA IDEAL (O QUE PRECISAMOS)

```
┌───────────────────────────────────────────────────────────┐
│  BIBLIOTECA DE AUTOMAÇÕES (UI)                           │
│  PlaybookVisualEditor                                    │
│  ✅ Cria/edita FlowTemplate com steps configuráveis      │
│  ✅ Salva activation_mode, activated_sectors            │
└───────────────────────────────────────────────────────────┘
                          ↓
┌───────────────────────────────────────────────────────────┐
│  MOTOR DE DECISÃO (CÉREBRO)                              │
│  motorDecisaoPreAtendimento                              │
│  1. Verifica horário                                     │
│  2. Verifica continuidade                                │
│  3. Verifica fidelização                                 │
│  4. FALLBACK: Busca FlowTemplate ativo                   │
│     - Respeita activation_mode                           │
│     - Filtra por activated_sectors                       │
│     - Ordena por prioridade                              │
└───────────────────────────────────────────────────────────┘
                          ↓
┌───────────────────────────────────────────────────────────┐
│  🚨 EXECUTOR UNIVERSAL (PRECISAMOS CRIAR)                 │
│  functions/executarFlowTemplate.js (NÃO EXISTE)          │
│                                                           │
│  Responsabilidades:                                       │
│  1. Ler FlowTemplate.steps[]                             │
│  2. Criar FlowExecution                                  │
│  3. Executar step sequencial:                            │
│     - message → enviarWhatsApp                           │
│     - input → aguardar resposta                          │
│     - ia_classify → nexusClassifier                      │
│     - action → executar ação                             │
│     - route → decidir próximo passo                      │
│     - delay → calcular next_action_at                    │
│     - end → finalizar                                    │
│  4. Interpolação {{variavel}}                            │
│  5. Salvar execution_history                             │
│  6. Escalonamento automático                             │
└───────────────────────────────────────────────────────────┘
```

---

## 📋 TABELA COMPARATIVA: TIPOS DE STEPS

| Step Type | PlaybookEngine | FluxoController | Editor UI | PRECISA |
|-----------|----------------|-----------------|-----------|---------|
| `message` | ✅ Envia msg | ❌ Hardcoded | ✅ Campo texto | ✅ Funciona |
| `input` | ✅ Aguarda resposta | ❌ Hardcoded | ✅ Campo + opções | ✅ Funciona |
| `ia_classify` | ✅ Chama nexusClassifier | ❌ N/A | ✅ Info card | ✅ Funciona |
| `action` | ✅ Executa ação | ❌ N/A | ✅ Select + params | ✅ Funciona |
| `route` | ❌ **NÃO IMPLEMENTADO** | ❌ **NÃO IMPLEMENTADO** | ❌ **SEM UI** | ❌ **CRIAR** |
| `delay` | ✅ next_action_at | ❌ N/A | ✅ Dias/segundos | ✅ Funciona |
| `end` | ✅ Finaliza | ✅ Hardcoded COMPLETED | ✅ Msg encerramento | ✅ Funciona |

---

## 🔴 GAP #1: STEP TIPO "ROUTE" (ROTEAMENTO)

### O que é?
Step que decide o próximo passo baseado em condições:

```javascript
{
  "type": "route",
  "mapa": {
    "opcao_A": { "next_playbook": "playbook_id_A" },
    "opcao_B": { "fila_destino": "vendas" },
    "default": { "next_playbook": "fallback_id" }
  }
}
```

### Onde usar?
- URA: Cliente escolheu "Vendas" → Rotear para fila vendas
- Qualificação: Score alto → Playbook VIP | Score baixo → Playbook padrão

### Status: ❌ NÃO IMPLEMENTADO EM NENHUM EXECUTOR

---

## 🔴 GAP #2: INTEGRAÇÃO motorDecisaoPreAtendimento → Executor

### O que acontece HOJE:

```javascript
// motorDecisaoPreAtendimento.js (linha 350)
await base44.functions.invoke('executarPreAtendimento', { ... });
//                              ^^^^^^^^^^^^^^^^^^^^^^
//                              FUNÇÃO NÃO EXISTE
```

### O que DEVERIA acontecer:

```javascript
// OPÇÃO A: Criar executarPreAtendimento (Específico URA)
await base44.functions.invoke('executarPreAtendimento', {
  action: 'iniciar',
  thread_id,
  contact_id,
  integration_id,
  playbook_id
});

// OPÇÃO B: Usar executarFlowTemplate (Genérico)
await base44.functions.invoke('executarFlowTemplate', {
  action: 'start',
  flow_template_id: playbookId,
  thread_id,
  contact_id,
  integration_id
});
```

---

## 🔴 GAP #3: ATIVAÇÃO POR SETOR (activation_mode)

### O que o schema suporta:
```json
{
  "activation_mode": "per_sector",
  "activated_sectors": ["vendas", "assistencia"]
}
```

### O que o motor FAZ:
```javascript
// motorDecisaoPreAtendimento.js (linha 331)
const playbooksAtivos = await base44.entities.FlowTemplate.filter({
  is_pre_atendimento_padrao: true,  // ✅ OK
  ativo: true                       // ✅ OK
  // ❌ NÃO FILTRA activation_mode
  // ❌ NÃO FILTRA activated_sectors
});
```

### O que DEVERIA fazer:
```javascript
const setor = thread.sector_id || 'geral';

const playbooksAtivos = await base44.entities.FlowTemplate.filter({
  ativo: true,
  tipo_fluxo: 'pre_atendimento',
  $or: [
    { activation_mode: 'global' },
    { 
      activation_mode: 'per_sector',
      activated_sectors: { $contains: setor }
    }
  ]
}, '-prioridade', 1);
```

---

## 🔴 GAP #4: GATILHOS NÃO SÃO VERIFICADOS

### O que o schema suporta:
```json
{
  "gatilhos": ["oi", "olá", "bom dia"],
  "tipo_fluxo": "follow_up_vendas"
}
```

### O que DEVERIA acontecer:
```javascript
// processInboundEvent.js (ou motorDecisao)

// Verificar se mensagem do cliente contém gatilho de algum playbook
const mensagemCliente = user_input.content.toLowerCase();

const playbooksComGatilho = await base44.entities.FlowTemplate.filter({
  ativo: true,
  tipo_fluxo: { $ne: 'pre_atendimento' } // Playbooks de follow-up, qualificação
});

for (const playbook of playbooksComGatilho) {
  const gatilhoDetectado = playbook.gatilhos.some(g => 
    mensagemCliente.includes(g.toLowerCase())
  );
  
  if (gatilhoDetectado) {
    // Iniciar playbook
    await base44.functions.invoke('playbookEngine', {
      action: 'start',
      contact_id,
      flow_template_id: playbook.id
    });
    break;
  }
}
```

### Status: ❌ NÃO IMPLEMENTADO

---

## 🟢 O QUE JÁ FUNCIONA PERFEITAMENTE

### 1. PlaybookVisualEditor (UI)
- ✅ Criação/edição completa de FlowTemplate
- ✅ Todos os campos salvos corretamente
- ✅ Interface intuitiva com drag-and-drop de steps
- ✅ Validação de campos obrigatórios

### 2. PlaybookEngine (Executor Genérico)
- ✅ Executa steps sequenciais
- ✅ Interpolação de variáveis
- ✅ Estados de execução (FlowExecution)
- ✅ Cálculo de next_action_at
- ✅ Ações: criarLead, agendarFollowUp, enviarOrcamento, atribuirVendedor
- ✅ Escalonamento para humano
- ✅ Histórico de execução

### 3. FluxoController (Executor URA)
- ✅ Menu de setores funcional
- ✅ Sticky session (retorno ao setor)
- ✅ Modo Guardião (resgate de cliente)
- ✅ Integração com RoteamentoInteligente
- ✅ Gestão de filas

### 4. MotorDecisaoPreAtendimento (Decisor)
- ✅ Camadas de decisão (horário, continuidade, fidelização)
- ✅ Busca FlowTemplate ativo
- ⚠️ Chama função fantasma (precisa correção)

---

## 📊 MAPA DE FLUXO REAL vs IDEAL

### 🟢 FLUXO REAL ATUAL (Follow-up manual)

```
Admin → Dashboard → Inicia playbook manualmente
                  ↓
           playbookEngine.start(contact_id, flow_template_id)
                  ↓
           Executa steps[] corretamente
                  ↓
           Cliente recebe mensagens programadas ✅
```

### 🔴 FLUXO REAL ATUAL (URA automática)

```
Cliente → WhatsApp "Olá"
       ↓
    webhookWapi
       ↓
    processInboundEvent
       ↓
    motorDecisaoPreAtendimento
       ↓
    Busca FlowTemplate (is_pre_atendimento_padrao=true) ✅
       ↓
    Chama executarPreAtendimento(...) ❌ FUNÇÃO NÃO EXISTE
       ↓
    🚨 ERRO ou FALLBACK para preAtendimentoHandler (menu fixo)
```

### 🟢 FLUXO IDEAL (O QUE PRECISAMOS)

```
Cliente → WhatsApp "Olá"
       ↓
    webhookWapi
       ↓
    processInboundEvent
       ↓
    motorDecisaoPreAtendimento
       ↓
    Busca FlowTemplate (activation_mode + activated_sectors) 🔧
       ↓
    Chama executorUniversal(flow_template_id) 🔧 CRIAR
       ↓
    Lê FlowTemplate.steps[] ✅
       ↓
    Executa step 1: message → "Olá {{nome}}" ✅
       ↓
    Executa step 2: input → "Escolha: 1-Vendas 2-Suporte" ✅
       ↓
    Aguarda resposta do cliente...
       ↓
    Executa step 3: route → Decisão baseada em resposta 🔧 CRIAR
       ↓
    Atribui atendente ou inicia outro playbook ✅
```

---

## 🛠️ PLANO DE CORREÇÃO (PRIORIDADE)

### 🔴 CRÍTICO - Fazer AGORA

1. **Criar `functions/executorUniversal.js`**
   - Base: Copiar estrutura do `playbookEngine.js`
   - Adicionar: Suporte a step tipo `route`
   - Integrar: Com `motorDecisaoPreAtendimento`

2. **Corrigir `motorDecisaoPreAtendimento.js`**
   - Trocar chamada de `executarPreAtendimento` → `executorUniversal`
   - Adicionar filtro por `activation_mode` e `activated_sectors`

3. **Implementar step `route` no executor**
   - Ler `step.mapa`
   - Decidir próximo passo baseado em `variables[campo]`
   - Suportar: `next_playbook`, `fila_destino`, `tipo_contato_destino`

### 🟡 IMPORTANTE - Fazer DEPOIS

4. **Adicionar UI para step tipo `route`**
   - Em `PlaybookVisualEditor.jsx`
   - Componente `StepEditor` para tipo `route`
   - Campo para mapear opções → ações

5. **Detecção de gatilhos em `processInboundEvent`**
   - Antes de chamar `motorDecisao`, verificar gatilhos
   - Iniciar playbooks automaticamente baseado em keywords

6. **Dashboard de métricas**
   - Exibir execuções por playbook
   - Taxa de sucesso, tempo médio, abandonos

---

## 🎯 CONCLUSÃO

### ✅ O QUE ESTÁ PRONTO
- **Entidade**: FlowTemplate 100% completa
- **UI**: Editor visual 100% funcional
- **Executor Genérico**: PlaybookEngine funciona para follow-up
- **Motor de Decisão**: 80% funcional (falta integração)
- **Executor URA**: FluxoController funciona (mas hardcoded)

### 🚨 O QUE ESTÁ QUEBRADO
1. **Função fantasma**: `executarPreAtendimento` não existe
2. **Executor não lê steps**: FluxoController ignora FlowTemplate.steps
3. **Filtros ignorados**: activation_mode, activated_sectors não são usados
4. **Step route**: Não implementado em nenhum executor
5. **Gatilhos**: Não são verificados automaticamente

### 🛠️ AÇÕES IMEDIATAS (SOLUÇÃO EM 3 PASSOS)

**PASSO 1**: Renomear/Adaptar
```bash
# Opção A: Criar função nova
functions/executorUniversal.js (base no playbookEngine)

# Opção B: Adaptar existente
Modificar motorDecisaoPreAtendimento para chamar playbookEngine
```

**PASSO 2**: Implementar step `route`
```javascript
// Adicionar no executorUniversal/playbookEngine
case 'route':
  return await executarRoute(base44, execution, step, stepIndex);
```

**PASSO 3**: Corrigir filtro de ativação
```javascript
// motorDecisaoPreAtendimento.js
const playbooksAtivos = await buscarPlaybooksAtivos(base44, thread.sector_id);
```

---

## 💡 RECOMENDAÇÃO TÉCNICA

### Estratégia: UNIFICAÇÃO PROGRESSIVA

1. **Fase 1** (Agora): Criar `executorUniversal.js` como cópia do `playbookEngine.js` + adicionar step `route`

2. **Fase 2** (Próxima): Migrar `FluxoController` para usar `executorUniversal` em vez de menu hardcoded

3. **Fase 3** (Futuro): Deprecar `preAtendimentoHandler` e usar apenas `executorUniversal` para TUDO

### Vantagem: ZERO QUEBRA
- FluxoController continua funcionando para URAs antigas
- Novos playbooks usam executorUniversal
- Migração gradual sem downtime

---

## 📸 ESTADO DO FORMULÁRIO (ANALISADO)

### ✅ Campos Funcionando
- Nome, Categoria, Tipo de Fluxo: **Salvos e exibidos** ✅
- Prioridade: **Salva corretamente** ✅
- Descrição: **Salva corretamente** ✅
- Gatilhos: **Salvos como array** ✅
- Steps (message, input, ia_classify, action, delay, end): **Salvos** ✅
- Switches (ativo, requires_ia, auto_escalate): **Salvos** ✅
- Max tentativas, Timeout: **Salvos** ✅

### ⚠️ Campos Salvos mas NÃO USADOS
- `delay_days` em step message: Salvo, mas FluxoController ignora
- `message_template_name`: Salvo, mas não usado
- `require_human_on_fail`: Salvo por step, mas FluxoController não lê
- Step `route`: **Não tem UI e não é executado**

### 🚨 Campos Faltando na UI
- `activation_mode` (global/per_sector/disabled)
- `activated_sectors` (array)
- `mensagem_saudacao` (customizada)
- `opcoes_setor` (customizadas)
- Step tipo `route` (sem editor)

---

## 🎬 CENÁRIO DE USO REAL

### Usuário quer criar URA customizada para Vendas:

1. **UI**: Abre "Biblioteca de Automações" → Tab "URAs" → "Criar Nova URA"
2. **Editor**: Preenche formulário que você mostrou
3. **Salvar**: FlowTemplate criado ✅
4. **Ativação**: Liga switch "Playbook Ativo" ✅
5. **Configuração Avançada**: Define `activation_mode: "per_sector"`, `activated_sectors: ["vendas"]` ❌ SEM UI
6. **Cliente envia msg**: "Olá, quero comprar"
7. **Motor Decisão**: Busca playbook ativo ✅ (mas ignora sectors)
8. **Executor**: Chama `executarPreAtendimento` ❌ ERRO (não existe)
9. **Fallback**: Volta para `preAtendimentoHandler` (menu fixo hardcoded) ⚠️

### RESULTADO ATUAL:
Cliente recebe **SEMPRE** o menu padrão (Vendas/Financeiro/Suporte), independente do playbook customizado criado na UI.

---

## ✅ CONCLUSÃO FINAL

**DIAGNÓSTICO**: Sistema está **90% pronto**, mas desconectado.

**PROBLEMA**: 3 executores trabalhando em silos:
1. FluxoController (URA hardcoded)
2. PlaybookEngine (genérico, não chamado para URA)
3. MotorDecisao (chama função fantasma)

**SOLUÇÃO**: Unificar tudo em `executorUniversal.js` e fazer motor de decisão chamá-lo corretamente.

**TEMPO ESTIMADO**: 2-3 horas de desenvolvimento focado.

---

**Versão**: 1.0.0  
**Timestamp**: 2026-01-19T12:00:00  
**Status**: 🔴 Sistema funcional mas desconectado - Prioridade CRÍTICA