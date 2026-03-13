# 🧠 PROMPTS PROFISSIONAIS DE ANÁLISE DE SISTEMA
## Base44 — Plataforma CRM NexusEngine

---

## 📌 PROMPT 1 — ANÁLISE COMPLETA DE ENTIDADES E FUNÇÕES

Use este prompt para analisar qualquer módulo/página do sistema e mapear como os dados fluem.

```
Você é um arquiteto de software sênior especializado em análise de sistemas CRM/SaaS construídos com React + Base44.

Preciso de uma análise COMPLETA e ESTRUTURADA do seguinte módulo/página: [NOME_DO_MODULO]

## CONTEXTO DO SISTEMA
- Plataforma: Base44 (React + Deno + PostgreSQL)
- Stack: React, TailwindCSS, TanStack Query, Shadcn/UI
- Backend: Funções Deno no diretório /functions
- Banco: Entidades JSON em /entities, acessadas via base44.entities.X
- IA: base44.integrations.Core.InvokeLLM() e ExtractDataFromUploadedFile()

## ANÁLISE SOLICITADA

### 1. MAPA ARQUITETURAL
Desenhe o fluxo completo em formato ASCII:
- Entradas de dados (usuário, webhook, API, automação)
- Componentes/páginas envolvidos
- Funções backend chamadas
- Entidades do banco de dados afetadas
- Saídas (UI, banco, notificações, automações)

### 2. INVENTÁRIO DE ENTIDADES
Para CADA entidade envolvida, liste:
- Nome da entidade
- Como é LIDA (qual função/componente lê, com qual filtro)
- Como é ESCRITA (create/update/delete, por qual função, quando)
- Campos críticos utilizados
- Chave de duplicidade/deduplicação (se houver)

### 3. INVENTÁRIO DE FUNÇÕES BACKEND
Para CADA função em /functions/ utilizada:
- Nome da função
- Trigger: como é invocada (UI, automação, webhook, cron)
- Input: parâmetros recebidos
- Processamento: lógica principal em bullets
- Output: o que retorna e o que persiste no banco
- Chamadas a IA: prompt usado, schema JSON de resposta

### 4. FLUXO DE DADOS DETALHADO (Passo a Passo)
Descreva o fluxo completo numerado:
1. Ação do usuário ou evento externo
2. Função/componente acionado
3. Dados lidos do banco
4. Processamento (incluindo chamadas IA)
5. Dados escritos no banco
6. Retorno para o frontend
7. Atualização da UI

### 5. CICLO DE VIDA DOS STATUS
Se houver campos de status, mapeie a máquina de estados:
[STATUS_INICIAL] → [STATUS_2] → [STATUS_FINAL]
Condição para cada transição

### 6. MAPA ENTIDADES ↔ FUNÇÕES (Tabela)
| Entidade | Lida Por | Escrita Por | Tipo de Operação |
|----------|----------|-------------|-----------------|
| ...      | ...      | ...         | CREATE/UPDATE/DELETE |

### 7. GAPS E PROBLEMAS IDENTIFICADOS
Para cada problema encontrado:
| # | Descrição do Gap | Impacto | Arquivo:Linha | Solução Sugerida |
|---|-----------------|---------|---------------|-----------------|

### 8. DEPENDÊNCIAS EXTERNAS
- Integrações de terceiros usadas
- Secrets/variáveis de ambiente necessários
- APIs externas chamadas

## FORMATO DE RESPOSTA
- Use emojis para categorias visuais
- Código em blocos com syntax highlight
- Tabelas para comparações
- Diagramas ASCII para fluxos
- Seja EXAUSTIVO — não omita detalhes
```

---

## 🔄 PROMPT 2 — SISTEMA DE IMPORTAÇÃO ETL (Extrair → Transformar → Carregar)

Use este prompt para analisar ou melhorar processos de importação de dados.

