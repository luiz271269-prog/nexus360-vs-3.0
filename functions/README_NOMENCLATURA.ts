# 📋 Guia de Nomenclatura de Funções Backend

## ✅ Boas Práticas para Evitar Erros de KeyError

### Problema Comum
Quando uma função backend é chamada via `base44.functions.invoke('nomeFuncao', payload)`, o nome DEVE ser EXATAMENTE igual ao nome do arquivo da função (sem a extensão `.js`).

**Erro típico:**
```javascript
// ❌ ERRADO (causará KeyError: 'testarTodosFormatoZAPI')
base44.functions.invoke('testarTodosFormatoZAPI', payload);

// ✅ CORRETO
base44.functions.invoke('testarTodosFormatosZAPI', payload);
```

### Convenções Adotadas no VendaPro Pro

1. **Funções de Teste/Diagnóstico:**
   - Use verbos no infinitivo: `testar`, `diagnosticar`, `verificar`
   - Use plural para testes múltiplos: `testarTodosFormatosZAPI` (não `testarTodosFormatoZAPI`)
   - Exemplos:
     - ✅ `testarTodosFormatosZAPI.js`
     - ✅ `testarEnvioZAPI.js`
     - ✅ `diagnosticarConexoes.js`

2. **Funções de Processamento:**
   - Use verbos de ação: `processar`, `executar`, `gerar`
   - Exemplos:
     - ✅ `processarWebhookLog.js`
     - ✅ `processarEventos.js`
     - ✅ `gerarTarefasAutomaticas.js`

3. **Funções de Integração:**
   - Use padrão `nomeDaAPI` + `Acao`
   - Exemplos:
     - ✅ `enviarWhatsApp.js`
     - ✅ `evolutionAPI.js` (quando é um serviço completo)

4. **Funções Agendadas (Cron):**
   - Use verbos de ação no infinitivo
   - Exemplos:
     - ✅ `analisarClientesEmLote.js`
     - ✅ `executarFluxosAgendados.js`
     - ✅ `cicloAutoOtimizacao.js`

### Checklist antes de Deploy

- [ ] O nome do arquivo `.js` está correto e sem erros de digitação?
- [ ] A chamada no frontend usa EXATAMENTE o mesmo nome (sem extensão)?
- [ ] A função foi testada localmente antes do deploy?
- [ ] O nome segue as convenções do projeto?

### Ferramentas de Validação

Para evitar erros futuros, considere:

1. **Criar um arquivo de constantes** para nomes de funções:

```javascript
// lib/functionNames.js
export const FUNCTION_NAMES = {
  TESTAR_TODOS_FORMATOS_ZAPI: 'testarTodosFormatosZAPI',
  TESTAR_ENVIO_ZAPI: 'testarEnvioZAPI',
  PROCESSAR_WEBHOOK_LOG: 'processarWebhookLog',
  // ... outras funções
};

// Uso no frontend
import { FUNCTION_NAMES } from '@/lib/functionNames';

base44.functions.invoke(FUNCTION_NAMES.TESTAR_TODOS_FORMATOS_ZAPI, payload);
```

2. **TypeScript** (futuro): Adicionar tipos para nomes de funções, garantindo validação em tempo de desenvolvimento.

### Casos Especiais

- **Webhooks:** Devem ter nomes descritivos e incluir o provedor:
  - ✅ `inboundWebhook.js` (genérico)
  - ✅ `whatsappWebhook.js` (específico para WhatsApp)

- **Adaptadores:** Use o padrão `NomeDoServicoAdapter`:
  - ✅ `WhatsAppAdapter.js`
  - ✅ `EvolutionAPIService.js`

---

**Última atualização:** 2025-01-XX  
**Responsável:** Equipe VendaPro Pro