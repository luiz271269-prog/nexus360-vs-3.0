# 🏗️ ARQUITETURA COMPLETA: MOTOR DE AUTOMAÇÕES NEXUS360

**Data:** 2026-01-19  
**Objetivo:** Mapear linha lógica completa de como automações funcionam - do webhook até a execução.

---

## 🎯 **VISÃO GERAL: 3 CAMADAS**

```
┌─────────────────────────────────────────────────────────────┐
│ CAMADA 1: ENTRADA (Webhooks)                                │
│ ├─ webhookWapi.js / webhookFinalZapi.js                     │
│ ├─ instagramWebhook.js / facebookWebhook.js                 │
│ └─ gotoWebhook.js (SMS/Chamadas)                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ CAMADA 2: ORQUESTRAÇÃO (inboundCore)                        │
│ ├─ Normalizar payload                                       │
│ ├─ Criar/Atualizar Contact + Thread                         │
│ ├─ Verificar promoções (cooldown)                           │
│ ├─ Analisar intenção (IA)                                   │
│ └─ DECISÃO: Qual automação rodar?                           │
│    ├─ Promoção? → runPromotionInboundTick                   │
│    ├─ URA? → motorDecisaoPreAtendimento                     │
│    ├─ Playbook genérico? → playbookEngine                   │
│    └─ Nenhum? → Entrega para humano                         │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ CAMADA 3: EXECUÇÃO (Motores Especializados)                 │
│ ├─ FluxoControllerV11 (URA Pré-Atendimento)                 │
│ ├─ PlaybookEngine (Fluxos genéricos)                        │
│ ├─ PromotionEngine (Promoções/Ofertas)                      │
│ └─ QuickRepliesManager (Respostas Rápidas)                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 **FLUXOGRAMA COMPLETO: DO WEBHOOK À EXECUÇÃO**

```
┌──────────────────────────────────────────────────────────────────────┐
│ 1️⃣ ENTRADA: Cliente manda "Oi" no WhatsApp                          │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 2️⃣ WEBHOOK HANDLER (webhookWapi/Zapi)                               │
│    ├─ Validar signature                                             │
│    ├─ Normalizar payload (W-API → Padrão)                           │
│    ├─ Criar ZapiPayloadNormalized (log)                             │
│    └─ Chamar → processInbound(normalizedPayload)                    │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 3️⃣ INBOUND CORE (functions/lib/inboundCore.js)                      │
│    ├─ Contact existe? → Atualizar : Criar                           │
│    ├─ Thread existe? → Atualizar : Criar                            │
│    ├─ Salvar Message                                                │
│    ├─ Verificar cooldown promoções                                  │
│    └─ Analisar intenção (IA opcional)                               │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 4️⃣ MOTOR DE DECISÃO (motorDecisaoPreAtendimento.js)                 │
│    ├─ A. BYPASS: Fora de horário? → Playbook "Fora Horário"        │
│    ├─ B. BYPASS: Fidelizado? → Direto atendente                    │
│    ├─ C. BYPASS: Continuidade 24h? → Perguntar                     │
│    ├─ D. BYPASS: Tag "nao_ura"? → Pular URA                        │
│    └─ Nenhum bypass? → Continua...                                  │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 5️⃣ RESOLVER PLAYBOOK (resolverPlaybookParaMensagem.js)              │
│    ├─ Buscar FlowTemplate ativos (tipo_fluxo específico)            │
│    ├─ Filtrar por:                                                  │
│    │   ├─ Conexão (WhatsAppIntegration)                             │
│    │   ├─ Tipo de contato (lead/cliente/fornecedor)                 │
│    │   ├─ Tags obrigatórias/bloqueadas                              │
│    │   ├─ Horário comercial                                         │
│    │   └─ Prioridade                                                │
│    └─ Retorna: Playbook escolhido (ou null)                         │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 6️⃣ DECISÃO DE ROTA                                                  │
│    ├─ Playbook tipo "pre_atendimento"? → preAtendimentoHandler      │
│    ├─ Playbook tipo "follow_up_vendas"? → playbookEngine            │
│    ├─ Playbook tipo "bot_qualificacao"? → playbookEngine            │
│    ├─ Promoção ativa? → runPromotionInboundTick                     │
│    └─ Nenhum? → Fluxo normal (humano)                               │
└──────────────────┬───────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────┐
│ 7️⃣ EXECUÇÃO                                                         │
│    ├─ FluxoControllerV11.processarEstado()                          │
│    │   ├─ Busca estado atual no playbook.estados[]                  │
│    │   ├─ Renderiza mensagem (template + variáveis)                 │
│    │   ├─ Avalia transições (IA/botão/texto)                        │
│    │   ├─ Executa ações (setar setor, atribuir, fila)               │
│    │   └─ Atualiza thread.pre_atendimento_state                     │
│    └─ Envia mensagem de volta (enviarMensagemUnificada)             │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🧩 **PEÇAS DO QUEBRA-CABEÇA**

