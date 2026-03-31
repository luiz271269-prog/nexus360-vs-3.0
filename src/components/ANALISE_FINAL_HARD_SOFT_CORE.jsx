# 🎯 ANÁLISE FINAL: Hard Core vs Soft Core + Políticas Padrão

**Data:** 2026-01-15  
**Objetivo:** Consolidar arquitetura de regras e definir políticas padrão por perfil

---

## 🏗️ ARQUITETURA CONSOLIDADA - VISÃO EXECUTIVA

### Pirâmide de Decisão Nexus360

```
┌─────────────────────────────────────────────────────────────┐
│           🚨 CAMADA 1: COMPLIANCE / LEGAL                   │
│           (Nível Máximo - Inviolável)                       │
├─────────────────────────────────────────────────────────────┤
│  • Tags LGPD, RH, Jurídico, VIP bloqueados                 │
│  • Bloqueio por dados sensíveis (CPF, contrato, etc.)      │
│  • Nem admin pode furar (exceto auditoria com log)         │
│  • ⚠️ FUTURO: a implementar quando necessário               │
└─────────────────────────────────────────────────────────────┘
        ↓ Se passou
┌─────────────────────────────────────────────────────────────┐
│           🔒 CAMADA 2: HARD CORE NEXUS360                   │
│           (Segurança Estrutural - Sempre Aplicada)          │
├─────────────────────────────────────────────────────────────┤
│  P1: Thread interna → participação obrigatória             │
│  P2: Admin total access (sobrepõe resto)                   │
│  P3: Thread atribuída ao usuário                           │
│  P4: Contato fidelizado ao usuário                         │
│  P9: Canal bloqueado (lista configurável)                  │
│  P10: Integração bloqueada (lista configurável)            │
│  P11: Setor bloqueado (lista configurável)                 │
│                                                             │
│  ⚠️ LÓGICA é fixa, apenas LISTAS são editáveis             │
└─────────────────────────────────────────────────────────────┘
        ↓ Se passou
┌─────────────────────────────────────────────────────────────┐
│           🔀 CAMADA 3: REGRAS HÍBRIDAS                      │
│           (Hard Core + Soft Core)                           │
├─────────────────────────────────────────────────────────────┤
│  P6: Fidelizado a outro                                     │
│      • HARD: Bloqueio existe                                │
│      • SOFT: Flag "view_others_wallet" pode sobrepor        │
│                                                             │
│  P7: Atribuído a outro                                      │
│      • HARD: Bloqueio existe                                │
│      • SOFT: Flags "view_assigned_others" + P5/P8 podem     │
│        sobrepor em situações específicas                    │
└─────────────────────────────────────────────────────────────┘
        ↓ Se passou
┌─────────────────────────────────────────────────────────────┐
│           ⚙️ CAMADA 4: SOFT CORE NEXUS360                   │
│           (Estratégia de Negócio - Configurável)            │
├─────────────────────────────────────────────────────────────┤
│  P5: Janela 24h (fail-safe) - resgate de conversas         │
│  P8: Supervisão gerencial - tickets ociosos                │
│  P12: Default allow/deny - comportamento padrão            │
│                                                             │
│  FLAGS:                                                     │
│  • view_unassigned - Ver fila "Sem dono"                   │
│  • view_assigned_others - Ver tickets de colegas           │
│  • view_others_wallet - Ver carteira de colegas            │
│  • strict_mode - Desativa P5/P8                            │
└─────────────────────────────────────────────────────────────┘
        ↓ Se passou
┌─────────────────────────────────────────────────────────────┐
│           🎨 CAMADA 5: FILTROS DE UI                        │
│           (Preferências - Voláteis)                         │
├─────────────────────────────────────────────────────────────┤
│  • Aba ativa (Todas, Não atribuídas, Aguardando, etc.)     │
│  • Busca por texto                                          │
│  • Filtro por tags/categorias                              │
│  • Ordenação (mais recente, mais antiga, etc.)             │
│  • Não afeta segurança, só apresentação                    │
└─────────────────────────────────────────────────────────────┘

RESULTADO: ✅ ALLOW ou ❌ DENY + reason_code + path
```

---

## 🔴 HARD CORE NEXUS360 - DETALHAMENTO

### Princípio Fundamental

**"Segurança estrutural que não depende de gosto ou processo de trabalho"**

Essas regras são **sempre** aplicadas pelo motor, **antes** de qualquer consideração de "jeito de trabalhar". São fixas no código; apenas as **listas** (quais canais, quais setores, quais integrações) são configuráveis.

---

### P1 - Thread Interna (Participação Obrigatória)

**Tipo:** 🔒 Hard Core  
**Categoria:** Isolamento estrutural  
**Configurável:** ❌ NÃO

**Lógica:**
```javascript
if (thread.thread_type === 'team_internal' || thread.thread_type === 'sector_group') {
  if (user.role === 'admin') {
    return { allow: true, code: 'ADMIN_INTERNAL_THREAD' };
  }
  
  if (thread.participants?.includes(user.id)) {
    return { allow: true, code: 'PARTICIPANT_INTERNAL_THREAD' };
  }
  
  // NÃO é participante → DENY fixo (nem com configuração pode sobrepor)
  return { allow: false, code: 'NOT_PARTICIPANT' };
}
```

**Razão:**
- Threads internas são conversas privadas entre equipe
- Não faz sentido ver conversas de equipes que você não participa
- Nem mesmo supervisor deveria ver (exceto admin para troubleshooting)

**Impacto no Simulador:**
- Se Legado permitir e Nexus bloquear: **🚨 CRÍTICO (Furo de segurança)**

---

### P2 - Admin Total Access

**Tipo:** 🔒 Hard Core  
**Categoria:** Isolamento estrutural  
**Configurável:** ❌ NÃO (exceto futuro: bloqueios legais)

**Lógica:**
```javascript
if (user.role === 'admin') {
  // Futuro: verificar bloqueios legais (LGPD, compliance)
  // if (hasLegalBlockForThread(thread, user)) {
  //   return { allow: false, code: 'LEGAL_BLOCK_OVERRIDE_ADMIN' };
  // }
  
  return { allow: true, code: 'ADMIN_FULL_ACCESS' };
}
```

