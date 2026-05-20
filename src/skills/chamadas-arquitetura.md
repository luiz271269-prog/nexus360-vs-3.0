# SKILL — Arquitetura de Chamadas (Áudio/Vídeo) — Nexus360

## 🔒 FASE 0 — REGRA ARQUITETURAL PERMANENTE

Esta regra é **imutável** e precede qualquer feature, refactor ou patch
relacionado a chamadas de áudio/vídeo no sistema.

Qualquer código que **viole** esta regra é considerado bug arquitetural
e deve ser corrigido antes de seguir adiante.

---

## ✅ REGRAS DE OURO (FASE 0)

### Regra 1 — WebRTC interno é SOMENTE 1:1

```
✅ WebRTC P2P → exatamente 2 participantes (caller + 1 callee)
❌ WebRTC P2P → NUNCA para grupo, setor, ou qualquer N>2
```

**Motivo técnico:** WebRTC P2P negocia uma única `RTCPeerConnection` por
peer. Para N participantes seriam necessárias N*(N-1)/2 conexões mesh —
inviável em produção (CPU, banda, NAT traversal, ICE).

**Onde isso vale:**
- `WebRTCCallManager.jsx`
- `WhatsAppCallOverlay.jsx`
- `CallSession.modo === 'interno_webrtc'`

### Regra 2 — Grupo é SEMPRE Jitsi (SFU)

```
✅ Grupo/setor (≥2 destinatários) → Jitsi via VideoCallModule
✅ Reunião externa (cliente WhatsApp) → Jitsi via VideoCallModule
❌ Grupo → NUNCA criar CallSession modo 'interno_webrtc' com callee_ids[].length > 1
```

**Motivo técnico:** Jitsi é SFU (Selective Forwarding Unit). Cada
participante envia 1 stream para o servidor, e o servidor distribui para
todos. Custo linear em vez de quadrático.

**Onde isso vale:**
- `VideoCallModule.jsx` (iframe Jitsi)
- `CallSession.modo === 'externo_jitsi'`
- Mensagem com `room_url` postada no thread

### Regra 3 — `callee_ids[]` é metadata, NÃO roteamento de mídia

```
✅ callee_ids[] serve para:
   - Notificar (IncomingCallAlert poll → tocar para cada destinatário)
   - Auditoria (saber quem foi convidado)
   - Permissão (validar se user pode entrar na sala)

❌ callee_ids[] NÃO serve para:
   - Decidir transporte de mídia
   - Estabelecer peer connections múltiplas
   - Substituir SFU
```

**Resumo:** `callee_ids[]` é uma lista de **destinatários convidados**,
não uma topologia de rede. O transporte da mídia é decidido pelo
**`modo`** (`interno_webrtc` vs `externo_jitsi`), nunca pela cardinalidade
de `callee_ids[]`.

---

## 🏗️ ARQUITETURA CANÔNICA

```
┌────────────────────────────────────────────────────────────┐
│  FRONTEND (BotaoVideochamada / Comunicacao)                │
│                                                            │
│  Apenas dispara:                                           │
│  iniciarChamada({ thread_id, tipo })                       │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│  SKILL ÚNICA (skillInitiateVideoCall)                      │
│                                                            │
│  DECIDE:                                                   │
│  - 1:1 interno     → modo: 'interno_webrtc'  → WebRTC      │
│  - Grupo interno   → modo: 'externo_jitsi'   → Jitsi       │
│  - Externo cliente → modo: 'externo_jitsi'   → Jitsi+WApp  │
│                                                            │
│  CRIA: CallSession (auditoria)                             │
│  NOTIFICA: sendInternalMessage / enviarWhatsApp            │
│  RETORNA: { session_id, overlay_type, room_url? }          │
└──────────────────────┬─────────────────────────────────────┘
                       │
                       ▼
┌────────────────────────────────────────────────────────────┐
│  FRONTEND APENAS RENDERIZA                                 │
│                                                            │
│  overlay_type === 'webrtc'  → <WhatsAppCallOverlay>        │
│  overlay_type === 'jitsi'   → <VideoCallModule>            │
└────────────────────────────────────────────────────────────┘
```

---

## 🚫 ANTI-PADRÕES PROIBIDOS

