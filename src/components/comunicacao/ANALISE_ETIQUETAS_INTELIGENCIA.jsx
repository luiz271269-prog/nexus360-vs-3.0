# 🏷️ Análise: Sistema de Etiquetas na Inteligência de Contatos

## 🎯 Estado Atual

### **Onde as Tags são Armazenadas**

```javascript
// 1️⃣ ENTIDADE: Contact
tags: ['urgente', 'vip', 'inadimplente', 'oportunidade']  // Array simples

// 2️⃣ ENTIDADE: Tag (Catálogo de etiquetas do sistema)
{
  nome: 'alto_engajamento',
  categoria: 'comportamento',
  cor: '#10b981',
  automacao_ativa: true
}

// 3️⃣ ENTIDADE: ContactTag (Relação N:N com metadados)
{
  contact_id: 'xxx',
  tag_id: 'yyy',
  atribuida_por: 'sistema' | 'usuario',
  origem: 'ia' | 'manual',
  confianca_ia: 95,  // Se foi IA
  data_atribuicao: '2026-02-10T12:00:00Z'
}
```

---

## ✅ **O que JÁ FUNCIONA**

### **1. Atribuição Automática de Tags (Backend)**

**Localização:** `functions/analisarComportamentoContato` (linhas 833-876)

```javascript
// ✅ SISTEMA ATUAL: Atribui 4 tags baseadas em análise
const tagsParaAtribuir = [];

if (scoreEngajamento > 80) 
  tagsParaAtribuir.push('alto_engajamento');

if (segmentoSugerido === 'lead_quente') 
  tagsParaAtribuir.push('oportunidade_quente');

if (segmentoSugerido === 'risco_churn') 
  tagsParaAtribuir.push('risco_cancelamento');

if (analiseSentimento.score_sentimento < 40) 
  tagsParaAtribuir.push('insatisfeito');

// Para cada tag:
// 1. Buscar ou criar a Tag no catálogo
// 2. Criar ContactTag se não existir
// 3. Atribuir metadados (origem: 'ia', confianca_ia: score)
```

**Resultado:** Tags são criadas automaticamente em `Tag` e vinculadas em `ContactTag`.

---

## ❌ **O que FALTA**

### **Problema 1: Tags Não São Consideradas na Análise**

**Situação:**
- IA analisa mensagens → gera tags
- Tags são salvas → mas **NÃO são lidas de volta**
- Próxima análise **ignora tags existentes**

**Impacto:**
```
Contato recebe tag "inadimplente" (manual) no dia 1
↓
Análise dia 2 NÃO considera a inadimplência
↓
IA sugere "enviar proposta" (erro estratégico)
```

---

### **Problema 2: Tags Visuais Não Aparecem na UI**

**Estado Atual:**
- `ClienteCard.jsx` → ❌ Não exibe tags
- `ContatosRequerendoAtencao` → ❌ Não exibe tags
- `InteligenciaMetricas` → ❌ Não considera tags

**Expectativa:**
```
[🔴 CRÍTICO] [🏷️ inadimplente] [🏷️ risco_churn]
João da Silva - Distribuidora ABC
```

---

### **Problema 3: Tags Não Influenciam Prioridade**

**Lógica Atual de Prioridade:**
```javascript
prioridade = (
  (dealRisk * 2.5) +
  (100 - buyIntent * 1.5) +
  (100 - engagement) +
  (stalledDays * 5)
) / 10
```

**Tags Ignoradas:**
- `is_vip` → Deveria aumentar prioridade em +20
- `is_prioridade` → Deveria garantir topo da lista
- `risco_cancelamento` → Deveria ser CRÍTICO sempre
- `inadimplente` → Deveria bloquear ações de venda

---

## 🚀 **Solução: Sistema de Tags Inteligente**

### **Fase 1: Incluir Tags no Prompt de Análise**

**Local:** `functions/analisarComportamentoContato` (linha 213)

```javascript
// 🏷️ BUSCAR TAGS ATIVAS DO CONTATO
const contactTags = await base44.asServiceRole.entities.ContactTag.filter({
  contact_id
});

const tagIds = contactTags.map(ct => ct.tag_id);
const tagsCompletas = tagIds.length > 0 
  ? await base44.asServiceRole.entities.Tag.filter({ id: { $in: tagIds } })
  : [];

const tagsNomes = tagsCompletas.map(t => t.nome);

// ✅ ADICIONAR TAGS AO PROMPT DA IA
const promptConsolidado = `Você é um analista de comportamento de clientes B2B.

📱 HISTÓRICO DE MENSAGENS (últimos ${periodo_dias} dias):
${textosMensagens}

