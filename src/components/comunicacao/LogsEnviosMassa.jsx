import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Send, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  RefreshCw,
  MessageSquare,
  Users
} from 'lucide-react';
import { toast } from 'sonner';

export default function LogsEnviosMassa() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandidos, setExpandidos] = useState({});

  const carregarLogs = async () => {
    setLoading(true);
    try {
      const logs = await base44.entities.AutomationLog.filter(
        { 
          acao: { $in: ['envio_massa_broadcast', 'envio_massa_promocao'] }
        },
        '-timestamp',
        50
      );
      setLogs(logs);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
      toast.error('Erro ao carregar logs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarLogs();
  }, []);

  const toggleExpandir = (logId) => {
    setExpandidos(prev => ({
      ...prev,
      [logId]: !prev[logId]
    }));
  };

  if (loading) {
    return (
      <div className="p-8 text-center">
        <RefreshCw className="w-8 h-8 animate-spin text-orange-500 mx-auto mb-3" />
        <p className="text-sm text-slate-600">Carregando histórico...</p>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="p-8 text-center">
        <MessageSquare className="w-12 h-12 text-slate-300 mx-auto mb-3" />
        <p className="text-sm text-slate-600">Nenhum envio em massa registrado</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-bold text-slate-800">Histórico de Envios em Massa</h3>
        <Button size="sm" variant="outline" onClick={carregarLogs}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {logs.map((log) => {
        const detalhes = log.detalhes || {};
        const isExpandido = expandidos[log.id];
        const modo = detalhes.modo === 'promocao' ? 'Promoções' : 'Broadcast';
        const porcentagem = detalhes.total_contatos > 0 
          ? Math.round((detalhes.enviados / detalhes.total_contatos) * 100) 
          : 0;

        return (
          <Card key={log.id} className="p-4">
            <div className="flex items-start gap-3">
              {/* Ícone */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                detalhes.enviados > 0 ? 'bg-green-100' : 'bg-red-100'
              }`}>
                {detalhes.enviados > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold text-sm text-slate-800">
                    {modo} • {detalhes.total_contatos} contatos
                  </h4>
                  <Badge className={detalhes.enviados > 0 ? 'bg-green-600' : 'bg-red-600'}>
                    {porcentagem}% sucesso
                  </Badge>
                </div>

                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(log.timestamp).toLocaleString('pt-BR')}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-green-600" />
                    {detalhes.enviados} enviados
                  </span>
                  {detalhes.erros > 0 && (
                    <span className="flex items-center gap-1">
                      <XCircle className="w-3 h-3 text-red-600" />
                      {detalhes.erros} erros
                    </span>
                  )}
                </div>

                {detalhes.mensagem_enviada && (
                  <p className="text-xs text-slate-600 italic mb-2 line-clamp-2">
                    "{detalhes.mensagem_enviada}..."
                  </p>
                )}

                {/* Botão expandir detalhes */}
                {detalhes.resultados?.length > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleExpandir(log.id)}
                    className="h-7 px-2 text-xs"
                  >
                    {isExpandido ? (
                      <>
                        <ChevronDown className="w-3 h-3 mr-1" />
                        Ocultar detalhes
                      </>
                    ) : (
                      <>
                        <ChevronRight className="w-3 h-3 mr-1" />
                        Ver {detalhes.resultados.length} contatos
                      </>
                    )}
                  </Button>
                )}

                {/* Lista expandida */}
                {isExpandido && detalhes.resultados?.length > 0 && (
                  <div className="mt-3 space-y-1 max-h-60 overflow-y-auto border-t pt-2">
                    {detalhes.resultados.map((resultado, idx) => (
                      <div 
                        key={idx} 
                        className={`text-xs p-2 rounded flex items-center justify-between ${
                          resultado.status === 'enviado' || resultado.status === 'sucesso' 
                            ? 'bg-green-50' 
                            : resultado.status === 'bloqueado' || resultado.status === 'aviso'
                            ? 'bg-yellow-50'
                            : 'bg-red-50'
                        }`}
                      >
                        <div className="flex-1">
                          <span className="font-medium text-slate-800">
                            {resultado.nome || 'Sem nome'}
                          </span>
                          {resultado.motivo && (
                            <p className="text-slate-500 text-[10px] mt-0.5">
                              {resultado.motivo}
                            </p>
                          )}
                        </div>
                        <Badge 
                          variant="outline" 
                          className={`text-[9px] ${
                            resultado.status === 'enviado' || resultado.status === 'sucesso'
                              ? 'border-green-300 text-green-700'
                              : resultado.status === 'bloqueado' || resultado.status === 'aviso'
                              ? 'border-yellow-300 text-yellow-700'
                              : 'border-red-300 text-red-700'
                          }`}
                        >
                          {resultado.status}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}