### **1. BIBLIOTECA DE AUTOMAÇÕES (UI)**

**Arquivo:** `components/automacao/BibliotecaAutomacoes.jsx`

**O Que É:**
- Interface admin para gerenciar TODAS as automações
- 3 abas principais: Playbooks, Promoções, Respostas Rápidas

**Estrutura Atual:**

```jsx
<BibliotecaAutomacoes>
  <Tabs>
    
    {/* ABA 1: PLAYBOOKS */}
    <TabsContent value="playbooks">
      <PlaybookManager 
        tipo_fluxo="todos" // Filtra por tipo depois
      />
    </TabsContent>
    
    {/* ABA 2: PROMOÇÕES */}
    <TabsContent value="promocoes">
      <GerenciadorPromocoes />
    </TabsContent>
    
    {/* ABA 3: RESPOSTAS RÁPIDAS */}
    <TabsContent value="quick-replies">
      <QuickRepliesManager />
    </TabsContent>
    
  </Tabs>
</BibliotecaAutomacoes>
```

**PROBLEMA ATUAL:**
- ❌ Aba "Playbooks" genérica (não separa URA de outros)
- ❌ Sem visualização de "quando roda" (regras ativação)
- ❌ Sem métricas consolidadas (taxa conclusão, tempo médio)

**SOLUÇÃO:**
Expandir para **5 abas especializadas**:

```jsx
<BibliotecaAutomacoes>
  <Tabs>
    
    {/* 🆕 ABA 1: URA PRÉ-ATENDIMENTO */}
    <TabsContent value="ura">
      <PlaybookManagerURA 
        tipo_fluxo="pre_atendimento"
        showMetrics={true}
        showActivationRules={true}
      />
    </TabsContent>
    
    {/* 🆕 ABA 2: PLAYBOOKS GENÉRICOS */}
    <TabsContent value="playbooks">
      <PlaybookManager 
        tipo_fluxo={["follow_up_vendas", "bot_qualificacao", "nurturing_leads"]}
        showExecutions={true}
      />
    </TabsContent>
    
    {/* ABA 3: PROMOÇÕES (mantém) */}
    <TabsContent value="promocoes">
      <GerenciadorPromocoes />
    </TabsContent>
    
    {/* ABA 4: RESPOSTAS RÁPIDAS (mantém) */}
    <TabsContent value="quick-replies">
      <QuickRepliesManager />
    </TabsContent>
    
    {/* 🆕 ABA 5: DASHBOARD GLOBAL */}
    <TabsContent value="dashboard">
      <DashboardAutomacoes 
        metricas={[
          { tipo: "ura", total: 1250, taxa_conclusao: 87 },
          { tipo: "playbooks", total: 340, taxa_sucesso: 72 },
          { tipo: "promocoes", total: 890, taxa_conversao: 15 }
        ]}
      />
    </TabsContent>
    
  </Tabs>
</BibliotecaAutomacoes>
```

---

### **2. PLAYBOOK MANAGER URA (Novo Componente)**

**Arquivo:** `components/automacao/PlaybookManagerURA.jsx`

**Responsabilidade:**
Gerenciar playbooks de tipo_fluxo = "pre_atendimento" especificamente.

**Features Exclusivas:**

```jsx
export default function PlaybookManagerURA() {
  const [playbooks, setPlaybooks] = useState([]);
  const [playbookAtivo, setPlaybookAtivo] = useState(null);
  const [modoEdicao, setModoEdicao] = useState(false);
  
  useEffect(() => {
    carregarPlaybooksURA();
  }, []);
  
  async function carregarPlaybooksURA() {
    const pbs = await base44.entities.FlowTemplate.filter({
      tipo_fluxo: 'pre_atendimento',
    }, '-prioridade', 50);
    setPlaybooks(pbs);
  }
  
  return (
    <div>
      
      {/* 📊 HEADER COM MÉTRICAS */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <MetricCard 
          titulo="URAs Ativas"
          valor={playbooks.filter(p => p.ativo).length}
          icone={<Zap />}
        />
        <MetricCard 
          titulo="Taxa Conclusão Média"
          valor="87%"
          icone={<CheckCircle />}
        />
        <MetricCard 
          titulo="Tempo Médio"
          valor="2m34s"
          icone={<Clock />}
        />
        <MetricCard 
          titulo="Execuções Hoje"
          valor={1250}
          icone={<Activity />}
        />
      </div>
      
      {/* 📋 LISTA DE PLAYBOOKS */}
      <div className="space-y-4">
        {playbooks.map(pb => (
          <PlaybookCardURA 
            key={pb.id}
            playbook={pb}
            onClick={() => abrirEditor(pb)}
            onToggleStatus={() => toggleStatus(pb.id)}
            onDuplicate={() => duplicarPlaybook(pb)}
            onDelete={() => deletarPlaybook(pb.id)}
          />
        ))}
      </div>
      
      {/* 🆕 BOTÃO CRIAR NOVO */}
      <Button onClick={() => criarPlaybookVazio()}>
        <Plus /> Nova URA
      </Button>
      
      {/* 🎨 EDITOR (Modal ou Sidebar) */}
      {modoEdicao && (
        <EditorPlaybookURA 
          playbook={playbookAtivo}
          onSave={salvarPlaybook}
          onClose={() => setModoEdicao(false)}
        />
      )}
      
    </div>
  );
}
```

