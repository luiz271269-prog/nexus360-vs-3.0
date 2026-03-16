# 📋 ANÁLISE: MÓDULO PLANO DE AÇÃO DE RETENÇÃO
## Integração com Gestão Comercial + Automações

---

## 1. CONTEXTO E NECESSIDADE

### 1.1 Problema Identificado
Na página **GestaoComercial**, listamos **20 clientes em risco** com score (0-100):
- ❌ Gestor VÊ o cliente em risco
- ❌ Gestor NÃO CONSEGUE agir imediatamente
- ❌ Cliente segue desaparecido por semanas
- ❌ Sem rastreamento de tentativas de recuperação

**Impacto:** Churn ocorre por inação, não por falta de dados.

### 1.2 Solução Proposta
**Módulo de Retenção** = Ponte entre **Diagnóstico (GestaoComercial) → Ação (TarefaInteligente) → Acompanhamento (Automação)**

---

## 2. ARQUITETURA DO MÓDULO

### 2.1 Componentes Principais

```
GestaoComercial (página)
└── Tabela de Clientes em Risco
    └── Botão "🔄 PLANEJAR RECUPERAÇÃO"
        └── ModalPlanoRetencao (novo componente)
            ├── Seleciona cliente (pré-preenchido)
            ├── Define estratégia (ligação, email, oferta, análise)
            ├── Atribui atendente (com filtro por setor)
            ├── Define prazo (dropdown: 24h, 48h, 7d, personalizado)
            ├── Escreve observações (contexto para atendente)
            └── Botão "✅ CRIAR PLANO"
                └── Cria TarefaInteligente + Dispara Automação
```

### 2.2 Fluxo de Dados

```
┌─────────────────────────────────────────────────────────┐
│ 1. GESTÃO COMERCIAL                                      │
│    Cliente em Risco (score_risco = 75%)                 │
│    • Nome: Empresa ABC                                  │
│    • Score: 75                                          │
│    • Motivo: Sem resposta há 8 dias                     │
│    • Vendedor: João Silva                               │
└─────────────────────────────────────────────────────────┘
                         ↓
                  Clica "Planejar Recuperação"
                         ↓
┌─────────────────────────────────────────────────────────┐
│ 2. MODAL PLANO RETENCAO (novo)                          │
│    Cliente: Empresa ABC (pré-preenchido, read-only)    │
│    Estratégia: [ ] Ligação [ ] Email [ ] Oferta...     │
│    Responsável: [Dropdown com atendentes]              │
│    Prazo: [ 24h ] [ 48h ] [ 7 dias ]                    │
│    Observações: "Oferecer desconto 10% se voltar"      │
│    Botão: "✅ CRIAR PLANO DE AÇÃO"                      │
└─────────────────────────────────────────────────────────┘
                         ↓
              Cria 2 registros em paralelo:
                         ↓
        ┌──────────────────┬──────────────────┐
        ↓                  ↓                  ↓
┌──────────────────┐ ┌──────────────────┐ ┌──────────────────┐
│ 3. TarefaInteligente
│    title: "Recuperar Empresa ABC"
│    prioridade: "alta"
│    status: "pendente"
│    vendedor: "João Silva"
│    contact_id: <id_empresa_abc>
│    data_prazo: now + 24h
│    tipo: "retencao"
│    plano_retencao_id: <novo_id>
└──────────────────┘

│ 4. PlanoRetencao (nova entidade)
│    contact_id: <id_empresa_abc>
│    status: "ativo"
│    estrategia: "ligacao"
│    responsavel_user_id: <atendente>
│    prazo_original: now + 24h
│    observacoes: "Oferecer desconto..."
│    tentativas: []
│    resultado: null
└──────────────────┘

│ 5. AUTOMAÇÃO CRIADA
│    - Enviar notificação ao atendente
│    - Agendar check-in em 12h se sem resposta
│    - Auto-escalar para gestor em 48h se sem contato
│    - Registrar tentativas em log
└──────────────────┘
```

---

## 3. ENTIDADES ENVOLVIDAS

### 3.1 Entidade NOVA: PlanoRetencao

