# 🏗️ ARQUITETURA UNIFICADA DO AGENTE NEXUS AI
## Consolidação de Todos os Componentes de IA

---

## 📋 MAPEAMENTO: ANTES vs DEPOIS

### **ANTES (IA Fragmentada):**

```
Sistema VendaPro (Pré-Unificação)
│
├─ components/comunicacao/
│  ├─ NexusEngine.jsx              ❌ Sugestões de resposta (isolado)
│  ├─ NexusEngineV2.jsx            ❌ Tool calling (redundante)
│  └─ NexusEngineV3.jsx            ❌ Ultra-otimizado (sem auditoria)
│
├─ components/inteligencia/
│  ├─ MotorInteligenciaV3.jsx      ❌ Análise de clientes (lote)
│  ├─ QualificadorAutomatico.jsx   ❌ Scoring de leads
│  ├─ RoteamentoInteligente.jsx    ❌ Atribuição de vendedores
│  └─ MotorRAGV3.jsx               ❌ Busca vetorial (isolado)
│
├─ functions/
│  ├─ nexusClassifier.js           ❌ Classificação de intenção
│  └─ businessIA.js                ❌ Insights estratégicos
│
└─ components/global/
   └─ NexusChat.jsx                ❌ Chama InvokeLLM direto
```

**Problemas:**
- ❌ 8+ componentes fazendo LLM calls independentes
- ❌ Sem auditoria unificada
- ❌ Sem rate limiting centralizado
- ❌ Sem observabilidade
- ❌ Duplicação de lógica (classificação, extração, sugestão)
- ❌ Difícil manutenção (mudança em 1 playbook = reescrever componente)

---

### **DEPOIS (IA Centralizada):**

```
Sistema VendaPro (Pós-Unificação)
│
├─ CAMADA DE INTERFACE
│  ├─ components/global/NexusChat.jsx          ✅ Interface conversacional
│  ├─ pages/JarvisControl.js                   ✅ Dashboard de controle
│  └─ components/comunicacao/AgentSuggestion   ✅ Sugestões inline (opcional)
│
├─ CAMADA DE GATEWAY
│  └─ functions/agentCommand.js                ✅ Gateway único (auditoria + contexto)
│
├─ CAMADA DE ORQUESTRAÇÃO
│  ├─ functions/agentOrchestrator.js           ✅ Dispatcher de playbooks
│  └─ functions/jarvisEventLoop.js             ✅ Ciclo autônomo (scheduled)
│
├─ CAMADA DE PLAYBOOKS
│  ├─ Playbook 01: Link Intelligence           ✅ Implementado
│  ├─ Playbook 02: Follow-up Automático        🟡 Parcial (jarvisEventLoop)
│  ├─ Playbook 03: Lead Qualification          ⚪ A migrar (QualificadorAutomatico)
│  ├─ Playbook 04: Smart Routing               ⚪ A migrar (RoteamentoInteligente)
│  ├─ Playbook 05: Chat Response               ⚪ A migrar (NexusEngine)
│  └─ Playbook 06: Strategic Insights          ⚪ A migrar (businessIA)
│
├─ CAMADA DE FERRAMENTAS (Tools)
│  ├─ functions/firecrawlService.js            ✅ Web scraping + cache
│  ├─ Tool: InvokeLLM                          ✅ Nativo (Core)
│  ├─ Tool: SendEmail                          ✅ Nativo (Core)
│  ├─ Tool: RAG                                ⚪ A integrar (MotorRAGV3)
│  └─ Tool: IntentClassifier                   ⚪ A integrar (nexusClassifier)
│
└─ CAMADA DE AUDITORIA
   ├─ entities/AgentRun.json                   ✅ Registro de execuções
   ├─ entities/AgentDecisionLog.json           ✅ Registro de decisões
   ├─ entities/ThreadContext.json              ✅ Memória operacional
   └─ entities/ExternalSourceCache.json        ✅ Cache de scraping
```

**Vantagens:**
- ✅ 1 gateway único (agentCommand)
- ✅ Auditoria centralizada
- ✅ Playbooks modulares (fácil adicionar/modificar)
- ✅ Rate limiting global
- ✅ Observabilidade completa

---

## 🔄 FLUXO DE DADOS UNIFICADO

### **Fluxo 1: Usuário Conversa com Agente (NexusChat)**

