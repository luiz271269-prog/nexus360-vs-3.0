# 📊 ANÁLISE CRÍTICA: DEBATE PRÉ-ATENDIMENTO vs IMPLEMENTAÇÃO ATUAL

**Data:** 2026-01-19  
**Objetivo:** Comparar visão conceitual (debates) com código real para identificar gaps e definir roadmap de centralização.

---

## 🎯 **VISÃO DO DEBATE: "Zero Código Espalhado"**

### **Princípios Fundamentais:**
1. **Fonte única de verdade:** FlowTemplate (tipo_fluxo = "pre_atendimento")
2. **Executor genérico:** FluxoControllerV11 (lê playbook, não tem lógica hardcoded)
3. **Interface de gestão:** "Meus Playbooks" (zero necessidade de programar)
4. **Regras de ativação:** Quem/quando/onde o playbook roda (contato + instância + setor)

### **Resultado Esperado:**
- ❌ Nenhum `if/else` de URA em funções fora do executor
- ❌ Nenhum `menuBuilder` hardcoded
- ❌ Nenhum mapeamento fixo de botões → setores
- ✅ Tudo configurável via interface admin

---

## 🔍 **ESTADO ATUAL DO PROJETO**

### **✅ O QUE JÁ EXISTE**

| Componente | Status | Arquivo | Observação |
|-----------|--------|---------|------------|
| **Schema FlowTemplate** | ✅ PARCIAL | `entities/FlowTemplate.json` | Tem `tipo_fluxo`, `steps[]`, mas FALTA `config_global` e `estados[]` |
| **Orquestrador** | ✅ OK | `functions/preAtendimentoHandler.js` | Ponto de entrada único, mas delega para fluxo hardcoded |
| **Executor** | ⚠️ HARDCODED | `functions/preAtendimento/fluxoController.js` | Toda lógica em if/else (v10 - NÃO é genérico) |
| **Menu Builder** | ⚠️ HARDCODED | `functions/preAtendimento/menuBuilder.js` | Mensagens fixas em código |
| **Button Mappings** | ⚠️ HARDCODED | `functions/preAtendimento/buttonMappings.js` | Mapa fixo de botões |
| **Motor de Decisão** | ✅ OK | `functions/motorDecisaoPreAtendimento.js` | Camada de bypass (horário, fidelizado) |
| **InboundCore** | ✅ OK | `functions/lib/inboundCore.js` | Ponto de entrada webhook |

### **❌ O QUE ESTÁ FALTANDO**

| Item Crítico | Debate Prevê | Implementado | Gap |
|-------------|--------------|--------------|-----|
| **config_global no Playbook** | TTL, gap_ciclo, flags IA/sticky/guardian | ❌ NÃO EXISTE | Schema não tem `config_global` |
| **estados[] estruturados** | Array de estados com transições | ❌ NÃO EXISTE | Tem `steps[]` genérico, SEM estados URA |
| **FluxoControllerV11 genérico** | Lê playbook.estados e executa | ❌ NÃO EXISTE | v10 atual é 100% hardcoded |
| **Interface "Meus Playbooks"** | Tela admin para editar URA | ❌ NÃO EXISTE | Sem UI de gestão |
| **Regras de Ativação** | Filtro por contato/instância/setor | ⚠️ PARCIAL | Tem `tipo_contato_alvo`, falta `regras_ativacao` estruturado |

---

## 🔴 **GAPS CRÍTICOS DETALHADOS**

### **GAP #1: Schema FlowTemplate - INCOMPLETO para URA**

**FALTA ADICIONAR:**

