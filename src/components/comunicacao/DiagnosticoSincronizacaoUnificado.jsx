import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle, CheckCircle2, Wrench } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';
import SincronizadorMensagensOrfas from './SincronizadorMensagensOrfas';

export default function DiagnosticoSincronizacaoUnificado({ contact, usuario, onUpdate }) {
  const [loading, setLoading] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const [loadingCorrecao, setLoadingCorrecao] = React.useState(false);
  const [relatorioCorrecao, setRelatorioCorrecao] = React.useState(null);
  const navigate = useNavigate();

  const handleSincronizar = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('sincronizarContactoErros', {
        contact_id: contact.id,
        corrigir: true
      });

      console.log('[DiagnosticoSincronizacao] Resposta:', res);

      if (res?.data?.erros_encontrados > 0) {
        const detalhes = res.data.erros
          ?.map(e => `• ${e.descricao}`)
          ?.join('\n') || '';
        const corrigidosTexto = res.data.corrigidos?.length > 0 
          ? `\n\n✅ Corrigidos:\n${res.data.corrigidos.map(c => `• ${c}`).join('\n')}`
          : '';
        
        setResultado({
          tipo: res.data.corrigidos?.length > 0 ? 'success' : 'warning',
          mensagem: `${res.data.corrigidos?.length > 0 ? '✅ Sincronizado!' : '⚠️ Verificado'}\n\n📋 Erros encontrados: ${res.data.erros_encontrados}\n${detalhes}${corrigidosTexto}`
        });
        
        toast.success(`✅ ${res.data.corrigidos?.length > 0 ? 'Contato corrigido!' : 'Verificação concluída'}`);
      } else {
        setResultado({
          tipo: 'success',
          mensagem: '✅ Contato sincronizado com sucesso! Nenhum erro encontrado.'
        });
        toast.success('✅ Contato sincronizado sem erros!');
      }
      if (onUpdate) await onUpdate();
    } catch (error) {
      console.error('[DiagnosticoSincronizacao] Erro:', error);
      setResultado({
        tipo: 'error',
        mensagem: `❌ Erro: ${error?.message || 'Falha desconhecida'}`
      });
      toast.error(`❌ Erro: ${error?.message || 'Falha desconhecida'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDiagnostico = () => {
    const url = createPageUrl('DiagnosticoContato') + `?telefone=${encodeURIComponent(contact.telefone)}`;
    navigate(url);
  };

  const handleRemoverBloqueios = () => {
    const url = createPageUrl('DiagnosticoBloqueios') + `?telefone=${encodeURIComponent(contact.telefone)}`;
    navigate(url);
  };

  const handleCorrecaoCompleta = async (modoExec) => {
    setLoadingCorrecao(true);
    try {
      // PASSO 1: Corrigir vinculação de threads/mensagens de duplicados
      const res = await base44.functions.invoke('corrigirVinculacaoThreadContato', {
        contact_id: contact.id,
        modo: modoExec
      });

      console.log('[CorrecaoCompleta] Vinculação:', res?.data);

      if (modoExec === 'diagnostico') {
        setRelatorioCorrecao(res?.data);
        const dups = res?.data?.duplicados_encontrados?.length || 0;
        const threads = res?.data?.threads_para_mover?.length || 0;
        if (dups > 0 || threads > 0) {
          toast.warning(`⚠️ ${dups} duplicado(s), ${threads} thread(s) a mover`);
        } else {
          toast.success('✅ Nenhum problema de vinculação encontrado');
        }
      } else {
        // PASSO 2: Aplicar correção completa do contato (scores, segmento, mensagens órfãs)
        const resSync = await base44.functions.invoke('sincronizarContactoErros', {
          contact_id: contact.id,
          corrigir: true
        });
        console.log('[CorrecaoCompleta] Sincronização:', resSync?.data);

        // PASSO 3: Migrar mensagens órfãs presas em threads merged
        const resOrfas = await base44.functions.invoke('sincronizarMensagensOrfas', {
          contact_id: contact.id,
          modo: 'correcao'
        });
        console.log('[CorrecaoCompleta] Órfãs:', resOrfas?.data);

        const corrigidos = res?.data?.corrigidos || [];
        const syncCorrigidos = resSync?.data?.corrigidos || [];
        const totalMsgsMigradas = resOrfas?.data?.mensagens_revinculadas || 0;
        const totalAjustes = corrigidos.length + syncCorrigidos.length + (totalMsgsMigradas > 0 ? 1 : 0);

        toast.success(`✅ Correção completa! ${totalAjustes} ajuste(s). Msgs migradas: ${totalMsgsMigradas}`);
        setRelatorioCorrecao(null);
        if (onUpdate) await onUpdate();
      }
    } catch (error) {
      console.error('[CorrecaoCompleta] Erro:', error);
      toast.error(`❌ ${error?.message}`);
    } finally {
      setLoadingCorrecao(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      {/* Resultado anterior */}
      {resultado && (
        <Alert className={`p-3 ${
          resultado.tipo === 'success' ? 'bg-green-50 border-green-200' :
          resultado.tipo === 'warning' ? 'bg-yellow-50 border-yellow-200' :
          'bg-red-50 border-red-200'
        }`}>
          <div className="flex items-start gap-2">
            {resultado.tipo === 'success' && <CheckCircle2 className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />}
            {resultado.tipo === 'warning' && <AlertCircle className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />}
            {resultado.tipo === 'error' && <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />}
            <p className={`text-sm ${
              resultado.tipo === 'success' ? 'text-green-700' :
              resultado.tipo === 'warning' ? 'text-yellow-700' :
              'text-red-700'
            }`}>
              {resultado.mensagem}
            </p>
          </div>
        </Alert>
      )}

      {/* Botão Sincronizar */}
      <Button
        onClick={handleSincronizar}
        disabled={loading}
        className="w-full bg-amber-600 hover:bg-amber-700 text-white"
      >
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}
        Verificar & Sincronizar Contato
      </Button>

      {/* Admin: Diagnóstico Completo */}
      {usuario?.role === 'admin' && (
        <>
          <Button
            onClick={handleDiagnostico}
            variant="outline"
            className="w-full text-indigo-600 hover:bg-indigo-50"
          >
            🔬 Diagnóstico Completo (Admin)
          </Button>

          {/* Admin: Remover Bloqueios */}
          <Button
            onClick={handleRemoverBloqueios}
            variant="outline"
            className="w-full text-red-600 hover:bg-red-50"
          >
            🔓 Remover Bloqueios (Admin)
          </Button>

          {/* NOVO: Correção Cirúrgica de Vinculação */}
          <div className="border-t pt-3">
            <p className="text-xs text-slate-500 font-semibold mb-2">🔧 Correção Cirúrgica de Vinculação</p>

            {relatorioCorrecao && (
              <Alert className="p-3 mb-2 bg-orange-50 border-orange-200">
                <div className="text-xs text-orange-800 space-y-1">
                  <p className="font-semibold">📋 Pré-diagnóstico:</p>
                  <p>• Duplicados: {relatorioCorrecao.duplicados_encontrados?.length || 0}</p>
                  <p>• Threads a mover: {relatorioCorrecao.threads_para_mover?.length || 0}</p>
                  <p>• Mensagens a corrigir: {relatorioCorrecao.mensagens_para_revinular || 0}</p>
                  {relatorioCorrecao.contato_principal?.needs_canonico_update && (
                    <p className="text-red-700">• telefone_canonico precisa atualizar!</p>
                  )}
                  {relatorioCorrecao.duplicados_encontrados?.map((d, i) => (
                    <p key={i} className="text-slate-600 ml-2">↳ Dup: {d.nome || '(sem nome)'} — {d.telefone}</p>
                  ))}
                </div>
              </Alert>
            )}

            <div className="flex gap-2">
              <Button
                onClick={() => handleCorrecaoCompleta('diagnostico')}
                disabled={loadingCorrecao}
                variant="outline"
                className="flex-1 text-orange-600 border-orange-300 hover:bg-orange-50 text-xs"
              >
                {loadingCorrecao ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wrench className="w-3 h-3 mr-1" />}
                Analisar
              </Button>
              <Button
                onClick={() => handleCorrecaoCompleta('correcao')}
                disabled={loadingCorrecao}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-xs"
              >
                {loadingCorrecao ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Wrench className="w-3 h-3 mr-1" />}
                Corrigir Tudo
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Sincronizador de Mensagens Órfãs */}
      <div className="border-t pt-4 mt-4">
        <p className="text-xs text-slate-600 font-semibold mb-3">🔗 Sincronizar Mensagens Órfãs</p>
        <SincronizadorMensagensOrfas 
          threadId={contact?.id}
          contactId={contact?.id}
        />
      </div>

      {/* Info */}
      <p className="text-xs text-slate-500 text-center mt-3">
        Use esta aba para diagnosticar e sincronizar dados do contato
      </p>
    </div>
  );
}