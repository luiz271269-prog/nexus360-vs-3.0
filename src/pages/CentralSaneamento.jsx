import React from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Wrench, Activity, History, Search, Zap, CheckCircle2, AlertTriangle, RefreshCw, Play, Eye, Users } from 'lucide-react';
import { toast } from 'sonner';
import { normalizarTelefone } from '@/components/lib/phoneUtils';

/**
 * 🎯 CENTRAL DE SANEAMENTO — Unifica TODAS as ferramentas de diagnóstico/correção.
 *
 * Substitui:
 *   - DiagnosticoSincronizacaoUnificado (aba contato)
 *   - CorrecaoCirurgicaVinculacao
 *   - SincronizadorMensagensOrfas
 *   - DiagnosticoUnificadoPanel
 *   - FerramentasMigracao (agora é Aba 2)
 *
 * 3 abas:
 *   1. Contato individual → skillSanitizacaoContato (7 fases)
 *   2. Sistema em lote   → diagnosticoSaudeThreads + migrarThreadsOrfas + autopermissoesUsuarios
 *   3. Auditoria         → últimas SkillExecution
 */
export default function CentralSaneamento() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
            <Wrench className="w-7 h-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Central de Saneamento</h1>
            <p className="text-sm text-slate-600">Diagnosticar e corrigir contatos, threads e mensagens — ferramenta única</p>
          </div>
        </div>

        <Tabs defaultValue="contato" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="contato"><Search className="w-4 h-4 mr-2" />Contato Individual</TabsTrigger>
            <TabsTrigger value="sistema"><Activity className="w-4 h-4 mr-2" />Sistema (Lote)</TabsTrigger>
            <TabsTrigger value="historico"><History className="w-4 h-4 mr-2" />Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="contato" className="mt-4">
            <AbaContatoIndividual />
          </TabsContent>

          <TabsContent value="sistema" className="mt-4">
            <AbaSistemaLote />
          </TabsContent>

          <TabsContent value="historico" className="mt-4">
            <AbaHistorico />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ABA 1 — Contato Individual (skillSanitizacaoContato)
