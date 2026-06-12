# Plano passo a passo — adequações da integração de e-mail

Este documento organiza o caminho de implementação da integração de e-mail depois das auditorias e debates sobre Gmail, Zimbra/IMAP, múltiplas caixas e a Central de Comunicação.

## Objetivo do MVP

Fazer e-mails recebidos virarem conversas visíveis e atendíveis na Central de Comunicação, seguindo o mesmo princípio operacional usado no WhatsApp:

1. origem externa normalizada;
2. contato localizado ou criado;
3. thread criada ou reutilizada;
4. mensagem persistida sem duplicidade;
5. conversa atribuída ao atendente responsável pela caixa.

O MVP não deve começar por envio SMTP, tela completa, IA, Outlook ou automações avançadas. Primeiro precisa provar que a entrada de e-mail funciona com segurança.

## Decisões já consolidadas

- A integração atual de Gmail é apenas um protótipo parcial e não resolve o cenário real de várias caixas.
- A maioria das caixas usa servidor próprio/Zimbra, portanto IMAP é o primeiro caminho técnico a validar.
- Alguns Gmail podem ser tratados depois: preferencialmente por IMAP se o ambiente e as contas permitirem; caso contrário, por OAuth/API.
- Senhas nunca devem ser gravadas em entidades comuns. A entidade deve guardar apenas o nome do secret.
- A modelagem correta é uma entidade de caixa (`EmailAccount`), e não um array de e-mails dentro de `User`.
- A Central só deve ser alterada se a validação mostrar que `channel: "email"` não aparece ou não renderiza corretamente.

## Sprint 0 — Validação antes da fundação

### 0.1. Validar conectividade IMAP

Usar a função de spike `testarConexaoImap` apenas para responder uma pergunta arquitetural: o runtime consegue abrir TLS/IMAP na porta 993?

Entrada esperada:

```json
{
  "host": "201.76.14.230",
  "port": 993,
  "security": "tls",
  "tls_hostname": "mail.liesch.com.br",
  "username": "caixa@liesch.com.br",
  "password_secret_name": "ZIMBRA_PWD_CAIXA_TESTE",
  "ca_cert_secret_name": "ZIMBRA_CA_CERT",
  "use_embedded_ca": false,
  "mailbox": "INBOX",
  "auth_mode": "plain_then_login",
  "max_messages": 5,
  "timeout_ms": 15000
}
```

Resultado esperado para seguir com IMAP interno:

- `ok: true`;
- greeting IMAP recebido;
- login realizado;
- `UIDVALIDITY` identificado;
- últimos cabeçalhos lidos sem expor senha.

Diagnóstico de autenticação obrigatório antes de acionar a TI:

- usar `auth_mode: "plain_then_login"` como padrão do spike;
- testar `AUTHENTICATE PLAIN` primeiro, porque o Zimbra anuncia `AUTH=PLAIN` em `CAPABILITY`;
- se `AUTHENTICATE PLAIN` falhar, testar `LOGIN` na mesma sessão como fallback diagnóstico;
- repetir o mesmo payload em uma segunda caixa Zimbra para separar problema específico da conta Luiz de falha global do proxy/imapd.

A resposta da função deve deixar visível `tls_ok`, `capability_ok`, `supports_auth_plain`, `auth_plain`, `login`, `select_inbox_result`, `uidvalidity` e `total_uids_found`. Se `AUTHENTICATE PLAIN` e `LOGIN` falharem com `BAD internal server error`, o diagnóstico mais provável é `server_side_imap_proxy_or_imapd`, e não problema de certificado, rede ou frontend. O fallback entre métodos deve reconectar antes da segunda tentativa para evitar resultado contaminado por sessão IMAP/SASL abortada.

Se falhar por timeout, bloqueio de TCP ou erro de rede, a arquitetura muda para relé externo + webhook Base44. Nesse caso, `EmailAccount` continua existindo, mas a leitura IMAP sai do Base44 e passa a ser feita por um serviço externo controlado.

### 0.1.1. Resultado do spike executado

O teste relatado com o secret `Email_ZIMBRA_TESTE` mostrou três achados práticos:

