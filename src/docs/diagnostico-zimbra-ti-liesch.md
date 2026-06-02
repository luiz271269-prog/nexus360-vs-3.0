# Diagnóstico atualizado — IMAP Zimbra `mail.liesch.com.br`

> **Atualizado em:** 2026-06-02
> **Status:** Transporte (rede/TLS/certificado) validado. Bloqueio restante isolado na **autenticação IMAP do Zimbra**.

---

## Resumo

Os testes recentes confirmaram que a Base44 **consegue alcançar** o servidor Zimbra por IMAP. A conexão TCP/TLS é estabelecida com sucesso, o servidor responde com o **greeting IMAP**, mas a sessão é **encerrada exatamente no momento da autenticação** (`AUTHENTICATE PLAIN` / `LOGIN`).

Isso indica que o bloqueio atual **não está** no código da Base44, nem em DNS, firewall de entrada, TLS ou certificado. O problema está no lado do **Zimbra**, provavelmente no serviço **IMAP/mailboxd**, política de autenticação, **COS** ou backend de autenticação (SASL/LDAP).

---

## Testes realizados

| Conta | Porta | Segurança | Resultado |
|---|---|---|---|
| `luiz@liesch.com.br` | 993 | TLS direto | Conecta, recebe greeting, **encerra no AUTH** |
| `luiz@liesch.com.br` | 143 | STARTTLS | Conecta, negocia STARTTLS, **encerra no AUTH** |
| `liesch@liesch.com.br` | 993 | TLS direto | Conecta, recebe greeting, **encerra no AUTH** |

---

## Interpretação

O **transporte está funcional**:

- DNS responde;
- servidor aceita conexão;
- TLS estabelece;
- certificado não bloqueia mais a sessão;
- greeting IMAP é recebido.

A falha ocorre **somente quando o cliente tenta autenticar**.

Como o servidor **derruba a sessão durante `AUTHENTICATE` / `LOGIN`, antes de retornar uma negativa limpa de credencial**, o erro aponta mais para **falha interna do IMAP/Zimbra** do que para senha incorreta.

Ainda assim, a TI deve **validar a conta/senha localmente** no webmail ou via IMAP local no próprio servidor, pois tecnicamente ainda existem hipóteses possíveis:

- conta bloqueada;
- autenticação IMAP desabilitada por COS;
- política SASL/LDAP quebrada;
- backend de auth travando antes de retornar `NO`;
- `mailboxd`/proxy desalinhados.

Como o mesmo comportamento aparece em **mais de uma conta e mais de uma porta**, a hipótese mais forte é **falha server-side no IMAP/Zimbra**.

---

## Ação solicitada à TI

A TI da Liesch deve verificar o **erro real no servidor** durante uma tentativa de login IMAP.

**1. Acompanhar o log durante uma tentativa de login:**

```bash
su - zimbra
tail -f /opt/zimbra/log/mailbox.log
```

Enquanto o log está aberto, realizar uma tentativa de login IMAP pela Base44 ou por outro cliente externo, e observar a exceção que aparece.

**2. Validar estado do serviço e flags IMAP:**

```bash
zmmailboxdctl status
zmprov gcf zimbraImapServerEnabled
zmprov gcf zimbraImapSSLServerEnabled
zmprov gacf | grep -i imap
```

**3. Reiniciar serviços se necessário:**

```bash
zmmailboxdctl restart
zmproxyctl restart
```

**4. Confirmar se IMAP está habilitado por COS/conta:**

```bash
zmprov ga luiz@liesch.com.br | grep -i imap
zmprov ga liesch@liesch.com.br | grep -i imap
```

> **Segurança:** nenhuma senha deve ser incluída neste documento ou em logs. Validar credenciais apenas localmente no servidor/webmail.

---

## Conclusão

A Base44 **já está conseguindo chegar ao Zimbra via IMAP**. O bloqueio restante está **no servidor Zimbra durante a autenticação IMAP**. Assim que o serviço IMAP/autenticação for normalizado pela TI, o teste deve ser repetido e a listagem de e-mails deve funcionar.

---

## Próxima decisão técnica

Não mexer em `Comunicacao.jsx`, tela ou envio SMTP nesta etapa. A próxima etapa correta é:

1. **TI corrigir** IMAP/autenticação no Zimbra.
2. **Rodar novamente** `listarEmailsImap` ou `testarConexaoImap`.
3. **Se listar e-mails:** seguir com o importador interno Base44 (EmailAccount → importador).
4. **Se continuar falhando** por restrição do ambiente: ativar **plano B** com relé externo Zimbra → webhook Base44.