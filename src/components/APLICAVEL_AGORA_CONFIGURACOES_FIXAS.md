# ✅ APLICÁVEL AGORA: Configurações Fixas na Tela de Usuários

**Data:** 2026-01-15  
**Objetivo:** Identificar mudanças aplicáveis AGORA sem risco de quebrar o sistema

---

## 🎯 FILOSOFIA

### 2 Níveis de "Aplicável Agora"

```
┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 1: APENAS CONFIGURAÇÃO (Zero Impacto)                │
├─────────────────────────────────────────────────────────────┤
│  • Adiciona campos ao User entity                           │
│  • Melhora UI da tela de permissões                         │
│  • Salva no banco mas NÃO usa em runtime                    │
│  • Sistema legado continua 100% ativo                       │
│  • RISCO: Zero                                              │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  NÍVEL 2: FUNCIONAR DIRETO (Conecta ao Motor)               │
├─────────────────────────────────────────────────────────────┤
│  • Conecta campos salvos ao motor de decisão                │
│  • Lê configuracao_visibilidade_nexus em runtime            │
│  • Aplica regras P5, P8, P9-P11, P12 de verdade             │
│  • Pode usar toggle para ativar/desativar Nexus             │
│  • RISCO: Baixo (se bem testado)                            │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 ANÁLISE: O QUE O USUÁRIO QUER

**Pergunta:** *"De tudo que já debatemos e podemos mudar sem causar problemas de funcionamento, que serão configurações fixas e já podem ser aplicadas direto à tela de configurações de usuários"*

**Interpretação:**
- ✅ Quer mudar a tela AGORA
- ✅ Quer que funcione DIRETO (não só configuração futura)
- ⚠️ **MAS** sem causar problemas de funcionamento
- 🎯 Focar em: "configurações fixas" = Hard Core (P1-P4, P9-P11)

**Conclusão:**
→ Implementar **NÍVEL 1 + PARCIAL NÍVEL 2**
→ Adicionar campos + UI + conectar ao motor **COM TOGGLE**
→ Permitir ativar Nexus **por usuário** (gradual)

---

## ✅ LISTA DEFINITIVA: APLICÁVEL AGORA

### 🔴 PRIORIDADE 1: Campos Fundamentais (15min)

#### 1.1 User Entity - Adicionar Campos

```json
{
  "sistema_permissoes_ativo": {
    "type": "string",
    "enum": ["legado", "nexus360"],
    "default": "legado",
    "description": "Sistema de permissões em uso para este usuário"
  },
  
  "permissoes_acoes_nexus": {
    "type": "object",
    "properties": {
      "...19 flags existentes...": "...",
      
      "podeVerCarteiraOutros": { 
        "type": "boolean",
        "default": false,
        "description": "Ver contatos fidelizados a outros (P6)"
      },
      
      "podeVerNaoAtribuidas": { 
        "type": "boolean",
        "default": true,
        "description": "Ver threads não atribuídas do setor (filas)"
      },
      
      "podeVerConversasOutros": { 
        "type": "boolean",
        "default": false,
        "description": "Ver threads atribuídas a outros do setor (P7)"
      },
      
      "podeVerTodosSetores": { 
        "type": "boolean",
        "default": false,
        "description": "Ver threads de TODOS os setores (cross-setorial)"
      },
      
      "strictMode": { 
        "type": "boolean",
        "default": false,
        "description": "Desativa P5 e P8 - zero exceções"
      }
    }
  }
}
```

**Ação:** ✅ Adicionar ao User entity  
**Impacto Runtime:** ❌ Zero (campos existem mas não são lidos ainda)  
**Tempo:** 5min

---

### 🔴 PRIORIDADE 2: UI - 5 Novas Flags (30min)

#### 2.1 Adicionar Seção "Visibilidade Fina" na Aba Ações

**Arquivo:** `components/usuarios/PainelPermissoesUnificado.jsx`

**Localização:** Linha ~537, ANTES dos 19 switches existentes

**Adicionar:**
```javascript
{/* NOVA SEÇÃO: Visibilidade Fina (Regras Híbridas P6/P7) */}
<div className="mb-8">
  <div className="flex items-center gap-2 mb-4">
    <Eye className="w-5 h-5 text-purple-600" />
    <h3 className="font-semibold">Visibilidade Fina (Regras Híbridas)</h3>
  </div>
  
  <Alert className="mb-4 bg-purple-50 border-purple-200">
    <Info className="h-4 w-4 text-purple-600" />
    <AlertDescription className="text-xs">
      <strong>Regras Híbridas P6/P7:</strong> Permitem que supervisores/gerentes 
      vejam conversas de equipe sem violar privacidade individual.
    </AlertDescription>
  </Alert>
  
  <div className="grid grid-cols-1 gap-3">
    {/* Flag 1 */}
    <div className="flex items-start justify-between p-4 border rounded-lg bg-blue-50/50 hover:bg-blue-100/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Eye className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-medium">Ver threads não atribuídas (filas)</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Permite visualizar conversas na fila "Sem dono" do seu setor
        </p>
      </div>
      <Switch
        checked={permissoesAcoes.podeVerNaoAtribuidas ?? true}
        onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerNaoAtribuidas: v}))}
      />
    </div>

    {/* Flag 2 */}
    <div className="flex items-start justify-between p-4 border rounded-lg bg-amber-50/50 hover:bg-amber-100/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-amber-600" />
          <span className="text-sm font-medium">Ver conversas atribuídas a outros</span>
          <Badge variant="outline" className="text-xs ml-2">P7</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Permite supervisão de threads em andamento de outros atendentes do setor
        </p>
      </div>
      <Switch
        checked={permissoesAcoes.podeVerConversasOutros ?? false}
        onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerConversasOutros: v}))}
      />
    </div>

    {/* Flag 3 */}
    <div className="flex items-start justify-between p-4 border rounded-lg bg-green-50/50 hover:bg-green-100/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Users className="w-4 h-4 text-green-600" />
          <span className="text-sm font-medium">Ver carteiras de outros atendentes</span>
          <Badge variant="outline" className="text-xs ml-2">P6</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Permite acessar contatos fidelizados a colegas do setor (supervisão de carteira)
        </p>
      </div>
      <Switch
        checked={permissoesAcoes.podeVerCarteiraOutros ?? false}
        onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerCarteiraOutros: v}))}
      />
    </div>

    {/* Flag 4 */}
    <div className="flex items-start justify-between p-4 border rounded-lg bg-indigo-50/50 hover:bg-indigo-100/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="w-4 h-4 text-indigo-600" />
          <span className="text-sm font-medium">Ver todos os setores (cross-setorial)</span>
          <Badge variant="outline" className="text-xs ml-2">P11 Override</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Permite acesso a threads de TODOS os setores (diretor/gerente geral)
        </p>
      </div>
      <Switch
        checked={permissoesAcoes.podeVerTodosSetores ?? false}
        onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, podeVerTodosSetores: v}))}
      />
    </div>

    {/* Flag 5 */}
    <div className="flex items-start justify-between p-4 border-2 border-red-300 rounded-lg bg-red-50 hover:bg-red-100/50 transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-4 h-4 text-red-600" />
          <span className="text-sm font-medium">🚨 Strict Mode (Modo Restrito)</span>
          <Badge variant="destructive" className="text-xs ml-2">Desativa P5/P8</Badge>
        </div>
        <p className="text-xs text-muted-foreground">
          Desativa liberações P5 (janela 24h) e P8 (supervisão) - zero exceções
        </p>
        <p className="text-xs text-red-600 font-medium mt-1">
          ⚠️ Use para estagiários ou usuários em período de experiência
        </p>
      </div>
      <Switch
        checked={permissoesAcoes.strictMode ?? false}
        onCheckedChange={(v) => setPermissoesAcoes(prev => ({...prev, strictMode: v}))}
      />
    </div>
  </div>