```
Você é um especialista em pipelines ETL e integração de dados para sistemas CRM.

Preciso analisar o processo de IMPORTAÇÃO DE DADOS para: [TIPO_DE_DADO]

## CONTEXTO
- Fonte de dados: [CSV/Excel/API/JSON/outro]
- Destino: [Nome da Entidade Base44]
- Volume estimado: [N registros]
- Frequência: [uma vez/diária/semanal/contínuo]
- Usuários afetados: [Quem usa este dado?]

## ANÁLISE SOLICITADA

### 1. ESTÁGIOS ETL

#### EXTRACT (Extração)
- Como os dados são obtidos? (upload, API, scheduled task)
- Formato original dos dados
- Validações na origem
- Tratamento de erros na origem

#### TRANSFORM (Transformação)
- Mapeamento campo-a-campo (tabela)
- Normalizações necessárias (formatting, deduplicação, encoding)
- Enriquecimento de dados (lookups, joins, cálculos)
- Regras de validação (obrigatórios, ranges, tipos)
- Limpeza de dados (NULLs, valores inválidos)

#### LOAD (Carregamento)
- Estratégia: INSERT / UPSERT / REPLACE
- Chave de identificação única (deduplication key)
- Ordem de carregamento (dependências)
- Rollback em caso de falha
- Logging de resultados

### 2. FLUXO PASSO A PASSO
1. Usuário faz upload / Sistema dispara extração
2. Validações básicas de arquivo
3. Parser transforma para schema intermediário
4. Deduplicação de registros
5. Lookups/enriquecimentos
6. Inserção no banco (com transação)
7. Auditoria + notificação ao usuário

### 3. MAPEAMENTO CAMPO ORIGEM → CAMPO DESTINO
| Campo Original | Tipo Original | Campo Destino | Tipo Destino | Transformação |
|---|---|---|---|---|
| ... | ... | ... | ... | ... |

### 4. REGRAS DE VALIDAÇÃO
| Campo | Obrigatório | Tipo | Range/Enum | Mensagem Erro |
|---|---|---|---|---|
| ... | Sim/Não | ... | ... | ... |

### 5. TRATAMENTO DE ERROS
- Erro em campo X: [que faz?]
- Arquivo vazio: [que faz?]
- Duplicata detectada: [que faz?]
- Erro na inserção: [rollback?]

### 6. AUDITORIA E LOGGING
- O quê é registrado?
- Onde é armazenado?
- Quem pode acessar?
- Retenção de logs

### 7. PROBLEMAS ATUAIS E SOLUÇÕES
| # | Problema | Causa Raiz | Impacto | Solução |
|---|---|---|---|---|

### 8. AUTOMAÇÃO SUGERIDA
- [Função] que processa importação automaticamente?
- [Scheduler] rodando em que horário?
- [Alertas] em caso de falha?
```

---

## 🧠 PROMPT 3 — ANÁLISE IA / SEGMENTAÇÃO E COMPORTAMENTO

Use este prompt para analisar como a IA está sendo usada no sistema.

```
Você é especialista em machine learning e segmentação de clientes para CRM.

Preciso analisar como a IA está sendo usada para: [FUNCIONALIDADE]

## CONTEXTO
- Módulo/página: [Nome]
- Usuários afetados: [Quem usa?]
- Dados utilizados: [Quais entidades?]
- Freqüência de execução: [Quando roda?]

## ANÁLISE SOLICITADA

### 1. MAPA DE CHAMADAS A IA
Para cada chamada a InvokeLLM() ou ExtractDataFromUploadedFile():
- Nome da função que chama
- Quando é chamada (trigger)
- Qual é o PROMPT (incluir prompt exato)
- Schema JSON esperado (se houver)
- Modelo usado (gpt-4, claude, gemini, etc)
- Timeout e retry policy

### 2. DADOS ENVIADOS PARA A IA
- Quais campos da entidade são enviados?
- Tamanho típico do payload
- Informações sensíveis sendo enviadas? (PII/GDPR)
- Como os dados são sanitizados?

### 3. RESULTADOS PROCESSADOS
- O resultado é armazenado no banco? Onde?
- Como o resultado é validado?
- O que acontece se a IA retorna erro ou formato inválido?
- Há fallen back para valores padrão?

### 4. SEGMENTAÇÃO AUTOMÁTICA
Se há segmentação de contatos:
- Quais atributos definem cada segmento?
- Como os scores são calculados?
- Atualização em tempo real ou batch?
- Histórico de mudanças de segmento?

### 5. ANÁLISE COMPORTAMENTAL
- Quais comportamentos estão sendo rastreados?
- Como são agregados (média, soma, contagem)?
- Períodos de análise (últimas 24h, 7d, 30d, etc)
- Correlações identificadas?

### 6. IMPACTO NOS DADOS
| Campo Modificado | Freq. Atualização | Origem da Mudança | Implicações |
|---|---|---|---|

### 7. ACURÁCIA E MONITORAMENTO
- Como você mede se a IA está funcionando corretamente?
- Há validação manual de resultados?
- Há alertas para anomalias?
- Como os falsos positivos são tratados?

### 8. CONFORMIDADE E TRANSPARÊNCIA
- Há consentimento do usuário para análise IA?
- GDPR/LGPD compliance?
- Os usuários sabem que IA está analisando seus dados?
- Pode ser desativado?

### 9. PROBLEMAS IDENTIFICADOS
| # | Problema | Manifestação | Causas | Impacto |
|---|---|---|---|---|
```

