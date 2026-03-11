# PROMPT: Diagnóstico Completo, Unificação de Contato Duplicado e Recuperação de Mensagens Perdidas

## CONTEXTO DO SISTEMA

Este sistema é um CRM com as seguintes entidades críticas:
- **Contact**: dados do contato (nome, telefone, empresa, scores, flags)
- **MessageThread**: conversa/thread vinculada ao contato (`contact_id`, `is_canonical`, `status`, `total_mensagens`)
- **Message**: mensagens físicas vinculadas a uma thread (`thread_id`, `sender_id`, `sender_type`, `content`, `channel`)

---

## OBJETIVO

Dado um contato com **dados incompletos, desatualizados ou mensagens não aparecendo na tela**, executar:

1. **Diagnóstico completo** do contato e suas threads
2. **Identificação da causa raiz** do problema
3. **Reparação cirúrgica** dos dados sem destruir histórico
4. **Validação final** do estado correto

---

## PASSO 1 — BUSCA E IDENTIFICAÇÃO DO CONTATO

### 1.1 Buscar por telefone canônico
```
Entidade: Contact
Filtro: { "telefone_canonico": "<NUMERO_SEM_PREFIXO>" }
OU
Filtro: { "telefone": { "$regex": "<NUMERO>" } }
```

### 1.2 Buscar por nome/empresa
```
Entidade: Contact
Filtro: { "nome": { "$regex": "<NOME_PARCIAL>", "$options": "i" } }
OU
Filtro: { "empresa": { "$regex": "<EMPRESA_PARCIAL>", "$options": "i" } }
```

### 1.3 Verificar dados do contato encontrado
Campos críticos a inspecionar:
- `id` → ID único do contato
- `nome`, `empresa`, `telefone`, `telefone_canonico`
- `tipo_contato` → novo / lead / cliente / fornecedor / parceiro
- `is_cliente_fidelizado`, `is_vip`, `is_prioridade`
- `score_engajamento`, `cliente_score`
- `segmento_atual`, `estagio_ciclo_vida`
- `whatsapp_status` → verificado / nao_verificado / invalido / bloqueado
- `bloqueado` → boolean
- `classe_abc`, `score_abc`

---

## PASSO 2 — BUSCA DE TODAS AS THREADS DO CONTATO

### 2.1 Buscar TODAS as threads vinculadas ao contact_id
```
Entidade: MessageThread
Filtro: { "contact_id": "<ID_DO_CONTATO>" }
Sort: { "created_date": -1 }
Limit: 50
```

### 2.2 Inspecionar cada thread
Para cada thread retornada, verificar:

| Campo | O que verificar |
|-------|-----------------|
| `id` | ID da thread |
| `is_canonical` | Se é a thread principal (deve existir apenas 1 com `true`) |
| `status` | `aberta` / `fechada` / `merged` / `arquivada` |
| `merged_into` | ID da thread canônica (se status=merged) |
| `total_mensagens` | Quantas mensagens registradas |
| `channel` | `whatsapp` / `interno` / etc |
| `whatsapp_integration_id` | ID da integração usada |
| `origin_integration_ids` | Array com TODAS as integrações que já usaram esta thread |
| `sector_id` | Setor (vendas / assistencia / financeiro) |
| `last_message_content` | Preview da última mensagem |
| `last_message_at` | Data da última mensagem |
| `primeira_mensagem_at` | Data da primeira mensagem |
| `assigned_user_id` | Atendente responsável |

### 2.3 Classificar as threads encontradas
```
THREAD CANÔNICA: is_canonical=true, status=aberta ou fechada → é onde as mensagens DEVEM estar
THREAD MERGED: status=merged → foi unificada, apontando para merged_into
THREAD ÓRFÃ: sem contact_id ou contact_id incorreto
THREAD DUPLICADA: is_canonical=true em mais de uma thread do mesmo contato (BUG)
```

---

## PASSO 3 — DIAGNÓSTICO DE MENSAGENS PERDIDAS

