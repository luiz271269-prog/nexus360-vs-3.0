# 📊 ANÁLISE COMPLETA: NexusSimuladorVisibilidade

## 🎯 VISÃO GERAL DO COMPONENTE

### Propósito
Ferramenta de **Shadow Engine** que simula e compara as regras de visibilidade entre:
- **Sistema Legado**: Regras antigas hardcoded
- **Nexus360**: Novo sistema de permissões configuráveis (P1-P12)

### Localização
`components/comunicacao/NexusSimuladorVisibilidade.jsx`

---

## 🔍 LINHA LÓGICA COMPLETA - PASSO A PASSO

### 1. INICIALIZAÇÃO (useEffect)
```javascript
useEffect(() => {
  carregarUsuarios();        // Carrega todos os User do banco
  recarregarDadosCompletos(); // Carrega Contact + Message + MessageThread
}, []);
```

**O que faz:**
- Busca lista completa de usuários para seleção
- Carrega TODOS os contatos, mensagens e threads do banco
- Armazena em estados locais para análise offline

---

### 2. FLUXO PRINCIPAL: Executar Simulação (`runSimulation`)

#### 2.1 Validação Inicial
```javascript
if (!usuarioAtual) {
  toast.error('Nenhum usuário selecionado');
  return;
}
```

#### 2.2 Preparação de Dados
```javascript
let threadsParaAnalisar = threads; // Props vindas do componente pai

// Se não houver threads, buscar no banco
if (!threadsParaAnalisar || threadsParaAnalisar.length === 0) {
  threadsParaAnalisar = await base44.entities.MessageThread.list('-last_message_at', amostraSize);
}

// Aplicar filtros de setor/integração/tipo
// Limitar ao tamanho da amostra
```

#### 2.3 DETECÇÃO DE PROBLEMAS CRÍTICOS (Loop principal)
Para cada thread:

**A) Ignorar threads internas** (não precisam de contact_id)
```javascript
if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
  continue;
}
```

**B) Verificar integridade do contato**
```javascript
const contato = thread.contact_id ? contatos.find(c => c.id === thread.contact_id) : null;

// ERRO CRÍTICO 1: Thread sem contact_id ou contato não encontrado
if (!thread.contact_id || !contato) {
  threadsSemContato.push(...);
  continue;
}

// ERRO CRÍTICO 2: Contato sem telefone ou telefone inválido
if (!contato.telefone || contato.telefone.length < 10) {
  threadsContatoInvalido.push(...);
  continue;
}
```

**C) Verificar mensagens suspeitas**
```javascript
// ERRO CRÍTICO 3: Mensagens não lidas sem conteúdo recente
if ((thread.unread_count || 0) > 0 && !thread.last_message_content && !ultimaMsgRecente) {
  threadsMensagensSuspeitas.push(...);
}
```

**D) Verificar integridade de visibilidade das mensagens**
```javascript
// ERRO CRÍTICO 4: Problemas no campo visibility das Message
const mensagensDaThread = mensagens.filter(m => m.thread_id === thread.id);

for (const mensagem of mensagensDaThread) {
  // 1. visibility undefined/null
  // 2. visibility com valor inválido
  // 3. Thread bloqueada mas mensagem pública
  
  if (problemas.length > 0) {
    mensagensComProblemaVisibilidade.push(...);
  }
}
```

**E) Detectar duplicatas de contatos**
```javascript
// Mapear por telefone
if (contato.telefone) {
  if (!mapaTelefones.has(contato.telefone)) {
    mapaTelefones.set(contato.telefone, []);
  }
  mapaTelefones.get(contato.telefone).push({ thread, contato });
}
```

#### 2.4 Executar Comparação Legado vs Nexus360
```javascript
const resultado = executarAnaliseEmLote(usuarioAtual, threadsParaAnalisar, integracoes);
```

