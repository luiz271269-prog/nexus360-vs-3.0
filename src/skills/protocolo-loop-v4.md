# PROTOCOLO LOOP — Método de decisão e execução (Nexus360)
**Versão 4 — Fonte de Verdade + Super-Agente em Loop**

> Esta skill nasceu de seis falhas reais caçadas em sessão (reflexão episódica:
> a falha vira regra). A v4 consolida essas falhas em guardas, adiciona o gate
> de ferramenta por passo (que resolve o escopo da Memória Zero) e formaliza o
> modo super-agente em loop com firewall leitura/escrita.

---

## REGRA MÃE
Toda saída nasce de evidência capturada **AGORA, nesta sessão**. Memória,
contexto antigo e "eu já li antes" **NÃO** são evidência.

Toda afirmação carrega seu tipo de prova:
- **[LIDO]** — leitura viva (`read_file` / `read_entities`) feita nesta sessão.
- **[FONTE]** — busca web citada com URL real, buscada nesta sessão.
- **[HIPÓTESE]** — a testar; ainda não provada.

Sem etiqueta, a frase não sai.

---

## GATE DE FERRAMENTA (por passo) — resolve o escopo da Memória Zero
Cada passo declara a ferramenta que precisa. Se ela não está disponível **NESTA
sessão**, o passo **NÃO produz saída** — reporta "ferramenta X indisponível" e
para ali. Não troca leitura por memória, nem busca por lembrança.

- **Passo 0:** sem ferramenta, sempre pode rodar.
- **Passos 1 / 3 / 7 / 8 (estado interno):** exigem `read_file` / `read_entities`.
- **Passo 2 (mercado):** exige busca web. Sem web = sem benchmark.

---

## ANTI-FABRICAÇÃO (as 6 lições viradas regra)
1. **Diagnóstico só DEPOIS da leitura.** Nenhuma tabela / laudo / severidade
   antes do [LIDO]. Diagnosticar antes de ler é proibido.
2. **Fonte só é fonte se foi buscada nesta sessão e tem URL real.** "Quote" ou
   documento de memória = fabricação. Doc que não abre, não existe.
3. **Contexto antigo ≠ leitura viva.** Comparar exige as DUAS metades relidas
   agora: dado E código. "Não precisa colar" é violação.
4. **Ler nunca é executar.** Leitura = `filter` / `get` / `read_file` / `view`.
   `invoke` / `create` / `update` / `delete` são ESCRITA — nunca entram no
   Passo 1. Função de nome estranho / sem relação não se invoca.
5. **Não prejulgar nomes.** Função, contrato de retorno, "o erro é na Camada X"
   só depois da leitura confirmar. Antes, é [HIPÓTESE].
6. **Hipótese plausível continua hipótese até [LIDO] provar.**

---

## PASSO 0 — DEFINIR O PRONTO (com não-regressão)
- **(a)** o que passa a funcionar + como confirmar.
- **(b) NÃO-REGRESSÃO:** o que NÃO pode quebrar + como reconfirmar intacto.

Critério **comportamental**, sem cravar nome de função. Sem critério, não inicia.

---

## PASSOS DO TIER LEITURA
- **PASSO 1 — LER estado interno vivo** — `[read tools]`
- **PASSO 2 — BENCHMARK de mercado** — `[web; sem web, pula e diz]`
- **PASSO 3 — COMPARAR real × ideal** — só com [LIDO] e [FONTE]
- **PASSO 4 — CAÇAR DUPLICIDADE** — mapa persistido
- **PASSO 5 — ESCOLHER FONTE ÚNICA + redigir patch** `anchor_replace`
  (REMOVE / INSERT / REASON / RISK / ROLLBACK) + dry-run: mostrar o diff exato.

---

## GATE DE APROVAÇÃO (5.5) — fim do tier leitura
O loop **PARA**. Mostra patch + evidência + rollback e espera **token explícito**.

- Aprovação vale para **UM** patch identificado (aquele anchor), nunca cheque em
  branco, nunca herda pro próximo.
- "faz sentido" / "entendi" **NÃO** é aprovação — reperguntar:
  *"preciso de autorização explícita: pode aplicar ESTE patch?"*

---

## TIER ESCRITA
- **PASSO 6 — APLICAR (ESCRITA)** — `[só após token]` — aplica UM patch. Nada
  além do aprovado.
- **PASSO 7–8 — VALIDAR E REGISTRAR** — re-lê vivo pra provar. Grava a reflexão
  da rodada (evidência, o que falhou, o que ficou hipótese) — alimenta a próxima.

---

## LOOP / CONVERGÊNCIA
- **Tiers:** LEITURA (0–5, 7, 8) roda autônomo e repete livre. ESCRITA (6) nunca
  é autônoma — sempre passa pelo gate.
- **"Rodada"** = um passe completo dos passos de leitura.
- **PARA por sucesso:** todos os critérios do Passo 0 [LIDO]-verdes.
- **PARA por limite:** 2 rodadas sem achado novo ou sem convergência estável →
  "limite atingido sem resultado estável, escalar".
- Não entra em loop se a 1ª leitura já bate o critério.

---

## MODO SUPER-AGENTE
Autônomo no tier leitura: busca, lê, compara, critica e redige o patch sozinho,
em loop, até convergir. **Firewall no tier escrita:** qualquer mutação em
produção exige o token humano por-patch.
**Boot:** checar ferramentas; sem read tools, não inicia.

---

## INVARIANTES (v3 +)
- Reversibilidade acima de tudo.
- Limite ~2000 linhas do editor → extrair pra arquivo.
- Precedência da skill forense do `Comunicacao.jsx`.
- Benchmark é régua, não cópia.
- Não decidir regra de negócio do usuário.
- Nunca criar `.md.jsx` nem análise como componente.

---

## GATILHOS
"roda o Loop", "Loop v4", "modo super-agente", "fonte de verdade", "age em loop",
"compara com o melhor do mercado".