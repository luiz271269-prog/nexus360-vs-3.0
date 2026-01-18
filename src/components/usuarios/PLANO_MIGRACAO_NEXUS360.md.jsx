# 🚀 PLANO DE MIGRAÇÃO NEXUS360 - ATIVAÇÃO COMPLETA

**Data:** 2026-01-18  
**Status:** PRONTO PARA EXECUÇÃO  
**Tempo Estimado:** 8-12 horas de desenvolvimento

---

## 📋 SITUAÇÃO ATUAL (Verdade Consolidada)

### ✅ O QUE FUNCIONA (Sistema Legado)
```javascript
// CAMADA 1: Menu/Páginas
Layout.js → usuario.paginas_acesso ✅ ATIVO

// CAMADA 2: Visibilidade de Threads
threadVisibility.js → {
  permissoes_visualizacao.setores_visiveis,     ✅ ATIVO
  permissoes_visualizacao.integracoes_visiveis, ✅ ATIVO
  whatsapp_permissions[].can_view               ✅ ATIVO (100% funcional)
}

// CAMADA 3: Ações em Conversas
ChatWindow.jsx → permissoes_comunicacao.pode_* ✅ ATIVO (mas legado)
```

### ❌ O QUE NÃO FUNCIONA (Sistema Novo)
```javascript
// PREPARADO MAS DESCONECTADO:
configuracao_visibilidade_nexus → ❌ NINGUÉM LÊ
permissoes_acoes_nexus → ❌ NINGUÉM LÊ

// INTERFACE BONITA MAS INÚTIL:
PainelPermissoesUnificado.jsx → Salva mas não afeta sistema ❌
```

### 🔴 GAPS DE SEGURANÇA
```
1. Assumir da fila         - sem validação ❌
2. Criar notas internas     - sem validação ❌
3. Ver histórico chamadas   - sem validação ❌
4. Encaminhar mensagens     - sem validação ❌
5. Categorizar mensagens    - sem validação ❌
```

---

## 🎯 LINHA LÓGICA DE REORGANIZAÇÃO

### Arquitetura Alvo (Single Source of Truth)

```
┌─────────────────────────────────────────────────────────────┐
│                    USER ENTITY (Database)                    │
│ ─────────────────────────────────────────────────────────── │
│  nexus360_permissions: {                                    │
│    visibility: {                                            │
│      mode: 'padrao_liberado',                               │
│      regras_bloqueio: [...],    // P9/P10/P11              │
│      regras_liberacao: [...]    // P5/P8                   │
│    },                                                       │
│    actions: {                                               │
│      podeEnviarMensagens: true,                            │
│      ... (80+ flags)                                       │
│    },                                                       │
│    integracoes: {                                          │
│      "uuid-1": { can_view, can_send, can_receive }        │
│    },                                                       │
│    diagnostico: { ativo, log_level }                       │
│  }                                                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│              PERMISSIONS SERVICE (Business Logic)            │
│ ─────────────────────────────────────────────────────────── │
│  buildUserPermissions(usuario, integracoes)                 │
│    → retorna userPermissions (objeto processado)           │
│                                                              │
│  canUserSeeThreadBase(userPermissions, thread, contact)    │
│    → aplica VISIBILITY_MATRIX P1-P12                       │
│    → retorna boolean                                        │
│                                                              │
│  canUserPerformAction(userPermissions, 'podeEnviar')       │
│    → retorna boolean (default: liberado)                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│                   COMPONENTES UI (Frontend)                  │
│ ─────────────────────────────────────────────────────────── │
│  Comunicacao.jsx:                                           │
│    const userPermissions = buildUserPermissions(...)       │
│    <ChatSidebar userPermissions={...} />                   │
│                                                              │
│  ChatSidebar.jsx:                                           │
│    threads.filter(t => canUserSeeThreadBase(userPerms, t)) │
│                                                              │
│  ChatWindow.jsx:                                            │
│    const podeEnviar = canUserPerformAction(userPerms,      │
│                         'podeEnviarMensagens')             │
│    <Button disabled={!podeEnviar}>Enviar</Button>          │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔥 SPRINT 1: ATIVAR NEXUS360 (Fase 1 - Validação Dupla)

**Objetivo:** Fazer Nexus360 funcionar SEM quebrar sistema legado  
**Duração:** 4 horas  

### TAREFA 1.1: ChatWindow.jsx - Migrar Validações de Envio

**Arquivo:** `components/comunicacao/ChatWindow.jsx`  
**Linhas:** ~330-343  

```javascript
// ❌ ANTES (LEGADO):
const permissoes = usuario?.permissoes_comunicacao || {};
const temPermissaoGeralEnvio = permissoes.pode_enviar_mensagens !== false;
const temPermissaoGeralMidia = permissoes.pode_enviar_midias !== false;
const temPermissaoGeralAudio = permissoes.pode_enviar_audios !== false;