---

## 🌐 PROMPT 4 — WEBHOOKS E INTEGRAÇÕES EXTERNAS

Use este prompt para analisar fluxos de webhook e integrações.

```
Você é especialista em arquitetura de integrações e webhooks em sistemas distribuídos.

Preciso analisar a integração/webhook: [NOME_DA_INTEGRACAO]

## CONTEXTO
- Sistema externo: [Nome/URL]
- Direção: [entrada/saída/bidirecional]
- Frequência de eventos: [aproximada]
- Criticidade: [baixa/média/alta/crítica]

## ANÁLISE SOLICITADA

### 1. DIAGRAMA DE FLUXO
```
[SISTEMA EXTERNO] 
    ↓ (evento/webhook)
[RECEPTOR WEBHOOK - função backend]
    ↓ (parse + validação)
[PROCESSAMENTO/TRANSFORMAÇÃO]
    ↓ (update entidades)
[BASE DE DADOS]
    ↓ (dispara automação?)
[NOTIFICAÇÃO AO USUÁRIO / AÇÃO POSTERIOR]
```

### 2. DETALHES DO WEBHOOK
- URL do endpoint: [aonde recebe?]
- Método HTTP: [GET/POST/PUT?]
- Autenticação: [nenhuma/Basic/Bearer token/Signature?]
- Headers esperados
- Content-Type esperado
- Timeout configurado
- Retry policy

### 3. PAYLOAD DO WEBHOOK
- Estrutura JSON esperada (exemplo real)
- Campos obrigatórios
- Tamanho típico do payload
- Frequência de chegada (picos?)
- Tratamento de duplicatas

### 4. PROCESSAMENTO
- Validações de assinatura (hmac, jwt, etc)
- Transformação do payload para schema interno
- Qual entidade é atualizada?
- Transação atômica ou multi-step?
- Rollback policy em caso de falha

### 5. AUTOMAÇÕES DISPARADAS
Se o webhook dispara automações:
- Qual automação? (nome, tipo)
- Depois de quantos segundos dispara?
- Pode falhar e ser retentado?

### 6. ERRO HANDLING
| Cenário | O que faz |
|---|---|
| Payload inválido | ... |
| Validação falha | ... |
| BD indisponível | ... |
| Timeout | ... |
| Duplicata | ... |

### 7. LOGGING E AUDITORIA
- Tudo é registrado? (sim/não)
- Tempo de retenção de logs
- O que é loggado? (payload completo ou sanitizado?)
- Como visualizar histórico?

### 8. SEGURANÇA
- Token/Secret está em secret manager?
- IP whitelist configurado?
- Rate limiting ativo?
- Validate CORS headers?
- GDPR compliance se há PII?

### 9. MONITORAMENTO
- Qual é a latência típica?
- Há alertas em caso de falha?
- Dashboard de eventos recebidos?
- Como você sabe se o webhook parou de funcionar?

### 10. PROBLEMAS ATUAIS
| # | Problema | Evidência | Causa Suspeita | Solução Proposta |
|---|---|---|---|---|
```

---

## 🎯 PROMPT 5 — MELHORIA DE PROMPTS IA JÁ EXISTENTES

Use este prompt para revisar e melhorar prompts que já estão em uso.

