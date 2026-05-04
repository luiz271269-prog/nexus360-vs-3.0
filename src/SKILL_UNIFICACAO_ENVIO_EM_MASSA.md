# SKILL — Unificação dos Envios em Massa do Nexus360

## OBJETIVO ÚNICO DESTA SKILL
Garantir que **TODA** funcionalidade de "envio em massa para múltiplos contatos" no Nexus360
use o **mesmo motor único validado**:

```
Frontend → enviarCampanhaLote → WorkQueueItem → processarFilaBroadcast → enviarWhatsApp
```

Esse é o **Caminho #1 (Broadcast Avulso)** — único caminho com:
- ✅ Anti-ban completo (tier novo/aquecendo/maduro)
- ✅ Spread de mensagens em janela de tempo
- ✅ Delay humanizado entre envios (4-15s)
- ✅ Pausa automática a cada N envios
- ✅ Auto-pausa em 429/403
- ✅ Saturação máxima de bloqueios em 24h
- ✅ Horário comercial e fim de semana respeitados
- ✅ Auditoria em PromotionDispatchLog
- ✅ Personalização de placeholders ({{nome}}, {{empresa}}, {{atendente}}, {{tipo_contato}})


---

## REGRA ABSOLUTA NÚMERO UM

**Nenhum envio para múltiplos contatos pode ser feito por NENHUM caminho que não seja
`enviarCampanhaLote` com `modo: 'broadcast'`.**

Se encontrar código que envia em massa por outro caminho (loop direto de `enviarWhatsApp`,
`Message.create` em loop, qualquer fila customizada), é **CANDIDATO À MIGRAÇÃO**.


---

## ESTADO ATUAL — MAPA DAS TELAS QUE ENVIAM EM MASSA

| # | Tela / Componente | Botão / Trigger | Caminho atual | Status |
|---|-------------------|-----------------|---------------|--------|
| 1 | **Central de Comunicação** (`pages/Comunicacao.jsx` + `ChatWindow.jsx`) | Ícone "Ativar seleção múltipla" na ChatSidebar → marca contatos → digita → envia | `handleEnviarBroadcast` → `enviarCampanhaLote({modo:'broadcast', personalizar:false})` | ✅ **CORRIGIDO** (personalizar:true ativado) |
| 2 | **Modal de Envio em Massa** (`components/comunicacao/ModalEnvioMassa.jsx`) | Acionado da Central de Comunicação por outro fluxo | `enviarCampanhaLote({modo:'broadcast', personalizar:true})` | ✅ JÁ ESTAVA CORRETO |
| 3 | **Página de Promoções** (`pages/Promocoes.jsx`) | Botão "Disparar promoção" | A AUDITAR | 🟡 PENDENTE |
| 4 | **Página de Contatos Inteligentes** (`pages/ContatosInteligentes.jsx`) | (Não tem botão de envio em massa hoje) | — | 🟡 PENDENTE — precisa decidir se adicionar |
| 5 | **Página de Clientes** (`pages/Clientes.jsx`) | (Não tem botão de envio em massa hoje) | — | 🟡 PENDENTE — precisa decidir se adicionar |
| 6 | **Página de Leads/CRM Kanban** (`pages/LeadsQualificados.jsx`) | (A verificar) | — | 🟡 PENDENTE |
| 7 | **Sequências automáticas** (`disparadorSequenciasAutomaticas`) | Cron automático | Caminho próprio (envia direto via `enviarWhatsApp`) | 🔴 MIGRAR para fila |
| 8 | **Promoções automáticas batch/inbound** (`runPromotionBatchTick`, `runPromotionInboundTick`) | Cron automático | `enviarPromocao` (caminho próprio) | 🔴 MIGRAR para fila ou justificar exceção |


---

## PROTOCOLO DE EXECUÇÃO — 1 TELA POR VEZ

Para CADA tela na tabela acima, executar os 6 passos abaixo. **Nunca pular passos.**

### Passo 1 — Auditoria forense da tela
- Ler o arquivo da página/componente identificado.
- Localizar TODOS os pontos onde envia mensagem para mais de 1 contato.
- Listar cada caminho encontrado com: arquivo, linha, função invocada, parâmetros.