**O que `executarAnaliseEmLote` faz:**
- Para cada thread, chama `canUserSeeThreadBase` duas vezes:
  - Uma vez com regras LEGADAS (sistema atual)
  - Uma vez com regras NEXUS360 (novo sistema)
- Compara as duas decisões e identifica divergências
- Classifica severidade (error = falso negativo, warning = diferença)

#### 2.5 Consolidar Resultados
```javascript
resultado.duplicatas = duplicatasDetectadas;
resultado.threadsSemContato = threadsSemContato;
resultado.threadsMensagensSuspeitas = threadsMensagensSuspeitas;
resultado.threadsContatoInvalido = threadsContatoInvalido;
resultado.mensagensComProblemaVisibilidade = mensagensComProblemaVisibilidade;

// Calcular estatísticas expandidas
resultado.stats.totalDuplicatas = ...;
resultado.stats.threadsSemContatoValido = ...;
resultado.stats.mensagensSuspeitas = ...;
resultado.stats.contatosInvalidos = ...;
resultado.stats.mensagensComProblemaVisibilidade = ...;
resultado.stats.totalProblemas = ...;
```

#### 2.6 Exibir Alertas Priorizados
```javascript
if (stats.totalProblemas > 0) {
  toast.error(`🚨 CRÍTICO: ${stats.totalProblemas} problemas graves detectados!`);
} else if (stats.criticosFalsoNegativo > 0) {
  toast.error(`🚨 ${stats.criticosFalsoNegativo} falsos negativos críticos!`);
} else if (stats.totalDuplicatas > 0) {
  toast.warning(`⚠️ ${stats.divergencias} divergências + ${stats.totalDuplicatas} contatos duplicados`);
}
```

---

## 🎨 INTERFACE DO USUÁRIO

### 3. PAINEL DE CONTROLE (Topo)

**Elementos:**
- **Seletor de Amostra**: 20/50/100/Todas threads
- **Botão "Migrar Config"**: Converte permissões legadas para Nexus360
- **Botão "Comparação Detalhada"**: Recarrega contatos/mensagens completas
- **Botão "Play"**: Executa simulação

### 4. VISUALIZAÇÃO EM COLUNAS (Por Integração)

**Layout:**
- Uma coluna para cada WhatsAppIntegration
- Threads listadas verticalmente dentro de cada coluna
- Drag-and-drop entre threads para unificação manual

**Card de Thread:**
```
┌─────────────────────────────────┐
│ 🟢 Avatar │ Nome do Contato      │
│           │ Última msg preview   │
│           │ [Badges: Ext/1:1/Grp]│
│           │ ⚠️ Erro Nexus (se há)│
│           │                      │
│  🔔 Indicadores (hover):         │
│  • Info (ℹ️)                     │
│  • Duplicatas (👥)               │
│  • Msgs não visíveis (👁️‍🗨️)       │
└─────────────────────────────────┘
```

**Indicadores Visuais:**
- 🔴 **Avatar laranja/vermelho**: Thread com mensagens não lidas
- 🚨 **Badge vermelho no avatar**: Erro crítico Nexus360
- 🟠 **Badge laranja no avatar**: Mensagens não visíveis
- 📌 **Borda esquerda laranja**: Problema de visibilidade
- ✨ **Animação pulse**: Duplicata detectada

### 5. TABELA COMPARATIVA DETALHADA

**Colunas:**
1. **Contato**: Nome, avatar, badges de problemas
2. **Atual**: ✓ Visível / 🔒 Bloqueado (legado)
3. **Nexus**: ✓ Visível / 🔒 Bloqueado (nexus360)
4. **Regra Nexus**: Qual regra (P2, P3, P4...)
5. **Código Decisão**: Código interno (DEFAULT_ALLOW, BLOCK_ASSIGNED...)
6. **Status**: MATCH / CRÍTICO / ALERTA
7. **Detalhes**: Botões de ação

