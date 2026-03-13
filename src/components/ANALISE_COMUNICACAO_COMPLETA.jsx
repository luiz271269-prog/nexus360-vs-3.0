# 🧠 ANÁLISE COMPLETA — Módulo Central de Comunicação
## Base44 NexusEngine CRM | Aplicando PROMPT #1

---

## 1. 🗺️ MAPA ARQUITETURAL

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENTRADAS DE DADOS                                    │
│  Usuário Clica   Webhook Z-API/W-API/Meta   Automação Jarvis   Tempo Real  │
│  (UI actions)    (mensagens externas)        (WorkQueueItem)   (subscribe)  │
└──────────┬───────────────────┬──────────────────┬─────────────────┬─────────┘
           │                   │                  │                 │
           ▼                   ▼                  ▼                 ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          pages/Comunicacao.jsx (2662 linhas) ⚠️              │
│                                                                             │
│  Estado Central:                                                            │
│  - threadAtiva, filterScope, searchTerm, debouncedSearchTerm               │
│  - selectedAttendantId, selectedIntegrationId, selectedCategoria           │
│  - modoSelecaoMultipla, contatosSelecionados, broadcastInterno             │
│  - modoEnvioMassa, criandoNovoContato, showContactInfo                     │
│                                                                             │
│  Queries (TanStack Query):                                                  │
│  - currentUser (base44.auth.me)                                            │
│  - integracoes (WhatsAppIntegration.list)                                  │
│  - threads-internas (MessageThread.filter team_internal|sector_group)      │
│  - threads-externas (buscarThreadsLivre function)                          │
│  - contacts (buscarContatosLivre function)                                 │
│  - contacts-search (buscarContatosLivre + fuzzy)                          │
│  - clientes (Cliente.list)                                                 │
│  - atendentes (listarUsuariosParaAtribuicao function)                      │
│  - mensagens (Message.filter por thread_id)                                │
│  - analises-comportamentais (ContactBehaviorAnalysis.filter)              │
│  - goto-integrations (GoToIntegration.list)                               │
└──────────┬───────────────────────────────────────────────────────────────┬──┘
           │                                                               │
           ▼                                                               ▼
┌──────────────────────┐                              ┌──────────────────────┐
│   ChatSidebar.jsx    │                              │   ChatWindow.jsx     │
│                      │                              │                      │
│ Props recebidas:     │                              │ Props recebidas:     │
│ - threads filtradas  │                              │ - thread ativa       │
│ - threadAtiva        │                              │ - mensagens          │
│ - loading            │                              │ - usuario            │
│ - integracoes        │                              │ - integracoes        │
│ - atendentes         │                              │ - atendentes         │
│                      │                              │                      │
│ Lógica interna:      │                              │ Funcionalidades:     │
│ - resolveThreadUI()  │                              │ - Exibir msgs        │
│ - getUnreadCount()   │                              │ - Enviar msg         │
│ - Filtro service_*   │                              │ - Upload mídia       │
│ - Ordenação recência │                              │ - Reply msg          │
└──────────────────────┘                              │ - Encaminhar msg     │
                                                      │ - Notas internas     │
                                                      └──────────────────────┘
           │                                                       │
           ▼                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           FUNÇÕES BACKEND                                    │
│                                                                              │
│  buscarThreadsLivre   → SELECT threads (sem RLS, com filtros)               │
│  buscarContatosLivre  → SELECT contacts (sem RLS, com _meta)                │
│  listarUsuariosParaAtribuicao → SELECT users (role/sector)                  │
│  sendInternalMessage  → CREATE Message (canal interno)                       │
│  enviarWhatsApp       → POST Z-API/W-API + CREATE Message                   │
│  getOrCreateContactCentralized → UPSERT Contact (dedup por telefone)        │
│  enriquecerContatosEmLote → UPDATE Contact (nome/foto via Z-API)            │
│  encaminharMensagem   → CREATE Message (forward)                             │
└──────────────────────────────────────────────────────────────────────────────┘
           │                                                       │
           ▼                                                       ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            ENTIDADES DO BANCO                                │
