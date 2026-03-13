# 🧠 PROMPTS PROFISSIONAIS DE ANÁLISE DE SISTEMA
**Base44 — Plataforma CRM NexusEngine**

---

## 📌 PROMPT 1 — ANÁLISE COMPLETA DE ENTIDADES E FUNÇÕES

**Use este prompt para analisar qualquer módulo/página do sistema e mapear como os dados fluem.**

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

**Use para debugar fluxos de dados em massa, integrações e pipelines de sincronização.**

```
Você é um especialista em ETL (Extract, Transform, Load) para sistemas SaaS.

Analise o seguinte fluxo de importação/sincronização: [DESCREVER_FLUXO]

## ANÁLISE DO FLUXO ETL

### FASE 1 - EXTRAIR (Extract)
1. Fonte de dados (arquivo, API, webhook, banco)
2. Validação inicial do payload
3. Tratamento de erros na leitura
4. Armazenamento temporário (se houver)
5. Deduplicação de entrada

### FASE 2 - TRANSFORMAR (Transform)
1. Normalização de dados (tipos, formatos, valores)
2. Enriquecimento (joinar com dados existentes, IA, cálculos)
3. Validação contra schema
4. Mapeamento de campos (origem → destino)
5. Detecção de conflitos/duplicatas no banco
6. Aplicação de regras de negócio

### FASE 3 - CARREGAR (Load)
1. Transação preparada
2. Inserção em batch vs. individual
3. Validação de integridade referencial
4. Rollback em caso de erro
5. Logging de sucesso/falha
6. Notificações disparadas

### MAPA DO FLUXO (ASCII)
```
[Fonte] → [Validação] → [Transformação] → [Deduplicação] → [Carregar] → [Resultado]
```

### TABELA: Transformações Por Campo
| Campo Origem | Campo Destino | Transformação | Validação | Fallback |
|--------------|---------------|---------------|-----------|----------|
| ...          | ...           | ...           | ...       | ...      |

### PONTOS DE FALHA E HANDLERS
| # | Ponto | Tipo de Erro | Handler Atual | Handler Ideal |
|---|-------|--------------|---------------|--------------|

### PERFORMANCE & VOLUME
- Volume esperado: [N] registros/hora
- Tempo de processamento: [T]ms/registro
- Lote máximo processado simultaneamente: [SIZE]
- Gargalos identificados: [LIST]

### VALIDAÇÃO FINAL
- Registros lidos: [COUNT]
- Registros transformados com sucesso: [COUNT]
- Registros carregados: [COUNT]
- Taxa de erro: [%]
- Dados órfãos/duplicados: [COUNT]
```

---

## 🧬 PROMPT 3 — ANÁLISE DE IA E SEGMENTAÇÃO

**Use para entender como a IA está sendo usada, segmentações aplicadas, comportamentos rastreados.**

```
Você é um especialista em análise comportamental e segmentação de clientes usando IA.

Analise o seguinte aspecto de IA do sistema: [DESCREVER_ASPECTO]

## ANÁLISE DE IA

### 1. CHAMADAS A IA IDENTIFICADAS
Para cada chamada a InvokeLLM():
- Onde é invocada (arquivo:linha)
- Prompt exato enviado
- Modelo usado (gpt-4, gemini, etc.)
- Schema JSON de resposta esperado
- Fallback se falhar
- Cache implementado? (sim/não)

### 2. SEGMENTAÇÃO AUTOMÁTICA
Quais campos de segmento existem:
| Campo | Valores Possíveis | Lógica de Atribuição | Frequência Recalc. |
|-------|-------------------|----------------------|-------------------|
| ...   | ...               | ...                  | ...                |

### 3. SCORING E PRIORIZAÇÃO
- Scores calculados (engagement, churn_risk, etc.)
- Fórmula usada
- Onde é atualizado
- Frequência de recálculo
- Influência em roteamento/automações

### 4. BEHAVIORAL TRACKING
Comportamentos monitorados:
- Inatividade (threshold: [N] dias)
- Engajamento (métrica: [DESC])
- Padrões de compra (análise: [DESC])
- Churn indicators (sinais: [LIST])

### 5. FEEDBACK LOOP IA
```
[Ação do Usuário] → [IA Analisa] → [Sugestão] → [User Feedback] → [IA Melhora]
```

Como o feedback está sendo capturado?
Como a IA usa esse feedback?

### 6. GAPS NA SEGMENTAÇÃO
| # | Comportamento Não Rastreado | Impacto | Solução |
|---|------------------------------|---------|---------|

### 7. COMPLIANCE & PRIVACIDADE
- Dados pessoais sendo enviados à IA? (lista de campos)
- LGPD/GDPR compliance validado?
- Retenção de prompt/resposta (sim/não, duração)
```