### 3.1 Contar mensagens físicas por thread
Para CADA thread encontrada no Passo 2:
```
Entidade: Message
Filtro: { "thread_id": "<ID_DA_THREAD>" }
Limit: 100
```

Comparar:
- `total_mensagens` (campo da thread) vs contagem real de Message
- Se divergência → **contador desatualizado** (problema de desnormalização)

### 3.2 Verificar mensagens na thread MERGED
**Este é o erro mais comum:**
- Thread antiga tem `status=merged` e `merged_into=<ID_CANONICA>`
- Porém as mensagens físicas (Message) ainda têm `thread_id=<ID_ANTIGA>`
- A UI busca apenas pela thread canônica → mensagens ficam **invisíveis**

### 3.3 Verificar mensagens com thread_id inexistente
```
Entidade: Message
Filtro: { "sender_id": "<ID_DO_CONTATO>", "sender_type": "contact" }
Sort: { "created_date": -1 }
Limit: 50
```
→ Ver se existem mensagens do contato em threads que não aparecem na busca principal.

---

## PASSO 4 — DIAGNÓSTICO DE DADOS DESATUALIZADOS

### 4.1 Verificar flags de fidelização
Se o contato é claramente um cliente ativo mas `is_cliente_fidelizado=false` ou `tipo_contato=novo`:
- Verificar histórico de mensagens para confirmar relação de cliente
- Atualizar manualmente se necessário

### 4.2 Verificar scores zerados
Se `score_engajamento=0` ou `cliente_score=0` mas há histórico de mensagens:
- Calcular score aproximado baseado em: número de mensagens, data última interação, tipo de contato
- Score sugerido para cliente ativo com histórico: 70-85

### 4.3 Verificar segmentação
Se `segmento_atual=null` ou `estagio_ciclo_vida=null`:
- Inferir baseado em: `tipo_contato`, histórico de vendas, data última interação
- Cliente recorrente → `segmento_atual=cliente_ativo`, `estagio_ciclo_vida=fidelizacao`

### 4.4 Verificar status WhatsApp
Se há mensagens WhatsApp recentes mas `whatsapp_status=nao_verificado`:
- Atualizar para `verificado`

---

## PASSO 5 — PLANO DE REPARAÇÃO

Baseado no diagnóstico, montar lista de correções:

### Correções no Contact:
```json
{
  "empresa": "<NOME_COMPLETO_CORRETO>",
  "tipo_contato": "cliente",
  "is_cliente_fidelizado": true,
  "is_vip": true,
  "is_prioridade": true,
  "score_engajamento": 80,
  "cliente_score": 80,
  "segmento_atual": "cliente_ativo",
  "estagio_ciclo_vida": "fidelizacao",
  "whatsapp_status": "verificado",
  "bloqueado": false
}
```

### Correções na Thread Canônica:
```json
{
  "channel": "whatsapp",
  "total_mensagens": <CONTAGEM_REAL>,
  "sector_id": "vendas",
  "last_message_content": "<CONTEUDO_ULTIMA_MENSAGEM>",
  "last_message_at": "<DATA_ULTIMA_MENSAGEM>",
  "primeira_mensagem_at": "<DATA_PRIMEIRA_MENSAGEM>",
  "origin_integration_ids": ["<ID_INTEGRACAO_1>", "<ID_INTEGRACAO_2>"],
  "is_canonical": true,
  "status": "aberta"
}
```

### Migração de Mensagens (se thread merged com mensagens presas):
```
Entidade: Message
Filtro: { "thread_id": "<ID_THREAD_ANTIGA_MERGED>" }
Update: { "thread_id": "<ID_THREAD_CANONICA>" }
```
→ Move TODAS as mensagens da thread antiga para a canônica.

---

## PASSO 6 — APLICAR CORREÇÕES

### 6.1 Ordem de execução (CRÍTICA)
1. **Primeiro**: Migrar mensagens (Message.thread_id)
2. **Segundo**: Atualizar contador da thread canônica (MessageThread.total_mensagens)
3. **Terceiro**: Atualizar dados do contato (Contact)
4. **Quarto**: Atualizar metadados da thread canônica

