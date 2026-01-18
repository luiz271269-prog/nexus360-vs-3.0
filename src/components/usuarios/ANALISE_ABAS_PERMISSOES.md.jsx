# 🔍 ANÁLISE COMPLETA: Abas de Permissões P1-P12

**Data:** 2026-01-18  
**Objetivo:** Mapear conteúdo de cada aba e eliminar duplicações

---

## 📊 RESUMO DAS 6 ABAS

### 🔴 ABA 1: HARD CORE (Fixo)
**Regras:** P1, P9, P10, P11  
**Total:** 4 regras  
**Cor:** Vermelho (bg-red-50)

**Conteúdo:**
```
P1  - Thread Interna - Participação
      ├─ ALLOW: Participante OU Admin
      └─ DENY: Não participante
      
P9  - Canal Bloqueado (WhatsApp, Email, etc)
      └─ DENY: Thread.channel em canaisBloqueados
      
P10 - Integração Bloqueada (número específico)
      └─ DENY: Thread.whatsapp_integration_id bloqueado
      
P11 - Setor Bloqueado (Vendas, Suporte, etc)
      └─ DENY: Thread.sector em setoresBloqueados
```

**Característica:** Bloqueios AUTOMÁTICOS baseados em dados

---

### 💎 ABA 2: CHAVE MESTRA
**Regras:** P3, P4  
**Total:** 2 regras  
**Cor:** Roxo (bg-purple-50)

**Conteúdo:**
```
P3 - Atribuição (Thread atribuída ao usuário)
     └─ ALLOW: assigned_user_id = usuário.id
     └─ IGNORA: P9, P10, P11 (sobrescreve bloqueios técnicos)
     
P4 - Fidelização (Cliente da carteira do usuário)
     └─ ALLOW: is_cliente_fidelizado + campo_fidelizacao = usuário
     └─ IGNORA: P9, P10, P11 (sobrescreve bloqueios técnicos)
```

**Característica:** SEMPRE PERMITEM, ignoram bloqueios

---

### 🟢 ABA 3: LIBERAÇÃO (Allow Override)
**Regras:** P5  
**Total:** 1 regra  
**Cor:** Verde (bg-green-50)

**Conteúdo:**
```
P5 - Janela 24h (Fail-Safe)
     ├─ ALLOW: Cliente enviou msg há < 24h
     ├─ EXCEÇÃO: NÃO libera se fidelizado a outro
     └─ CONFIGURÁVEL: Tempo (1-168h) em "Redes de Segurança"
```

**Característica:** Libera mesmo com bloqueios, CONFIGURÁVEL

---

### 🟡 ABA 4: LIBERAÇÃO (Soft)
**Regras:** P6, P7, P8  
**Total:** 3 regras  
**Cor:** Verde (bg-green-50)

**Conteúdo:**
```
P6 - Carteira de Outros (Supervisão)
     └─ ALLOW: Contato fidelizado + mesmo setor
     └─ FLAG: podeVerCarteiraOutros
     
P7 - Conversas de Outros (Supervisão)
     └─ ALLOW: Thread atribuída a outro + mesmo setor
     └─ FLAG: podeVerConversasOutros
     
P8 - Supervisão Gerencial (Sem resposta)
     ├─ ALLOW: Cliente aguarda > 30min + gerente
     ├─ CONFIGURÁVEL: Tempo (5-1440min)
     └─ FLAG: podeVerTodasConversas
```

**Característica:** Libera com condições, CONFIGURÁVEL

---

### ⚙️ ABA 5: DEFAULT (Fallback)
**Regras:** P12  
**Total:** 1 regra  
**Cor:** Cinza (bg-slate-50)

**Conteúdo:**
```
P12 - Modo Padrão
      ├─ ALLOW: modo_visibilidade = "padrao_liberado" (Nexus360)
      └─ DENY: modo_visibilidade = "padrao_bloqueado" (Restritivo)
```

**Característica:** Fallback final quando nada mais se aplica

---

### 👑 ABA 6: EXCEÇÃO (Admin)
**Regras:** Admin  
**Total:** 1 regra  
**Cor:** Laranja (bg-orange-50)