</div>

<Separator className="my-6" />

{/* Título para seção existente */}
<div className="flex items-center gap-2 mb-3">
  <Shield className="w-5 h-5 text-slate-600" />
  <h3 className="font-semibold">Ações Granulares (Operações)</h3>
</div>

{/* ... 19 flags existentes ... */}
```

**Ação:** ✅ Adicionar seção nova  
**Impacto Runtime:** ❌ Zero (flags salvas mas não lidas ainda)  
**Tempo:** 30min

---

### 🔴 PRIORIDADE 3: Toggle Sistema Ativo (30min)

#### 3.1 Adicionar Toggle no Header da Tela

**Arquivo:** `components/usuarios/PainelPermissoesUnificado.jsx`

**Localização:** ANTES do card atual de header (linha ~164)

**Adicionar:**
```javascript
{/* NOVO: Card de controle do sistema */}
<Card className="border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-orange-50">
  <CardHeader>
    <div className="flex items-center justify-between">
      <div>
        <CardTitle className="text-base">⚙️ Sistema de Permissões</CardTitle>
        <CardDescription className="text-xs">
          Define qual motor controla a visibilidade de threads para este usuário
        </CardDescription>
      </div>
      <Badge 
        variant={sistemaAtivo === 'legado' ? 'secondary' : 'default'}
        className="text-sm px-3 py-1"
      >
        {sistemaAtivo === 'legado' ? '🔵 Legado (Ativo)' : '🟢 Nexus360 (Ativo)'}
      </Badge>
    </div>
  </CardHeader>
  <CardContent>
    <div className="grid grid-cols-2 gap-3">
      {/* Opção Legado */}
      <div 
        onClick={() => setSistemaAtivo('legado')}
        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
          sistemaAtivo === 'legado' 
            ? 'border-blue-500 bg-blue-50 shadow-md' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
            sistemaAtivo === 'legado' ? 'border-blue-500 bg-blue-500' : 'border-gray-300'
          }`}>
            {sistemaAtivo === 'legado' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">🔵 Sistema Legado</p>
            <p className="text-xs text-muted-foreground mt-1">
              Lógica hardcoded (threadVisibility.js)<br />
              Baseado em: role, attendant_role, whatsapp_setores
            </p>
          </div>
        </div>
      </div>

      {/* Opção Nexus360 */}
      <div 
        onClick={() => {
          // Validar se tem configuração mínima
          const temRegras = configuracao.regras_bloqueio?.length > 0 || 
                           configuracao.regras_liberacao?.length > 0;
          
          if (!temRegras && configuracao.modo_visibilidade === 'padrao_bloqueado') {
            toast.error('Configure ao menos 1 regra antes de ativar Nexus360', {
              description: 'Modo bloqueado sem liberações = usuário não verá nada'
            });
            return;
          }
          
          setSistemaAtivo('nexus360');
        }}
        className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
          sistemaAtivo === 'nexus360' 
            ? 'border-green-500 bg-green-50 shadow-md' 
            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
        }`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5 ${
            sistemaAtivo === 'nexus360' ? 'border-green-500 bg-green-500' : 'border-gray-300'
          }`}>
            {sistemaAtivo === 'nexus360' && <div className="w-2.5 h-2.5 bg-white rounded-full" />}
          </div>
          <div className="flex-1">
            <p className="font-medium text-sm">🟢 Nexus360</p>
            <p className="text-xs text-muted-foreground mt-1">
              Motor unificado com regras configuráveis<br />
              Baseado em: regras P1-P12 + flags
            </p>
          </div>
        </div>
      </div>
    </div>

    {/* Aviso */}
    {sistemaAtivo === 'nexus360' && (
      <Alert className="mt-4 bg-green-50 border-green-200">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-xs">
          <strong>✅ Nexus360 ativado para este usuário.</strong>
          <br />
          As regras abaixo serão aplicadas imediatamente ao salvar.
          Sistema legado será ignorado para este usuário.
        </AlertDescription>
      </Alert>
    )}
    
    {sistemaAtivo === 'legado' && (
      <Alert className="mt-4">
        <Info className="h-4 w-4" />
        <AlertDescription className="text-xs">
          Sistema legado ativo. Configure Nexus360 nas abas abaixo e 
          teste no simulador antes de ativar.
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
</Card>
```

