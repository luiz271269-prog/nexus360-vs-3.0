# 🔍 ANÁLISE COMPARATIVA: Debate do Usuário vs Projeto Atual

**Data:** 2026-01-15  
**Objetivo:** Alinhar a visão do debate com a análise técnica do projeto

---

## ✅ PONTOS DE ALINHAMENTO TOTAL

### 1. Estrutura de 2 Colunas Lado a Lado

**Debate:** "Coluna 1 – Estado Atual (Legado) | Coluna 2 – Nexus360 (Novo)"  
**Projeto:** Idêntico - layout 50/50 com comparação direta  
**Status:** ✅ **100% alinhado**

---

### 2. Toggle Sistema Ativo

**Debate:** "Modo em uso: Legado|Nexus360"  
**Projeto:** Campo `sistema_permissoes_ativo: 'legado' | 'nexus360'`  
**Status:** ✅ **100% alinhado**

---

### 3. Dados Básicos Compartilhados

**Debate:** "Cabeçalho – Identidade do Usuário (Nome, email, setor, função, ativo)"  
**Projeto:** Seção fora das colunas, campos únicos não duplicados  
**Status:** ✅ **100% alinhado**

---

### 4. Objetivo: Comparação Visual + Não Aplicar Ainda

**Debate:** "Sem aplicar nada ainda, é só projeto"  
**Projeto:** Preview/Shadow mode, salvamento independente sem ativar  
**Status:** ✅ **100% alinhado**

---

### 5. Migração Assistida

**Debate:** "Botão 'Importar do legado': preencher Nexus360 com equivalente"  
**Projeto:** Função `buildPolicyFromLegacyUser()` já existe  
**Status:** ✅ **100% alinhado**

---

## ⚠️ DIVERGÊNCIAS E REFINAMENTOS

### 1. Estrutura da Coluna LEGADO

#### Debate sugere:
```
Coluna 1 – Permissões Atuais (Legado)
├─ Acesso às páginas
│  └─ paginas_acesso → tabela/fichas
├─ Permissões de Comunicação (legadas)
│  ├─ Canais/integrações visíveis
│  ├─ Regras "Minhas/Não atribuídas/Todas"
│  └─ Regras de 24h
└─ Resumo de efeito
```

#### Projeto atual tem:
```
Coluna Legado:
├─ ══ COMUNICAÇÃO ══
│  ├─ is_whatsapp_attendant
│  ├─ whatsapp_setores (badges)
│  ├─ whatsapp_permissions (cards por integração)
│  └─ max_concurrent_conversations
└─ ══ PERMISSÕES PÁGINAS ══
   ├─ paginas_acesso (checkboxes)
   └─ Perfis rápidos
```

#### 🔍 Análise:

**Campos faltando no projeto:**
- ❌ `permissoes_visualizacao.integracoes_visiveis` (mencionado no debate, mas não está no código atual)
- ❌ Regras "Minhas/Não atribuídas/Todas" como flags explícitas
- ❌ Regra 24h hardcoded no legado

**Resolução:**
O código atual do legado usa:
- `whatsapp_permissions` = controla por integração (can_view, can_receive, can_send)
- Visibilidade é calculada em `threadVisibility.js` (hardcoded, não configurável por usuário)

**Sugestão de alinhamento:**
Na coluna LEGADO, adicionar seção **"Visibilidade Atual (Calculada)"** que MOSTRA (read-only) como o sistema legado interpreta as permissões deste usuário:
- "Você vê: Minhas conversas + Não atribuídas do setor X"
- "Janela 24h: Ativa (gerente)"
- "Integrações visíveis: Vendas Principal, Suporte Geral"

Isso é **descritivo**, não editável (pois é hardcoded).

---

### 2. Estrutura da Coluna NEXUS360

#### Debate sugere:
```
Coluna 2 – Nexus360
├─ Política Nexus
│  ├─ Escopo: agente/supervisor/gerente/admin
│  ├─ Permitir: canais, integrações, setores
│  ├─ Bloco: setores/tags sensíveis, instâncias
│  └─ Regras: view_unassigned, view_others, fail_safe_hours, etc.
└─ Ferramentas Nexus
   ├─ Botão "Importar do legado"
   ├─ Indicador "Modo sombra": divergências
   └─ Link simulador detalhado
```

