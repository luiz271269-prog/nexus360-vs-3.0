# Diagnóstico atualizado — IMAP Zimbra `mail.liesch.com.br`

> **Última atualização:** 2026-06-02
> **Status:** Transporte (rede/TLS/certificado) validado. Bloqueio restante concentrado na **autenticação IMAP do Zimbra (server-side)**.

---

## Resumo

Os testes recentes confirmaram que a Base44 **consegue alcançar** o servidor Zimbra por IMAP. A conexão TCP/TLS é estabelecida com sucesso, o servidor responde com o *greeting* IMAP, mas a sessão é **encerrada exatamente no momento da autenticação** (`AUTHENTICATE PLAIN` / `LOGIN`).

Isso indica que o bloqueio atual **não está** no código da Base44, nem em DNS, firewall de entrada, TLS ou certificado. O problema está no **lado do Zimbra**, provavelmente no serviço IMAP/`mailboxd`, na política de autenticação, no COS ou no backend de autenticação (SASL/LDAP).

---

## Veredito corrigido

| Antes | Agora |
|---|---|
| Suspeita de certificado/TLS/rede | **TLS e conexão OK** |
| Erro podia estar no caminho Base44 → servidor | **Caminho de transporte validado** |
| Problema ainda ambíguo | **Problema concentrado no serviço IMAP/autenticação do Zimbra** |

O caminho **Base44 → Zimbra não está mais bloqueado** por rede/TLS/certificado. A conexão IMAP chega no servidor, negocia TLS e recebe greeting. O bloqueio atual ocorre **dentro do Zimbra, no momento da autenticação IMAP**.

---

## Testes realizados

| Conta | Porta | Segurança | Resultado |
|---|---|---|---|
| `luiz@liesch.com.br` | 993 | TLS direto | Conecta, recebe greeting, **encerra no AUTH** |
| `luiz@liesch.com.br` | 143 | STARTTLS | Conecta, negocia STARTTLS, **encerra no AUTH** |
| `liesch@liesch.com.br` | 993 | TLS direto | Conecta, recebe greeting, **encerra no AUTH** |

> ⚠️ **Nenhuma senha é incluída neste documento** por política de segurança.

---

## Interpretação

**O transporte está funcional:**
- DNS responde;
- servidor aceita a conexão;
- TLS estabelece;
- certificado não bloqueia mais a sessão;
- greeting IMAP é recebido.

A falha ocorre **somente quando o cliente tenta autenticar**. Como o servidor **derruba a sessão durante `AUTHENTICATE`/`LOGIN`, antes de retornar uma negativa limpa de credencial**, o erro aponta mais para **falha interna do IMAP/Zimbra** do que para senha incorreta.

Ainda assim, a TI deve **validar a conta/senha localmente** no webmail ou via IMAP local no próprio servidor, pois ainda existem hipóteses possíveis:
- conta bloqueada;
- autenticação IMAP desabilitada por COS;
- política SASL/LDAP quebrada;
- backend de autenticação travando antes de retornar `NO`;
- `mailboxd`/proxy desalinhados.

Como o mesmo comportamento apareceu em **2 contas e 2 portas**, a hipótese **server-wide** ficou bem forte.

---

## Ação solicitada à TI

A TI da Liesch deve verificar o **erro real no servidor** durante uma tentativa de login IMAP.

**Ver o log em tempo real durante um login:**
```bash
su - zimbra
tail -f /opt/zimbra/log/mailbox.log
```
Enquanto o log estiver aberto, realizar uma tentativa de login IMAP (pela Base44 ou outro cliente externo) e observar a exceção que aparece.

**Validar o serviço e a configuração global de IMAP:**
```bash
zmmailboxdctl status
zmprov gcf zimbraImapServerEnabled
zmprov gcf zimbraImapSSLServerEnabled
zmprov gacf | grep -i imap
```

**Se necessário, reiniciar os serviços:**
```bash
zmmailboxdctl restart
zmproxyctl restart
```

**Confirmar se IMAP está habilitado por COS/conta:**
```bash
zmprov ga luiz@liesch.com.br | grep -i imap
zmprov ga liesch@liesch.com.br | grep -i imap
```

---

## Conclusão

A Base44 **já está conseguindo chegar ao Zimbra via IMAP**. O bloqueio restante está no **servidor Zimbra, durante a autenticação IMAP**. Assim que o serviço IMAP/autenticação for normalizado pela TI, o teste deve ser repetido e a listagem de e-mails deve funcionar.

---

## Próxima decisão técnica

Nesta etapa, **não** mexer em `Comunicacao.jsx`, telas ou envio SMTP. A sequência correta é:

1. **TI** corrigir IMAP/autenticação no Zimbra.
2. Rodar novamente `listarEmailsImap` ou `testarConexaoImap`.
3. **Se listar e-mails:** seguir com o importador interno Base44.
4. **Se continuar falhando** por restrição do ambiente: ativar o **plano B** com relé externo Zimbra → webhook Base44.