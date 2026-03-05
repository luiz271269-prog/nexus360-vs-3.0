import React, { useState, useEffect } from 'react';
import { useContatosInteligentes } from '../components/hooks/useContatosInteligentes';
import { base44 } from '@/api/base44Client';
import ClienteCard from '../components/inteligencia/ClienteCard';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  AlertTriangle, 
  TrendingUp, 
  Activity,
  RefreshCw,
  Loader2,
  Target,
  Filter,
  Sparkles,
  Users,
  CheckSquare
} from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import ModalEnvioMassa from '../components/comunicacao/ModalEnvioMassa';

export default function ContatosInteligentes() {
  const [usuario, setUsuario] = useState(null);
  const [filtroAtivo, setFiltroAtivo] = useState('todos'); // todos, critico, alto
  const [enviandoPromos, setEnviandoPromos] = useState(false);
  const [modoSelecao, setModoSelecao] = useState(false);
  const [contatosSelecionados, setContatosSelecionados] = useState([]);
  const [mostrarModalMassa, setMostrarModalMassa] = useState(false);
  
  const navigate = useNavigate();
  
  const { 
    clientes, 
    estatisticas, 
    loading, 
    error,
    totalUrgentes,
    criticos,
    altos,
    refetch 
  } = useContatosInteligentes(usuario, {
    tipo: ['lead', 'cliente'],
    diasSemMensagem: 2,
    minDealRisk: 20,
    limit: 100,
    autoRefresh: true
  });

  // Carregar usuário
  useEffect(() => {
    base44.auth.me().then(setUsuario).catch(console.error);
  }, []);

  const clientesFiltrados = clientes.filter(c => {
    if (filtroAtivo === 'critico') return c.prioridadeLabel === 'CRITICO';
    if (filtroAtivo === 'alto') return ['CRITICO', 'ALTO'].includes(c.prioridadeLabel);
    return true;
  });

  const enviarPromocoesAutomaticas = async () => {
    const contatos = modoSelecao && contatosSelecionados.length > 0 
      ? contatosSelecionados 
      : clientesFiltrados;

    if (!contatos.length) {
      toast.error('Nenhum contato para enviar');
      return;
    }

    const confirmacao = window.confirm(
      `🚀 Enviar promoções automáticas para ${contatos.length} contatos?\n\n` +
      `Processo:\n` +
      `1️⃣ Saudação personalizada (agora)\n` +
      `2️⃣ Aguardar 5 minutos\n` +
      `3️⃣ Enviar promoção ativa\n\n` +
      `Bloqueios: Fornecedores, tags bloqueadas, financeiro\n` +
      `Tempo estimado: ${Math.ceil(contatos.length * 0.8)}s`
    );

    if (!confirmacao) return;

    setEnviandoPromos(true);
    toast.loading(`📤 Enviando saudações para ${contatos.length} contatos...`, { id: 'envio-lote' });

    try {
      const contactIds = contatos.map(c => c.contact_id || c.id);

      const resultado = await base44.functions.invoke('enviarCampanhaLote', {
        contact_ids: contactIds,
        modo: 'promocao',
        delay_minutos: 5
      });

      if (resultado.data?.success) {
        const { enviados, erros } = resultado.data;
        toast.success(`✅ ${enviados} saudações enviadas! Promoções agendadas para daqui 5 min.`, { id: 'envio-lote' });
        
        if (erros > 0) {
          toast.error(`⚠️ ${erros} erros (bloqueios ou falhas)`);
        }

        refetch();
      } else {
        throw new Error(resultado.data?.error || 'Erro no envio');
      }
    } catch (error) {
      console.error('[CONTATOS-INTELIGENTES] Erro:', error);
      toast.error(`❌ Erro: ${error.message}`, { id: 'envio-lote' });
    } finally {
      setEnviandoPromos(false);
      setModoSelecao(false);
      setContatosSelecionados([]);
    }
  };

  const abrirEnvioMassa = () => {
    const contatos = modoSelecao && contatosSelecionados.length > 0 
      ? contatosSelecionados 
      : clientesFiltrados;

    if (!contatos.length) {
      toast.error('Nenhum contato para enviar');
      return;
    }

    setMostrarModalMassa(true);
  };

  const toggleSelecaoContato = (contactId) => {
    setContatosSelecionados(prev => {
      if (prev.some(c => (c.contact_id || c.id) === contactId)) {
        return prev.filter(c => (c.contact_id || c.id) !== contactId);
      } else {
        const contato = clientesFiltrados.find(c => (c.contact_id || c.id) === contactId);
        return contato ? [...prev, contato] : prev;
      }
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 mb-2">
              Contatos Inteligentes
            </h1>
            <p className="text-slate-600">
              Análise por IA · Priorização automática · Ações recomendadas
            </p>
          </div>
          
          <Button
            onClick={() => refetch()}
            disabled={loading}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </Button>
        </div>

        {/* Cards de estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-700 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                Críticos
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-red-600">
                {loading ? '...' : criticos.length}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-50 to-orange-100 border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-orange-700 flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Alta Prioridade
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-orange-600">
                {loading ? '...' : altos.length}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-700 flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Total Urgentes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-blue-600">
                {loading ? '...' : totalUrgentes}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 border-slate-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-700 flex items-center gap-2">
                <Target className="w-4 h-4" />
                Total Analisados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold text-slate-600">
                {loading ? '...' : clientes.length}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Filtros + Ações */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-500" />
            <Button
              size="sm"
              variant={filtroAtivo === 'todos' ? 'default' : 'outline'}
              onClick={() => setFiltroAtivo('todos')}
            >
              Todos ({clientes.length})
            </Button>
            <Button
              size="sm"
              variant={filtroAtivo === 'critico' ? 'default' : 'outline'}
              onClick={() => setFiltroAtivo('critico')}
              className={filtroAtivo === 'critico' ? 'bg-red-500 hover:bg-red-600' : ''}
            >
              Críticos ({criticos.length})
            </Button>
            <Button
              size="sm"
              variant={filtroAtivo === 'alto' ? 'default' : 'outline'}
              onClick={() => setFiltroAtivo('alto')}
              className={filtroAtivo === 'alto' ? 'bg-orange-500 hover:bg-orange-600' : ''}
            >
              Alta Prioridade ({totalUrgentes})
            </Button>
          </div>

          {/* Botões de Ação */}
          {clientesFiltrados.length > 0 && (
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setModoSelecao(!modoSelecao)}
                className={modoSelecao ? 'bg-blue-50 border-blue-300' : ''}
              >
                <CheckSquare className="w-4 h-4 mr-1" />
                {modoSelecao ? `Selecionados (${contatosSelecionados.length})` : 'Selecionar'}
              </Button>

              <Button
                onClick={enviarPromocoesAutomaticas}
                disabled={enviandoPromos}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white"
              >
                {enviandoPromos ? (
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                ) : (
                  <Sparkles className="w-4 h-4 mr-2" />
                )}
                Auto ({modoSelecao && contatosSelecionados.length > 0 ? contatosSelecionados.length : clientesFiltrados.length})
              </Button>

              <Button
                onClick={abrirEnvioMassa}
                disabled={loading}
                variant="outline"
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
              >
                <Users className="w-4 h-4 mr-2" />
                Massa ({modoSelecao && contatosSelecionados.length > 0 ? contatosSelecionados.length : clientesFiltrados.length})
              </Button>
            </div>
          )}
        </div>

        {/* Vista em Colunas por Prioridade */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-3" />
            <p className="text-slate-600">Analisando contatos...</p>
          </div>
        ) : error ? (
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6 text-center">
              <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
              <p className="text-red-700 font-medium">Erro ao carregar contatos</p>
              <p className="text-xs text-red-600 mt-1">{error}</p>
            </CardContent>
          </Card>
        ) : clientesFiltrados.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center">
              <Target className="w-12 h-12 text-green-500 mx-auto mb-3" />
              <p className="text-lg font-medium text-slate-700">Tudo sob controle!</p>
              <p className="text-sm text-slate-500 mt-1">
                Nenhum contato requer atenção no filtro selecionado
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="overflow-x-auto pb-4">
            <div className="flex gap-6 min-w-max">
              {/* Coluna: Críticos */}
              <div className="flex-shrink-0 w-80">
                <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 mb-3 border border-red-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-red-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Críticos
                    </h3>
                    <Badge className="bg-red-600 text-white">{criticos.length}</Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {criticos.map(cliente => (
                    <div 
                      key={cliente.contact_id} 
                      className="relative"
                      onClick={() => modoSelecao && toggleSelecaoContato(cliente.contact_id)}
                    >
                      {modoSelecao && (
                        <div className="absolute top-2 left-2 z-10">
                          <input
                            type="checkbox"
                            checked={contatosSelecionados.some(c => (c.contact_id || c.id) === cliente.contact_id)}
                            onChange={() => toggleSelecaoContato(cliente.contact_id)}
                            className="w-5 h-5 rounded border-2 border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                      <ClienteCard 
                        cliente={cliente}
                        onAbrirConversa={async (clienteData) => {
                          try {
                            const threads = await base44.entities.MessageThread.filter({
                              contact_id: clienteData.contact_id || clienteData.id,
                              is_canonical: true
                            }, '-last_message_at', 1);
                            
                            if (threads.length > 0) {
                              navigate(createPageUrl('Comunicacao') + `?thread=${threads[0].id}`);
                            } else {
                              toast.info('💬 Contato sem conversa. Redirecionando...');
                              navigate(createPageUrl('Comunicacao') + `?contact=${clienteData.contact_id || clienteData.id}`);
                            }
                          } catch (error) {
                            console.error('[ContatosInteligentes] Erro ao abrir:', error);
                            toast.error('❌ Erro ao abrir conversa');
                          }
                        }}
                        className={modoSelecao && contatosSelecionados.some(c => (c.contact_id || c.id) === cliente.contact_id) ? 'ring-2 ring-blue-500' : ''}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna: Alta Prioridade */}
              <div className="flex-shrink-0 w-80">
                <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 mb-3 border border-orange-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-orange-700 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4" />
                      Alta Prioridade
                    </h3>
                    <Badge className="bg-orange-600 text-white">
                      {altos.filter(a => a.prioridadeLabel === 'ALTO').length}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {altos.filter(a => a.prioridadeLabel === 'ALTO').map(cliente => (
                    <div 
                      key={cliente.contact_id} 
                      className="relative"
                      onClick={() => modoSelecao && toggleSelecaoContato(cliente.contact_id)}
                    >
                      {modoSelecao && (
                        <div className="absolute top-2 left-2 z-10">
                          <input
                            type="checkbox"
                            checked={contatosSelecionados.some(c => (c.contact_id || c.id) === cliente.contact_id)}
                            onChange={() => toggleSelecaoContato(cliente.contact_id)}
                            className="w-5 h-5 rounded border-2 border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                      <ClienteCard 
                        cliente={cliente}
                        onAbrirConversa={async (clienteData) => {
                          try {
                            const threads = await base44.entities.MessageThread.filter({
                              contact_id: clienteData.contact_id || clienteData.id,
                              is_canonical: true
                            }, '-last_message_at', 1);
                            
                            if (threads.length > 0) {
                              navigate(createPageUrl('Comunicacao') + `?thread=${threads[0].id}`);
                            } else {
                              toast.info('💬 Contato sem conversa. Redirecionando...');
                              navigate(createPageUrl('Comunicacao') + `?contact=${clienteData.contact_id || clienteData.id}`);
                            }
                          } catch (error) {
                            console.error('[ContatosInteligentes] Erro ao abrir:', error);
                            toast.error('❌ Erro ao abrir conversa');
                          }
                        }}
                        className={modoSelecao && contatosSelecionados.some(c => (c.contact_id || c.id) === cliente.contact_id) ? 'ring-2 ring-blue-500' : ''}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Coluna: Monitorar */}
              <div className="flex-shrink-0 w-80">
                <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 mb-3 border border-blue-200">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-blue-700 flex items-center gap-2">
                      <Activity className="w-4 h-4" />
                      Monitorar
                    </h3>
                    <Badge className="bg-blue-600 text-white">
                      {clientes.filter(c => !criticos.includes(c) && !altos.includes(c)).length}
                    </Badge>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  {clientes.filter(c => !criticos.includes(c) && !altos.includes(c)).map(cliente => (
                    <div 
                      key={cliente.contact_id} 
                      className="relative"
                      onClick={() => modoSelecao && toggleSelecaoContato(cliente.contact_id)}
                    >
                      {modoSelecao && (
                        <div className="absolute top-2 left-2 z-10">
                          <input
                            type="checkbox"
                            checked={contatosSelecionados.some(c => (c.contact_id || c.id) === cliente.contact_id)}
                            onChange={() => toggleSelecaoContato(cliente.contact_id)}
                            className="w-5 h-5 rounded border-2 border-blue-500"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      )}
                      <ClienteCard 
                        cliente={cliente}
                        onAbrirConversa={async (clienteData) => {
                          try {
                            const threads = await base44.entities.MessageThread.filter({
                              contact_id: clienteData.contact_id || clienteData.id,
                              is_canonical: true
                            }, '-last_message_at', 1);
                            
                            if (threads.length > 0) {
                              navigate(createPageUrl('Comunicacao') + `?thread=${threads[0].id}`);
                            } else {
                              toast.info('💬 Contato sem conversa. Redirecionando...');
                              navigate(createPageUrl('Comunicacao') + `?contact=${clienteData.contact_id || clienteData.id}`);
                            }
                          } catch (error) {
                            console.error('[ContatosInteligentes] Erro ao abrir:', error);
                            toast.error('❌ Erro ao abrir conversa');
                          }
                        }}
                        className={modoSelecao && contatosSelecionados.some(c => (c.contact_id || c.id) === cliente.contact_id) ? 'ring-2 ring-blue-500' : ''}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Envio em Massa */}
        {mostrarModalMassa && (
          <ModalEnvioMassa
            contatosSelecionados={modoSelecao && contatosSelecionados.length > 0 ? contatosSelecionados : clientesFiltrados}
            onClose={() => {
              setMostrarModalMassa(false);
              setModoSelecao(false);
              setContatosSelecionados([]);
            }}
            onEnviar={async (mensagem) => {
              const contatos = modoSelecao && contatosSelecionados.length > 0 
                ? contatosSelecionados 
                : clientesFiltrados;
              
              const contactIds = contatos.map(c => c.contact_id || c.id);
              
              toast.loading(`📤 Enviando para ${contactIds.length} contatos...`, { id: 'massa' });

              try {
                const resultado = await base44.functions.invoke('enviarCampanhaLote', {
                  contact_ids: contactIds,
                  modo: 'broadcast',
                  mensagem,
                  personalizar: true
                });

                if (resultado.data?.success) {
                  toast.success(`✅ ${resultado.data.enviados} enviadas!`, { id: 'massa' });
                  if (resultado.data.erros > 0) {
                    toast.error(`⚠️ ${resultado.data.erros} erros`);
                  }
                  setMostrarModalMassa(false);
                  setModoSelecao(false);
                  setContatosSelecionados([]);
                  refetch();
                }
              } catch (error) {
                toast.error(`❌ ${error.message}`, { id: 'massa' });
              }
            }}
          />
        )}
      </div>
    </div>
  );
}