**Razão:**
- Admin precisa de acesso total para troubleshooting, auditoria, suporte
- Pode ser limitado no futuro por bloqueios legais (LGPD, etc.)

---

### P3 - Thread Atribuída ao Usuário

**Tipo:** 🔒 Hard Core  
**Categoria:** Propriedade  
**Configurável:** ❌ NÃO

**Lógica:**
```javascript
if (thread.assigned_user_id === user.id) {
  return { allow: true, code: 'ASSIGNED_TO_USER' };
}
```

**Razão:**
- Usuário **sempre** deve ver conversas atribuídas a ele
- Fundamental para operação básica

---

### P4 - Contato Fidelizado ao Usuário

**Tipo:** 🔒 Hard Core  
**Categoria:** Propriedade (carteira)  
**Configurável:** ❌ NÃO

**Lógica:**
```javascript
const setorUsuario = user.attendant_sector || 'geral';
const campoFidelizacao = `atendente_fidelizado_${setorUsuario}`;

if (contato?.[campoFidelizacao] === user.id) {
  return { allow: true, code: 'FIDELIZED_CONTACT' };
}
```

**Razão:**
- Contato da carteira do atendente (relacionamento construído)
- Fundamental para preservar continuidade de atendimento

---

### P9 - Canal Bloqueado

**Tipo:** 🔒 Hard Core  
**Categoria:** Isolamento estrutural  
**Configurável:** ⚠️ LISTA de canais bloqueados (não a lógica de bloqueio)

**Lógica:**
```javascript
const regraBloqueioCanal = user.configuracao_visibilidade_nexus?.regras_bloqueio
  ?.find(r => r.tipo === 'canal' && r.ativa);

if (regraBloqueioCanal?.valores_bloqueados?.includes(thread.channel)) {
  return { allow: false, code: 'CHANNEL_BLOCKED' };
}
```

**Configuração na UI:**
```
Bloqueios > [+] Bloquear Canal
• [ ] whatsapp
• [x] instagram
• [ ] facebook
• [ ] telefone
• [ ] email
```

**Razão:**
- Alguns usuários não devem ver certos canais
- Ex: Financeiro não precisa ver Instagram (apenas WhatsApp e telefone)

---

### P10 - Integração Bloqueada

**Tipo:** 🔒 Hard Core  
**Categoria:** Isolamento estrutural  
**Configurável:** ⚠️ LISTA de integrações bloqueadas

**Lógica:**
```javascript
const regraBloqueioIntegracao = user.configuracao_visibilidade_nexus?.regras_bloqueio
  ?.find(r => r.tipo === 'integracao' && r.ativa);

if (regraBloqueioIntegracao?.valores_bloqueados?.includes(thread.whatsapp_integration_id)) {
  return { allow: false, code: 'INTEGRATION_BLOCKED' };
}
```

**Configuração na UI:**
```
Bloqueios > [+] Bloquear Integração
• [ ] Vendas Principal (#5548999322400)
• [x] RH Interno (#5548988776655)
• [ ] Suporte Geral (#5548977665544)
```

**Razão:**
- Isolamento de chips/contas específicas
- Ex: Vendas não deve ver chip de RH

---

### P11 - Setor Bloqueado

**Tipo:** 🔒 Hard Core  
**Categoria:** Isolamento estrutural  
**Configurável:** ⚠️ LISTA de setores bloqueados

**Lógica:**
```javascript
const regraBloqueioSetor = user.configuracao_visibilidade_nexus?.regras_bloqueio
  ?.find(r => r.tipo === 'setor' && r.ativa);

if (regraBloqueioSetor?.valores_bloqueados?.includes(thread.sector_id)) {
  return { allow: false, code: 'SECTOR_BLOCKED' };
}
```

**Configuração na UI:**
```
Bloqueios > [+] Bloquear Setor
• [ ] vendas
• [x] assistencia
• [x] financeiro
• [ ] fornecedor
• [ ] geral
```

**Razão:**
- Separação departamental
- Ex: Atendente de Vendas não deve ver conversas de Financeiro

---

## 🔀 REGRAS HÍBRIDAS (P6, P7)

### Conceito

**"Bloqueio condicional que pode ser relaxado por flags de colaboração"**

Essas regras têm:
- **Base Hard Core:** O bloqueio existe estruturalmente
- **Sobrescrição Soft Core:** Flags específicas podem relaxar o bloqueio

---

### P6 - Fidelizado a Outro (Híbrida)

**Base:** 🔒 Hard Core (bloqueio existe)  
**Sobrescrição:** ⚙️ Soft Core (flag `view_others_wallet`)

**Lógica:**
```javascript
const setorUsuario = user.attendant_sector || 'geral';
const campoFidelizacao = `atendente_fidelizado_${setorUsuario}`;
const fidelizadoParaOutro = contato?.[campoFidelizacao] && contato[campoFidelizacao] !== user.id;

if (fidelizadoParaOutro) {
  // Verificar flag de colaboração
  if (user.permissoes_acoes_nexus?.podeVerCarteiraOutros) {
    // Flag ativa: supervisor pode ver carteiras da equipe
    return { allow: true, code: 'FIDELIZED_TO_ANOTHER_BUT_ALLOWED' };
  }
  
  // Flag inativa: bloqueio padrão
  return { allow: false, code: 'FIDELIZED_TO_ANOTHER' };
}
```

**UI Nexus360:**
```
Ações Granulares > Visibilidade Fina
• [x] Ver carteiras de outros atendentes
  ↳ Permite acesso a contatos fidelizados a colegas do setor
```

**Cenários:**
- **Atendente júnior:** Flag OFF → Só vê sua carteira
- **Supervisor/Gerente:** Flag ON → Vê carteiras da equipe (supervisão)

---

### P7 - Atribuído a Outro (Híbrida)

**Base:** 🔒 Hard Core (bloqueio existe)  
**Sobrescrição:** ⚙️ Soft Core (flags + P5/P8)