```
Você é especialista em prompt engineering para LLMs.

Preciso revisar e melhorar o seguinte PROMPT DE IA:

## PROMPT ATUAL
[Cole AQUI O PROMPT INTEIRO]

## CONTEXTO
- Função backend: [nome]
- Objetivo: [o que o prompt tenta conseguir?]
- Dados de entrada: [quais campos/variáveis são passados?]
- Formato esperado de saída: [texto/JSON/outro?]
- Taxa de sucesso/acurácia: [~X%?]
- Problemas relatados: [o que não funciona?]

## ANÁLISE SOLICITADA

### 1. ANÁLISE DO PROMPT ATUAL
- Clareza: [muito claro / razoável / confuso]
- Especificidade: [muito específico / genérico demais]
- Estrutura: [bem organizado / caótico]
- Instruções contraditórias? [sim/não, quais?]

### 2. PROBLEMAS IDENTIFICADOS
| # | Problema | Linha do Prompt | Impacto | Recomendação |
|---|---|---|---|---|

### 3. PROMPT MELHORADO
[ESCREVA O NOVO PROMPT AQUI, COM:
- Instruções mais claras
- Exemplos inclusos (few-shot)
- Formato de saída explícito
- Casos edge case mencionados
]

### 4. VALIDAÇÃO DO NOVO PROMPT
- Testar com [casos de teste específicos]
- Resultado esperado: [o quê?]
- Como medir sucesso: [métrica?]

### 5. MUDANÇAS PRINCIPAIS
- [Mudança 1]
- [Mudança 2]
- [Mudança 3]

### 6. PRÓXIMOS PASSOS
- Deploy em [dev/prod?]
- A/B test contra prompt antigo? [sim/não]
- Monitoramento de mudanças? [como?]
```

---

## 🐛 PROMPT 6 — DEPURAÇÃO / BUG - ANÁLISE DE CAUSA RAIZ

Use este prompt quando há um bug confirmado e você precisa entender a causa.

```
Você é especialista em debug e análise de causa raiz em sistemas CRM.

Preciso investigar o seguinte BUG:

## DESCRIÇÃO DO BUG
- O quê está acontecendo: [descrição do comportamento errado]
- O que deveria acontecer: [comportamento esperado]
- Frequência: [sempre / intermitente / uma única vez]
- Quando começou: [data?]
- Quantos usuários afetados: [um / vários / todos]

## CONTEXTO
- Página/função afetada: [nome]
- Ações antes do bug: [passo a passo reproduzir]
- Dados de exemplo: [valores específicos que causam?]
- Mensagem de erro: [completa]
- Logs relevantes: [cole aqui]

## ANÁLISE SOLICITADA

### 1. REPRODUZIR O BUG
Passos EXATOS para reproduzir:
1. [Passo 1]
2. [Passo 2]
3. [Resultado errado]

### 2. MAPA TÉCNICO (Onde falha?)
```
[FRONTEND]
  ↓
[FUNÇÃO X]
  ↓
[CHAMADA À API/BD]
  ↓ (aqui falha?)
[BACKEND]
  ↓
[PROCESSAMENTO]
  ↓
[BD UPDATE]
```

### 3. ANÁLISE DE LOGS
- Log do frontend: [o quê mostra?]
- Log do backend: [o quê mostra?]
- Errors na rede: [há?]
- Estado do banco: [está OK?]

### 4. RAIZ POSSÍVEIS (Causa)
| # | Causa Possível | Evidência | Probabilidade | Como Testar |
|---|---|---|---|---|
| 1 | ... | ... | Alta/Média/Baixa | ... |

### 5. ANÁLISE DETALHADA DA CAUSA MAIS PROVÁVEL
- Código responsável: [arquivo:linha]
- Exato o quê está errado: [explicação técnica]
- Por que falha: [por quê o código tem bug?]
- Quando começou: [mudança recente?]

### 6. TESTES ANTERIORES
- Teste com dados diferentes: [resultado?]
- Teste com navegador diferente: [resultado?]
- Teste em dev vs prod: [diferença?]
- Teste desabilitando cache: [muda?]

### 7. POSSÍVEIS CORREÇÕES
| # | Solução | Pros | Contras | Risco |
|---|---|---|---|---|
| 1 | ... | ... | ... | Baixo/Médio/Alto |

### 8. SOLUÇÃO RECOMENDADA
[Qual das soluções acima é a melhor?]
[Por quê?]
[Código da correção]

### 9. TESTES PÓS-CORREÇÃO
- [Teste 1 que valida a correção]
- [Teste 2]
- [Teste 3]

### 10. IMPACTO DA CORREÇÃO
- Outras partes do código afetadas? [sim/não, quais?]
- Backward compatibility? [quebra?]
- Performance impact? [sim/não]
- Precisa de migração de dados? [sim/não]
```

