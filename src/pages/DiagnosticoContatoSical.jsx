import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, AlertTriangle } from 'lucide-react';

export default function DiagnosticoContatoSical() {
  const [resultado, setResultado] = useState(null);
  const [carregando, setCarregando] = useState(false);

  const executarDiagnostico = async () => {
    setCarregando(true);
    try {
      // 1. Buscar contatos com "sical" no nome/empresa
      const todosContatos = await base44.entities.Contact.list('-created_date', 500);
      const contatosSical = todosContatos.filter(c => 
        (c.nome || '').toLowerCase().includes('sical') ||
        (c.empresa || '').toLowerCase().includes('sical')
      );

      console.log('[DIAGNOSTICO] Contatos com "sical":', contatosSical);

      // 2. Para cada contato, buscar threads
      const analise = [];
      for (const contato of contatosSical) {
        const threads = await base44.entities.MessageThread.filter(
          { contact_id: contato.id },
          '-last_message_at',
          100
        );

        analise.push({
          contato,
          threads,
          tem_threads: threads.length > 0
        });
      }

      // 3. Buscar threads órfãs (sem contact_id mas com telefone similar)
      const todasThreads = await base44.entities.MessageThread.list('-last_message_at', 500);
      const threadsOrfas = todasThreads.filter(t => {
        if (t.contact_id) return false; // tem dono
        // Verificar se tem alguma mensagem relacionada a sical
        return false; // simplificado por ora
      });

      setResultado({
        contatosEncontrados: contatosSical.length,
        analise,
        threadsOrfas: threadsOrfas.length
      });

    } catch (error) {
      console.error('[DIAGNOSTICO] Erro:', error);
      alert(`Erro: ${error.message}`);
    } finally {
      setCarregando(false);
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <Card className="border-2 border-amber-300">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-orange-50">
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            🔬 Diagnóstico: Onde está o contato "Compras Sical"?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Button onClick={executarDiagnostico} disabled={carregando} className="w-full">
            {carregando ? 'Analisando...' : 'Executar Diagnóstico Completo'}
          </Button>

          {resultado && (
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-2">📊 Resumo</h3>
                <div className="space-y-1 text-sm">
                  <p>✅ <strong>{resultado.contatosEncontrados}</strong> contatos encontrados com "sical"</p>
                  <p>⚠️ <strong>{resultado.threadsOrfas}</strong> threads órfãs (sem contact_id)</p>
                </div>
              </div>

              {resultado.analise.map((item, idx) => (
                <Card key={idx} className="border-2 border-slate-300">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm flex items-center gap-2">
                      👤 {item.contato.nome}
                      {!item.tem_threads && (
                        <Badge className="bg-red-500">
                          <AlertTriangle className="w-3 h-3 mr-1" />
                          SEM THREADS
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-600 font-semibold">ID</p>
                        <p className="font-mono">{item.contato.id.substring(0, 12)}...</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-600 font-semibold">Telefone</p>
                        <p>{item.contato.telefone || '❌ Sem telefone'}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-600 font-semibold">Empresa</p>
                        <p>{item.contato.empresa || '—'}</p>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <p className="text-slate-600 font-semibold">Threads</p>
                        <Badge className={item.threads.length > 0 ? 'bg-green-600' : 'bg-red-600'}>
                          {item.threads.length}
                        </Badge>
                      </div>
                    </div>

                    {item.threads.length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-700">🧵 Threads deste contato:</p>
                        {item.threads.map((thread, ti) => (
                          <div key={ti} className="p-2 bg-white rounded border text-xs">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-slate-600">
                                {thread.id.substring(0, 8)}...
                              </span>
                              <Badge className="text-[10px]">{thread.status}</Badge>
                            </div>
                            <div className="grid grid-cols-3 gap-1 text-[10px] text-slate-600">
                              <div>
                                <span className="font-semibold">Atribuída:</span> {thread.assigned_user_id ? '✅' : '❌'}
                              </div>
                              <div>
                                <span className="font-semibold">Setor:</span> {thread.sector_id || '—'}
                              </div>
                              <div>
                                <span className="font-semibold">Não lidas:</span> {thread.unread_count || 0}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}