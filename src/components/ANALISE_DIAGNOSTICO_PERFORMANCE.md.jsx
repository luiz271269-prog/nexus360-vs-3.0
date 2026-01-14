# 🔬 ANÁLISE COMPLETA: Sistema de Diagnóstico - Performance e Centralização

**Data:** 14 de Janeiro de 2026  
**Objetivo:** Analisar estado atual do diagnóstico e propor melhorias de performance  
**Status:** PLANEJAMENTO - Aguardando aprovação

---

## 📊 ESTADO ATUAL: COMO ESTÁ FUNCIONANDO

### 1. COMPONENTES DE DIAGNÓSTICO EXISTENTES

| Componente | Localização | Quando É Chamado | Performance | Problema |
|------------|------------|------------------|-------------|----------|
| **DiagnosticoBuscaGlobal** | `components/comunicacao/DiagnosticoBuscaGlobal.jsx` | Sob demanda (click) ✅ | ✅ OK | Estava renderizado automaticamente antes |
| **DiagnosticoVisibilidadeRealtime** | `components/comunicacao/DiagnosticoVisibilidadeRealtime.jsx` | A cada nova mensagem 🔴 | 🔴 PESADO | Renderiza automaticamente |
| **BotaoDiagnosticoFlutuante** | `components/comunicacao/BotaoDiagnosticoFlutuante.jsx` | Sempre (se admin + thread ativa) ⚠️ | ⚠️ OK mas visível demais | Renderizado dentro de ChatWindow |
| **DiagnosticoThreadsInvisiveis** | Aba "Diagnóstico" | Manual ✅ | ✅ OK | Separado em aba |
| **DiagnosticoComparativoThreads** | Aba "Diagnóstico" | Manual ✅ | ✅ OK | Separado em aba |
| **DiagnosticoCirurgicoEmbed** | Aba "Diagnóstico Cirúrgico" | Manual ✅ | ✅ OK | Separado em aba |
| **LogsFiltragemViewer** | Aba "Diagnóstico" | Manual ✅ | ✅ OK | Separado em aba |

### 2. LOCALIZAÇÃO NO CÓDIGO

#### A. `BotaoDiagnosticoFlutuante.jsx` (Atual)
```javascript
// Linha 11-13: Visibilidade
if (usuario?.role !== 'admin' || !threadAtiva) {
  return null;
}

// Linha 16-24: Botão flutuante (bottom-right)
<Button onClick={() => setShowDiagnostico(!showDiagnostico)}
  className="bg-red-500 ... w-14 h-14 ...">
  <Bug className="w-7 h-7" />
</Button>

// Linha 34-61: Abas com DiagnosticoVisibilidadeRealtime e DiagnosticoBuscaGlobal
<Tabs>
  <TabsContent value="visibilidade">
    <DiagnosticoVisibilidadeRealtime ... />
  </TabsContent>
  <TabsContent value="busca">
    <DiagnosticoBuscaGlobal ... />
  </TabsContent>
</Tabs>
```

**Onde é renderizado:**
- ❌ NÃO encontrado em `ChatWindow.jsx` (linhas lidas não mostram)
- ⚠️ Precisa verificar onde está sendo renderizado atualmente

#### B. `DiagnosticoVisibilidadeRealtime.jsx` (Atual)
```javascript
// Linha 25-39: useEffect que atualiza a cada nova mensagem
useEffect(() => {
  if (ultimaMensagemRecebida) {
    const novo = { ... };
    setHistorico(prev => [novo, ...prev].slice(0, 5)); // 🔴 ATUALIZA ESTADO
  }
}, [ultimaMensagemRecebida, threadId]); // 🔴 TRIGGER: Nova mensagem

// Linha 45-161: Renderização sempre ativa (não lazy)
<Card className="fixed bottom-4 right-4"> // 🔴 SEMPRE RENDERIZADO
```

**Problema de Performance:**
- ✅ **Já está sob demanda** (dentro de `BotaoDiagnosticoFlutuante`)
- ⚠️ Mas o `useEffect` roda a cada nova mensagem mesmo se painel fechado
- ⚠️ Renderização fixa na tela (position: fixed) pode conflitar

#### C. Onde está sendo chamado

**`pages/Comunicacao.jsx`:**
- ❌ NÃO encontrei `<BotaoDiagnosticoFlutuante />` renderizado
- ✅ Diagnósticos manuais estão nas abas "Diagnóstico" e "Diagnóstico Cirúrgico"