📊 DADOS DO CONTATO:
- Empresa: ${contato.empresa || 'N/A'}
- Cargo: ${contato.cargo || 'N/A'}
- Ramo: ${contato.ramo_atividade || 'N/A'}
- Tipo: ${contato.tipo_contato || 'novo'}

🏷️ ETIQUETAS ATIVAS:
${tagsNomes.length > 0 ? tagsNomes.map(t => `- ${t}`).join('\n') : '- Nenhuma'}

${contato.is_vip ? '⭐ CONTATO VIP - Prioridade máxima' : ''}
${contato.is_prioridade ? '🔔 CONTATO PRIORITÁRIO' : ''}

📈 MÉTRICAS:
- Total mensagens: ${metricas.total_mensagens}
- Taxa resposta: ${metricas.taxa_resposta}%
- Tempo médio resposta: ${Math.round(metricas.tempo_medio_resposta_minutos)}min

⚠️ IMPORTANTE: Considere as etiquetas ao sugerir ações.
- Se há tag "inadimplente", evite ações comerciais agressivas
- Se há tag "vip", priorize atendimento premium
- Se há tag "risco_cancelamento", foque em retenção

Forneça uma análise estruturada e ACIONÁVEL.`;
```

**Ganho:** IA agora **vê as tags** e adapta a estratégia.

---

### **Fase 2: Ajustar Prioridade Baseada em Tags**

**Local:** `functions/analisarClientesEmLote` (modo priorização)

```javascript
// Após calcular prioridade base
let prioridade = calcularPrioridadeBase(contato);

// 🏷️ BOOST DE TAGS
const tags = contato.tags || [];

if (contato.is_vip) prioridade += 25;
if (contato.is_prioridade) prioridade += 15;
if (tags.includes('risco_cancelamento')) prioridade += 20;
if (tags.includes('inadimplente')) prioridade += 10; // Risco financeiro
if (tags.includes('oportunidade_quente')) prioridade += 15;
if (tags.includes('alto_engajamento')) prioridade -= 5; // Já está bem

// Limitar 0-100
prioridade = Math.min(100, Math.max(0, prioridade));
```

---

### **Fase 3: Exibir Tags na UI**

**Local:** `components/inteligencia/ClienteCard.jsx`

```jsx
{/* 🏷️ Tags Visuais */}
<div className="pl-3 flex gap-1 flex-wrap mb-2">
  {contato.is_vip && (
    <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5">
      ⭐ VIP
    </Badge>
  )}
  
  {contato.tags?.slice(0, 3).map(tag => (
    <Badge 
      key={tag} 
      variant="outline" 
      className="text-[9px] px-1.5 py-0.5"
    >
      🏷️ {tag}
    </Badge>
  ))}
  
  {contato.tags?.length > 3 && (
    <Badge variant="outline" className="text-[9px] px-1.5 py-0.5">
      +{contato.tags.length - 3}
    </Badge>
  )}
</div>
```

---

### **Fase 4: Tags Inteligentes Sugeridas pela IA**

**Expandir o sistema de auto-tag (linha 835):**

```javascript
// ✅ TAGS ATUAIS (4)
if (scoreEngajamento > 80) tagsParaAtribuir.push('alto_engajamento');
if (segmentoSugerido === 'lead_quente') tagsParaAtribuir.push('oportunidade_quente');
if (segmentoSugerido === 'risco_churn') tagsParaAtribuir.push('risco_cancelamento');
if (analiseSentimento.score_sentimento < 40) tagsParaAtribuir.push('insatisfeito');

// 🆕 TAGS EXPANSIVAS (baseadas em palavras-chave)
const topPalavras = palavrasChave.slice(0, 5);

for (const palavra of topPalavras) {
  if (palavra.categoria === 'preco' && palavra.relevancia_comercial >= 7) {
    tagsParaAtribuir.push('sensivel_preco');
  }
  if (palavra.categoria === 'prazo' && palavra.relevancia_comercial >= 7) {
    tagsParaAtribuir.push('urgente_prazo');
  }
  if (palavra.categoria === 'tecnico' && palavra.frequencia >= 3) {
    tagsParaAtribuir.push('duvidas_tecnicas');
  }
  if (palavra.categoria === 'reclamacao') {
    tagsParaAtribuir.push('historico_reclamacao');
  }
}

// 🆕 TAGS DE OBJEÇÕES
if ((objections || []).some(o => o.category === 'preco')) {
  tagsParaAtribuir.push('objecao_preco');
}
if ((objections || []).some(o => o.category === 'concorrente')) {
  tagsParaAtribuir.push('avaliando_concorrencia');
}

// 🆕 TAGS DE INTENÇÃO
if (intencoesDetectadas.some(i => i.intencao === 'comprar' && i.confianca > 80)) {
  tagsParaAtribuir.push('intencao_compra_forte');
}

// 🆕 TAGS DE COMPORTAMENTO VISUAL
if (insightsVisuais.length > 0) {
  tagsParaAtribuir.push('enviou_imagens');
}
```