```json
{
  "config_global": {
    "type": "object",
    "description": "Configurações globais do pré-atendimento",
    "properties": {
      "ttl_completed_horas": {
        "type": "number",
        "default": 24,
        "description": "Horas para resetar COMPLETED → INIT"
      },
      "gap_novo_ciclo_horas": {
        "type": "number",
        "default": 12,
        "description": "Horas de silêncio para considerar novo ciclo"
      },
      "usar_ia_no_init": {
        "type": "boolean",
        "default": true,
        "description": "Habilitar fast-track IA no INIT"
      },
      "limiar_confianca_ia": {
        "type": "number",
        "default": 70,
        "description": "Confiança mínima para aceitar IA (0-100)"
      },
      "timeout_padrao_minutos": {
        "type": "number",
        "default": 10,
        "description": "Timeout padrão para todos os estados"
      },
      "usar_sticky": {
        "type": "boolean",
        "default": true,
        "description": "Oferecer retorno ao setor anterior"
      },
      "usar_guardian": {
        "type": "boolean",
        "default": true,
        "description": "Modo guardião (atendente ausente)"
      },
      "mensagem_timeout": {
        "type": "string",
        "default": "⏰ Tempo esgotado. Digite OI para recomeçar."
      },
      "mensagem_cancelamento": {
        "type": "string",
        "default": "❌ Atendimento cancelado. Digite OI para novo atendimento."
      }
    }
  },
  "estados": {
    "type": "array",
    "description": "Estados da máquina de estados da URA",
    "items": {
      "type": "object",
      "properties": {
        "id": {
          "type": "string",
          "description": "ID único do estado"
        },
        "nome_interno": {
          "type": "string",
          "enum": ["INIT", "WAITING_STICKY_DECISION", "WAITING_SECTOR_CHOICE", "WAITING_ATTENDANT_CHOICE", "WAITING_QUEUE_DECISION", "TRANSFERRING", "COMPLETED", "TIMEOUT", "CANCELLED"],
          "description": "Nome técnico (mapeia para pre_atendimento_state)"
        },
        "titulo_admin": {
          "type": "string",
          "description": "Nome amigável para interface admin"
        },
        "descricao": {
          "type": "string",
          "description": "O que este estado faz"
        },
        "mensagem_template": {
          "type": "string",
          "description": "Template com placeholders: {nome}, {setor}, {saudacao}"
        },
        "tipo_entrada": {
          "type": "string",
          "enum": ["buttons", "text", "number", "skip", "system"],
          "description": "Como o usuário interage"
        },
        "usar_ia_fast_track": {
          "type": "boolean",
          "default": false,
          "description": "Permite IA pular este estado"
        },
        "usar_sticky_memory": {
          "type": "boolean",
          "default": false,
          "description": "Oferece retorno ao setor anterior"
        },
        "usar_guardian_mode": {
          "type": "boolean",
          "default": false,
          "description": "Detecta atendente ausente"
        },
        "timeout_minutos": {
          "type": "number",
          "description": "Timeout específico (sobrescreve global)"
        },
        "opcoes": {
          "type": "array",
          "description": "Botões ou opções de texto",
          "items": {
            "type": "object",
            "properties": {
              "id": { "type": "string" },
              "label": { "type": "string" },
              "valor": { "type": "string" },
              "emoji": { "type": "string" }
            }
          }
        },
        "transicoes": {
          "type": "array",
          "description": "Regras de transição para próximo estado",
          "items": {
            "type": "object",
            "properties": {
              "condicao": {
                "type": "object",
                "description": "Quando aplicar: {tipo: 'button_match|text_contains|ia_intent|system', valor: '...'}",
                "properties": {
                  "tipo": { "type": "string", "enum": ["button_match", "text_contains", "ia_intent", "system", "timeout", "error"] },
                  "valor": { "type": "string" },
                  "confianca_minima": { "type": "number" }
                }
              },
              "acoes_pre_transicao": {
                "type": "array",
                "description": "Ações antes de mudar estado",
                "items": {
                  "type": "object",
                  "properties": {
                    "tipo": { "type": "string", "enum": ["setar_sector_id", "setar_assigned_user_id", "entrar_fila", "enviar_mensagem", "chamar_funcao", "atualizar_contato"] },
                    "parametros": { "type": "object" }
                  }
                }
              },
              "proximo_estado": {
                "type": "string",
                "description": "Nome do próximo estado"
              },
              "mensagem_transicao": {
                "type": "string",
                "description": "Mensagem a enviar antes da transição"
              }
            }
          }
        }
      },
      "required": ["nome_interno", "mensagem_template", "tipo_entrada"]
    }
  },
  "regras_ativacao": {
    "type": "object",
    "description": "Define QUANDO este playbook é aplicado",
    "properties": {
      "escopo_contato": {
        "type": "string",
        "enum": ["interno", "externo", "ambos"],
        "default": "externo",
        "description": "Threads internas ou externas"
      },
      "tipos_contato": {
        "type": "array",
        "items": { "type": "string", "enum": ["novo", "lead", "cliente", "fornecedor", "parceiro"] },
        "description": "Tipos de contato elegíveis (vazio = todos)"
      },
      "tags_incluidas": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Contato DEVE ter estas tags"
      },
      "tags_excluidas": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Contato NÃO pode ter estas tags (ex: vip, sem_URA)"
      },
      "integracoes_whatsapp": {
        "type": "array",
        "items": { "type": "string" },
        "description": "IDs das integrações onde roda (vazio = todas)"
      },
      "setores_permitidos": {
        "type": "array",
        "items": { "type": "string", "enum": ["vendas", "assistencia", "financeiro", "fornecedor", "geral"] },
        "description": "Setores que podem ser escolhidos neste playbook"
      },
      "setor_default": {
        "type": "string",
        "enum": ["vendas", "assistencia", "financeiro", "fornecedor", "geral"],
        "description": "Setor padrão se IA não definir"
      },
      "horario_inicio": {
        "type": "string",
        "description": "HH:MM (início do horário comercial)"
      },
      "horario_fim": {
        "type": "string",
        "description": "HH:MM (fim do horário comercial)"
      },
      "dias_semana": {
        "type": "array",
        "items": { "type": "number", "minimum": 0, "maximum": 6 },
        "description": "Dias da semana ativos (0=Dom, 6=Sáb)"
      }
    }
  },
  "metricas_playbook": {
    "type": "object",
    "description": "Métricas específicas deste playbook",
    "properties": {
      "total_execucoes": { "type": "number", "default": 0 },
      "total_concluidos": { "type": "number", "default": 0 },
      "total_abandonados": { "type": "number", "default": 0 },
      "total_timeout": { "type": "number", "default": 0 },
      "tempo_medio_conclusao_segundos": { "type": "number", "default": 0 },
      "taxa_conclusao_percentual": { "type": "number", "default": 0 },
      "taxa_uso_ia": { "type": "number", "default": 0 },
      "taxa_uso_sticky": { "type": "number", "default": 0 },
      "taxa_uso_guardian": { "type": "number", "default": 0 },
      "distribuicao_por_setor": {
        "type": "object",
        "description": "Contadores por setor escolhido"
      }
    }
  }
}
```