**Filtros Disponíveis:**
- Por regra Nexus (P2-P12)
- Por status (matches, divergências, críticos)
- Por problemas graves (sem contato, contato inválido, msg suspeita, visibilidade)
- Por nome do contato
- Por usuário atribuído
- Por instância WhatsApp

### 6. LINHA EXPANDIDA (Clique em "Info")

**Mostra:**
- **Sistema Atual**: Decisão + Motivo
- **Nexus360**: Decisão + Motivo + Caminho da Regra + Código
- **Metadados da Thread**: ID, tipo, canal, atribuído, setor, integração, fidelizado, última msg, não lidas
- **Problemas de Visibilidade**: Lista de mensagens com problemas (se houver)

---

## 🛠️ FUNCIONALIDADES ESCONDIDAS / AVANÇADAS

### 7.1 Drag & Drop para Unificação Manual
```javascript
onDragStart={(e) => {
  setDraggedThread({ thread, contato, integracao });
}}

onDrop={(e) => {
  if (draggedThread && draggedThread.contato?.id !== contato?.id) {
    setContatoDragOrigem(draggedThread.contato);
    setContatoDropDestino(contato);
    setModalCorrecaoOpen(true); // Abre UnificadorContatosManual
  }
}}
```

**Como usar:**
1. Arraste uma thread
2. Solte sobre outra thread com contato diferente
3. Modal de unificação abre automaticamente

### 7.2 Botão "19 DUPLICATAS - Corrigir"
```javascript
<Button onClick={() => {
  setTelefoneParaCorrigir(contato.telefone);
  setModalCorrecaoOpen(true);
}}>
  <Users />
</Button>
```

**Comportamento:**
- Detecta se o telefone tem duplicatas (via `mapaTelefones`)
- Se tem: badge vermelho + pulse + "🚨 X DUPLICATAS"
- Ao clicar: abre modal com UnificadorContatosManual
- **PROBLEMA ATUAL**: Não valida se as duplicatas ainda são acionáveis

### 7.3 Botão de Mensagens Não Visíveis
```javascript
<Button onClick={() => {
  const msgsThread = simulationResults.mensagensComProblemaVisibilidade?.filter(m => m.threadId === thread.id);
  toast.info(`${msgsThread?.length || 0} mensagens com problema`);
}}>
  <EyeOff />
</Button>
```

### 7.4 Migração Automática de Configuração
```javascript
const handleAutoMigrate = async () => {
  const newPolicy = buildPolicyFromLegacyUser(usuarioAtual);
  await base44.entities.User.update(usuarioAtual.id, newPolicy);
  toast.success('Configuração Nexus360 gerada!');
}
```

**O que faz:**
- Lê campos legados do usuário (bloqueio_setores, liberacao_setores, etc.)
- Gera objeto Nexus360 (`configuracao_visibilidade_nexus`, `permissoes_acoes_nexus`)
- Salva no banco
- **Preserva configurações antigas** para rollback

### 7.5 Recarregar Dados Completos
```javascript
const recarregarDadosCompletos = async () => {
  const [contacts, messages, threadsData] = await Promise.all([...]);
  setContatos(contacts);
  setMensagens(messages);
}
```

---

## 🔴 PROBLEMAS IDENTIFICADOS - PONTOS FRACOS

### PROBLEMA 1: Botão "19 Duplicatas" Não Valida Antes de Abrir
**Descrição:**
- O contador vem da detecção bruta no `mapaTelefones`
- Ao clicar, passa apenas `telefone` para o Unificador
- O Unificador vai buscar TODOS os contatos com aquele telefone
- **FALHA**: Pode incluir contatos já merged, threads não-canônicas, etc.

**Impacto:**
- Usuário vê "19 duplicatas" mas ao clicar, unificador falha ou mostra "0 duplicatas"
- Gera confusão e perda de confiança

