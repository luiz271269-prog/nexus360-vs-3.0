# 🔍 ANÁLISE DE GAPS: Regras Legado vs Nexus360

## 📋 RESUMO EXECUTIVO
- **5 REGRAS LEGADAS não mapeadas para Nexus360**
- **2 COMPORTAMENTOS críticos de fallback não documentados**
- Nexus360 foca em Hard Core (P1,P9-P11) + Ownership (P3,P6,P7) + Liberações (P5,P8)
- Legado tem lógica mais granular com fallbacks explícitos

---

## 🔴 REGRAS LEGADAS QUE FALTAM NO NEXUS360

### 1️⃣ **FAIL-SAFE 24H (Mensagens Recentes)**
**Local Legado:** `threadVisibility.js` linhas 336-352 (PRIORIDADE ZERO)

```javascript
// Mensagem recebida <24h IGNORA TUDO (exceto fidelização a outro)
if (thread.last_inbound_at && thread.last_message_sender === 'contact') {
  const horasSemResposta = (Date.now() - new Date(thread.last_inbound_at).getTime()) / (1000 * 60 * 60);
  if (horasSemResposta < 24) {
    // LIBERA mesmo se: não atribuída, integração bloqueada, setor bloqueado
    return true;  // ❌ IGNORA P9, P10, P11
  }
}
```

**Status Nexus360:** ❌ **AUSENTE**
- P5 (janela_24h) faz o oposto: libera APENAS se configurado explicitamente
- Legado: sempre libera por padrão com <24h
- Nexus360: só libera se regra_liberacao está ativa

**Impacto:** Threads "quentes" (mensagem recente) que ficariam bloqueadas em Nexus360

---

### 2️⃣ **Mensagens Recentes em Não-Atribuídas (contexto secundário)**
**Local Legado:** `threadVisibility.js` linhas 398-410

```javascript
// Thread não atribuída + mensagem <24h = SEMPRE VISÍVEL (ignora integração)
if (naoAtribuida && thread.last_inbound_at) {
  const horasSemResposta = (Date.now() - new Date(thread.last_inbound_at).getTime()) / (1000 * 60 * 60);
  if (horasSemResposta < 24 && thread.last_message_sender === 'contact') {
    return true;  // ❌ IGNORA permissão de integração
  }
}
```

**Status Nexus360:** ⚠️ **PARCIALMENTE MAPEADA**
- Nexus tem P5 para isso, mas não automático
- Legado: comportamento padrão (sem config necessária)

---

### 3️⃣ **Permissão de Atendentes Específicos (can_view por Atendente)**
**Local Legado:** `threadVisibility.js` linhas 608-622

```javascript
// Filtro por atendente específico + verificação de permissão
if (filtros.atendenteId && filtros.atendenteId !== 'all') {
  const atendentesVisiveis = perms.atendentes_visiveis || [];
  const podeVerAtendente = isAdminOrAll || atendentesVisiveis.map(...).includes(...);
  if (!podeVerAtendente) return false;
}
```

**Status Nexus360:** ❌ **AUSENTE**
- Nexus não tem campo `atendentes_visiveis` 
- Nexus: foco em setores, não em atendentes individuais
- Legado: pode bloquear visualização de threads de um atendente específico

**Impacto:** Não é possível restringir visualização de conversas de um atendente específico em Nexus360

---

### 4️⃣ **Conexões Específicas (can_view por Número/Conexão)**
**Local Legado:** `threadVisibility.js` linhas 112-123

```javascript
const perms = usuario?.permissoes_visualizacao || {};
const visiveis = perms.conexoes_visiveis;
if (!visiveis || visiveis.length === 0) return true;  // Default: LIBERA
return visiveis.map(normalizar).includes(normalizar(conexaoId));
```

**Status Nexus360:** ⚠️ **PARCIALMENTE MAPEADA**
- Nexus360 não tem suporte para `conexoes_visiveis` granular
- Usa apenas `whatsapp_permissions[].can_view` por integração
- Legado: controla POR CONEXÃO/NÚMERO específico (mais granular)

**Impacto:** Não é possível restringir por número específico em Nexus360

---

### 5️⃣ **Contatos Fidelizados Setorialmente**
**Local Legado:** `threadVisibility.js` linhas 743-748

```javascript
const camposFidelizacao = [
  'atendente_fidelizado_vendas',      // ← POR SETOR
  'atendente_fidelizado_assistencia', // ← POR SETOR
  'atendente_fidelizado_financeiro',  // ← POR SETOR
  'atendente_fidelizado_fornecedor',  // ← POR SETOR
  'vendedor_responsavel'
];
```

**Status Nexus360:** ❌ **AUSENTE**
- Nexus não contempla fidelização por setor
- Nexus usa apenas flag genérica `is_fidelizado`
- Legado: atendente pode ser fidelizado DIFERENTE por setor (ex: João é dono em Vendas, mas Pedro em Financeiro)

**Impacto:** Perda de flexibilidade em atribuição multi-setorial

---

### 6️⃣ **Admin Explícito vs "pode_ver_todas_conversas"**
**Local Legado:** `threadVisibility.js` linhas 310-311