---

## 🎓 COMO USAR ESTES PROMPTS

1. **Escolha o prompt** que corresponde ao seu problema
2. **Preencha os espaços** [ASSIM] com informações específicas
3. **Cole o prompt completo** na IA (aqui ou em ChatGPT)
4. **Execute a análise** e obtenha insights estruturados

---

## 📋 MATRIZ DE DECISÃO — QUAL PROMPT USAR?

| Você Quer Fazer | Use Prompt | Por Quê |
|---|---|---|
| Entender todo fluxo de um módulo | #1 | Análise completa end-to-end |
| Importar dados em massa | #2 | ETL passo a passo |
| Entender como IA funciona | #3 | Análise de AI/ML |
| Integrar API/webhook externo | #4 | Integração segura |
| Prompt não funciona bem | #5 | Melhorar LLM output |
| App tem um bug | #6 | Encontrar causa raiz |

---

## 🚀 EXEMPLO COMPLETO — Caso Real: Bug em Encaminhamento de Mensagens

Veja como aplicar o **PROMPT 6** ao erro descoberto anteriormente:

### Contexto do Bug Repl:
```
BUG: "Usuário não encontrado" 
Ocorre: Automação "Watchdog - Ativar Threads Tipo A"
Frequência: 100% das vezes (falha sempre)
Afetados: Todas as threads internas sendo criadas
```

### Aplicando Prompt #6:

#### 1. REPRODUZIR O BUG
```
1. Encaminhar mensagem para usuário interno via MessageBubble
2. Dialog seleciona "usuário 1:1 interno"
3. Chama getOrCreateInternalThread(userId)
4. Watchdog tenta processar thread
5. ERRO: "Usuário não encontrado"
```

#### 2. MAPA TÉCNICO
```
[MessageBubble (React)]
  ↓ (usuário clica "Encaminhar")
[handleEncaminhar()] 
  ↓ (chama sendInternalMessage)
[sendInternalMessage Backend]
  ↓ (cria Message com channel=interno)
[DB: Message.create()] ← Aqui salva? Sim
  ↓ 
[Watchdog roda 30min depois]
  ↓
[Tenta resolver user_id de thread 1:1]
  ✗ ERRO: user_id não existe em User entity
```

#### 3. ANÁLISE DE LOGS
```
Frontend: OK (dialog funciona)
Backend sendInternalMessage: OK (message criada)
Watchdog: ❌ ERRO "target_user_id not found in User entity"
```

#### 4. RAIZ POSSÍVEIS
| Causa | Evidência | Probabilidade |
|---|---|---|
| User foi deletado | Watchdog tenta buscar User.get(userId) e falha | ALTA |
| User ID inválido no MessageThread.participants | participants: [id1, id2_invalido] | ALTA |
| Race condition: User criado mas falha na insert | Raro | BAIXA |

#### 5. CAUSA RAIZ PROVÁVEL
**Arquivo:** `getOrCreateInternalThread.js:76`
```javascript
const targetUser = await base44.asServiceRole.entities.User.get(target_user_id);
if (!targetUser) {
  return { error: 'Usuário de destino não encontrado' };
}
```

**Por quê falha:**
- Um usuário foi deletado DEPOIS que a thread foi criada
- MessageThread ainda referencia o usuário deletado em `participants: [id1, id_deletado]`
- Watchdog tenta reativar thread, chama getOrCreateInternalThread again
- Tenta buscar usuário deletado → erro "not found"

#### 6. SOLUÇÃO RECOMENDADA
```javascript
// Adicionar validação em getOrCreateInternalThread:
const targetUser = await base44.asServiceRole.entities.User.get(target_user_id);
if (!targetUser) {
  // Ao invés de retornar erro, LIMPAR thread órfã
  await base44.asServiceRole.entities.MessageThread.update(thread.id, {
    status: 'arquivada'  // ou deletar
  });
  
  return { 
    error: 'Usuário de destino não encontrado (thread fechada)',
    thread_archived: true 
  };
}
```

#### 7. TESTES PÓS-CORREÇÃO
- Deletar um usuário
- Confirmar que threads com esse usuário são automaticamente arquivadas
- Watchdog não gera mais erro para threads órfãs

---

**Pronto para usar!** 🎯