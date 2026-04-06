# 📍 Onde Ver a Análise de Contatos com Tags

## 🎯 **4 Locais Principais**

### **1️⃣ Header/Sidebar - Badge de Alerta**
**Componente:** `ContatosRequerendoAtencao.jsx` (modo header)
**Localização:** Topo da tela, menu lateral

```
🔔 [15] ← Badge laranja/vermelho com contador de urgentes
```

**O que mostra:**
- Contagem de contatos CRÍTICOS + ALTOS
- Dropdown com lista resumida
- Tags visíveis: VIP, inadimplente, risco_cancelamento

**Como chega lá:**
```
useContatosInteligentes → analisarClientesEmLote (modo priorizacao)
                        → filtra por dealRisk > 30
                        → aplica boost de tags
                        → retorna top 50 ordenados
```

---

### **2️⃣ Dashboard - Seção "Contatos Críticos"**
**Página:** `pages/Dashboard.js`
**Localização:** Card laranja no meio da página (se totalUrgentes > 0)

```
🚨 Contatos Requerendo Atenção Imediata [5 críticos]
┌─────────────────────────────────────────────┐
│ [⭐ VIP] [🏷️ inadimplente] [🤖 ia:objecao_preco]│
│ João Silva - Distribuidora ABC              │
│ 🔴 CRÍTICO - Parado há 7 dias               │
│ 💡 Turning Point: Cliente disse "muito caro"│
│ [Copiar Sugestão IA] [Abrir Conversa]      │
└─────────────────────────────────────────────┘
```

**O que mostra:**
- Top 5 contatos mais urgentes
- Tags manuais (inadimplente, vip) + Tags IA (ia:*)
- Mini-scores (risco, intenção, saúde)
- Botão "Copiar Sugestão IA" (one-click)
- Link para ver todos

---

### **3️⃣ Métricas de Inteligência - Visão Agregada**
**Página:** `pages/InteligenciaMetricas.js`
**Localização:** Menu lateral → "Métricas de Inteligência"

```
📊 Análises (24h): 127 | (7d): 458
🚨 Urgentes: 15 contatos
📈 Cobertura: 92% (458 de 500)

Distribuição por Prioridade:
🔴 CRÍTICO: 5
🟠 ALTO: 10
🟡 MÉDIO: 82
⚪ BAIXO: 361

Scores Médios:
├─ Deal Risk: 38% 🔴
├─ Buy Intent: 62% 🟢
├─ Engagement: 71% 🟢
└─ Health: 84% 🟢
```

**Botões:**
- 🔄 **Atualizar** - Recarrega métricas
- ⚡ **Rodar Análise Agora** - Executa `executarAnaliseDiariaContatos` (teste manual)

---

### **4️⃣ Contatos Inteligentes - Lista Completa**
**Página:** `pages/ContatosInteligentes.js`
**Localização:** Menu lateral → "Contatos Inteligentes"

```
🎯 Filtros: [Prioridade] [Segmento] [Tags]

┌─ CRÍTICO (5) ────────────────────────┐
│ [ClienteCard com todas as tags]      │
│ - Turning Point visual               │
│ - 4 mini-scores                      │
│ - Preview da mensagem sugerida       │
│ - Botões de ação                     │
└──────────────────────────────────────┘

┌─ ALTO (10) ──────────────────────────┐
│ ...                                   │
└──────────────────────────────────────┘
```

**O que mostra:**
- Lista completa de contatos priorizados
- Agrupamento por CRÍTICO/ALTO/MÉDIO/BAIXO
- Todos os detalhes: tags, scores, diagnóstico, ações
- Filtros por tag, segmento, prioridade

---

## 🔄 **Fluxo de Atualização**

### **Automático (Agendado):**
```
02:00 AM (diariamente)
↓
executarAnaliseDiariaContatos
↓
analisarClientesEmLote (5 rodadas)
  ├─ Varredura 30 dias (200 contatos)
  ├─ Inativos 30-59d (100 contatos)
  ├─ Inativos 60-89d (100 contatos)
  ├─ Inativos 90+d (100 contatos)
  └─ VIPs (50 contatos)
↓
Para cada contato:
  analisarComportamentoContato
  ├─ Lê 100 mensagens
  ├─ Lê tags existentes
  ├─ IA analisa com contexto de tags
  ├─ Gera novas tags (ia:*)
  ├─ Salva ContactBehaviorAnalysis
  └─ Atualiza Contact (tags, scores)
```