**Solução:**
```javascript
// ANTES de abrir modal, validar duplicatas acionáveis
const validarDuplicatasAcionaveis = async (telefone) => {
  const todosContatos = await base44.entities.Contact.list('-created_date', 5000);
  const variacoes = gerarVariacoesTelefone(telefone);
  
  const duplicatas = todosContatos.filter(c => {
    const tel = (c.telefone || '').replace(/\D/g, '');
    return variacoes.some(v => v === tel);
  });
  
  // Filtrar apenas contatos que ainda têm threads canônicas ativas
  const contatosValidos = [];
  for (const contato of duplicatas) {
    const threadsContato = await base44.entities.MessageThread.filter({ contact_id: contato.id });
    const temThreadCanonica = threadsContato.some(t => t.is_canonical && t.status !== 'merged');
    if (temThreadCanonica) contatosValidos.push(contato);
  }
  
  return contatosValidos;
};

// No onClick do botão:
const duplicatasValidas = await validarDuplicatasAcionaveis(contato.telefone);
if (duplicatasValidas.length <= 1) {
  toast.warning('Duplicatas já foram unificadas anteriormente');
  return;
}
```

### PROBLEMA 2: Uso de `$ne` em Filtros (BLOQUEADOR TÉCNICO)
**Descrição:**
- Código atual NÃO usa `$ne` na simulação principal
- **MAS**: Se qualquer código downstream (UnificadorContatosManual, nexusComparator, etc.) usar `{ status: { $ne: 'merged' } }`, quebra

**Onde pode estar escondido:**
- `components/lib/nexusComparator.js` (executarAnaliseEmLote)
- Funções auxiliares de thread/contato

**Solução:**
- NUNCA usar `$ne` em queries
- SEMPRE buscar amplo e filtrar em JS:
```javascript
// ❌ ERRADO
const threads = await base44.entities.MessageThread.filter({ 
  status: { $ne: 'merged' } 
});

// ✅ CORRETO
const todasThreads = await base44.entities.MessageThread.filter({});
const threads = todasThreads.filter(t => t.status !== 'merged');
```

### PROBLEMA 3: Detecção de Duplicatas Ignora Threads Merged
**Descrição:**
- A detecção de duplicatas faz:
```javascript
mapaTelefones.get(contato.telefone).push({ thread, contato });
```

- Problema: Se um contato já foi unificado (todas suas threads estão `merged`), ele ainda aparece no contador de duplicatas

**Impacto:**
- Contador inflado (mostra "19 duplicatas" quando na verdade só existem 3 acionáveis)

**Solução:**
```javascript
// Só adicionar ao mapa se o contato tem threads ativas
const temThreadsAtivas = threadsParaAnalisar.some(t => 
  t.contact_id === contato.id && 
  t.is_canonical && 
  t.status !== 'merged'
);

if (temThreadsAtivas && contato.telefone) {
  mapaTelefones.get(contato.telefone).push({ thread, contato });
}
```

### PROBLEMA 4: Paginação Limitada a 5000 Contatos
**Descrição:**
```javascript
const todosContatos = await base44.entities.Contact.list('-created_date', 5000);
```

- Se o banco tiver > 5000 contatos, a busca de duplicatas fica incompleta

**Solução:**
- Implementar paginação real com cursor (não implementado no Base44 hoje)
- OU: Buscar por filtro de telefone diretamente no backend (feature request)
- **Workaround**: Aumentar limite para 10000 (risco de timeout)

### PROBLEMA 5: Filtros de UI Não Sincronizam com Contadores
**Descrição:**
- Os cards de métrica mostram números totais
- Mas os filtros da tabela podem mostrar subset
- Gera confusão: "100 divergências" mas só vê 10 na tabela

**Solução:**
- Adicionar contador dinâmico na tabela: "Exibindo X de Y resultados"