**Lógica:**
```javascript
const atribuidoParaOutro = thread.assigned_user_id && thread.assigned_user_id !== user.id;

if (atribuidoParaOutro) {
  // Admin sempre vê (P2)
  if (user.role === 'admin') {
    return { allow: true, code: 'ADMIN_FULL_ACCESS' };
  }
  
  // Sub-verificação 1: Flag "ver conversas de outros"
  if (user.permissoes_acoes_nexus?.podeVerConversasOutros) {
    // Gerente/supervisor pode ver conversas da equipe
    return { allow: true, code: 'ASSIGNED_TO_ANOTHER_BUT_ALLOWED_BY_FLAG' };
  }
  
  // Sub-verificação 2: Janela 24h (P5) - se não strict mode
  if (!user.permissoes_acoes_nexus?.strictMode) {
    const regraJanela = user.configuracao_visibilidade_nexus?.regras_liberacao
      ?.find(r => r.tipo === 'janela_24h' && r.ativa);
    
    if (regraJanela) {
      const temMensagemRecente = await checkJanela24h(thread, user, regraJanela);
      if (temMensagemRecente) {
        return { allow: true, code: 'WINDOW_24H_OVERRIDE' };
      }
    }
  }
  
  // Sub-verificação 3: Supervisão gerencial (P8) - se não strict mode
  if (!user.permissoes_acoes_nexus?.strictMode) {
    const regraSupervisao = user.configuracao_visibilidade_nexus?.regras_liberacao
      ?.find(r => r.tipo === 'gerente_supervisao' && r.ativa);
    
    if (regraSupervisao && user.attendant_role === 'gerente') {
      const aguardandoMuito = checkTempoSemResposta(thread, regraSupervisao);
      if (aguardandoMuito) {
        return { allow: true, code: 'MANAGER_SUPERVISION_OVERRIDE' };
      }
    }
  }
  
  // Nenhuma sobrescrição aplicada → DENY
  return { allow: false, code: 'ASSIGNED_TO_ANOTHER' };
}
```

**UI Nexus360:**
```
Ações Granulares > Visibilidade Fina
• [x] Ver conversas atribuídas a outros atendentes
  ↳ Permite acesso a threads em andamento de colegas do setor

Liberações Especiais
• [x] Janela 24h (P5)
  ↳ Permite ver threads que você interagiu nas últimas 24h
• [x] Supervisão Gerencial (P8)
  ↳ Permite ver threads sem resposta há >30min (apenas gerente)

Controles Adicionais
• [ ] Strict Mode
  ↳ Desativa P5 e P8 (zero exceções)
```

**Cenários:**
- **Atendente júnior (sem flags):** Não vê conversas de outros
- **Atendente pleno (com janela 24h):** Vê conversas que interagiu recentemente
- **Supervisor (com flag):** Vê todas conversas da equipe
- **Gerente (com P8):** Vê tickets ociosos para intervenção
- **Estagiário (strict mode):** Não vê NADA de outros (zero exceções)

---

## 🟢 SOFT CORE NEXUS360 - DETALHAMENTO

### Princípio Fundamental

**"Estratégia de negócio que varia por perfil, setor e empresa"**

Essas regras são **totalmente configuráveis** na UI Nexus360. Definem **como** a operação funciona, não apenas **quem** pode ver o quê.

---

### P5 - Janela 24h (Fail-Safe)

**Tipo:** ⚙️ Soft Core  
**Categoria:** Rede de segurança operacional  
**Configurável:** ✅ SIM (horas + on/off)

**Propósito:**
- Evitar perda de contexto em conversas recentes
- Permitir continuidade mesmo quando thread é reatribuída
- "Modo resgate": se cliente voltou a falar, atendente que interagiu pode responder

**Lógica:**
```javascript
const regraJanela = user.configuracao_visibilidade_nexus?.regras_liberacao
  ?.find(r => r.tipo === 'janela_24h' && r.ativa);

if (regraJanela && !user.permissoes_acoes_nexus?.strictMode) {
  const horas = regraJanela.configuracao?.horas || 24;
  const limiteTimestamp = Date.now() - (horas * 60 * 60 * 1000);
  
  // Verificar se usuário enviou mensagem recente nesta thread
  const mensagensUsuario = await base44.entities.Message.filter({
    thread_id: thread.id,
    sender_id: user.id,
    sender_type: 'user'
  });
  
  const temMensagemRecente = mensagensUsuario.some(m => 
    new Date(m.sent_at).getTime() > limiteTimestamp
  );
  
  if (temMensagemRecente) {
    return { allow: true, code: 'WINDOW_24H_ACTIVE' };
  }
}
```

**UI Nexus360:**
```
Liberações > [+] Janela 24h

┌────────────────────────────────────────────────┐
│ Janela 24h (Fail-Safe)                         │
├────────────────────────────────────────────────┤
│                                                │
│ Permitir visualizar threads que você          │
│ interagiu recentemente, mesmo que tenham       │
│ sido reatribuídas para outros atendentes.      │
│                                                │
│ Duração: [24] horas                            │
│ Status: [✓] Ativa                              │
│                                                │
│ [Ativa ✓] [Remover ×]                          │
└────────────────────────────────────────────────┘
```

**Cenários:**
- **Ativa (24h):** Atendente vê threads que interagiu nas últimas 24h
- **Ativa (48h):** Janela estendida para atendimento mais complexo
- **Desativada:** Sem resgate (mais restritivo)

---

### P8 - Supervisão Gerencial

**Tipo:** ⚙️ Soft Core  
**Categoria:** Controle de qualidade  
**Configurável:** ✅ SIM (minutos + perfil + on/off)

**Propósito:**
- Permitir supervisão sem violar privacidade permanentemente
- Gerente pode intervir em tickets ociosos
- Melhora tempo de resposta ao cliente