**PlaybookCardURA:**

```jsx
function PlaybookCardURA({ playbook, onClick, onToggleStatus, onDuplicate, onDelete }) {
  const metricas = playbook.metricas_playbook || {};
  const regras = playbook.regras_ativacao || {};
  
  return (
    <Card className="hover:shadow-lg transition-shadow cursor-pointer" onClick={onClick}>
      <CardHeader>
        <div className="flex justify-between items-start">
          
          {/* NOME + STATUS */}
          <div>
            <CardTitle className="flex items-center gap-2">
              {playbook.nome}
              {playbook.is_pre_atendimento_padrao && (
                <Badge variant="outline">Padrão</Badge>
              )}
            </CardTitle>
            <CardDescription>{playbook.descricao}</CardDescription>
          </div>
          
          {/* TOGGLE ATIVO/INATIVO */}
          <Switch 
            checked={playbook.ativo}
            onCheckedChange={onToggleStatus}
          />
        </div>
      </CardHeader>
      
      <CardContent>
        
        {/* 📊 MÉTRICAS EM LINHA */}
        <div className="flex gap-4 text-sm mb-4">
          <div>
            <span className="text-muted-foreground">Execuções:</span>
            <span className="ml-1 font-semibold">{metricas.total_execucoes || 0}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Conclusão:</span>
            <span className="ml-1 font-semibold">{metricas.taxa_conclusao_percentual || 0}%</span>
          </div>
          <div>
            <span className="text-muted-foreground">Tempo Médio:</span>
            <span className="ml-1 font-semibold">
              {formatarTempo(metricas.tempo_medio_conclusao_segundos)}
            </span>
          </div>
        </div>
        
        {/* 🎯 REGRAS DE ATIVAÇÃO (Resumo) */}
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">Regras de Ativação:</div>
          
          {/* Tipos de Contato */}
          {regras.tipos_permitidos?.length > 0 && (
            <div className="flex gap-2">
              <Badge variant="secondary">Tipos:</Badge>
              {regras.tipos_permitidos.map(tipo => (
                <Badge key={tipo} variant="outline">{tipo}</Badge>
              ))}
            </div>
          )}
          
          {/* Tags */}
          {regras.tags_obrigatorias?.length > 0 && (
            <div className="flex gap-2">
              <Badge variant="secondary">Tags Obrigatórias:</Badge>
              {regras.tags_obrigatorias.map(tag => (
                <Badge key={tag} className="bg-green-100 text-green-800">{tag}</Badge>
              ))}
            </div>
          )}
          
          {regras.tags_bloqueadas?.length > 0 && (
            <div className="flex gap-2">
              <Badge variant="secondary">Tags Bloqueadas:</Badge>
              {regras.tags_bloqueadas.map(tag => (
                <Badge key={tag} className="bg-red-100 text-red-800">{tag}</Badge>
              ))}
            </div>
          )}
          
          {/* Prioridade */}
          <div className="flex items-center gap-2">
            <Badge variant="secondary">Prioridade:</Badge>
            <Badge variant="outline">{regras.prioridade || 10}</Badge>
          </div>
        </div>
        
      </CardContent>
      
      {/* AÇÕES */}
      <CardFooter className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onDuplicate}>
          <Copy className="w-4 h-4 mr-1" /> Duplicar
        </Button>
        <Button size="sm" variant="ghost" onClick={onDelete}>
          <Trash className="w-4 h-4 mr-1" /> Deletar
        </Button>
      </CardFooter>
      
    </Card>
  );
}
```

---

### **3. EDITOR DE PLAYBOOK URA**

**Arquivo:** `components/automacao/EditorPlaybookURA.jsx`

**Interface com 5 Seções:**