---

## 🔴 **GAP #2: FluxoController v10 - 100% HARDCODED**

### **Evidências de Código Fixo:**

**Arquivo:** `functions/preAtendimento/fluxoController.js`

| Linha | O Que Está Hardcoded | Deveria Ser |
|-------|----------------------|-------------|
| 16-84 | `processarEstadoINIT()` - lógica de sticky/guardian/IA fixa | Lido de `playbook.estados.find(e => e.nome_interno === 'INIT')` |
| 80 | `MenuBuilder.construirMenuBoasVindas()` - menu fixo | Template de `estadoConfig.mensagem_template` |
| 148-169 | `processarWAITING_SECTOR_CHOICE()` - mapa fixo de setores | Lido de `estadoConfig.opcoes[]` |
| 174-217 | `processarWAITING_ATTENDANT_CHOICE()` - chamada direta roteamento | Executado via `estadoConfig.transicoes[]` |
| 53 | String fixa: "Quer que eu te ajude agora?" | `estadoConfig.mensagem_template` com `{guardian_mensagem}` |

**PROBLEMA:**  
Para mudar QUALQUER comportamento da URA, é preciso EDITAR CÓDIGO JS.

**SOLUÇÃO:**  
Criar `FluxoControllerV11` que:
```javascript
async processarEstado(base44, thread, contact, integrationId, userInput, intentContext) {
  const playbook = this.playbook; // Injetado no construtor
  const estadoAtual = thread.pre_atendimento_state;
  const estadoConfig = playbook.estados.find(e => e.nome_interno === estadoAtual);
  
  // 1. Verificar fast-track IA (se habilitado)
  if (estadoConfig.usar_ia_fast_track && intentContext?.confidence >= playbook.config_global.limiar_confianca_ia) {
    return this.executarFastTrackIA(estadoConfig, intentContext);
  }
  
  // 2. Verificar sticky (se habilitado)
  if (estadoConfig.usar_sticky_memory && thread.sector_id) {
    return this.executarStickyCheck(estadoConfig, thread);
  }
  
  // 3. Verificar guardian (se habilitado)
  if (estadoConfig.usar_guardian_mode && thread.assigned_user_id) {
    return this.executarGuardianMode(estadoConfig, thread);
  }
  
  // 4. Renderizar mensagem do playbook
  const mensagem = this.renderTemplate(estadoConfig.mensagem_template, { nome: contact.nome, ... });
  await this.enviarMensagem(base44, contact, integrationId, mensagem, estadoConfig.opcoes);
  
  // 5. Aguardar input e processar transições
  const transicaoEscolhida = this.avaliarTransicoes(estadoConfig.transicoes, userInput, intentContext);
  
  // 6. Executar ações pré-transição
  for (const acao of transicaoEscolhida.acoes_pre_transicao) {
    await this.executarAcao(acao, base44, thread, contact);
  }
  
  // 7. Atualizar estado
  await this.atualizarEstado(base44, thread.id, transicaoEscolhida.proximo_estado);
  
  // 8. Processar próximo estado recursivamente
  return this.processarEstado(...);
}
```