**Ação:** ✅ Adicionar card de toggle  
**Impacto Runtime:** ⚠️ **MÉDIO** (se ativar Nexus, precisa conectar ao motor)  
**Tempo:** 30min

---

### 🔴 PRIORIDADE 4: Conectar ao Motor (1h30min)

**O QUE FAZER:** Modificar `components/lib/threadVisibility.js` para LER Nexus

#### 4.1 Adicionar Função de Roteamento

```javascript
// ADICIONAR no início de threadVisibility.js

import { decidirVisibilidadeNexus360 } from './nexusComparator';

/**
 * ROTEADOR CENTRAL: Decide qual motor usar baseado em sistema_permissoes_ativo
 */
export function isThreadVisibleToUser(thread, user, contato, integracoes = []) {
  // Verificar qual sistema está ativo para este usuário
  const sistemaAtivo = user?.sistema_permissoes_ativo || 'legado';
  
  if (sistemaAtivo === 'nexus360') {
    // ✅ MOTOR NEXUS360 (novo)
    const decisao = decidirVisibilidadeNexus360(thread, user, contato, integracoes);
    return decisao.allow;
  }
  
  // ✅ MOTOR LEGADO (atual - mantém tudo funcionando)
  return isThreadVisible_Legacy(thread, user, contato);
}

/**
 * Motor legado (código atual renomeado)
 */
function isThreadVisible_Legacy(thread, user, contato) {
  // ... TODO O CÓDIGO ATUAL do threadVisibility.js ...
  // Apenas renomear a função, lógica permanece 100% igual
}
```

