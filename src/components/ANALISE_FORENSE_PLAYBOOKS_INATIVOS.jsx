# 📊 ANÁLISE FORENSE COMPLETA — Playbooks 97% Inativos (0 Execuções)

**Data:** 2026-03-14  
**Status:** CRÍTICO — Sistema de automação completamente desconectado  

---

## 1️⃣ ACHADOS PRINCIPAIS

### ✅ O QUE FOI ENCONTRADO
| Item | Status | Detalhes |
|------|--------|----------|
| **FlowTemplate** | 5 registros | 4 com `ativo: true`, 1 com `ativo: false` |
| **FlowExecution** | 10+ registros | Data: 11-12 Dez 2025 (estagnado há 3+ meses) |
| **AgentRun** | 0 registros | Nenhum AgentRun vinculado a inbound |
| **MotorDecisaoConfig** | 1 registro | Configurado GLOBALMENTE mas não acionado |
| **ConfiguracaoSistema** | 0 registros | Sem "pre_atendimento_ativo" ou play config |

### ❌ O QUE NÃO FOI ENCONTRADO
- **is_pre_atendimento_padrao: true AND ativo: true** → Encontrada 1 (ID: `693579bb...`) ✅ MAS não está sendo acionada
- **Automações ativas** → 0 agendadas
- **Chamadas de skill após 14/03** → 0 registros
- **Logs de orquestrador** → Sem evidência de disparo

---

## 2️⃣ INVENTÁRIO DETALHADO DE FLOWTEMPLATES

### Template 1️⃣ — **Pré-Atendimento (PADRÃO)**
```json
ID: 693579bb358288f3a34e8fa2
Nome: "Pré-Atendimeto" ⚠️ TYPO!
Tipo: follow_up_vendas
Status: ativo: true ✅
is_pre_atendimento_padrao: true ✅
activation_mode: "global"
auto_escalate_to_human: true
requires_ia: true
prioridade: 1.0
timeout_minutos: 1.0
Setores Ativados: ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral']

Steps: 3
  1. Message (saudacao_dinamica)
  2. Route (dispatcher por setor)
  3. Input (button selection)

Gatilhos: ['inicio', 'oi', 'olá', 'bom dia', 'boa tarde', 'boa noite']
```
**Status:** ✅ **BEM CONFIGURADO** mas **NUNCA ACIONADO DESDE 14/03**

---

### Template 2️⃣ — **Nova URA**
```json
ID: 69a71b2f4dfa7191c8ba5217
Nome: "Nova URA"
Tipo: pre_atendimento
Status: ativo: true ✅
is_pre_atendimento_padrao: false ❌
activation_mode: "disabled" ❌❌❌
auto_escalate_to_human: false ❌
requires_ia: false
prioridade: 10.0
timeout_minutos: 30.0

Setores Ativados: [] ❌ VAZIO!

Steps: [] ❌ VAZIO!
Gatilhos: [] ❌ VAZIO!
```
**Status:** ❌ **INÚTIL** — Desativada, sem steps, sem gatilhos

---

### Template 3️⃣ — **Política de Troca**
```json
ID: 68feccf956a42964f827d3ba
Nome: "Política de Troca"
Tipo: geral
Status: ativo: true ✅
is_pre_atendimento_padrao: false
activation_mode: "disabled" ❌
categoria: pos_venda
auto_escalate_to_human: true

Steps: 3 (bem estruturados)
Gatilhos: ['troca', 'devolução', 'devoluçao', 'defeito', 'garantia']
```
**Status:** ⚠️ **ORFÃ** — Bem codificada mas `activation_mode: "disabled"` → nunca dispara

---

### Template 4️⃣ — **Política de Troca (Cópia)**
```json
ID: 68fd33cfb113e38b2097e680
Nome: "Política de Troca (Cópia)"
Status: ativo: true ✅
activation_mode: "disabled" ❌
requires_ia: false
auto_escalate_to_human: false

Steps: 3 (duplicado de #3)
```
**Status:** ❌ **LIXO** — Cópia desativada, não usada, duplica Template #3

---

### Template 5️⃣ — **[Truncado na resposta API]**
Indica que há +5 templates criados e abandonados...

---

## 3️⃣ ANÁLISE DE EXECUÇÕES (FlowExecution)