### ❌ Anti-padrão 1 — Front criando `CallSession` direto

```jsx
// PROIBIDO
const session = await base44.entities.CallSession.create({
  modo: 'interno_webrtc',
  callee_ids: [user1, user2, user3], // ← N>1 com WebRTC: BUG
  ...
});
setSessaoInterna(session);
```

**Correto:** sempre delegar à skill:

```jsx
const res = await base44.functions.invoke('skillInitiateVideoCall', {
  thread_id: thread.id, tipo, ...
});
// Renderizar com base em res.data.overlay_type
```

### ❌ Anti-padrão 2 — Decidir transporte pelo front

```jsx
// PROIBIDO
const modo = isGrupo ? 'externo_jitsi' : 'interno_webrtc';
```

**Correto:** front passa contexto (thread, destinatários), skill decide
transporte.

### ❌ Anti-padrão 3 — Estado preso sem cleanup

```jsx
// PROIBIDO — sem timeout de falha
setSessaoInterna({ ... });
// Se WebRTC nunca conecta, botões ficam travados para sempre
```

**Correto:** todo `setSessaoInterna` deve ter timeout de fallback
(30s) que limpa o estado e mostra erro se a conexão não estabelecer.

---

## 🔍 CHECKLIST DE VALIDAÇÃO ANTES DE QUALQUER PATCH

Antes de aplicar qualquer mudança em código de chamadas, responder:

- [ ] Esta mudança respeita "WebRTC = só 1:1"?
- [ ] Esta mudança respeita "Grupo = só Jitsi"?
- [ ] O front está apenas consumindo a skill (não decidindo transporte)?
- [ ] `callee_ids[]` está sendo usado só para notificação/auditoria?
- [ ] Existe cleanup automático em caso de falha de conexão?
- [ ] `CallSession` é criada exclusivamente pela skill?

Se algum item for **NÃO**, **PARAR** e revisar antes de aplicar.

---

## 📋 ARQUIVOS COBERTOS POR ESTA REGRA

| Arquivo | Responsabilidade |
|---|---|
| `functions/skillInitiateVideoCall.js` | **Orquestrador único** — decide modo, cria CallSession, notifica |
| `functions/buscarChamadasEntrantes.js` | Polling para destinatários (lê `callee_ids[]`) |
| `functions/limparCallSessionsOrfas.js` | Cron de cleanup |
| `components/comunicacao/BotaoVideochamada.jsx` | **Apenas consome** a skill |
| `components/comunicacao/WhatsAppCallOverlay.jsx` | UI WebRTC 1:1 |
| `components/comunicacao/WebRTCCallManager.jsx` | Manager P2P 1:1 |
| `components/comunicacao/VideoCallModule.jsx` | iframe Jitsi (grupo + externo) |
| `components/comunicacao/IncomingCallAlert.jsx` | Toca alerta para destinatários |

---

## 🗓️ FASES POSTERIORES (referência)

| Fase | Escopo | Status |
|---|---|---|
| **Fase 0** | Regra arquitetural (este documento) | ✅ vigente |
| Fase 1 | Higiene operacional (limpeza órfãs) | ✅ concluída |
| Fase 2 | Resiliência (backoff exponencial, 429) | ✅ concluída |
| Fase 3.1 | Skill aceita grupo + retorna `overlay_type` | 🟡 planejada |
| Fase 3.2 | `BotaoVideochamada` refatorado para delegar | 🟡 planejada |
| Fase 3.3 | `IncomingCallAlert` toca para grupo Jitsi | 🟡 planejada |
| Fase 4 | TURN server (NAT traversal corporativo) | 🔵 backlog |
| Fase 5 | `CallParticipant` (auditoria individual) | 🔵 backlog |

---

## ⚖️ HISTÓRICO DE DECISÃO

- **2026-05-20** — Fase 0 registrada como regra permanente após 4 debates
  arquiteturais convergentes (Jitsi-MVP, CallParticipant, Delegar-à-skill,
  Convergência-final). Decisão: front é fino, skill é orquestrador,
  WebRTC só 1:1, grupo só Jitsi, `callee_ids[]` é metadata.

---

**FIM DA REGRA FASE 0 — IMUTÁVEL**