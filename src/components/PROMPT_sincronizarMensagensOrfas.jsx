# PROMPT — sincronizarMensagensOrfas
**Para colar no Base44 AI**

---

## CONTEXTO DO PROBLEMA

Na central de comunicação, determinados contatos mostram thread aberta com **0 mensagens**, mas as mensagens existem no WhatsApp Business e no banco de dados.

**Diagnóstico observado:**
- Thread aberta, status correto, visibilidade OK (MATCH)
- Mas "Total: 0 mensagens" e "Não lidas: 0"
- **Exemplo real:** Contato "Pamplona Alimentos - Adilson", thread `69610b42af...`, instância A - Vendas (`+55 48 3045-2076`), telefone do contato: `+55 47 9674-4257`

**Causa raiz (desde janeiro/2026):**
As mensagens ficam vinculadas ao número da **INSTÂNCIA WhatsApp** (`+55 48 3045-2076`) em vez do **telefone real do CLIENTE** (`+55 47 9674-4257`). O sistema salva a mensagem mas não consegue fazer o match correto, então fica "órfã" — existe no banco mas não aparece na conversa.

---

## TAREFA

**Criar uma NOVA função backend chamada `sincronizarMensagensOrfas`**

### REGRAS IMPORTANTES:
- ✅ Esta é uma função **NOVA** — NÃO editar nenhuma função existente
- ✅ NÃO modificar `processInbound`, `webhookFinalZapi`, `webhookWapi` ou qualquer webhook
- ✅ NÃO modificar lógica de criação de contatos — contatos **JÁ EXISTEM**
- ✅ NÃO criar contatos novos — problema é **VINCULAÇÃO** de mensagens
- ✅ Apenas criar a função nova

---

## LÓGICA DA FUNÇÃO

### **STEP 1 — Identificar threads suspeitas**

Buscar `MessageThread` onde:
- `thread_type = 'contact_external'`
- `status = 'aberta'` (ou qualquer status ativo)
- Tem `contact_id` válido (contato existe)
- `total_mensagens = 0` ou muito baixo

Para cada thread suspeita, buscar o `Contact` vinculado e obter seu telefone real.

---

### **STEP 2 — Buscar mensagens órfãs**

Para cada thread suspeita:
1. Obter o **telefone real do cliente** (campo `telefone` em `Contact`)
2. Buscar `Message` no banco onde:
   - Criada recentemente (últimas 48h, configurável)
   - **Contém o telefone do cliente** em algum campo (metadata, sender_id, etc)
   - MAS:
     - `thread_id` da mensagem é **DIFERENTE** do `thread_id` da thread suspeita, OU
     - `thread_id` é null/vazio, OU
     - `contact_id` não bate

**⚠️ ANTES DE IMPLEMENTAR:** Ler o schema real da entidade `Message` para verificar:
- Qual campo guarda o telefone do remetente?
- Qual campo guarda o telefone do destinatário?
- Qual campo vincula ao contato?
- Qual campo vincula à thread?

---

### **STEP 3 — Normalização de telefone**

Função auxiliar:

```javascript
function normalizarTelefone(phone) {
  if (!phone) return '';
  return String(phone).replace(/[\s\-\(\)\+]/g, '').replace(/^0+/, '');
}
```

Comparar sempre os **últimos 10-11 dígitos** para evitar problemas com/sem código de país.

---

### **STEP 4 — Revinculação**

Para cada mensagem órfã encontrada:
- Atualizar `thread_id` → apontar para thread correta
- Atualizar `contact_id` → apontar para contato correto (se estiver errado)
- **NÃO deletar nada** — apenas atualizar vinculação

Usar `try/catch` individual para cada mensagem — se uma falhar, continuar com as próximas.

---

### **STEP 5 — Atualizar contadores da thread**

Depois de revincular, atualizar em `MessageThread`:
- `total_mensagens` (recontar)
- `unread_count` (recontar)
- `last_message_at` (data da última mensagem)
- `last_message_sender` (quem enviou)

---

### **STEP 6 — Log e resultado**

Retornar relatório:

```json
{
  "success": true,
  "threads_analisadas": 42,
  "mensagens_orfas_encontradas": 156,
  "mensagens_revinculadas": 145,
  "erro_count": 11,
  "modo": "diagnostico",
  "detalhes": [
    {
      "thread_id": "69610b42af...",
      "contato_nome": "Pamplona Alimentos - Adilson",
      "telefone_contato": "+5547996744257",
      "mensagens_encontradas": 23,
      "mensagens_revinculadas": 23,
      "status": "sucesso"
    }
  ]
}
```

---

## PARÂMETROS DE ENTRADA

```javascript
{
  thread_id: string | null,        // Se informado, analisa só esta thread
  contact_id: string | null,       // Se informado, analisa só threads deste contato
  periodo_horas: number,           // Default: 48. Busca mensagens das últimas X horas
  modo: 'diagnostico' | 'correcao' // diagnostico = só mostra. correcao = revincula
}
```

- Modo `"diagnostico"` é **seguro** — não altera nada, só retorna relatório
- Modo `"correcao"` executa a revinculação

---

## REGRAS OBRIGATÓRIAS

1. ✅ **NUNCA deletar mensagens** — apenas atualizar campos de vinculação
2. ✅ Função deve ser **IDEMPOTENTE** — rodar várias vezes sem duplicar/corromper dados
3. ✅ Se mensagem já está corretamente vinculada, NÃO mexer nela
4. ✅ Usar `try/catch` em cada operação individual — se uma falhar, continuar
5. ✅ Logar cada ação no console para auditoria
6. ✅ Não confundir:
   - **Instância:** número pelo qual empresa se comunica (ex: `+55 48 3045-2076`)
   - **Cliente:** número pessoal do contato (ex: `+55 47 9674-4257`)
7. ✅ Usar `base44.asServiceRole` para ler/atualizar sem restrição de RLS

---

## TESTE SUGERIDO

1. **Modo diagnóstico (seguro, sem modificações):**
   ```
   sincronizarMensagensOrfas({ 
     modo: 'diagnostico', 
     periodo_horas: 72 
   })
   ```
   Deve encontrar as mensagens do caso Pamplona/Adilson.

2. **Se o relatório estiver correto, modo correção:**
   ```
   sincronizarMensagensOrfas({ 
     modo: 'correcao', 
     thread_id: '69610b42af...' 
   })
   ```

3. **Verificar na central** — mensagens devem aparecer.

---

## OPCIONAL: Botão na tela de diagnóstico

Adicionar um botão "Sincronizar Mensagens Órfãs" em `pages/ConfiguracaoIA` ou tela de diagnóstico, que:
- Chama a função em modo `diagnostico`
- Mostra o relatório
- Permite confirmar para rodar em modo `correcao`

Isso dá controle manual ao admin sem precisar de console.

---

## ✅ Pronto para colar no Base44 AI