---

## 🔴 **GAP #3: MenuBuilder - Textos Fixos em Código**

### **Evidências:**

**Arquivo:** `functions/preAtendimento/menuBuilder.js`

| Método | String Hardcoded | Deveria Ser |
|--------|------------------|-------------|
| `construirMenuBoasVindas()` | Linha 19: "Estou aqui para te conectar..." | `playbook.estados[0].mensagem_template` |
| `construirMenuBoasVindas()` | Linha 21-24: Botões fixos (Vendas, Suporte, etc.) | `playbook.estados[0].opcoes[]` |
| `construirMensagemTimeout()` | Linha 128-133: "Tempo esgotado!..." | `playbook.config_global.mensagem_timeout` |
| `getNomeSetor()` | Linha 179-186: Mapa fixo de nomes | `playbook.metadados_setores[setor].nome_exibicao` |

**PROBLEMA:**  
Trocar texto da saudação = EDITAR CÓDIGO JS + DEPLOY.

**SOLUÇÃO:**  
MenuBuilder vira **MenuRenderer** genérico:
```javascript
static renderizarEstado(estadoConfig, variaveis) {
  const texto = this.substituirPlaceholders(estadoConfig.mensagem_template, variaveis);
  const botoes = estadoConfig.opcoes || [];
  return { texto, botoes, tipo: estadoConfig.tipo_entrada };
}
```

---

## 🔴 **GAP #4: Regras de Ativação - FALTA ESTRUTURA**

### **Debate Prevê:**
```javascript
// inboundCore chama:
const playbook = await resolverPlaybookParaMensagem(contact, thread, integration);

if (playbook) {
  await ursPreAtendimento(playbook, contact, thread, ...);
} else {
  // Fluxo normal sem URA
}
```

### **Implementado:**
- ❌ NÃO existe `resolverPlaybookParaMensagem`
- ⚠️ PARCIAL: `motorDecisaoPreAtendimento` faz bypass mas não seleciona playbook
- ❌ Schema tem `tipo_contato_alvo` mas NÃO tem filtro por tags/instâncias

### **SOLUÇÃO: Adicionar `regras_ativacao` ao Schema**

**Campos necessários (já mostrados acima):**
- `escopo_contato`: interno/externo/ambos
- `tipos_contato`: ["lead", "cliente"]
- `tags_incluidas`: ["whatsapp"]
- `tags_excluidas`: ["vip", "sem_URA"]
- `integracoes_whatsapp`: ["abc123", "def456"]
- `setores_permitidos`: ["vendas", "assistencia"]

---

## 🔴 **GAP #5: Interface Admin - NÃO EXISTE**

### **Debate Prevê:**
Uma tela "Meus Playbooks" (ou "URA-Pré-Atendimento") com:
- Lista de playbooks de tipo_fluxo = "pre_atendimento"
- Editor visual de estados (INIT → SECTOR → ATTENDANT → QUEUE)
- Editor de mensagens (WYSIWYG com preview de emojis)
- Editor de botões (arrastar/reordenar)
- Editor de transições (quando X, então Y)
- Configuração global (TTL, IA, sticky, guardian)
- Métricas do playbook (taxa conclusão, tempo médio)

### **Implementado:**
- ❌ NÃO EXISTE nenhuma tela dedicada
- ⚠️ `pages/PlaybooksAutomacao.jsx` existe mas é genérica (não específica para URA)

---

## 📋 **CÓDIGO ATUAL QUE DEVE SER REMOVIDO**

### **🗑️ Para Depreciar Após V11:**