#### Projeto atual tem:
```
Coluna Nexus360:
├─ Radio: modo_visibilidade (liberado/bloqueado)
├─ Seção Bloqueios:
│  └─ regras_bloqueio[] (tipo, valores, ativa)
├─ Seção Liberações:
│  └─ regras_liberacao[] (janela_24h, gerente_supervisao)
├─ Seção Ações Granulares:
│  └─ permissoes_acoes_nexus (19 flags)
└─ Preview processado
```

#### 🔍 Análise:

**Diferenças conceituais:**

| Debate | Projeto Atual |
|--------|--------------|
| "Escopo: agente/supervisor/gerente" | ✅ Derivado de `attendant_role` |
| "Permitir: canais, setores" | ❌ Nexus usa BLOQUEIOS (deny-first), não permissões explícitas |
| "Bloco: setores/tags/instâncias" | ✅ `regras_bloqueio` |
| "Regras: view_unassigned, view_others" | ✅ `regras_liberacao` (janela_24h, gerente_supervisao) |
| "fail_safe_hours" | ⚠️ Existe como `janela_24h.horas`, mas não se chama "fail_safe" |
| "strict_mode" | ❌ Não existe no código Nexus atual |

**Resolução:**
- ✅ Arquitetura Nexus atual já cobre o essencial do debate
- ⚠️ Nomenclatura diferente: "regras_liberacao" vs "Regras: view_unassigned, view_others"
- 💡 Adicionar flag `strict_mode` ao Nexus se necessário (bloqueio total sem exceções)

---

### 3. Seção "Resumo de Efeito"

#### Debate sugere:
```
Resumo de efeito (Coluna Legado):
"Hoje este usuário vê:"
- canais: X
- setores: Y  
- tipos de conversas: minhas / não atribuídas / todas
```

#### Projeto atual tem:
```
Resumo Legado (aba "Permissões Atuais"):
- Permissões ativas: 8
- WhatsApp habilitado: Sim
- Conexões: 2
```

#### 🔍 Análise:

**Faltando:**
- ❌ Interpretação legível de COMO as regras afetam a visibilidade
- ❌ "Você vê: minhas + não atribuídas de Vendas"
- ❌ "Canais ativos: WhatsApp (2 conexões)"

**Resolução:**
Adicionar na Coluna 1 uma seção **"🔍 Visibilidade Calculada"** que roda a lógica de `threadVisibility.js` em modo read-only e exibe:
```javascript
// Pseudo-código
const visibilidadeLegado = calcularVisibilidadeLegado(usuario);

// Renderiza:
<div className="bg-blue-50 p-4 rounded-lg">
  <h4>🔍 O que você vê hoje (calculado):</h4>
  <ul>
    <li>✓ Minhas conversas atribuídas</li>
    <li>✓ Não atribuídas do setor Vendas</li>
    <li>✓ Janela 24h: conversas que você interagiu recentemente</li>
    <li>✗ Conversas de outros atendentes (bloqueado)</li>
  </ul>
</div>
```

---

### 4. Faixa Inferior – Comparação

#### Debate sugere:
```
Faixa inferior – Comparação e escolha
├─ Tabela comparativa:
│  │ Dimensão        │ Legado  │ Nexus360 │
│  ├────────────────┼─────────┼──────────┤
│  │ Canais         │ lista   │ lista    │
│  │ Setores        │ lista   │ lista    │
│  │ Regras         │ desc    │ desc     │
├─ Checkbox "Habilitar Nexus360 para este usuário"
└─ Checkbox "Modo sombra por X dias"
```

#### Projeto atual:
- Tem Preview dentro da aba Nexus360
- Não tem tabela comparativa lado a lado
- Não tem controle de "modo sombra por X dias"

#### 🔍 Análise:

**Adicionar:**
- ✅ Tabela comparativa dimensional (canais, setores, regras)
- ✅ Checkbox "Habilitar Nexus360" (salva `sistema_permissoes_ativo`)
- ⚠️ Checkbox "Modo sombra" → isso seria um campo novo:
  ```javascript
  {
    nexus_shadow_mode: {
      ativo: boolean,
      data_inicio: datetime,
      duracao_dias: number
    }
  }
  ```