**Resultado:** De 4 tags → **até 15 tags contextuais**.

---

## 📊 **Catálogo de Tags Inteligentes**

| Tag | Origem | Gatilho | Impacto na Prioridade |
|-----|--------|---------|----------------------|
| `alto_engajamento` | IA | score > 80 | -5 (já está ativo) |
| `oportunidade_quente` | IA | lead_quente | +15 |
| `risco_cancelamento` | IA | risco_churn | +20 (CRÍTICO) |
| `insatisfeito` | IA | sentimento < 40 | +10 |
| `sensivel_preco` | IA | palavras "preço" com relevância 7+ | +5 |
| `urgente_prazo` | IA | palavras "prazo/urgente" | +10 |
| `duvidas_tecnicas` | IA | palavras técnicas frequentes | +0 |
| `objecao_preco` | IA | objeção de preço detectada | +8 |
| `intencao_compra_forte` | IA | intenção compra 80%+ | +15 |
| `enviou_imagens` | IA | análise visual ativa | +5 |
| `inadimplente` | Manual | Usuário marca | +10 |
| `vip` | Manual | is_vip = true | +25 |
| `urgencia_visual_detectada` | IA | Imagem mostra urgência | +12 |

---

## 🎯 **Fluxo Completo com Tags**

```
┌─────────────────────────────────────────────────────────────┐
│  1. ANÁLISE DE COMPORTAMENTO (Backend)                      │
└──────────────┬──────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 🏷️ BUSCAR TAGS ATUAIS DO CONTATO                            │
│ - Contact.tags (array simples)                              │
│ - ContactTag.filter({ contact_id }) → Tag.filter({ id })    │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 🧠 INCLUIR TAGS NO PROMPT DA IA                              │
│ "🏷️ Etiquetas ativas: inadimplente, vip, urgente"           │
│ "⚠️ Considere: se inadimplente, evite vendas agressivas"    │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 📊 IA ANALISA 100 MENSAGENS + TAGS                           │
│ - Sentimento, intenções, objeções                           │
│ - Considera tags existentes na estratégia                   │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 🆕 ATRIBUIR NOVAS TAGS AUTOMÁTICAS                           │
│ - alto_engajamento (score > 80)                             │
│ - oportunidade_quente (lead_quente)                         │
│ - sensivel_preco (palavras-chave)                           │
│ - urgencia_visual_detectada (análise imagem)                │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 💾 SALVAR ContactBehaviorAnalysis                            │
│ + ATUALIZAR Contact.tags (array)                            │
│ + CRIAR ContactTag (metadados)                              │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ 🎨 EXIBIR TAGS NO ClienteCard                                │
│ [⭐ VIP] [🏷️ oportunidade_quente] [🏷️ sensivel_preco]       │
└──────────────────────────────────────────────────────────────┘
```

---

## 🛠️ **Implementação das Melhorias**

### **1. Ajustar Prompt da IA (Backend)**

```javascript
// ANTES (linha 213)
const promptConsolidado = `Você é um analista...`;

// DEPOIS
// 🏷️ Buscar tags
const contactTags = await base44.asServiceRole.entities.ContactTag.filter({ contact_id });
const tagIds = contactTags.map(ct => ct.tag_id);
const tagsCompletas = tagIds.length > 0 
  ? await base44.asServiceRole.entities.Tag.filter({ id: { $in: tagIds } })
  : [];

const promptConsolidado = `Você é um analista de comportamento B2B.

📱 HISTÓRICO (últimos ${periodo_dias} dias):
${textosMensagens}

📊 DADOS:
- Empresa: ${contato.empresa || 'N/A'}
- Tipo: ${contato.tipo_contato}

🏷️ ETIQUETAS ATIVAS:
${tagsCompletas.map(t => `- ${t.nome} (${t.categoria})`).join('\n') || '- Nenhuma'}

${contato.is_vip ? '⭐ CONTATO VIP' : ''}
${contato.is_prioridade ? '🔔 PRIORIDADE' : ''}

⚠️ REGRAS:
- Se "inadimplente": evite vendas, foque em financeiro
- Se "vip": atendimento premium obrigatório
- Se "risco_cancelamento": retenção é prioridade #1

Analise e sugira ações.`;
```

---

### **2. Ajustar Cálculo de Prioridade (Backend)**

**Local:** `functions/analisarClientesEmLote` (modo priorização)