| Arquivo | Motivo | Substituído Por |
|---------|--------|-----------------|
| `functions/preAtendimento/fluxoController.js` | 100% hardcoded | `FluxoControllerV11` genérico |
| `functions/preAtendimento/menuBuilder.js` | Strings fixas | Playbook `estados[].mensagem_template` |
| `functions/preAtendimento/buttonMappings.js` | Mapa fixo de botões | Playbook `estados[].opcoes[]` |
| Qualquer função `*URA*` antiga | Lógica espalhada | Centralizado no executor |

### **✅ Para MANTER (mas adaptar):**

| Arquivo | Papel | Mudança Necessária |
|---------|-------|-------------------|
| `functions/preAtendimentoHandler.js` | Orquestrador | Carregar playbook e instanciar `FluxoControllerV11(playbook)` |
| `functions/motorDecisaoPreAtendimento.js` | Bypass (horário, fidelizado) | Adicionar lógica de seleção de playbook |
| `functions/lib/inboundCore.js` | Ponto de entrada | Chamar `resolverPlaybookParaMensagem()` |

---

## 🎯 **ROADMAP DE IMPLEMENTAÇÃO**

### **SPRINT 0: EXPANDIR SCHEMA (2h)**
- ✅ Adicionar `config_global` ao FlowTemplate
- ✅ Adicionar `estados[]` ao FlowTemplate
- ✅ Adicionar `regras_ativacao` ao FlowTemplate
- ✅ Adicionar `metricas_playbook` ao FlowTemplate
- ✅ Script `migrarURAParaPlaybook.js` (converte v10 atual para playbook)

**Resultado:** Banco tem playbook "URA Padrão v10" que replica comportamento atual.

---

### **SPRINT 1: EXECUTOR GENÉRICO (1 semana)**

**Criar:**
- `functions/preAtendimento/FluxoControllerV11.js`
  - Modo: `'configuravel' | 'legado'`
  - `processarEstado()` genérico
  - `avaliarTransicoes()` baseado em playbook
  - `executarAcao()` para ações pré-transição
  - `renderTemplate()` para mensagens

**Adaptar:**
- `preAtendimentoHandler.js`:
  ```javascript
  const playbook = await buscarPlaybookAtivo(thread, contact, integration);
  
  if (playbook?.estados) {
    const controller = new FluxoControllerV11(playbook);
    return await controller.processarEstado(base44, thread, contact, ...);
  } else {
    // Fallback temporário para código legado
    return await FluxoController.processarEstado(base44, thread, contact, ...);
  }
  ```

**Resultado:** Sistema roda HÍBRIDO (playbook se tiver, código legado se não).

---

### **SPRINT 2: INTERFACE ADMIN (1 semana)**

**Criar:**
- `pages/MeusPlaybooks.jsx` (ou renomear "PlaybooksAutomacao")
  - Filtro: `tipo_fluxo = "pre_atendimento"`
  - Editor de estados (drag-and-drop)
  - Editor de mensagens (preview em tempo real)
  - Editor de botões (adicionar/remover/reordenar)
  - Editor de transições (visual flow)
  - Config global (toggles + sliders)

**Componentes:**
- `components/playbooks/EditorEstadosURA.jsx`
- `components/playbooks/EditorTransicoes.jsx`
- `components/playbooks/PreviewMensagemURA.jsx`
- `components/playbooks/ConfigGlobalURA.jsx`
- `components/playbooks/MetricasPlaybookURA.jsx`

**Resultado:** Admin consegue criar/editar URA 100% via interface.

---

### **SPRINT 3: SELETOR DE PLAYBOOKS (3 dias)**

**Criar:**
- `functions/lib/resolverPlaybookParaMensagem.js`:
  ```javascript
  async function resolverPlaybookParaMensagem(contact, thread, integration) {
    const playbooks = await base44.entities.FlowTemplate.filter({
      tipo_fluxo: 'pre_atendimento',
      ativo: true
    });
    
    for (const pb of playbooks) {
      const regras = pb.regras_ativacao || {};
      
      // Verificar escopo (interno/externo)
      if (regras.escopo_contato === 'interno' && thread.thread_type === 'contact_external') continue;
      if (regras.escopo_contato === 'externo' && thread.thread_type !== 'contact_external') continue;
      
      // Verificar tipo de contato
      if (regras.tipos_contato?.length > 0 && !regras.tipos_contato.includes(contact.tipo_contato)) continue;
      
      // Verificar tags incluídas
      if (regras.tags_incluidas?.length > 0) {
        const hasAll = regras.tags_incluidas.every(tag => contact.tags?.includes(tag));
        if (!hasAll) continue;
      }
      
      // Verificar tags excluídas
      if (regras.tags_excluidas?.length > 0) {
        const hasAny = regras.tags_excluidas.some(tag => contact.tags?.includes(tag));
        if (hasAny) continue;
      }
      
      // Verificar integração
      if (regras.integracoes_whatsapp?.length > 0 && !regras.integracoes_whatsapp.includes(integration.id)) continue;
      
      // ✅ Passou todos os filtros
      return pb;
    }
    
    // Nenhum playbook bateu
    return null;
  }
  ```

