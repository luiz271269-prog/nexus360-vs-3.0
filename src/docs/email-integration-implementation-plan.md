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

Usar a função de spike `testarConexaoImap` apenas para responder uma pergunta arquitetural: o runtime consegue abrir TLS/IMAP no servidor?

Entrada esperada:

```json
{
  "host": "mail.seudominio.com.br",
  "port": 143,
  "security": "starttls",
  "username": "caixa@seudominio.com.br",
  "password_secret_name": "ZIMBRA_PWD_CAIXA_TESTE",
  "ca_cert_secret_name": "ZIMBRA_CA_CERT",
  "mailbox": "INBOX",
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

Se falhar por timeout, bloqueio de TCP ou erro de rede, a arquitetura muda para relé externo + webhook Base44. Nesse caso, `EmailAccount` continua existindo, mas a leitura IMAP sai do Base44 e passa a ser feita por um serviço externo controlado.

### 0.1.1. Resultado do spike executado

O teste relatado com o secret `Email_ZIMBRA_TESTE` mostrou estes achados práticos:

| Teste | Resultado | Interpretação |
| --- | --- | --- |
| Secret `Email_ZIMBRA_TESTE` antes do redeploy | HTTP 400 | O secret existia, mas ainda não estava disponível para a função em runtime. |
| `imap.gmail.com:993` | Conectou e falhou apenas no login com credencial de teste | O runtime consegue abrir saída TCP/TLS para IMAP 993. |
| `mail.liesch.com.br:993` | Timeout na conexão TLS | A porta 993 ainda não está acessível pela origem do Base44 ou não está liberada no firewall. |
| `mail.liesch.com.br:143` com `security: "starttls"` | TCP conectou, greeting foi recebido e `STARTTLS` respondeu OK; falhou em `UnknownIssuer` | A conectividade com o Zimbra está confirmada pela porta 143. O bloqueio restante é validação de certificado autoassinado/CA privada. |

Conclusão atual: a arquitetura com cron IMAP interno é tecnicamente possível no Base44 **sem depender da porta 993**, usando IMAP 143 com STARTTLS. O próximo bloqueio é cadastrar o certificado público/CA do Zimbra como secret e reenviar o payload com `ca_cert_secret_name`. O IP de saída observado no teste anterior foi `34.16.156.208`, porém ele deve ser tratado como potencialmente variável se a plataforma não garantir IP fixo de egress.

Comando para extrair o certificado público do servidor:

```bash
openssl s_client -connect mail.liesch.com.br:143 -starttls imap -showcerts </dev/null 2>/dev/null | openssl x509 -outform PEM
```

Decisão operacional antes de implementar `importarEmails`:

1. cadastrar o PEM público/CA do Zimbra em um secret, por exemplo `ZIMBRA_CA_CERT`;
2. repetir `testarConexaoImap` contra `mail.liesch.com.br` na porta 143 com `security: "starttls"` e `ca_cert_secret_name: "ZIMBRA_CA_CERT"`;
3. se conectar e listar cabeçalhos, seguir pelo Caminho A: cron interno no Base44 usando STARTTLS;
4. se o certificado não puder ser fornecido ou se STARTTLS ficar instável, seguir pelo Caminho B: relé externo lendo IMAP na rede da Liesch e enviando POST para webhook Base44.

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

Usar este caminho se o Zimbra aceitar IMAP 143 com STARTTLS e certificado confiável via `ca_cert_secret_name`, ou se a porta 993 for liberada e o novo teste retornar `ok: true`.

Responsabilidades:

- `EmailAccount` fica no Base44;
- secrets ficam no cofre do Base44;
- `importarEmails` conecta direto no IMAP, preferencialmente em `security: "starttls"` na porta 143 para o Zimbra atual;
- automação agendada chama `importarEmails`;
- erros de conexão atualizam status da conta.

Vantagens:

- menos infraestrutura;
- implementação centralizada;
- segue o mesmo padrão serverless do app.

Riscos:

- depende do certificado público/CA do Zimbra cadastrado como secret quando usar STARTTLS;
- se usar 993, depende de firewall/liberação do Zimbra e IP de saída estável ou aceito pelo provedor;
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
| `imap_port` | Porta IMAP. |
| `imap_security` | `tls` ou `starttls`. |
| `ca_cert_secret_name` | Nome do secret com o certificado CA (quando STARTTLS). |
| `secret_name` | Nome do secret que guarda a senha. |
| `status` | `pendente`, `conectado`, `erro` ou `inativo`. |
| `ativo` | Liga/desliga sincronização. |
| `last_uid_seen` | Último UID processado. |
| `uidvalidity` | Validade dos UIDs da pasta. |
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
3. Para IMAP/Zimbra, conectar no host/porta usando `secret_name` (e `ca_cert_secret_name` quando STARTTLS).
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

Depois do Zimbra/IMAP estar estável:

1. Listar quais caixas realmente são Gmail.
2. Testar se podem operar por IMAP com app password.
3. Se sim, cadastrar como `provider: "gmail"` usando o mesmo motor IMAP.
4. Se não, criar adapter Gmail API/OAuth separado, mas mantendo a mesma saída normalizada para `Contact`, `MessageThread` e `Message`.

Não deixar o handler Gmail atual como caminho paralelo sem vínculo com `EmailAccount`.

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
- [ ] `EmailAccount` criada sem campos sensíveis.
- [ ] `Message` tem `email_account_id` e `email_message_id`.
- [ ] `MessageThread` tem `email_account_id`.
- [ ] Provider `email` aceito em `Message`.
- [ ] Importação cria contato, thread e mensagem.
- [ ] Segunda execução não duplica mensagens.
- [ ] Thread aparece na Central.
- [ ] Mensagem aparece na conversa.
- [ ] Conta registra `uidvalidity` e `last_uid_seen`.
- [ ] Gmail antigo não fica como fluxo paralelo solto.

## Ordem final recomendada

```text
1. Repetir o teste IMAP no Zimbra pela porta 143/STARTTLS com ca_cert_secret_name ou decidir formalmente pelo relé.
2. Validar renderização do canal email na Central.
3. Criar EmailAccount + campos mínimos em Message/MessageThread.
4. Criar importarEmails interno ou emailInboundWebhook, conforme Caminho A/B.
5. Provar e-mail real na Central sem duplicidade.
6. Agendar importação interna ou agendar relé externo.
7. Criar aba E-mail na configuração de canais.
8. Tratar Gmail.
9. Implementar envio/resposta.
10. Evoluir logs, anexos, permissões e IA.
``