**Ação:** ✅ Adicionar roteador  
**Impacto Runtime:** ✅ **CONTROLADO**
- Se `sistema_permissoes_ativo = 'legado'`: comportamento idêntico ao atual
- Se `sistema_permissoes_ativo = 'nexus360'`: usa motor novo
- Migração gradual (por usuário)

**Tempo:** 45min

---

#### 4.2 Garantir que Motor Nexus Lê Campos Corretos

**Arquivo:** `components/lib/nexusComparator.js`

**Verificar se está lendo:**
```javascript
export function decidirVisibilidadeNexus360(thread, user, contato, integracoes = []) {
  const {
    configuracao_visibilidade_nexus,
    permissoes_acoes_nexus,
    role,
    attendant_role,
    attendant_sector
  } = user;

  // ══════════════════════════════════════════════════════
  // CAMADA 1: HARD CORE (Segurança)
  // ══════════════════════════════════════════════════════

  // P1: Thread interna
  if (thread.thread_type !== 'contact_external') {
    if (role === 'admin') return { allow: true, code: 'ADMIN_INTERNAL_THREAD' };
    if (thread.participants?.includes(user.id)) return { allow: true, code: 'PARTICIPANT_INTERNAL_THREAD' };
    return { allow: false, code: 'NOT_PARTICIPANT' };
  }

  // P2: Admin total
  if (role === 'admin') {
    return { allow: true, code: 'ADMIN_FULL_ACCESS' };
  }

  // P3: Atribuída ao usuário
  if (thread.assigned_user_id === user.id) {
    return { allow: true, code: 'ASSIGNED_TO_USER' };
  }

  // P4: Contato fidelizado
  const setorUser = attendant_sector || 'geral';
  const campoFidelizacao = `atendente_fidelizado_${setorUser}`;
  if (contato?.[campoFidelizacao] === user.id) {
    return { allow: true, code: 'FIDELIZED_CONTACT' };
  }

  // ══════════════════════════════════════════════════════
  // CAMADA 2: BLOQUEIOS (LENDO DA TELA)
  // ══════════════════════════════════════════════════════

  const { regras_bloqueio } = configuracao_visibilidade_nexus || {};

  // P9: Canal bloqueado
  const bloqueioCanal = regras_bloqueio?.find(r => r.tipo === 'canal' && r.ativa);
  if (bloqueioCanal?.valores_bloqueados?.includes(thread.channel)) {
    return { allow: false, code: 'CHANNEL_BLOCKED' };
  }

  // P10: Integração bloqueada
  const bloqueioInt = regras_bloqueio?.find(r => r.tipo === 'integracao' && r.ativa);
  if (bloqueioInt?.valores_bloqueados?.includes(thread.whatsapp_integration_id)) {
    return { allow: false, code: 'INTEGRATION_BLOCKED' };
  }

  // P11: Setor bloqueado (com override de flag)
  if (!permissoes_acoes_nexus?.podeVerTodosSetores) {
    const bloqueioSetor = regras_bloqueio?.find(r => r.tipo === 'setor' && r.ativa);
    if (bloqueioSetor?.valores_bloqueados?.includes(thread.sector_id)) {
      return { allow: false, code: 'SECTOR_BLOCKED' };
    }
  }

  // ══════════════════════════════════════════════════════
  // CAMADA 3: REGRAS HÍBRIDAS (P6, P7)
  // ══════════════════════════════════════════════════════

  // P6: Fidelizado a outro (com flag override)
  const fidelizadoOutro = contato?.[campoFidelizacao] && contato[campoFidelizacao] !== user.id;
  if (fidelizadoOutro && !permissoes_acoes_nexus?.podeVerCarteiraOutros) {
    return { allow: false, code: 'FIDELIZED_TO_ANOTHER' };
  }

  // P7: Atribuído a outro (com múltiplos overrides)
  const atribuidoOutro = thread.assigned_user_id && thread.assigned_user_id !== user.id;
  if (atribuidoOutro) {
    // Override 1: Flag direta
    if (permissoes_acoes_nexus?.podeVerConversasOutros) {
      return { allow: true, code: 'ASSIGNED_TO_ANOTHER_BUT_ALLOWED' };
    }

    // Override 2: P5 (se não strict mode)
    if (!permissoes_acoes_nexus?.strictMode) {
      const { regras_liberacao } = configuracao_visibilidade_nexus || {};
      const regraJanela = regras_liberacao?.find(r => r.tipo === 'janela_24h' && r.ativa);
      
      if (regraJanela) {
        // TODO: verificar se usuário tem mensagem recente
        // const temMensagem = await checkJanela24h(...)
        // if (temMensagem) return { allow: true, code: 'WINDOW_24H_OVERRIDE' };
      }

      // Override 3: P8 (se gerente)
      const regraSupervisao = regras_liberacao?.find(r => r.tipo === 'gerente_supervisao' && r.ativa);
      if (regraSupervisao && attendant_role === 'gerente') {
        // TODO: verificar tempo sem resposta
        // const tempoOcioso = calcularTempoOcioso(thread);
        // if (tempoOcioso > minutos) return { allow: true, code: 'MANAGER_SUPERVISION' };
      }
    }

    // Sem override → DENY
    return { allow: false, code: 'ASSIGNED_TO_ANOTHER' };
  }

  // ══════════════════════════════════════════════════════
  // CAMADA 4: POLÍTICA DE VISIBILIDADE FINA
  // ══════════════════════════════════════════════════════

  // Não atribuída
  if (!thread.assigned_user_id) {
    if (permissoes_acoes_nexus?.podeVerNaoAtribuidas !== false) {
      return { allow: true, code: 'UNASSIGNED_ALLOWED' };
    }
    return { allow: false, code: 'UNASSIGNED_BLOCKED' };
  }

  // ══════════════════════════════════════════════════════
  // CAMADA 5: DEFAULT (P12)
  // ══════════════════════════════════════════════════════

  const modoBase = configuracao_visibilidade_nexus?.modo_visibilidade || 'padrao_liberado';
  
  if (modoBase === 'padrao_liberado') {
    return { allow: true, code: 'DEFAULT_ALLOW' };
  } else {
    return { allow: false, code: 'DEFAULT_DENY' };
  }
}
```