| Teste | Resultado | Interpretação |
| --- | --- | --- |
| Secret `Email_ZIMBRA_TESTE` antes do redeploy | HTTP 400 | O secret existia, mas ainda não estava disponível para a função em runtime. |
| `imap.gmail.com:993` | Conectou e falhou apenas no login com credencial de teste | O runtime consegue abrir saída TCP/TLS para IMAP 993. |
| `mail.liesch.com.br:993` | Inicialmente timeout; depois passou a responder TLS com `UnknownIssuer` | A porta 993 foi liberada e o Base44 chega no servidor, mas o certificado do Zimbra não está na cadeia pública de confiança do Deno. |
| `mail.liesch.com.br:143` com `security: "starttls"` | TCP conectou, greeting foi recebido e `STARTTLS` respondeu OK; falhou em `UnknownIssuer` | A porta 143 também é viável como fallback com STARTTLS. |

Conclusão atual: a arquitetura com cron IMAP interno é tecnicamente possível no Base44. O próximo bloqueio é cadastrar o certificado público/CA do Zimbra como secret e reenviar o payload com `ca_cert_secret_name`. Se o teste usar IP como `host`, enviar também `tls_hostname` com o DNS presente no certificado para SNI/validação de nome. O IP de saída observado no teste anterior foi `34.16.156.208`, porém ele deve ser tratado como potencialmente variável se a plataforma não garantir IP fixo de egress.

Comandos para extrair o certificado público do servidor:

```bash
openssl s_client -connect 201.76.14.230:993 -showcerts </dev/null 2>/dev/null | openssl x509 -outform PEM
```

ou, se estiver usando a porta 143:

```bash
openssl s_client -connect 201.76.14.230:143 -starttls imap -showcerts </dev/null 2>/dev/null | openssl x509 -outform PEM
```

Decisão operacional antes de implementar `importarEmails`:

1. cadastrar o PEM público/CA do Zimbra em um secret, por exemplo `ZIMBRA_CA_CERT`;
2. repetir `testarConexaoImap` contra `201.76.14.230` na porta 993 com `security: "tls"`, `tls_hostname: "mail.liesch.com.br"`, `ca_cert_secret_name: "ZIMBRA_CA_CERT"` e `auth_mode: "plain_then_login"`; se o secret do certificado voltar corrompido, usar temporariamente `use_embedded_ca: true` para a CA pública fixada do `mail.liesch.com.br`;
3. repetir o mesmo teste em uma segunda caixa Zimbra com secret próprio;
4. se `AUTHENTICATE PLAIN` ou `LOGIN` autenticar e listar cabeçalhos, seguir pelo Caminho A: cron interno no Base44 usando TLS 993 e o método de autenticação que passou;
5. se 993 ficar instável mas 143 funcionar, usar o mesmo certificado com `security: "starttls"` na porta 143;
6. se os dois métodos de autenticação falharem com `BAD internal server error` em mais de uma caixa, encaminhar para a TI com o transcript sanitizado e checar proxy/imapd/COS/conta no Zimbra antes de criar importador;
7. se a conectividade ficar instável ou o Zimbra não puder aceitar IMAP externo, seguir pelo Caminho B: relé externo lendo IMAP na rede da Liesch e enviando POST para webhook Base44.

### 0.2. Validar a Central com canal e-mail

Antes de mexer em `Comunicacao.jsx` ou componentes relacionados, confirmar se a Central já busca e renderiza:

- `MessageThread.channel = "email"`;
- `Message.channel = "email"`;
- mensagem com `direction = "inbound"`;
- thread atribuída a um usuário.

Critério:

- se aparecer na lista e abrir a conversa, não alterar a Central no MVP;
- se não aparecer, identificar o filtro exato e aplicar patch mínimo no componente correto.

## Caminhos de arquitetura após o spike

### Caminho A — Cron IMAP interno no Base44

Usar este caminho se o Zimbra aceitar IMAP 993 com TLS e certificado confiável via `ca_cert_secret_name`, ou IMAP 143 com STARTTLS como fallback.

Responsabilidades:

- `EmailAccount` fica no Base44;
- secrets ficam no cofre do Base44;
- `importarEmails` conecta direto no IMAP, preferencialmente em `security: "tls"` na porta 993 para o Zimbra atual, com `tls_hostname` quando o host for IP;
- automação agendada chama `importarEmails`;
- erros de conexão atualizam status da conta.

Vantagens:

- menos infraestrutura;
- implementação centralizada;
- segue o mesmo padrão serverless do app.

