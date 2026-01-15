# 📊 MATRIZ COMPLETA P1-P12: Nexus360 vs Legado

| P# | Nexus360 (Conceito) | Onde está no Legado | Situação Atual | ✅ Regra (O que faz) |
|----|-----|-----|-----|-----|
| **P1** | Threads internas só por participação | `canUserSeeThreadBase` + `canUserSeeThreadWithFilters` (threadType=`team_internal`/`sector_group`) | ✅ Já implementado no legado; Nexus só precisa respeitar | **Nega** acesso a threads internas se não for participante (ignora integração/setor); Admins sempre entram. |
| **P2** | Fidelização Hard (VIP) | `isFidelizadoAoUsuario()` + bloqueio quando `contato.is_cliente_fidelizado && !fidelizado` | ✅ Pronto no legado; Nexus trata como hard-core absoluto | **Nega** acesso se contato fidelizado a OUTRO usuário (protege VIP), mesmo para admins. |
| **P3** | Propriedade: dono da thread | `isAtribuidoAoUsuario()` + "Thread ATRIBUÍDA = SEMPRE VÊ" em `base`/`filters`/`verificarBloqueio`/`podeInteragir` | ✅ Pronto; Nexus usa `assigned_user_id === user.id` como ALLOW absoluto | **Permite** acesso ilimitado: usuário sempre vê, comenta, transfere, ignora tudo (P9-P11). |
| **P4** | Fidelização ao usuário | `isFidelizadoAoUsuario()` + "Contato FIDELIZADO = SEMPRE VÊ" | ✅ Igual hoje; Nexus trata como chave mestra junto P3 | **Permite** acesso ilimitado: contato fidelizado ao usuário sempre visível, ignora bloqueios (integração/setor/conexão). |
| **P5** | Fail-Safe 24h (mensagem recente) | Blocos "FAIL-SAFE 24h SEMPRE VISÍVEL" em `canUserSeeThreadBase` + `canUserSeeThreadWithFilters` (linhas 336-352, 398-410) | ✅ Já no legado como padrão; Nexus vira `regra_liberacao` tipo `janela_24h` customizável | **Permite** acesso: thread com mensagem recebida <24h fica visível, exceto se fidelizada a outro. |
| **P6** | Ver carteiras de outros | Lógica gerente/supervisor via `isGerente` + filtros de atendente em `canUserSeeThreadWithFilters` | ✅ Comportamento existe; painel Nexus já tem flag `podeVerCarteiraOutros` | **Permite**: supervisor vê contatos fidelizados com colegas do mesmo setor (supervisão de carteira). |
| **P7** | Ver conversas de outros | Gerente/coordenador vê threads atribuídas a outros (`isGerente` + "Gerente pode visualizar atribuída a outro") | ✅ Já no legado; painel Nexus expõe `podeVerConversasOutros` + `podeVerNaoAtribuidas` | **Permite**: gerente/coordenador vê threads atribuídas ou não-atribuídas de colegas do setor (supervisão operacional). |
| **P8** | Supervisão por tempo sem resposta | "Gerente vê threads SEM RESPOSTA há 30 min" em `canUserSeeThreadBase` (linhas 377-386) | ⚠️ Implementado fixo (30 min); Nexus tem `regra_liberacao` tipo `gerente_supervisao` customizável | **Permite**: gerente vê threads de outro atendente após X minutos sem resposta (escalação automática). |
| **P9** | Bloqueio por canal | Implícito via tipo/canal + `temPermissaoIntegracao()` + `threadConexaoVisivel()` | ✅ Em Nexus: `regras_bloqueio` tipo `"canal"` já na UI | **Nega** acesso: bloqueia por canal (WhatsApp, Instagram, Facebook, Phone, Email) se explicitamente restringido. |
| **P10** | Bloqueio por integração (instância) | `temPermissaoIntegracao(usuario, thread.whatsapp_integration_id)` + fallback `integracoes_visiveis` em `permissoes_visualizacao` | ✅ Nexus já modela como `regras_bloqueio` tipo `"integracao"` via conversor legado | **Nega** acesso: bloqueia por instância WhatsApp específica (ex: "Vendas-Chip-1", "Suporte-Chip-2"). |
| **P11** | Bloqueio por setor | `threadSetorVisivel()` (URA + tags de contato) com `permissoes_visualizacao.setores_visiveis` | ✅ Nexus já tem `regras_bloqueio` tipo `"setor"` + flag `podeVerTodosSetores` como override | **Nega** acesso: bloqueia setores não visíveis; override `podeVerTodosSetores` libera todos (diretor/gerente geral). |
| **P12** | Default Allow/Deny (modo padrão) | "Sem configuração LIBERA" implícito em cada helper (`!visiveis \|\| visiveis.length === 0 ? true`) | ⚠️ Nexus introduz `modo_visibilidade`: `padrao_liberado`/`padrao_bloqueado` | **Padrão**: se nenhuma regra P1-P11 se aplica, permite (liberado) ou nega (bloqueado) conforme modo. |

---

## 🎯 HIERARQUIA DE DECISÃO (Ordem de Avaliação)