**Conclusão:**
- `BotaoDiagnosticoFlutuante` foi criado mas **NÃO está sendo renderizado**
- Precisa ser adicionado em `ChatWindow.jsx` ou `Comunicacao.jsx`

---

## 🎯 PROBLEMAS IDENTIFICADOS

### PROBLEMA 1: Diagnóstico não está visível
**Status:** `BotaoDiagnosticoFlutuante` existe mas não é renderizado em lugar nenhum

**Evidência:**
- Arquivo existe: ✅
- Importado em `Comunicacao.jsx`: ❌ NÃO
- Renderizado: ❌ NÃO

### PROBLEMA 2: Performance do DiagnosticoVisibilidadeRealtime
**Status:** Mesmo dentro do botão sob demanda, `useEffect` roda a cada nova mensagem

**Evidência:**
```javascript
// DiagnosticoVisibilidadeRealtime.jsx linha 25
useEffect(() => {
  if (ultimaMensagemRecebida) {
    setHistorico(...); // 🔴 ATUALIZA ESTADO (causa re-render)
  }
}, [ultimaMensagemRecebida]); // 🔴 Roda toda vez que chega mensagem
```

**Impacto:**
- Se painel está fechado (`showDiagnostico === false`), o `useEffect` ainda roda
- Causa re-renders desnecessários do componente pai

### PROBLEMA 3: Localização não ideal
**Status:** Renderizado em posição fixa (conflita com outros elementos)

**Evidência:**
- `bottom-4 right-4` pode sobrepor outros botões
- Não está integrado ao header da conversa

---

## ✅ SOLUÇÃO PROPOSTA (Nexus360 + Performance)

### MUDANÇA 1: Mover para Header da Conversa (Não Flutuante)

**Onde:** Adicionar ícone `Bug` no **header do ChatWindow** ao lado dos botões "Transferir", "Marcar como Lida", "Detalhes"

**Vantagens:**
- ✅ Integração visual melhor (junto com ações de conversa)
- ✅ Não sobrepõe outros elementos
- ✅ Mais claro para o admin que é diagnóstico **desta conversa**

**Localização no código:**
- `components/comunicacao/ChatWindow.jsx` - Linha ~700-800 (header da conversa)

### MUDANÇA 2: Lazy Loading + Suspense para Diagnósticos

**Problema:** Componentes de diagnóstico carregam mesmo se não usados

**Solução:**
```javascript
// Usar lazy loading
const DiagnosticoBuscaGlobal = React.lazy(() => import('./DiagnosticoBuscaGlobal'));
const DiagnosticoVisibilidadeRealtime = React.lazy(() => import('./DiagnosticoVisibilidadeRealtime'));

// Renderizar apenas quando modal está aberto
{showDiagnostico && (
  <Suspense fallback={<div>Carregando...</div>}>
    <DiagnosticoBuscaGlobal ... />
  </Suspense>
)}
```

### MUDANÇA 3: Desabilitar useEffect quando painel fechado

**Onde:** `DiagnosticoVisibilidadeRealtime.jsx`

**Mudança:**
```javascript
// ANTES (linha 25):
useEffect(() => {
  if (ultimaMensagemRecebida) {
    setHistorico(...);
  }
}, [ultimaMensagemRecebida]);

// DEPOIS:
useEffect(() => {
  // ✅ SÓ roda se painel está aberto
  if (ultimaMensagemRecebida && showDiagnostico) {
    setHistorico(...);
  }
}, [ultimaMensagemRecebida, showDiagnostico]);
```

**Problema:** `showDiagnostico` não é prop do componente atual

**Solução:** Passar `isOpen` como prop do pai

### MUDANÇA 4: Consolidar em Modal Único (Não Popup Flutuante)

**Onde:** Criar `components/comunicacao/ModalDiagnosticoAdmin.jsx`

**Estrutura:**
```javascript
<Dialog open={showDiagnostico} onOpenChange={setShowDiagnostico}>
  <DialogContent className="max-w-3xl max-h-[80vh]">
    <DialogHeader>
      <DialogTitle>🔬 Diagnóstico Avançado - {contatoNome}</DialogTitle>
    </DialogHeader>
    
    <Tabs defaultValue="visibilidade">
      <TabsList>
        <TabsTrigger value="visibilidade">Visibilidade Realtime</TabsTrigger>
        <TabsTrigger value="busca">Busca Global</TabsTrigger>
        <TabsTrigger value="reorganizar">Reorganizar Contato</TabsTrigger>
      </TabsList>
      
      <TabsContent value="visibilidade">
        <DiagnosticoVisibilidadeRealtime ... isOpen={showDiagnostico} />
      </TabsContent>
      
      <TabsContent value="busca">
        <DiagnosticoBuscaGlobal ... />
      </TabsContent>
      
      <TabsContent value="reorganizar">
        <BotaoReorganizarContato contactId={...} />
      </TabsContent>
    </Tabs>
  </DialogContent>
</Dialog>
```