```
1. Usuário digita: "Quais clientes não foram contatados?"
                              ↓
2. NexusChat.jsx
   - Captura mensagem
   - Adiciona agentContext (user, page, path)
                              ↓
3. agentCommand.js (Gateway)
   - Cria AgentRun (auditoria inicia)
   - Determina playbook: "chat_response"
   - Busca contexto do sistema (clientes, threads, etc.)
                              ↓
4. InvokeLLM (Tool)
   - Gera resposta contextual
                              ↓
5. AgentDecisionLog
   - Registra decisão (ferramentas usadas, confiança)
                              ↓
6. AgentRun
   - Finaliza execução (status: concluido, duration_ms)
                              ↓
7. NexusChat.jsx
   - Renderiza resposta
   - Mostra run_id (auditoria visível)
```

---

### **Fluxo 2: Webhook Recebe Mensagem com URL**

```
1. webhookWatsZapi.js
   - Recebe mensagem inbound
   - Detecta URL no conteúdo
   - Dispara (async, não bloqueia):
                              ↓
2. agentOrchestrator.js
   - Cria AgentRun (trigger: message.inbound)
   - Playbook: "link_intelligence"
                              ↓
3. URL Detection
   - Extrai URLs
   - Normaliza (remove UTM, trailing slash)
   - Calcula SHA-256 hash
                              ↓
4. Cache Check
   - Busca ExternalSourceCache por hash
   - Se válido → usa cache (pula para 7)
   - Se não → continua
                              ↓
5. firecrawlService.js (Tool)
   - Valida whitelist
   - Scrape URL (Firecrawl ou fetch simples)
   - Salva ExternalSourceCache (TTL: 7 dias)
                              ↓
6. InvokeLLM (Tool - Extract Insights)
   - Extrai: produto, preço, specs, urgência
                              ↓
7. ThreadContext
   - Atualiza external_sources[]
   - Atualiza entities_extracted
                              ↓
8. InvokeLLM (Tool - Generate Suggestion)
   - Gera sugestão de resposta profissional
                              ↓
9. ThreadContext
   - Adiciona agent_suggestions[]
                              ↓
10. AgentDecisionLog
    - Registra decisão completa
                              ↓
11. AgentRun
    - Finaliza (status: concluido)
                              ↓
12. UI (Comunicacao.jsx - futuro)
    - Renderiza sugestão na thread
    - Atendente pode aceitar/descartar
```

---

### **Fluxo 3: Ciclo Autônomo (jarvisEventLoop)**

```
Automação Scheduled (5 minutos)
                              ↓
1. jarvisEventLoop.js
   - Busca eventos pendentes (EventoSistema)
   - Busca threads sem resposta (> 30min)
   - Busca orçamentos parados (> 7 dias)
                              ↓
2. Para cada evento:
   - Cria AgentRun
   - Determina playbook apropriado
   - Executa ação (ex: criar TarefaInteligente)
   - Finaliza AgentRun
                              ↓
3. Retorna resultados:
   {
     eventos_processados: 5,
     threads_processadas: 3,
     orcamentos_processados: 2,
     erros: 0
   }
```

---

## 🛠️ GUIA DE IMPLEMENTAÇÃO DE NOVOS PLAYBOOKS

### **Template de Playbook:**

```javascript
// functions/playbookMeuPlaybook.js
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const { evento } = await req.json();

  // 1. Criar AgentRun
  const run = await base44.asServiceRole.entities.AgentRun.create({
    trigger_type: evento.tipo,
    trigger_event_id: evento.id,
    playbook_selected: 'meu_playbook',
    execution_mode: 'assistente',
    status: 'processando',
    started_at: new Date().toISOString()
  });

  try {
    // 2. Lógica do playbook
    const resultado = await minhaLogica(evento);

    // 3. Registrar decisão
    await base44.asServiceRole.entities.AgentDecisionLog.create({
      agent_run_id: run.id,
      step_name: 'acao_principal',
      decisao_tipo: 'tipo_acao',
      decisao_tomada: resultado,
      confianca_ia: 80,
      resultado_execucao: 'sucesso',
      timestamp_decisao: new Date().toISOString()
    });

    // 4. Finalizar run
    await base44.asServiceRole.entities.AgentRun.update(run.id, {
      status: 'concluido',
      completed_at: new Date().toISOString(),
      duration_ms: Date.now() - new Date(run.started_at).getTime()
    });

    return Response.json({ success: true, resultado });

  } catch (error) {
    // 5. Registrar falha
    await base44.asServiceRole.entities.AgentRun.update(run.id, {
      status: 'falhou',
      error_message: error.message,
      completed_at: new Date().toISOString()
    });

    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
});
```

---

## 🎯 PRÓXIMOS PLAYBOOKS (Ordem de Prioridade)

### **1. Chat Response (Migrar NexusEngine)**
**Trigger:** Usuário faz pergunta no NexusChat  
**Ação:** Buscar contexto + gerar resposta  
**Impacto:** Alto (desativa 3 componentes legados)  
**Esforço:** Médio (já 80% implementado em agentCommand)