### 6.2 Verificação pós-correção
Após aplicar:
```
Entidade: Message
Filtro: { "thread_id": "<ID_THREAD_CANONICA>" }
→ Deve retornar o número correto de mensagens

Entidade: MessageThread
Filtro: { "id": "<ID_THREAD_CANONICA>" }
→ total_mensagens deve bater com contagem acima

Entidade: MessageThread
Filtro: { "contact_id": "<ID_CONTATO>", "is_canonical": true }
→ Deve retornar exatamente 1 thread
```

---

## PASSO 7 — CHECKLIST FINAL DE VALIDAÇÃO

```
[ ] Contact.tipo_contato = correto (cliente/lead/fornecedor)
[ ] Contact.whatsapp_status = verificado (se tem msgs WA recentes)
[ ] Contact.bloqueado = false (se não há motivo de bloqueio)
[ ] Contact.score_engajamento > 0 (se tem histórico)
[ ] Contact.segmento_atual = preenchido
[ ] Contact.estagio_ciclo_vida = preenchido
[ ] MessageThread com is_canonical=true existe (apenas 1)
[ ] MessageThread.status = aberta (se conversa ativa)
[ ] MessageThread.total_mensagens = contagem real de Message
[ ] Message.thread_id = ID da thread canônica (todas as msgs)
[ ] Nenhuma mensagem presa em thread merged/arquivada
```

---

## CASO REAL: DEJAIR / SETUP SERVIÇOS ESPECIALIZADOS LTDA ME

### Problema relatado:
> "Contato com 5 mensagens listadas, mas nenhuma aparecia na tela"

### Diagnóstico encontrado:
1. **Contato**: dados básicos incompletos (scores zerados, flags de cliente não marcadas)
2. **Threads**: existiam 2 threads — uma `merged` (antiga) e uma `canônica` (nova)
3. **Causa raiz**: As 10 mensagens físicas tinham `thread_id` apontando para a thread `merged` (antiga). A thread canônica tinha `total_mensagens=5` mas zero mensagens físicas vinculadas. A UI busca mensagens pela thread canônica → retornava lista vazia.

### Solução aplicada:
1. Migração: `Message.thread_id` de `69308858...` → `69b155454e...` (10 registros)
2. Atualização: `MessageThread.total_mensagens = 10` na thread canônica
3. Atualização: Contact com flags, scores e segmentação corretos

### Resultado:
- ✅ 10 mensagens visíveis na tela de comunicação
- ✅ Histórico completo restaurado (dez/2025)
- ✅ Dados do contato atualizados e precisos

---

## PADRÕES DE ERROS MAIS COMUNS

| Sintoma | Causa provável | Solução |
|---------|----------------|---------|
| "0 mensagens" mas contato tem histórico | Messages presas em thread merged | Migrar Message.thread_id para canônica |
| Contador desatualizado na thread | Falha de desnormalização | Contar Messages e atualizar total_mensagens |
| Mesmo contato aparece duplicado | Dois Contact com mesmo telefone | Merge contacts + migrar threads |
| Contato bloqueado sem motivo | Flag legada não limpa | Atualizar bloqueado=false, motivo_bloqueio=null |
| Score sempre zero | Score nunca calculado para contato antigo | Calcular manualmente e persistir |
| Thread sem contact_id | Webhook criou thread órfã | Vincular contact_id correto |
| 2 threads is_canonical=true | Bug de duplicação | Manter a mais recente, colocar outra como merged |

---

## NOTAS IMPORTANTES

- **NUNCA deletar mensagens** — apenas revinculá-las via thread_id
- **NUNCA deletar threads** — apenas mudar status para merged/arquivada
- **Sempre verificar** se há mensagens na thread antiga antes de qualquer operação de merge
- **O merge não migra automaticamente** as mensagens físicas — isso deve ser feito manualmente
- **Após migração**, sempre atualizar `total_mensagens` na thread canônica
- **Threads com status=merged** devem ter `merged_into` preenchido com o ID da canônica