---

## 🔌 PROMPT 4 — ANÁLISE DE WEBHOOKS E INTEGRAÇÕES

**Use para debugar fluxos orientados a eventos, webhooks de terceiros, sincronizações em tempo real.**

```
Você é um especialista em webhooks, eventos e integrações de APIs.

Analise o seguinte fluxo de webhook/integração: [DESCREVER_WEBHOOK]

## ANÁLISE DE WEBHOOK/INTEGRAÇÃO

### 1. CONFIGURAÇÃO DO WEBHOOK
- URL do webhook: [URL]
- Provedor: [PROVIDER] (Z-API, W-API, Meta, etc.)
- Evento disparador: [EVENT]
- Autenticação: [TOKEN/SIGNATURE_VALIDATION]
- Headers necessários: [LIST]
- Payload esperado: [SCHEMA_JSON]

### 2. RECEPÇÃO E VALIDAÇÃO
```javascript
// Validação do webhook:
1. Validar assinatura/token (segurança)
2. Validar payload contra schema
3. Validar timestamps (replay attacks)
4. Desduplicação por messageId
5. Rate limiting (se necessário)
```

### 3. PROCESSAMENTO DO EVENTO
Fluxo passo a passo:
1. Evento recebido
2. Payload normalizado
3. Entidade encontrada/criada
4. Lógica de negócio aplicada
5. Efeito colateral (notificação, automação, etc.)
6. Resposta retornada

### 4. MAPA DE EVENTOS
| Evento | Trigger | Processamento | Resultado | Fallback |
|--------|---------|---------------|-----------|----------|
| ...    | ...     | ...           | ...       | ...      |

### 5. ARQUITETURA DO WEBHOOK
```
[Provedor] → [HTTP POST] → [Validação] → [Processamento] → [Resposta 200]
                                    ↓
                            [Banco de Dados]
                                    ↓
                            [Notificações/Automações]
```

### 6. TRATAMENTO DE ERROS
| # | Tipo de Erro | Tratamento Atual | Retry? | DLQ? |
|---|--------------|------------------|--------|------|
| ...| ...          | ...              | ...    | ...  |

### 7. MONITORAMENTO
- Logs de webhook: [LOCALIZAÇÃO]
- Métricas rastreadas: [LIST]
- Alertas configurados: [LIST]
- SLA esperado: [ms/s]

### 8. GAPS E PROBLEMAS
| # | Problema | Impacto | Arquivo | Solução |
|---|----------|---------|---------|---------|
```

---

## ✨ PROMPT 5 — MELHORIA DE PROMPTS IA

**Use para revisar e aprimorar prompts que já existem no sistema.**

```
Você é um especialista em prompt engineering para sistemas CRM.

Analise e melhore o seguinte prompt IA do sistema: [COPIAR_PROMPT_EXATO]

## ANÁLISE DO PROMPT

### 1. ESTRUTURA ATUAL
- Tipo de prompt: (classificação, geração, análise, extração, etc.)
- Modelo alvo: [GPT-4, Gemini, etc.]
- Contexto fornecido: [DESCREVER]
- Instruções: [DESCREVER]
- Saída esperada: [DESCREVER]

### 2. QUALIDADE DA INSTRUÇÃO
Checklist:
- [ ] Objetivo está claro?
- [ ] Contexto é suficiente?
- [ ] Formato de resposta está definido?
- [ ] Exemplos inclusos (few-shot)?
- [ ] Casos extremos considerados?
- [ ] Há contradições nas instruções?

### 3. PROBLEMAS IDENTIFICADOS
| # | Problema | Severidade | Exemplo de Falha | Fix |
|---|----------|-----------|------------------|-----|

### 4. PROMPT MELHORADO
```
[VERSÃO OTIMIZADA DO PROMPT]
```

### 5. MUDANÇAS EXPLICADAS
- Adição: [O QUÊ e POR QUÊ]
- Remoção: [O QUÊ e POR QUÊ]
- Reordenação: [O QUÊ e POR QUÊ]

### 6. TESTE COMPARATIVO
Testar ambos (original vs. otimizado) com:
- Exemplo 1: [DESCREVER]
- Exemplo 2: [DESCREVER]
- Exemplo 3: [DESCREVER]

### 7. MÉTRICA DE MELHORIA
- Taxa de sucesso (antes): [%]
- Taxa de sucesso (depois): [%]
- Latência (antes): [ms]
- Latência (depois): [ms]
- Custo por requisição (antes): [$]
- Custo por requisição (depois): [$]
```