### **2. Lead Qualification (Migrar QualificadorAutomatico)**
**Trigger:** Cliente criado ou atualizado  
**Ação:** Calcular scores + próxima ação  
**Impacto:** Alto (automação de qualificação)  
**Esforço:** Alto (lógica complexa)

### **3. Smart Routing (Migrar RoteamentoInteligente)**
**Trigger:** Lead qualificado  
**Ação:** Atribuir vendedor ideal  
**Impacto:** Médio (otimização de conversão)  
**Esforço:** Médio

### **4. Strategic Insights (Migrar businessIA)**
**Trigger:** Scheduled (semanal)  
**Ação:** Gerar relatório de oportunidades/riscos  
**Impacto:** Baixo (informacional)  
**Esforço:** Baixo

---

## 📊 DASHBOARD CONSOLIDADO (JarvisControl)

### **Abas Atuais:**
1. ✅ **Execuções** (AgentRun - últimas 50)
2. ✅ **Decisões** (AgentDecisionLog - últimas 30)

### **Abas Futuras:**
3. ⚪ **Playbooks** (lista, status, métricas individuais)
4. ⚪ **Insights** (oportunidades detectadas, alertas)
5. ⚪ **Configuração** (whitelist, guardrails, modos)
6. ⚪ **ROI** (tempo economizado, custos de API, valor gerado)

---

## 🔐 SEGURANÇA E COMPLIANCE

### **Controles Implementados:**

1. **Autenticação Obrigatória**
   - `agentCommand` verifica `base44.auth.me()`
   - Nenhuma ação sem usuário logado

2. **Auditoria Completa**
   - AgentRun registra TODA execução
   - AgentDecisionLog explica TODA decisão
   - Timestamps precisos (início, fim, duração)

3. **Guardrails por Modo**
   ```javascript
   if (execution_mode === 'assistente') {
     // Apenas sugere, nunca age
   } else if (execution_mode === 'parcial') {
     // Age apenas em baixo risco + notifica depois
   } else if (execution_mode === 'forte') {
     // Age dentro de políticas + aprende
   }
   ```

4. **Rate Limiting**
   - Cache-first (ExternalSourceCache)
   - Cooldown por thread (5min entre URLs)
   - Timeout de 30s (Firecrawl)

5. **Rollback Manual**
   - Toda ação do agente pode ser revertida
   - Histórico completo em AuditLog

---

## 🚀 PRÓXIMO SPRINT (7 dias)

### **Objetivo:** Playbook 01 em produção + início da migração

### **Tarefas:**

**Dia 1-2: Integração Webhook**
- [ ] Adicionar disparo de agentOrchestrator no webhookWatsZapi
- [ ] Testar com URLs reais (MercadoLivre, Amazon)
- [ ] Validar cache funcionando

**Dia 3-4: UI de Sugestões**
- [ ] Decidir onde renderizar AgentSuggestion (ChatWindow ou separado)
- [ ] Implementar feedback (aceito/descartado)
- [ ] Testar fluxo completo

**Dia 5-6: Migração NexusEngine → Playbook**
- [ ] Criar Playbook 05 "Chat Response"
- [ ] Redirecionar todas as chamadas de NexusEngine para agentCommand
- [ ] Deprecar NexusEngine (comentar código, não deletar)

**Dia 7: Documentação e Treinamento**
- [ ] Documentar para usuários (como usar sugestões)
- [ ] Dashboard de métricas (JarvisControl)
- [ ] Apresentação executiva (resultados 7 dias)

---

## 📖 DECISÕES ARQUITETURAIS

### **Por que Backend-First?**

**Problema do Frontend-First:**
```javascript
// ❌ Anti-pattern (código atual em alguns componentes)
const resposta = await base44.integrations.Core.InvokeLLM({...});
// Problemas:
// - Sem auditoria (quem chamou? quando? por quê?)
// - Sem rate limiting (cada componente chama livremente)
// - Sem cache (repete chamadas)
// - Difícil debugging (erro onde?)
```

**Solução Backend-First:**
```javascript
// ✅ Best practice
const resposta = await base44.functions.invoke('agentCommand', {...});
// Vantagens:
// - Auditoria automática (AgentRun criado)
// - Rate limiting centralizado
// - Cache unificado
// - Debugging via JarvisControl
```

---

### **Por que Playbooks Modulares?**

**Antes:** 1 componente = 1 funcionalidade (rígido)  
**Depois:** 1 playbook = N triggers + N ações (flexível)

**Exemplo:**
```javascript
// Playbook "Lead Qualification" pode ser disparado por:
// - Cliente.created
// - Cliente.updated
// - Message.inbound (se mencionar interesse)
// - Scheduled (re-qualificação semanal)

// Todas as triggers usam a MESMA lógica (DRY)
```