**Adaptar:**
- `inboundCore.js`:
  ```javascript
  // Após normalizar payload e resetar promoções...
  
  const playbook = await resolverPlaybookParaMensagem(contact, thread, integration);
  
  if (playbook) {
    await base44.functions.invoke('preAtendimentoHandler', {
      thread_id: thread.id,
      contact_id: contact.id,
      playbook_id: playbook.id,
      user_input: { type: 'text', content: normalizedText },
      intent_context: iaResult
    });
    return;
  }
  
  // Sem playbook = fluxo normal (humano direto)
  ```

**Resultado:** Sistema escolhe playbook correto automaticamente.

---

### **SPRINT 4: LIMPEZA BIG BANG (3 dias)**

**Remover:**
- ❌ `functions/preAtendimento/fluxoController.js` (v10)
- ❌ `functions/preAtendimento/menuBuilder.js`
- ❌ `functions/preAtendimento/buttonMappings.js`
- ❌ Qualquer referência a URA hardcoded

**Renomear:**
- `FluxoControllerV11.js` → `fluxoController.js`
- Remover modo `'legado'`, deixar só `'configuravel'`

**Atualizar Docs:**
- README: "Qualquer mudança de URA é via FlowTemplate / Meus Playbooks"
- Marcar v10 como `@deprecated`

**Resultado:** Zero código de URA fora do executor genérico.

---

## 📊 **COMPARAÇÃO: ANTES vs DEPOIS**

### **ANTES (v10 - Atual):**
```
📂 Lógica de URA Espalhada:
├── fluxoController.js (280 linhas hardcoded)
├── menuBuilder.js (188 linhas strings fixas)
├── buttonMappings.js (50 linhas mapa fixo)
├── Qualquer função que muda pre_atendimento_state
└── SEM interface admin (precisa editar código)

🛠️ Para mudar saudação:
1. Abrir menuBuilder.js
2. Editar linha 19
3. Commit + deploy
4. Rezar para não quebrar
```

### **DEPOIS (v11 - Debate):**
```
📂 Lógica de URA Centralizada:
├── FlowTemplate (DB) - 1 registro por URA
│   ├── config_global (TTL, IA, sticky, guardian)
│   ├── estados[] (INIT, SECTOR, ATTENDANT, QUEUE)
│   └── regras_ativacao (contato, instância, setor)
├── FluxoControllerV11.js (executor genérico, SEM lógica de negócio)
└── pages/MeusPlaybooks.jsx (interface admin)

🛠️ Para mudar saudação:
1. Abrir "Meus Playbooks"
2. Clicar em estado "INIT"
3. Editar campo "Mensagem"
4. Salvar (atualiza DB)
5. ✅ Imediato (sem deploy)
```

---

## 🎯 **DECISÕES DE ARQUITETURA**

### **1. Manter `preAtendimentoHandler` ou Renomear?**

**Debate:** Sugere renomear para `ursPreAtendimento`

**Decisão:** ✅ **MANTER `preAtendimentoHandler`**  
**Motivo:** Nome já usado em automações/webhooks. Trocar quebra referências.

---

### **2. Modo Híbrido ou Big Bang?**

**Debate:** Sprints 2-3 com modo `'legado' | 'configuravel'`

**Decisão:** ✅ **HÍBRIDO é mandatório**  
**Motivo:** Não podemos quebrar produção. Migração gradual:
1. v11 lançado com fallback para v10
2. Script migra URA atual para playbook
3. Admin testa playbook em staging
4. Ativa playbook em produção
5. Remove código v10

---

### **3. FlowTemplate Único ou Múltiplos?**

**Debate:** Permite múltiplos playbooks (filtrados por `regras_ativacao`)