**Lógica:**
```javascript
const regraSupervisao = user.configuracao_visibilidade_nexus?.regras_liberacao
  ?.find(r => r.tipo === 'gerente_supervisao' && r.ativa);

if (regraSupervisao && user.attendant_role === 'gerente' && !user.permissoes_acoes_nexus?.strictMode) {
  const minutosLimite = regraSupervisao.configuracao?.minutos_sem_resposta || 30;
  const limiteTimestamp = Date.now() - (minutosLimite * 60 * 1000);
  
  // Verificar se cliente está aguardando há muito tempo
  if (thread.last_message_sender === 'contact') {
    const lastMessageTimestamp = new Date(thread.last_message_at).getTime();
    
    if (lastMessageTimestamp < limiteTimestamp) {
      // Cliente aguarda há mais de X minutos → gerente pode intervir
      return { allow: true, code: 'MANAGER_SUPERVISION' };
    }
  }
}
```

**UI Nexus360:**
```
Liberações > [+] Supervisão Gerencial

┌────────────────────────────────────────────────┐
│ Supervisão Gerencial                           │
├────────────────────────────────────────────────┤
│                                                │
│ Permite que gerentes/coordenadores vejam       │
│ threads sem resposta há X minutos para         │
│ intervir quando necessário.                    │
│                                                │
│ Tempo sem resposta: [30] minutos              │
│ Aplicável a: [✓] Gerente [✓] Coordenador      │
│ Status: [✓] Ativa                              │
│                                                │
│ [Ativa ✓] [Remover ×]                          │
└────────────────────────────────────────────────┘
```

**Cenários:**
- **Ativa (30min):** Gerente vê tickets ociosos após 30min
- **Ativa (15min):** Supervisão mais agressiva (SLA curto)
- **Desativada:** Gerente não supervisiona (delega totalmente)

---

### P12 - Default Allow/Deny

**Tipo:** ⚙️ Soft Core  
**Categoria:** Filosofia operacional  
**Configurável:** ✅ SIM (radio liberado/bloqueado)

**Propósito:**
- Define comportamento padrão quando nenhuma regra se aplica
- Reflete cultura da empresa (confiança vs restrição)

**Lógica:**
```javascript
// Após todas as regras, aplicar comportamento padrão
const modoBase = user.configuracao_visibilidade_nexus?.modo_visibilidade || 'padrao_liberado';

if (modoBase === 'padrao_liberado') {
  return { allow: true, code: 'DEFAULT_ALLOW' };
} else {
  return { allow: false, code: 'DEFAULT_DENY' };
}
```

**UI Nexus360:**
```
Modo Base (P12)

┌────────────────────────────────────────────────┐
│ Comportamento Padrão                           │
├────────────────────────────────────────────────┤
│                                                │
│ Quando nenhuma regra específica se aplicar,    │
│ o que deve acontecer?                          │
│                                                │
│ [●] Liberado por padrão                        │
│     ↳ Permite visualizar, bloqueios explícitos │
│                                                │
│ [ ] Bloqueado por padrão                       │
│     ↳ Nega visualizar, liberações explícitas   │
│                                                │
└────────────────────────────────────────────────┘
```

**Cenários:**
- **Liberado (confiança):** Atendente vê tudo, exceto bloqueios explícitos
- **Bloqueado (restrição):** Atendente só vê liberações explícitas

---

### FLAGS DE COLABORAÇÃO (Visibilidade Fina)

**Tipo:** ⚙️ Soft Core  
**Categoria:** Controles de colaboração  
**Configurável:** ✅ SIM (checkboxes)

#### view_unassigned (Ver Não Atribuídas)

```javascript
// Verificar se thread não atribuída está acessível
if (!thread.assigned_user_id) {
  if (user.permissoes_acoes_nexus?.podeVerNaoAtribuidas !== false) {
    return { allow: true, code: 'UNASSIGNED_ALLOWED' };
  }
  return { allow: false, code: 'UNASSIGNED_BLOCKED' };
}
```

**UI:**
```
[✓] Ver threads não atribuídas do meu setor
    ↳ Permite pegar conversas da fila "Sem dono"
```

---

#### view_assigned_others (Ver Atribuídas a Outros)

```javascript
// Alimenta P7
if (user.permissoes_acoes_nexus?.podeVerConversasOutros) {
  return { allow: true, code: 'ASSIGNED_TO_ANOTHER_BUT_ALLOWED_BY_FLAG' };
}
```

**UI:**
```
[✓] Ver conversas atribuídas a outros atendentes
    ↳ Permite supervisão de threads em andamento
```

---

#### view_others_wallet (Ver Carteiras de Outros)

```javascript
// Alimenta P6
if (user.permissoes_acoes_nexus?.podeVerCarteiraOutros) {
  return { allow: true, code: 'FIDELIZED_TO_ANOTHER_BUT_ALLOWED' };
}
```

**UI:**
```
[✓] Ver carteiras de outros atendentes
    ↳ Permite acessar contatos fidelizados a colegas
```

---

#### strict_mode (Modo Restrito)

```javascript
// Desativa P5 e P8
if (user.permissoes_acoes_nexus?.strictMode) {
  // Pular janela 24h e supervisão
  return { allow: false, code: 'ASSIGNED_TO_ANOTHER_STRICT' };
}
```

**UI:**
```
[✓] Strict Mode (Modo Restrito)
    ↳ Desativa liberações P5 e P8 - zero exceções
    ⚠️ Use para estagiários ou período de experiência
```

---

## 📊 POLÍTICAS PADRÃO POR PERFIL (JSON)

### 🎯 Perfil: AGENTE / ATENDENTE (Júnior/Pleno)

**Filosofia:** Vê apenas seu trabalho direto + fila do setor

