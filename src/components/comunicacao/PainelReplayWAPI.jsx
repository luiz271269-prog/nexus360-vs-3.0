import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PlayCircle, RefreshCw, Clock, Database, CheckCircle2, 
  AlertTriangle, Calendar, Phone, Zap, Info
} from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';

export default function PainelReplayWAPI({ integracoes = [] }) {
  const [loading, setLoading] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [comparacao, setComparacao] = useState(null); // 🆕 Resultado da comparação
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [telefone, setTelefone] = useState('');
  const [margemSegundos, setMargemSegundos] = useState(60);
  const [modo, setModo] = useState('manual'); // 'auto' ou 'manual'
  
  // Configurar datas padrão (últimas 24h)
  useEffect(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    setDataFim(now.toISOString().slice(0, 16));
    setDataInicio(yesterday.toISOString().slice(0, 16));
  }, []);
  
  // 🆕 FUNÇÃO 1: Comparar com provedor
  const handleComparar = async () => {
    if (!integracaoSelecionada || !dataInicio || !dataFim) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    setLoading(true);
    setComparacao(null);
    setResultado(null);
    
    try {
      toast.info('🔍 Comparando com provedor...');
      
      const response = await base44.functions.invoke('sincronizarMensagensWAPI', {
        integrationId: integracaoSelecionada,
        from: new Date(dataInicio).toISOString(),
        to: new Date(dataFim).toISOString(),
        phone: telefone || undefined,
        syncMissing: false // Apenas comparar
      });
      
      if (response.data.success) {
        setComparacao(response.data.resultados);
        
        const { mensagens_faltando } = response.data.resultados;
        if (mensagens_faltando === 0) {
          toast.success('✅ Tudo sincronizado! Nenhuma mensagem faltando.');
        } else {
          toast.warning(`⚠️ ${mensagens_faltando} mensagens faltando no banco!`);
        }
      } else {
        toast.error('Erro: ' + response.data.error);
      }
      
    } catch (error) {
      console.error('[COMPARAR] Erro:', error);
      toast.error('Erro ao comparar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  // 🆕 FUNÇÃO 2: Sincronizar mensagens faltando
  const handleSincronizar = async () => {
    if (!integracaoSelecionada || !dataInicio || !dataFim) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    setLoading(true);
    setResultado(null);
    
    try {
      toast.info('🔄 Sincronizando mensagens faltando...');
      
      const response = await base44.functions.invoke('sincronizarMensagensWAPI', {
        integrationId: integracaoSelecionada,
        from: new Date(dataInicio).toISOString(),
        to: new Date(dataFim).toISOString(),
        phone: telefone || undefined,
        syncMissing: true // Sincronizar
      });
      
      if (response.data.success) {
        setResultado(response.data.resultados);
        setComparacao(response.data.resultados); // Atualizar comparação também
        
        const { sincronizadas, erros_sync } = response.data.resultados;
        toast.success(`✅ ${sincronizadas} mensagens sincronizadas, ${erros_sync} erros`);
      } else {
        toast.error('Erro: ' + response.data.error);
      }
      
    } catch (error) {
      console.error('[SYNC] Erro:', error);
      toast.error('Erro ao sincronizar: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleReplayManual = async () => {
    await handleComparar();
  };
  
  const handleReplayAuto = async () => {
    if (!integracaoSelecionada) {
      toast.error('Selecione uma integração');
      return;
    }
    
    setLoading(true);
    setResultado(null);
    
    try {
      toast.info('🤖 Iniciando replay automático...');
      
      const response = await base44.functions.invoke('replayWapiFromLastSaved', {
        integrationId: integracaoSelecionada,
        marginSeconds: margemSegundos,
        phone: telefone || undefined
      });
      
      if (response.data.success) {
        setResultado(response.data.replay_result.resultados);
        
        const { created, skipped, errors } = response.data.replay_result.resultados;
        toast.success(`✅ Replay automático concluído: ${created} recuperadas, ${skipped} duplicatas, ${errors} erros`);
        
        console.log('[REPLAY-AUTO] Período calculado:', response.data.periodo_calculado);
      } else {
        toast.error('Erro: ' + response.data.error);
      }
      
    } catch (error) {
      console.error('[REPLAY] Erro:', error);
      toast.error('Erro ao executar replay: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const integracaoAtual = integracoes.find(i => i.id === integracaoSelecionada);
  
  return (
    <div className="space-y-4">
      <Card className="border-indigo-200 bg-gradient-to-r from-indigo-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Database className="w-5 h-5 text-indigo-600" />
            Replay de Eventos W-API
          </CardTitle>
          <CardDescription>
            Recupere mensagens perdidas durante quedas de banco ou falhas de processamento
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Modo de operação */}
          <div className="flex gap-2 p-2 bg-white rounded-lg border">
            <Button
              size="sm"
              variant={modo === 'auto' ? 'default' : 'outline'}
              onClick={() => setModo('auto')}
              className={modo === 'auto' ? 'bg-indigo-600' : ''}
            >
              <Zap className="w-4 h-4 mr-2" />
              Modo Automático
            </Button>
            <Button
              size="sm"
              variant={modo === 'manual' ? 'default' : 'outline'}
              onClick={() => setModo('manual')}
              className={modo === 'manual' ? 'bg-purple-600' : ''}
            >
              <Calendar className="w-4 h-4 mr-2" />
              Modo Manual
            </Button>
          </div>
          
          {/* Seleção de integração */}
          <div className="space-y-2">
            <Label className="text-sm font-semibold">Integração W-API *</Label>
            <select
              value={integracaoSelecionada}
              onChange={(e) => setIntegracaoSelecionada(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Selecione uma integração...</option>
              {integracoes
                .filter(i => i.api_provider === 'w_api')
                .map(i => (
                  <option key={i.id} value={i.id}>
                    {i.nome_instancia} ({i.numero_telefone})
                  </option>
                ))}
            </select>
          </div>
          
          {/* Modo Automático */}
          {modo === 'auto' && (
            <Alert className="bg-indigo-50 border-indigo-200">
              <Info className="w-4 h-4 text-indigo-600" />
              <AlertDescription className="text-sm text-indigo-800">
                O sistema detectará automaticamente a última mensagem salva e reprocessará 
                eventos desde esse ponto até agora.
              </AlertDescription>
            </Alert>
          )}
          
          {/* Modo Manual */}
          {modo === 'manual' && (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Data/Hora Início *</Label>
                <Input
                  type="datetime-local"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="text-sm"
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Data/Hora Fim *</Label>
                <Input
                  type="datetime-local"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="text-sm"
                />
              </div>
            </div>
          )}
          
          {/* Filtros opcionais */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">Telefone (opcional)</Label>
              <Input
                placeholder="+5548999999999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="text-sm"
              />
            </div>
            
            {modo === 'auto' && (
              <div className="space-y-2">
                <Label className="text-sm font-semibold">Margem de Segurança (segundos)</Label>
                <Input
                  type="number"
                  value={margemSegundos}
                  onChange={(e) => setMargemSegundos(Number(e.target.value))}
                  min={0}
                  max={3600}
                  className="text-sm"
                />
              </div>
            )}
          </div>
          
          {/* Botões de ação */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            {comparacao && comparacao.mensagens_faltando > 0 && (
              <Button
                onClick={handleSincronizar}
                disabled={loading}
                className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Sincronizar {comparacao.mensagens_faltando} Faltando
              </Button>
            )}
            
            <Button
              onClick={modo === 'auto' ? handleReplayAuto : handleComparar}
              disabled={loading || !integracaoSelecionada}
              className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <PlayCircle className="w-4 h-4 mr-2" />
                  {modo === 'auto' ? 'Executar Replay Automático' : 'Comparar com Provedor'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Resultado da Comparação */}
      {comparacao && (
        <Card className={comparacao.mensagens_faltando > 0 ? 'border-yellow-200 bg-yellow-50' : 'border-green-200 bg-green-50'}>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              {comparacao.mensagens_faltando > 0 ? (
                <AlertTriangle className="w-5 h-5 text-yellow-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
              Comparação: Provedor vs Banco
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-3 border">
                <div className="text-xs text-slate-600">No Provedor</div>
                <div className="text-2xl font-bold text-slate-900">{comparacao.mensagens_provedor}</div>
              </div>
              
              <div className="bg-blue-100 rounded-lg p-3 border border-blue-300">
                <div className="text-xs text-blue-700">No Banco</div>
                <div className="text-2xl font-bold text-blue-800">{comparacao.mensagens_banco}</div>
              </div>
              
              <div className={`rounded-lg p-3 border ${comparacao.mensagens_faltando > 0 ? 'bg-red-100 border-red-300' : 'bg-green-100 border-green-300'}`}>
                <div className={`text-xs ${comparacao.mensagens_faltando > 0 ? 'text-red-700' : 'text-green-700'}`}>
                  Faltando
                </div>
                <div className={`text-2xl font-bold ${comparacao.mensagens_faltando > 0 ? 'text-red-800' : 'text-green-800'}`}>
                  {comparacao.mensagens_faltando}
                </div>
              </div>
            </div>
            
            {/* Mensagens Faltando - Detalhes */}
            {comparacao.faltando_detalhes && comparacao.faltando_detalhes.length > 0 && (
              <div className="bg-white rounded-lg p-4 border border-yellow-300">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-yellow-600" />
                  <span className="text-sm font-semibold text-slate-700">
                    Mensagens Faltando ({comparacao.faltando_detalhes.length})
                  </span>
                </div>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {comparacao.faltando_detalhes.map((msg, idx) => (
                    <div key={idx} className="flex items-start gap-3 text-xs p-2 bg-yellow-50 rounded border border-yellow-200">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge className="bg-yellow-600 text-white text-[10px]">FALTANDO</Badge>
                          <span className="text-slate-500 font-mono">{msg.message_id?.substring(0, 20)}</span>
                        </div>
                        <div className="text-slate-700">
                          <Phone className="w-3 h-3 inline mr-1" />
                          {msg.from}
                        </div>
                        <div className="text-slate-600 italic">
                          "{msg.content || '[Sem conteúdo]'}"
                        </div>
                        <div className="text-slate-400 text-[10px]">
                          <Clock className="w-3 h-3 inline mr-1" />
                          {new Date(msg.timestamp).toLocaleString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Resultado da Sincronização */}
            {comparacao.sincronizadas !== undefined && (
              <Alert className="bg-green-50 border-green-300">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <AlertDescription className="text-sm text-green-800">
                  ✅ Sincronização concluída: {comparacao.sincronizadas} mensagens recuperadas, {comparacao.erros_sync} erros
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      )}
      
      {/* Resultados Legados (replay antigo) */}
      {resultado && !comparacao && (
        <Card className="border-green-200 bg-green-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              Resultado do Replay
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 mb-4">
              <div className="bg-white rounded-lg p-3 border">
                <div className="text-xs text-slate-600">Total Eventos</div>
                <div className="text-2xl font-bold text-slate-900">{resultado.total}</div>
              </div>
              
              <div className="bg-green-100 rounded-lg p-3 border border-green-300">
                <div className="text-xs text-green-700">Mensagens Criadas</div>
                <div className="text-2xl font-bold text-green-800">{resultado.created}</div>
              </div>
              
              <div className="bg-blue-100 rounded-lg p-3 border border-blue-300">
                <div className="text-xs text-blue-700">Duplicatas Ignoradas</div>
                <div className="text-2xl font-bold text-blue-800">{resultado.skipped}</div>
              </div>
              
              <div className="bg-red-100 rounded-lg p-3 border border-red-300">
                <div className="text-xs text-red-700">Erros</div>
                <div className="text-2xl font-bold text-red-800">{resultado.errors}</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      {/* Informações da integração selecionada */}
      {integracaoAtual && (
        <Card className="border-slate-200">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Info className="w-4 h-4 text-slate-600" />
              Integração Selecionada
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div>
                <span className="font-semibold text-slate-600">Nome:</span>
                <div className="text-slate-900">{integracaoAtual.nome_instancia}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Telefone:</span>
                <div className="text-slate-900">{integracaoAtual.numero_telefone}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Provedor:</span>
                <div className="text-slate-900">{integracaoAtual.api_provider}</div>
              </div>
              <div>
                <span className="font-semibold text-slate-600">Status:</span>
                <Badge className={integracaoAtual.status === 'conectado' ? 'bg-green-600' : 'bg-red-600'}>
                  {integracaoAtual.status}
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}