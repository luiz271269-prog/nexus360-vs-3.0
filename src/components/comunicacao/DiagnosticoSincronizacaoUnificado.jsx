import React from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Loader2, Zap, AlertCircle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { createPageUrl } from '@/utils';
import { useNavigate } from 'react-router-dom';
import { Alert } from '@/components/ui/alert';

export default function DiagnosticoSincronizacaoUnificado({ contact, usuario, onUpdate }) {
  const [loading, setLoading] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const navigate = useNavigate();

  const handleSincronizar = async () => {
    setLoading(true);
    try {
      const res = await base44.functions.invoke('sincronizarContactoErros', {
        contact_id: contact.id,
        corrigir: false
      });

      if (res?.data?.erros_encontrados > 0) {
        const errosTexto = res.data.erros?.map(e => e.tipo)?.join(', ') || 'desconhecidos';
        setResultado({
          tipo: 'warning',
          mensagem: `⚠️ ${res.data.erros_encontrados} erro(s): ${errosTexto}`
        });
        toast.warning(`⚠️ ${res.data.erros_encontrados} erro(s): ${errosTexto}`);
      } else {
        setResultado({
          tipo: 'success',
          mensagem: '✅ Contato sincronizado com sucesso!'
        });
        toast.success('✅ Contato sincronizado com sucesso!');
      }
      if (onUpdate) await onUpdate();
    } catch (error) {
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
        </>
      )}

      {/* Info */}
      <p className="text-xs text-slate-500 text-center mt-3">
        Use esta aba para diagnosticar e sincronizar dados do contato
      </p>
    </div>
  );
}