```jsx
export default function EditorPlaybookURA({ playbook, onSave, onClose }) {
  const [dados, setDados] = useState(playbook);
  
  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-6xl h-[90vh] overflow-y-auto">
        
        <DialogHeader>
          <DialogTitle>Editar URA: {playbook.nome}</DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="config">
          
          {/* 🔧 ABA 1: CONFIGURAÇÃO GLOBAL */}
          <TabsList>
            <TabsTrigger value="config">Config Global</TabsTrigger>
            <TabsTrigger value="estados">Estados</TabsTrigger>
            <TabsTrigger value="regras">Regras Ativação</TabsTrigger>
            <TabsTrigger value="preview">Preview</TabsTrigger>
            <TabsTrigger value="metricas">Métricas</TabsTrigger>
          </TabsList>
          
          {/* CONFIG GLOBAL */}
          <TabsContent value="config">
            <SecaoConfigGlobal 
              config={dados.config_global}
              onChange={(novoConfig) => setDados({...dados, config_global: novoConfig})}
            />
          </TabsContent>
          
          {/* ESTADOS */}
          <TabsContent value="estados">
            <EditorEstados 
              estados={dados.estados}
              onChange={(novosEstados) => setDados({...dados, estados: novosEstados})}
            />
          </TabsContent>
          
          {/* REGRAS DE ATIVAÇÃO */}
          <TabsContent value="regras">
            <EditorRegrasAtivacao 
              regras={dados.regras_ativacao}
              onChange={(novasRegras) => setDados({...dados, regras_ativacao: novasRegras})}
            />
          </TabsContent>
          
          {/* PREVIEW VISUAL */}
          <TabsContent value="preview">
            <PreviewFluxoURA estados={dados.estados} />
          </TabsContent>
          
          {/* MÉTRICAS */}
          <TabsContent value="metricas">
            <MetricasPlaybook playbookId={playbook.id} />
          </TabsContent>
          
        </Tabs>
        
        {/* FOOTER */}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(dados)}>Salvar</Button>
        </DialogFooter>
        
      </DialogContent>
    </Dialog>
  );
}
```

---

## 🔄 **QUANDO CADA AUTOMAÇÃO ENTRA EM AÇÃO**

### **GATILHOS: Tabela de Prioridades**

| Prioridade | Gatilho | Automação | Condição | Executor |
|-----------|---------|-----------|----------|----------|
| **1** | Webhook | **Promoção Inbound** | Mensagem recebida + cooldown 6h passado | `runPromotionInboundTick` |
| **2** | Webhook | **URA Pré-Atendimento** | Playbook ativo + regras_ativacao batem | `preAtendimentoHandler` → `FluxoControllerV11` |
| **3** | Webhook | **Playbook Genérico** | FlowTemplate tipo != "pre_atendimento" + gatilhos | `playbookEngine` |
| **4** | Agendamento | **Promoção Batch** | Cron 24h + base ativa | `runPromotionBatchTick` |
| **5** | Agendamento | **Follow-Up Vendas** | FlowExecution.next_action_at atingido | `executarProximaAcao` |
| **6** | Manual | **Resposta Rápida** | Atendente clica botão | `QuickRepliesManager` |

---

### **FLUXO 1: PROMOÇÃO INBOUND (6h após mensagem)**

```javascript
// functions/lib/inboundCore.js

async function processInbound(base44, payload) {
  // ... normalizar, criar contact, thread, message ...
  
  // ══════════════════════════════════════════════════════════════
  // VERIFICAR PROMOÇÃO INBOUND (Gatilho 1)
  // ══════════════════════════════════════════════════════════════
  
  const lastInboundAt = new Date(thread.last_inbound_at);
  const horasSemMensagem = (Date.now() - lastInboundAt) / (1000 * 60 * 60);
  
  if (horasSemMensagem >= 6) {
    // Cooldown inbound passou - enviar promoção
    const promocaoEnviada = await base44.functions.invoke('runPromotionInboundTick', {
      thread_id: thread.id,
      contact_id: contact.id,
      integration_id: integrationId
    });
    
    if (promocaoEnviada.success) {
      console.log('[INBOUND] ✅ Promoção inbound enviada');
      return; // Não continua para URA (promoção enviada)
    }
  }
  
  // ══════════════════════════════════════════════════════════════
  // DECISÃO DE URA (Gatilho 2)
  // ══════════════════════════════════════════════════════════════
  
  const bypassURA = await base44.functions.invoke('motorDecisaoPreAtendimento', {
    thread_id: thread.id,
    contact_id: contact.id
  });
  
  if (bypassURA.pular_ura) {
    console.log('[INBOUND] ⏭️ Bypass URA:', bypassURA.motivo);
    return; // Vai direto para humano
  }
  
  // ══════════════════════════════════════════════════════════════
  // RESOLVER PLAYBOOK
  // ══════════════════════════════════════════════════════════════
  
  const playbook = await resolverPlaybookParaMensagem(base44, contact, thread, integrationId);
  
  if (!playbook) {
    console.log('[INBOUND] ⚠️ Nenhum playbook encontrado - fluxo normal');
    return;
  }
  
  // ══════════════════════════════════════════════════════════════
  // EXECUTAR PLAYBOOK
  // ══════════════════════════════════════════════════════════════
  
  if (playbook.tipo_fluxo === 'pre_atendimento') {
    await base44.functions.invoke('preAtendimentoHandler', {
      thread_id: thread.id,
      contact_id: contact.id,
      playbook_id: playbook.id,
      user_input: { type: 'text', content: normalizedText }
    });
  } else {
    await base44.functions.invoke('playbookEngine', {
      playbook_id: playbook.id,
      contact_id: contact.id,
      thread_id: thread.id
    });
  }
}
```