```json
{
  "perfil_nome": "agente_pleno",
  "descricao": "Atendente júnior/pleno - foco no próprio trabalho",
  
  "configuracao_visibilidade_nexus": {
    "modo_visibilidade": "padrao_liberado",
    
    "regras_bloqueio": [
      {
        "tipo": "setor",
        "valores_bloqueados": ["outros_setores"],
        "ativa": true,
        "prioridade": 100,
        "descricao": "Bloqueio de setores fora do escopo"
      }
    ],
    
    "regras_liberacao": [
      {
        "tipo": "janela_24h",
        "ativa": true,
        "prioridade": 50,
        "configuracao": {
          "horas": 24
        }
      }
    ]
  },
  
  "permissoes_acoes_nexus": {
    "podeVerTodasConversas": false,
    "podeEnviarMensagens": true,
    "podeEnviarMidias": true,
    "podeEnviarAudios": true,
    "podeTransferirConversa": true,
    "podeApagarMensagens": false,
    
    "podeVerDetalhesContato": true,
    "podeEditarContato": true,
    "podeBloquearContato": false,
    "podeDeletarContato": false,
    
    "podeGerenciarFilas": false,
    "podeAtribuirConversas": false,
    "podeCriarPlaybooks": false,
    "podeEditarPlaybooks": false,
    "podeGerenciarConexoes": false,
    
    "podeVerRelatorios": false,
    "podeExportarDados": false,
    "podeGerenciarPermissoes": false,
    "podeVerDiagnosticos": false,
    
    "podeVerCarteiraOutros": false,
    "podeVerNaoAtribuidas": true,
    "podeVerConversasOutros": false,
    "podeVerTodosSetores": false,
    "strictMode": false
  }
}
```

**Comportamento Resultante:**
- ✅ Vê: Suas atribuídas (P3) + Sua carteira (P4) + Não atribuídas do setor
- ✅ Janela 24h: Resgata conversas que interagiu
- ❌ Não vê: Conversas de outros atendentes
- ❌ Não vê: Carteiras de outros atendentes
- ❌ Não vê: Outros setores

---

### 🎯 Perfil: SUPERVISOR (Sênior)

**Filosofia:** Vê trabalho da equipe + supervisão limitada

```json
{
  "perfil_nome": "supervisor_senior",
  "descricao": "Supervisor sênior - visibilidade da equipe",
  
  "configuracao_visibilidade_nexus": {
    "modo_visibilidade": "padrao_liberado",
    
    "regras_bloqueio": [
      {
        "tipo": "setor",
        "valores_bloqueados": ["outros_setores"],
        "ativa": true,
        "prioridade": 100,
        "descricao": "Bloqueio de setores fora do escopo"
      }
    ],
    
    "regras_liberacao": [
      {
        "tipo": "janela_24h",
        "ativa": true,
        "prioridade": 50,
        "configuracao": {
          "horas": 48
        }
      }
    ]
  },
  
  "permissoes_acoes_nexus": {
    "podeVerTodasConversas": false,
    "podeEnviarMensagens": true,
    "podeEnviarMidias": true,
    "podeEnviarAudios": true,
    "podeTransferirConversa": true,
    "podeApagarMensagens": false,
    
    "podeVerDetalhesContato": true,
    "podeEditarContato": true,
    "podeBloquearContato": true,
    "podeDeletarContato": false,
    
    "podeGerenciarFilas": true,
    "podeAtribuirConversas": true,
    "podeCriarPlaybooks": false,
    "podeEditarPlaybooks": false,
    "podeGerenciarConexoes": false,
    
    "podeVerRelatorios": true,
    "podeExportarDados": false,
    "podeGerenciarPermissoes": false,
    "podeVerDiagnosticos": true,
    
    "podeVerCarteiraOutros": true,
    "podeVerNaoAtribuidas": true,
    "podeVerConversasOutros": true,
    "podeVerTodosSetores": false,
    "strictMode": false
  }
}
```

**Comportamento Resultante:**
- ✅ Vê: Suas + Carteira + Não atribuídas + **Conversas da equipe**
- ✅ Janela 48h: Resgate estendido
- ✅ Carteiras da equipe: Pode acessar para orientar
- ❌ Não vê: Outros setores
- ❌ Não tem: Supervisão por tempo ocioso (sem P8)

---

### 🎯 Perfil: GERENTE / COORDENADOR

**Filosofia:** Supervisão ativa + intervenção em tickets ociosos

```json
{
  "perfil_nome": "gerente_coordenador",
  "descricao": "Gerente/coordenador - supervisão completa do setor",
  
  "configuracao_visibilidade_nexus": {
    "modo_visibilidade": "padrao_liberado",
    
    "regras_bloqueio": [
      {
        "tipo": "setor",
        "valores_bloqueados": ["outros_setores"],
        "ativa": true,
        "prioridade": 100,
        "descricao": "Bloqueio de setores fora do escopo (gerente setorial)"
      }
    ],
    
    "regras_liberacao": [
      {
        "tipo": "janela_24h",
        "ativa": true,
        "prioridade": 50,
        "configuracao": {
          "horas": 48
        }
      },
      {
        "tipo": "gerente_supervisao",
        "ativa": true,
        "prioridade": 60,
        "configuracao": {
          "minutos_sem_resposta": 30
        }
      }
    ]
  },
  
  "permissoes_acoes_nexus": {
    "podeVerTodasConversas": false,
    "podeEnviarMensagens": true,
    "podeEnviarMidias": true,
    "podeEnviarAudios": true,
    "podeTransferirConversa": true,
    "podeApagarMensagens": false,
    
    "podeVerDetalhesContato": true,
    "podeEditarContato": true,
    "podeBloquearContato": true,
    "podeDeletarContato": false,
    
    "podeGerenciarFilas": true,
    "podeAtribuirConversas": true,
    "podeCriarPlaybooks": true,
    "podeEditarPlaybooks": true,
    "podeGerenciarConexoes": false,
    
    "podeVerRelatorios": true,
    "podeExportarDados": true,
    "podeGerenciarPermissoes": false,
    "podeVerDiagnosticos": true,
    
    "podeVerCarteiraOutros": true,
    "podeVerNaoAtribuidas": true,
    "podeVerConversasOutros": true,
    "podeVerTodosSetores": false,
    "strictMode": false
  }
}
```

**Comportamento Resultante:**
- ✅ Vê: Todas do setor + Carteiras da equipe
- ✅ Janela 48h: Resgate estendido
- ✅ **P8 ativo:** Vê tickets ociosos >30min para intervir
- ✅ Pode: Criar/editar playbooks, gerenciar filas
- ❌ Não vê: Outros setores (gerente setorial)

---