**Conteúdo:**
```
Admin - Acesso Total
        └─ ALLOW: usuario.role === "admin"
        └─ SOBRESCREVE: Quase todas as outras regras
        └─ EXCEÇÃO: P1 ainda se aplica (admin não vê thread interna que não participa)
```

**Característica:** Exceção global, prioridade máxima

---

## 🔄 MAPEAMENTO: Onde Configurar vs Onde Está a Regra

| Regra | Aba Guia | Configurável? | Onde Configurar | Local no Painel |
|-------|----------|---------------|-----------------|-----------------|
| **P1** | Hard Core | ❌ Não | Automático (participants) | - |
| **P3** | Chave | ❌ Não | Automático (assigned_user_id) | - |
| **P4** | Chave | ❌ Não | Automático (fidelização) | - |
| **P5** | Liberação | ✅ SIM | "Redes de Segurança" | Botão "+ Janela 24h" |
| **P6** | Liberação | ✅ FLAG | "Permissões Detalhadas" | ~~podeVerCarteiraOutros~~ **REMOVIDO** |
| **P7** | Liberação | ✅ FLAG | "Permissões Detalhadas" | ~~podeVerConversasOutros~~ **REMOVIDO** |
| **P8** | Liberação | ✅ SIM | "Redes de Segurança" | Botão "+ Supervisão Gerencial" |
| **P9** | Hard Core | ✅ SIM | "Escopo de Acesso" | Botão "+ Bloquear Canal" |
| **P10** | Hard Core | ✅ SIM | "Escopo de Acesso" | Botão "+ Bloquear Integração" |
| **P11** | Hard Core | ✅ SIM | "Escopo de Acesso" | Botão "+ Bloquear Setor" |
| **P12** | Default | ✅ SIM | "Modo de Visibilidade" | Select (Liberado/Bloqueado) |
| **Admin** | Exceção | ❌ Não | Automático (role=admin) | - |

---

## 🚨 DUPLICAÇÕES IDENTIFICADAS

### ❌ DUPLICAÇÃO 1: podeVerTodasConversas

**Aparece em:**
1. ✅ **P7** (Regra de Visibilidade) - Seção "Regras P1-P12" - Checkbox ativado
2. ❌ **Categoria 4** (REMOVIDA) - "Visibilidade e Acesso" - Lista de 7 itens
3. ✅ **PRESETS** - Campo no objeto PERMISSIONS_PRESETS

**PROBLEMA:**
- Usuário vê checkbox em 2 lugares diferentes
- Não fica claro qual é a "verdadeira" fonte

**SOLUÇÃO APLICADA:**
```diff
- CATEGORIA 4: "Visibilidade e Acesso a Conversas" (7 itens)
+ REMOVIDO - Consolidado em "Regras P1-P12"
```

**RESULTADO:** Agora `podeVerTodasConversas` só aparece:
- ✅ 1x na seção "Regras P1-P12" (P7)
- ✅ 1x nos PRESETS (código - não é UI duplicada)

---

### ❌ DUPLICAÇÃO 2: Regras de Liberação (P5/P8)

**ANTES - Aparecia em:**
1. ✅ Seção "Redes de Segurança" - Blocos expansíveis (correto)
2. ❌ Seção "Visibilidade Fina (Regras Híbridas)" - 5 cards inline

**PROBLEMA:**
- P5 (Janela 24h) aparecia em:
  - Botão "+ Janela 24h" → Bloco com Input de horas
  - Card inline com Switch (duplicado)
  
- P8 (Supervisão) aparecia em:
  - Botão "+ Supervisão Gerencial" → Bloco com Input de minutos
  - Card inline com Switch (duplicado)

**SOLUÇÃO APLICADA:**
```diff
- Seção "Visibilidade Fina (Regras Híbridas)" com 5 cards
+ Substituído por: Seção "Regras P1-P12" com 3 checkboxes (P7, P5, P8)
```

**BENEFÍCIO:**
- P5/P8 agora têm:
  - 1 checkbox na seção "Regras P1-P12" (ON/OFF rápido)
  - 1 bloco detalhado em "Redes de Segurança" (configurar horas/minutos)

---

### ❌ DUPLICAÇÃO 3: Strict Mode