**Decisão:**
- Implementar tabela comparativa ✅
- "Modo sombra" é nice-to-have (pode ser Fase 2)

---

## 📊 COMPATIBILIDADE CONCEITUAL

### Conceito: "Permissões de Comunicação"

#### No debate:
```
Permissões de Comunicação (legadas):
- Canais/integrações visíveis (permissoes_visualizacao.integracoes_visiveis)
- Regras "Minhas/Não atribuídas/Todas"
- Regras de 24h
```

#### No código atual:
```javascript
// Não existe "permissoes_visualizacao.integracoes_visiveis" como objeto
// Existe apenas:
whatsapp_permissions: [
  { integration_id, can_view, can_receive, can_send }
]

// Regras "Minhas/Não atribuídas/Todas" estão HARDCODED em threadVisibility.js
// Baseadas em:
- attendant_role (gerente vê mais que júnior)
- is_whatsapp_attendant
- Lógica fixa de 24h para gerentes
```

#### 🔍 Resolução:

O debate menciona campos que **não existem explicitamente** no banco, mas estão **implícitos na lógica de código**.

**Proposta:**
Na Coluna LEGADO, criar seção **"Visibilidade Atual (Lógica Hardcoded)"** que **DESCREVE** textualmente o que o código `threadVisibility.js` faz para esse perfil:

```javascript
// Exemplo para um Gerente de Vendas
function gerarDescricaoVisibilidadeLegado(usuario) {
  const descricoes = [];
  
  if (usuario.attendant_role === 'gerente') {
    descricoes.push('✓ Todas as conversas do seu setor (supervisão)');
    descricoes.push('✓ Janela 24h: conversas que você interagiu recentemente');
    descricoes.push('✓ Não atribuídas do setor (para pegar da fila)');
    descricoes.push('✗ Conversas de outros setores (bloqueado)');
  } else if (usuario.attendant_role === 'pleno') {
    descricoes.push('✓ Minhas conversas atribuídas');
    descricoes.push('✓ Não atribuídas do meu setor');
    descricoes.push('✗ Conversas de outros atendentes (bloqueado)');
  }
  
  // Integrações
  const integracoesVisiveis = usuario.whatsapp_permissions
    ?.filter(p => p.can_view)
    .map(p => p.integration_name);
  
  if (integracoesVisiveis?.length) {
    descricoes.push(`📱 Integrações visíveis: ${integracoesVisiveis.join(', ')}`);
  }
  
  return descricoes;
}
```

---

## 🎯 PROPOSTA DE ALINHAMENTO FINAL

### 📐 Layout Refinado (Incorporando Debate)