Riscos:

- depende do certificado público/CA do Zimbra cadastrado como secret;
- quando o host for IP, depende de `tls_hostname` apontando para o DNS do certificado;
- SMTP futuro terá exigência semelhante de rede/certificado.

### Caminho B — Relé externo + webhook Base44

Usar este caminho se o Zimbra não puder liberar o Base44 de forma confiável.

Responsabilidades:

- um script/serviço externo roda na rede que já alcança o Zimbra;
- o relé lê IMAP e controla UID/UIDVALIDITY localmente ou em `EmailAccount`;
- o relé envia mensagens novas para um webhook Base44;
- o webhook Base44 só normaliza, deduplica e grava `Contact`, `MessageThread` e `Message`.

Vantagens:

- independe de IP fixo do Base44;
- mais robusto quando o servidor de e-mail é restrito;
- evita expor IMAP diretamente para runtimes externos.

Riscos:

- exige manter um serviço fora do Base44;
- exige monitoramento do relé;
- aumenta a responsabilidade operacional do ambiente da Liesch.

## Correções obrigatórias incorporadas na fundação

A avaliação final aprovou a arquitetura, mas marcou alguns bloqueios de produção. A fundação do canal de e-mail deve tratar estes pontos como obrigatórios:

1. `EmailAccount` oficial é a fonte de verdade de cada caixa, e não arrays soltos dentro de `User`.
2. Zimbra/IMAP usa `password_secret_name` **por caixa**, nunca um segredo único por provider.
3. Gmail usa `auth_type: "gmail_oauth"` e conector OAuth nativo; não deve depender de senha IMAP no fluxo principal.
4. Importação incremental usa `uidvalidity` + `last_uid_seen` para IMAP, e `last_history_id` para Gmail/OAuth.
5. `EmailSincronizado` funciona como staging/deduplicação antes da ponte para a Central.
6. `Message` e `MessageThread` precisam guardar `email_account_id` para saber por qual caixa responder.
7. Envio é fluxo separado (`enviarEmail`/`enviarEmailCentral`) e deve criar `Message` outbound com status/auditoria.
8. `Contact.emails[]` guarda aliases do mesmo contato; `Contact.email` continua sendo o principal.
9. `gmailWebhookHandler` precisa conciliar remetente com `Contact.email`, `Contact.emails[]` e `Cliente` antes de criar contato novo, marcando `tipo_contato: "email"` apenas quando não houver match.
10. A atribuição do atendimento preserva o responsável/fidelizado do contato ou cliente; se não houver, usa a caixa de destino (`EmailAccount.owner_user_id`, `User.email_accounts[].login`, `User.email`/fallback).
11. Dedup precisa aceitar o campo novo `email_message_id` e o legado `metadata.gmail_message_id` durante transição.

## Sprint 1 — Fundação mínima de dados

### 1.1. Criar entidade `EmailAccount`

Criar uma entidade enxuta, uma linha por caixa de e-mail.

Campos mínimos:

| Campo | Finalidade |
| --- | --- |
| `nome_conta` | Nome amigável da caixa. |
| `email_address` | Endereço da caixa. |
| `provider` | `zimbra`, `imap` ou `gmail`. |
| `owner_user_id` | Atendente principal responsável. |
| `imap_host` | Host IMAP. |
| `imap_port` | Porta IMAP, normalmente 993. |
| `imap_secure` | Indica uso de TLS. |
| `password_secret_name` | Nome do secret que guarda a senha/app password específica desta caixa. |
| `ca_cert_secret_name` | Nome do secret com CA/certificado PEM do servidor, se necessário. |
| `status` | `pendente`, `conectado`, `erro` ou `inativo`. |
| `ativo` | Liga/desliga sincronização. |
| `last_uid_seen` | Último UID processado. |
| `uidvalidity` | Validade dos UIDs da pasta. |
| `last_history_id` | Cursor de histórico para Gmail/OAuth. |
| `ultima_atividade` | Última leitura/importação bem-sucedida. |

Não incluir senha, app password ou token em campo de entidade.

### 1.2. Ajustar `Message`

Adicionar campos de topo para deduplicação e rastreio da origem:

- `email_account_id`;
- `email_message_id`.

Regra de deduplicação mínima:

```text
não criar Message se já existir Message com o mesmo email_account_id + email_message_id
```