**ANTES - Aparecia em:**
1. ✅ Seção "Visibilidade Fina" - Card vermelho com Switch
2. ✅ Seção "Regras P1-P12" - Card vermelho com Switch

**PROBLEMA:** Mesmo switch em 2 lugares

**SOLUÇÃO APLICADA:**
```diff
- Seção "Visibilidade Fina" - Card Strict Mode
+ REMOVIDO (mantido apenas em "Regras P1-P12")
```

**RESULTADO:** 
- Strict Mode aparece 1x na seção "Regras P1-P12"
- Controla P5/P8 de forma centralizada

---

## ✅ ESTRUTURA FINAL OTIMIZADA

### CARD 1: Perfil Predefinido
```
- Grid 2x3 com 6 presets (admin, gerente, coordenador, senior, pleno, junior)
- Select de modo_visibilidade (Liberado/Bloqueado)
```

### CARD 2: Escopo de Acesso - Bloqueios
```
- Botões: + Bloquear Setor | + Bloquear Integração | + Bloquear Canal
- Cards dinâmicos: 1 para cada regra criada
  └─ Switch (ativa/desativa) + Valores bloqueados + Botão Remover
```
**Mapeia:** P9, P10, P11

### CARD 3: Redes de Segurança - Liberações
```
- Botões: + Janela 24h | + Supervisão Gerencial
- Cards dinâmicos: 1 para cada regra criada
  └─ Switch (ativa/desativa) + Inputs de configuração (horas/minutos)
```
**Mapeia:** P5, P8

### CARD 4: Permissões Granulares de Ações
```
📋 Seção "Regras P1-P12" (NOVO - consolidado)
  ├─ P7 - Ver todas conversas (checkbox)
  ├─ P5 - Janela 24h (checkbox - link para Card 3)
  ├─ P8 - Supervisão (checkbox - link para Card 3)
  └─ Strict Mode (checkbox - desativa P5/P8)

📤 Envio de Mensagens (5 itens)
  ├─ podeEnviarMensagens
  ├─ podeEnviarMidias
  ├─ podeEnviarAudios
  ├─ podeUsarTemplates
  └─ podeUsarRespostasRapidas

💬 Gestão de Conversas (10 itens)
  ├─ podeTransferirConversa
  ├─ podeAtribuirConversas
  ├─ podeAssumirDaFila ⭐
  ├─ podeApagarMensagens
  ├─ podeMarcarComoLida
  ├─ podeEncerrarConversa
  ├─ podeReabrirConversa
  ├─ podeCriarNotasInternas ⭐
  ├─ podeResponderMensagens
  └─ podeEncaminharMensagens ⭐

👤 Gestão de Contatos (10 itens)
  ├─ podeVerDetalhesContato
  ├─ podeEditarContato
  ├─ podeCriarContato
  ├─ podeBloquearContato
  ├─ podeDeletarContato
  ├─ podeAlterarFidelizacao
  ├─ podeAlterarTipoContato
  ├─ podeAlterarStatusContato ⭐
  ├─ podeAdicionarTags
  └─ podeVerHistoricoCompleto

⚡ Automação (10 itens)
📢 Broadcast (4 itens)
🔵 Chat Interno (7 itens)
🤖 IA (5 itens)
📞 Telefonia (4 itens) ⭐
📊 Analytics (6 itens) ⭐
🎛️ Avançadas (5 itens) ⭐
🔗 Integração (4 itens)
```

### CARD 5: Preview Processado
```
- Mostra resultado final de buildUserPermissions()
- Bloqueios ativos (badges)
- Liberações ativas (checkmarks)
- Top 10 ações permitidas
- Diagnóstico ON/OFF
```

---

## 🎯 DIFERENÇAS ENTRE ABAS

### Hard vs Chave vs Liberação

| Aspecto | Hard Core | Chave Mestra | Liberação |
|---------|-----------|--------------|-----------|
| **Prioridade** | Baixa (P9-P11) | Máxima (P3-P4) | Média (P5-P8) |
| **Ordem Execução** | Verificado por último | Verificado primeiro | Meio do fluxo |
| **Sobrescreve?** | ❌ Não | ✅ SIM (P3/P4 > P9-P11) | 🟡 Parcial (P5 > bloqueios) |
| **Configurável?** | ✅ Via botões | ❌ Automático | ✅ Via botões + inputs |
| **Uso Típico** | Isolamento técnico | Garantir acesso dono | Fail-safe + supervisão |

