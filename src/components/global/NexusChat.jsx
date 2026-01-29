import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Sparkles,
  X,
  Send,
  Bot,
  User,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
import { toast } from 'sonner';

import { AnimatePresence, motion } from 'framer-motion';

export default function NexusChat({ isOpen, onToggle }) {
  const [mensagens, setMensagens] = useState([]);
  const [inputMensagem, setInputMensagem] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [usuario, setUsuario] = useState(null);
  const [erro, setErro] = useState(null);
  const messagesEndRef = useRef(null);

  // ✅ ADICIONAR PROTEÇÃO DE RATE LIMIT
  const [ultimaConsulta, setUltimaConsulta] = useState(0);
  const MIN_INTERVALO = 2000; // 2 segundos entre mensagens

  useEffect(() => {
    if (isOpen) {
      inicializar();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const inicializar = async () => {
    try {
      const user = await base44.auth.me();
      setUsuario(user);

      if (mensagens.length === 0) {
        adicionarMensagemSistema(
          `Olá, ${user.full_name}! 👋\n\n` +
          `Sou o **Nexus**, seu assistente inteligente completo do VendaPro.\n\n` +
          `**🎯 Minhas Capacidades:**\n` +
          `• 📊 Análise de dados reais (clientes, vendas, orçamentos, conversas)\n` +
          `• 💡 Sugestões inteligentes baseadas no contexto do seu negócio\n` +
          `• 🔍 Busca avançada em toda a base de dados\n` +
          `• 📈 Insights de performance e oportunidades\n` +
          `• 🚨 Alertas proativos sobre problemas e urgências\n` +
          `• 🎓 Orientação sobre funcionalidades do sistema\n` +
          `• 🔧 Diagnóstico e solução de erros técnicos\n` +
          `• 💬 Gestão de comunicação e threads\n` +
          `• 🌐 Pesquisas externas na internet (notícias, dados atualizados, etc)\n\n` +
          `**💡 Exemplos do que posso fazer:**\n` +
          `"Quais clientes não foram contatados esta semana?"\n` +
          `"Analise meu desempenho de vendas"\n` +
          `"Por que esta thread não aparece?"\n` +
          `"Sugira ações para orçamentos parados"\n` +
          `"Encontre conversas urgentes não atribuídas"\n\n` +
          `Tenho acesso completo aos dados do sistema. Como posso ajudar?`
        );
      }
    } catch (error) {
      console.error('Erro ao inicializar Nexus:', error);
      setErro('Erro ao conectar com o sistema. Verifique sua conexão.');
      toast.error('Erro ao inicializar Nexus');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const adicionarMensagemSistema = (conteudo) => {
    const novaMensagemSistema = {
      id: Date.now(),
      role: 'assistant',
      content: conteudo,
      timestamp: new Date().toISOString()
    };
    setMensagens(prev => [...prev, novaMensagemSistema]);
  };

  const handleEnviarMensagem = async (e) => {
    e.preventDefault();

    if (!inputMensagem.trim() || enviando) return;

    // ✅ PROTEÇÃO: Rate limit local
    const agora = Date.now();
    const tempoDecorrido = agora - ultimaConsulta;

    if (tempoDecorrido < MIN_INTERVALO) {
      toast.warning('⏳ Aguarde alguns segundos antes de enviar outra mensagem');
      return;
    }

    const mensagemUsuario = inputMensagem.trim();
    setInputMensagem('');
    setEnviando(true);
    setUltimaConsulta(agora);
    setErro(null);

    const novaMensagem = {
      id: Date.now(),
      role: 'user',
      content: mensagemUsuario,
      timestamp: new Date().toISOString()
    };

    setMensagens(prev => [...prev, novaMensagem]);

    try {
      // ✅ TIMEOUT: 30 segundos para permitir análises complexas
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 30000);
      });

      // 🔍 BUSCAR CONTEXTO COMPLETO DO SISTEMA
      const [
        clientesRecentes,
        vendasRecentes,
        orcamentosRecentes,
        threadsRecentes,
        vendedores,
        produtos,
        integracoes
      ] = await Promise.all([
        base44.entities.Cliente.list('-updated_date', 10).catch(() => []),
        base44.entities.Venda.list('-data_venda', 10).catch(() => []),
        base44.entities.Orcamento.list('-updated_date', 10).catch(() => []),
        base44.entities.MessageThread.list('-last_message_at', 20).catch(() => []),
        base44.entities.Vendedor.list().catch(() => []),
        base44.entities.Produto.list('nome', 50).catch(() => []),
        base44.entities.WhatsAppIntegration.list().catch(() => [])
      ]);

      // 📊 CALCULAR ESTATÍSTICAS
      const totalClientes = clientesRecentes.length;
      const totalVendas = vendasRecentes.length;
      const orcamentosPendentes = orcamentosRecentes.filter(o => o.status === 'enviado' || o.status === 'negociando').length;
      const threadsNaoAtribuidas = threadsRecentes.filter(t => !t.assigned_user_id && t.thread_type === 'contact_external').length;
      const threadsComNaoLidas = threadsRecentes.filter(t => (t.unread_count || 0) > 0).length;

      // 🔐 CONTEXTO DO USUÁRIO
      const perfilUsuario = `
**PERFIL DO USUÁRIO:**
- Nome: ${usuario.full_name}
- Email: ${usuario.email}
- Cargo/Função: ${usuario.role === 'admin' ? 'Administrador' : 'Usuário'}
- Setor: ${usuario.attendant_sector || 'Não definido'}
- Nível: ${usuario.attendant_role || 'Não definido'}
`;

      // 📋 CONTEXTO DO SISTEMA
      const contextoSistema = `
**VISÃO GERAL DO SISTEMA (Últimas atualizações):**
- 👥 Clientes recentes: ${totalClientes}
- 💰 Vendas recentes: ${totalVendas}
- 📄 Orçamentos pendentes: ${orcamentosPendentes}
- 💬 Conversas não atribuídas: ${threadsNaoAtribuidas}
- 🔔 Conversas com mensagens não lidas: ${threadsComNaoLidas}
- 👨‍💼 Vendedores ativos: ${vendedores.filter(v => v.status === 'ativo').length}
- 📦 Produtos cadastrados: ${produtos.length}
- 📱 Integrações WhatsApp: ${integracoes.filter(i => i.status === 'conectado').length} conectadas

**CLIENTES RECENTES (últimos 10):**
${clientesRecentes.map((c, i) => `${i+1}. ${c.razao_social || c.nome_fantasia} - Status: ${c.status} - Vendedor: ${c.vendedor_id || 'Não atribuído'}`).join('\n')}

**ORÇAMENTOS RECENTES (últimos 10):**
${orcamentosRecentes.map((o, i) => `${i+1}. #${o.numero_orcamento || 'S/N'} - ${o.cliente_nome} - R$ ${o.valor_total?.toFixed(2) || '0.00'} - Status: ${o.status}`).join('\n')}

**CONVERSAS ATIVAS (últimas 20):**
${threadsRecentes.map((t, i) => {
  const unread = t.unread_count || 0;
  const tipo = t.thread_type === 'team_internal' ? '[INTERNA]' : t.thread_type === 'sector_group' ? '[SETOR]' : '[CLIENTE]';
  const atendente = t.assigned_user_id || 'Não atribuído';
  return `${i+1}. ${tipo} ${t.id.substring(0, 8)}... - ${unread} não lidas - Atendente: ${atendente}`;
}).join('\n')}
`;

      // Contexto das últimas mensagens
      const contextoConversa = mensagens
        .slice(-8)
        .map(m => `${m.role}: ${m.content}`)
        .join('\n');

      const consultaPromise = base44.integrations.Core.InvokeLLM({
        prompt: `Você é o **Nexus**, o assistente inteligente do **VendaPro** - um sistema completo de gestão de vendas e comunicação omnichannel.

${perfilUsuario}

${contextoSistema}

**HISTÓRICO DA CONVERSA:**
${contextoConversa}

**NOVA PERGUNTA DO USUÁRIO:**
${mensagemUsuario}

**SUAS CAPACIDADES:**
1. 📊 **Análise de Dados**: Analise clientes, vendas, orçamentos e identifique padrões
2. 💡 **Sugestões Inteligentes**: Sugira ações baseadas no contexto (ex: "Cliente X está sem contato há 10 dias - sugiro follow-up")
3. 🔍 **Busca e Filtros**: Ajude a encontrar informações específicas nos dados
4. 📈 **Insights de Performance**: Identifique oportunidades, gargalos e melhorias
5. 🚨 **Alertas Proativos**: Detecte problemas (conversas não atribuídas, orçamentos vencidos, etc)
6. 🎯 **Orientação de Processos**: Explique como usar funcionalidades do sistema
7. 🔧 **Diagnóstico de Problemas**: Identifique causas de erros e sugira soluções técnicas
8. 💬 **Gestão de Comunicação**: Analise threads, sugira respostas, identifique urgências
9. 🌐 **Pesquisa Externa**: Busque informações atualizadas na internet quando necessário

**INSTRUÇÕES CRÍTICAS:**
- Use os DADOS REAIS acima para responder com precisão
- Se o usuário pedir análises, use os números e informações fornecidas
- Se identificar problemas nos dados (ex: threads não atribuídas), MENCIONE proativamente
- Seja OBJETIVO e ACIONÁVEL - sempre sugira próximos passos concretos
- Se o usuário pedir para "criar" ou "registrar" algo, explique os passos necessários no sistema
- Para erros técnicos, forneça diagnóstico detalhado e soluções práticas
- Adapte suas respostas ao nível de acesso do usuário (Admin vê tudo, usuários limitados)
- Use emojis para clareza visual
- Seja proativo: se vir oportunidades ou problemas, MENCIONE espontaneamente
- Para perguntas que exigem informações atualizadas ou externas ao sistema, USE a internet

**FORMATO DA RESPOSTA:**
- Comece com um resumo direto
- Use bullet points para clareza
- Termine sempre com "Próximos passos sugeridos" ou "Posso ajudar com algo mais?"

Responda agora de forma completa e útil:`,
        add_context_from_internet: true
      });

      const resultado = await Promise.race([consultaPromise, timeoutPromise]);

      const respostaIA = {
        id: Date.now() + 1,
        role: 'assistant',
        content: resultado,
        timestamp: new Date().toISOString()
      };

      setMensagens(prev => [...prev, respostaIA]);

    } catch (error) {
      console.error('[NEXUS CHAT] Erro:', error);

      let mensagemErro = 'Desculpe, houve um erro ao processar sua mensagem.';

      if (error.message === 'Timeout') {
        mensagemErro = '⏱️ A consulta demorou muito. Tente novamente com uma pergunta mais simples.';
        toast.error(mensagemErro);
      } else if (error.message?.includes('Rate limit')) {
        mensagemErro = '🚫 Muitas consultas. Aguarde alguns segundos e tente novamente.';
        toast.error(mensagemErro);
      } else {
        toast.error('Erro ao processar mensagem: ' + error.message);
      }

      const erroMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        content: mensagemErro,
        timestamp: new Date().toISOString()
      };

      setMensagens(prev => [...prev, erroMsg]);
    } finally {
      setEnviando(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      handleEnviarMensagem(e);
    }
  };

  const limparConversa = () => {
    setMensagens([]);
    setErro(null);
    inicializar();
    toast.success('Conversa limpa');
  };

  const renderMensagem = (mensagem) => {
    const isUser = mensagem.role === 'user';

    const getIcon = () => {
      switch (mensagem.role) {
        case 'user':
          return <User className="w-4 h-4" />;
        case 'assistant':
          // Check for specific assistant messages
          if (mensagem.content.startsWith('❌') || mensagem.content.startsWith('⏱️') || mensagem.content.startsWith('🚫')) return <AlertCircle className="w-4 h-4 text-red-500" />;
          return <Bot className="w-4 h-4 text-purple-500" />;
        default:
          return <Bot className="w-4 h-4 text-purple-500" />;
      }
    };

    const getBackgroundColor = () => {
      if (isUser) return 'bg-blue-500 text-white';
      if (mensagem.content.startsWith('❌') || mensagem.content.startsWith('⏱️') || mensagem.content.startsWith('🚫')) return 'bg-red-50 text-red-800 border border-red-200';
      return 'bg-white border border-gray-200';
    };

    return (
      <div key={mensagem.id} className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser ? 'bg-blue-500 text-white' :
          (mensagem.content.startsWith('❌') || mensagem.content.startsWith('⏱️') || mensagem.content.startsWith('🚫')) ? 'bg-red-100' :
          'bg-purple-100'
        }`}>
          {getIcon()}
        </div>
        <div className={`flex-1 max-w-xs ${isUser ? 'text-right' : ''}`}>
          <div className={`inline-block p-3 rounded-lg text-sm ${getBackgroundColor()}`}>
            <div className="whitespace-pre-wrap break-words">{mensagem.content}</div>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {mensagem.timestamp ? format(new Date(mensagem.timestamp), 'HH:mm') : ''}
          </p>
        </div>
      </div>
    );
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          className="fixed bottom-24 right-6 w-[480px] h-[680px] bg-white rounded-2xl shadow-2xl border-2 border-purple-200 flex flex-col z-50"
        >
          {/* Header */}
          <div className="bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 p-4 rounded-t-2xl flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-white font-bold">Nexus AI</h3>
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                  <span className="text-xs text-purple-100">Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={limparConversa}
                className="text-white hover:bg-white/20"
                title="Limpar conversa"
              >
                <RefreshCw className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={onToggle} className="text-white hover:bg-white/20">
                <X className="w-5 h-5" />
              </Button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 p-4 overflow-y-auto scrollbar-custom bg-gray-50">
            {erro && (
                <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-800">{erro}</p>
                  </div>
                </div>
              )}
            <div className="space-y-4">
              {mensagens.map(renderMensagem)}
              {enviando && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Bot className="w-4 h-4 text-purple-500" />
                  </div>
                  <div className="flex-1">
                    <div className="bg-white border border-gray-200 p-3 rounded-lg">
                      <div className="flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
                        <span className="text-sm text-gray-600">Nexus está digitando...</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-200">
            <form onSubmit={handleEnviarMensagem} className="flex gap-2">
              <Input
                value={inputMensagem}
                onChange={(e) => setInputMensagem(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={"Digite sua mensagem..."}
                disabled={enviando}
                className="flex-1 text-sm"
              />
              <Button
                type="submit"
                disabled={enviando || !inputMensagem.trim()}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {enviando ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}