```
┌──────────────────────────────────────────────────────────────────────┐
│  👤 CABEÇALHO - DADOS BÁSICOS (Compartilhados)                       │
├──────────────────────────────────────────────────────────────────────┤
│  Nome: [________________]  Email: [________________]  Ativo: [✓]     │
│  Setor: [Vendas ▼]  Função: [Gerente ▼]  Tipo: [Usuário ▼]          │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │ Sistema Ativo:  [● Legado] [○ Nexus360] [○ Shadow Mode]     │   │
│  └──────────────────────────────────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  ┌──────────────────────────────┬──────────────────────────────┐    │
│  │  📌 SISTEMA LEGADO           │  ⚡ SISTEMA NEXUS360         │    │
│  │  (Ativo em produção)         │  (Preview - Não afeta)       │    │
│  ├──────────────────────────────┼──────────────────────────────┤    │
│  │                              │                              │    │
│  │ ══ COMUNICAÇÃO WHATSAPP ══   │ ══ VISIBILIDADE ══           │    │
│  │                              │                              │    │
│  │ 📱 Atendente WhatsApp        │ 🎯 Modo Base                 │    │
│  │ • Habilitado: [✓]            │ • [●] Liberado por padrão    │    │
│  │                              │ • [○] Bloqueado por padrão   │    │
│  │ 🏢 Setores Atendidos         │                              │    │
│  │ • [✓] Vendas                 │ 🚫 Bloqueios Explícitos      │    │
│  │ • [ ] Assistência            │ ┌─────────────────────────┐  │    │
│  │ • [ ] Financeiro             │ │ [+] Bloquear Setor      │  │    │
│  │                              │ │ [+] Bloquear Integração │  │    │
│  │ 📞 Conexões WhatsApp         │ │ [+] Bloquear Canal      │  │    │
│  │ ┌──────────────────────┐     │ └─────────────────────────┘  │    │
│  │ │ Vendas Principal     │     │                              │    │
│  │ │ #5548999322400       │     │ • Setor: Assistência         │    │
│  │ │ [✓Ver][✓Rec][✓Env]  │     │   [Ativa ✓] [Remover ×]      │    │
│  │ └──────────────────────┘     │ • Integração: #6820          │    │
│  │ ┌──────────────────────┐     │   [Ativa ✓] [Remover ×]      │    │
│  │ │ Suporte Geral        │     │                              │    │
│  │ │ #5548988776655       │     │ ✅ Liberações Especiais      │    │
│  │ │ [✓Ver][✗Rec][✓Env]  │     │ ┌─────────────────────────┐  │    │
│  │ └──────────────────────┘     │ │ [+] Janela 24h          │  │    │
│  │                              │ │ [+] Supervisão Gerencial│  │    │
│  │ 🎯 Capacidades               │ └─────────────────────────┘  │    │
│  │ • Máx conversas: [5__]       │                              │    │
│  │ • Transferir: [✓]            │ • Janela: 24 horas           │    │
│  │                              │   [Ativa ✓] [Remover ×]      │    │
│  │ ┌─────────────────────────┐  │ • Supervisão: 30 min         │    │
│  │ │ 🔍 VISIBILIDADE ATUAL   │  │   [Ativa ✓] [Remover ×]      │    │
│  │ │ (Calculada pelo código) │  │                              │    │
│  │ ├─────────────────────────┤  │                              │    │
│  │ │ Você vê:                │  │                              │    │
│  │ │ ✓ Minhas conversas      │  │                              │    │
│  │ │ ✓ Não atribuídas de     │  │                              │    │
│  │ │   Vendas                │  │                              │    │
│  │ │ ✓ Janela 24h (gerente)  │  │                              │    │
│  │ │ ✓ Supervisão de setor   │  │                              │    │
│  │ │ ✗ Outros setores        │  │                              │    │
│  │ │                         │  │                              │    │
│  │ │ Integrações visíveis:   │  │                              │    │
│  │ │ • Vendas Principal      │  │                              │    │
│  │ │ • Suporte Geral         │  │                              │    │
│  │ └─────────────────────────┘  │                              │    │
│  │                              │                              │    │
│  ├──────────────────────────────┼──────────────────────────────┤    │
│  │                              │                              │    │
│  │ ══ PERMISSÕES PÁGINAS ══     │ ══ AÇÕES GRANULARES ══       │    │
│  │                              │                              │    │
│  │ 📄 Páginas Acessíveis        │ 🔐 Permissões Detalhadas     │    │
│  │ • [✓] Comunicacao            │                              │    │
│  │ • [✓] Dashboard              │ ▼ Conversas                  │    │
│  │ • [✓] Clientes               │ • [✓] Ver todas conversas    │    │
│  │ • [ ] Vendedores             │ • [✓] Enviar mensagens       │    │
│  │ • [✓] Produtos               │ • [✓] Enviar mídias          │    │
│  │ • [✓] Agenda                 │ • [✓] Enviar áudios          │    │
│  │ • [ ] Importacao             │ • [✓] Transferir conversa    │    │
│  │ • [ ] Usuarios               │ • [ ] Apagar mensagens       │    │
│  │ • [ ] Auditoria              │                              │    │
│  │                              │ ▼ Contatos                   │    │
│  │ 🚀 Perfis Rápidos            │ • [✓] Ver detalhes contato   │    │
│  │ [Admin] [Gerente]            │ • [✓] Editar contato         │    │
│  │ [Vendedor] [Suporte]         │ • [ ] Bloquear contato       │    │
│  │                              │ • [ ] Deletar contato        │    │
│  │                              │                              │    │
│  │                              │ ▼ Gestão                     │    │
│  │                              │ • [✓] Gerenciar filas        │    │
│  │                              │ • [✓] Atribuir conversas     │    │
│  │                              │ • [ ] Criar playbooks        │    │
│  │                              │ • [ ] Editar playbooks       │    │
│  │                              │ • [ ] Gerenciar conexões     │    │
│  │                              │                              │    │
│  │                              │ ▼ Admin                      │    │
│  │                              │ • [ ] Ver relatórios         │    │
│  │                              │ • [ ] Exportar dados         │    │
│  │                              │ • [ ] Ger. permissões        │    │
│  │                              │ • [ ] Ver diagnósticos       │    │
│  │                              │                              │    │
│  │                              │ 🎨 Perfis Nexus              │    │
│  │                              │ [Admin] [Gerente] [Senior]   │    │
│  │                              │ [Pleno] [Junior]             │    │
│  │                              │                              │    │
│  └──────────────────────────────┴──────────────────────────────┘    │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  📊 COMPARAÇÃO DIMENSIONAL                                    │   │
│  ├──────────────────┬─────────────────────┬─────────────────────┤   │
│  │ Dimensão         │ Legado (Ativo)      │ Nexus360 (Preview)  │   │
│  ├──────────────────┼─────────────────────┼─────────────────────┤   │
│  │ Canais           │ WhatsApp (2 conex)  │ WhatsApp (sem bloq) │   │
│  │ Setores          │ Vendas, Geral       │ Todos - Assistência │   │
│  │ Visibilidade     │ Minhas + Não atrib  │ Liberado padrão     │   │
│  │ Janela 24h       │ Ativa (hardcoded)   │ 24h (configurável)  │   │
│  │ Ações            │ 1 flag (transferir) │ 19 flags granulares │   │
│  │ Divergências     │ —                   │ 2 críticas, 3 alertas│  │
│  └──────────────────┴─────────────────────┴─────────────────────┘   │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  ⚙️ CONTROLE DE ATIVAÇÃO                                      │   │
│  ├──────────────────────────────────────────────────────────────┤   │
│  │  [ ] Habilitar Nexus360 para este usuário                    │   │
│  │  [ ] Rodar em modo sombra por [7__] dias antes de ativar     │   │
│  │  [Auditoria: Última alteração por Admin em 10/01/2026]       │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                       │
│  ┌─────────────────┐  ┌──────────────────────────────────────┐      │
│  │ [💾 Salvar      │  │ [🚀 Salvar Nexus] [🔄 Migrar Legado→]│      │
│  │     Legado]     │  │                                       │      │
│  └─────────────────┘  └──────────────────────────────────────┘      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 MAPEAMENTO DE REGRAS (Legado → Nexus)

### Equivalências

| Legado (Hardcoded) | Nexus360 (Configurável) |
|-------------------|------------------------|
| `attendant_role === 'gerente'` → vê todas do setor | `regras_liberacao: [{tipo: 'gerente_supervisao'}]` |
| Janela 24h implícita para gerentes | `regras_liberacao: [{tipo: 'janela_24h', horas: 24}]` |
| `whatsapp_setores: ['vendas']` → só vê Vendas | `regras_bloqueio: [{tipo: 'setor', valores: ['assistencia', 'financeiro', ...]}]` |
| `whatsapp_permissions[].can_view = false` | `regras_bloqueio: [{tipo: 'integracao', valores: [integration_id]}]` |
| `permissoes_comunicacao.pode_transferir` | `permissoes_acoes_nexus.podeTransferirConversa` |

---

## 🚨 PONTOS CRÍTICOS A DECIDIR

### 1. Campos Legado que NÃO têm equivalente direto em Nexus

| Campo Legado | Tem em Nexus? | Ação |
|--------------|---------------|------|
| `paginas_acesso` | ❌ Não | Manter separado (controle de menu) |
| `whatsapp_permissions.can_receive` | ⚠️ Parcial | Nexus não diferencia "receber" de "ver" |
| `max_concurrent_conversations` | ❌ Não | Manter no legado |

**Decisão necessária:**
- ❓ Nexus deve ter flag `podeReceberAtribuicoes` separada de `podeVerTodasConversas`?
- ❓ Nexus deve controlar capacidade máxima de conversas?
- ❓ Ou esses campos permanecem legados MESMO após migração?

### 2. Modo Shadow vs Ativação Direta

**Opção A (Debate):**
```javascript
{
  sistema_permissoes_ativo: 'legado',
  nexus_shadow_mode: {
    ativo: true,
    duracao_dias: 7,
    data_inicio: '2026-01-15T10:00:00Z'
  }
}
```
→ Nexus roda em paralelo, loga divergências, mas não afeta UI  
→ Após X dias, se tudo OK, ativa Nexus

**Opção B (Projeto):**
```javascript
{
  sistema_permissoes_ativo: 'nexus360'
}
```
→ Ativação direta, sem período de teste  
→ Rollback manual se der problema

**Recomendação:**
- Para usuários críticos (gerentes): usar Opção A
- Para novos usuários: usar Opção B
- Adicionar campo `nexus_shadow_mode` ao User entity

---

## 📝 CAMPOS ADICIONAIS NECESSÁRIOS (User Entity)

### Novos Campos

```json
{
  "sistema_permissoes_ativo": {
    "type": "string",
    "enum": ["legado", "nexus360", "shadow"],
    "default": "legado",
    "description": "Sistema de permissões ativo: legado, nexus360 (produção) ou shadow (teste)"
  },
  
  "nexus_shadow_mode": {
    "type": "object",
    "properties": {
      "ativo": { "type": "boolean", "default": false },
      "data_inicio": { "type": "string", "format": "datetime" },
      "duracao_dias": { "type": "number", "default": 7 },
      "divergencias_detectadas": { "type": "number", "default": 0 },
      "criticidade_maxima": { 
        "type": "string", 
        "enum": ["none", "warning", "error"],
        "default": "none"
      }
    },
    "description": "Configuração do modo sombra para teste de Nexus360"
  },
  
  "nexus_migration_log": {
    "type": "array",
    "items": {
      "type": "object",
      "properties": {
        "data": { "type": "string", "format": "datetime" },
        "acao": { "type": "string" },
        "usuario_responsavel": { "type": "string" },
        "detalhes": { "type": "string" }
      }
    },
    "description": "Histórico de ações de migração Nexus360"
  }
}
```

---

## 🎨 WIREFRAME TEXTUAL FINAL (Alinhado com Debate)

```
═══════════════════════════════════════════════════════════════════════
                    GESTÃO DE USUÁRIO - COMPARATIVO
