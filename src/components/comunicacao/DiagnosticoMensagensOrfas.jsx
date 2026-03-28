import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, AlertCircle, Download, RefreshCw, Copy } from 'lucide-react';
import { toast } from 'sonner';

export default function DiagnosticoMensagensOrfas() {
  const [loading, setLoading] = useState(false);
  const [mensagensOrfas, setMensagensOrfas] = useState([]);
  const [contatosMapeados, setContatosMapeados] = useState({});
  const [expandido, setExpandido] = useState({});

  const buscarMensagensOrfas = async () => {
    setLoading(true);
    try {
      // Buscar TODAS as mensagens
      const todasMensagens = await base44.entities.Message.list('-sent_at', 5000);
      
      // Buscar TODOS os contatos
      const todosContatos = await base44.entities.Contact.list('-created_date', 5000);
      
      // Buscar TODAS as threads
      const todasThreads = await base44.entities.MessageThread.list('-created_date', 5000);

      // Criar mapa de contact_ids das threads
      const contactIdsEmThreads = new Set(
        todasThreads
          .filter(t => t.contact_id)
          .map(t => t.contact_id)
      );

      // Filtrar mensagens órfãs (contatos sem threads visíveis)
      const mensagensPorContato = {};
      const contatosOrfaos = new Set();

      todasMensagens.forEach(msg => {
        if (msg.sender_type === 'contact' && msg.sender_id) {
          if (!contactIdsEmThreads.has(msg.sender_id)) {
            contatosOrfaos.add(msg.sender_id);
            if (!mensagensPorContato[msg.sender_id]) {
              mensagensPorContato[msg.sender_id] = [];
            }
            mensagensPorContato[msg.sender_id].push(msg);
          }
        }
      });

      // Enriquecer com dados do contato
      const mapeamento = {};
      contatosOrfaos.forEach(contactId => {
        const contato = todosContatos.find(c => c.id === contactId);
        mapeamento[contactId] = contato || { id: contactId, nome: 'Desconhecido' };
      });

      setContatosMapeados(mapeamento);

      const resultado = Object.entries(mensagensPorContato).map(([contactId, msgs]) => ({
        contactId,
        contato: mapeamento[contactId],
        mensagens: msgs.sort((a, b) => new Date(b.sent_at) - new Date(a.sent_at)),
        totalMensagens: msgs.length
      }));

      setMensagensOrfas(resultado.sort((a, b) => b.totalMensagens - a.totalMensagens));
      toast.success(`${resultado.length} contato(s) com mensagens não sincronizadas`);
    } catch (error) {
      console.error('Erro ao buscar mensagens órfãs:', error);
      toast.error('Erro ao buscar dados: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const exportarDados = () => {
    try {
      const dados = mensagensOrfas.map(grupo => ({
        contato: grupo.contato,
        totalMensagens: grupo.totalMensagens,
        primeiraMsg: grupo.mensagens[grupo.mensagens.length - 1]?.sent_at,
        ultimaMsg: grupo.mensagens[0]?.sent_at,
        mensagens: grupo.mensagens.map(m => ({
          id: m.id,
          content: m.content,
          sentAt: m.sent_at,
          mediaType: m.media_type,
          status: m.status
        }))
      }));

      const json = JSON.stringify(dados, null, 2);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mensagens-orfas-${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Arquivo exportado');
    } catch (error) {
      toast.error('Erro ao exportar: ' + error.message);
    }
  };

  const copiarParaClipboard = (texto) => {
    navigator.clipboard.writeText(texto);
    toast.success('Copiado para clipboard');
  };

  return (
    <Card className="p-6 bg-white border-l-4 border-orange-500">
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h3 className="font-bold text-lg text-slate-900 mb-1">
              Diagnóstico: Mensagens Não Sincronizadas
            </h3>
            <p className="text-sm text-slate-600">
              Identifica contatos com histórico de mensagens mas sem threads visíveis na Central
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            onClick={buscarMensagensOrfas}
            disabled={loading}
            className="bg-orange-500 hover:bg-orange-600 text-white"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                Buscando...
              </>
            ) : (
              <>
                <MessageSquare className="w-4 h-4 mr-2" />
                Diagnosticar
              </>
            )}
          </Button>

          {mensagensOrfas.length > 0 && (
            <Button
              onClick={exportarDados}
              variant="outline"
              className="text-blue-600 border-blue-300"
            >
              <Download className="w-4 h-4 mr-2" />
              Exportar JSON
            </Button>
          )}
        </div>

        {mensagensOrfas.length > 0 && (
          <div className="space-y-3 max-h-[600px] overflow-y-auto border border-slate-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-slate-500 uppercase">
              {mensagensOrfas.length} contato(s) com histórico não sincronizado
            </p>

            {mensagensOrfas.map(grupo => (
              <div
                key={grupo.contactId}
                className="border border-slate-300 rounded-lg p-3 bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                {/* Header do grupo */}
                <button
                  onClick={() =>
                    setExpandido(prev => ({
                      ...prev,
                      [grupo.contactId]: !prev[grupo.contactId]
                    }))
                  }
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-slate-900 truncate">
                      📞 {grupo.contato?.nome || grupo.contactId}
                    </div>
                    <div className="text-xs text-slate-500 mt-1">
                      {grupo.contato?.telefone && (
                        <>Telefone: {grupo.contato.telefone}</>
                      )}
                      {grupo.contato?.email && (
                        <> | Email: {grupo.contato.email}</>
                      )}
                    </div>
                  </div>
                  <Badge className="bg-orange-100 text-orange-800 whitespace-nowrap ml-2">
                    {grupo.totalMensagens} msgs
                  </Badge>
                </button>

                {/* Conteúdo expandido */}
                {expandido[grupo.contactId] && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-2 text-xs">
                    {grupo.mensagens.slice(0, 10).map(msg => (
                      <div
                        key={msg.id}
                        className="bg-white p-2 rounded border-l-2 border-blue-300"
                      >
                        <div className="flex items-start justify-between gap-2 mb-1">
                          <span className="text-slate-500">
                            {new Date(msg.sent_at).toLocaleString('pt-BR')}
                          </span>
                          <button
                            onClick={() => copiarParaClipboard(msg.content || '')}
                            className="text-blue-500 hover:text-blue-700"
                            title="Copiar mensagem"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-slate-700 whitespace-pre-wrap break-words">
                          {msg.content?.substring(0, 200)}
                          {msg.content && msg.content.length > 200 ? '...' : ''}
                        </p>
                        {msg.media_type !== 'none' && (
                          <span className="text-purple-600 text-[10px] mt-1 block">
                            [📎 {msg.media_type.toUpperCase()}]
                          </span>
                        )}
                      </div>
                    ))}

                    {grupo.mensagens.length > 10 && (
                      <div className="text-slate-500 py-2 text-center">
                        ... {grupo.mensagens.length - 10} mensagens a mais
                      </div>
                    )}

                    {/* Botão para criar thread */}
                    <Button
                      size="sm"
                      className="w-full mt-2 bg-green-500 hover:bg-green-600 text-white text-xs"
                      onClick={async () => {
                        try {
                          const novaThread = await base44.entities.MessageThread.create({
                            contact_id: grupo.contactId,
                            thread_type: 'contact_external',
                            channel: 'whatsapp',
                            is_canonical: true,
                            status: 'aberta',
                            assigned_user_id: null
                          });
                          toast.success('Thread criada para este contato');
                          // Recarregar diagnóstico
                          buscarMensagensOrfas();
                        } catch (error) {
                          toast.error('Erro ao criar thread: ' + error.message);
                        }
                      }}
                    >
                      ✅ Criar Thread para este Contato
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {!loading && mensagensOrfas.length === 0 && (
          <div className="text-center py-8 text-slate-500">
            <p className="text-sm">Clique em "Diagnosticar" para buscar mensagens não sincronizadas</p>
          </div>
        )}
      </div>
    </Card>
  );
}