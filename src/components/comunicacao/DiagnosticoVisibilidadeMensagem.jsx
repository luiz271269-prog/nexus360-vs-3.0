import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Loader2, CheckCircle2, AlertCircle, XCircle, Eye, EyeOff, Lock, Unlock
} from "lucide-react";
import { toast } from "sonner";

export default function DiagnosticoVisibilidadeMensagem() {
  const [analisando, setAnalisando] = useState(false);
  const [resultado, setResultado] = useState(null);

  const analisar = async () => {
    setAnalisando(true);
    setResultado(null);

    try {
      const res = await base44.functions.invoke('diagnosticoVisibilidadeMensagem', {});
      
      if (res?.data) {
        setResultado(res.data);
        
        if (res.data.razoes_visibilidade?.length === 0) {
          toast.info('✅ Thread deveria estar visível - verificar filtros da UI');
        } else {
          toast.error(`❌ ${res.data.razoes_visibilidade.length} problemas encontrados`);
        }
      }
    } catch (error) {
      console.error("[Diagnóstico]", error);
      toast.error('Erro ao executar diagnóstico');
    } finally {
      setAnalisando(false);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <Card className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <h3 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
          <Eye className="w-5 h-5 text-blue-600" />
          🔍 Por que a mensagem não aparece?
        </h3>
        
        <p className="text-sm text-slate-600 mb-4">
          Analisa permissões, bloqueios e dados da thread para descobrir por que a conversa não aparece na barra lateral.
        </p>

        <Button
          onClick={analisar}
          disabled={analisando}
          className="w-full bg-blue-600 hover:bg-blue-700"
        >
          {analisando ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analisando...
            </>
          ) : (
            <>
              <Eye className="w-4 h-4 mr-2" />
              Executar Diagnóstico
            </>
          )}
        </Button>
      </Card>

      {resultado && (
        <div className="space-y-3">
          {/* INFORMAÇÕES DO USUÁRIO */}
          <Card className="p-4 bg-slate-50 border-slate-200">
            <h4 className="font-bold text-slate-900 mb-3">👤 Dados do Usuário</h4>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <p><span className="text-slate-600">Nome:</span> <strong>{resultado.user_info.name}</strong></p>
              <p><span className="text-slate-600">Role:</span> <strong className="text-indigo-600">{resultado.user_info.role}</strong></p>
              <p><span className="text-slate-600">Email:</span> <strong className="text-xs">{resultado.user_info.email}</strong></p>
              <p><span className="text-slate-600">Setor:</span> <strong>{resultado.user_info.sector}</strong></p>
            </div>
          </Card>

          {/* DADOS DA THREAD */}
          <Card className="p-4 bg-slate-50 border-slate-200">
            <h4 className="font-bold text-slate-900 mb-3">📋 Dados da Thread</h4>
            <div className="space-y-2 text-sm">
              <p><span className="text-slate-600">Contato:</span> <strong>{resultado.contact_data.nome}</strong> ({resultado.contact_data.telefone})</p>
              <p><span className="text-slate-600">Atribuído a:</span> <strong>{resultado.thread_data.assigned_user_id ? '✅ Sim' : '❌ Não (aberta)'}</strong></p>
              <p><span className="text-slate-600">Setor:</span> <strong>{resultado.thread_data.sector_id || 'Sem setor'}</strong></p>
              <p><span className="text-slate-600">Integração:</span> <strong>{resultado.integration_data?.nome || 'N/A'}</strong></p>
              <p><span className="text-slate-600">Não lidas:</span> <strong className="text-orange-600">{resultado.thread_data.unread_count}</strong></p>
              <p><span className="text-slate-600">Total mensagens:</span> <strong>{resultado.thread_data.total_mensagens}</strong></p>
              <p><span className="text-slate-600">Última mensagem:</span> <strong>{new Date(resultado.thread_data.last_message_at).toLocaleTimeString('pt-BR')}</strong></p>
            </div>
          </Card>

          {/* MENSAGENS NA THREAD */}
          {resultado.messages.length > 0 && (
            <Card className="p-4 bg-slate-50 border-slate-200">
              <h4 className="font-bold text-slate-900 mb-3">💬 Mensagens ({resultado.messages.length})</h4>
              <div className="space-y-1 text-xs">
                {resultado.messages.slice(0, 5).map((m, idx) => (
                  <p key={idx} className="p-2 bg-white rounded border border-slate-200">
                    <span className="text-slate-600">{m.sender === 'contact' ? '👤' : '🤖'}</span> {m.content}... 
                    <span className="text-slate-400 ml-2">{new Date(m.created).toLocaleTimeString('pt-BR')}</span>
                  </p>
                ))}
              </div>
            </Card>
          )}

          {/* VERIFICAÇÃO DE CONSISTÊNCIA */}
          <Card className="p-4 bg-slate-50 border-slate-200">
            <h4 className="font-bold text-slate-900 mb-3">✅ Consistência dos Dados</h4>
            <div className="space-y-2 text-sm">
              <p className={resultado.consistencia.thread_tem_last_message_at ? 'text-green-700' : 'text-red-700'}>
                {resultado.consistencia.thread_tem_last_message_at ? '✅' : '❌'} Thread tem last_message_at
              </p>
              <p className={resultado.consistencia.messages_existem ? 'text-green-700' : 'text-red-700'}>
                {resultado.consistencia.messages_existem ? '✅' : '❌'} Mensagens existem ({resultado.messages.length})
              </p>
              <p className={resultado.consistencia.contato_existe ? 'text-green-700' : 'text-red-700'}>
                {resultado.consistencia.contato_existe ? '✅' : '❌'} Contato existe
              </p>
              <p className={resultado.consistencia.integracao_existe ? 'text-green-700' : 'text-red-700'}>
                {resultado.consistencia.integracao_existe ? '✅' : '❌'} Integração existe
              </p>
              <p className={resultado.consistencia.ultima_message_recente ? 'text-green-700' : 'text-slate-600'}>
                {resultado.consistencia.ultima_message_recente ? '✅' : '⏰'} Mensagem recente
              </p>
            </div>
          </Card>

          {/* PERMISSÕES */}
          <Card className="p-4 bg-slate-50 border-slate-200">
            <h4 className="font-bold text-slate-900 mb-3">🔐 Permissões</h4>
            <div className="space-y-2 text-sm">
              <p className={resultado.permissoes.assigned_to_user ? 'text-green-700' : 'text-slate-600'}>
                {resultado.permissoes.assigned_to_user ? '✅' : '❌'} Atribuída ao usuário
              </p>
              <p className={resultado.permissoes.is_admin ? 'text-green-700' : 'text-slate-600'}>
                {resultado.permissoes.is_admin ? '✅' : '❌'} É administrador
              </p>
              <p className={resultado.permissoes.same_sector ? 'text-green-700' : 'text-orange-700'}>
                {resultado.permissoes.same_sector ? '✅' : '⚠️'} Mesmo setor
              </p>
            </div>
          </Card>

          {/* PROBLEMAS ENCONTRADOS */}
          {resultado.razoes_visibilidade.length > 0 && (
            <Card className="p-4 border-red-200 bg-red-50">
              <h4 className="font-bold text-red-900 mb-3 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                ❌ Problemas Encontrados
              </h4>
              <div className="space-y-2">
                {resultado.razoes_visibilidade.map((razao, idx) => (
                  <p key={idx} className="text-sm text-red-700 p-2 bg-red-100 rounded border border-red-300">
                    {razao}
                  </p>
                ))}
              </div>
            </Card>
          )}

          {/* CONCLUSÃO */}
          <Card className={`p-4 ${
            resultado.razoes_visibilidade.length === 0
              ? 'border-blue-200 bg-blue-50'
              : 'border-red-200 bg-red-50'
          }`}>
            <div className="flex items-start gap-3">
              {resultado.razoes_visibilidade.length === 0 ? (
                <Eye className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
              ) : (
                <EyeOff className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
              )}
              <div>
                <p className={`font-bold ${
                  resultado.razoes_visibilidade.length === 0
                    ? 'text-blue-900'
                    : 'text-red-900'
                }`}>
                  {resultado.conclusao}
                </p>
                {resultado.razoes_visibilidade.length === 0 && (
                  <p className="text-sm text-blue-700 mt-1">
                    💡 Verifique se há filtros ativos na barra lateral (escopo, atendente, setor, integração)
                  </p>
                )}
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}