### PROBLEMA 6: `recarregarDadosCompletos` Pode Ser Lento
**Descrição:**
```javascript
const [contacts, messages, threadsData] = await Promise.all([
  base44.entities.Contact.list(),
  base44.entities.Message.list(),
  base44.entities.MessageThread.list()
]);
```

- Se houver 10k+ contatos, 50k+ mensagens, isso vai travar a UI

**Solução:**
- Adicionar loader visual durante recarga
- Implementar cache inteligente (só recarregar se passou > 5min)
- Limitar mensagens a últimas 10k por padrão

---

## ✅ PONTOS FORTES

### 1. Detecção Multicanal de Problemas
- Detecta 4 categorias críticas de integridade
- Vai além de visibilidade (pega contato inválido, msgs órfãs, etc.)

### 2. Comparação Lado a Lado (Legado vs Nexus)
- Visualmente clara
- Mostra caminho de decisão completo
- Permite auditoria pré-produção

### 3. Interface Visual Rica
- Colunas por integração (facilita identificar problema em chip específico)
- Badges, cores, ícones indicam severidade
- Drag-and-drop intuitivo

### 4. Sistema de Filtros Robusto
- 5 dimensões de filtro (regra, status, nome, usuário, instância)
- Permite drill-down rápido em problemas específicos

### 5. Unificação Manual Integrada
- Modal de correção embutido
- Suporta drag-and-drop E clique direto
- Feedback visual durante processo

---

## 🚀 MELHORIAS RECOMENDADAS

### MELHORIA 1: Unificar Detecção de Duplicatas em Módulo Único
**Problema Atual:**
- Lógica de `gerarVariacoesTelefone` está duplicada em 3 lugares:
  - NexusSimuladorVisibilidade
  - UnificadorContatosManual
  - (Possivelmente) LimpezaDuplicatas

**Solução:**
```javascript
// Criar: components/lib/duplicateDetector.js

export const gerarVariacoesTelefone = (telefone) => {
  // ... lógica centralizada
};

export const buscarContatosDuplicados = async (telefone, incluirMerged = false) => {
  const variacoes = gerarVariacoesTelefone(telefone);
  const todosContatos = await base44.entities.Contact.list('-created_date', 10000);
  
  const duplicatas = todosContatos.filter(c => {
    const tel = (c.telefone || '').replace(/\D/g, '');
    return variacoes.some(v => v === tel);
  });
  
  if (!incluirMerged) {
    // Filtrar apenas contatos com threads ativas
    const validos = [];
    for (const contato of duplicatas) {
      const threads = await base44.entities.MessageThread.filter({ contact_id: contato.id });
      const temAtiva = threads.some(t => t.is_canonical && t.status !== 'merged');
      if (temAtiva) validos.push(contato);
    }
    return validos;
  }
  
  return duplicatas;
};
```

**Uso:**
```javascript
// Em NexusSimuladorVisibilidade
import { buscarContatosDuplicados } from '@/components/lib/duplicateDetector';

const duplicatasValidas = await buscarContatosDuplicados(contato.telefone);
if (duplicatasValidas.length > 1) {
  // Mostrar badge "X duplicatas"
}
```

### MELHORIA 2: Validação Pré-Abertura de Modal
**Implementação:**
```javascript
const abrirModalCorrecao = async (telefone) => {
  const loadingToast = toast.loading('🔍 Validando duplicatas...');
  
  try {
    const duplicatasValidas = await buscarContatosDuplicados(telefone, false);
    
    toast.dismiss(loadingToast);
    
    if (duplicatasValidas.length <= 1) {
      toast.warning('Duplicatas já foram unificadas anteriormente');
      return;
    }
    
    setTelefoneParaCorrigir(telefone);
    setModalCorrecaoOpen(true);
    
  } catch (error) {
    toast.dismiss(loadingToast);
    toast.error('Erro ao validar duplicatas');
  }
};

// Substituir todos os onClick do botão duplicatas por:
onClick={() => abrirModalCorrecao(contato.telefone)}
```