```
1️⃣ HARD CORE - Bloqueios Absolutos (negam tudo)
   P1  → Thread interna sem participação
   P2  → Fidelização a OUTRO (bloqueia mesmo admin)
   P9  → Canal bloqueado
   P10 → Integração bloqueada
   P11 → Setor bloqueado

2️⃣ OWNERSHIP & COLABORAÇÃO - Chaves Mestras (permitem tudo)
   P3  → Dono da thread (assigned_user_id = user.id)
   P4  → Contato fidelizado ao usuário
   P6  → Ver carteira de outros (se habilitado)
   P7  → Ver conversas de outros (se habilitado)

3️⃣ SOFT CORE - Exceções Configuráveis (permitem com condições)
   P5  → Janela 24h (se message_recebida < 24h)
   P8  → Supervisão gerencial (se tempo_sem_resposta > X min)

4️⃣ DEFAULT - Fallback (P12)
   P12 → Modo padrão (libera ou nega)
```

---

## 🔄 FLUXO DE DECISÃO (Legado → Nexus360)

### **Legado (threadVisibility.js)**
1. Admin? → **ALLOW**
2. Pode ver todas conversas? → **ALLOW**
3. Threads internas sem participação? → **DENY** (P1)
4. Mensagem recebida <24h? → **ALLOW** (P5)
5. Fidelizado a outro? → **DENY** (P2)
6. Atribuído ao usuário? → **ALLOW** (P3)
7. Fidelizado ao usuário? → **ALLOW** (P4)
8. Gerente + 30min sem resposta? → **ALLOW** (P8)
9. Gerente vê tudo atribuído a outro? → **ALLOW** (P7)
10. Não-atribuída + permissões técnicas OK? → **ALLOW** (P9/P10/P11)
11. Default: sem config = **ALLOW**

### **Nexus360 (decidirVisibilidadeNexus.js)**
1. P1 (thread interna sem participação)? → **DENY**
2. P9 (canal bloqueado)? → **DENY**
3. P10 (integração bloqueada)? → **DENY**
4. P11 (setor bloqueado)? → **DENY**
5. P3 (dono)? → **ALLOW**
6. P7 (ver conversas outros)? → **ALLOW**
7. P6 (ver carteira outros)? → **ALLOW**
8. P5 (janela 24h)? → **ALLOW**
9. P8 (supervisão gerencial)? → **ALLOW**
10. Ver todas conversas? → **ALLOW**
11. P12 (default)? → **ALLOW** ou **DENY**

---

## ⚠️ GAPS CRÍTICOS

| Gap | Descrição | Impacto | Solução |
|-----|-----------|--------|---------|
| **Gap-1** | P5 em Nexus é configurável; Legado é automático para <24h | Threads "quentes" podem ficar invisíveis | Converter usuários com janela_24h ativa por padrão |
| **Gap-2** | P2 (fidelização) não diferencia por setor no Nexus | Perda de flexibilidade multi-setorial | Deprecar ou adicionar suporte em roadmap |
| **Gap-3** | P6/P7 dependem de flags separadas; Legado usa role | Mudança comportamental | Documentar que flags habilitam supervisão |

---

## 📋 CHECKLIST MIGRAÇÃO LEGADO → NEXUS360

### Para cada usuário:
- [ ] Manter `sistema_permissoes_ativo = 'legacy'` até validar
- [ ] Converter `permissoes_visualizacao.integracoes_visiveis` → `regras_bloqueio[tipo='integracao']`
- [ ] Converter `permissoes_visualizacao.setores_visiveis` → `regras_bloqueio[tipo='setor']`
- [ ] Converter `permissoes_visualizacao.conexoes_visiveis` → regras bloqueio (não há equivalente direto; usar integracao como proxy)
- [ ] **CRÍTICO**: Adicionar `regras_liberacao[tipo='janela_24h']` com `horas=24` (compatibilidade P5)
- [ ] Se `isGerente`: ativar `podeVerConversasOutros` + `podeVerNaoAtribuidas` (P7)
- [ ] Se `role='admin'`: deixar tudo aberto ou usar como template para outros

---

## 🚀 STATUS DE IMPLEMENTAÇÃO

| P# | Motor Legado | Painel Nexus | Motor Nexus | Wrapper (Shadow/Ativo) |
|----|----|----|----|----|
| P1 | ✅ | - | ✅ | ⏳ Testar |
| P2 | ✅ | - | ✅ | ⏳ Testar |
| P3 | ✅ | - | ✅ | ⏳ Testar |
| P4 | ✅ | - | ✅ | ⏳ Testar |
| P5 | ✅ | ✅ `regra_liberacao[janela_24h]` | ✅ | ⏳ Testar |
| P6 | ✅ | ✅ `podeVerCarteiraOutros` | ⚠️ Parcial | ⏳ Completar |
| P7 | ✅ | ✅ `podeVerConversasOutros` | ⚠️ Parcial | ⏳ Completar |
| P8 | ✅ | ✅ `regra_liberacao[gerente_supervisao]` | ✅ | ⏳ Testar |
| P9 | ✅ | ✅ `regras_bloqueio[canal]` | ✅ | ⏳ Testar |
| P10 | ✅ | ✅ `regras_bloqueio[integracao]` | ✅ | ⏳ Testar |
| P11 | ✅ | ✅ `regras_bloqueio[setor]` | ✅ | ⏳ Testar |
| P12 | ✅ | ✅ `modo_visibilidade` | ✅ | ⏳ Testar |