### Passo 2 — Classificar o caminho atual
- 🟢 **Já usa `enviarCampanhaLote` com `personalizar:true`** → marcar OK, próxima tela.
- 🟡 **Usa `enviarCampanhaLote` mas com `personalizar:false`** → patch de 1 linha (igual ao caso #1).
- 🔴 **Usa qualquer outro caminho** (loop, Message.create, fila customizada, `enviarWhatsApp` direto) → migração.
- ⚫ **Não tem envio em massa hoje** → decidir com o usuário se ADICIONAR botão "Envio em Massa" reusando `ModalEnvioMassa` existente.

### Passo 3 — Apresentar plano forense ao usuário
Formato obrigatório:
```
TELA:    [nome]
ARQUIVO: [caminho]
ACHADO:  [resumo do que foi encontrado]
CAMINHO ATUAL: [descrição]
CAMINHO NOVO:  enviarCampanhaLote({modo:'broadcast', personalizar:true, ...})
RISCO:   [🟢/🟡/🔴]
ROLLBACK: [como desfazer]
```

### Passo 4 — Aguardar aprovação explícita
Frases que contam: "pode aplicar", "aprovado", "sim", "aplica", "ok faz", "confirmo".
Frases que NÃO contam: "entendi", "faz sentido", "parece bom".

### Passo 5 — Aplicar com `find_replace` (NUNCA `write_file`)
- Sempre `find_replace` cirúrgico.
- Se a tela é `pages/Comunicacao.jsx`, ativar **ANTES** o `SKILL_PROTOCOLO_FORENSE_COMUNICACAO`.

### Passo 6 — Validar pós-aplicação
- Confirmar via leitura do arquivo que a mudança foi aplicada.
- Testar mentalmente: fluxo de envio com 3 contatos selecionados, mensagem com `{{nome}}`.
- Reportar ao usuário com evidência (linha exata mudada).


---

## PADRÕES OBRIGATÓRIOS PARA TODA INVOCAÇÃO DE `enviarCampanhaLote`

```js
await base44.functions.invoke('enviarCampanhaLote', {
  contact_ids: contatos.map(c => c.contact_id || c.id),  // SEMPRE contact_id (não thread.id)
  modo: 'broadcast',                                     // SEMPRE 'broadcast' (não 'promotion' aqui)
  mensagem: textoFinal,                                  // texto com {{nome}} {{empresa}} {{atendente}}
  personalizar: true,                                    // SEMPRE true (não false)
  media_url: mediaUrl || null,
  media_type: mediaType || 'none',
  media_caption: mediaCaption || null,
  integration_id: canalSelecionado || null              // null = sistema escolhe melhor canal
});
```

### Placeholders suportados pelo backend
- `{{nome}}` → primeiro nome do contato
- `{{empresa}}` → empresa do contato (ou string vazia)
- `{{atendente}}` → primeiro nome do usuário que está enviando
- `{{tipo_contato}}` → tipo do contato (lead, cliente, etc)


---

## ASSINATURA PADRÃO DA MENSAGEM EM MASSA

Sempre que o usuário tiver `attendant_sector`, anexar ao final da mensagem:

```js
mensagemFinal = `${mensagemFinal}\n\n_~ {{atendente}} (${usuario.attendant_sector})_`;
```

**NUNCA** colocar o nome literal do atendente — usar `{{atendente}}` para que o backend
faça a substituição. Isso protege contra detecção de spam (mensagens idênticas em massa).


---

## REGRAS DE OURO

✅ **SEMPRE** reusar `ModalEnvioMassa.jsx` existente quando precisar adicionar UI nova.
✅ **SEMPRE** passar `contact_ids` (do `Contact`), nunca `thread_ids`.
✅ **SEMPRE** usar `personalizar: true`.
✅ **SEMPRE** apresentar plano forense antes de migrar.
✅ **SEMPRE** validar após aplicação lendo o arquivo.

❌ **NUNCA** criar nova função backend de envio em massa — usar `enviarCampanhaLote`.
❌ **NUNCA** fazer loop de `enviarWhatsApp` no frontend para enviar em massa.
❌ **NUNCA** criar nova tela de "Envio em Massa" do zero — instanciar `ModalEnvioMassa`.
❌ **NUNCA** migrar mais de 1 tela na mesma rodada — uma por vez, com aprovação separada.


---

## EXCEÇÕES JUSTIFICADAS (não migrar)

Os seguintes caminhos têm regra de negócio própria e NÃO devem ser migrados sem decisão estratégica:

- **`enviarPromocao`** (caminho #2) — tem cooldown universal de 12h, dedup por promotion_id,
  histórico em `last_promo_ids`, logs em `PromotionDispatchLog`. É um motor especializado.
  Mover para `enviarCampanhaLote` perderia a inteligência de promoções.

- **`disparadorSequenciasAutomaticas`** (caminho #3) — gerencia steps multi-mensagem com
  intervalos por horas/dias. Migração possível mas exige sprint dedicado.

Se o usuário pedir migração de qualquer um destes, **pausar e apresentar análise de impacto antes**.


---

## CHECKLIST DE CONCLUSÃO DA SKILL

A skill está concluída quando:

- [ ] Tela #1 (Comunicação) — ✅ aplicado
- [ ] Tela #2 (ModalEnvioMassa) — ✅ já estava OK, validado
- [ ] Tela #3 (Promoções) — auditoria + plano + decisão
- [ ] Tela #4 (Contatos Inteligentes) — decisão de adicionar ou não
- [ ] Tela #5 (Clientes) — decisão de adicionar ou não
- [ ] Tela #6 (Leads/CRM) — auditoria + decisão
- [ ] Tela #7 (Sequências automáticas) — análise de migração
- [ ] Tela #8 (Promoções automáticas) — análise de exceção justificada

Cada item só é marcado após **aprovação explícita do usuário** sobre o resultado.


---

## REGISTRO DE EXECUÇÃO

| Data | Tela | Ação | Resultado |
|------|------|------|-----------|
| 2026-05-04 | #1 Comunicação (ChatWindow.jsx) | Ativar `personalizar:true` + assinatura `{{atendente}}` | Plano apresentado, aguardando aprovação |
| | | | |