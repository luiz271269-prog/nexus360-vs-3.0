import React from "react";
import { CheckCheck, Clock, User, Users, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import { format } from "date-fns";

export default function ChatSidebar({ threads, threadAtiva, onSelecionarThread, loading, usuarioAtual, integracoes = [] }) {

  const formatarHorario = (timestamp) => {
    if (!timestamp) return "";
    try {
      const agora = new Date();
      const dataMsg = new Date(timestamp);

      if (agora.toDateString() === dataMsg.toDateString()) {
        return format(dataMsg, 'HH:mm');
      }

      const diffDias = Math.floor((agora - dataMsg) / (1000 * 60 * 60 * 24));
      if (diffDias < 7) {
        const diasSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
        return diasSemana[dataMsg.getDay()];
      }

      return format(dataMsg, 'dd/MM');
    } catch {
      return "";
    }
  };

  if (loading) {
    return (
      <div className="p-4">
        {Array(5).fill(0).map((_, i) => (
          <div key={i} className="animate-pulse flex gap-3 mb-4">
            <div className="w-12 h-12 bg-slate-200 rounded-full"></div>
            <div className="flex-1">
              <div className="h-4 bg-slate-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-slate-200 rounded w-1/2"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const threadsFiltradas = threads.filter(thread => {
    const contato = thread.contato;
    if (contato && contato.bloqueado) {
      return false;
    }
    return true;
  });

  const threadsSorted = threadsFiltradas.sort((a, b) => {
    const dateA = new Date(a.last_message_at || 0);
    const dateB = new Date(b.last_message_at || 0);
    return dateB - dateA;
  });

  // Função para buscar nome da integração
  const getIntegracaoNome = (thread) => {
    if (!thread.whatsapp_integration_id || integracoes.length === 0) return null;
    const integracao = integracoes.find(i => i.id === thread.whatsapp_integration_id);
    return integracao?.nome_instancia || null;
  };

  if (threadsSorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-center p-6">
        <Clock className="w-12 h-12 text-slate-300 mb-3" />
        <p className="font-semibold text-slate-600">Nenhuma conversa</p>
        <p className="text-sm text-slate-500 mt-1">
          Use a busca acima para iniciar
        </p>
      </div>
    );
  }

  const handleClick = (thread) => {
    console.log('🖱️ [ChatSidebar] Click na thread:', thread.id, thread.contato?.nome);
    
    // Validação antes de chamar onSelecionarThread
    if (!thread || !thread.id) {
      console.error('❌ [ChatSidebar] Thread inválida:', thread);
      return;
    }
    
    if (!thread.contact_id) {
      console.error('❌ [ChatSidebar] Thread sem contact_id:', thread);
      return;
    }
    
    // Chamar callback
    onSelecionarThread(thread);
  };

  return (
    <div>
      {threadsSorted.map((thread, index) => {
        const contato = thread.contato;
        const isAtiva = threadAtiva?.id === thread.id;
        const hasUnread = thread.unread_count > 0;
        const isAssignedToMe = thread.assigned_user_id === usuarioAtual?.id;
        const isUnassigned = !thread.assigned_user_id;

        if (!contato) {
          return (
            <motion.div
              key={thread.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              onClick={() => handleClick(thread)}
              className="flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-slate-100 hover:bg-slate-50"
            >
              <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md bg-gradient-to-br from-slate-400 to-slate-500">
                ?
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-slate-700">Contato Desconhecido</h3>
                <p className="text-sm text-slate-600">ID: {thread.contact_id}</p>
              </div>
            </motion.div>
          );
        }

        // Nome formatado: Empresa + Cargo + Nome
        let nomeExibicao = "";

        if (contato.empresa) nomeExibicao += contato.empresa;
        if (contato.cargo) nomeExibicao += (nomeExibicao ? " - " : "") + contato.cargo;
        if (contato.nome && contato.nome !== contato.telefone) nomeExibicao += (nomeExibicao ? " - " : "") + contato.nome;

        if (!nomeExibicao || nomeExibicao.trim() === '') {
          nomeExibicao = contato.telefone || "Sem Nome";
        }

        return (
          <motion.div
            key={thread.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
            onClick={() => handleClick(thread)}
            className={`flex items-center gap-3 p-4 cursor-pointer transition-all border-b border-slate-100 hover:bg-gradient-to-r hover:from-amber-50 hover:to-orange-50 ${
              isAtiva ? 'bg-gradient-to-r from-amber-50 via-orange-50 to-red-50 border-l-4 border-l-orange-500' : ''
            }`}
          >
            <div className={`relative w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-md flex-shrink-0 ${
              hasUnread 
                ? 'bg-gradient-to-br from-amber-400 via-orange-500 to-red-500' 
                : 'bg-gradient-to-br from-slate-400 to-slate-500'
            }`}>
              {nomeExibicao.charAt(0).toUpperCase()}
              
              {isUnassigned && (
                <div className="absolute -bottom-1 -right-1 bg-red-500 rounded-full p-1 border-2 border-white shadow-sm">
                  <AlertCircle className="w-3 h-3 text-white" />
                </div>
              )}
              {isAssignedToMe && (
                <div className="absolute -bottom-1 -right-1 bg-blue-500 rounded-full p-1 border-2 border-white shadow-sm">
                  <User className="w-3 h-3 text-white" />
                </div>
              )}
              {!isAssignedToMe && thread.assigned_user_id && (
                <div className="absolute -bottom-1 -right-1 bg-green-500 rounded-full p-1 border-2 border-white shadow-sm">
                  <Users className="w-3 h-3 text-white" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h3 className={`font-semibold truncate ${hasUnread ? 'text-slate-900' : 'text-slate-700'}`}>
                  {nomeExibicao}
                </h3>
                <span className={`text-xs flex-shrink-0 ml-2 ${
                  hasUnread ? 'text-orange-600 font-medium' : 'text-slate-500'
                }`}>
                  {formatarHorario(thread.last_message_at)}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <p className={`text-sm truncate flex-1 flex items-center gap-1.5 ${
                  hasUnread ? 'text-slate-900 font-medium' : 'text-slate-600'
                }`}>
                  {thread.last_message_sender === 'user' && (
                    <CheckCheck className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  )}
                  <span className="truncate">
                    {thread.last_message_content || "Nenhuma mensagem"}
                  </span>
                </p>

                {hasUnread && (
                  <Badge className="rounded-full min-w-[20px] h-5 flex items-center justify-center p-0 px-1.5 bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white ml-2 text-xs font-bold border-0 shadow-lg">
                    {thread.unread_count}
                  </Badge>
                )}
              </div>
              
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                {thread.assigned_user_name && (
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <User className="w-3 h-3 text-slate-400" />
                    {isAssignedToMe ? 'Atribuída a mim' : `${thread.assigned_user_name}`}
                  </p>
                )}
                {isUnassigned && (
                  <p className="text-xs text-red-500 flex items-center gap-1 font-medium">
                    <AlertCircle className="w-3 h-3 text-red-400" />
                    Não Atribuída
                  </p>
                )}
                {getIntegracaoNome(thread) && (
                  <Badge 
                    variant="outline" 
                    className="text-xs py-0 px-1.5 h-5 bg-green-50 text-green-700 border-green-200 cursor-help"
                    title={`Canal: ${integracoes.find(i => i.id === thread.whatsapp_integration_id)?.numero_telefone || 'N/A'}`}
                  >
                    📱 {getIntegracaoNome(thread)}
                  </Badge>
                )}
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}