**Vantagens:**
- ✅ Modal centralizado (não sobrepõe nada)
- ✅ Mais espaço para diagnósticos
- ✅ Aba dedicada para "Reorganizar Contato"

---

## 🏗️ PLANO DE IMPLEMENTAÇÃO (5 Etapas)

### ETAPA 1: Criar Modal Unificado (NOVO)

**Arquivos a criar:**
```
components/comunicacao/ModalDiagnosticoAdmin.jsx
  ├── Importa DiagnosticoBuscaGlobal
  ├── Importa DiagnosticoVisibilidadeRealtime
  ├── Nova aba: "Reorganizar Contato"
  └── Renderiza como Dialog (shadcn/ui)
```

**Props necessárias:**
```javascript
{
  isOpen: boolean,
  onClose: () => void,
  contactId: string,
  threadId: string,
  contatoNome: string,
  mensagens: Message[],
  filterScope: string,
  selectedIntegrationId: string,
  selectedAttendantId: string,
  onReorganizarContato: (contactId) => void
}
```

### ETAPA 2: Adicionar Botão no Header do ChatWindow

**Arquivo:** `components/comunicacao/ChatWindow.jsx`

**Onde adicionar:** Linha ~700-800 (seção de botões do header)

**Mudança:**
```javascript
// Após os botões "Transferir", "Marcar como Lida"
{usuario?.role === 'admin' && (
  <button
    onClick={() => setShowDiagnostico(true)}
    className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg px-3 py-2 shadow-md flex items-center gap-2 hover:shadow-lg transition-all text-xs font-medium"
    title="Diagnósticos Avançados (Admin)"
  >
    <Bug className="w-4 h-4" />
    Diagnóstico
  </button>
)}
```

**Estado necessário:**
```javascript
const [showDiagnostico, setShowDiagnostico] = useState(false);
```

### ETAPA 3: Renderizar Modal no Final do ChatWindow

**Arquivo:** `components/comunicacao/ChatWindow.jsx`

**Onde adicionar:** Linha ~final do return, antes do `</div>` final

**Mudança:**
```javascript
{/* Modal de Diagnóstico Admin */}
{usuario?.role === 'admin' && (
  <ModalDiagnosticoAdmin
    isOpen={showDiagnostico}
    onClose={() => setShowDiagnostico(false)}
    contactId={thread?.contact_id}
    threadId={thread?.id}
    contatoNome={nomeContato}
    mensagens={mensagens}
    filterScope={filterScope}
    selectedIntegrationId={selectedIntegrationId}
    selectedAttendantId={selectedAttendantId}
    onReorganizarContato={async (contactId) => {
      // Lógica de reorganização aqui
      await base44.functions.invoke('reorganizarContato', { contactId });
      queryClient.invalidateQueries({ queryKey: ['contacts'] });
      queryClient.invalidateQueries({ queryKey: ['threads'] });
      toast.success('✅ Contato reorganizado!');
    }}
  />
)}
```

### ETAPA 4: Otimizar DiagnosticoVisibilidadeRealtime

**Arquivo:** `components/comunicacao/DiagnosticoVisibilidadeRealtime.jsx`

**Mudanças:**

1. **Adicionar prop `isOpen`:**
```javascript
// Linha 16
export default function DiagnosticoVisibilidadeRealtime({
  threadId,
  ultimaMensagemRecebida,
  filtros = {},
  realTimeActive = false,
  isOpen = true // ✅ NOVA PROP
}) {
```

2. **Condicionar useEffect:**
```javascript
// Linha 25
useEffect(() => {
  // ✅ SÓ atualiza histórico se modal está aberto
  if (ultimaMensagemRecebida && isOpen) {
    const novo = { ... };
    setHistorico(prev => [novo, ...prev].slice(0, 5));
  }
}, [ultimaMensagemRecebida, threadId, isOpen]); // ✅ Adicionar isOpen
```