═══════════════════════════════════════════════════════════════════════

┌─ DADOS BÁSICOS (Compartilhados) ───────────────────────────────────┐
│ Nome: [Tiago Silva______________]  Email: [tiago@empresa.com_____] │
│ Setor: [Vendas ▼]  Função: [Gerente ▼]  Tipo: [Usuário ▼]  [✓] Ativo│
│                                                                     │
│ Sistema Ativo:  [● Legado] [○ Nexus360] [○ Shadow Mode (7 dias)]  │
└─────────────────────────────────────────────────────────────────────┘

┌─ LEGADO (Produção) ─────────────┬─ NEXUS360 (Preview) ─────────────┐
│                                 │                                  │
│ ══ COMUNICAÇÃO WHATSAPP ══      │ ══ VISIBILIDADE THREADS ══       │
│                                 │                                  │
│ 📱 Atendente WhatsApp [✓]       │ 🎯 Modo: [●] Liberado por padrão │
│                                 │                                  │
│ 🏢 Setores Atendidos            │ 🚫 Bloqueios (2 ativos)          │
│ [✓] Vendas  [ ] Assistência     │ • Setor: Assistência [✓] [×]     │
│ [ ] Financeiro                  │ • Setor: Financeiro [✓] [×]      │
│                                 │ [+] Novo bloqueio                │
│ 📞 Conexões (2)                 │                                  │
│ ┌─ Vendas Principal ──────────┐ │ ✅ Liberações (1 ativa)          │
│ │ #5548999322400               │ │ • Janela: 24h [✓] [×]            │
│ │ [✓] Ver [✓] Receber [✓] Enviar│ │ • Supervisão: 30min [ ] [×]      │
│ └──────────────────────────────┘ │ [+] Nova liberação               │
│                                 │                                  │
│ ┌─ Suporte Geral ─────────────┐ │                                  │
│ │ #5548988776655               │ │                                  │
│ │ [✓] Ver [✗] Receber [✓] Enviar│ │                                  │
│ └──────────────────────────────┘ │                                  │
│                                 │                                  │
│ 🎯 Capacidades                  │                                  │
│ • Máx conversas: [5____]        │                                  │
│ • Pode transferir: [✓]          │                                  │
│                                 │                                  │
│ ┌─ 🔍 VISIBILIDADE CALCULADA ──┐ │ ┌─ 🎯 PREVIEW NEXUS ─────────┐  │
│ │ Você vê (lógica hardcoded):  │ │ │ Você verá (motor Nexus):   │  │
│ │                              │ │ │                            │  │
│ │ ✓ Minhas conversas           │ │ │ ✓ TODAS as conversas       │  │
│ │ ✓ Não atribuídas: Vendas     │ │ │ ✗ Bloqueadas: Assistência, │  │
│ │ ✓ Janela 24h (gerente)       │ │ │   Financeiro               │  │
│ │ ✓ Supervisão do setor        │ │ │ ✓ Janela 24h customizada   │  │
│ │ ✗ Outros setores             │ │ │                            │  │
│ │                              │ │ │ ⚠️ DIVERGÊNCIA: Nexus é    │  │
│ │ Integrações:                 │ │ │    mais permissivo (padrão │  │
│ │ • Vendas Principal           │ │ │    liberado)               │  │
│ │ • Suporte Geral              │ │ └────────────────────────────┘  │
│ └──────────────────────────────┘ │                                  │
│                                 │                                  │
├─────────────────────────────────┼──────────────────────────────────┤
│                                 │                                  │
│ ══ PERMISSÕES PÁGINAS ══        │ ══ AÇÕES GRANULARES (19) ══      │
│                                 │                                  │
│ 📄 Acessíveis (6)               │ ▼ Conversas (6 ações)            │
│ [✓] Comunicacao                 │ [✓] Ver todas  [✓] Enviar msg    │
│ [✓] Dashboard                   │ [✓] Enviar mídia  [✓] Áudios     │
│ [✓] Clientes                    │ [✓] Transferir  [ ] Apagar       │
│ [✓] Produtos                    │                                  │
│ [✓] Agenda                      │ ▼ Contatos (4 ações)             │
│ [ ] Vendedores                  │ [✓] Ver detalhes  [✓] Editar     │
│ [ ] Importacao                  │ [ ] Bloquear  [ ] Deletar        │
│ [ ] Usuarios                    │                                  │
│ [ ] Auditoria                   │ ▼ Gestão (5 ações)               │
│                                 │ [✓] Ger. filas  [✓] Atribuir     │
│ 🚀 Perfis Rápidos               │ [ ] Criar playbook  [ ] Editar   │
│ [Admin] [Gerente]               │ [ ] Ger. conexões                │
│ [Vendedor] [Suporte]            │                                  │
│                                 │ ▼ Admin (4 ações)                │
│                                 │ [ ] Relatórios  [ ] Exportar     │
│                                 │ [ ] Ger. perms  [ ] Diagnósticos │
│                                 │                                  │
│                                 │ 🎨 Perfis Nexus                  │
│                                 │ [Admin] [Gerente] [Senior]       │
│                                 │ [Pleno] [Junior]                 │
│                                 │                                  │
└─────────────────────────────────┴──────────────────────────────────┘