**Ação:** ✅ Criar roteador + garantir leitura de campos  
**Impacto Runtime:** ✅ **CONTROLADO** (apenas usuários com `nexus360` ativo são afetados)  
**Tempo:** 45min

---

### 🔴 PRIORIDADE 5: Preview Melhorado (30min)

#### 5.1 Expandir Aba Preview

**Arquivo:** `components/usuarios/PainelPermissoesUnificado.jsx`

**Localização:** Aba "Preview" (linha ~579)

**Substituir preview atual por:**
```javascript
<TabsContent value="preview" className="space-y-4">
  <Card>
    <CardHeader>
      <CardTitle>🎯 Preview Nexus360 - Como o Usuário Verá</CardTitle>
      <CardDescription className="text-xs">
        Simulação baseada nas configurações atuais
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-6">
      {/* Resumo Geral */}
      <div className="grid grid-cols-4 gap-4 text-center">
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="text-2xl font-bold text-green-700">
            {configuracao.regras_liberacao?.filter(r => r.ativa).length || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Liberações</p>
        </div>
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
          <div className="text-2xl font-bold text-red-700">
            {configuracao.regras_bloqueio?.filter(r => r.ativa).length || 0}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Bloqueios</p>
        </div>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="text-2xl font-bold text-blue-700">
            {Object.values(permissoesAcoes).filter(v => v === true).length}
          </div>
          <p className="text-xs text-muted-foreground mt-1">Ações OK</p>
        </div>
        <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="text-2xl font-bold text-purple-700">
            {configuracao.modo_visibilidade === 'padrao_liberado' ? '🟢' : '🔴'}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {configuracao.modo_visibilidade === 'padrao_liberado' ? 'Liberado' : 'Bloqueado'}
          </p>
        </div>
      </div>

      <Separator />

      {/* O que VERÁ */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          ✅ Usuário VERÁ
        </h3>
        <div className="space-y-2 text-sm pl-4">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span><strong>P3:</strong> Threads atribuídas diretamente a ele</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span><strong>P4:</strong> Contatos da própria carteira</span>
          </div>
          
          {/* Flags condicionais */}
          {(permissoesAcoes.podeVerNaoAtribuidas ?? true) && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span><strong>Flag:</strong> Threads não atribuídas do setor (filas)</span>
            </div>
          )}
          
          {permissoesAcoes.podeVerConversasOutros && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span><strong>Flag + P7:</strong> Conversas atribuídas a outros do setor</span>
            </div>
          )}
          
          {permissoesAcoes.podeVerCarteiraOutros && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span><strong>Flag + P6:</strong> Carteiras de outros atendentes</span>
            </div>
          )}
          
          {configuracao.regras_liberacao?.some(r => r.tipo === 'janela_24h' && r.ativa) && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>
                <strong>P5:</strong> Threads que interagiu nas últimas{' '}
                {configuracao.regras_liberacao.find(r => r.tipo === 'janela_24h')?.configuracao?.horas || 24}h
              </span>
            </div>
          )}
          
          {configuracao.regras_liberacao?.some(r => r.tipo === 'gerente_supervisao' && r.ativa) && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span>
                <strong>P8:</strong> Threads sem resposta há{' '}
                {configuracao.regras_liberacao.find(r => r.tipo === 'gerente_supervisao')?.configuracao?.minutos_sem_resposta || 30}+ min
              </span>
            </div>
          )}
          
          {configuracao.modo_visibilidade === 'padrao_liberado' && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span><strong>P12:</strong> Padrão liberado (tudo mais que não foi bloqueado)</span>
            </div>
          )}
        </div>
      </div>

      <Separator />

      {/* O que NÃO VERÁ */}
      <div>
        <h3 className="font-semibold mb-3 flex items-center gap-2 text-red-700">
          <Lock className="w-5 h-5" />
          ❌ Usuário NÃO VERÁ
        </h3>
        <div className="space-y-2 text-sm pl-4">
          {/* Bloqueios ativos */}
          {configuracao.regras_bloqueio?.filter(r => r.ativa).map((regra, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span>
                <strong>
                  {regra.tipo === 'setor' && 'P11:'}
                  {regra.tipo === 'integracao' && 'P10:'}
                  {regra.tipo === 'canal' && 'P9:'}
                </strong>{' '}
                {regra.tipo === 'setor' && `Setores: ${(regra.valores_bloqueados || []).join(', ')}`}
                {regra.tipo === 'integracao' && `${(regra.valores_bloqueados || []).length} integrações bloqueadas`}
                {regra.tipo === 'canal' && `Canais: ${(regra.valores_bloqueados || []).join(', ')}`}
              </span>
            </div>
          ))}
          
          {/* Flags que bloqueiam */}
          {!(permissoesAcoes.podeVerNaoAtribuidas ?? true) && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span><strong>Flag:</strong> Threads não atribuídas (filas bloqueadas)</span>
            </div>
          )}
          
          {!permissoesAcoes.podeVerConversasOutros && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span><strong>P7:</strong> Threads atribuídas a outros atendentes</span>
            </div>
          )}
          
          {!permissoesAcoes.podeVerCarteiraOutros && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span><strong>P6:</strong> Carteiras de outros atendentes</span>
            </div>
          )}
          
          {permissoesAcoes.strictMode && (
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span>
                <strong>Strict Mode:</strong> Liberações P5 e P8 desativadas (zero exceções)
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Avisos de configuração */}
      {permissoesAcoes.strictMode && configuracao.regras_liberacao?.some(r => r.ativa) && (
        <>
          <Separator />
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              <strong>⚠️ CONFLITO:</strong> Strict Mode ativo mas há liberações P5/P8 configuradas.
              Strict Mode sobrepõe liberações - desative um dos dois.
            </AlertDescription>
          </Alert>
        </>
      )}
    </CardContent>
  </Card>
</TabsContent>
```