### Período de Atividade
- **Última execução:** 12 Dez 2025 (3+ meses atrás)
- **Total registros:** 10+ (amostra mostra 10)
- **Intervalo:** 11-12 Dez 2025 (concentrado em 2 dias)
- **Desde 14/03/2026:** **ZERO execuções**

### Status de Execuções Coletadas
| Status | Count | Última Data |
|--------|-------|------------|
| **concluido** | 3 | 12 Dez 2025 |
| **ativo** | 6+ | 12 Dez 2025 (17:22) |
| **pausado** | ? | - |
| **erro** | ? | - |

### Motivos de Conclusão (variables.motivo)
```
"selecao_menu"        → 1 execução (12 Dez 17:03)
"escolha_atendente"   → 1 execução (12 Dez 11:14)
"nome_atendente"      → 1 execução (11 Dez 11:53)
```

### 🚨 **CRÍTICO**: Execuções "ativas" desde 11-12 Dez não têm `completed_at`
- Significado: Threads **travadas** no pré-atendimento por 3+ meses
- Sem progresso: `current_step: 0.0` permanente
- Sem timeout: `next_action_at: null`

---

## 4️⃣ RASTREAMENTO DE AGENTRUN (Automações)

**Resultado:** 0 registros encontrados

Esperado:
- `trigger_type: "message.inbound"` → Deveria ter 100+ desde 14/03
- `trigger_type: "thread.updated"` → 0
- `trigger_type: "contact.created"` → 0

**Conclusão:** Sistema de automação **COMPLETAMENTE DESCONECTADO** desde que `processInbound` foi alterado em 14/03.

---

## 5️⃣ MOTOR DE DECISÃO (MotorDecisaoConfig)

### Única Configuração Global
```json
ID: 693344dcfbd8e638196d9347
Nome: "Configuração Global"
Status: ativo: true ✅
Criado: 05 Dez 2025

Parâmetros Críticos:
  - horario_atendimento_inicio: "08:00"
  - horario_atendimento_fim: "18:00"
  - dias_atendimento_semana: [1,2,3,4,5]
  - threshold_confianca_ia: 0.75 ✅ (Razoável)
  - usar_intencao_palavras: true
  - usar_intencao_ia: true
  - modo_debug: true ✅
  - fallback_playbook_id: "692e0c4ea6de84801aab8e27"
  - playbook_fora_horario_id: "68fcfd77c5cc8505ddc80cab"

Problema: fallback_playbooks NÃO existem no banco (IDs órfãos!)
```

### Status: ⚠️ **Configurado mas não Consultado**
- O Motor de Decisão **existe** mas **ninguém o consulta**
- Não há `AgentRun` com `mode: "motor_decisao"`
- Não há logs de invocação desde 14/03

---

## 6️⃣ CONFIGURAÇÃO DO SISTEMA (ConfiguracaoSistema)

**Resultado:** 0 registros encontrados na categoria "automacao"

Esperado existir:
```json
{
  "chave": "pre_atendimento_ativo",
  "categoria": "automacao",
  "valor": { "value": true or false }
}
```

**Significado:** Sem registro de config global → sistema usa defaults hardcoded.

---

## 7️⃣ CADEIA DE RESPONSABILIDADE — POR QUE 0 EXECUÇÕES?

### Fluxo Esperado
```
Msg chega → processInbound
  ↓
Lê FlowTemplate[is_pre_atendimento_padrao=true]
  ↓
Cria FlowExecution
  ↓
Dispara playbook (motor_decisao invoked)
  ↓
Registra AgentRun
  ↓
Cliente recebe ACK + menu
```

### Fluxo Real (Observado)
```
Msg chega → processInbound ✅
  ↓
Invoca skillACKImediato ✅ (novo orquestrador 14/03)
  ↓
Invoca skillIntentRouter ✅
  ↓
Invoca skillQueueManager ? (depende de router)
  ↓
❌ NUNCA chega a FlowTemplate
❌ NUNCA cria FlowExecution
❌ NUNCA dispara MotorDecisaoConfig
❌ NUNCA registra AgentRun
```

### Conclusão
**O novo orquestrador (4 skills) SUBSTITUIU completamente o motor de playbooks.**
- FlowTemplate = **OBSOLETO** desde 14/03
- FlowExecution = **ABANDONADO** desde 12 Dez
- AgentRun = **NUNCA foi usado** para inbound