3. **Renderização condicional:**
```javascript
// Linha 44: Remover position: fixed (será renderizado dentro de modal)
// ANTES:
<div className="fixed bottom-4 right-4 z-40">

// DEPOIS:
<div className="w-full"> // ✅ Renderiza dentro do espaço do modal
```

### ETAPA 5: Remover BotaoDiagnosticoFlutuante.jsx (Obsoleto)

**Após migração completa:**
- ✅ Deletar `components/comunicacao/BotaoDiagnosticoFlutuante.jsx`
- ✅ Remover importações em `pages/Comunicacao.jsx` (se houver)

---

## 📐 NOVA ARQUITETURA PROPOSTA

```
┌─────────────────────────────────────────────────────────────────┐
│                    CHAT WINDOW (Header)                         │
│  [...Botões existentes]  [🔴 Diagnóstico] ← NOVO BOTÃO         │
└─────────────────────────────────────────────────────────────────┘
                              ↓ (onClick)
┌─────────────────────────────────────────────────────────────────┐
│              MODAL DIAGNÓSTICO ADMIN (Centralizado)             │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Aba 1: Visibilidade Realtime                             │  │
│  │   - useEffect SÓ roda se modal aberto (isOpen)           │  │
│  │   - Histórico de mensagens                               │  │
│  │   - Match thread aberta vs thread da mensagem            │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Aba 2: Busca Global                                      │  │
│  │   - Busca mensagens em TODAS as threads                  │  │
│  │   - Detecta duplicatas                                   │  │
│  │   - Exporta JSON                                         │  │
│  └───────────────────────────────────────────────────────────┘  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ Aba 3: Reorganizar Contato (NOVA)                        │  │
│  │   - Botão para reorganizar threads duplicadas            │  │
│  │   - Preview das mudanças                                 │  │
│  │   - Confirmação antes de executar                        │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔧 MUDANÇAS DETALHADAS (Arquivo por Arquivo)

### ARQUIVO 1: `components/comunicacao/ModalDiagnosticoAdmin.jsx` (CRIAR)

```javascript
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Bug, Search, Shuffle } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

// ✅ LAZY LOADING: Só carrega quando modal abre
const DiagnosticoBuscaGlobal = React.lazy(() => import('./DiagnosticoBuscaGlobal'));
const DiagnosticoVisibilidadeRealtime = React.lazy(() => import('./DiagnosticoVisibilidadeRealtime'));