**EXEMPLO DE CONFLITO:**
```
Thread de "Financeiro" bloqueado para João (P11)
  ↓
MAS João é atendente fidelizado deste cliente (P4)
  ↓
RESULTADO: P4 VENCE - João VÊ a thread ✅
```

---

### Liberação Override vs Soft

| Aspecto | Override (P5) | Soft (P6-P8) |
|---------|---------------|--------------|
| **Força** | 🔥 Alta | 🟡 Moderada |
| **Ignora Bloqueios** | ✅ SIM (P9-P11) | ❌ Não (obedece bloqueios) |
| **Proteção** | Não libera se fidelizado a outro | Apenas para mesmo setor |
| **Config** | Input de horas (1-168) | Switches de flag |

**EXEMPLO:**
```
P5 (Override): Júnior vê thread de "Vendas" (bloqueada) porque cliente mandou msg há 6h ✅
P7 (Soft): Senior NÃO vê thread de outro setor mesmo com flag ativa ❌
```

---

## 🔍 ANÁLISE DE DUPLICAÇÕES (ANTES vs DEPOIS)

### ❌ DUPLICAÇÃO ELIMINADA #1

**ANTES:**
```
Local 1: Seção "Visibilidade Fina" → Card "Ver conversas atribuídas a outros"
         └─ Switch podeVerConversasOutros

Local 2: Categoria 4 "Visibilidade e Acesso" → Item "Ver conversas de outros atendentes"
         └─ Switch podeVerConversasOutrosAtendentes

Local 3: Seção "Regras P1-P12" → P7
         └─ Switch podeVerTodasConversas
```

**PROBLEMA:** 3 switches controlando conceito similar

**DEPOIS (CORRIGIDO):**
```
✅ Local ÚNICO: Seção "Regras P1-P12" → P7
   └─ Switch podeVerTodasConversas
   └─ Descrição clara: "Acesso total - vê threads atribuídas a outros"
```

---

### ❌ DUPLICAÇÃO ELIMINADA #2

**ANTES:**
```
Local 1: Botão "+ Janela 24h" → Card expansível com Input
         └─ Controla configuracao.regras_liberacao[]

Local 2: Seção "Visibilidade Fina" → Card inline "Ver threads não atribuídas"
         └─ Switch podeVerNaoAtribuidas (NÃO é P5, mas confunde)
```

**PROBLEMA:** Usuário não sabe se é a mesma coisa

**DEPOIS (CORRIGIDO):**
```
✅ Local 1: Seção "Regras P1-P12" → Checkbox P5 (ON/OFF rápido)
✅ Local 2: Botão "+ Janela 24h" → Input de horas (configuração fina)
❌ REMOVIDO: Card "Ver threads não atribuídas" (era flag diferente, confundia)
```

---

### ❌ DUPLICAÇÃO ELIMINADA #3

**ANTES:**
```
Strict Mode aparecia em:
  - Seção "Visibilidade Fina" (5 cards inline)
  - (Implícito no código permissionsService)
```

**DEPOIS (CORRIGIDO):**
```
✅ Único Local: Seção "Regras P1-P12"
   └─ Card vermelho destacado
   └─ Descrição: "Desativa P5/P8"
   └─ Switch permissoesAcoes.strictMode
```

---

## 📋 CHECKLIST: O Que Cada Aba Controla

### ✅ Aba "Hard" - BLOQUEIOS TÉCNICOS

**Configurações:**
- [ ] P9: Bloquear canal (whatsapp/email/phone)
- [ ] P10: Bloquear integração específica (número WhatsApp)
- [ ] P11: Bloquear setor (vendas/assistencia/financeiro)

**Onde configurar no painel:**
- Card "Escopo de Acesso - Bloqueios Explícitos"
- Botões: "+ Bloquear Setor/Integração/Canal"

**Exemplo de uso:**
```
Júnior NÃO pode ver threads do setor "Financeiro"
  → Admin adiciona regra P11: tipo=setor, valores_bloqueados=["financeiro"]
```