---

### **FLUXO 2: URA PRÉ-ATENDIMENTO**

```javascript
// functions/preAtendimentoHandler.js

export default async function preAtendimentoHandler(req) {
  const base44 = createClientFromRequest(req);
  const { thread_id, contact_id, playbook_id, user_input } = await req.json();
  
  // ══════════════════════════════════════════════════════════════
  // 1. CARREGAR DADOS
  // ══════════════════════════════════════════════════════════════
  
  const [thread, contact, playbook] = await Promise.all([
    base44.asServiceRole.entities.MessageThread.get(thread_id),
    base44.asServiceRole.entities.Contact.get(contact_id),
    base44.asServiceRole.entities.FlowTemplate.get(playbook_id)
  ]);
  
  // ══════════════════════════════════════════════════════════════
  // 2. VERIFICAR TTL (Resetar COMPLETED → INIT?)
  // ══════════════════════════════════════════════════════════════
  
  if (thread.pre_atendimento_state === 'COMPLETED') {
    const completedAt = new Date(thread.pre_atendimento_completed_at);
    const horasDesdeCompleted = (Date.now() - completedAt) / (1000 * 60 * 60);
    const ttl = playbook.config_global?.ttl_completed_horas || 24;
    
    if (horasDesdeCompleted >= ttl) {
      console.log('[URA] 🔄 TTL expirado - resetando para INIT');
      thread.pre_atendimento_state = 'INIT';
      thread.pre_atendimento_ativo = true;
      await base44.asServiceRole.entities.MessageThread.update(thread_id, {
        pre_atendimento_state: 'INIT',
        pre_atendimento_ativo: true
      });
    } else {
      console.log('[URA] ✅ COMPLETED recente - não reinicia');
      return Response.json({ status: 'already_completed' });
    }
  }
  
  // ══════════════════════════════════════════════════════════════
  // 3. INSTANCIAR EXECUTOR GENÉRICO
  // ══════════════════════════════════════════════════════════════
  
  const { FluxoControllerV11 } = await import('./preAtendimento/FluxoControllerV11.js');
  const controller = new FluxoControllerV11(playbook);
  
  // ══════════════════════════════════════════════════════════════
  // 4. PROCESSAR ESTADO ATUAL
  // ══════════════════════════════════════════════════════════════
  
  const resultado = await controller.processarEstado(
    base44, 
    thread, 
    contact, 
    thread.whatsapp_integration_id,
    user_input,
    null // intent_context (opcional)
  );
  
  // ══════════════════════════════════════════════════════════════
  // 5. ATUALIZAR MÉTRICAS DO PLAYBOOK
  // ══════════════════════════════════════════════════════════════
  
  if (resultado.novo_estado === 'COMPLETED') {
    await atualizarMetricas(base44, playbook_id, 'concluido');
  } else if (resultado.novo_estado === 'TIMEOUT') {
    await atualizarMetricas(base44, playbook_id, 'timeout');
  }
  
  return Response.json({ success: true, resultado });
}
```

---

### **FLUXO 3: PLAYBOOK GENÉRICO (Follow-Up, Qualificação, etc.)**

```javascript
// functions/playbookEngine.js

export default async function playbookEngine(req) {
  const base44 = createClientFromRequest(req);
  const { playbook_id, contact_id, thread_id } = await req.json();
  
  // ══════════════════════════════════════════════════════════════
  // 1. BUSCAR OU CRIAR EXECUÇÃO
  // ══════════════════════════════════════════════════════════════
  
  let execution = await base44.asServiceRole.entities.FlowExecution.filter({
    flow_template_id: playbook_id,
    contact_id: contact_id,
    status: { $in: ['ativo', 'pausado', 'waiting_follow_up'] }
  });
  
  if (!execution || execution.length === 0) {
    // Criar nova execução
    execution = await base44.asServiceRole.entities.FlowExecution.create({
      flow_template_id: playbook_id,
      contact_id: contact_id,
      thread_id: thread_id,
      status: 'ativo',
      current_step: 0,
      started_at: new Date().toISOString()
    });
  } else {
    execution = execution[0];
  }
  
  // ══════════════════════════════════════════════════════════════
  // 2. CARREGAR PLAYBOOK
  // ══════════════════════════════════════════════════════════════
  
  const playbook = await base44.asServiceRole.entities.FlowTemplate.get(playbook_id);
  const currentStep = playbook.steps[execution.current_step];
  
  // ══════════════════════════════════════════════════════════════
  // 3. EXECUTAR STEP ATUAL
  // ══════════════════════════════════════════════════════════════
  
  switch (currentStep.type) {
    
    case 'message':
      await enviarMensagem(base44, thread_id, currentStep.texto);
      execution.current_step++;
      break;
    
    case 'delay':
      const proximaExecucao = new Date();
      proximaExecucao.setDate(proximaExecucao.getDate() + (currentStep.delay_days || 1));
      
      await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
        status: 'waiting_follow_up',
        next_action_at: proximaExecucao.toISOString()
      });
      break;
    
    case 'qualify_contact':
      const score = await base44.functions.invoke('qualificarLeadsAutomatico', {
        contact_id: contact_id
      });
      execution.variables = { ...execution.variables, score };
      execution.current_step++;
      break;
    
    case 'end':
      await base44.asServiceRole.entities.FlowExecution.update(execution.id, {
        status: 'concluido',
        completed_at: new Date().toISOString()
      });
      break;
  }
  
  // Salvar progresso
  await base44.asServiceRole.entities.FlowExecution.update(execution.id, execution);
  
  return Response.json({ success: true, execution });
}
```