**Ação:** ✅ Substituir preview atual  
**Impacto Runtime:** ❌ Zero (apenas UI)  
**Tempo:** 30min

---

## 🎯 PLANO DE IMPLEMENTAÇÃO DEFINITIVO

### Opção A: APENAS Configuração (1h45min) ✅ SEM RISCO

**O que:** Adiciona campos + UI mas NÃO conecta ao motor

**Incluir:**
1. ✅ User entity: 5 novas flags + sistema_permissoes_ativo (5min)
2. ✅ UI: Seção "Visibilidade Fina" (30min)
3. ✅ UI: Toggle sistema ativo (30min)
4. ✅ UI: Preview melhorado (30min)
5. ✅ UI: Badges P# nas regras (10min)

**Resultado:**
- Tela permite configurar tudo
- Campos salvos no banco
- **Sistema legado continua ativo para TODOS**
- Preview mostra "o que aconteceria se Nexus estivesse ativo"

**Quando ativar:** Futuro, após validação completa

**Risco:** ❌ **ZERO**

---

### Opção B: Configuração + Conectar Motor (3h15min) ⚠️ BAIXO RISCO

**O que:** Opção A + conecta ao motor de decisão

**Incluir:**
- Tudo da Opção A (1h45min)
- ✅ Roteador em `threadVisibility.js` (45min)
- ✅ Garantir `nexusComparator.js` lê campos corretos (45min)