### **Manual (Teste):**
```
Métricas de Inteligência
↓
Clicar "⚡ Rodar Análise Agora"
↓
Aguardar 30-60 segundos
↓
Toast: "✅ 127 análises criadas!"
↓
Clicar "🔄 Atualizar"
↓
Números sobem instantaneamente
```

---

## 🧪 **Como Testar Agora**

1. **Ir para:** `Métricas de Inteligência`
2. **Clicar:** `⚡ Rodar Análise Agora`
3. **Aguardar:** Toast de confirmação
4. **Clicar:** `🔄 Atualizar`
5. **Ver mudanças:**
   - Análises (24h) > 0
   - Urgentes > 0
   - Cobertura > 1%
6. **Ir para:** `Dashboard` → Ver seção "Contatos Críticos"
7. **Ir para:** `Contatos Inteligentes` → Ver lista completa

---

## 🏷️ **Tags que Você Verá**

### **Tags Manuais (sem prefixo):**
- `vip` - Marcado pelo atendente
- `inadimplente` - Marcado pelo financeiro
- `urgente` - Marcado por qualquer usuário

### **Tags IA (prefixo ia:):**
- `ia:alto_engajamento` - Score > 80
- `ia:oportunidade_quente` - Lead quente detectado
- `ia:risco_cancelamento` - Churn risk
- `ia:insatisfeito` - Sentimento < 40
- `ia:sensivel_preco` - Palavras-chave "preço/caro" frequentes
- `ia:urgente_prazo` - Palavras "urgente/rápido"
- `ia:objecao_preco` - Objeção de preço detectada
- `ia:intencao_compra_forte` - Intenção > 80%
- `ia:perfil_analitico` - Perfil comportamental
- `ia:estagio_decisao` - Estágio no funil

---

## 🎨 **Cores das Tags no ClienteCard**

```jsx
⭐ VIP          → Roxo (prioridade máxima)
🔔 Prioritário  → Azul índigo
⚠️ risco_cancelamento → Vermelho
💰 inadimplente → Laranja
🔥 oportunidade_quente → Verde
💲 sensivel_preco → Amarelo
🎯 intencao_compra_forte → Verde escuro
😞 insatisfeito → Vermelho
```

---

## 🚨 **Se Continuar Vendo "0 Análises"**

### **Diagnóstico:**
1. Abrir console do navegador (F12)
2. Ver se aparecem logs do tipo:
   ```
   [useContatosInteligentes] ⏭️ Pulando (muito recente)
   [ANALISE_DIARIA] Iniciando rotina...
   ```

3. Ir para `Dashboard → Code → Functions`:
   - `executarAnaliseDiariaContatos` → Ver logs
   - `analisarClientesEmLote` → Ver logs
   - `analisarComportamentoContato` → Ver logs

4. Verificar se a automação foi criada:
   - `Dashboard → Code → Automations`
   - Deve ter: "Análise Diária de Contatos (Inteligência)"
   - Status: Ativo
   - Próxima execução: Hoje às 02:00

### **Forçar Execução Manual:**
1. Ir para `Métricas de Inteligência`
2. Clicar `⚡ Rodar Análise Agora`
3. Ver toast de progresso
4. Aguardar 30-60s
5. Refresh automático

---

## 📊 **Resultado Esperado Após 1ª Execução**

### **Métricas de Inteligência:**
```
📊 Análises (24h): 127 | (7d): 127
🚨 Urgentes: 15 contatos
📈 Cobertura: 25% (127 de 500)
```

### **Dashboard:**
```
🚨 Contatos Requerendo Atenção Imediata [15 críticos]
[Lista com ClienteCard mostrando tags]
```

### **Header Badge:**
```
🔔 [15] ← Contador laranja pulsante
```

---

## ✅ **Conclusão**

Os resultados da análise aparecem em **4 telas simultâneas**:
1. **Badge do Header** (contador global)
2. **Dashboard** (top 5 críticos com tags)
3. **Métricas de Inteligência** (estatísticas agregadas)
4. **Contatos Inteligentes** (lista completa filtrada)

A análise roda **automaticamente às 02:00 AM** ou **manualmente via botão** "⚡ Rodar Análise Agora".