---

### **FLUXO 4: PROMOÇÕES BATCH (Agendamento 24h)**

```javascript
// functions/runPromotionBatchTick.js

export default async function runPromotionBatchTick(req) {
  const base44 = createClientFromRequest(req);
  
  // ══════════════════════════════════════════════════════════════
  // 1. BUSCAR PROMOÇÕES ATIVAS
  // ══════════════════════════════════════════════════════════════
  
  const promocoes = await base44.asServiceRole.entities.Promotion.filter({
    ativo: true,
    tipo: 'batch', // Tipo batch (enviado para base ativa)
    data_inicio: { $lte: new Date().toISOString() },
    data_fim: { $gte: new Date().toISOString() }
  });
  
  console.log(`[BATCH] 📬 Encontradas ${promocoes.length} promoções batch ativas`);
  
  for (const promo of promocoes) {
    
    // ══════════════════════════════════════════════════════════
    // 2. BUSCAR BASE ATIVA (Cooldown 36h)
    // ══════════════════════════════════════════════════════════
    
    const dataLimite = new Date();
    dataLimite.setHours(dataLimite.getHours() - 36);
    
    const threads = await base44.asServiceRole.entities.MessageThread.filter({
      last_inbound_at: { $gte: dataLimite.toISOString() },
      thread_type: 'contact_external',
      channel: 'whatsapp'
    }, '-last_inbound_at', 500);
    
    console.log(`[BATCH] 🎯 Base ativa: ${threads.length} threads`);
    
    // ══════════════════════════════════════════════════════════
    // 3. FILTRAR POR COOLDOWN UNIVERSAL (12h)
    // ══════════════════════════════════════════════════════════
    
    const elegiveis = [];
    
    for (const thread of threads) {
      const contact = await base44.asServiceRole.entities.Contact.get(thread.contact_id);
      
      // Verificar cooldown universal
      if (contact.last_any_promo_sent_at) {
        const horasDesdeUltima = (Date.now() - new Date(contact.last_any_promo_sent_at)) / (1000 * 60 * 60);
        if (horasDesdeUltima < 12) {
          continue; // Pula - cooldown universal
        }
      }
      
      // Verificar se já recebeu esta promoção recentemente
      const promoRecebimentos = contact.promocoes_recebidas || {};
      if (promoRecebimentos[promo.id] > 2) {
        continue; // Já recebeu 3x - pula
      }
      
      elegiveis.push({ thread, contact });
    }
    
    console.log(`[BATCH] ✅ Elegíveis após filtros: ${elegiveis.length}`);
    
    // ══════════════════════════════════════════════════════════
    // 4. ENVIAR PROMOÇÕES
    // ══════════════════════════════════════════════════════════
    
    for (const { thread, contact } of elegiveis.slice(0, 100)) { // Limite 100/dia
      await enviarPromocao(base44, promo, thread, contact);
      
      // Atualizar contadores
      await base44.asServiceRole.entities.Contact.update(contact.id, {
        last_promo_batch_at: new Date().toISOString(),
        last_any_promo_sent_at: new Date().toISOString(),
        promocoes_recebidas: {
          ...contact.promocoes_recebidas,
          [promo.id]: (contact.promocoes_recebidas?.[promo.id] || 0) + 1
        }
      });
    }
  }
  
  return Response.json({ success: true });
}
```

---

## 🗺️ **MAPA MENTAL: ONDE CADA ARQUIVO VIVE**