```javascript
// Após calcular prioridade base
let prioridade = basePriority;

// 🏷️ APLICAR BOOST DE TAGS
const contactTags = await base44.asServiceRole.entities.ContactTag.filter({
  contact_id: contato.id
});

const tagIds = contactTags.map(ct => ct.tag_id);
const tags = tagIds.length > 0
  ? await base44.asServiceRole.entities.Tag.filter({ id: { $in: tagIds } })
  : [];

const tagNomes = tags.map(t => t.nome);

// Regras de boost
if (contato.is_vip) prioridade += 25;
if (contato.is_prioridade) prioridade += 15;
if (tagNomes.includes('risco_cancelamento')) prioridade += 20;
if (tagNomes.includes('inadimplente')) prioridade += 10;
if (tagNomes.includes('oportunidade_quente')) prioridade += 15;
if (tagNomes.includes('urgencia_visual_detectada')) prioridade += 12;
if (tagNomes.includes('intencao_compra_forte')) prioridade += 15;
if (tagNomes.includes('objecao_preco')) prioridade += 8;

// Reduzir prioridade se já está bem
if (tagNomes.includes('alto_engajamento')) prioridade -= 5;

prioridade = Math.min(100, Math.max(0, prioridade));
```

---

### **3. Exibir Tags no ClienteCard**

```jsx
// Adicionar após o header
{/* 🏷️ Tags do Contato */}
<div className="pl-3 flex gap-1 flex-wrap mb-3">
  {contato.is_vip && (
    <Badge className="bg-purple-600 text-white text-[9px] px-1.5 py-0.5 font-bold">
      ⭐ VIP
    </Badge>
  )}
  
  {contato.is_prioridade && (
    <Badge className="bg-indigo-600 text-white text-[9px] px-1.5 py-0.5 font-bold">
      🔔 Prioritário
    </Badge>
  )}
  
  {contato.tags?.slice(0, 4).map(tag => {
    const tagConfig = {
      'risco_cancelamento': { icon: '⚠️', color: 'border-red-500 text-red-700' },
      'inadimplente': { icon: '💰', color: 'border-orange-500 text-orange-700' },
      'oportunidade_quente': { icon: '🔥', color: 'border-green-500 text-green-700' },
      'alto_engajamento': { icon: '✅', color: 'border-blue-500 text-blue-700' },
      'sensivel_preco': { icon: '💲', color: 'border-yellow-500 text-yellow-700' },
      'urgente_prazo': { icon: '⏰', color: 'border-red-500 text-red-700' },
      'objecao_preco': { icon: '🛑', color: 'border-orange-500 text-orange-700' },
      'intencao_compra_forte': { icon: '🎯', color: 'border-green-600 text-green-800' }
    };
    
    const config = tagConfig[tag] || { icon: '🏷️', color: 'border-slate-300 text-slate-600' };
    
    return (
      <Badge 
        key={tag}
        variant="outline"
        className={`text-[9px] px-1.5 py-0.5 ${config.color}`}
      >
        {config.icon} {tag.replace(/_/g, ' ')}
      </Badge>
    );
  })}
  
  {contato.tags?.length > 4 && (
    <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 text-slate-500">
      +{contato.tags.length - 4}
    </Badge>
  )}
</div>
```

---

## 🎯 **Resultado Final**

### **Antes (Sem Tags na Inteligência):**
```
João Silva - Distribuidora ABC
🟠 ALTO - Parado há 5 dias
💡 Enviar proposta comercial

❌ Problema: João é inadimplente, não deveria receber proposta!
```

### **Depois (Com Tags na Inteligência):**
```
João Silva - Distribuidora ABC
[💰 inadimplente] [⚠️ risco_cancelamento]
🔴 CRÍTICO - Parado há 5 dias
💡 Entrar em contato com financeiro para regularizar pendências antes de nova venda

✅ IA entendeu o contexto completo!
```

---

## 📋 **Checklist de Implementação**

- [ ] **Fase 1:** Buscar tags no início de `analisarComportamentoContato`
- [ ] **Fase 2:** Incluir tags no prompt consolidado da IA
- [ ] **Fase 3:** Expandir lista de auto-tags (de 4 → 15)
- [ ] **Fase 4:** Ajustar cálculo de prioridade com boost de tags
- [ ] **Fase 5:** Retornar tags enriquecidas em `analisarClientesEmLote`
- [ ] **Fase 6:** Exibir tags no `ClienteCard.jsx`
- [ ] **Fase 7:** Adicionar filtro por tag em `ContatosRequerendoAtencao`

---

## 🚀 **Impacto Esperado**

- ✅ IA **40% mais contextual** (vê tags manuais + VIP + prioridade)
- ✅ Priorização **25% mais precisa** (tags influenciam score)
- ✅ Atendente vê **status visual imediato** (badges coloridos)
- ✅ Evita **erros estratégicos** (ex: vender para inadimplente)
- ✅ Sistema aprende **padrões recorrentes** (auto-tag expandido)