---

## 🎯 ESTADO ATUAL: RESUMO EXECUTIVO

### **O que está PRONTO para usar:**
- ✅ Infraestrutura completa (4 entidades + 4 functions)
- ✅ Playbook 01 funcional (Link Intelligence)
- ✅ NexusChat contextual (agentCommand)
- ✅ JarvisControl (observabilidade)
- ✅ Ciclo autônomo (jarvisEventLoop a cada 5min)
- ✅ Guardrails implementados

### **O que falta para "produção-ready":**
- 🟡 Integrar webhook (1 linha de código)
- 🟡 Testar com tráfego real (7 dias)
- 🟡 Ajustar confiança/sugestões baseado em uso
- 🟡 Migrar componentes legados (NexusEngine, QualificadorAutomatico)

### **Esforço Total Restante:**
- **Playbook 01 em produção:** 2-4 horas
- **Migração completa:** 2-3 semanas
- **Autonomia parcial (Fase 2):** 4-6 semanas

---

## 📞 CONTATO ENTRE SISTEMAS

### **Layout ↔ Agente:**
```javascript
// Layout.js
<NexusChat
  agentContext={{...}}     // Layout injeta contexto
  agentSession={{...}}     // Layout injeta estado
/>

// NexusChat usa contexto para enriquecer comandos
```

### **Comunicação ↔ Agente:**
```javascript
// ChatWindow.jsx
// ❌ ANTES: AgentSuggestion integrado
// ✅ DEPOIS: Completamente desacoplado

// Futuramente (opcional): mostrar sugestões inline
// Mas agente roda independente (jarvisEventLoop)
```

### **JarvisControl ↔ Agente:**
```javascript
// JarvisControl lê auditoria
const runs = await base44.entities.AgentRun.list('-created_date', 50);
const decisions = await base44.entities.AgentDecisionLog.list('-timestamp_decisao', 30);

// Mostra execuções, permite executar manualmente
await base44.functions.invoke('jarvisEventLoop', {...});
```

---

## 🏆 VALIDAÇÃO: CHECKLIST BEST-IN-CLASS

### **Arquitetura:**
- [x] Backend-first (UI não chama LLM direto)
- [x] Event-driven (agente reage a eventos)
- [x] Playbooks modulares (fácil adicionar/modificar)
- [x] Gateway único (agentCommand)
- [x] Desacoplamento total (Comunicação ≠ Agente)

### **Observabilidade:**
- [x] Auditoria completa (AgentRun + DecisionLog)
- [x] Dashboard dedicado (JarvisControl)
- [x] Métricas em tempo real
- [x] Logs estruturados

### **Segurança:**
- [x] Autenticação obrigatória
- [x] Guardrails por modo (assistente/parcial/forte)
- [x] Whitelist de domínios
- [x] Rate limiting
- [x] Timeout protection

### **Performance:**
- [x] Cache-first (ExternalSourceCache)
- [x] Assíncrono (não bloqueia webhook)
- [x] Debounce (Layout, 2min)
- [x] Limite de tokens (substring em auditoria)

### **UX:**
- [x] Agent Session State visível (ON/OFF/SLOW)
- [x] Contexto do local (página, usuário, seleção)
- [x] Feedback visual (badge dinâmico)
- [x] Interface separada (JarvisControl)

---

## 📚 DOCUMENTOS RELACIONADOS

1. **Análise Layout Best Practices**  
   `components/nexus-ai/ANALISE_LAYOUT_BEST_PRACTICES.md`
   
2. **Spec Playbook 01 (Link Intelligence)**  
   `components/nexus-ai/SPEC_PLAYBOOK_01_LINK_INTELLIGENCE.md`
   
3. **Comparativo Clawbot**  
   `components/nexus-ai/COMPARACAO_MERCADO_CLAWBOT.md`

4. **Arquitetura Unificada (este documento)**  
   `components/nexus-ai/ARQUITETURA_UNIFICADA.md`

---

## ✅ CONCLUSÃO

O Nexus AI agora está arquiteturado como **agente autônomo de classe enterprise**, com:

- ✅ Separação clara entre ambiente (Layout) e agente (NexusChat + JarvisControl)
- ✅ Orquestração centralizada (agentCommand → agentOrchestrator)
- ✅ Auditoria obrigatória (compliance-ready)
- ✅ Ciclo autônomo (jarvisEventLoop)
- ✅ Playbook 01 funcional (pronto para produção)

**Próximo passo:** Integrar webhook e validar com tráfego real.

---

**Documento mestre - última atualização: 30/01/2026**  
**Status:** ✅ Arquitetura implementada, aguardando testes em produção