### 🎯 Perfil: ADMINISTRADOR / DIRETOR

**Filosofia:** Acesso total cross-setorial

```json
{
  "perfil_nome": "admin_diretor",
  "descricao": "Administrador ou diretor - acesso total",
  
  "configuracao_visibilidade_nexus": {
    "modo_visibilidade": "padrao_liberado",
    
    "regras_bloqueio": [],
    
    "regras_liberacao": [
      {
        "tipo": "janela_24h",
        "ativa": true,
        "prioridade": 50,
        "configuracao": {
          "horas": 72
        }
      },
      {
        "tipo": "gerente_supervisao",
        "ativa": true,
        "prioridade": 60,
        "configuracao": {
          "minutos_sem_resposta": 15
        }
      }
    ]
  },
  
  "permissoes_acoes_nexus": {
    "podeVerTodasConversas": true,
    "podeEnviarMensagens": true,
    "podeEnviarMidias": true,
    "podeEnviarAudios": true,
    "podeTransferirConversa": true,
    "podeApagarMensagens": true,
    
    "podeVerDetalhesContato": true,
    "podeEditarContato": true,
    "podeBloquearContato": true,
    "podeDeletarContato": true,
    
    "podeGerenciarFilas": true,
    "podeAtribuirConversas": true,
    "podeCriarPlaybooks": true,
    "podeEditarPlaybooks": true,
    "podeGerenciarConexoes": true,
    
    "podeVerRelatorios": true,
    "podeExportarDados": true,
    "podeGerenciarPermissoes": true,
    "podeVerDiagnosticos": true,
    
    "podeVerCarteiraOutros": true,
    "podeVerNaoAtribuidas": true,
    "podeVerConversasOutros": true,
    "podeVerTodosSetores": true,
    "strictMode": false
  }
}
```

**Comportamento Resultante:**
- ✅ **P2:** Admin total access (sobrepõe tudo)
- ✅ Vê: Absolutamente tudo, todos setores, todos canais
- ✅ Janela 72h: Máximo resgate
- ✅ P8 (15min): Supervisão agressiva
- ✅ Pode: Tudo (gerenciar conexões, permissões, deletar, etc.)

---

### 🎯 Perfil: ESTAGIÁRIO / EXPERIÊNCIA

**Filosofia:** Restrição máxima para treinamento

```json
{
  "perfil_nome": "estagiario_experiencia",
  "descricao": "Estagiário ou período de experiência - modo restrito",
  
  "configuracao_visibilidade_nexus": {
    "modo_visibilidade": "padrao_bloqueado",
    
    "regras_bloqueio": [
      {
        "tipo": "setor",
        "valores_bloqueados": ["todos_outros"],
        "ativa": true,
        "prioridade": 100
      }
    ],
    
    "regras_liberacao": []
  },
  
  "permissoes_acoes_nexus": {
    "podeVerTodasConversas": false,
    "podeEnviarMensagens": true,
    "podeEnviarMidias": false,
    "podeEnviarAudios": false,
    "podeTransferirConversa": false,
    "podeApagarMensagens": false,
    
    "podeVerDetalhesContato": true,
    "podeEditarContato": false,
    "podeBloquearContato": false,
    "podeDeletarContato": false,
    
    "podeGerenciarFilas": false,
    "podeAtribuirConversas": false,
    "podeCriarPlaybooks": false,
    "podeEditarPlaybooks": false,
    "podeGerenciarConexoes": false,
    
    "podeVerRelatorios": false,
    "podeExportarDados": false,
    "podeGerenciarPermissoes": false,
    "podeVerDiagnosticos": false,
    
    "podeVerCarteiraOutros": false,
    "podeVerNaoAtribuidas": true,
    "podeVerConversasOutros": false,
    "podeVerTodosSetores": false,
    "strictMode": true
  }
}
```

**Comportamento Resultante:**
- ✅ Vê APENAS: Suas atribuídas (P3) + Sua carteira (P4) + Fila
- ❌ **Strict Mode:** Sem janela 24h, sem supervisão (zero exceções)
- ❌ **Padrão BLOQUEADO:** Precisa liberação explícita para ver algo
- ❌ Não pode: Enviar mídia, transferir, editar contato, etc.
- 🎓 Ideal para: Treinamento supervisionado

---

## 🎨 CLASSIFICAÇÃO DE DIVERGÊNCIAS NO SIMULADOR

### Tipologia de Severidade

#### 🚨 CRÍTICO (Furo de Segurança)

**Definição:** Legado permite, Nexus NEGA

**Regras envolvidas:** Hard Core (P1, P9, P10, P11) + Compliance

**Impacto:** Usuário **perderá acesso** a algo que vê hoje

**Exemplo:**
```javascript
{
  severity: 'error',
  tipo_divergencia: 'falso_negativo',
  regra_responsavel: 'P11',
  legado_decisao: 'ALLOW',
  nexus_decisao: 'DENY',
  nexus_reason_code: 'SECTOR_BLOCKED',
  thread_id: '...',
  impacto: 'Usuário perderá acesso a thread do setor Assistência',
  recomendacao: 'REVISAR: Bloqueio de setor é intencional ou erro de migração?'
}
```

**UI Simulador:**
```
┌────────────────────────────────────────────────┐
│ 🚨 DIVERGÊNCIA CRÍTICA (Furo de Segurança)    │
├────────────────────────────────────────────────┤
│ Thread ID: thread_123                          │
│ Contato: João Silva (Assistência)             │
│                                                │
│ Legado: ✅ VISÍVEL                             │
│ Nexus:  ❌ BLOQUEADO (SECTOR_BLOCKED)          │
│                                                │
│ Regra P11: Setor "Assistência" bloqueado      │
│                                                │
│ ⚠️ IMPACTO:                                     │
│ Usuário perderá acesso a esta thread.         │
│ Perda de continuidade no atendimento.         │
│                                                │
│ 🔧 AÇÃO RECOMENDADA:                            │
│ • Verificar se bloqueio de setor é correto    │
│ • Considerar transferir threads ativas antes  │
│   de ativar Nexus360                           │
│                                                │
│ [Ver Thread] [Remover Bloqueio] [Ignorar]     │
└────────────────────────────────────────────────┘
```