```
📂 PROJECT ROOT
│
├─ 📂 entities/
│  ├─ FlowTemplate.json (Playbooks URA + Genéricos)
│  ├─ FlowExecution.json (Estado de execução)
│  ├─ Promotion.json (Promoções)
│  ├─ QuickReply.json (Respostas Rápidas)
│  ├─ MessageThread.json (Conversas)
│  └─ Contact.json (Contatos + Tags)
│
├─ 📂 functions/
│  │
│  ├─ 📁 webhooks/ (Entrada)
│  │  ├─ webhookWapi.js
│  │  ├─ webhookFinalZapi.js
│  │  ├─ instagramWebhook.js
│  │  └─ facebookWebhook.js
│  │
│  ├─ 📁 lib/ (Orquestração)
│  │  ├─ inboundCore.js (Motor central)
│  │  ├─ resolverPlaybookParaMensagem.js (Seletor)
│  │  └─ promotionEngine.js (Motor promoções)
│  │
│  ├─ 📁 preAtendimento/ (Executor URA)
│  │  ├─ FluxoControllerV11.js (Executor genérico)
│  │  └─ transferenciaInteligente.js
│  │
│  ├─ preAtendimentoHandler.js (Orquestrador URA)
│  ├─ motorDecisaoPreAtendimento.js (Bypass Layer)
│  ├─ playbookEngine.js (Executor genérico)
│  ├─ runPromotionInboundTick.js (Promoção 6h)
│  ├─ runPromotionBatchTick.js (Promoção 24h)
│  └─ executarProximaAcao.js (Follow-Up agendado)
│
└─ 📂 components/
   │
   ├─ 📁 automacao/ (UI)
   │  ├─ BibliotecaAutomacoes.jsx (Container principal)
   │  ├─ PlaybookManagerURA.jsx (Gestão URA)
   │  ├─ PlaybookManager.jsx (Gestão genérica)
   │  ├─ GerenciadorPromocoes.jsx (Promoções)
   │  ├─ QuickRepliesManager.jsx (Respostas rápidas)
   │  ├─ EditorPlaybookURA.jsx (Editor visual)
   │  ├─ EditorEstados.jsx (Estados da URA)
   │  ├─ EditorRegrasAtivacao.jsx (Filtros)
   │  ├─ PreviewFluxoURA.jsx (Diagrama)
   │  └─ DashboardAutomacoes.jsx (Métricas)
   │
   └─ 📁 comunicacao/
      └─ PreAtendimentoHelper.jsx (UI thread)
```

---

## 🎯 **INTEGRAÇÃO COM ABA "AUTOMAÇÕES" DO LAYOUT**

### **Atualizar Layout.js:**

```javascript
const todosMenuItems = [
  { name: "Central de Comunicacao", icon: MessageSquare, page: "Comunicacao" },
  { name: "Dashboard", icon: Home, page: "Dashboard" },
  
  // 🆕 BIBLIOTECA DE AUTOMAÇÕES (centraliza tudo)
  { name: "Automações", icon: Zap, page: "Automacoes" },
  
  { name: "Leads & Qualificacao", icon: Target, page: "LeadsQualificados" },
  { name: "Clientes", icon: Building2, page: "Clientes" },
  { name: "Produtos", icon: Package, page: "Produtos" },
  { name: "Agenda Inteligente", icon: Calendar, page: "Agenda" },
  { name: "Importação", icon: Upload, page: "Importacao" },
  { name: "Gerenciamento de Usuários", icon: UserCog, page: "Usuarios" },
  { name: "Auditoria", icon: Shield, page: "Auditoria" }
];
```

### **Criar Página pages/Automacoes.jsx:**

```jsx
import React from 'react';
import BibliotecaAutomacoes from '../components/automacao/BibliotecaAutomacoes';

export default function AutomacoesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      
      {/* HEADER */}
      <div className="max-w-7xl mx-auto mb-6">
        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
          <Zap className="w-8 h-8 text-orange-500" />
          Biblioteca de Automações
        </h1>
        <p className="text-gray-600 mt-2">
          Gerencie URAs, Playbooks, Promoções e Respostas Rápidas em um só lugar
        </p>
      </div>
      
      {/* COMPONENTE PRINCIPAL */}
      <div className="max-w-7xl mx-auto">
        <BibliotecaAutomacoes />
      </div>
      
    </div>
  );
}
```

---

## 📊 **DASHBOARD DE AUTOMAÇÕES (Aba 5)**

**Arquivo:** `components/automacao/DashboardAutomacoes.jsx`