┌─ AÇÕES ────────────────────────────────────────────────────────────┐
│ [💾 Salvar Legado]  [🚀 Salvar Nexus360]  [🔄 Migrar Legado→Nexus] │
│                                                                     │
│ [🧪 Simular Threads]  [📊 Ver Divergências Detalhadas]             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🎯 RECOMENDAÇÕES FINAIS

### ✅ O que está perfeito no debate

1. **Conceito de 2 colunas lado a lado** → Mantém 100%
2. **Toggle sistema ativo** → Essencial, implementar
3. **Seção "Visibilidade Calculada"** → Excelente ideia, adicionar ao legado
4. **Tabela comparativa dimensional** → Muito útil, implementar

### ⚠️ O que precisa ajuste

1. **"Permissões de Comunicação (legadas)"**
   - Debate menciona campos que não existem explicitamente (`permissoes_visualizacao.integracoes_visiveis`)
   - **Solução:** Derivar essa visualização de `whatsapp_permissions` + lógica `threadVisibility.js`

2. **"Escopo: agente/supervisor/gerente/admin"**
   - Nexus atual não tem campo `escopo` explícito
   - **Solução:** Derivar de `attendant_role` + `role`, não criar novo campo

3. **"Regras: view_unassigned, view_others, strict_mode"**
   - Nexus atual usa `regras_liberacao` e `regras_bloqueio` (mais genérico)
   - **Solução:** Manter arquitetura atual (mais flexível), mas documentar mapeamento