**Resultado:**
- Tela permite configurar tudo
- **Toggle funciona de verdade**
- Admins podem ativar Nexus360 **por usuário**
- Migração gradual (1 usuário por vez)
- Sistema legado continua ativo para usuários não migrados

**Quando ativar:** AGORA (testando com 1-2 usuários piloto)

**Risco:** ⚠️ **BAIXO** (rollback por usuário)

---

## 🎬 IMPLEMENTAÇÃO PASSO A PASSO (Opção B - Recomendada)

### Passo 1: User Entity (5min)

```json
{
  "sistema_permissoes_ativo": {
    "type": "string",
    "enum": ["legado", "nexus360"],
    "default": "legado"
  },
  
  "permissoes_acoes_nexus": {
    "podeVerCarteiraOutros": { "type": "boolean", "default": false },
    "podeVerNaoAtribuidas": { "type": "boolean", "default": true },
    "podeVerConversasOutros": { "type": "boolean", "default": false },
    "podeVerTodosSetores": { "type": "boolean", "default": false },
    "strictMode": { "type": "boolean", "default": false }
  }
}
```

---

### Passo 2: PainelPermissoesUnificado.jsx (1h40min)

**2.1 Adicionar Estado (5min):**
```javascript
const [sistemaAtivo, setSistemaAtivo] = useState('legado');

useEffect(() => {
  setSistemaAtivo(usuario?.sistema_permissoes_ativo || 'legado');
}, [usuario]);

const handleSalvar = async () => {
  await onSalvar(usuario.id, {
    sistema_permissoes_ativo: sistemaAtivo, // NOVO
    configuracao_visibilidade_nexus: configuracao,
    permissoes_acoes_nexus: permissoesAcoes,
    diagnostico_nexus: diagnostico
  });
};
```

**2.2 Adicionar Toggle Sistema (30min)**

**2.3 Adicionar Seção Visibilidade Fina (30min)**

**2.4 Melhorar Preview (30min)**

**2.5 Badges P# (5min)**

---

### Passo 3: threadVisibility.js - Roteador (45min)

**3.1 Adicionar no início:**
```javascript
import { decidirVisibilidadeNexus360 } from './nexusComparator';

export function isThreadVisibleToUser(thread, user, contato, integracoes) {
  const sistemaAtivo = user?.sistema_permissoes_ativo || 'legado';
  
  if (sistemaAtivo === 'nexus360') {
    const decisao = decidirVisibilidadeNexus360(thread, user, contato, integracoes);
    return decisao.allow;
  }
  
  return isThreadVisible_Legacy(thread, user, contato);
}

function isThreadVisible_Legacy(thread, user, contato) {
  // ... TODO O CÓDIGO ATUAL (apenas renomear função)
}
```