---

#### ⚠️ AVISO (Mudança de Processo)

**Definição:** Legado permite, Nexus NEGA por **política de negócio**

**Regras envolvidas:** Híbridas (P6, P7) sem flags de colaboração

**Impacto:** Mudança de **jeito de trabalhar**, não furo de segurança

**Exemplo:**
```javascript
{
  severity: 'warning',
  tipo_divergencia: 'mudanca_processo',
  regra_responsavel: 'P7',
  legado_decisao: 'ALLOW',
  nexus_decisao: 'DENY',
  nexus_reason_code: 'ASSIGNED_TO_ANOTHER',
  thread_id: '...',
  impacto: 'Usuário não verá mais conversas atribuídas a colegas',
  recomendacao: 'AJUSTAR: Ativar flag "view_assigned_others" se supervisão for necessária'
}
```

**UI Simulador:**
```
┌────────────────────────────────────────────────┐
│ ⚠️ DIVERGÊNCIA DE PROCESSO                     │
├────────────────────────────────────────────────┤
│ Thread ID: thread_456                          │
│ Contato: Maria Santos (Vendas)                │
│ Atribuída a: Pedro Costa                      │
│                                                │
│ Legado: ✅ VISÍVEL                             │
│ Nexus:  ❌ BLOQUEADO (ASSIGNED_TO_ANOTHER)     │
│                                                │
│ Regra P7: Thread atribuída a outro atendente  │
│                                                │
│ ⚠️ IMPACTO:                                     │
│ Mudança de processo: usuário não verá mais    │
│ conversas de colegas (mais privacidade).      │
│                                                │
│ 🔧 AJUSTE SUGERIDO:                             │
│ Se supervisão for necessária, ativar:          │
│ • [ ] Ver conversas atribuídas a outros       │
│ • [ ] Supervisão Gerencial (P8)               │
│ • [ ] Janela 24h (P5)                         │
│                                                │
│ [Ativar Flags] [Aceitar Mudança] [Ignorar]    │
└────────────────────────────────────────────────┘
```

---

#### ℹ️ OPORTUNIDADE (Nexus Ajuda)

**Definição:** Legado NEGA, Nexus PERMITE

**Regras envolvidas:** Liberações (P5, P8, P12)

**Impacto:** Usuário **ganhará acesso** (melhoria operacional)

**Exemplo:**
```javascript
{
  severity: 'info',
  tipo_divergencia: 'falso_positivo',
  regra_responsavel: 'P5',
  legado_decisao: 'DENY',
  nexus_decisao: 'ALLOW',
  nexus_reason_code: 'WINDOW_24H_ACTIVE',
  thread_id: '...',
  impacto: 'Usuário poderá resgatar conversas que interagiu (janela 24h)',
  recomendacao: 'OPORTUNIDADE: Melhora continuidade de atendimento'
}
```

**UI Simulador:**
```
┌────────────────────────────────────────────────┐
│ ℹ️ OPORTUNIDADE (Melhoria Operacional)        │
├────────────────────────────────────────────────┤
│ Thread ID: thread_789                          │
│ Contato: Carlos Lima (Vendas)                 │
│ Atribuída a: Ana Paula                        │
│                                                │
│ Legado: ❌ BLOQUEADO                           │
│ Nexus:  ✅ VISÍVEL (WINDOW_24H_ACTIVE)         │
│                                                │
│ Regra P5: Janela 24h - usuário interagiu      │
│ com esta thread há 12 horas.                   │
│                                                │
│ 💡 BENEFÍCIO:                                   │
│ Nexus360 permitirá que o usuário continue     │
│ atendendo clientes com quem já conversou,      │
│ mesmo após reatribuição. Melhora contexto!     │
│                                                │
│ ✅ RECOMENDAÇÃO:                                │
│ Manter esta liberação ativa.                   │
│                                                │
│ [OK, Entendi] [Desativar P5]                   │
└────────────────────────────────────────────────┘
```

---

## 📊 MATRIZ DE DIVERGÊNCIAS (Simulador)

| Legado | Nexus | Tipo | Severidade | Regra Típica | Ação |
|--------|-------|------|-----------|--------------|------|
| ✅ ALLOW | ❌ DENY | Falso Negativo | 🚨 CRÍTICO | P1, P9, P10, P11 | Revisar bloqueio |
| ✅ ALLOW | ❌ DENY | Mudança Processo | ⚠️ AVISO | P6, P7 (sem flags) | Ajustar flags |
| ❌ DENY | ✅ ALLOW | Falso Positivo | ℹ️ OPORTUNIDADE | P5, P8, P12 | Manter liberação |
| ✅ ALLOW | ✅ ALLOW | Consistente | ✅ OK | Todas | Nenhuma |
| ❌ DENY | ❌ DENY | Consistente | ✅ OK | Todas | Nenhuma |

---

## 🔄 FLUXO DE MIGRAÇÃO NEXUS360

### Fase 1: Análise (Shadow Mode)

```
1. Admin ativa "Shadow Mode" para usuário
   ↓
2. Sistema roda AMBOS motores (Legado + Nexus) em paralelo
   ↓
3. Registra divergências no banco:
   • Críticas: threads que serão bloqueadas
   • Avisos: mudanças de processo
   • Oportunidades: novas liberações
   ↓
4. Dashboard mostra resumo:
   • "5 divergências críticas detectadas"
   • "12 mudanças de processo (ajustáveis)"
   • "3 oportunidades de melhoria"
   ↓
5. Admin revisa uma a uma:
   • Ajusta bloqueios (P9, P10, P11)
   • Ativa flags de colaboração (P6, P7)
   • Configura liberações (P5, P8)
```

---

### Fase 2: Ajuste (Convergência)

```
1. Admin ajusta configuração Nexus até divergências críticas = 0
   ↓
2. Avisos e oportunidades são decisões de negócio:
   • Aceitar mudança de processo?
   • Ativar novas liberações?
   ↓
3. Testa com usuário em ambiente controlado
   ↓
4. Coleta feedback: "Está faltando ver alguma thread?"
```