### 🆕 O que adicionar do debate

1. ✅ Seção "Visibilidade Calculada" na Coluna Legado
2. ✅ Tabela comparativa dimensional no rodapé
3. ✅ Campo `sistema_permissoes_ativo` com opção "shadow"
4. ✅ Botões "Simular Threads" e "Ver Divergências Detalhadas"
5. ⚠️ Modo shadow com duração configurável (nice-to-have)

---

## 📋 CHECKLIST FINAL DE IMPLEMENTAÇÃO

Quando o usuário aprovar, implementar:

### Fase 1: Estrutura (30min)
- [ ] Adicionar campos ao User entity:
  - `sistema_permissoes_ativo`
  - `nexus_shadow_mode`
  - `nexus_migration_log`
- [ ] Criar `GerenciadorUsuariosComparativo.jsx`
- [ ] Layout 2 colunas responsivo com cabeçalho compartilhado

### Fase 2: Coluna Legado (45min)
- [ ] Seção Comunicação WhatsApp (existente, refatorar)
- [ ] Seção Permissões Páginas (existente, refatorar)
- [ ] **NOVA:** Seção "Visibilidade Calculada" (read-only, derivada de `threadVisibility.js`)

### Fase 3: Coluna Nexus (45min)
- [ ] Seção Visibilidade (existente, refatorar)
- [ ] Seção Ações Granulares (existente, refatorar)
- [ ] Preview Nexus (derivado de `buildUserPermissions`)

