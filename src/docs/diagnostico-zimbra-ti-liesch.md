# Diagnóstico Zimbra × Base44 (mail.liesch.com.br) — Para a TI da Liesch

**Data:** 2026-06-02
**Conta:** `luiz@liesch.com.br` · **Host:** `mail.liesch.com.br`
**Fontes:** testes externos reais de IMAP/SMTP a partir da plataforma + leitura das telas do Zimbra Admin (Configurações globais).

---

## ✅ RESUMO EXECUTIVO

A plataforma **alcança** o servidor (TCP + TLS OK). O problema é **server-side no Zimbra**:

1. **Login IMAP falha** com `BAD internal server error` (IMAP/SSL IMAP e proxy de e-mail aparecem desativados nas telas globais).
2. **SMTP 587 e 465 recusam conexão** (`ECONNREFUSED` comprovado nos testes externos).
3. **SMTP Auth + TLS está correto** — não é bloqueio.

> ⚠️ **Ressalva técnica importante:** no Zimbra, configurações globais podem ser **sobrescritas por servidor, domínio, COS ou conta**. As telas globais são forte indício, mas a TI deve **confirmar e ativar via `zmprov`** no nível certo (servidor/COS/conta), não só na tela global.

---

## 1. Evidência dos testes externos

**IMAP 993:**
```
* OK IMAP4rev1 proxy server ready      ← TCP + TLS OK + há proxy/nginx na frente da 993
> A0002 LOGIN "***" "***"
* BAD internal server error             ← ❌ falha interna no LOGIN
```

**SMTP:**
```
587 STARTTLS → ECONNREFUSED             ← porta recusa (chegamos no IP, porta fechada)
465 SSL/TLS  → ECONNREFUSED             ← porta recusa
```
Conclusão: rede/IP/TLS OK. Falhas são de **serviço/porta/firewall** no servidor.

---

## 2. BLOQUEIO #1 — IMAP / SSL IMAP

**Telas globais (Admin → Configurações globais → IMAP):**
```
☐ Ativar o serviço IMAP
☐ Ativar SSL para o serviço IMAP
```
Forte evidência da causa do `BAD internal server error`. **Mas confirmar nos níveis que podem sobrescrever o global:**
```bash
su - zimbra

# Conferir estado real (global + servidor + conta)
zmprov gacf zimbraImapEnabled
zmprov gs $(zmhostname) zimbraImapEnabled
zmprov gs $(zmhostname) zimbraImapSSLServerEnabled
zmprov ga luiz@liesch.com.br zimbraImapEnabled
```
**Ação esperada:**
```bash
zmprov mcf zimbraImapEnabled TRUE
zmprov mcf zimbraImapSSLServerEnabled TRUE
zmprov ma luiz@liesch.com.br zimbraImapEnabled TRUE
zmmailboxdctl restart
```

---

## 3. BLOQUEIO #2 — Proxy de e-mail

**Tela (Admin → Configurações globais → Proxy):**
```
☐ Ativar proxy de e-mail
Porta IMAPS de proxy: 993   ← correto
```
Como o teste respondeu `IMAP4rev1 proxy server ready`, há proxy/nginx na frente da 993. Se o proxy de e-mail não estiver corretamente ativo/aplicado, ele **aceita TLS mas falha ao repassar o LOGIN** ao mailstore — exatamente o sintoma observado.
```bash
su - zimbra

zmprov gs $(zmhostname) zimbraReverseProxyMailEnabled
zmprov gs $(zmhostname) zimbraReverseProxyImapEnabled
zmprov gs $(zmhostname) zimbraReverseProxyImapSaslEnabled
```
**Ação esperada:**
```bash
zmprov ms $(zmhostname) zimbraReverseProxyMailEnabled TRUE
zmprov ms $(zmhostname) zimbraReverseProxyImapEnabled TRUE
zmproxyctl restart
```

---

## 4. BLOQUEIO #3 — SMTP 587 / 465 fechado externamente