```javascript
const isAdmin = usuario.role === 'admin';
const isAdminOrAll = isAdmin || !!perms.pode_ver_todas_conversas;  // ← FLAG SEPARADA
```

**Status Nexus360:** ⚠️ **PARCIALMENTE**
- Nexus assume `role === 'admin'` 
- Não tem equivalente de `pode_ver_todas_conversas` como flag separada
- Legado: um atendente pode ter `role='user'` mas `pode_ver_todas_conversas=true`

**Impacto:** Não é possível dar super-visão sem fazer user um admin verdadeiro

---

## 🟡 COMPORTAMENTOS CRÍTICOS (Fallbacks Implícitos)

### **Comportamento A: Liberar por Padrão sem Restrição Explícita**
**Legado:** Linhas 95-96, 119-120, 169-172

```javascript
// Sem configuração = LIBERA (não bloqueia)
if (!visiveis || visiveis.length === 0) return true;
```

**Nexus360:** Inverso total - modo bloqueado por padrão (P12_DEFAULT_DENY)
- **Risco:** Usuários novos em Nexus360 não veem nada até configurado
- **Solução:** Converter usuários ou listar com cuidado

---

### **Comportamento B: Verificar Participação em Threads Internas**
**Legado:** Linhas 313-320

```javascript
// Threads internas IGNORAM TUDO (integração, setor, conexão)
// Só regra: é participante?
if (thread.thread_type === 'team_internal') {
  const isParticipant = thread.participants?.includes(usuario.id);
  return Boolean(isParticipant || isAdminOrAll);
}
```

**Nexus360:** ✅ **MAPEADO (P1)**
- Perfeitamente copiado em `isThreadInternaNaoParticipante()`

---

## 📊 MATRIZ DE COBERTURA

| Regra | Legado | Nexus360 | Gap | Prioridade | Nota |
|-------|--------|----------|-----|-----------|------|
| 🔑 Atribuição (assigned_user_id) | ✅ P2 | ✅ P3 | ✓ Mapeado | - | Chave Mestra |
| 🔑 Fidelização (genérica) | ✅ | ✅ P6 | ✓ Mapeado | - | Chave Mestra |
| 🔑 Fidelização Setorial | ✅ | ❌ | **GAP-5** | ALTA | Perda de função crítica |
| ⏰ Fail-Safe 24h (sempre libera) | ✅ PRIOR-0 | ⚠️ P5 (config) | **GAP-1** | ALTA | Default invertido |
| 🚫 Canal Bloqueado | ✅ | ✅ P9 | ✓ Mapeado | - | Hardcoded |
| 🚫 Integração Bloqueada | ✅ | ✅ P10 | ✓ Mapeado | - | Hardcoded |
| 🚫 Setor Bloqueado | ✅ | ✅ P11 | ✓ Mapeado | - | Hardcoded |
| 🔍 Ver Conversas Outros | ✅ (via role) | ✅ P7 | ✓ Mapeado | - | Flag configurável |
| 🧠 Supervisão 30min | ✅ Gerente | ✅ P8 | ✓ Mapeado | - | Configurável |
| 👤 Atendentes Visiveis | ✅ | ❌ | **GAP-3** | MÉDIA | Granularidade perdida |
| ☎️ Conexões Visiveis | ✅ | ⚠️ | **GAP-4** | MÉDIA | Menos granular |
| 👁️ pode_ver_todas_conversas | ✅ | ❌ | **GAP-6** | BAIXA | Alternativa: role=admin |
| 🧵 Threads Internas | ✅ | ✅ P1 | ✓ Mapeado | - | Participação only |

---

## 🛠️ RECOMENDAÇÕES

### **Imediato (Bloqueia Go-Live)**
1. **GAP-1 (Fail-Safe 24h):** Adicionar rule padrão em Nexus360 ou documentar mudança de comportamento
2. **GAP-5 (Fidelização Setorial):** Mapear campos de setor-específico ou deprecar

### **Curto Prazo (Sprint Próximo)**
3. **GAP-3 (Atendentes Visíveis):** Adicionar suporte ou usar setores como proxy
4. **GAP-4 (Conexões Visíveis):** Refinar integração para incluir conexão/número

### **Nice-to-Have**
5. **GAP-6 (pode_ver_todas):** Documentar equivalente (`role='admin'` ou custom flag)

---

## 🎯 AÇÃO: Conversão de Usuários Legado → Nexus360

```javascript
// Para cada usuário legado:
const legacyUser = {...};
const nexusUser = {
  ...legacyUser,
  sistema_permissoes_ativo: 'legacy', // Manter legado até validar
  configuracao_visibilidade_nexus: {
    modo_visibilidade: 'padrao_liberado', // ← CRÍTICO: invertido!
    regras_bloqueio: [
      // Converter bloqueios de integração/setor/conexão se houver
    ],
    regras_liberacao: [
      // Sempre adicionar janela_24h por padrão (compatibilidade)
      {
        tipo: 'janela_24h',
        ativa: true,
        configuracao: { horas: 24 }
      }
    ]
  }
};
``