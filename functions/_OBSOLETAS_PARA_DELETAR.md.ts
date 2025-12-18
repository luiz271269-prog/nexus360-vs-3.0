# FUNÇÕES OBSOLETAS PARA DELETAR

## Arquitetura v10.0.0 - Linha Imutável

As seguintes funções foram **substituídas** pela arquitetura consolidada e devem ser **DELETADAS** para evitar conflitos e erros:

---

## ❌ OBSOLETAS - PRÉ-ATENDIMENTO/URA

### 1. `functions/lib/uraProcessor.js`
**Motivo:** Substituído por `preAtendimentoHandler.js` + `FluxoController`
- Duplicava lógica de estados da URA
- Inconsistente com a máquina de estados do `preAtendimentoHandler`
- Funções `processarURA`, `aplicarStickySetor` agora dentro do `FluxoController`

**STATUS:** ✅ Manter apenas até migração final, depois DELETAR

---

### 2. `functions/cancelarMicroURASeAtendenteResponder.js`
**Motivo:** Lógica integrada no `inboundCore.js`
- Micro-URA agora é tratada no pipeline principal (etapa 2)
- Cancelamento automático por timeout ou nova mensagem do contato
- Não depende mais de `assigned_user_id === sender_id` (causa de bugs)

**STATUS:** ❌ DELETAR IMEDIATAMENTE

---

## ❌ OBSOLETAS - PROMOÇÕES

### 3. `functions/impulsionarConversas.js`
**Motivo:** Substituído por cron jobs especializados
- Lógica migrada para `runPromotionInboundTick.js` (6h)
- E `runPromotionBatchTick.js` (24h batch)
- Promotions não são mais enviadas no webhook inbound

**STATUS:** ❌ DELETAR

### 4. `functions/enviarPromocaoAutomatica.js`
**Motivo:** Funcionalidade duplicada e desatualizada
- Não respeita limites rígidos (`limite_envios_total`, `limite_envios_por_contato`)
- Não usa `promotionEngine.js` para seleção inteligente
- Não registra em `EngagementLog` corretamente

**STATUS:** ❌ DELETAR

---

## ❌ WEBHOOKS ANTIGOS

### 5. `functions/webhookWatsZapi_v8_OLD.js`
**Motivo:** Versão antiga do webhook Z-API
- Substituído por `webhookFinalZapi.js` (v9+)

**STATUS:** ❌ DELETAR

### 6. `functions/whatsappWebhookSimples.js`
**Motivo:** Versão simplificada obsoleta
- Não usa `inboundCore.js`
- Não tem normalização de payload

**STATUS:** ❌ DELETAR

### 7. `functions/whatsappWebhookSimples_v1_OLD.js`
**Motivo:** Versão ainda mais antiga

**STATUS:** ❌ DELETAR

### 8. `functions/testInboundWebhook_OLD.js`
**Motivo:** Função de teste antiga

**STATUS:** ❌ DELETAR

### 9. `functions/testeFluxoWebhookControlado_OLD.js`
**Motivo:** Teste antigo

**STATUS:** ❌ DELETAR

---

## ⚠️ CANDIDATAS À REFATORAÇÃO (Avaliar antes de deletar)

### 10. `functions/analisarComportamento.js`
**Status:** Arquivo não encontrado no sistema
- Se existir, verificar se está contaminando métricas com mensagens de sistema
- Deve ignorar mensagens com `metadata.is_system_message = true`

**STATUS:** 🔍 INVESTIGAR

### 11. `functions/motorDecisaoPreAtendimento.js`
**Motivo:** Pode estar duplicando lógica do `FluxoController`
- Se for apenas wrapper, deletar
- Se tiver lógica única, integrar no `FluxoController`

**STATUS:** 🔍 INVESTIGAR

### 12. `functions/preAtendimentoHandler.js` (LEGADO)
**Motivo:** Se existir versão duplicada ou antiga
- Manter apenas a versão corrigida v10.0.0

**STATUS:** 🔍 VERIFICAR DUPLICATAS

---

## 📋 CHECKLIST DE LIMPEZA

- [ ] Deletar `cancelarMicroURASeAtendenteResponder.js`
- [ ] Deletar `impulsionarConversas.js`
- [ ] Deletar `enviarPromocaoAutomatica.js`
- [ ] Deletar todos webhooks `*_OLD.js`
- [ ] Revisar `uraProcessor.js` → migrar funções úteis para `FluxoController` → deletar
- [ ] Verificar `analisarComportamento.js` (se existir)
- [ ] Verificar `motorDecisaoPreAtendimento.js`
- [ ] Garantir que apenas UMA versão de cada handler/webhook existe

---

## ✅ FUNÇÕES QUE DEVEM PERMANECER

### Core da Arquitetura v10.0
- ✅ `functions/preAtendimentoHandler.js` (corrigido v10)
- ✅ `functions/lib/inboundCore.js` (v10 - Linha Imutável)
- ✅ `functions/analisarIntencao.js` (corrigido v2)
- ✅ `functions/preAtendimento/fluxoController.js` (corrigido)
- ✅ `functions/lib/promotionEngine.js`
- ✅ `functions/runPromotionInboundTick.js`
- ✅ `functions/runPromotionBatchTick.js`
- ✅ `functions/buscarPromocoesAtivas.js` (v2)

### Webhooks Ativos
- ✅ `functions/webhookWapi.js` (v11)
- ✅ `functions/webhookFinalZapi.js` (v9+)

### Helpers
- ✅ `functions/lib/emojiHelper.js`
- ✅ `functions/lib/promotionEngine.js`
- ✅ `functions/lib/detectorPedidoTransferencia.js`
- ✅ `functions/lib/roteadorCentral.js`
- ✅ `functions/lib/retryHandler.js`
- ✅ `functions/lib/errorHandler.js`

### Utilitários
- ✅ `functions/enviarWhatsApp.js`
- ✅ `functions/persistirMidiaWapi.js`
- ✅ `functions/persistirMidiaZapi.js`
- ✅ `functions/processInbound.js`

---

## 🎯 RESULTADO ESPERADO

Após a limpeza:
- ✅ Zero duplicação de lógica de URA
- ✅ Zero conflitos de decisão (URA vs URA antiga)
- ✅ Pipeline único e rastreável
- ✅ Código 40-50% menor
- ✅ Manutenibilidade alta