```typescript
{
  "name": "PlanoRetencao",
  "type": "object",
  "properties": {
    "contact_id": {
      "type": "string",
      "description": "ID do contato em risco"
    },
    "cliente_nome": {
      "type": "string",
      "description": "Nome do cliente (cache)"
    },
    "score_risco_inicial": {
      "type": "number",
      "description": "Score de risco quando plano foi criado (0-100)"
    },
    "estrategia": {
      "type": "string",
      "enum": ["ligacao", "email", "oferta_especial", "analise_customizada", "visita_presencial"],
      "description": "Tipo de ação de recuperação"
    },
    "responsavel_user_id": {
      "type": "string",
      "description": "ID do atendente responsável"
    },
    "responsavel_nome": {
      "type": "string",
      "description": "Nome do atendente (cache)"
    },
    "status": {
      "type": "string",
      "enum": ["ativo", "em_execucao", "em_sucesso", "em_falha", "cancelado"],
      "default": "ativo",
      "description": "Estado do plano"
    },
    "prazo_original": {
      "type": "string",
      "format": "datetime",
      "description": "Prazo para primeiro contato"
    },
    "observacoes_gestor": {
      "type": "string",
      "description": "Contexto/instruções do gestor"
    },
    "tentativas": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "data": {"type": "string", "format": "datetime"},
          "tipo": {"type": "string", "enum": ["ligacao", "email", "whatsapp", "reuniao"]},
          "resultado": {"type": "string", "enum": ["alcancado", "nao_alcancado", "reagendado"]},
          "observacoes": {"type": "string"}
        }
      },
      "default": [],
      "description": "Log de tentativas de contato"
    },
    "resultado_final": {
      "type": "string",
      "enum": ["cliente_recuperado", "cliente_perdido", "em_analise", "pendente"],
      "description": "Resultado final do plano"
    },
    "cliente_score_final": {
      "type": "number",
      "description": "Score do cliente após plano"
    },
    "concluido_em": {
      "type": "string",
      "format": "datetime",
      "description": "Quando o plano foi finalizado"
    },
    "tarefa_inteligente_id": {
      "type": "string",
      "description": "ID da tarefa vinculada"
    }
  },
  "required": ["contact_id", "estrategia", "responsavel_user_id", "prazo_original"]
}
```

### 3.2 Entidade MODIFICADA: TarefaInteligente
**Adicionar campos:**
```json
{
  "tipo": {
    "enum": [..., "retencao", ...],
    "description": "Identifica tarefas de retenção"
  },
  "plano_retencao_id": {
    "type": "string",
    "description": "Vincula a tarefa ao plano"
  }
}
```

---

## 4. FLUXO DE COMPONENTES

### 4.1 Novo Componente: ModalPlanoRetencao

**Arquivo:** `components/gestao-comercial/ModalPlanoRetencao.jsx`