---

### ✅ Aba "Chave" - GARANTIAS DE ACESSO

**Regras AUTOMÁTICAS (não configuráveis):**
- P3: Thread atribuída ao usuário → sempre vê
- P4: Contato fidelizado ao usuário → sempre vê

**Onde está no código:**
- `permissionsService.js` → Regras Priority 3 e 4 na VISIBILITY_MATRIX
- Não aparece como checkbox (é calculado automaticamente)

**Exemplo:**
```
Thread está em "Financeiro" (bloqueado para João via P11)
MAS thread.assigned_user_id = João
  → P3 VENCE, João VÊ a thread ✅
```

---

### ✅ Aba "Liberação" (Override) - FAIL-SAFES

**Configurações:**
- [ ] P5: Janela 24h - Checkbox ON/OFF + Input de horas (1-168)

**Onde configurar:**
1. **ON/OFF:** Seção "Regras P1-P12" → Checkbox P5
2. **Horas:** Card "Redes de Segurança" → Botão "+ Janela 24h" → Input

**Exemplo de uso:**
```
Carlos (pleno) tem "Vendas" bloqueado via P11
MAS ativamos P5 com 12 horas
  → Carlos vê threads de Vendas SE cliente mandou msg há < 12h
```

---

### ✅ Aba "Liberação" (Soft) - SUPERVISÃO

**Configurações:**
- ~~[ ] P6: Ver carteira de outros (flag)~~ **REMOVIDO - Era duplicação**
- ~~[ ] P7: Ver conversas de outros (flag)~~ **CONSOLIDADO em P7**
- [ ] P8: Supervisão gerencial - Checkbox ON/OFF + Input de minutos

**Onde configurar:**
1. **P7 (Ver Todas):** Seção "Regras P1-P12" → Checkbox único
2. **P8 (Supervisão):** 
   - ON/OFF: Seção "Regras P1-P12" → Checkbox P8
   - Minutos: Card "Redes de Segurança" → Botão "+ Supervisão Gerencial"

**Exemplo de uso:**
```
Gerente quer ver threads de equipe com problema
  → Admin ativa P8 com 30 minutos
  → Gerente vê threads onde cliente aguarda > 30min
```

---

### ✅ Aba "Hard" (Default) - FALLBACK

**Configuração:**
- [ ] P12: Modo de visibilidade (Select: Liberado / Bloqueado)

**Onde configurar:**
- Card "Perfil Predefinido" → Select "Modo de Visibilidade"

**Valores:**
- `padrao_liberado` → Se nenhuma regra se aplica, LIBERA (Nexus360)
- `padrao_bloqueado` → Se nenhuma regra se aplica, BLOQUEIA (Restritivo)

**Exemplo:**
```
Thread sem assigned_user_id, sem fidelização, sem bloqueios
  → P1-P11 não se aplicam
  → Cai no P12
  → Se padrao_liberado: MOSTRA ✅
```

---

### ✅ Aba "Exceção" - ADMIN OVERRIDE

**Regra AUTOMÁTICA:**
- Admin: usuario.role === 'admin' → vê quase tudo

**Exceções ao Admin:**
- ❌ P1: Admin NÃO vê thread interna que não participa
- ✅ P3-P12: Admin ignora bloqueios

**Não configurável** - É privilégio de role

---

## 🔧 ONDE CONFIGURAR CADA REGRA (Guia Rápido)

### Para BLOQUEAR threads de alguém:
```
1. Card "Escopo de Acesso"
2. Clicar "+ Bloquear Setor/Integração/Canal"
3. Selecionar valores a bloquear
4. Switch = ON
```
**Afeta:** P9, P10, P11

---

### Para LIBERAR threads com fail-safe:
```
1. Card "Redes de Segurança"
2. Clicar "+ Janela 24h"
3. Configurar horas (ex: 12h)
4. Switch = ON
```
**Afeta:** P5

**OU (atalho rápido):**
```
1. Card "Permissões Granulares"
2. Seção "Regras P1-P12"
3. Checkbox P5 (ON cria regra com 24h padrão)
```

---

### Para ATIVAR supervisão gerencial:
```
1. Card "Redes de Segurança"
2. Clicar "+ Supervisão Gerencial"
3. Configurar minutos (ex: 30min)
4. Switch = ON
```
**Afeta:** P8