**Decisão:** ✅ **MÚLTIPLOS (com prioridade)**  
**Motivo:** Casos de uso:
- URA Padrão (geral)
- URA VIP (tags: ["vip"])
- URA Fornecedor (tipo_contato: "fornecedor")
- URA Fora de Horário (horário_inicio/fim)

**Implementação:**
```javascript
const playbooks = await base44.entities.FlowTemplate.filter({
  tipo_fluxo: 'pre_atendimento',
  ativo: true
}).sort((a, b) => (b.prioridade || 0) - (a.prioridade || 0));

for (const pb of playbooks) {
  if (avaliarRegrasAtivacao(pb, contact, thread, integration)) {
    return pb; // Primeiro que bater (por prioridade)
  }
}
```

---

## 📊 **MATRIZ DE COBERTURA: DEBATE vs CÓDIGO**

| Conceito do Debate | Status | Próximo Passo |
|-------------------|--------|---------------|
| **1. FlowTemplate como fonte única** | 🟡 PARCIAL | Expandir schema com `config_global`, `estados`, `regras_ativacao` |
| **2. Executor genérico (v11)** | 🔴 NÃO EXISTE | Criar `FluxoControllerV11.js` |
| **3. Remover código espalhado** | 🔴 NÃO FEITO | Depreciar v10 após v11 estável |
| **4. Interface "Meus Playbooks"** | 🔴 NÃO EXISTE | Criar `pages/MeusPlaybooks.jsx` |
| **5. Regras de ativação** | 🟡 PARCIAL | Adicionar `regras_ativacao` ao schema + criar `resolverPlaybookParaMensagem()` |
| **6. Métricas por playbook** | 🟡 PARCIAL | Schema tem `metricas`, falta rastreamento |
| **7. TTL/Gap configurável** | 🔴 NÃO EXISTE | Implementar em `preAtendimentoHandler` |

---

## 🚀 **PRÓXIMOS PASSOS IMEDIATOS**

### **1️⃣ EXPANDIR SCHEMA (AGORA - 30min)**
Adicionar campos:
- `config_global`
- `estados[]`
- `regras_ativacao`
- `metricas_playbook`

### **2️⃣ CRIAR PLAYBOOK MIGRADOR (1h)**
Script `functions/scripts/migrarURAv10ParaPlaybook.js`:
- Lê código atual (fluxoController + menuBuilder)
- Gera FlowTemplate equivalente
- Insere no banco como "URA Padrão v10"

### **3️⃣ IMPLEMENTAR EXECUTOR V11 (3 dias)**
Criar `FluxoControllerV11` com modo híbrido.

### **4️⃣ CRIAR INTERFACE ADMIN (5 dias)**
Tela `MeusPlaybooks` para edição visual.

### **5️⃣ DEPRECIAR V10 (1 dia)**
Após v11 estável em produção, remover código antigo.

---

## ✅ **VALIDAÇÃO: O Debate Está Correto?**

**SIM.** O plano de:
1. ❌ Remover código espalhado
2. ✅ Centralizar em FlowTemplate + Executor
3. ✅ Interface admin sem programação

É **VIÁVEL** e **NECESSÁRIO** porque:
- ✅ Reduz complexidade (1 lugar vs 5 arquivos)
- ✅ Permite customização (admin muda sem deploy)
- ✅ Rastreável (métricas por playbook)
- ✅ Testável (playbook = dado, não código)

---

## 🎬 **CONCLUSÃO**

### **Alinhamento com Debate: 40%**
- ✅ Schema base existe
- ✅ Orquestrador separado
- ❌ Executor ainda hardcoded
- ❌ Sem interface admin
- ❌ Regras de ativação incompletas

### **Trabalho Restante: ~2 semanas**
- Sprint 0: Schema (30min)
- Sprint 1: Executor V11 (3 dias)
- Sprint 2: Interface (5 dias)
- Sprint 3: Seletor playbooks (3 dias)
- Sprint 4: Limpeza (1 dia)

### **Ganho Esperado:**
- 📉 **-70% linhas código** (280+188+50 → executor genérico ~150 linhas)
- ⚡ **Mudanças em segundos** (vs horas de deploy)
- 📊 **Métricas rastreáveis** (por playbook)
- 🎨 **Customização total** (sem tocar código)

---

**STATUS FINAL:** ✅ **Debate está correto, projeto atual está 40% do caminho. Gaps identificados, roadmap traçado.**