export default function ModalDiagnosticoAdmin({
  isOpen,
  onClose,
  contactId,
  threadId,
  contatoNome,
  mensagens = [],
  filterScope,
  selectedIntegrationId,
  selectedAttendantId,
  onReorganizarContato
}) {
  const [reorganizando, setReorganizando] = useState(false);
  const [activeTab, setActiveTab] = useState('visibilidade');

  const handleReorganizar = async () => {
    if (!contactId) {
      toast.error('Contato não identificado');
      return;
    }

    setReorganizando(true);
    try {
      await onReorganizarContato(contactId);
      toast.success('✅ Reorganização concluída!');
    } catch (error) {
      toast.error(`Erro: ${error.message}`);
    } finally {
      setReorganizando(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bug className="w-5 h-5 text-red-500" />
            Diagnóstico Avançado - {contatoNome || 'Conversa'}
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="w-full grid grid-cols-3">
            <TabsTrigger value="visibilidade" className="flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Visibilidade
            </TabsTrigger>
            <TabsTrigger value="busca" className="flex items-center gap-2">
              <Search className="w-4 h-4" />
              Busca Global
            </TabsTrigger>
            <TabsTrigger value="reorganizar" className="flex items-center gap-2">
              <Shuffle className="w-4 h-4" />
              Reorganizar
            </TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-y-auto mt-4">
            <React.Suspense fallback={<div className="p-4 text-center text-slate-500">Carregando diagnóstico...</div>}>
              <TabsContent value="visibilidade" className="m-0">
                <DiagnosticoVisibilidadeRealtime
                  threadId={threadId}
                  ultimaMensagemRecebida={mensagens[mensagens.length - 1]}
                  filtros={{
                    scope: filterScope,
                    integracaoId: selectedIntegrationId,
                    atendente: selectedAttendantId
                  }}
                  realTimeActive={true}
                  isOpen={isOpen && activeTab === 'visibilidade'} // ✅ SÓ ativa se aba visível
                />
              </TabsContent>

              <TabsContent value="busca" className="m-0">
                <DiagnosticoBuscaGlobal
                  contactId={contactId}
                  threadId={threadId}
                />
              </TabsContent>

              <TabsContent value="reorganizar" className="m-0 p-4">
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                    <h4 className="font-semibold text-amber-900 mb-2">⚙️ Reorganizar Threads Duplicadas</h4>
                    <p className="text-sm text-amber-800">
                      Esta ação irá consolidar todas as threads deste contato em uma única thread canônica,
                      mesclando mensagens e atualizando referências.
                    </p>
                  </div>

                  <Button
                    onClick={handleReorganizar}
                    disabled={reorganizando}
                    className="w-full bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700"
                  >
                    {reorganizando ? 'Reorganizando...' : '🔄 Executar Reorganização'}
                  </Button>
                </div>
              </TabsContent>
            </React.Suspense>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

### ARQUIVO 2: `components/comunicacao/ChatWindow.jsx` (MODIFICAR)

**Mudanças:**

1. **Adicionar imports:**
```javascript
import ModalDiagnosticoAdmin from './ModalDiagnosticoAdmin';
```

2. **Adicionar estado:**
```javascript
const [showDiagnostico, setShowDiagnostico] = useState(false);
```

3. **Adicionar botão no header (após botão "Detalhes"):**
```javascript
{/* Botão Diagnóstico (ADMIN ONLY) */}
{usuario?.role === 'admin' && (
  <button
    onClick={() => setShowDiagnostico(true)}
    className="bg-gradient-to-br from-red-500 to-red-600 text-white rounded-lg px-3 py-2 shadow-md flex items-center gap-2 hover:shadow-lg transition-all text-xs font-medium hover:from-red-600 hover:to-red-700"
    title="Diagnósticos Avançados"
  >
    <Bug className="w-4 h-4" />
    Diagnóstico
  </button>
)}
```

4. **Renderizar modal no final:**
```javascript
{/* Modal Diagnóstico Admin */}
<ModalDiagnosticoAdmin
  isOpen={showDiagnostico}
  onClose={() => setShowDiagnostico(false)}
  contactId={thread?.contact_id}
  threadId={thread?.id}
  contatoNome={nomeContato}
  mensagens={mensagens}
  filterScope={filterScope}
  selectedIntegrationId={selectedIntegrationId}
  selectedAttendantId={selectedAttendantId}
  onReorganizarContato={async (contactId) => {
    try {
      await base44.functions.invoke('reorganizarContato', { contactId });
      await queryClient.invalidateQueries({ queryKey: ['contacts'] });
      await queryClient.invalidateQueries({ queryKey: ['threads'] });
      if (onAtualizarMensagens) onAtualizarMensagens();
    } catch (error) {
      throw error;
    }
  }}
/>
```

### ARQUIVO 3: `components/comunicacao/DiagnosticoVisibilidadeRealtime.jsx` (MODIFICAR)

**Mudanças:**

1. **Adicionar prop `isOpen`:**
```javascript
// Linha 16
export default function DiagnosticoVisibilidadeRealtime({
  threadId,
  ultimaMensagemRecebida,
  filtros = {},
  realTimeActive = false,
  isOpen = true // ✅ NOVA PROP
}) {
```

2. **Condicionar useEffect:**
```javascript
// Linha 25
useEffect(() => {
  // ✅ SÓ atualiza se modal está aberto E aba visível
  if (ultimaMensagemRecebida && isOpen) {
    const novo = { ... };
    setHistorico(prev => [novo, ...prev].slice(0, 5));
  }
}, [ultimaMensagemRecebida, threadId, isOpen]); // ✅ Adicionar dependência
```

3. **Remover position: fixed:**
```javascript
// Linha 45: Renderiza dentro do modal (não flutuante)
// ANTES:
<div className="fixed bottom-4 right-4 z-40 max-w-md">

// DEPOIS:
<div className="w-full">
```

4. **Remover Card (renderizar conteúdo direto):**
```javascript
// ANTES:
<Card className="bg-slate-900 ...">
  <CardHeader onClick={() => setExpandido(!expandido)}>
    ...
  </CardHeader>
  {expandido && <CardContent>...</CardContent>}
</Card>

// DEPOIS (sempre expandido, sem card wrapper):
<div className="space-y-3">
  {/* Conteúdo direto */}
  <div className="space-y-2 border border-slate-200 rounded-lg p-3">
    ...
  </div>
</div>
```

### ARQUIVO 4: `components/comunicacao/BotaoDiagnosticoFlutuante.jsx` (DELETAR)

**Ação:** Marcar para exclusão após migração completa

**Motivo:** Substituído por `ModalDiagnosticoAdmin.jsx`

---

## 🎯 QUANDO E COMO OS DIAGNÓSTICOS SERÃO CHAMADOS (Nova Lógica)

| Diagnóstico | Quando É Executado | Performance | Trigger |
|-------------|-------------------|-------------|---------|
| **Visibilidade Realtime** | Somente quando modal aberto E aba ativa | ✅ Otimizado | `isOpen && activeTab === 'visibilidade'` |
| **Busca Global** | Somente quando usuário clica "Executar Busca" | ✅ Sob demanda | Click no botão |
| **Reorganizar Contato** | Somente quando usuário clica "Executar Reorganização" | ✅ Sob demanda | Click no botão |

**Benefícios:**
- ✅ Zero impacto em performance quando modal fechado
- ✅ Lazy loading dos componentes de diagnóstico
- ✅ Execução sob demanda (não automática)
- ✅ Melhor UX (modal centralizado, não sobrepõe)

---

## 📋 CHECKLIST DE APROVAÇÃO

### Arquitetura
- [ ] Aprovada a criação de `ModalDiagnosticoAdmin.jsx`
- [ ] Aprovada a modificação de `ChatWindow.jsx` (adicionar botão + modal)
- [ ] Aprovada a modificação de `DiagnosticoVisibilidadeRealtime.jsx` (prop `isOpen`)
- [ ] Aprovada a exclusão de `BotaoDiagnosticoFlutuante.jsx`

### Performance
- [ ] Confirmado: useEffect só roda quando modal aberto
- [ ] Confirmado: Lazy loading dos componentes de diagnóstico
- [ ] Confirmado: Reorganização sob demanda (não automática)

### UX
- [ ] Confirmado: Botão integrado ao header da conversa (não flutuante)
- [ ] Confirmado: Modal centralizado (não sobrepõe elementos)
- [ ] Confirmado: 3 abas no modal (Visibilidade, Busca, Reorganizar)

### Escopo Admin
- [ ] Confirmado: Botão visível APENAS para `usuario.role === 'admin'`
- [ ] Confirmado: Modal só abre se há thread ativa

---

## 🚨 RISCOS E MITIGAÇÕES

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|---------|-----------|
| Modal não abre | Baixa | 🟡 Médio | Testar em dev antes de deploy |
| useEffect continua rodando | Baixa | 🟡 Médio | Validar prop `isOpen` chegando corretamente |
| Lazy loading quebra | Baixa | 🟢 Baixo | Suspense com fallback |
| Perda de funcionalidade | Média | 🔴 Alto | Manter `BotaoDiagnosticoFlutuante` até confirmar que modal funciona |

---

## 📝 RESUMO EXECUTIVO

**SITUAÇÃO ATUAL:**
- ❌ `BotaoDiagnosticoFlutuante.jsx` existe mas NÃO está renderizado
- ⚠️ `DiagnosticoVisibilidadeRealtime` atualiza a cada mensagem (mesmo se fechado)
- ⚠️ Diagnósticos espalhados em várias abas (não centralizado)

**SOLUÇÃO PROPOSTA:**
1. ✅ Criar `ModalDiagnosticoAdmin.jsx` centralizado com 3 abas
2. ✅ Adicionar botão no header do `ChatWindow` (junto com ações da conversa)
3. ✅ Otimizar `DiagnosticoVisibilidadeRealtime` para só rodar quando modal aberto
4. ✅ Lazy loading dos componentes pesados
5. ✅ Nova aba "Reorganizar Contato" com ação sob demanda

**BENEFÍCIOS:**
- 🚀 Performance: Zero overhead quando modal fechado
- 🎨 UX: Botão integrado, não sobrepõe elementos
- 🔧 Manutenção: Diagnósticos centralizados em 1 lugar
- 🔐 Segurança: Apenas admin vê e usa

**PRÓXIMOS PASSOS:**
1. Aguardar aprovação deste planejamento
2. Criar `ModalDiagnosticoAdmin.jsx`
3. Modificar `ChatWindow.jsx`
4. Modificar `DiagnosticoVisibilidadeRealtime.jsx`
5. Testar performance
6. Deletar `BotaoDiagnosticoFlutuante.jsx`

---

**Data:** 14/01/2026  
**Status:** ⏸️ Aguardando Aprovação  
**Prioridade:** 🔴 Alta (Impacta performance do sistema de comunicação)