O `email_message_id` deve preferir o `Message-ID` do cabeçalho. Se não existir, usar uma chave controlada por provedor, por exemplo `imap:<accountId>:<uidvalidity>:<uid>`.

### 1.3. Ajustar `MessageThread`

Adicionar:

- `email_account_id`.

Esse vínculo define por qual caixa a conversa entrou e qual caixa deve ser usada futuramente para resposta.

### 1.4. Ajustar provider da mensagem

Adicionar um valor genérico de provider para e-mail, por exemplo:

- `email`.

Evitar usar `internal_system` para e-mails externos recebidos.

## Sprint 2 — Ingestão mínima de e-mails

### 2.1. Criar função `importarEmails`

A função deve rodar sob demanda primeiro; o agendamento vem depois.

Fluxo:

1. Buscar `EmailAccount` ativas.
2. Para cada conta, validar provider.
3. Para IMAP/Zimbra, conectar no host/porta usando `secret_name`.
4. Ler apenas mensagens novas com base em `uidvalidity` + `last_uid_seen`.
5. Normalizar remetente, assunto, data, corpo texto/html e identificadores.
6. Deduplicar por `email_account_id` + `email_message_id`.
7. Criar ou localizar `Contact` pelo e-mail do remetente.
8. Criar ou localizar `MessageThread` com `channel: "email"` e `email_account_id`.
9. Criar `Message` com `channel: "email"`, `provider: "email"`, `direction: "inbound"` e os campos de e-mail.
10. Atualizar `last_uid_seen`, `uidvalidity`, `ultima_atividade` e `status` da conta.

### 2.2. Estratégia inicial de thread

Para o MVP, usar uma regra simples e previsível:

```text
mesma caixa + mesmo remetente + assunto normalizado = mesma thread
```

Normalizar assunto removendo prefixos como `Re:`, `Fwd:`, `Enc:` e espaços extras.

Posteriormente, quando houver resposta por e-mail, evoluir o agrupamento usando `In-Reply-To` e `References`.

### 2.3. Segurança operacional

- Limitar quantidade de mensagens por execução.
- Não baixar anexos no MVP.
- Não marcar mensagens como lidas.
- Não apagar mensagens.
- Registrar erros por conta sem interromper as demais.

## Sprint 3 — Prova na Central

Validar em ambiente controlado:

1. Criar uma `EmailAccount` de teste.
2. Rodar `importarEmails` manualmente.
3. Confirmar que o contato foi criado ou reutilizado.
4. Confirmar que a thread aparece na barra/lista da Central.
5. Confirmar que a mensagem aparece na conversa/bolha.
6. Rodar a importação novamente e confirmar que não duplica.
7. Confirmar que a thread ficou atribuída ao atendente dono da caixa.

Critério de conclusão do MVP de entrada:

```text
um e-mail real recebido aparece como conversa na Central, associado à caixa correta, sem duplicar em novas execuções
```

## Sprint 4 — Agendamento

Depois da prova manual:

1. Criar automação/cron para chamar `importarEmails` a cada 5 ou 10 minutos.
2. Adicionar limite por execução para evitar timeout.
3. Atualizar status por conta.
4. Registrar data da última sincronização.
5. Criar alerta simples para conta com erro recorrente.

## Sprint 5 — Tela de gestão de caixas

Só depois da ingestão estar provada.

Adicionar aba `E-mail` dentro de `ConfiguracaoCanaisComunicacao`, alinhada ao modelo dos provedores de WhatsApp.

Funcionalidades mínimas:

- listar caixas;
- criar/editar caixa;
- vincular atendente dono;
- informar host/porta/secret;
- ativar/inativar sincronização;
- mostrar status e última atividade;
- botão `Testar conexão`;
- botão `Sincronizar agora`.

O `GmailConnectionCard` atual não deve continuar solto em configuração de IA como peça principal do canal. Se Gmail for mantido, ele deve ser reaproveitado dentro da gestão de caixas.

## Sprint 6 — Gmail

A decisão operacional atual é estabilizar primeiro o Gmail nativo/OAuth já conectado e só depois voltar ao Zimbra/IMAP. Para esse fluxo:

1. Manter a automação Gmail → `gmailWebhookHandler` para e-mails novos.
2. Usar o conector OAuth nativo do Gmail; não usar senha IMAP para Gmail como padrão.
3. Resolver o dono da caixa de destino (`EmailAccount.owner_user_id` ou `User.email_accounts[].login`), mas preservar o responsável/fidelizado do contato quando já existir.
4. Conciliar o remetente com `Contact.email`, `Contact.emails[]` e `Cliente` por e-mail/nome antes de criar contato novo.
5. Gravar `provider: "email_gmail"`, `email_message_id`, `email_account_id` quando houver `EmailAccount`, e metadados Gmail para auditoria.
6. Responder pela Central somente quando a thread tiver `email_account_id` e a `EmailAccount` estiver com `can_send=true`; o envio usa Gmail API quando `auth_type=gmail_oauth` ou SMTP quando houver `password_secret_name`.
7. Para a segunda conta Gmail, cadastrar a caixa no usuário dono e criar/vincular a `EmailAccount` correspondente antes de validar roteamento.

Não deixar o handler Gmail como caminho paralelo sem vínculo de conta/usuário; ele deve produzir a mesma saída normalizada para `Contact`, `MessageThread` e `Message`.

## Sprint 7 — Envio e resposta por e-mail

Implementar somente depois que a entrada estiver estável.

Requisitos:

- usar `MessageThread.email_account_id` para descobrir a caixa de saída;
- enviar via SMTP para Zimbra/IMAP;
- enviar via Gmail API se o Gmail ficar em OAuth;
- salvar mensagem outbound em `Message`;
- manter `In-Reply-To` e `References`;
- suportar anexos em etapa posterior.

## Sprint 8 — Operação avançada

Melhorias futuras, fora do MVP:

- logs detalhados de sincronização;
- dashboard de saúde das caixas;
- suporte completo a anexos;
- permissões por caixa/setor;
- classificação por IA;
- resposta sugerida por IA;
- regras de roteamento por caixa, assunto ou remetente;
- importação por planilha/CSV;
- rotação assistida de secrets.

## Itens que não devem entrar no primeiro ciclo

- Reescrever `Comunicacao.jsx` sem prova de necessidade.
- Implementar Outlook/Graph sem demanda confirmada.
- Criar tela completa antes de validar ingestão.
- Implementar envio antes de receber com estabilidade.
- Gravar senha em entidade.
- Processar anexos no primeiro importador.
- Depender do `gmailWebhookHandler` antigo como motor principal.

## Checklist de aceite técnico

- [ ] Função IMAP validada ou decisão formal por relé externo.
- [ ] `EmailAccount` criada sem campos sensíveis e com `password_secret_name` por caixa.
- [ ] `Message` tem `email_account_id` e `email_message_id`.
- [ ] `MessageThread` tem `email_account_id`.
- [ ] Provider `email` aceito em `Message`.
- [ ] Importação cria contato, thread e mensagem.
- [ ] Segunda execução não duplica mensagens.
- [ ] Thread aparece na Central.
- [ ] Mensagem aparece na conversa.
- [ ] Conta registra `uidvalidity` e `last_uid_seen`.
- [ ] Gmail antigo não fica como fluxo paralelo solto.
- [ ] Gmail usa `auth_type: "gmail_oauth"`/conector nativo, não senha IMAP como padrão.
- [ ] `EmailSincronizado` recebe e-mails reais antes da ponte para a Central.
- [ ] `enviarEmailCentral` implementado para respostas outbound.

## Ordem final recomendada

```text
1. Repetir o teste IMAP no Zimbra pela porta 993/TLS com `ca_cert_secret_name` e `tls_hostname`, ou decidir formalmente pelo relé.
2. Validar renderização do canal email na Central.
3. Criar EmailAccount + EmailSincronizado + campos mínimos em Message/MessageThread.
4. Migrar contas soltas/usuários para EmailAccount, com um secret por caixa Zimbra.
5. Criar importarEmails interno ou emailInboundWebhook, conforme Caminho A/B.
6. Provar e-mail real em EmailSincronizado e depois na Central sem duplicidade.
7. Agendar importação interna ou agendar relé externo.
8. Criar enviarEmailCentral e branch mínimo de envio para thread.channel === "email".
9. Criar aba E-mail na configuração de canais.
10. Tratar Gmail via OAuth nativo.
11. Evoluir logs, anexos, permissões e IA.
```
