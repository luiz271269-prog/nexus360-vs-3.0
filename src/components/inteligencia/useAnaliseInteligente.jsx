import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

/**
 * Hook para análise inteligente de conversas
 * Prepara o terreno para o MÓDULO III (IA e Automações)
 */
export function useAnaliseInteligente(threadId) {
  const [analise, setAnalise] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!threadId) return;

    const analisarConversa = async () => {
      setLoading(true);
      try {
        // Buscar mensagens da conversa
        const mensagens = await base44.entities.Message.filter({
          thread_id: threadId
        }, 'created_date', 100);

        // Análise básica
        const totalMensagens = mensagens.length;
        const mensagensCliente = mensagens.filter(m => m.sender_type === 'contact').length;
        const mensagensAtendente = mensagens.filter(m => m.sender_type === 'user').length;

        // Tempo médio de resposta
        let temposResposta = [];
        for (let i = 1; i < mensagens.length; i++) {
          if (mensagens[i].sender_type === 'user' && mensagens[i-1].sender_type === 'contact') {
            const diff = new Date(mensagens[i].created_date) - new Date(mensagens[i-1].created_date);
            temposResposta.push(diff / 1000 / 60); // em minutos
          }
        }
        
        const tempoMedioResposta = temposResposta.length > 0
          ? temposResposta.reduce((a, b) => a + b, 0) / temposResposta.length
          : 0;

        // Detecção de sentimento (simplificado - será expandido no MÓDULO III)
        const palavrasPositivas = ['obrigado', 'ótimo', 'perfeito', 'excelente', 'legal'];
        const palavrasNegativas = ['problema', 'ruim', 'erro', 'não funciona', 'demora'];
        
        let scoreSentimento = 0;
        mensagens.forEach(msg => {
          const conteudo = msg.content?.toLowerCase() || '';
          palavrasPositivas.forEach(p => {
            if (conteudo.includes(p)) scoreSentimento++;
          });
          palavrasNegativas.forEach(p => {
            if (conteudo.includes(p)) scoreSentimento--;
          });
        });

        setAnalise({
          totalMensagens,
          mensagensCliente,
          mensagensAtendente,
          tempoMedioResposta: Math.round(tempoMedioResposta),
          sentimento: scoreSentimento > 0 ? 'positivo' : scoreSentimento < 0 ? 'negativo' : 'neutro',
          engajamento: totalMensagens > 10 ? 'alto' : totalMensagens > 5 ? 'medio' : 'baixo'
        });

      } catch (error) {
        console.error('Erro ao analisar conversa:', error);
      }
      setLoading(false);
    };

    analisarConversa();
  }, [threadId]);

  return { analise, loading };
}