**OU (atalho rápido):**
```
1. Seção "Regras P1-P12"
2. Checkbox P8 (ON cria regra com 30min padrão)
```

---

### Para DAR acesso total a gerente:
```
1. Seção "Regras P1-P12"
2. Checkbox "P7 - Ver todas conversas"
3. Ativar switch
```
**Afeta:** `podeVerTodasConversas = true`

---

### Para MODO RESTRITO (estagiário):
```
1. Seção "Regras P1-P12"
2. Checkbox "Strict Mode"
3. Ativar switch
```
**Efeito:** Desativa P5 (janela 24h) e P8 (supervisão)

---

## 🎯 RESUMO: SEM DUPLICAÇÕES

### Antes da Limpeza:
```
❌ podeVerTodasConversas: 2 lugares (Categoria 4 + P7)
❌ P5 Janela 24h: 2 lugares (Card Redes + Card inline)
❌ P8 Supervisão: 2 lugares (Card Redes + Card inline)
❌ Strict Mode: 2 lugares (Visibilidade Fina + P1-P12)
❌ podeVerConversasOutros: 2 flags diferentes (podeVerConversasOutros + podeVerConversasOutrosAtendentes)
```

### Depois da Limpeza:
```
✅ podeVerTodasConversas: 1 lugar (Seção P1-P12)
✅ P5: 1 checkbox ON/OFF + 1 input de config (separados logicamente)
✅ P8: 1 checkbox ON/OFF + 1 input de config (separados logicamente)
✅ Strict Mode: 1 lugar (Seção P1-P12)
✅ Flags de visibilidade: consolidadas em podeVerTodasConversas
```

---

## 💡 GUIA DE USO SIMPLIFICADO

### Caso 1: "Quero que júnior veja apenas seu setor"
```
1. Card "Escopo de Acesso"
2. "+ Bloquear Setor"
3. Adicionar: vendas, assistencia, fornecedor (deixar só financeiro se ele é de financeiro)
4. Salvar
```

### Caso 2: "Gerente deve ver tudo da equipe"
```
1. Card "Perfil Predefinido"
2. Clicar botão "gerente"
3. Salvar (preset já vem com podeVerTodasConversas = true)
```

### Caso 3: "Estagiário só vê o que atribuir para ele"
```
1. Card "Perfil Predefinido" → Selecionar "junior"
2. Seção "Regras P1-P12" → Ativar "Strict Mode"
3. Salvar (desativa janela 24h e supervisão)
```

### Caso 4: "Vendedor pode ver leads recentes mesmo não atribuídos"
```
1. Card "Redes de Segurança"
2. "+ Janela 24h"
3. Configurar 48h
4. Switch = ON
5. Salvar
```

---

## ✅ VALIDAÇÃO: Nenhuma Duplicação Funcional

| Controle | Aparições | Status |
|----------|-----------|---------|
| **P1** | 1x (Guia) | ✅ Único |
| **P3** | 1x (Guia) | ✅ Único |
| **P4** | 1x (Guia) | ✅ Único |
| **P5** | 2x (Checkbox + Config) | ✅ Lógica (ON/OFF separado de horas) |
| **P7** | 1x (Checkbox) | ✅ Único |
| **P8** | 2x (Checkbox + Config) | ✅ Lógica (ON/OFF separado de minutos) |
| **P9** | 1x (Botão + Cards) | ✅ Único |
| **P10** | 1x (Botão + Cards) | ✅ Único |
| **P11** | 1x (Botão + Cards) | ✅ Único |
| **P12** | 1x (Select) | ✅ Único |
| **Admin** | 1x (Guia) | ✅ Único |
| **Strict** | 1x (Checkbox) | ✅ Único |

**TOTAL:** Todas as regras têm controle único ✅

---

## 🎨 HIERARQUIA VISUAL OTIMIZADA

