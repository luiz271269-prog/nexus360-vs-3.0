import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { base44 } from '@/api/base44Client';
import { 
  Combine, AlertTriangle, CheckCircle2, Loader2, Phone, 
  MessageSquare, TrendingDown, User, Calendar 
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function GerenciadorConsolidacaoThreads() {
  const [duplicatas, setDuplicatas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [consolidando, setConsolidando] = useState(null);
  const [resultado, setResultado] = useState(null);

  useEffect(() => {
    analisarDuplicatas();
  }, []);

  const analisarDuplicatas = async () => {
    setCarregando(true);
    try {
      // Buscar todos os contatos
      const contatos = await base44.entities.Contact.list('', 500);
      const threads = await base44.entities.MessageThread.list('', 1000);

      // Agrupar contatos por telefone
      const porTelefone = {};
      contatos.forEach(c => {
        if (c.telefone) {
          const chave = c.telefone.replace(/\D/g, '');
          if (!porTelefone[chave]) porTelefone[chave] = [];
          porTelefone[chave].push(c);
        }
      });

      // Filtrar apenas duplicatas
      const dupsArray = Object.entries(porTelefone)
        .filter(([_, conts]) => conts.length > 1)
        .map(([telefone, conts]) => {
          // Encontrar threads para cada contato
          const threadsDoGrupo = threads.filter(t => 
            conts.some(c => c.id === t.contact_id)
          );

          // Agrupar mensagens por thread
          const threadStats = threadsDoGrupo.map(t => ({
            threadId: t.id,
            contactId: t.contact_id,
            contactNome: conts.find(c => c.id === t.contact_id)?.nome,
            unreadCount: t.unread_count || 0,
            totalMensagens: t.total_mensagens || 0,
            lastMessageAt: t.last_message_at,
            assigned: t.assigned_user_id,
            inbound: t.last_inbound_at,
            outbound: t.last_outbound_at
          }));

          return {
            telefone,
            contatos: conts.map(c => ({ id: c.id, nome: c.nome })),
            threads: threadStats,
            totalContatos: conts.length,
            totalThreads: threadsDoGrupo.length,
            totalMensagens: threadStats.reduce((s, t) => s + t.totalMensagens, 0)
          };
        });

      setDuplicatas(dupsArray);
    } catch (error) {
      console.error('Erro ao analisar duplicatas:', error);
    } finally {
      setCarregando(false);
    }
  };

  const consolidarThreads = async (grupo) => {
    setConsolidando(grupo.telefone);
    try {
      const { threads } = grupo;
      if (threads.length < 2) return;

      // Thread principal = a com mais mensagens
      const threadPrincipal = threads.sort((a, b) => 
        (b.totalMensagens || 0) - (a.totalMensagens || 0)
      )[0];

      const threadsSecundarias = threads.filter(t => t.threadId !== threadPrincipal.threadId);

      // Consolidar: mover mensagens
      for (const threadSec of threadsSecundarias) {
        const mensagens = await base44.entities.Message.filter(
          { thread_id: threadSec.threadId },
          '-sent_at',
          1000
        );

        // Atualizar thread_id de cada mensagem
        for (const msg of mensagens) {
          await base44.entities.Message.update(msg.id, {
            thread_id: threadPrincipal.threadId
          });
        }

        // Deletar thread secundária (se possível)
        try {
          await base44.entities.MessageThread.delete(threadSec.threadId);
        } catch (e) {
          console.warn(`Não foi possível deletar thread ${threadSec.threadId}`);
        }
      }

      setResultado({
        sucesso: true,
        threadPrincipal: threadPrincipal.threadId,
        threadsConsolidadas: threadsSecundarias.length,
        mensagensMovidas: threadsSecundarias.reduce((s, t) => s + t.totalMensagens, 0)
      });

      // Recarregar análise
      setTimeout(() => {
        analisarDuplicatas();
        setResultado(null);
      }, 2000);
    } catch (error) {
      console.error('Erro ao consolidar:', error);
      setResultado({ sucesso: false, erro: error.message });
    } finally {
      setConsolidando(null);
    }
  };

  if (carregando) {
    return (
      <Card className="border-yellow-200 bg-yellow-50">
        <CardContent className="pt-6 flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Analisando contatos duplicados...
        </CardContent>
      </Card>
    );
  }

  if (duplicatas.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="pt-6 flex items-center gap-2 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          ✅ Nenhum contato duplicado detectado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-2 border-orange-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Combine className="w-5 h-5 text-orange-600" />
            Consolidador de Threads Duplicadas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert className="bg-orange-50 border-orange-200">
            <AlertTriangle className="w-4 h-4 text-orange-600" />
            <AlertDescription className="text-orange-800">
              {duplicatas.length} grupo(s) de contatos duplicados detectado(s) com fragmentação de mensagens
            </AlertDescription>
          </Alert>

          {duplicatas.map((grupo) => (
            <div key={grupo.telefone} className="border rounded-lg p-4 bg-slate-50 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Phone className="w-4 h-4 text-slate-500" />
                    <span className="font-mono font-bold text-lg">{grupo.telefone}</span>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p>📋 {grupo.totalContatos} contatos | 💬 {grupo.totalThreads} threads | ✉️ {grupo.totalMensagens} msgs</p>
                  </div>
                </div>
                <Button
                  onClick={() => consolidarThreads(grupo)}
                  disabled={consolidando === grupo.telefone || resultado?.sucesso}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {consolidando === grupo.telefone ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Consolidando...
                    </>
                  ) : (
                    <>
                      <Combine className="w-4 h-4 mr-2" />
                      Consolidar Agora
                    </>
                  )}
                </Button>
              </div>

              {/* Contatos */}
              <div className="ml-6 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Contatos Duplicados:</p>
                <div className="space-y-1">
                  {grupo.contatos.map((c) => (
                    <Badge key={c.id} variant="secondary" className="block w-fit text-xs">
                      <User className="w-3 h-3 mr-1" /> {c.nome} ({c.id.substring(0, 8)})
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Threads */}
              <div className="ml-6 space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase">Threads com Fragmentação:</p>
                <div className="grid gap-2">
                  {grupo.threads.map((t, idx) => (
                    <div key={t.threadId} className="bg-white p-2 rounded border border-slate-200 text-xs">
                      <div className="flex justify-between items-start mb-1">
                        <Badge variant="outline">{idx + 1}</Badge>
                        <span className="font-mono text-slate-500">{t.threadId.substring(0, 8)}...</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-slate-600">
                        <span>📥 Recebidas: {t.inbound ? 'Sim' : 'Não'}</span>
                        <span>📤 Enviadas: {t.outbound ? 'Sim' : 'Não'}</span>
                        <span>💬 Total: {t.totalMensagens}</span>
                        <span>👤 Atrib: {t.assigned ? 'Sim' : 'Não'}</span>
                      </div>
                      {t.lastMessageAt && (
                        <p className="text-slate-500 mt-1">
                          Último: {format(new Date(t.lastMessageAt), 'dd/MM HH:mm', { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {resultado?.sucesso && (
                <Alert className="bg-green-50 border-green-200 ml-6">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    ✅ Consolidadas {resultado.threadsConsolidadas} threads | {resultado.mensagensMovidas} mensagens unificadas
                  </AlertDescription>
                </Alert>
              )}

              {resultado?.erro && (
                <Alert className="bg-red-50 border-red-200 ml-6">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                  <AlertDescription className="text-red-800">
                    ❌ Erro: {resultado.erro}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          ))}

          <Button 
            onClick={analisarDuplicatas} 
            variant="outline" 
            className="w-full"
          >
            🔄 Reanalizar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}