```jsx
export default function ModalPlanoRetencao({
  cliente,           // { id, nome, email, score_risco, motivo_risco }
  onClose,
  onCriarPlano      // callback quando plano criado
}) {
  const [estrategia, setEstrategia] = useState('ligacao');
  const [responsavel, setResponsavel] = useState('');
  const [prazo, setPrazo] = useState('24h');
  const [observacoes, setObservacoes] = useState('');
  const [atendentes, setAtendentes] = useState([]);
  const [criando, setCriando] = useState(false);

  // Carrega atendentes ao montar
  useEffect(() => {
    carregarAtendentes();
  }, []);

  const carregarAtendentes = async () => {
    const users = await base44.asServiceRole.entities.User.filter(
      { role: 'user' },
      '-created_date',
      100
    );
    setAtendentes(users);
  };

  const handleCriarPlano = async () => {
    try {
      setCriando(true);

      // 1. Calcular prazo absoluto
      const prazoDays = prazo === '24h' ? 1 : prazo === '48h' ? 2 : prazo === '7d' ? 7 : 1;
      const prazoDt = new Date();
      prazoDt.setDate(prazoDt.getDate() + prazoDays);

      // 2. Criar PlanoRetencao
      const planoData = {
        contact_id: cliente.id,
        cliente_nome: cliente.nome,
        score_risco_inicial: cliente.scoreRisco,
        estrategia,
        responsavel_user_id: responsavel,
        responsavel_nome: atendentes.find(a => a.id === responsavel)?.full_name,
        status: 'ativo',
        prazo_original: prazoDt.toISOString(),
        observacoes_gestor: observacoes
      };

      const plano = await base44.entities.PlanoRetencao.create(planoData);

      // 3. Criar TarefaInteligente
      const tarefaData = {
        title: `🔄 Recuperar: ${cliente.nome}`,
        status: 'pendente',
        prioridade: cliente.scoreRisco >= 80 ? 'critica' : 'alta',
        data_prazo: prazoDt.toISOString(),
        vendedor_responsavel: atendentes.find(a => a.id === responsavel)?.full_name,
        contexto_ia: {
          atendente_user_id: responsavel,
          tipo: 'retencao',
          cliente_score_risco: cliente.scoreRisco,
          motivo_risco: cliente.motivo
        },
        contact_id: cliente.id,
        plano_retencao_id: plano.id,
        tipo: 'retencao'
      };

      const tarefa = await base44.entities.TarefaInteligente.create(tarefaData);

      // 4. Dispara automação (notificação)
      toast.success(`✅ Plano de retenção criado para ${cliente.nome}`);
      onCriarPlano(plano);
      onClose();
    } catch (error) {
      console.error('[RETENCAO] Erro:', error);
      toast.error('Erro ao criar plano');
    } finally {
      setCriando(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>📋 Plano de Ação - Retenção</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Cliente - read only */}
          <div>
            <label className="text-sm font-medium">Cliente</label>
            <div className="mt-1 p-3 bg-slate-100 rounded-lg">
              <p className="font-semibold">{cliente.nome}</p>
              <p className="text-xs text-slate-600">{cliente.motivo}</p>
            </div>
          </div>

          {/* Estratégia */}
          <div>
            <label className="text-sm font-medium">Estratégia de Recuperação</label>
            <select 
              value={estrategia} 
              onChange={(e) => setEstrategia(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg"
            >
              <option value="ligacao">📞 Ligação Direcionada</option>
              <option value="email">📧 Email Personalizado</option>
              <option value="oferta_especial">🎁 Oferta Especial</option>
              <option value="analise_customizada">📊 Análise Customizada</option>
              <option value="visita_presencial">🤝 Visita Presencial</option>
            </select>
          </div>

          {/* Responsável */}
          <div>
            <label className="text-sm font-medium">Atribuir a</label>
            <select 
              value={responsavel} 
              onChange={(e) => setResponsavel(e.target.value)}
              className="w-full mt-1 px-3 py-2 border rounded-lg"
            >
              <option value="">-- Selecione um atendente --</option>
              {atendentes.map(a => (
                <option key={a.id} value={a.id}>{a.full_name}</option>
              ))}
            </select>
          </div>

          {/* Prazo */}
          <div>
            <label className="text-sm font-medium">Prazo para Primeiro Contato</label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              {['24h', '48h', '7d'].map(p => (
                <button
                  key={p}
                  onClick={() => setPrazo(p)}
                  className={`px-3 py-2 rounded border ${
                    prazo === p 
                      ? 'bg-orange-500 text-white border-orange-600' 
                      : 'border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Observações */}
          <div>
            <label className="text-sm font-medium">Observações/Contexto</label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Ex: Oferecer 10% desconto se voltar. Cliente teve problemas com atendimento..."
              className="w-full mt-1 px-3 py-2 border rounded-lg h-24"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button 
            onClick={handleCriarPlano}
            disabled={!responsavel || criando}
            className="bg-orange-600 hover:bg-orange-700"
          >
            {criando ? '⏳ Criando...' : '✅ Criar Plano'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

### 4.2 Integração na GestaoComercial

**Modificar:** `pages/GestaoComercial.jsx`

Na tabela de clientes em risco, adicionar coluna de ação:
```jsx
<td className="px-4 py-3">
  <Button
    onClick={() => {
      setClienteSelecionado(cliente);
      setMostrarModalRetencao(true);
    }}
    size="sm"
    className="bg-orange-600 hover:bg-orange-700 text-white"
  >
    🔄 Planejar
  </Button>
</td>
```

---

## 5. AUTOMAÇÕES NECESSÁRIAS

### 5.1 Automação 1: NOTIFICAÇÃO AO ATENDENTE
**Tipo:** Entity (TarefaInteligente.create)  
**Acionador:** Quando tarefa tipo "retencao" é criada  
**Função:** `notificarAtendentePlanoRetencao`

```javascript
// Executado quando TarefaInteligente é criada com tipo='retencao'
// 1. Busca dados do plano
// 2. Envia notificação WhatsApp/Email ao atendente
// 3. Registra timestamp de notificação
```

### 5.2 Automação 2: CHECK-IN EM 12H
**Tipo:** Scheduled (Cron)  
**Horário:** A cada 12 horas  
**Função:** `verificarProgressoPlanoRetencao`

```javascript
// Verifica todos PlanoRetencao com status='ativo' e prazo próximo
// Se nenhuma tentativa registrada em 12h:
//   - Envia reminder ao atendente
//   - Marca como "risco_cumprimento_prazo"
```

### 5.3 Automação 3: ESCALAÇÃO PARA GESTOR
**Tipo:** Scheduled (Cron)  
**Horário:** A cada 6 horas  
**Função:** `escalarPlanoRetencaoVencido`

```javascript
// Se PlanoRetencao com prazo passou e status != 'em_sucesso':
//   - Muda status para 'em_falha'
//   - Alerta gestor no Dashboard
//   - Sugere próximas ações
```

### 5.4 Automação 4: REGISTRO DE TENTATIVAS
**Tipo:** Entity (Message.create)  
**Acionador:** Quando mensagem enviada ao contato em plano  
**Função:** `registrarTentativaRetencao`

```javascript
// Quando atendente envia mensagem ao contato:
//   - Registra tentativa em PlanoRetencao.tentativas[]
//   - Atualiza status
//   - Refaz cálculo de score de risco
```

### 5.5 Automação 5: CONCLUSÃO DO PLANO
**Tipo:** Manual ou Entity  
**Acionador:** Atendente marca tarefa como concluída  
**Função:** `finalizarPlanoRetencao`

```javascript
// Quando TarefaInteligente tipo 'retencao' é concluída:
//   - Atualiza PlanoRetencao.resultado_final
//   - Calcula novo score do cliente
//   - Registra na histórico
//   - Se cliente recuperado: envia alert positivo ao gestor
```

---

## 6. FLUXO TEMPORAL DE AUTOMAÇÕES

```
T+0: Gestor cria PlanoRetencao
     ↓
     → Cria TarefaInteligente
     → Dispara Automação 1: Notifica atendente
     → Gestor vê confirmação: "Plano criado ✅"

T+12h: Automação 2 roda
     ↓
     → Se sem tentativa: Envia reminder ao atendente
     → Se com tentativa: Atualiza status

T+24h (prazo original): Automação 3 roda
     ↓
     → Se não alcançado: Marca como 'em_falha'
     → Escala para gestor: "Plano de João venceu sem sucesso"
     → Sugere: Aumentar prazo, mudar estratégia, escalar

T+quando atendente agir: Automação 4 roda
     ↓
     → Registra tentativa
     → Atualiza score cliente em tempo real
     → Se cliente retomou contato: Automação 5 dispara

T+X (quando concluído): Automação 5 finaliza
     ↓
     → "Cliente Empresa ABC foi recuperado! ✅"
     → Remover de lista de risco
     → Reconhecer atendente
```

---

## 7. INTEGRAÇÃO COM DASHBOARD

### 7.1 Novo Widget: Status de Planos de Retenção
**Local:** Dashboard → Abas → Nova aba "Retenção" OU card em "Empresa"

```
┌────────────────────────────────────────┐
│ 📊 Planos de Retenção (Últimos 30 dias)│
├────────────────────────────────────────┤
│ ✅ Recuperados:      8                 │
│ 🔄 Em andamento:    12                 │
│ ⏰ Vencidos:         3                 │
│ ❌ Perdidos:         2                 │
└────────────────────────────────────────┘
```

### 7.2 Filtro na Tabela GestaoComercial
Adicionar filtro: "Mostrar apenas com Plano Ativo"  
Mostrar status do plano ao lado do cliente

---

## 8. MODELOS DE TAREFAS PRÉ-DEFINIDAS

**Criar componente:** `components/gestao-comercial/TemplatesRetencao.json`

```json
{
  "templates": [
    {
      "estrategia": "ligacao",
      "descricao": "Ligação de recuperação de relacionamento",
      "observacao_padrao": "Entrar em contato, entender motivo da inatividade, oferecer suporte adicional",
      "prazo_sugerido": "24h"
    },
    {
      "estrategia": "oferta_especial",
      "descricao": "Oferta customizada para reativar",
      "observacao_padrao": "Oferecer desconto, bônus ou novo serviço conforme perfil do cliente",
      "prazo_sugerido": "48h"
    },
    {
      "estrategia": "analise_customizada",
      "descricao": "Análise de problemas específicos",
      "observacao_padrao": "Fazer análise gratuita do que cliente precisa, demonstrar ROI",
      "prazo_sugerido": "7d"
    }
  ]
}
```

---

## 9. ANÁLISE DE ENCAIXE NA ARQUITETURA

### 9.1 Onde Encaixa?

```
NEXUS360 ARCHITECTURE
├── Dashboard (visão executiva) ✅ EXISTE
│   └── GestaoComercial (nova) ← AQUI
│       └── PlanoRetencao (nova) ← NOVO MÓDULO
│
├── Comunicacao (atendimento) ✅ EXISTE
│   └── Tarefas aparecem aqui para atendente
│
├── TarefaInteligente (pendências) ✅ EXISTE
│   └── Tarefas de retenção aparecem aqui
│
└── Automações (backend) ✅ EXISTE
    └── 5 automações novas para retenção
```

### 9.2 Dependências

| Componente | Dependência | Status |
|---|---|---|
| ModalPlanoRetencao | GestaoComercial | Será criado |
| PlanoRetencao (entidade) | Base44 DB | Será criado |
| 5 Automações | Functions + Cron | Será criado |
| TarefaInteligente (modificado) | Existente | Apenas adicionar campos |
| Dashboard (widget novo) | Existente | Será adicionado |

---

## 10. MATRIZ DE IMPLEMENTAÇÃO

### Fase 1: CORE (2-3 dias)
- ✅ Criar entidade PlanoRetencao
- ✅ Criar ModalPlanoRetencao
- ✅ Integrar botão em GestaoComercial
- ✅ Criar automação 1 (notificação)

### Fase 2: AUTOMAÇÕES (2-3 dias)
- ✅ Automações 2, 3, 4, 5
- ✅ Testes de fluxo temporal
- ✅ Alerts no Dashboard

### Fase 3: POLISH (1-2 dias)
- ✅ Templates pré-definidos
- ✅ Widget de status
- ✅ Relatórios de retenção
- ✅ Treinamento

---

## 11. IMPACTO ESPERADO

### Métrica: Taxa de Retenção por Ação
```
Sem Plano:     15% de recuperação (sem ação)
Com Plano:     45-60% de recuperação (com ação direcionada)

Tempo para Agir:
Sem Plano:     7-14 dias (descobrem churn depois)
Com Plano:     24h (ação imediata)

ROI Estimado:
- 10 clientes em risco
- 45% taxa sucesso = 4-5 recuperados
- Valor médio cliente: R$ 5.000/mês
- Impacto: R$ 20-25K/mês em receita retida
```

---

## 12. RISCOS E MITIGAÇÃO

| Risco | Probabilidade | Impacto | Mitigação |
|---|---|---|---|
| Atendente esquece de executar tarefa | Alta | Alto | Check-in 12h + Escalação 24h |
| Score de risco muda enquanto plano ativo | Média | Médio | Recalcular ao registrar tentativa |
| Gestor cria múltiplos planos mesmo cliente | Média | Baixo | Validar: "Já existe plano ativo para este cliente?" |
| Automação falha e cliente não é notificado | Baixa | Alto | Retry + Alert para gestor |

---

## 13. TIMELINE DE APROVAÇÃO

**1. Aprovação desta análise** ✅  
**2. Criação de PlanoRetencao + Modal** (2 dias)  
**3. Testes unitários + E2E** (1 dia)  
**4. Deploy Fase 1 em produção** (teste com 10 clientes)  
**5. Feedback + Ajustes** (3-5 dias)  
**6. Automações full** (Fase 2)  
**7. Go-live completo**

---

## 14. CONCLUSÃO

**Este módulo fecha um loop crítico:**

- **ANTES:** Gestor vê cliente em risco → sem ação → cliente sai
- **DEPOIS:** Gestor vê cliente → cria plano → atendente age → resultado rastreado

**Impacto na retenção: +30-40% de clientes salvos**

---

## APROVAÇÃO

**Status:** 🔴 **AGUARDANDO APROVAÇÃO**

**Componentes a Criar:**
- [ ] PlanoRetencao (entidade)
- [ ] ModalPlanoRetencao (componente)
- [ ] Modificar TarefaInteligente (campos novos)
- [ ] 5 Funções de automação
- [ ] Integração em GestaoComercial
- [ ] Widget no Dashboard

**Responsáveis:**
- Aprovação Funcional: _____
- Aprovação Técnica: _____
- Aprovação Gestão: _____