```
PainelPermissoesUnificado
├─ 📖 GuiaRegraP1P12 (abas informativas P1-P12)
│  ├─ Aba "Hard" (P1, P9-P11)
│  ├─ Aba "Chave" (P3-P4)
│  ├─ Aba "Liberação" (P5)
│  ├─ Aba "Liberação" (P6-P8)
│  ├─ Aba "Default" (P12)
│  └─ Aba "Exceção" (Admin)
│
├─ 🎯 Card 1: Perfil Predefinido
│  ├─ Grid de presets (admin, gerente, etc)
│  └─ Select modo_visibilidade (P12)
│
├─ 🔒 Card 2: Escopo de Acesso - Bloqueios
│  ├─ Botões criar regras (P9, P10, P11)
│  └─ Cards dinâmicos (1 por regra)
│
├─ 🔓 Card 3: Redes de Segurança - Liberações
│  ├─ Botões criar regras (P5, P8)
│  └─ Cards dinâmicos (1 por regra)
│
├─ ⚙️ Card 4: Permissões Granulares
│  ├─ 📋 Seção "Regras P1-P12" (checkboxes P5, P7, P8, Strict)
│  ├─ 📤 Envio de Mensagens (5 flags)
│  ├─ 💬 Gestão de Conversas (10 flags)
│  ├─ 👤 Gestão de Contatos (10 flags)
│  ├─ ⚡ Automação (10 flags)
│  ├─ 📢 Broadcast (4 flags)
│  ├─ 🔵 Chat Interno (7 flags)
│  ├─ 🤖 IA (5 flags)
│  ├─ 📞 Telefonia (4 flags)
│  ├─ 📊 Analytics (6 flags)
│  ├─ 🎛️ Avançadas (5 flags)
│  └─ 🔗 Integração (4 flags)
│
└─ 👁️ Card 5: Preview Processado
   └─ Resultado final de buildUserPermissions()
```

**ORGANIZAÇÃO:** ✅ Hierárquica e clara

---

## 🔑 RESPOSTA DIRETA: Diferenças Entre Abas

### Hard (Vermelho) ≠ Chave (Roxo)

| Hard Core | Chave Mestra |
|-----------|--------------|
| P1, P9-P11 | P3, P4 |
| Bloqueios técnicos | Garantias de acesso |
| Executado POR ÚLTIMO | Executado PRIMEIRO |
| Configurável via botões | Automático (dados) |
| Pode ser sobrescrito por P3/P4 | NUNCA sobrescrito |

**CONCLUSÃO:** 
- **Hard** = "Bloquear por padrão"
- **Chave** = "Sempre permitir (prioritário)"

---

### Liberação Override (Verde) ≠ Liberação Soft (Verde)

| P5 (Override) | P6-P8 (Soft) |
|---------------|--------------|
| 1 regra | 3 regras |
| Ignora P9-P11 | Obedece P9-P11 |
| Proteção: fidelizado a outro | Proteção: mesmo setor |
| Config: horas (1-168) | Config: flags + minutos |

**CONCLUSÃO:**
- **P5** = "Liberar temporariamente (janela de tempo)"
- **P6-P8** = "Liberar com condições (supervisão controlada)"

---

### Default (Cinza) ≠ Exceção (Laranja)

| P12 (Default) | Admin (Exceção) |
|---------------|-----------------|
| Fallback quando nada se aplica | Override global |
| Configurável (Select) | Fixo (role) |
| PODE ser bloqueado por P9-P11 | IGNORA P9-P11 |

**CONCLUSÃO:**
- **P12** = "Valor padrão se regra nenhuma decidir"
- **Admin** = "Sempre permitir (exceto P1)"

---

## ✅ RESULTADO FINAL

### Sem Duplicações ✅
- Cada regra tem 1 controle único
- P5/P8 têm checkbox (ON/OFF) + input (config fina) separados logicamente
- Flags de visibilidade consolidadas em `podeVerTodasConversas`

### Interface Simplificada ✅
- Guia P1-P12: Educação (abas informativas)
- Cards de config: Ação (botões + switches)
- Seção "Regras P1-P12": Atalhos rápidos (checkboxes)

### Organização Lógica ✅
```
1. Perfil Rápido (presets)
2. Bloqueios (o que NÃO pode ver)
3. Liberações (exceções aos bloqueios)
4. Ações Granulares (o que pode FAZER)
5. Preview (resultado final)
```

**APROVADO PARA PRODUÇÃO ✅**