---

### Fase 3: Ativação

```
1. Admin marca: sistema_permissoes_ativo = 'nexus360'
   ↓
2. Motor Nexus assume controle
   ↓
3. Motor Legado fica como fallback (7 dias)
   ↓
4. Monitoramento: logs de acessos negados
   ↓
5. Se tudo OK por 7 dias: migração completa
```

---

## 🎯 PRÓXIMOS PASSOS PRÁTICOS

### Etapa 1: Adicionar Campos ao User Entity ✅

```json
{
  "sistema_permissoes_ativo": {
    "type": "string",
    "enum": ["legado", "nexus360", "shadow"],
    "default": "legado"
  },
  
  "configuracao_visibilidade_nexus": {
    "type": "object",
    "properties": {
      "modo_visibilidade": {
        "type": "string",
        "enum": ["padrao_liberado", "padrao_bloqueado"],
        "default": "padrao_liberado"
      },
      "regras_bloqueio": {
        "type": "array",
        "items": { "..." }
      },
      "regras_liberacao": {
        "type": "array",
        "items": { "..." }
      }
    }
  },
  
  "permissoes_acoes_nexus": {
    "type": "object",
    "properties": {
      "...19 flags existentes...": "...",
      "podeVerCarteiraOutros": { "type": "boolean", "default": false },
      "podeVerNaoAtribuidas": { "type": "boolean", "default": true },
      "podeVerConversasOutros": { "type": "boolean", "default": false },
      "podeVerTodosSetores": { "type": "boolean", "default": false },
      "strictMode": { "type": "boolean", "default": false }
    }
  }
}
```

---

### Etapa 2: Criar Tela Unificada ⏳

Componente: `components/usuarios/GerenciadorUsuariosComparativo.jsx`

**Estrutura:**
- Cabeçalho com dados básicos
- Coluna Legado (read-only com "Visibilidade Calculada")
- Coluna Nexus (editável)
- Tabela comparativa dimensional
- Botões de ação (Salvar, Migrar, Simular)

---

### Etapa 3: Ajustar Motor Nexus ⏳

Arquivo: `components/lib/nexusComparator.js`

**Adicionar:**
- Verificação `strictMode` antes de P5/P8
- Suporte às 5 novas flags
- Logs detalhados com `reason_code` + `path`

---

### Etapa 4: Melhorar Simulador ⏳

Componente: `components/comunicacao/NexusSimuladorVisibilidade.jsx`

**Adicionar:**
- Classificação de severidade (Crítico/Aviso/Oportunidade)
- Cards de divergência com ações sugeridas
- Dashboard de resumo: "X críticas, Y avisos, Z oportunidades"
- Filtro por severidade

---

### Etapa 5: Criar Profiles Padrão ⏳

Arquivo: `components/usuarios/ProfilesNexusPadrao.js`

```javascript
export const PROFILES_NEXUS_DEFAULT = {
  agente_pleno: { /* JSON acima */ },
  supervisor_senior: { /* JSON acima */ },
  gerente_coordenador: { /* JSON acima */ },
  admin_diretor: { /* JSON acima */ },
  estagiario_experiencia: { /* JSON acima */ }
};

// Função para aplicar perfil padrão
export function aplicarPerfilPadrao(usuario, perfil) {
  const config = PROFILES_NEXUS_DEFAULT[perfil];
  return {
    ...usuario,
    configuracao_visibilidade_nexus: config.configuracao_visibilidade_nexus,
    permissoes_acoes_nexus: config.permissoes_acoes_nexus
  };
}
```

**UI:**
```
Nexus360 > Perfis Rápidos

[Aplicar Perfil Padrão ▼]
• Agente/Atendente
• Supervisor
• Gerente/Coordenador
• Administrador
• Estagiário/Experiência

[Customizar]
```

---

## 🏁 CONCLUSÃO E VALIDAÇÃO FINAL

### Alinhamento com Debates

| Aspecto | Debate 1 | Debate 2 | Debate 3 | Status |
|---------|---------|---------|---------|--------|
| Separação Hard/Soft | ✅ | ✅ | ✅ | 100% |
| Regras híbridas P6/P7 | ✅ | ✅ | ✅ | 100% |
| Flags de colaboração | ✅ | ✅ | ✅ | 100% |
| Políticas por perfil | — | ✅ | ✅ | 100% |
| Severidade divergências | — | — | ✅ | 100% |
| Layout código atual | — | — | ✅ | Compatível |

**Score Final de Alinhamento:** **100%** ✅

---

### Decisões Consolidadas

#### ✅ Fixado (Não Negociável)

1. **P1-P4, P9-P11:** Hard Core (lógica fixa, listas editáveis)
2. **P2:** Admin total (sobrepõe tudo, exceto futuro legal)
3. **P6-P7:** Híbridas (bloqueio base + flags de sobrescrição)
4. **P5, P8, P12:** Soft Core (totalmente configuráveis)

#### ✅ Implementar (Próxima Fase)

1. **5 novas flags:** `podeVerCarteiraOutros`, `podeVerNaoAtribuidas`, `podeVerConversasOutros`, `podeVerTodosSetores`, `strictMode`
2. **Tela unificada:** Layout 2 colunas (Legado | Nexus360)
3. **Simulador melhorado:** Severidades + ações sugeridas
4. **Profiles padrão:** 5 perfis pré-configurados

#### 🔮 Futuro (Não Urgente)

1. **Compliance/Legal:** Bloqueios LGPD, tags sensíveis
2. **RLS Postgres:** Backend filtra threads, frontend apenas UI
3. **Real-time subscribe:** Migrar de polling para subscription

---

### Pronto para Implementação?

✅ **SIM** - Arquitetura validada e pronta para codificação

**Tempo estimado total:** 6-8 horas
- Campos (1h)
- Tela unificada (3h)
- Motor Nexus ajustes (1h)
- Simulador melhorias (2h)
- Profiles padrão (1h)

---

**FIM DA ANÁLISE FINAL** 🎯