---

## 🐛 PROMPT 6 — DEPURAÇÃO E BUG ANALYSIS (Causa Raiz)

**Use para investigar bugs, quebras, comportamentos inesperados e aplicar correções cirúrgicas.**

```
Você é um especialista em debugging e root cause analysis.

Investigar o seguinte problema: [DESCREVER_BUG]

## ANÁLISE DO BUG

### 1. REPRODUÇÃO
- Passos exatos para reproduzir:
  1. [PASSO 1]
  2. [PASSO 2]
  3. [PASSO 3]
- Ocorre sempre? (sim/não/intermitente)
- Ambiente: (dev/prod/ambos)
- Browser/versão: [INFO]

### 2. SINTOMAS OBSERVADOS
- Comportamento esperado: [DESCREVER]
- Comportamento atual: [DESCREVER]
- Logs de erro: [COPIAR_LOGS_EXATOS]
- Console warnings: [COPIAR]
- Network errors: [COPIAR]

### 3. ESCOPO DO PROBLEMA
```
Afetado:
- Entidades: [LIST]
- Funções: [LIST]
- Componentes: [LIST]
- Usuários: [QUEM]
- Dados: [QUANTO]
```

### 4. ANÁLISE DE CAUSA RAIZ (5 Porquês)
```
1. POR QUÊ? [OBSERVAÇÃO 1]
2. POR QUÊ? [OBSERVAÇÃO 2]
3. POR QUÊ? [OBSERVAÇÃO 3]
4. POR QUÊ? [OBSERVAÇÃO 4]
5. POR QUÊ? [CAUSA RAIZ] ← AQUI
```

### 5. TIMELINE DO BUG
- Quando começou: [DATA]
- Última mudança de código: [COMMIT]
- Relacionado a:
  - Deploy? (sim/não, qual versão)
  - Mudança de dados? (sim/não, qual mudança)
  - Alteração de entidade? (sim/não, qual campo)

### 6. CÓDIGO PROBLEMA
Arquivo: [CAMINHO]
Linhas: [START-END]
```javascript
[COPIAR CÓDIGO PROBLEMÁTICO]
```

### 7. DIAGNÓSTICO
| # | Hipótese | Evidência | Validado? |
|---|----------|-----------|-----------|
| 1 | ...      | ...       | ✅/❌     |
| 2 | ...      | ...       | ✅/❌     |
| 3 | ...      | ...       | ✅/❌     |

### 8. SOLUÇÃO (Cirúrgica)
**Antes:**
```javascript
[CÓDIGO ATUAL]
```

**Depois:**
```javascript
[CÓDIGO CORRIGIDO]
```

**Mudanças:**
- [O QUÊ foi alterado]
- [POR QUÊ esta mudança corrige]
- [EFEITOS COLATERAIS esperados]

### 9. VALIDAÇÃO PÓS-FIX
- [ ] Bug reproduzido novamente?
- [ ] Testes unitários adicionados?
- [ ] Regressão em outros módulos? (testar [LIST])
- [ ] Performance afetada? (baseline: [ms], novo: [ms])
- [ ] Documentação atualizada?

### 10. LIÇÕES APRENDIDAS
- Como evitar este bug no futuro?
- Qual padrão deveria ser adotado?
- Há código smells relacionado?
```

---

## 📋 RESUMO RÁPIDO

| # | Prompt | Quando Usar | Saída Esperada |
|---|--------|------------|----------------|
| 1️⃣ | Análise Completa | Debugar módulo novo ou complexo | Mapa arquitetural + gaps |
| 2️⃣ | ETL | Fluxos de dados em massa | Diagrama ETL + validações |
| 3️⃣ | IA & Segmentação | Entender scores/behaviors | Behavioral map + gaps IA |
| 4️⃣ | Webhooks | Integrações quebrando | Diagrama webhook + tratamento erros |
| 5️⃣ | Melhoria Prompts | Prompts retornando lixo | Prompt otimizado + métricas |
| 6️⃣ | Bug Analysis | App quebrado/comportamento estranho | Causa raiz + solução cirúrgica |

---

**Usar estes prompts em sequência: 1 → 2 → 3 → 4 → 5 → 6**

**Cada prompt foi desenhado para ser copiado 100% e colado em uma conversa com Claude/ChatGPT.**