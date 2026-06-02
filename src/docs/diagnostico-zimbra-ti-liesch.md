# Diagnóstico FINAL de Conectividade Zimbra (mail.liesch.com.br) — Para a TI da Liesch

**Data:** 2026-06-02
**Conta:** `luiz@liesch.com.br` · **Host:** `mail.liesch.com.br`
**Fontes:** teste real de IMAP/SMTP feito a partir da plataforma + análise das telas do Zimbra Admin (Configurações globais).

---

## ✅ RESUMO EXECUTIVO

A plataforma **alcança** o servidor (TCP + TLS OK). **Todos os bloqueios estão no servidor Zimbra**, comprovados nas próprias telas do Admin:

1. **Serviço IMAP DESATIVADO** (Configurações globais → IMAP)
2. **Serviço POP DESATIVADO** (Configurações globais → POP)
3. **Portas SMTP de envio (587/465) não expostas** (Configurações globais → MTA → Rede)

> Resumo de 1 linha: *"IMAP e proxy de e-mail estão desligados no Zimbra Admin; por isso a porta 993 aceita conexão mas o LOGIN devolve 'internal server error'. Envio (587/465) também não está exposto. Ativar os serviços e expor as portas resolve."*

---

## 1. Evidência do teste real (IMAP 993)

```
* OK IMAP4rev1 proxy server ready      ← TCP + TLS OK (chegamos no servidor)
> A0001 CAPABILITY
* CAPABILITY ... AUTH=PLAIN             ← protocolo responde
A0001 OK completed
> A0002 LOGIN "***" "***"
* BAD internal server error             ← ❌ servidor falha no LOGIN
```
Rede, porta e TLS estão OK. A falha é **interna do Zimbra** ao processar o login — porque o serviço IMAP do mailbox está desligado.

---

## 2. BLOQUEIO #1 — Serviço IMAP desativado (CAUSA RAIZ)

**Tela:** Configurações globais → **IMAP** → Serviço
```
☐ Ativar o serviço IMAP             ← precisa MARCAR
☐ Ativar SSL para o serviço IMAP    ← precisa MARCAR (porta 993)
```
**Ação:** marcar ambos.

Complemento por linha de comando (garantir IMAP na conta):
```bash
zmprov ga luiz@liesch.com.br zimbraImapEnabled
zmprov ms `zmhostname` zimbraReverseProxyMailEnabled TRUE
```

---

## 3. BLOQUEIO #2 — Proxy de e-mail desativado

**Tela:** Configurações globais → **Proxy** → Configuração de Proxy de E-mail
```
☐ Ativar proxy de e-mail            ← precisa MARCAR
Porta IMAPS de proxy: 993           ← já correto
```
O servidor no teste se anunciou como "proxy server ready", logo a 993 está atrás do nginx — que precisa do proxy de e-mail ativo para rotear ao mailbox.

---

## 4. BLOQUEIO #3 — SMTP de envio (587 / 465) não exposto

**Teste real:** 587 → `ECONNREFUSED`, 465 → `ECONNREFUSED` (host alcançado, portas recusam).
**Tela:** Configurações globais → **MTA** → Rede mostra `localhost` / Porta 25.

**Ações no servidor:**
```bash
postconf inet_interfaces          # deve ser "all"
postconf -M | grep submission     # 587 ativo?
postconf -M | grep smtps          # 465 ativo?
ss -lntp | grep -E ':587|:465'    # quem escuta?
```
Garantir `inet_interfaces = all`, ativar submission (587) ou smtps (465) e liberar no firewall.

---

## 5. Telas que estão CORRETAS (não bloqueiam)

| Tela | Situação |
|---|---|
| MTA → Autenticação | ☑ Ativar autenticação + ☑ Apenas TLS ✅ |
| MTA → Mensagens | Máx 20 MB ✅ |
| MTA → RBLs / DNS checks | anti-spam de entrada ✅ (não afeta login) |
| AS/AV | spam 20% / antivírus 2h ✅ |
| Autenticação | sem restrição de IP de login ✅ |
| Info gerais | Domínio padrão `liesch.com.br` ✅ |
| Interoperação / Avançado / Retenção | neutros ✅ |

---

## 6. Procedimento final (ordem exata para a TI)

1. **IMAP** → marcar ☑ Ativar serviço IMAP + ☑ Ativar SSL IMAP
2. **Proxy** → marcar ☑ Ativar proxy de e-mail
3. **MTA / firewall** → expor porta 587 (ou 465) externamente
4. **Reiniciar serviços:**
   ```bash
   zmmailboxdctl restart
   zmproxyctl restart
   zmmtactl restart
   ```
5. Avisar a equipe Nexus360 para reexecutar o teste de conexão.

---

## 7. Situação da plataforma enquanto a TI corrige

- Configuração da caixa Zimbra na plataforma **correta** (IMAP 993 TLS / SMTP 587 STARTTLS / senha no secret `EMAIL_PWD_LUIZ2LIESCH_COM_BR`).
- **Nenhum** sincronizador/relé externo foi construído — o bloqueio é 100% server-side.
- **Gmail (`Nexus360-Gmail`) segue operacional** como canal de e-mail até o Zimbra ser corrigido.