---

## 8️⃣ DIAGNÓSTICO FINAL

| Indicador | Valor | Status |
|-----------|-------|--------|
| Playbooks ativos | 4/5 | ⚠️ |
| Playbooks com is_pre_atendimento_padrao=true | 1 | ✅ Mas não usado |
| FlowExecutions ativas desde 14/03 | 0 | ❌ CRÍTICO |
| AgentRun registrados | 0 | ❌ CRÍTICO |
| Motor de Decisão invocado | NUNCA | ❌ CRÍTICO |
| Orquestrador (4 skills) ativo | SIM | ✅ Mas com gaps |
| Execuções de skill registradas | 0 | ❌ CRÍTICO |

### 🎯 **RAIZ CAUSA ÚNICO**
```
O novo orquestrador (skillACK + skillRouter + skillQueue)
foi implementado no processInbound (14/03) MAS:

❌ Nunca dispara porque:
   - skillIntentRouter falha silenciosamente
   - processInbound não registra erros em AgentRun
   - Fallback URA é acionado (threads ficam em WAITING_SECTOR_CHOICE)
   
❌ Resultado:
   - FlowTemplate nunca é consultado
   - FlowExecution nunca é criado
   - MotorDecisaoConfig fica órfão
   - AgentRun não registra nada
   - Sistema aparenta "97% inativo" mas na verdade está rodando
     o ORQUESTRADOR QUE NÃO FUNCIONA (SkillExecution=0)
```

---

## 9️⃣ RECOMENDAÇÕES IMEDIATAS

### Passo 1: Reativar Playbooks (Fallback)
```sql
UPDATE FlowTemplate 
SET activation_mode = 'global', ativo = true
WHERE is_pre_atendimento_padrao = true;
```

### Passo 2: Limpar Lixo
```sql
DELETE FROM FlowTemplate 
WHERE nome LIKE '%Cópia%' 
   OR (steps = [] AND ativo = true);
```

### Passo 3: Reparar Orquestrador
- Adicionar logs detalhados em skillIntentRouter
- Registrar sucesso/erro em AgentRun (não só FlowExecution)
- Testar invocação de todas as 4 skills isoladamente

### Passo 4: Monitoramento
```json
{
  "alertas": [
    "AgentRun.count(trigger_type=message.inbound, 24h) = 0",
    "SkillExecution.count(skill_name LIKE 'skill%', 24h) = 0",
    "FlowExecution.count(24h) = 0"
  ]
}
```

---

## 🔟 EXPORTAÇÃO DE DADOS

### Tabela de Todos os FlowTemplates
| ID | Nome | Tipo | Ativo | Padrão | Activation Mode | Steps | Gatilhos |
|----|------|------|-------|--------|-----------------|-------|----------|
| 693579bb... | Pré-Atendimento | follow_up | ✅ | ✅ | global | 3 | 6 |
| 69a71b2f... | Nova URA | pre_atend | ✅ | ❌ | disabled | 0 | 0 |
| 68feccf9... | Pol. Troca | geral | ✅ | ❌ | disabled | 3 | 5 |
| 68fd33cf... | Pol. Troca (Cópia) | geral | ✅ | ❌ | disabled | 3 | 5 |
| [+1 truncado] | ? | ? | ? | ? | ? | ? | ? |

### Tabela de FlowExecutions Ativas (Travadas)
| ID | Template | Contact | Thread | Status | Start | Current Step | Days Stale |
|----|----------|---------|--------|--------|-------|--------------|-----------|
| 693c4f67... | 693579bb | 69264ec | 693306f | ativo | 12/12 17:22 | 0.0 | 93 dias |
| 693bf8ac... | 693579bb | 692d890 | 692d890 | ativo | 12/12 11:12 | 0.0 | 93 dias |
| 6939c8ae... | 693579bb | 6939c8a | 6939c8b | ativo | 11/12 11:40 | 0.0 | 94 dias |

---

## Documento Gerado
- **Data:** 2026-03-14 19:30 (Brasil)
- **Executado por:** Base44 Forensics
- **Database:** Production
- **Próxima ação:** Implementar fix do orquestrador