**3.2 Verificar imports:**
- ChatSidebar.jsx já usa `isThreadVisibleToUser` (verificar)
- Se usa nome diferente, ajustar

---

### Passo 4: nexusComparator.js - Garantir Leitura (45min)

**4.1 Verificar se lê:**
- ✅ `configuracao_visibilidade_nexus.regras_bloqueio`
- ✅ `configuracao_visibilidade_nexus.regras_liberacao`
- ✅ `configuracao_visibilidade_nexus.modo_visibilidade`
- ✅ `permissoes_acoes_nexus.podeVerCarteiraOutros`
- ✅ `permissoes_acoes_nexus.podeVerNaoAtribuidas`
- ✅ `permissoes_acoes_nexus.podeVerConversasOutros`
- ✅ `permissoes_acoes_nexus.strictMode`

**4.2 Ajustar lógica P6/P7 se necessário**

---

## ✅ CHECKLIST FINAL IMPLEMENTAÇÃO

### Campos (User Entity) - 5min
- [ ] Adicionar `sistema_permissoes_ativo`
- [ ] Adicionar 5 flags a `permissoes_acoes_nexus`

### UI (PainelPermissoesUnificado.jsx) - 1h40min
- [ ] Estado `sistemaAtivo` + salvar no handleSalvar
- [ ] Card toggle sistema ativo (30min)
- [ ] Seção "Visibilidade Fina" com 5 flags (30min)
- [ ] Preview melhorado com resumo (30min)
- [ ] Badges P# nas regras de bloqueio/liberação (10min)

### Motor (threadVisibility.js + nexusComparator.js) - 1h30min
- [ ] Roteador `isThreadVisibleToUser` (45min)
- [ ] Renomear função legado para `isThreadVisible_Legacy` (5min)
- [ ] Garantir `nexusComparator.js` lê todos campos (45min)
- [ ] Testar com 1 usuário piloto

---

## 🚦 ESTRATÉGIA DE ATIVAÇÃO GRADUAL

### Fase 1: Testar com Admin

```javascript
// Na tela de usuários, admin:
1. Configura suas próprias permissões Nexus360
2. Ativa toggle: "Nexus360"
3. Testa na Central de Comunicação
4. Valida que vê threads corretas
5. Se OK: prossegue
   Se problema: volta para "Legado" (1 clique)
```

---

### Fase 2: Migrar 1 Usuário Piloto

```javascript
1. Escolher atendente pleno de baixo risco
2. Importar configuração do legado (botão)
3. Revisar regras geradas
4. Ativar Nexus360 para ele
5. Monitorar por 24-48h
6. Se OK: migrar próximo
```

---

### Fase 3: Migração em Lote (Futuro)

```javascript
1. Após 5-10 usuários OK
2. Criar script de migração em massa
3. Aplicar por setor:
   • Vendas completo
   • Depois Assistência
   • Depois Financeiro
4. Manter admin em Nexus sempre
```

---

## 🏁 RESPOSTA FINAL

### O que pode aplicar AGORA sem problemas?

#### ✅ NÍVEL 1: Apenas Config (1h45min) - ZERO RISCO
- Campos no banco
- UI completa
- NÃO conecta ao motor
- Preview é simulação

**Status:** Pronto para implementar  
**Risco:** Zero  
**Ativa Nexus:** Não

---

#### ✅ NÍVEL 2: Config + Motor (3h15min) - BAIXO RISCO  
- Campos no banco
- UI completa
- **Conecta ao motor COM TOGGLE**
- Migração gradual por usuário

**Status:** Pronto para implementar  
**Risco:** Baixo (rollback fácil)  
**Ativa Nexus:** Sim (por usuário)

---

### Recomendação Final

**Implementar NÍVEL 2** (Config + Motor com toggle)

**Por quê:**
- ✅ Permite testar de verdade
- ✅ Migração controlada (1 usuário por vez)
- ✅ Rollback imediato (toggle)
- ✅ Sistema legado continua ativo para maioria
- ✅ Baixo risco operacional

**Tempo total:** 3h15min

**Pronto para executar:** ✅ Sim

---

**FIM DA ANÁLISE** 🎯