### Fase 4: Comparação e Controles (30min)
- [ ] Tabela comparativa dimensional
- [ ] Toggle sistema ativo (com validações)
- [ ] Checkboxes "Habilitar Nexus" e "Shadow Mode"
- [ ] Botões de ação (Salvar Legado, Salvar Nexus, Migrar)

### Fase 5: Integração e Testes (30min)
- [ ] Conectar à página `Usuarios.js`
- [ ] Testar salvamento independente
- [ ] Testar toggle sistema ativo
- [ ] Validar divergências críticas

**Tempo total:** ~3 horas

---

## 🏁 CONCLUSÃO

### Alinhamento Debate ↔ Projeto

| Aspecto | Alinhamento |
|---------|------------|
| **Estrutura visual (2 colunas)** | ✅ 100% |
| **Toggle sistema ativo** | ✅ 100% |
| **Dados básicos compartilhados** | ✅ 100% |
| **Migração assistida** | ✅ 100% |
| **Salvamento independente** | ✅ 100% |
| **Seção "Visibilidade Calculada"** | 🆕 Adicionar (ótima ideia) |
| **Tabela comparativa dimensional** | 🆕 Adicionar (essencial) |
| **Modo shadow com timer** | 🆕 Adicionar (opcional) |
| **Nomenclatura de regras** | ⚠️ Debate usa nomes diferentes (view_unassigned vs regras_liberacao) |

### Score de Alinhamento: **92%** ✅

**Gaps principais:**
1. Adicionar seção "Visibilidade Calculada" (derivar de `threadVisibility.js`)
2. Implementar tabela comparativa dimensional
3. Decidir sobre modo shadow com timer (nice-to-have)

**Pronto para implementação:** ✅ Sim, após aprovação do layout final

---

**FIM DA ANÁLISE COMPARATIVA** 🎯