### MELHORIA 3: Cache Inteligente de Dados
**Implementação:**
```javascript
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos
const [ultimaRecarga, setUltimaRecarga] = useState(0);

const recarregarDadosCompletos = async (forcar = false) => {
  const agora = Date.now();
  
  if (!forcar && (agora - ultimaRecarga) < CACHE_DURATION) {
    toast.info('Dados já estão atualizados (últimos 5min)');
    return;
  }
  
  // ... resto da lógica
  setUltimaRecarga(agora);
};
```

### MELHORIA 4: Contador Dinâmico na Tabela
**Implementação:**
```javascript
const resultadosFiltrados = simulationResults.resultados.filter(res => {
  // ... lógica de filtros atual
});

// Adicionar abaixo dos cards de métrica:
<div className="text-xs text-slate-600 px-3 py-1 bg-slate-100 rounded">
  Exibindo <strong>{resultadosFiltrados.length}</strong> de {simulationResults.stats.total} threads
</div>
```

### MELHORIA 5: Exportar Relatório de Divergências
**Nova funcionalidade:**
```javascript
const exportarRelatorio = () => {
  const divergencias = simulationResults.resultados.filter(r => !r.isMatch);
  
  const csv = [
    ['Thread ID', 'Contato', 'Telefone', 'Regra Nexus', 'Severidade', 'Motivo Legado', 'Motivo Nexus'],
    ...divergencias.map(d => [
      d.threadId,
      d.contactName,
      contatos.find(c => c.id === threads.find(t => t.id === d.threadId)?.contact_id)?.telefone,
      d.nexusDecisionPath?.[0],
      d.severity,
      d.legacyMotivo,
      d.nexusMotivo
    ])
  ].map(row => row.join(',')).join('\n');
  
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `nexus-divergencias-${new Date().toISOString()}.csv`;
  a.click();
};
```

---

## 📋 COMPARAÇÃO COM O ESTUDO FORNECIDO

### ✅ Alinhamentos Corretos

1. **Sem uso de `$ne` na simulação principal** (já implementado)
2. **Detecção de problemas graves** (threads sem contato, msgs suspeitas)
3. **Marcação de threads como `merged`** (preserva histórico)
4. **Escolha do contato "mais forte"** (não só por idade)

### ⚠️ Gaps Identificados

1. **Botão de duplicatas não pré-valida** → Resolver com `buscarContatosDuplicados` antes de abrir modal
2. **Paginação limitada** → Aumentar limite ou implementar busca backend
3. **Ausência de módulo centralizado** → Criar `lib/duplicateDetector.js`
4. **Sem cache de dados** → Implementar cache de 5min
5. **Sem exportação de relatório** → Adicionar botão de export CSV

---

## 🎯 PLANO DE AÇÃO FINAL - UNIFICAÇÃO EM 1 ÚNICO LOCAL

### Objetivo
Centralizar TODA lógica de duplicatas em:
- `components/lib/duplicateDetector.js` → Detecção + Validação
- `components/comunicacao/UnificadorContatosManual.jsx` → Execução (já corrigido)

### Estrutura do Módulo Centralizado
```javascript
// components/lib/duplicateDetector.js

export const gerarVariacoesTelefone = (telefone) => { ... };

export const buscarContatosDuplicados = async (telefone, incluirMerged = false) => { ... };

export const contarDuplicatasAtivas = async () => {
  // Retorna mapa: { telefone → count } só com duplicatas acionáveis
};

export const validarParUnificavel = async (contatoA, contatoB) => {
  // Verifica se os 2 contatos podem ser unificados
  // Retorna: { valido: boolean, motivo: string }
};
```

### Uso Unificado