```jsx
export default function DashboardAutomacoes() {
  const [metricas, setMetricas] = useState(null);
  
  useEffect(() => {
    carregarMetricas();
  }, []);
  
  async function carregarMetricas() {
    // Buscar dados de todas as automações
    const [playbooks, execucoes, promocoes] = await Promise.all([
      base44.entities.FlowTemplate.filter({ ativo: true }),
      base44.entities.FlowExecution.filter({ 
        created_date: { $gte: subDays(new Date(), 30).toISOString() }
      }),
      base44.entities.Promotion.filter({ ativo: true })
    ]);
    
    setMetricas({
      playbooks_ura: playbooks.filter(p => p.tipo_fluxo === 'pre_atendimento'),
      playbooks_genericos: playbooks.filter(p => p.tipo_fluxo !== 'pre_atendimento'),
      execucoes_mes: execucoes.length,
      promocoes_ativas: promocoes.length,
      taxa_conclusao_geral: calcularTaxaConclusao(execucoes)
    });
  }
  
  return (
    <div className="space-y-6">
      
      {/* 📊 CARDS DE MÉTRICAS */}
      <div className="grid grid-cols-4 gap-4">
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">URAs Ativas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metricas?.playbooks_ura?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Pré-Atendimento</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Playbooks Ativos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metricas?.playbooks_genericos?.length || 0}</div>
            <p className="text-xs text-muted-foreground">Follow-Up, Qualificação, etc.</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Execuções (30d)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{metricas?.execucoes_mes || 0}</div>
            <p className="text-xs text-muted-foreground">Todas as automações</p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Taxa Conclusão</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {metricas?.taxa_conclusao_geral || 0}%
            </div>
            <p className="text-xs text-muted-foreground">Média geral</p>
          </CardContent>
        </Card>
        
      </div>
      
      {/* 📈 GRÁFICOS */}
      <div className="grid grid-cols-2 gap-6">
        
        {/* Execuções por Tipo */}
        <Card>
          <CardHeader>
            <CardTitle>Execuções por Tipo</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={dataPorTipo} dataKey="value" nameKey="name" />
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
        {/* Tendência Últimos 7 Dias */}
        <Card>
          <CardHeader>
            <CardTitle>Tendência (7 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={dataUltimos7Dias}>
                <XAxis dataKey="dia" />
                <YAxis />
                <Tooltip />
                <Line type="monotone" dataKey="execucoes" stroke="#8884d8" />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        
      </div>
      
      {/* 📋 LISTA DE PLAYBOOKS MAIS USADOS */}
      <Card>
        <CardHeader>
          <CardTitle>Top 5 Playbooks (Execuções)</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Playbook</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Execuções</TableHead>
                <TableHead>Taxa Conclusão</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topPlaybooks.map(pb => (
                <TableRow key={pb.id}>
                  <TableCell>{pb.nome}</TableCell>
                  <TableCell>
                    <Badge>{pb.tipo_fluxo}</Badge>
                  </TableCell>
                  <TableCell>{pb.total_execucoes}</TableCell>
                  <TableCell>
                    <Progress value={pb.taxa_conclusao} className="w-20" />
                    <span className="ml-2 text-sm">{pb.taxa_conclusao}%</span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      
    </div>
  );
}
```

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

### **BACKEND:**

- [ ] **Motor de Resolução**
  - [ ] Criar `functions/lib/resolverPlaybookParaMensagem.js`
  - [ ] Integrar em `inboundCore.js`

- [ ] **Executor URA V11**
  - [ ] Criar `functions/preAtendimento/FluxoControllerV11.js`
  - [ ] Adaptar `preAtendimentoHandler.js`

- [ ] **Playbook Engine Genérico**
  - [ ] Revisar `functions/playbookEngine.js`
  - [ ] Adicionar suporte a novos tipos de steps

- [ ] **Promoções**
  - [ ] Verificar `runPromotionInboundTick.js`
  - [ ] Verificar `runPromotionBatchTick.js`

### **FRONTEND:**

- [ ] **Layout**
  - [ ] Adicionar item "Automações" ao menu

- [ ] **Página Principal**
  - [ ] Criar `pages/Automacoes.jsx`

- [ ] **Biblioteca Expandida**
  - [ ] Atualizar `BibliotecaAutomacoes.jsx` (5 abas)
  - [ ] Criar `PlaybookManagerURA.jsx`
  - [ ] Criar `EditorPlaybookURA.jsx`
  - [ ] Criar `DashboardAutomacoes.jsx`

- [ ] **Componentes de Suporte**
  - [ ] `PlaybookCardURA.jsx`
  - [ ] `SecaoConfigGlobal.jsx`
  - [ ] `EditorEstados.jsx`
  - [ ] `EditorRegrasAtivacao.jsx`
  - [ ] `PreviewFluxoURA.jsx`
  - [ ] `MetricasPlaybook.jsx`

---

## 🎯 **PRÓXIMO PASSO IMEDIATO**

Temos 3 caminhos:

### **OPÇÃO A: Expandir Schema + Motor (Backend primeiro)**
1. Expandir `FlowTemplate.json`
2. Criar `resolverPlaybookParaMensagem.js`
3. Criar `FluxoControllerV11.js`

### **OPÇÃO B: Interface Admin (Frontend primeiro)**
1. Atualizar `BibliotecaAutomacoes.jsx` (5 abas)
2. Criar `PlaybookManagerURA.jsx`
3. Criar `EditorPlaybookURA.jsx`

### **OPÇÃO C: Adicionar ao Layout (Rápido)**
1. Adicionar item "Automações" ao menu
2. Criar página básica `Automacoes.jsx`
3. Importar `BibliotecaAutomacoes` existente

---

**Qual caminho você prefere começar?**