// ════════════════════════════════════════════════════════════════════
function AbaContatoIndividual() {
  const [telefone, setTelefone] = React.useState('');
  const [buscando, setBuscando] = React.useState(false);
  const [contatoEncontrado, setContatoEncontrado] = React.useState(null);
  const [executando, setExecutando] = React.useState(null);
  const [resultado, setResultado] = React.useState(null);

  const buscarContato = async () => {
    if (!telefone.trim()) {
      toast.error('Informe um telefone');
      return;
    }
    setBuscando(true);
    setContatoEncontrado(null);
    setResultado(null);
    try {
      const normalizado = normalizarTelefone(telefone);
      const canonico = (normalizado || telefone).replace(/\D/g, '');

      const [porCanonico, porTelefone] = await Promise.all([
        base44.entities.Contact.filter({ telefone_canonico: canonico }),
        base44.entities.Contact.filter({ telefone: normalizado })
      ]);

      const todos = Array.from(new Map([...(porCanonico || []), ...(porTelefone || [])].map(c => [c.id, c])).values());

      if (todos.length === 0) {
        toast.warning('Nenhum contato encontrado');
        return;
      }

      // Escolher principal: mais antigo
      const principal = [...todos].sort((a, b) => new Date(a.created_date) - new Date(b.created_date))[0];
      setContatoEncontrado({ principal, total: todos.length, todos });
      toast.success(`${todos.length} contato(s) encontrado(s) — principal: ${principal.nome || principal.telefone}`);
    } catch (e) {
      toast.error('Erro ao buscar: ' + e.message);
    } finally {
      setBuscando(false);
    }
  };

  const executar = async (modo) => {
    if (!contatoEncontrado?.principal?.id) return;
    setExecutando(modo);
    setResultado(null);
    try {
      const res = await base44.functions.invoke('skillSanitizacaoContato', {
        contact_id: contatoEncontrado.principal.id,
        modo
      });
      const data = res?.data || res;
      if (!data?.success) throw new Error(data?.error || 'Falha');
      setResultado(data);

      const { resumo, fases } = data;
      if (modo === 'diagnostico') {
        const dups = fases?.fase1_diagnostico_inicial?.duplicatas_encontradas || 0;
        toast.info(dups > 0 ? `⚠️ ${dups} duplicata(s) encontrada(s)` : '✅ Saudável');
      } else {
        toast.success(`✅ ${resumo.duplicatas_removidas} merged · ${resumo.mensagens_revinculadas} msgs · ${resumo.threads_corrigidas} threads`, { duration: 6000 });
      }
    } catch (e) {
      toast.error('❌ ' + e.message);
    } finally {
      setExecutando(null);
    }
  };

  const fases = resultado?.fases;
  const resumo = resultado?.resumo;
  const saudavel = fases?.fase7_validacao_final?.saudavel;

  return (
    <Card className="border-indigo-200">
      <CardHeader>
        <CardTitle className="text-indigo-900">Sanear um contato específico</CardTitle>
        <CardDescription>Executa a skill <code className="bg-slate-100 px-1 rounded">skillSanitizacaoContato</code> (7 fases) no contato</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Input
            placeholder="Ex: +5548999322400"
            value={telefone}
            onChange={(e) => setTelefone(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && buscarContato()}
            className="flex-1"
          />
          <Button onClick={buscarContato} disabled={buscando} className="bg-indigo-600 hover:bg-indigo-700">
            {buscando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Search className="w-4 h-4 mr-2" />}
            Buscar
          </Button>
        </div>

        {contatoEncontrado && (
          <Alert className="bg-indigo-50 border-indigo-200">
            <AlertDescription>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-slate-900">{contatoEncontrado.principal.nome || 'Sem nome'}</p>
                  <p className="text-xs text-slate-600 font-mono">{contatoEncontrado.principal.telefone}</p>
                </div>
                <Badge className="bg-indigo-600">{contatoEncontrado.total} no banco</Badge>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {contatoEncontrado && (
          <div className="flex gap-2">
            <Button onClick={() => executar('diagnostico')} disabled={!!executando} variant="outline" className="flex-1 border-blue-300 text-blue-700">
              {executando === 'diagnostico' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Eye className="w-4 h-4 mr-2" />}
              Diagnosticar
            </Button>
            <Button
              onClick={() => {
                if (!confirm('⚠️ Executar saneamento completo? IRREVERSÍVEL.')) return;
                executar('correcao');
              }}
              disabled={!!executando}
              className="flex-1 bg-red-600 hover:bg-red-700"
            >
              {executando === 'correcao' ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
              Corrigir Tudo
            </Button>
          </div>
        )}

        {resultado && (
          <div className={`p-4 rounded border ${saudavel ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
            <div className="flex items-center gap-2 mb-3">
              {saudavel ? <CheckCircle2 className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-amber-600" />}
              <p className="font-semibold">{resultado.modo === 'diagnostico' ? 'Diagnóstico' : 'Correção'} concluído ({resultado.duracao_ms}ms)</p>
            </div>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <Metrica label="Duplicatas mescladas" valor={resumo?.duplicatas_removidas || 0} />
              <Metrica label="Msgs dedup" valor={resumo?.mensagens_dedup || 0} />
              <Metrica label="Msgs revinculadas" valor={resumo?.mensagens_revinculadas || 0} />
              <Metrica label="Threads corrigidas" valor={resumo?.threads_corrigidas || 0} />
              <Metrica label="Canonical" valor={resumo?.canonical_corrigido ? '✓' : '—'} />
              <Metrica label="Tags limpas" valor={resumo?.tags_limpas || 0} />
            </div>
            <details className="mt-3">
              <summary className="text-xs text-blue-700 cursor-pointer hover:underline">Ver todas as 7 fases</summary>
              <pre className="mt-2 text-[10px] bg-slate-900 text-slate-100 p-3 rounded max-h-64 overflow-auto">
                {JSON.stringify(fases, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Metrica({ label, valor }) {
  return (
    <div className="bg-white rounded px-2 py-1 flex items-center justify-between">
      <span className="text-slate-600">{label}</span>
      <Badge variant="outline">{valor}</Badge>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// ABA 2 — Sistema em lote (reutiliza funções existentes)
// ════════════════════════════════════════════════════════════════════
function AbaSistemaLote() {
  const [executando, setExecutando] = React.useState(null);
  const [resultados, setResultados] = React.useState({});

  const executar = async (chave, funcao, payload = {}) => {
    setExecutando(chave);
    try {
      const res = await base44.functions.invoke(funcao, payload);
      const data = res?.data || res;
      setResultados(prev => ({ ...prev, [chave]: data }));
      if (data?.success !== false) toast.success(`✅ ${data?.mensagem || 'Concluído'}`);
      else toast.error('❌ ' + (data?.error || 'Falha'));
    } catch (e) {
      toast.error('❌ ' + e.message);
    } finally {
      setExecutando(null);
    }
  };

  return (
    <div className="space-y-4">
      <Alert className="border-orange-200 bg-orange-50">
        <AlertTriangle className="h-4 w-4 text-orange-600" />
        <AlertDescription className="text-orange-800 text-xs">
          Sempre execute <strong>DRY-RUN</strong> antes de aplicar correções reais. Apenas administradores podem executar.
        </AlertDescription>
      </Alert>

      <CardLote
        titulo="1. Diagnóstico de Saúde do Sistema"
        descricao="Verifica threads órfãs, integrações desconectadas, usuários sem permissões"
        cor="blue"
        botoes={[
          { label: 'Executar Diagnóstico', icon: Eye, action: () => executar('diag', 'diagnosticoSaudeThreads'), variant: 'primary' }
        ]}
        executando={executando === 'diag'}
        resultado={resultados.diag}
      />

      <CardLote
        titulo="2. Migração de Threads Órfãs"
        descricao="Corrige whatsapp_integration_id usando última mensagem como fonte"
        cor="indigo"
        botoes={[
          { label: 'DRY-RUN', icon: Eye, action: () => executar('mig', 'migrarThreadsOrfas', { dryRun: true, limit: 500 }), variant: 'outline' },
          { label: 'Executar Migração', icon: Play, action: () => {
            if (!confirm('⚠️ Executar migração REAL no banco?')) return;
            executar('mig', 'migrarThreadsOrfas', { dryRun: false, limit: 500 });
          }, variant: 'primary' }
        ]}
        executando={executando === 'mig'}
        resultado={resultados.mig}
      />

      <CardLote
        titulo="3. Auto-Configuração de Permissões"
        descricao="Adiciona whatsapp_permissions[] para usuários sem configuração"
        cor="purple"
        botoes={[
          { label: 'DRY-RUN', icon: Eye, action: () => executar('perm', 'autopermissoesUsuarios', { dryRun: true, incluirAdmins: false }), variant: 'outline' },
          { label: 'Configurar', icon: Zap, action: () => {
            if (!confirm('⚠️ Configurar permissões para todos usuários sem config?')) return;
            executar('perm', 'autopermissoesUsuarios', { dryRun: false, incluirAdmins: false });
          }, variant: 'primary' }
        ]}
        executando={executando === 'perm'}
        resultado={resultados.perm}
      />

      <CardLote
        titulo="4. Sincronização CRM (Vendedores)"
        descricao="Corrige vínculo orçamento → User do vendedor"
        cor="green"
        botoes={[
          { label: 'DRY-RUN', icon: Eye, action: () => executar('crm', 'sincronizarCRMVendedores', { dryRun: true }), variant: 'outline' },
          { label: 'Corrigir Vínculos', icon: Play, action: () => {
            if (!confirm('⚠️ Aplicar correção de vínculos CRM?')) return;
            executar('crm', 'sincronizarCRMVendedores', { dryRun: false });
          }, variant: 'primary' }
        ]}
        executando={executando === 'crm'}
        resultado={resultados.crm}
      />
    </div>
  );
}

function CardLote({ titulo, descricao, cor, botoes, executando, resultado }) {
  const coresMap = {
    blue: { border: 'border-blue-200', text: 'text-blue-900', primary: 'bg-blue-600 hover:bg-blue-700', outline: 'border-blue-300' },
    indigo: { border: 'border-indigo-200', text: 'text-indigo-900', primary: 'bg-indigo-600 hover:bg-indigo-700', outline: 'border-indigo-300' },
    purple: { border: 'border-purple-200', text: 'text-purple-900', primary: 'bg-purple-600 hover:bg-purple-700', outline: 'border-purple-300' },
    green: { border: 'border-green-200', text: 'text-green-900', primary: 'bg-green-600 hover:bg-green-700', outline: 'border-green-300' }
  };
  const cores = coresMap[cor] || coresMap.blue;

  return (
    <Card className={cores.border}>
      <CardHeader>
        <CardTitle className={cores.text}>{titulo}</CardTitle>
        <CardDescription>{descricao}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          {botoes.map((b, i) => {
            const Icon = b.icon;
            return (
              <Button
                key={i}
                onClick={b.action}
                disabled={executando}
                variant={b.variant === 'outline' ? 'outline' : 'default'}
                className={b.variant === 'outline' ? cores.outline : cores.primary}
              >
                {executando ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Icon className="w-4 h-4 mr-2" />}
                {b.label}
              </Button>
            );
          })}
        </div>

        {resultado && (
          <div className="p-3 bg-slate-50 border rounded text-xs">
            <p className="font-medium mb-2">{resultado.mensagem || (resultado.success !== false ? 'Concluído' : 'Falhou')}</p>
            <details>
              <summary className="text-blue-600 cursor-pointer hover:underline">Ver detalhes</summary>
              <pre className="mt-2 text-[10px] bg-slate-900 text-slate-100 p-2 rounded max-h-64 overflow-auto">
                {JSON.stringify(resultado.resultados || resultado.diagnostico || resultado, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ════════════════════════════════════════════════════════════════════
// ABA 3 — Histórico (SkillExecution)
// ════════════════════════════════════════════════════════════════════
function AbaHistorico() {
  const [execucoes, setExecucoes] = React.useState([]);
  const [loading, setLoading] = React.useState(false);

  const carregar = async () => {
    setLoading(true);
    try {
      const lista = await base44.entities.SkillExecution.filter(
        { skill_name: 'sanitizacao_contato_forense' },
        '-created_date',
        50
      );
      setExecucoes(lista || []);
    } catch (e) {
      toast.error('Erro ao carregar: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => { carregar(); }, []);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Histórico de Saneamentos</CardTitle>
          <CardDescription>Últimas 50 execuções da skill</CardDescription>
        </div>
        <Button onClick={carregar} disabled={loading} variant="outline" size="sm">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
      </CardHeader>
      <CardContent>
        {execucoes.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-8">Nenhuma execução registrada ainda</p>
        ) : (
          <div className="space-y-2">
            {execucoes.map(ex => (
              <div key={ex.id} className={`p-3 rounded border ${ex.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {ex.success ? <CheckCircle2 className="w-4 h-4 text-green-600" /> : <AlertTriangle className="w-4 h-4 text-red-600" />}
                    <span className="font-mono text-xs">{ex.context?.contact_id?.substring(0, 12)}...</span>
                    <Badge variant="outline" className="text-[10px]">{ex.execution_mode}</Badge>
                  </div>
                  <span className="text-[10px] text-slate-500">{new Date(ex.created_date).toLocaleString('pt-BR')}</span>
                </div>
                {ex.resultado && (
                  <div className="mt-1 text-[11px] text-slate-700 flex gap-3">
                    {ex.resultado.duplicatas_removidas > 0 && <span>🔗 {ex.resultado.duplicatas_removidas} merged</span>}
                    {ex.resultado.mensagens_revinculadas > 0 && <span>💬 {ex.resultado.mensagens_revinculadas} msgs</span>}
                    {ex.resultado.threads_corrigidas > 0 && <span>🧵 {ex.resultado.threads_corrigidas} threads</span>}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}