**Em NexusSimuladorVisibilidade:**
```javascript
import { buscarContatosDuplicados } from '@/components/lib/duplicateDetector';

// Substituir lógica de mapaTelefones por:
const duplicatasMap = await contarDuplicatasAtivas();

// No botão:
onClick={async () => {
  const validas = await buscarContatosDuplicados(contato.telefone, false);
  if (validas.length <= 1) {
    toast.warning('Duplicatas já unificadas');
    return;
  }
  setTelefoneParaCorrigir(contato.telefone);
  setModalCorrecaoOpen(true);
}}
```

**Em UnificadorContatosManual:**
```javascript
import { buscarContatosDuplicados } from '@/components/lib/duplicateDetector';

// Substituir lógica de carregarDuplicatasPorTelefone:
const duplicatasValidas = await buscarContatosDuplicados(telefone, false);
```

---

## 📊 RESUMO EXECUTIVO

### Status Atual do Componente
- ✅ **Interface**: 9/10 (visual excelente, drag-and-drop inovador)
- ⚠️ **Lógica de Duplicatas**: 6/10 (detector funciona mas não valida antes de abrir)
- ✅ **Comparação Legado/Nexus**: 10/10 (completa e auditável)
- ⚠️ **Performance**: 7/10 (pode travar com >10k contatos)
- ⚠️ **Manutenibilidade**: 6/10 (lógica duplicada em 3 lugares)

### Prioridades de Correção

#### 🔴 CRÍTICO (Fazer Agora)
1. Remover qualquer `$ne` remanescente (buscar em `nexusComparator.js`)
2. Validar duplicatas antes de abrir modal
3. Adicionar imports de CardHeader/CardContent no UnificadorContatosManual ✅ (já feito)

#### 🟡 IMPORTANTE (Esta Semana)
4. Criar módulo `lib/duplicateDetector.js` centralizado
5. Adicionar cache de 5min no recarregar dados
6. Implementar contador dinâmico "X de Y threads"

#### 🟢 MELHORIAS (Backlog)
7. Exportar relatório CSV de divergências
8. Implementar busca backend de duplicatas (evitar load de 10k contatos)
9. Adicionar confirmação visual antes de arrastar threads

---

## 🎬 SCRIPT DE TESTE COMPLETO

### Cenário 1: Botão "19 Duplicatas" deve funcionar
```
1. Abrir Nexus Simulador
2. Executar simulação
3. Localizar thread com badge "19 DUPLICATAS - Corrigir"
4. Clicar no botão vermelho pulsante
5. ✅ Esperado: Modal abre com lista de duplicatas
6. ❌ Bug atual: Modal abre vazio ou com erro "Apenas 1 contato encontrado"
7. ✅ Solução: Pré-validar com buscarContatosDuplicados()
```

### Cenário 2: Unificação manual via drag-and-drop
```
1. Arrastar thread A
2. Soltar sobre thread B (contato diferente)
3. ✅ Esperado: Modal abre com A como duplicata, B como principal
4. ✅ Comportamento atual: Funciona corretamente
```

### Cenário 3: Simulação com 0 divergências
```
1. Configurar usuário com permissões Nexus360
2. Executar simulação
3. ✅ Esperado: Toast "100% aderência"
4. ✅ Comportamento atual: Funciona
```

---

## 🏗️ PRÓXIMOS PASSOS RECOMENDADOS

1. **Agora**: Implementar `lib/duplicateDetector.js`
2. **Hoje**: Validar duplicatas antes de abrir modal
3. **Amanhã**: Buscar e remover qualquer `$ne` em nexusComparator/helpers
4. **Esta semana**: Adicionar cache e contadores dinâmicos
5. **Próxima sprint**: Exportação CSV e otimizações de performance

---

**Conclusão:**
O NexusSimuladorVisibilidade é uma ferramenta poderosa de diagnóstico, mas o fluxo de duplicatas precisa ser **validado antes da execução** para evitar frustração do usuário. A centralização da lógica em um módulo único (`lib/duplicateDetector.js`) vai resolver os problemas de sincronização e manutenibilidade.