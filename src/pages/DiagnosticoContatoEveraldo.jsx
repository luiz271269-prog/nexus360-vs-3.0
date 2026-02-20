import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoContatoEveraldo() {
  const [diagnostico, setDiagnostico] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const executarDiagnostico = async () => {
    setCarregando(true);
    try {
      const resultados = {};

      // 1. Buscar contato
      const contatos = await base44.entities.Contact.filter({ 
        telefone: '5548984043411' 
      });
      resultados.contato = contatos[0] || null;

      // 2. Buscar threads do contato
      if (resultados.contato) {
        const threads = await base44.entities.MessageThread.filter({
          contact_id: resultados.contato.id
        });
        resultados.threads = threads;
        resultados.threadCanonica = threads.find(t => t.is_canonical);
      }

      // 3. Buscar thread específica dos logs
      const threadEspecifica = await base44.entities.MessageThread.list();
      resultados.threadPorId = threadEspecifica.find(
        t => t.id === '692d938e25f7e6bfa7f9a9d2'
      );

      // 4. Contar mensagens
      if (resultados.threadCanonica) {
        const msgs = await base44.entities.Message.filter({
          thread_id: resultados.threadCanonica.id
        });
        resultados.mensagensTotal = msgs.length;
        resultados.ultimaMensagem = msgs[msgs.length - 1];
      }

      setDiagnostico(resultados);
    } catch (error) {
      toast.error(`❌ Erro: ${error.message}`);
      console.error(error);
    } finally {
      setCarregando(false);
    }
  };

  const corrigirVisibilidade = async () => {
    setCarregando(true);
    try {
      if (diagnostico.threadCanonica?.status === 'merged') {
        // Reabrir thread
        await base44.entities.MessageThread.update(
          diagnostico.threadCanonica.id,
          { status: 'aberta' }
        );
        toast.success('✅ Thread reabertu');
        executarDiagnostico();
      }
    } catch (error) {
      toast.error(`❌ ${error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Diagnóstico: Everaldo Fabris
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={executarDiagnostico} disabled={carregando}>
            {carregando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Executar Diagnóstico
          </Button>

          {diagnostico && (
            <div className="space-y-4 mt-4">
              {/* Contato */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">1. Contato</h3>
                {diagnostico.contato ? (
                  <div className="space-y-1 text-sm">
                    <p>✅ <strong>ID:</strong> {diagnostico.contato.id}</p>
                    <p>📱 <strong>Telefone:</strong> {diagnostico.contato.telefone}</p>
                    <p>👤 <strong>Nome:</strong> {diagnostico.contato.nome}</p>
                    <p>🏢 <strong>Empresa:</strong> {diagnostico.contato.empresa}</p>
                  </div>
                ) : (
                  <p className="text-red-600">❌ Contato não encontrado</p>
                )}
              </div>

              {/* Threads */}
              <div className="border rounded-lg p-4">
                <h3 className="font-semibold mb-2">2. Threads ({diagnostico.threads?.length || 0})</h3>
                {diagnostico.threads?.map(t => (
                  <div key={t.id} className="text-sm mb-2 p-2 bg-slate-50 rounded">
                    <p><strong>ID:</strong> {t.id.substring(0, 12)}...</p>
                    <p><strong>Status:</strong> <Badge>{t.status}</Badge></p>
                    <p><strong>Canônica:</strong> {t.is_canonical ? '✅' : '❌'}</p>
                    {t.status === 'merged' && (
                      <p className="text-amber-600">⚠️ Thread merged para: {t.merged_into}</p>
                    )}
                  </div>
                ))}
              </div>

              {/* Mensagens */}
              {diagnostico.mensagensTotal && (
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-2">3. Mensagens</h3>
                  <p>Total: <strong>{diagnostico.mensagensTotal}</strong></p>
                  <p className="text-sm text-slate-600 mt-1">
                    Última: {new Date(diagnostico.ultimaMensagem?.sent_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}

              {/* Ações */}
              {diagnostico.threadCanonica?.status === 'merged' && (
                <Button 
                  onClick={corrigirVisibilidade}
                  className="w-full bg-amber-500 hover:bg-amber-600"
                  disabled={carregando}
                >
                  🔧 Corrigir: Reabrir Thread Merged
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}