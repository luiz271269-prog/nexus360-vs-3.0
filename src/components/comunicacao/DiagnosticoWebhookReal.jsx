import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  Clock,
  AlertTriangle,
  Eye,
  Phone,
  MessageSquare,
  Image,
  FileText,
  Mic
} from "lucide-react";
import { format } from "date-fns";

export default function DiagnosticoWebhookReal({ integracaoFiltro = null }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('todos'); // todos, sucesso, erro
  const [expandido, setExpandido] = useState(null);
  const [integracoes, setIntegracoes] = useState([]);

  useEffect(() => {
    carregarIntegracoes();
    carregarLogs();
    // Auto-refresh a cada 5 segundos
    const interval = setInterval(carregarLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const carregarIntegracoes = async () => {
    try {
      const data = await base44.entities.WhatsAppIntegration.list();
      setIntegracoes(data);
    } catch (error) {
      console.error('[DIAGNOSTICO] Erro ao carregar integrações:', error);
    }
  };

  const carregarLogs = async () => {
    setLoading(true);
    try {
      // ✅ BUSCAR LOGS DE AUDITORIA NORMALIZADOS (MAIS RECENTE)
      const auditLogs = await base44.entities.ZapiPayloadNormalized.list('-created_date', 100);
      console.log('[DIAGNOSTICO] 📊 Logs carregados:', auditLogs.length);
      
      // Transformar para formato esperado
      const logsTransformados = auditLogs.map(audit => {
        const payload = audit.payload_bruto || {};
        const instanceExtraido = payload.instanceId || payload.instance || audit.instance_identificado;
        
        return {
          id: audit.id,
          timestamp: audit.timestamp_recebido || audit.created_date,
          event_type: audit.evento || 'unknown',
          instance_id: instanceExtraido,
          success: audit.sucesso_processamento,
          processed: true,
          raw_data: payload,
          result: audit.sucesso_processamento ? { processed: true } : null,
          error: audit.erro_detalhes || null,
          processing_time_ms: null,
          integration_id: audit.integration_id,
          // ✅ ADICIONAR CAMPOS PARA FACILITAR FILTRO
          payload_instance: payload.instance,
          payload_instanceId: payload.instanceId,
          instance_identificado: audit.instance_identificado
        };
      });
      
      setLogs(logsTransformados);
      console.log('[DIAGNOSTICO] ✅ Logs transformados:', logsTransformados.length);
      
      if (integracaoFiltro) {
        console.log('[DIAGNOSTICO] 🔍 Filtrando por integração:', {
          id: integracaoFiltro.id,
          nome: integracaoFiltro.nome_instancia,
          instance_id_provider: integracaoFiltro.instance_id_provider,
          numero: integracaoFiltro.numero_telefone
        });
        
        // Debug: mostrar todas as instances nos logs
        const instancesNosLogs = [...new Set(logsTransformados.map(l => l.instance_id))];
        console.log('[DIAGNOSTICO] 📋 Instances encontradas nos logs:', instancesNosLogs);
      }
    } catch (error) {
      console.error('[DIAGNOSTICO] ❌ Erro ao carregar logs:', error);
    }
    setLoading(false);
  };

  console.log('[DIAGNOSTICO] 🔍 Aplicando filtro. Total de logs:', logs.length);
  if (integracaoFiltro) {
    console.log('[DIAGNOSTICO] 🎯 Filtro ativo para integração:', {
      id: integracaoFiltro.id,
      nome: integracaoFiltro.nome_instancia,
      instance_id_provider: integracaoFiltro.instance_id_provider,
      numero: integracaoFiltro.numero_telefone
    });
  }
  
  const logsFiltrados = logs.filter(log => {
    // Filtro por tipo (sucesso/erro)
    if (filtro === 'sucesso' && log.success !== true) return false;
    if (filtro === 'erro' && log.success !== false) return false;
    
    // ✅ FILTRO POR INTEGRAÇÃO - COMPARAÇÃO ROBUSTA E ABRANGENTE
    if (integracaoFiltro) {
      const logInstanceId = log.instance_id;
      const numeroIntegracao = integracaoFiltro.numero_telefone?.replace(/\D/g, '');
      const numeroIntegracaoComPais = integracaoFiltro.numero_telefone;
      
      // Normalizar números para comparação (remover +, espaços, etc)
      const normalizarTelefone = (tel) => tel ? tel.replace(/\D/g, '') : '';
      
      const numeroLogNormalizado = normalizarTelefone(logInstanceId);
      const numeroIntegracaoNormalizado = normalizarTelefone(numeroIntegracao);
      
      // Comparar com TODOS os campos possíveis
      const instanceMatch = 
        // Comparação direta de IDs
        logInstanceId === integracaoFiltro.instance_id_provider ||
        logInstanceId === integracaoFiltro.nome_instancia ||
        log.integration_id === integracaoFiltro.id ||
        
        // Comparação de números (normalizada)
        logInstanceId === numeroIntegracao ||
        logInstanceId === numeroIntegracaoComPais ||
        numeroLogNormalizado === numeroIntegracaoNormalizado ||
        
        // Comparação com campos alternativos do payload
        log.payload_instance === integracaoFiltro.instance_id_provider ||
        log.payload_instanceId === integracaoFiltro.instance_id_provider ||
        log.instance_identificado === integracaoFiltro.instance_id_provider ||
        
        // Match parcial de número (últimos 10 dígitos)
        (numeroLogNormalizado.length >= 10 && numeroIntegracaoNormalizado.length >= 10 &&
         numeroLogNormalizado.slice(-10) === numeroIntegracaoNormalizado.slice(-10));
      
      if (!instanceMatch) {
        console.log('[DIAGNOSTICO] ❌ Log NÃO passou no filtro:', {
          log_instance_id: logInstanceId,
          log_integration_id: log.integration_id,
          filtro_instance_id: integracaoFiltro.instance_id_provider,
          filtro_numero: numeroIntegracaoComPais,
          filtro_nome: integracaoFiltro.nome_instancia
        });
      }
      
      return instanceMatch;
    }
    
    return true;
  });
  
  console.log('[DIAGNOSTICO] 📊 Resultado do filtro:', {
    total_logs: logs.length,
    logs_filtrados: logsFiltrados.length,
    filtro_ativo: !!integracaoFiltro
  });
  
  // Debug detalhado do filtro
  if (integracaoFiltro && logsFiltrados.length === 0 && logs.length > 0) {
    console.log('[DIAGNOSTICO] 🚨 NENHUM LOG PASSOU NO FILTRO!');
    console.log('[DIAGNOSTICO] 📋 Instances nos logs:', [...new Set(logs.map(l => l.instance_id))]);
    console.log('[DIAGNOSTICO] 🎯 Filtro buscando:', {
      instance_id_provider: integracaoFiltro.instance_id_provider,
      nome_instancia: integracaoFiltro.nome_instancia,
      numero_telefone: integracaoFiltro.numero_telefone,
      id: integracaoFiltro.id
    });
    
    console.log('[DIAGNOSTICO] 🔬 Amostra de logs (primeiros 3):');
    logs.slice(0, 3).forEach((log, idx) => {
      console.log(`[DIAGNOSTICO]   Log ${idx + 1}:`, {
        instance_id: log.instance_id,
        integration_id: log.integration_id,
        payload_instance: log.payload_instance,
        payload_instanceId: log.payload_instanceId,
        instance_identificado: log.instance_identificado
      });
    });
  }

  const getIconeTipoMensagem = (log) => {
    if (log.event_type === 'MessageStatusCallback') {
      return <Clock className="w-4 h-4 text-blue-500" />;
    }
    
    const dados = log.raw_data || {};
    
    if (dados.image) return <Image className="w-4 h-4 text-green-500" />;
    if (dados.audio) return <Mic className="w-4 h-4 text-purple-500" />;
    if (dados.document) return <FileText className="w-4 h-4 text-orange-500" />;
    
    return <MessageSquare className="w-4 h-4 text-slate-500" />;
  };

  const getConteudoPreview = (log) => {
    const dados = log.raw_data || {};
    
    // ✅ SUPORTE PARA MÚLTIPLOS FORMATOS DE PAYLOAD
    if (log.event_type === 'MessageStatusCallback') {
      return `Status: ${dados.status} (${dados.ids?.length || 0} mensagem(ns))`;
    }
    
    // Formato Z-API ReceivedCallback
    if (dados.text?.message) {
      return dados.text.message.substring(0, 50) + (dados.text.message.length > 50 ? '...' : '');
    }
    
    // Formato antigo (texto.mensagem)
    if (dados.texto?.mensagem) {
      return dados.texto.mensagem.substring(0, 50) + (dados.texto.mensagem.length > 50 ? '...' : '');
    }
    
    // Mídia
    if (dados.image) return '📷 Imagem' + (dados.image.caption ? ': ' + dados.image.caption.substring(0, 30) : '');
    if (dados.audio) return '🎤 Áudio';
    if (dados.video) return '🎬 Vídeo' + (dados.video.caption ? ': ' + dados.video.caption.substring(0, 30) : '');
    if (dados.document) return '📄 ' + (dados.document.fileName || 'Documento');
    
    return 'Sem conteúdo';
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Phone className="w-5 h-5 text-green-600" />
            {integracaoFiltro ? `Mensagens - ${integracaoFiltro.nome_instancia}` : 'Mensagens Reais Recebidas'}
          </CardTitle>
          <div className="flex items-center gap-2">
            <select 
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="px-3 py-1 border rounded text-sm"
            >
              <option value="todos">Todos</option>
              <option value="sucesso">Sucesso</option>
              <option value="erro">Erro</option>
            </select>
            <Button 
              size="sm" 
              variant="outline"
              onClick={carregarLogs}
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
        {integracaoFiltro && (
          <p className="text-sm text-slate-600 mt-2">
            📞 Filtrando mensagens para: {integracaoFiltro.numero_telefone}
          </p>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="w-6 h-6 animate-spin text-blue-500" />
            <span className="ml-2 text-slate-600">Carregando logs...</span>
          </div>
        ) : logsFiltrados.length === 0 ? (
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {integracaoFiltro 
                ? `Nenhuma mensagem recebida para ${integracaoFiltro.nome_instancia}. Envie uma mensagem do seu WhatsApp para testar.`
                : 'Nenhuma mensagem recebida ainda. Envie uma mensagem do seu WhatsApp para testar.'}
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-2">
            {logsFiltrados.map((log) => (
              <div 
                key={log.id}
                className={`border rounded-lg p-3 ${
                  log.success 
                    ? 'border-green-200 bg-green-50' 
                    : log.processed 
                    ? 'border-red-200 bg-red-50'
                    : 'border-yellow-200 bg-yellow-50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getIconeTipoMensagem(log)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {log.success ? (
                          <CheckCircle className="w-4 h-4 text-green-600" />
                        ) : log.processed ? (
                          <XCircle className="w-4 h-4 text-red-600" />
                        ) : (
                          <Clock className="w-4 h-4 text-yellow-600" />
                        )}
                        <span className="font-medium text-sm">
                          {log.event_type}
                        </span>
                        <Badge variant="outline" className="text-xs">
                          {log.raw_data?.telefone || log.raw_data?.phone || 'Sem telefone'}
                        </Badge>
                        {log.instance_id && (
                          <Badge className="bg-purple-100 text-purple-700 text-xs">
                            {integracoes.find(i => i.instance_id_provider === log.instance_id || i.nome_instancia === log.instance_id)?.nome_instancia || log.instance_id}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-600 truncate">
                        {getConteudoPreview(log)}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {formatarTimestamp(log.timestamp)}
                        {log.processing_time_ms && (
                          <span className="ml-2">• {log.processing_time_ms}ms</span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpandido(expandido === log.id ? null : log.id)}
                  >
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>

                {expandido === log.id && (
                  <div className="mt-3 pt-3 border-t space-y-2">
                    {log.error && (
                      <Alert className="bg-red-100 border-red-300">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <AlertDescription className="text-red-800">
                          <strong>Erro:</strong> {log.error}
                        </AlertDescription>
                      </Alert>
                    )}
                    
                    {log.result && (
                      <div className="bg-green-100 border border-green-300 rounded p-2">
                        <strong className="text-green-900 text-sm">Resultado:</strong>
                        <pre className="text-xs text-green-800 mt-1 overflow-x-auto">
                          {JSON.stringify(log.result, null, 2)}
                        </pre>
                      </div>
                    )}
                    
                    <div className="bg-slate-100 border border-slate-300 rounded p-2">
                      <strong className="text-slate-900 text-sm">Payload Completo:</strong>
                      <pre className="text-xs text-slate-700 mt-1 overflow-x-auto max-h-96">
                        {JSON.stringify(log.raw_data, null, 2)}
                      </pre>
                    </div>
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

function formatarTimestamp(timestamp) {
  try {
    return format(new Date(timestamp), 'dd/MM/yyyy HH:mm:ss');
  } catch {
    return timestamp;
  }
}