│                                                                              │
│  MessageThread    MessageMessage    Contact    WhatsAppIntegration           │
│  User (atend.)    Cliente           GoToInteg. ContactBehaviorAnalysis       │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. 📦 INVENTÁRIO DE ENTIDADES

| Entidade | Lida Por | Filtro de Leitura | Escrita Por | Campos Críticos |
|---|---|---|---|---|
| **MessageThread** | `buscarThreadsLivre` | status=aberta, limit=500 | `handleCriarNovoContato`, `handleEnviarMensagemOtimista` | thread_type, contact_id, assigned_user_id, participants, pair_key, unread_by, last_message_at |
| **Message** | `useQuery mensagens` | thread_id = threadAtiva.id | `handleEnviarMensagemInternaOtimista`, `handleEnviarMensagemOtimista`, `Message.create()` | thread_id, sender_id, content, channel, status, sent_at |
| **Contact** | `buscarContatosLivre` | sem RLS, global | `getOrCreateContactCentralized`, `Contact.update()` | nome, telefone, tipo_contato, tags, score_abc, is_cliente_fidelizado |
| **WhatsAppIntegration** | `WhatsAppIntegration.list()` | sem filtro | `ConfiguracaoCanaisComunicacao` | status, api_provider, setores_atendidos, cor_chat |
| **Cliente** | `Cliente.list()` | sem filtro, 200 | nunca nesta página | razao_social, telefone, vendedor_id |
| **ContactBehaviorAnalysis** | `filter({analyzed_at >= 24h})` | últimas 24h | `analise_diaria_contatos` (auto) | days_inactive_inbound, deal_risk, priority_label |
| **User** | `listarUsuariosParaAtribuicao` | function | `UserAuthWidget`, `base44.auth.updateMe()` | role, attendant_sector, attendant_role, whatsapp_permissions |

**Chave de Deduplicação de Threads:**
- `pair_key` = `minId:maxId` para threads 1:1 internas
- `sector_key` = `sector:nome` para grupos de setor
- `contact_id` = deduplicação por contato (uma thread canônica por contato)

---

## 3. ⚙️ INVENTÁRIO DE FUNÇÕES BACKEND

### `buscarThreadsLivre`
- **Trigger:** `useQuery(['threads-externas'])` — a cada 90s
- **Input:** `{ status, limit, incluirInternas }`
- **Processamento:** SELECT MessageThread sem RLS, filtra por status aberta, ordena por last_message_at
- **Output:** `{ success: true, threads: [...] }` — array com threads externas
- **IA:** Não usa

### `buscarContatosLivre`
- **Trigger:** `useQuery(['contacts'])` — a cada 60s
- **Input:** `{ searchTerm, limit }`
- **Processamento:** SELECT Contact sem RLS, injeta `_meta: { score_completude, tem_dados_basicos }`
- **Output:** `{ success: true, contatos: [...] }` — com _meta preservado
- **IA:** Não usa

### `sendInternalMessage`
- **Trigger:** `handleEnviarMensagemInternaOtimista` — click "enviar" em thread interna
- **Input:** `{ thread_id, content, media_type, media_url, reply_to_message_id }`
- **Processamento:** valida thread interna, cria Message, atualiza unread_by, atualiza last_message_at
- **Output:** `{ success: true, message: {...} }`
- **Banco:** CREATE Message + UPDATE MessageThread

### `enviarWhatsApp`
- **Trigger:** `handleEnviarMensagemOtimista` — click "enviar" em thread externa
- **Input:** `{ integration_id, numero_destino, mensagem | media_url | audio_url }`
- **Processamento:** POST para Z-API/W-API/Meta, recebe message_id
- **Output:** `{ success: true, message_id: "..." }`
- **Banco:** (frontend faz CREATE Message após resposta)

### `getOrCreateContactCentralized`
- **Trigger:** `handleCriarNovoContato` — formulário de novo contato
- **Input:** `{ telefone, pushName, profilePicUrl }`
- **Processamento:** normaliza telefone E.164, busca por telefone_canonico, cria se não existe
- **Output:** `{ success: true, contact: {...}, created: bool }`
- **Banco:** CREATE ou GET Contact

