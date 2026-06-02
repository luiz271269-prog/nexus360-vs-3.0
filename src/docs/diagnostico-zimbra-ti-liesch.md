# Diagnóstico de Conectividade Zimbra (mail.liesch.com.br) — Para a TI da Liesch

**Data:** 2026-06-02
**Origem dos testes:** Base44 produção (`test_backend_function`), não sandbox.
**Conta testada:** `luiz@liesch.com.br`
**Host:** `mail.liesch.com.br` (IP resolvido: `201.76.14.230`)

---

## Resumo executivo

A Base44 **alcança** o servidor Zimbra (TCP + TLS funcionam). O problema **NÃO é a rede da Base44**.
Os bloqueios estão **100% no lado do servidor Zimbra** (autenticação IMAP + portas SMTP fechadas externamente).

| Transporte | Resultado (Base44 → Zimbra) | Diagnóstico |
|---|---|---|
| **IMAP 993** | TCP OK, TLS OK, protocolo responde, `LOGIN` retorna `BAD internal server error` | Autenticação/conta/proxy IMAP do Zimbra |
| **SMTP 587 (STARTTLS)** | `ECONNREFUSED` | Porta não aceita conexão externa |
| **SMTP 465 (SSL)** | `ECONNREFUSED` | Porta não aceita conexão externa |

Conclusão: o host é alcançável, mas **nenhuma das duas portas de envio aceita conexão externa**, e a **autenticação IMAP falha dentro do próprio Zimbra**.

---

## 1. IMAP (recebimento) — porta 993

**Comportamento observado:**
- Conexão TCP estabelecida ✅
- Handshake TLS concluído ✅
- Servidor responde no protocolo IMAP ✅
- `LOGIN` / `AUTHENTICATE PLAIN` → `BAD internal server error` ❌

**Interpretação:** rede, porta e TLS estão OK. A falha ocorre dentro da autenticação/serviço IMAP do Zimbra.

**Ações no servidor (TI):**
```bash
# Verificar se IMAP está habilitado para a conta
zmprov ga luiz@liesch.com.br | grep -i zimbraImapEnabled
zmprov ga luiz@liesch.com.br | grep -i zimbraFeatureImapDataSourceEnabled

# Verificar saúde geral dos serviços Zimbra
zmcontrol status
```
- Se `zimbraImapEnabled` estiver `FALSE` → ajustar para `TRUE`.
- Validar a senha usada (secret `EMAIL_PWD_LUIZ2LIESCH_COM_BR` na Base44). Se estiver incorreta, atualizar.
- Se ambos estiverem corretos, investigar **mailbox / imapd / proxy** e logs do Zimbra:
  - `/opt/zimbra/log/mailbox.log`
  - `/opt/zimbra/log/zmmailboxd.out`

---

## 2. SMTP (envio) — portas 587 e 465

**Comportamento observado:**
- Host alcançado (não é timeout, não é bloqueio de saída da Base44)
- 587 → `ECONNREFUSED`
- 465 → `ECONNREFUSED`

**Interpretação:** as portas de submissão não estão escutando para conexões externas (postfix em localhost, firewall REJECT, ou serviço submission/smtps não ativo).

**Ações no servidor (TI):**
```bash
# Postfix deve escutar em "all", não apenas localhost
postconf inet_interfaces

# Verificar serviços de submissão
postconf -M | grep submission   # porta 587
postconf -M | grep smtps         # porta 465

# Confirmar quem está escutando nas portas
ss -lntp | grep -E ':587|:465'
```
- Garantir que `inet_interfaces = all`.
- Ativar `submission` (587) e/ou `smtps` (465).
- Liberar a porta escolhida no firewall para conexões externas.

---

## 3. Próximos passos (ordem recomendada)

1. **Corrigir SMTP** — expor pelo menos UMA porta de envio (587 ou 465) para conexão externa.
2. **Corrigir IMAP LOGIN** — habilitar IMAP, validar senha, checar proxy/mailbox.
3. **Só depois** finalizar o sincronizador IMAP incremental na Base44 (Caminho A — importador interno, que já provou ser viável pois o 993 conecta).

---

## 4. Situação atual da plataforma

- Configuração da caixa Zimbra na Base44 **restaurada ao original** (porta 587 / STARTTLS).
- **Nenhum** sincronizador IMAP ou relé externo foi construído — o bloqueio é server-side.
- **Gmail (`Nexus360-Gmail`) segue 100% operacional** como canal de e-mail enquanto a TI corrige o Zimbra.