// ✅ DEPOIS (NEXUS360 + FALLBACK):
const permNexus = usuario?.permissoes_acoes_nexus || {};
const permLegado = usuario?.permissoes_comunicacao || {};

const temPermissaoGeralEnvio = permNexus.podeEnviarMensagens ?? permLegado.pode_enviar_mensagens ?? true;
const temPermissaoGeralMidia = permNexus.podeEnviarMidias ?? permLegado.pode_enviar_midias ?? true;
const temPermissaoGeralAudio = permNexus.podeEnviarAudios ?? permLegado.pode_enviar_audios ?? true;
```

**Impacto:** Painel Nexus360 passa a controlar envio de mensagens

---

### TAREFA 1.2: CentralControleOperacional.jsx - Validar "Assumir Fila"

**Arquivo:** `components/comunicacao/CentralControleOperacional.jsx`  
**Linha:** ~450 (antes do botão "Assumir Próximo")  

```javascript
// ✅ ADICIONAR VALIDAÇÃO:
const podeAssumir = usuario?.permissoes_acoes_nexus?.podeAssumirDaFila ?? 
                    usuario?.permissoes_visualizacao?.pode_atribuir_conversas ?? 
                    true;

// ✅ MODIFICAR BOTÃO:
<Button
  onClick={() => assumirProximaDaFila(setorKey)}
  disabled={!podeAssumir || assumindo}
  title={!podeAssumir ? 'Você não tem permissão para assumir conversas da fila' : ''}
  className={!podeAssumir ? 'opacity-50 cursor-not-allowed' : ''}
