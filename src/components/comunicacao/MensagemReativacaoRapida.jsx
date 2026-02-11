import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Zap, Copy, Loader2, RefreshCw } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { toast } from 'sonner';

/**
 * 🚀 Mensagem de Reativação Rápida
 * Gera sugestão instantânea de reengajamento baseada em:
 * - Dias de inatividade
 * - Tipo de contato (lead/cliente)
 * - Última conversa (se disponível)
 * - Contexto do negócio
 */
export default function MensagemReativacaoRapida({ 
  contato, 
  analise,
  threadId, // ✅ NOVO: para buscar última mensagem útil
  onUsarMensagem,
  variant = 'inline' // inline | badge
}) {
  const [mensagemSugerida, setMensagemSugerida] = useState(null);
  const [gerando, setGerando] = useState(false);
  const [ultimaMensagemUtil, setUltimaMensagemUtil] = useState(null); // ✅ NOVO
  const [tipoConversa, setTipoConversa] = useState('generico'); // ✅ NOVO

  const diasInativo = analise?.days_inactive_inbound || 0;
  const tipoContato = contato?.tipo_contato || 'lead';
  const empresa = contato?.empresa || contato?.nome;
  const primeiroNome = empresa?.split(' ')[0] || 'Cliente';

  // ✅ Buscar última mensagem ÚTIL do cliente
  useEffect(() => {
    const buscarUltimaMensagemUtil = async () => {
      if (!threadId && !contato?.id) return;
      
      try {
        const filter = threadId 
          ? { thread_id: threadId, sender_type: 'contact' }
          : { contact_id: contato.id, sender_type: 'contact' };
        
        const msgs = await base44.entities.Message.filter(filter, '-created_date', 10);
        
        if (msgs.length > 0) {
          // Score de relevância
          const scored = msgs.map(m => {
            const text = (m.content || '').toLowerCase();
            const len = text.length;
            let score = 0;
            
            if (text.includes('?')) score += 3;
            if (/\b(orçamento|cotação|preço|valor|quanto|quando|prazo|entrega|estoque)\b/i.test(text)) score += 3;
            if (/\b\d+\b/.test(text)) score += 2;
            if (len > 25) score += 2;
            if (/\b(obrigado|ok|blz|valeu|show|perfeito)\b/i.test(text) && len < 25) score -= 5;
            if (/\b(sim|não|tá|ok|uhum)\b/i.test(text) && len < 15) score -= 3;
            
            return { ...m, score };
          });
          
          scored.sort((a, b) => b.score - a.score);
          const melhorMsg = scored[0];
          
          if (melhorMsg?.content) {
            setUltimaMensagemUtil(melhorMsg.content);
            
            // Classificar tipo
            const tipo = classifyType(melhorMsg.content);
            setTipoConversa(tipo);
          }
        }
      } catch (error) {
        console.error('[REATIVACAO] Erro ao buscar mensagem útil:', error);
      }
    };
    
    if (diasInativo >= 30) {
      buscarUltimaMensagemUtil();
    }
  }, [diasInativo, threadId, contato?.id]);

  const classifyType = (text) => {
    if (!text) return 'generico';
    const lower = text.toLowerCase();
    
    if (/\b(orçamento|cotação|preço|valor|quanto)\b/i.test(lower)) return 'orcamento';
    if (lower.includes('?') || /\b(conseguiu|tem|vai|quando|previsão)\b/i.test(lower)) return 'pergunta';
    if (/\b(nada ainda|alguma novidade|cadê|ficou)\b/i.test(lower)) return 'followup';
    if (/\b(problema|demora|reclamação|péssimo)\b/i.test(lower)) return 'reclamacao';
    
    return 'interesse';
  };

  // ✅ Gerar mensagem automática ao montar
  useEffect(() => {
    if (diasInativo >= 30 && !mensagemSugerida && !gerando && tipoConversa !== 'generico') {
      gerarMensagemRapida();
    }
  }, [diasInativo, tipoConversa]);

  const gerarMensagemRapida = async () => {
    setGerando(true);
    
    try {
      // 🎯 Templates contextuais por TIPO DE CONVERSA (não por perfil)
      const templates = {
        pergunta: [
          `Oi ${primeiroNome}! Vi sua dúvida aqui 👀\n\nDeixa eu conferir isso pra você agora mesmo.`,
          `E aí ${primeiroNome}! Sobre sua pergunta...\n\nVou verificar e já te retorno, ok?`,
          `Oi ${primeiroNome}! 😊\n\nDeixa eu ver isso que você perguntou e já te respondo.`
        ],
        orcamento: [
          `Oi ${primeiroNome}! Sobre o orçamento... 💰\n\nDeixa eu ver os valores atualizados pra você.`,
          `E aí ${primeiroNome}! Vou conferir esse orçamento agora.\n\nJá te mando os detalhes! 📊`,
          `Oi ${primeiroNome}! 😊\n\nVou preparar esse orçamento pra você agora mesmo.`
        ],
        followup: [
          `Oi ${primeiroNome}! Desculpa a demora 😅\n\nDeixa eu retomar isso com você agora.`,
          `E aí ${primeiroNome}! Obrigado por cobrar 🙏\n\nVou ver o andamento e já te atualizo.`,
          `Oi ${primeiroNome}! Tudo bem?\n\nVou verificar o status e te retorno já já.`
        ],
        reclamacao: [
          `Oi ${primeiroNome}. Entendo sua preocupação.\n\nDeixa eu verificar o que aconteceu e resolvo isso pra você.`,
          `${primeiroNome}, peço desculpas pela situação.\n\nVou apurar agora e te retorno com a solução.`,
          `Oi ${primeiroNome}. Vi sua mensagem 🙏\n\nVou resolver isso pra você com urgência.`
        ],
        interesse: [
          `Oi ${primeiroNome}! Tudo bem? 😊\n\nVi sua mensagem e queria retomar nossa conversa.`,
          `E aí ${primeiroNome}! Como vão as coisas?\n\nGostaria de dar sequência ao que conversamos.`,
          `Oi ${primeiroNome}! 👋\n\nFiquei de te retornar e queria saber se ainda faz sentido.`
        ],
        generico: [
          `Oi ${primeiroNome}! Tudo bem? 😊\n\nGostaria de retomar nossa conversa... Posso ajudar em algo?`,
          `E aí ${primeiroNome}, como vai? 👋\n\nFaz um tempo que não conversamos... Surgiu alguma novidade?`
        ]
      };

      const opcoes = templates[tipoConversa] || templates['generico'];
      
      // ✅ Seleção inteligente (não aleatória)
      const jaUsou = analise?.metadata?.quick_reengagement?.last_template_used;
      const indice = jaUsou === opcoes[0] ? 1 : 0;
      const mensagem = opcoes[indice];
      
      setMensagemSugerida(mensagem);
      
    } catch (error) {
      console.error('[REATIVACAO] Erro ao gerar mensagem:', error);
      setMensagemSugerida(`Oi ${primeiroNome}! Tudo bem? 😊\n\nGostaria de retomar nossa conversa... Posso ajudar em algo?`);
    } finally {
      setGerando(false);
    }
  };

  const copiarMensagem = () => {
    if (mensagemSugerida) {
      navigator.clipboard.writeText(mensagemSugerida);
      toast.success('✅ Mensagem copiada!');
      if (onUsarMensagem) {
        onUsarMensagem(mensagemSugerida);
      }
    }
  };

  // Não mostrar se não tem inatividade significativa
  if (diasInativo < 30) return null;

  // ═══════════════════════════════════════════════════════════════
  // VERSÃO BADGE (compacta para sidebar)
  // ═══════════════════════════════════════════════════════════════
  if (variant === 'badge') {
    return (
      <button
        onClick={copiarMensagem}
        disabled={gerando || !mensagemSugerida}
        className="inline-flex items-center gap-1 px-2 py-1 bg-gradient-to-r from-purple-500 to-indigo-600 text-white rounded-full text-[9px] font-semibold shadow-sm hover:shadow-md transition-all hover:from-purple-600 hover:to-indigo-700 disabled:opacity-50"
        title={mensagemSugerida || "Gerando sugestão..."}
      >
        {gerando ? (
          <Loader2 className="w-2.5 h-2.5 animate-spin" />
        ) : (
          <Zap className="w-2.5 h-2.5" />
        )}
        Reativar IA
      </button>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // VERSÃO INLINE (expandida para chat)
  // ═══════════════════════════════════════════════════════════════
  return (
    <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-lg p-3">
      <div className="flex items-start gap-2 mb-2">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm">
          <Zap className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <p className="text-xs font-bold text-purple-900">
              ⚡ Reativação Instantânea
            </p>
            <Badge className="bg-blue-500 text-white text-[8px] px-1 py-0 font-bold">
              SEM ANÁLISE
            </Badge>
          </div>
          <p className="text-[10px] text-purple-700">
            {diasInativo} dias sem resposta • Sugestão baseada em perfil
          </p>
        </div>
        <Badge className={`text-[9px] px-1.5 py-0.5 font-bold ${
          diasInativo >= 90 ? 'bg-red-600 text-white' : 
          diasInativo >= 60 ? 'bg-orange-500 text-white' : 
          'bg-yellow-500 text-white'
        }`}>
          {diasInativo >= 90 ? '🔴 CRÍTICO' : diasInativo >= 60 ? '🟠 URGENTE' : '🟡 ALERTA'}
        </Badge>
      </div>

      {gerando ? (
        <div className="flex items-center justify-center py-4">
          <Loader2 className="w-5 h-5 animate-spin text-purple-600 mr-2" />
          <span className="text-sm text-purple-700">Gerando mensagem...</span>
        </div>
      ) : mensagemSugerida ? (
        <>
          <div className="bg-white rounded-lg p-2 mb-2 border border-purple-200">
            <p className="text-sm text-slate-700 whitespace-pre-line">
              {mensagemSugerida}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={copiarMensagem}
              size="sm"
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-xs flex-1"
            >
              <Copy className="w-3 h-3 mr-1" />
              Copiar e Usar
            </Button>
            
            <Button
              onClick={gerarMensagemRapida}
              size="sm"
              variant="outline"
              className="border-purple-300 text-purple-700 hover:bg-purple-50 text-xs"
            >
              <RefreshCw className="w-3 h-3" />
            </Button>
          </div>
        </>
      ) : (
        <Button
          onClick={gerarMensagemRapida}
          size="sm"
          variant="outline"
          className="w-full border-purple-300 text-purple-700 hover:bg-purple-50 text-xs"
        >
          <Zap className="w-3 h-3 mr-1" />
          Gerar Mensagem de Reativação
        </Button>
      )}
    </div>
  );
}