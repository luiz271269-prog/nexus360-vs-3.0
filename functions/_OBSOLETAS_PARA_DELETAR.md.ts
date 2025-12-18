# 🗑️ FUNÇÕES OBSOLETAS - DELETADAS NA v10.0.0

## ✅ Deletadas (Limpeza Concluída)

### 1. `functions/lib/uraProcessor.js`
- **Motivo:** Toda a lógica foi absorvida pelo `FluxoController.js` v10.0.0
- **Substituído por:** `functions/preAtendimento/fluxoController.js`
- **Status:** ✅ DELETADO

### 2. `functions/preAtendimento/validadores.js`
- **Motivo:** Validações foram internalizadas no `FluxoController.processarWAITING_SECTOR_CHOICE`
- **Substituído por:** Lógica interna do FluxoController
- **Status:** ✅ DELETADO

### 3. `functions/preAtendimento/atendenteSelector.js`
- **Motivo:** Seleção delegada ao microserviço `roteamentoInteligente` e `gerenciarFila`
- **Substituído por:** Invocação direta de `base44.asServiceRole.functions.invoke('roteamentoInteligente')`
- **Status:** ✅ DELETADO

---

## ⚠️ Arquivos Candidatos à Deleção (Revisar)

### 4. `functions/cancelarMicroURASeAtendenteResponder.js`
- **Motivo:** Micro-URA agora é tratada no `inboundCore.js` (transfer_pending)
- **Ação:** Verificar se ainda é referenciado

### 5. `functions/impulsionarConversas.js`
- **Motivo:** Lógica de promoções agora usa `runPromotionInboundTick` e `runPromotionBatchTick`
- **Ação:** Verificar se ainda é chamado como cron

### 6. `functions/enviarPromocaoAutomatica.js`
- **Motivo:** Substituído pelos motores de promoção centralizados
- **Ação:** Verificar dependências

---

## 📋 Checklist de Limpeza

- [x] Deletar `uraProcessor.js`
- [x] Deletar `validadores.js`
- [x] Deletar `atendenteSelector.js`
- [x] Atualizar `preAtendimentoHandler.js` para remover imports
- [x] Atualizar `inboundCore.js` para passar `whatsappIntegration`
- [x] Adicionar estado `WAITING_STICKY_DECISION` no handler
- [ ] Revisar e deletar funções de promoção antigas (se confirmado que não são usadas)
- [ ] Verificar imports em outros arquivos que possam referenciar código deletado

---

## 🎯 Arquitetura v10.0.0 - Linha Imutável

**Pipeline Imutável:**
```
Webhook → inboundCore → preAtendimentoHandler → FluxoController
```

**Responsabilidades Claras:**
- `inboundCore`: Normalização, guardas, detecção de ciclo, chamada da IA
- `preAtendimentoHandler`: Orquestração de estados, TTL, timeouts
- `FluxoController`: Lógica de cada estado, envio de mensagens, validações internas

**Arquivos Mortos Removidos:** 3
**Redução de Complexidade:** ~800 linhas de código removidas
**Dependências Eliminadas:** 3 arquivos