**Provado pelos testes externos** (`ECONNREFUSED` em 587 e 465), **não pela tela**.

> 📌 **Interpretação correta da tela MTA → Rede:** ela mostra que o **webmail interno** usa MTA local em `localhost:25` — isso é **normal** e **não prova por si só** se 587/465 estão expostos externamente. Quem prova o fechamento externo é o `ECONNREFUSED`.

**A TI deve verificar (fora da tela):**
```bash
su - zimbra

postconf inet_interfaces                     # deve permitir escuta externa
postconf -M | grep -E 'submission|smtps'     # 587 / 465 ativos no master.cf?
ss -lntp | grep -E ':25|:465|:587'           # quem está escutando?
zmmtactl status
```
E no firewall/NAT da infraestrutura:
```bash
firewall-cmd --list-ports
iptables -L -n
```
**Ação esperada:** ativar submission (587) ou smtps (465), garantir escuta externa e liberar firewall/NAT.

---

## 5. Telas que estão CORRETAS (não bloqueiam)

| Tela | Situação |
|---|---|
| MTA → Autenticação | ☑ Ativar autenticação + ☑ Apenas TLS ✅ (perfil correto: 587 STARTTLS ou 465 SSL) |
| MTA → Rede | webmail `localhost:25` ✅ normal — não prova 587/465 |
| MTA → Mensagens | Máx 20 MB ✅ |
| MTA → RBLs / DNS checks | anti-spam de entrada ✅ (não afeta login) |
| AS/AV | spam 20% / antivírus 2h ✅ |
| Info gerais | Domínio padrão `liesch.com.br` ✅ |
| POP | desativado — irrelevante (usamos IMAP) |

---

## 6. Versão pronta para enviar à TI

> **Diagnóstico Zimbra × Base44 — mail.liesch.com.br**
>
> Testes externos:
> 1. IMAP 993: TCP/TLS conectam, servidor responde como proxy IMAP, mas `LOGIN` retorna `BAD internal server error`.
> 2. SMTP: porta 587 → `ECONNREFUSED`; porta 465 → `ECONNREFUSED`.
>
> Nas telas do Zimbra Admin (configurações globais): IMAP e SSL IMAP desativados; proxy de e-mail aparece desativado; SMTP Auth ativo exigindo TLS (correto); MTA webmail usa `localhost:25` (normal — não prova abertura externa de 587/465).
>
> **Ação necessária:**
> 1. Ativar IMAP e SSL IMAP globalmente **e/ou** no servidor/COS/conta.
> 2. Ativar proxy de e-mail/IMAP no servidor.
> 3. Reiniciar `mailboxd` e `proxy`.
> 4. Ativar/liberar SMTP submission 587 ou SMTPS 465 no Postfix/Zimbra, firewall e NAT.
> 5. Reexecutar o teste Base44.
>
> **Comandos sugeridos:**
> ```bash
> su - zimbra
> zmprov gs $(zmhostname) zimbraImapEnabled
> zmprov gs $(zmhostname) zimbraImapSSLServerEnabled
> zmprov gs $(zmhostname) zimbraReverseProxyMailEnabled
> zmprov ga luiz@liesch.com.br zimbraImapEnabled
> postconf -M | grep -E 'submission|smtps'
> ss -lntp | grep -E ':993|:587|:465'
> zmmailboxdctl restart
> zmproxyctl restart
> zmmtactl restart
> ```

---

## 7. Próximo passo do lado da plataforma (após correção da TI)

1. Rodar `testarConexaoImap`.
2. Só avançar para `EmailAccount` + importador definitivo quando houver **LOGIN OK + SELECT INBOX OK + UID SEARCH OK**.
3. Decisão IMAP direto × relé externo permanece reservada caso o LOGIN siga falhando após as correções.
4. **Gmail (`Nexus360-Gmail`) segue operacional** como canal de e-mail enquanto o Zimbra é corrigido.