---

## 4. 🔄 FLUXO DE DADOS DETALHADO

### Fluxo: Usuário Abre Comunicação
```
1. Componente monta
2. TanStack Query dispara 3 queries em paralelo:
   - currentUser (auth.me)
   - integracoes (WhatsAppIntegration.list)
   - threads-externas (buscarThreadsLivre)
3. threadsInternas query dispara separado (60s staleTime)
4. contacts query dispara APÓS threads carregarem (dependência de IDs)
5. permissionsService.buildUserPermissions(user, integracoes) → userPermissions
6. threads = [...threadsExternas, ...threadsInternas] (combinadas)
7. threadsFiltradas = VISIBILITY_MATRIX filter (12 regras por prioridade)
8. listaRecentes = deduplicadas + ordenadas por recência
9. ChatSidebar renderiza threadsParaExibir
10. Real-time: MessageThread.subscribe → debounce 2s → invalidateQueries
```

### Fluxo: Envio de Mensagem WhatsApp
```
1. Usuário digita + clica enviar (MessageInput)
2. handleEnviarMensagemOtimista chamado
3. msgTemp criado (id: temp-{timestamp})
4. queryClient.setQueryData(['mensagens', threadId]) → mensagem aparece INSTANTANEAMENTE
5. base44.functions.invoke('enviarWhatsApp', payload) [background]
6. Se sucesso: Message.create() + MessageThread.update() + invalidateQueries
7. Se falhou: remover msgTemp do cache (ROLLBACK)
```

### Fluxo: Thread Interna com Conta de Serviço (BUG CORRIGIDO)
```
ANTES:
1. Jarvis cria thread com participants: [userId, service_fbdc8...] ← BUG
2. Thread aparece no ChatSidebar
3. resolveThreadUI tenta User.find(service_fbdc8...) → undefined
4. "Usuário não encontrado" na UI

DEPOIS (correção aplicada):
1. threadsInternas query: filtra service_* ANTES de retornar
2. ChatSidebar.threadsFiltradas: filtra service_* redundantemente
3. threadMaisRecentePorContacto: skip service_* na deduplicação
```

---

## 5. 🔀 CICLO DE VIDA DOS STATUS DE THREAD

```
[aberta]
   │
   ├──→ Recebeu mensagem → last_message_at atualizado
   │
   ├──→ Atribuída → assigned_user_id preenchido
   │
   ├──→ Pre-atendimento → pre_atendimento_ativo=true → state: INIT → WAITING_* → COMPLETED
   │
   ├──→ Idle 48h (Watchdog Tipo C) → WorkQueueItem criado para Jarvis
   │
   ├──→ Unificada com outra → [merged] + merged_into = thread canônica
   │
   └──→ Manual → [fechada] ou [arquivada]
```

---

## 6. 🗺️ MAPA ENTIDADES ↔ FUNÇÕES

| Entidade | Lida Por | Escrita Por | Operação |
|---|---|---|---|
| `MessageThread` | `buscarThreadsLivre`, `MessageThread.filter` | `MessageThread.create`, `MessageThread.update` | CREATE+UPDATE |
| `Message` | `Message.filter({thread_id})` | `Message.create`, `sendInternalMessage` | CREATE |
| `Contact` | `buscarContatosLivre`, `Contact.get` | `getOrCreateContactCentralized`, `Contact.update` | UPSERT+UPDATE |
| `WhatsAppIntegration` | `WhatsAppIntegration.list` | `ConfiguracaoCanaisComunicacao` | READ |
| `ContactBehaviorAnalysis` | `filter({analyzed_at >= 24h})` | automação `analise_diaria_contatos` | READ |
| `User` | `listarUsuariosParaAtribuicao` | `base44.auth.updateMe` | READ |

---

## 7. 🔴 GAPS E PROBLEMAS IDENTIFICADOS

