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
  const [integracaoSelecionada, setIntegracaoSelecionada] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [telefone, setTelefone] = useState('');
  const [margemSegundos, setMargemSegundos] = useState(60);
  const [modo, setModo] = useState('auto'); // 'auto' ou 'manual'
  
  // Configurar datas padrão (últimas 24h)
  useEffect(() => {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    setDataFim(now.toISOString().slice(0, 16));
    setDataInicio(yesterday.toISOString().slice(0, 16));
  }, []);
  
  const handleReplayManual = async () => {
    if (!integracaoSelecionada || !dataInicio || !dataFim) {
      toast.error('Preencha todos os campos obrigatórios');
      return;
    }
    
    setLoading(true);
    setResultado(null);
    
    try {
      toast.info('🔄 Iniciando replay manual...');
      
      const response = await base44.functions.invoke('replayWapiEvents', {
        integrationId: integracaoSelecionada,
        from: new Date(dataInicio).toISOString(),
        to: new Date(dataFim).toISOString(),
        phone: telefone || undefined
      });
      
      if (response.data.success) {
        setResultado(response.data.resultados);
        
        const { created, skipped, errors } = response.data.resultados;
        toast.success(`✅ Replay concluído: ${created} recuperadas, ${skipped} duplicatas, ${errors} erros`);
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
          
          {/* Botão de ação */}
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button
              onClick={modo === 'auto' ? handleReplayAuto : handleReplayManual}
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
                  Executar Replay {modo === 'auto' ? 'Automático' : 'Manual'}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* Resultados */}
      {resultado && (
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
            
            {/* Detalhes */}
            {resultado.detalhes && resultado.detalhes.length > 0 && (
              <div className="bg-white rounded-lg p-3 border max-h-64 overflow-y-auto">
                <div className="text-xs font-semibold text-slate-700 mb-2">
                  Detalhes ({resultado.detalhes.length} eventos)
                </div>
                <div className="space-y-1">
                  {resultado.detalhes.slice(0, 50).map((detalhe, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      {detalhe.status === 'created' && (
                        <Badge className="bg-green-600 text-white">CRIADA</Badge>
                      )}
                      {detalhe.status === 'skipped' && (
                        <Badge className="bg-blue-600 text-white">DUPLICATA</Badge>
                      )}
                      {detalhe.status === 'error' && (
                        <Badge className="bg-red-600 text-white">ERRO</Badge>
                      )}
                      <span className="text-slate-600">
                        {detalhe.message_id?.substring(0, 20) || 'N/A'}
                      </span>
                      {detalhe.telefone && (
                        <span className="text-slate-500">• {detalhe.telefone}</span>
                      )}
                      {detalhe.reason && (
                        <span className="text-slate-400">• {detalhe.reason}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
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