>
  {assumindo ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Assumir Próximo'}
</Button>
```

**Impacto:** Fecha brecha de segurança crítica (júnior pegando leads VIP)

---

### TAREFA 1.3: CallHistoryPanel.jsx - Filtrar por Nível

**Arquivo:** `components/comunicacao/CallHistoryPanel.jsx`  
**Modificação:** Query de busca de chamadas  

```javascript
// ❌ ANTES (TODOS VEEM TUDO):
const chamadas = await base44.entities.CallSession.list('-created_date', 100);

// ✅ DEPOIS (FILTRAR JÚNIOR/PLENO):
const podeVerTodas = usuario?.permissoes_acoes_nexus?.podeVerHistoricoChamadas ?? 
                     (usuario?.attendant_role === 'gerente' || usuario?.attendant_role === 'coordenador' || usuario?.role === 'admin');

const chamadas = podeVerTodas
  ? await base44.entities.CallSession.list('-created_date', 100)
  : await base44.entities.CallSession.filter({ user_id: usuario.id }, '-created_date', 50);

// ✅ ADICIONAR BADGE INFORMATIVO:
{!podeVerTodas && (
  <Badge className="bg-blue-100 text-blue-700 mb-4">
    📞 Mostrando apenas suas chamadas
  </Badge>
)}
```

**Impacto:** Privacidade/LGPD - júnior só vê próprias ligações

---

### TAREFA 1.4: MessageBubble.jsx - Validar Encaminhar/Categorizar

**Arquivo:** `components/comunicacao/MessageBubble.jsx`  
**Linhas:** Menu contexto da mensagem  

```javascript
// ✅ ADICIONAR NO INÍCIO DO COMPONENTE:
const podeEncaminhar = usuarioAtual?.permissoes_acoes_nexus?.podeEncaminharMensagens ?? true;
const podeCategorizar = usuarioAtual?.permissoes_acoes_nexus?.podeCategorizarMensagensIndividuais ?? true;

// ✅ MODIFICAR MENU DROPDOWN:
{podeEncaminhar && (
  <DropdownMenuItem onClick={() => setMostrarModalEncaminhar(true)}>
    <Forward className="w-4 h-4 mr-2" />
    Encaminhar
  </DropdownMenuItem>
)}

{podeCategorizar && (
  <DropdownMenuItem onClick={() => setMostrarCategorizador(true)}>
    <Tag className="w-4 h-4 mr-2" />
    Adicionar Etiqueta
  </DropdownMenuItem>
)}
```

**Impacto:** Controla compartilhamento de conversas sensíveis

---

**📊 RESULTADO SPRINT 1:**
- ✅ Nexus360 50% ativo (ações principais)
- ✅ 3 gaps críticos fechados
- ⚠️ Legado ainda como fallback (seguro)

---

## ⚡ SPRINT 2: CONECTAR ENGINE DE VISIBILIDADE (Fase 2)

**Objetivo:** threadVisibility.js usar Nexus360 completo  
**Duração:** 4 horas  

### TAREFA 2.1: Comunicacao.jsx - Inicializar UserPermissions

**Arquivo:** `pages/Comunicacao.jsx`  
**Adicionar após carregar usuário:**  

```javascript
import { buildUserPermissions, canUserSeeThreadBase, canUserPerformAction } from '@/components/lib/permissionsService';

// ✅ NOVO: Processar permissões uma única vez
const [userPermissions, setUserPermissions] = useState(null);

useEffect(() => {
  if (usuario && integracoes) {
    const perms = buildUserPermissions(usuario, integracoes);
    setUserPermissions(perms);
    console.log('[COMUNICACAO] 🔐 UserPermissions gerado:', perms);
  }
}, [usuario, integracoes]);

// ✅ PASSAR PARA COMPONENTES:
<ChatSidebar 
  threads={threads}
  userPermissions={userPermissions} // ← NOVO
  ...
/>

<ChatWindow
  thread={selectedThread}
  userPermissions={userPermissions} // ← NOVO
  ...
/>
```

**Impacto:** Centraliza processamento de permissões (1x ao invés de 100x)

---

### TAREFA 2.2: ChatSidebar.jsx - Usar canUserSeeThreadBase

**Arquivo:** `components/comunicacao/ChatSidebar.jsx`  
**Linha:** ~147 (filtro de threads)  

```javascript
// ❌ ANTES (LÓGICA MANUAL):
const threadsVisiveis = threads.filter(thread => {
  // ... lógica complexa de visibilidade
});

// ✅ DEPOIS (USAR ENGINE):
import { canUserSeeThreadBase } from '@/components/lib/permissionsService';

const threadsVisiveis = threads.filter(thread => {
  // Se não tem userPermissions processado, usar lógica atual como fallback
  if (!userPermissions) {
    return true; // Ou usar lógica legado
  }
  
  const contato = thread.contact_id ? contatosMap[thread.contact_id] : null;
  return canUserSeeThreadBase(userPermissions, thread, contato);
});
```

**Impacto:** Regras P1-P12 passam a funcionar (bloqueios, liberações)

---

### TAREFA 2.3: threadVisibility.js - Adaptar para usar UserPermissions

**Arquivo:** `components/lib/threadVisibility.js`  
**Estratégia:** Manter funções existentes mas adicionar suporte Nexus360  

```javascript
// ✅ ADICIONAR NO INÍCIO DO ARQUIVO:
import { canUserSeeThreadBase, canUserPerformAction } from './permissionsService';

// ✅ MODIFICAR temPermissaoIntegracao (linha 67):
export const temPermissaoIntegracao = (usuario, integracaoId, userPermissions = null) => {
  // NOVA LÓGICA: Se userPermissions processado, usar Nexus360
  if (userPermissions?.integracoes) {
    const permIntegracao = userPermissions.integracoes[integracaoId];
    return permIntegracao?.can_view ?? true;
  }
  
  // FALLBACK: Lógica legado (compatibilidade)
  const whatsappPerms = usuario?.whatsapp_permissions || [];
  const perm = whatsappPerms.find(p => p.integration_id === integracaoId);
  
  if (perm) return perm.can_view ?? true;
  
  const perms = usuario?.permissoes_visualizacao || {};
  const visiveis = perms.integracoes_visiveis;
  if (visiveis && visiveis.length > 0) {
    return visiveis.includes(integracaoId);
  }
  
  return true;
};

// ✅ SIMILAR para threadSetorVisivel, threadConexaoVisivel, etc.
```

**Impacto:** Regras de bloqueio Nexus360 começam a funcionar

---

### TAREFA 2.4: ContactInfoPanel.jsx - Validar Alterações

**Arquivo:** `components/comunicacao/ContactInfoPanel.jsx`  
**Adicionar validações:**  

```javascript
// ✅ NO INÍCIO DO COMPONENTE:
const podeEditarContato = userPermissions 
  ? canUserPerformAction(userPermissions, 'podeEditarContato')
  : usuario?.permissoes_visualizacao?.pode_editar_contatos ?? true;

const podeAlterarStatus = userPermissions
  ? canUserPerformAction(userPermissions, 'podeAlterarStatusContato')
  : true; // Default liberado no legado

const podeBloquear = userPermissions
  ? canUserPerformAction(userPermissions, 'podeBloquearContato')
  : usuario?.permissoes_visualizacao?.pode_bloquear_contatos ?? true;

// ✅ APLICAR NOS BOTÕES:
<Button disabled={!podeEditarContato}>Salvar</Button>
<Select disabled={!podeAlterarStatus}>Status...</Select>
<Button disabled={!podeBloquear}>Bloquear</Button>
```

**Impacto:** Júnior não pode mais desqualificar leads erroneamente

---

**📊 RESULTADO SPRINT 2:**
- ✅ Nexus360 85% ativo
- ✅ Visibilidade de threads usando P1-P12
- ✅ Todos gaps críticos fechados

---

## 🔧 SPRINT 3: IMPLEMENTAR FUNCIONALIDADES FALTANTES

**Objetivo:** Completar features que painel já controla  
**Duração:** 4 horas  

### TAREFA 3.1: Encerrar/Arquivar Conversa

**Backend:** Criar função `functions/arquivarThread.js`
```javascript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { thread_id, motivo } = await req.json();
    
    // Atualizar thread
    await base44.entities.MessageThread.update(thread_id, {
      status: 'arquivada',
      arquivada_em: new Date().toISOString(),
      arquivada_por: user.id,
      motivo_arquivamento: motivo
    });
    
    return Response.json({ success: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

**Frontend:** Adicionar botão no `ChatWindow.jsx`
```javascript
const podeEncerrar = canUserPerformAction(userPermissions, 'podeEncerrarConversa');

{podeEncerrar && (
  <Button onClick={() => arquivarConversa(thread.id)}>
    <Archive className="w-4 h-4 mr-2" />
    Arquivar
  </Button>
)}
```

**Esforço:** 2h

---

### TAREFA 3.2: Reabrir Arquivadas

**Frontend:** Adicionar filtro em `ChatSidebar.jsx`
```javascript
// Adicionar aba "Arquivadas"
const [mostrarArquivadas, setMostrarArquivadas] = useState(false);

const threadsExibir = mostrarArquivadas
  ? threads.filter(t => t.status === 'arquivada')
  : threads.filter(t => t.status !== 'arquivada');

// Botão reabrir
const podeReabrir = canUserPerformAction(userPermissions, 'podeReabrirConversa');

<Button 
  onClick={() => reabrirThread(thread.id)}
  disabled={!podeReabrir}
>
  Reabrir
</Button>
```

**Esforço:** 2h

---

**📊 RESULTADO SPRINT 3:**
- ✅ Nexus360 95% completo
- ✅ Funcionalidades principais implementadas

---

## 🧹 SPRINT 4: LIMPEZA E CONSOLIDAÇÃO (Fase 3)

**Objetivo:** Remover código legado após migração validada  
**Duração:** 2 horas  

### TAREFA 4.1: Script de Migração de Dados

**Criar:** `functions/migrarPermissoesParaNexus360.js`

```javascript
import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';
import { PERMISSIONS_PRESETS } from './lib/permissionsService.js';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    // Apenas admin pode rodar migração
    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    // Buscar TODOS os usuários
    const usuarios = await base44.asServiceRole.entities.User.list();
    let migrados = 0;
    let erros = 0;
    
    for (const usuario of usuarios) {
      try {
        // Se já tem Nexus360, pular
        if (usuario.permissoes_acoes_nexus && Object.keys(usuario.permissoes_acoes_nexus).length > 5) {
          continue;
        }
        
        // Detectar preset baseado em attendant_role
        const presetKey = usuario.attendant_role || (usuario.role === 'admin' ? 'admin' : 'pleno');
        const preset = PERMISSIONS_PRESETS[presetKey] || PERMISSIONS_PRESETS.pleno;
        
        // Migrar permissoes_visualizacao para configuracao_visibilidade_nexus
        const permVis = usuario.permissoes_visualizacao || {};
        const configuracao_visibilidade_nexus = {
          modo_visibilidade: 'padrao_liberado',
          regras_bloqueio: [],
          regras_liberacao: [],
          deduplicacao: {
            ativa: true,
            criterio: 'contact_id',
            manter: 'mais_recente',
            excecoes: [
              { condicao: 'thread_interna', desativar_dedup: true },
              { condicao: 'admin_com_busca', desativar_dedup: true }
            ]
          }
        };
        
        // Migrar bloqueios de setores
        if (permVis.setores_visiveis && permVis.setores_visiveis.length > 0) {
          const todosSetores = ['vendas', 'assistencia', 'financeiro', 'fornecedor', 'geral'];
          const bloqueados = todosSetores.filter(s => !permVis.setores_visiveis.includes(s));
          
          if (bloqueados.length > 0) {
            configuracao_visibilidade_nexus.regras_bloqueio.push({
              tipo: 'setor',
              valores_bloqueados: bloqueados,
              ativa: true,
              prioridade: 11,
              descricao: 'Migrado de permissoes_visualizacao'
            });
          }
        }
        
        // Atualizar usuário
        await base44.asServiceRole.entities.User.update(usuario.id, {
          configuracao_visibilidade_nexus,
          permissoes_acoes_nexus: { ...preset },
          diagnostico_nexus: { ativo: false, log_level: 'info' }
        });
        
        migrados++;
      } catch (error) {
        console.error(`Erro ao migrar usuário ${usuario.email}:`, error);
        erros++;
      }
    }
    
    return Response.json({ 
      success: true, 
      migrados, 
      erros,
      total: usuarios.length 
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
```

**Uso:** Rodar uma vez em produção via Dashboard → Functions

---

### TAREFA 4.2: Remover Campos Legados do Schema

**Arquivo:** `entities/User.json`  
**Ação:** Deletar após 30 dias de Nexus360 ativo  

```json
// ❌ REMOVER (após validação):
{
  "permissoes_comunicacao": {...},  // Deprecado
  "permissoes_visualizacao": {...}  // Deprecado
}

// ✅ MANTER:
{
  "nexus360_permissions": {
    "visibility": {...},
    "actions": {...},
    "integracoes": {...}
  }
}
```

**⚠️ ATENÇÃO:** Só fazer depois de validar 100% dos usuários migrados

---

**📊 RESULTADO SPRINT 4:**
- ✅ Sistema 100% Nexus360
- ✅ Zero código legado ativo
- ✅ Schema limpo

---

## 📐 DECISÕES ESTRATÉGICAS

### DECISÃO #1: permissoes vs paginas_acesso

**MANTER SINCRONIZAÇÃO ✅**

**Justificativa:**
```javascript
// Cenário problema:
Usuario.permissoes_acoes_nexus.podeGerenciarFilas = true
Usuario.paginas_acesso = ['Comunicacao', 'Dashboard'] // ❌ Falta "Filas"

// Resultado: Pode gerenciar mas não vê o menu → UX quebrada
```

**Solução Atual (Manter):**
```javascript
// GerenciadorUsuariosUnificado.jsx linha 358
await base44.entities.User.update(userId, {
  permissoes: novasPerms,      // Espelho
  paginas_acesso: novasPerms   // Usado pelo Layout
});
```

**Alternativa Futura (Se quiser desacoplar):**
- Criar mapeamento automático: `podeGerenciarFilas = true` → adiciona "Filas" em `paginas_acesso`
- Implementar em `buildUserPermissions` uma função `dePermissoesParaPaginas()`

**DECISÃO FINAL:** 🟢 Deixar como está (seguro e funcional)

---

### DECISÃO #2: Horário de Atendimento

**NÃO BLOQUEAR AUTOMATICAMENTE ✅**

**Justificativa:**
- Campo `horario_atendimento` existe no User
- MAS não deve impedir envio de mensagens
- USO: Apenas indicador visual "🔴 Fora do expediente"

**Implementação Soft:**
```javascript
// ChatWindow.jsx - ALERTA ao invés de bloqueio
const isForaDoHorario = () => {
  const horario = usuario?.horario_atendimento;
  if (!horario) return false;
  
  const agora = new Date();
  const hora = agora.getHours();
  const dia = agora.getDay();
  
  const [inicioH] = horario.inicio.split(':');
  const [fimH] = horario.fim.split(':');
  
  if (hora < parseInt(inicioH) || hora >= parseInt(fimH)) return true;
  if (!horario.dias_semana.includes(dia)) return true;
  
  return false;
};

// Mostrar badge informativo
{isForaDoHorario() && (
  <Badge className="bg-amber-100 text-amber-700">
    🕒 Fora do seu horário de atendimento
  </Badge>
)}
```

---

### DECISÃO #3: Limite de Conversas Simultâneas

**ALERTA SOFT AO INVÉS DE BLOQUEIO HARD ✅**

**Código em MotorRoteamentoAtendimento:**
```javascript
// ✅ VERIFICAR MAS NÃO BLOQUEAR:
if (usuario.current_conversations_count >= usuario.max_concurrent_conversations) {
  toast.warning(`⚠️ Você já tem ${usuario.current_conversations_count} conversas (limite: ${usuario.max_concurrent_conversations}). Tem certeza?`, {
    action: {
      label: 'Sim, assumir',
      onClick: () => assumirThread()
    }
  });
} else {
  assumirThread();
}
```

**Justificativa:** Proteção sem travar operação urgente

---

### DECISÃO #4: Strict Mode

**IMPLEMENTAR (Fácil e Útil) ✅**

**Código em `permissionsService.js` já preparado:**
```javascript
// VISIBILITY_MATRIX linha 428 (Regra P5)
{
  priority: 5,
  name: 'janela_24h',
  check: (userPerms, thread, contact) => {
    if (!userPerms.janela24hAtiva) return null;
    
    // ✅ ADICIONAR:
    if (userPerms.strictMode) return null; // 🚫 Desativa P5
    
    // ... resto da lógica
  }
}

// VISIBILITY_MATRIX linha 493 (Regra P8)
{
  priority: 8,
  name: 'gerente_supervisao',
  check: (userPerms, thread, contact) => {
    if (!userPerms.gerenteSupervisaoAtiva) return null;
    if (!userPerms.podeVerTodasConversas) return null;
    
    // ✅ ADICIONAR:
    if (userPerms.strictMode) return null; // 🚫 Desativa P8
    
    // ... resto da lógica
  }
}
```

**Uso:** Estagiários/período experiência - zero exceções

---

## 📊 CHECKLIST DE VALIDAÇÃO

### Após Sprint 1 (Testar):
```
[ ] Admin desabilita podeEnviarMensagens → Botão enviar desaparece ✅
[ ] Júnior tenta assumir fila → Botão disabled (sem permissão) ✅
[ ] Júnior acessa histórico → Vê só próprias chamadas ✅
[ ] Júnior tenta encaminhar → Opção não aparece no menu ✅
```

### Após Sprint 2 (Testar):
```
[ ] Admin bloqueia setor Vendas → Threads de vendas somem ✅
[ ] Admin bloqueia integração → Conversas daquela instância somem ✅
[ ] Gerente ativa P8 (supervisão) → Vê threads sem resposta ✅
[ ] Pleno ativa P5 (janela 24h) → Vê msgs recentes de não atribuídas ✅
[ ] Strict Mode ON → P5 e P8 desativados ✅
```

### Após Sprint 3 (Testar):
```
[ ] Atendente arquiva conversa → Status muda, some da lista ✅
[ ] Gerente vê "Arquivadas" → Lista separada, pode reabrir ✅
```

---

## 🎯 ORDEM DE EXECUÇÃO PRÁTICA

### FASE 1: Preparação (30 minutos)
```
1. ✅ Atualizar PERMISSIONS_PRESETS com 15 flags novas (FEITO)
2. ✅ Painel já tem as flags mapeadas (FEITO)
3. Commitar mudanças e criar backup
4. Criar branch `feature/ativar-nexus360`
```

### FASE 2: Sprint 1 - Ações Críticas (4 horas)
```
1. ChatWindow.jsx - migrar validações
2. CentralControleOperacional.jsx - validar fila
3. CallHistoryPanel.jsx - filtrar chamadas
4. MessageBubble.jsx - validar encaminhar/categorizar
5. Testar manualmente 10 casos de uso
6. Merge para main
```

### FASE 3: Sprint 2 - Engine Visibilidade (4 horas)
```
1. Comunicacao.jsx - inicializar userPermissions
2. ChatSidebar.jsx - usar canUserSeeThreadBase
3. threadVisibility.js - suporte Nexus360
4. ContactInfoPanel.jsx - validar alterações
5. Testar bloqueios/liberações P1-P12
6. Merge para main
```

### FASE 4: Sprint 3 - Funcionalidades (4 horas)
```
1. Implementar arquivar/reabrir
2. Implementar strict mode
3. Testes integrados
4. Documentação usuário final
```

### FASE 5: Sprint 4 - Consolidação (2 horas)
```
1. Rodar script migração em STAGING
2. Validar 100% usuários migrados
3. Remover código legado (após 30 dias)
4. Atualizar documentação técnica
```

---

## 🔍 AJUSTES FINOS (Conforme Sugerido)

### AJUSTE #1: Display Name
**Arquivo:** `permissionsService.js` linha 247  
**Status:** ✅ JÁ CORRIGIDO

```javascript
// ✅ CORRETO (prioriza display_name editável):
full_name: usuario.display_name || usuario.full_name,
```

---

### AJUSTE #2: Consistência de Deduplicação
**Arquivo:** `permissionsService.js` linha 717-740  
**Status:** ✅ JÁ CONSISTENTE

```javascript
// deveDeduplicarThread() usa:
excecao.condicao === 'thread_interna'
excecao.condicao === 'admin_com_busca'

// Que bate com User.configuracao_visibilidade_nexus.deduplicacao.excecoes:
{ condicao: 'thread_interna', desativar_dedup: true }
```

**✅ OK - sem ajustes necessários**

---

### AJUSTE #3: Extensões Futuras (Horário/Capacidade/Delegação)

**Preparar Hooks:**

```javascript
// CRIAR: permissionsService.js (novo)

export function canUserInteractNow(usuario) {
  if (usuario.role === 'admin') return true;
  
  const horario = usuario.horario_atendimento;
  if (!horario) return true;
  
  const agora = new Date();
  const hora = agora.getHours();
  const dia = agora.getDay();
  
  const [inicioH] = horario.inicio.split(':');
  const [fimH] = horario.fim.split(':');
  
  if (hora < parseInt(inicioH) || hora >= parseInt(fimH)) return false;
  if (!horario.dias_semana.includes(dia)) return false;
  
  return true;
}

export function canUserReceiveMoreThreads(usuario) {
  const atual = usuario.current_conversations_count || 0;
  const maximo = usuario.max_concurrent_conversations || 999;
  return atual < maximo;
}

export function hasActiveDelegation(usuario, thread, allDelegacoes) {
  const delegacao = allDelegacoes.find(d =>
    d.usuario_origem_id === thread.assigned_user_id &&
    d.usuario_destino_id === usuario.id &&
    d.ativa &&
    new Date(d.validade_ate) > new Date()
  );
  
  return !!delegacao;
}
```

**Uso Futuro:** Adicionar na VISIBILITY_MATRIX como prioridade 5.5, 3.5, etc.

---

## 🏁 CRONOGRAMA RESUMIDO

```
📅 SEMANA 1: Sprint 1 (Ações Críticas)
  ├─ Seg: Preparação + ChatWindow
  ├─ Ter: CentralControle + CallHistory + MessageBubble
  ├─ Qua: Testes manuais
  └─ Qui: Deploy staging → produção

📅 SEMANA 2: Sprint 2 (Engine Visibilidade)
  ├─ Seg: Comunicacao + ChatSidebar
  ├─ Ter: threadVisibility + ContactInfoPanel
  ├─ Qua: Testes P1-P12
  └─ Qui: Deploy produção

📅 SEMANA 3: Sprint 3 (Funcionalidades)
  ├─ Seg: Arquivar/Reabrir
  ├─ Ter: Strict Mode + outras
  ├─ Qua: Testes integrados
  └─ Qui: Deploy produção

📅 SEMANA 4: Sprint 4 (Limpeza)
  ├─ Seg: Script migração STAGING
  ├─ Ter: Validar migração
  ├─ Qua: Rodar em PRODUÇÃO
  └─ Qui: Documentação final

📅 DIA 30: Remover código legado
```

---

## ✅ APROVAÇÃO EXECUTIVA

### O Que Será Implementado:

**SPRINT 1 (CRÍTICO):**
```
✅ Nexus360 ativo em ações principais
✅ 3 gaps de segurança fechados
✅ Compatibilidade com legado garantida
```

**SPRINT 2 (IMPORTANTE):**
```
✅ Visibilidade usando P1-P12
✅ Bloqueios/liberações funcionando
✅ Painel 100% conectado ao sistema
```

**SPRINT 3 (COMPLETUDE):**
```
✅ Arquivar/Reabrir conversas
✅ Strict Mode ativo
✅ Funcionalidades completas
```

**SPRINT 4 (LIMPEZA):**
```
✅ Migração de dados validada
✅ Código legado removido
✅ Sistema consolidado
```

### O Que NÃO Será Implementado:

```
❌ Validação automática de horário (só indicador)
❌ Bloqueio hard de capacidade (só alerta)
❌ Sistema de delegação complexo (usar transferência)
❌ Permissões por tipo de contato (usar setor)
❌ Mascaramento LGPD (todos precisam ver dados)
```

---

## 🎓 PRINCÍPIOS DE MIGRAÇÃO

1. **Progressive Enhancement** - Adicionar Nexus360 sem quebrar legado
2. **Fail-Safe Defaults** - Tudo liberado por padrão (`?? true`)
3. **Explicit Deny** - Bloqueio só com regra explícita
4. **Single Source of Truth** - `permissionsService.js` como autoridade
5. **Zero Downtime** - Validação dupla durante transição
6. **Test-Driven** - Cada sprint tem checklist de validação

---

## 📖 DOCUMENTAÇÃO FINAL

### Para Desenvolvedores:
- Ler `components/lib/permissionsService.js` (comentado)
- Sempre usar `canUserSeeThreadBase` e `canUserPerformAction`
- Nunca criar lógica de permissão direta nos componentes

### Para Admins:
- Painel `Usuários → Editar → Permissões Nexus360`
- Aplicar preset (admin/gerente/junior) e ajustar flags
- Testar com usuário de teste antes de aplicar em produção

---

## 🏁 PRONTO PARA EXECUÇÃO

**Próximo comando:** "Implementar Sprint 1 agora"

Isso irá:
1. Migrar ChatWindow para Nexus360 (validação dupla)
2. Fechar 4 gaps de segurança
3. Atualizar PRESETS (já feito ✅)
4. Testar manualmente

**Tempo:** 4 horas | **Risco:** 🟢 Baixo | **Impacto:** 🔴 CRÍTICO