| # | Descrição | Impacto | Arquivo | Solução |
|---|---|---|---|---|
| 1 | **pages/Comunicacao.jsx tem 2662 linhas** | Manutenção impossível, file bloqueado para edição acima de 2000 linhas | `pages/Comunicacao.jsx` | Extrair `useThreadsFiltradas` hook (600+ linhas), `useThreadsData` hook |
| 2 | **Threads service_* visíveis na UI** | "Usuário não encontrado" ao clicar | `Comunicacao.jsx:257`, `ChatSidebar:211` | ✅ CORRIGIDO — filtro `service_*` aplicado em 3 camadas |
| 3 | **threadMaisRecentePorContacto** com 500+ threads sem timeout | UI lenta em usuários com muitas threads | `Comunicacao.jsx:1528` | Usar `useDeferredValue` ou `startTransition` |
| 4 | **Real-time subscribe** invalida queries sem verificar rate limit | 429 em alta concorrência | `Comunicacao.jsx:213` | ✅ Debounce 2s já aplicado |
| 5 | **`carregarThreadsInternas`** em `internalThreadsService` NÃO filtra service_* | Threads sujas vêm do backend | `internalThreadsService.js:6` | ✅ CORRIGIDO — filtro na query inline |
| 6 | **Mensagens carregadas sempre top 20** | Histórico truncado, sem paginação | `Comunicacao.jsx:575` | `useMensagensPaginadas` hook já existe — substituir |
| 7 | **`contacts` query depende de IDs** mas recarrega todos os 1000 contatos | Overhead de rede | `Comunicacao.jsx:400` | Limitar por `contactIdsParaCarregar` no backend |

---

## 8. 🔗 DEPENDÊNCIAS EXTERNAS

| Serviço | Como Usa | Secret |
|---|---|---|
| **Z-API** | Envio de mensagens WhatsApp | Em `WhatsAppIntegration.api_key_provider` |
| **W-API** | Alternativa Z-API | Em `WhatsAppIntegration.api_key_provider` |
| **Meta Cloud API** | WhatsApp Business API | Em `WhatsAppIntegration.meta_phone_number_id` |
| **GoTo** | SMS/Phone | `GoToIntegration` entity |
| **Base44 AI (InvokeLLM)** | Análise de comportamento (indireta via automações) | Interno Base44 |

---

## 9. 🏗️ ARQUITETURA ATUAL vs IDEAL

### Atual (problema):
```
pages/Comunicacao.jsx (2662 linhas)
├── 10 queries TanStack
├── 4 useMemo grandes (threadsFiltradas: 600 linhas)
├── 6 handlers de evento
├── 3 handlers otimistas (envio msg)
└── render JSX (400 linhas)
```

### Ideal (refatoração proposta):
```
pages/Comunicacao.jsx (~400 linhas)
├── hooks/useThreadsData.js          ← queries + real-time
├── hooks/useThreadsFiltradas.js     ← filtragem + deduplicação (600 linhas)
├── hooks/useThreadsHandlers.js      ← handlers de ação
└── components/ComunicacaoLayout.jsx ← render JSX
```

---

## 10. 🔐 SISTEMA DE PERMISSÕES (VISIBILITY_MATRIX)

```
Prioridade  Regra                    Resultado
─────────────────────────────────────────────
1           thread_interna           ← ALLOW se participante/admin
2           thread_atribuida         ← ALLOW se atribuída ao usuário  
2.5         historico_atendimento    ← ALLOW se já atendeu
3           contato_fidelizado       ← ALLOW se contato fidelizado
4           bloqueio_integracao      ← DENY se integração bloqueada
5           bloqueio_setor           ← DENY se setor bloqueado
6           bloqueio_canal           ← DENY se canal bloqueado
7           janela_24h               ← ALLOW se inbound < 24h
8           fidelizado_outro         ← DENY se fidelizado a outro
9           atribuido_outro          ← DENY se atribuído a outro
10          gerente_supervisao       ← ALLOW se gerente + thread parada
12          nexus360_default         ← ALLOW (fail-safe)
```

---

*Análise gerada em: 13/03/2026 | Usando PROMPT #1 — Análise Completa*