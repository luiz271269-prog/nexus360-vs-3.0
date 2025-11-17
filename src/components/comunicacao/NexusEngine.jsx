import { useEffect, useRef, useState } from 'react';
import { base44 } from '@/api/base44Client';

// ✅ CACHE GLOBAL para evitar consultas repetidas
const CACHE_NKDB = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos

// ✅ DEBOUNCE GLOBAL para limitar chamadas
let ultimaConsultaNKDB = 0;
const MIN_INTERVALO_CONSULTAS = 3000; // 3 segundos entre consultas

export default function NexusEngine({ 
  thread, 
  mensagensRecentes, 
  onSugestaoResposta,
  ativo = true 
}) {
  const [sugestoesAtivas, setSugestoesAtivas] = useState([]);
  const [consultandoNKDB, setConsultandoNKDB] = useState(false);
  const ultimaAnaliseRef = useRef(null);
  const timeoutRef = useRef(null);

  useEffect(() => {
    if (!ativo || !thread || !mensagensRecentes || mensagensRecentes.length === 0) {
      return;
    }

    // Limpar timeout anterior
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // ✅ DEBOUNCE: Esperar 2 segundos após última mensagem
    timeoutRef.current = setTimeout(() => {
      analisarContextoComProtecao();
    }, 2000);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [mensagensRecentes, ativo]);

  const analisarContextoComProtecao = async () => {
    try {
      // ✅ PROTEÇÃO 1: Verificar se já analisamos essas mensagens
      const hashMensagens = mensagensRecentes
        .slice(-3)
        .map(m => m.id)
        .join('-');

      if (ultimaAnaliseRef.current === hashMensagens) {
        console.log('[NEXUS ENGINE] 🔄 Contexto já analisado recentemente, pulando');
        return;
      }

      // ✅ PROTEÇÃO 2: Rate limit global
      const agora = Date.now();
      const tempoDecorrido = agora - ultimaConsultaNKDB;
      
      if (tempoDecorrido < MIN_INTERVALO_CONSULTAS) {
        console.log(`[NEXUS ENGINE] ⏳ Aguardando rate limit (${MIN_INTERVALO_CONSULTAS - tempoDecorrido}ms)`);
        return;
      }

      // ✅ PROTEÇÃO 3: Não consultar se já está consultando
      if (consultandoNKDB) {
        console.log('[NEXUS ENGINE] 🔄 Consulta já em andamento');
        return;
      }

      console.log('[NEXUS ENGINE] 🤖 Analisando contexto da conversa');
      ultimaAnaliseRef.current = hashMensagens;
      ultimaConsultaNKDB = agora;
      setConsultandoNKDB(true);

      const ultimasMensagens = mensagensRecentes.slice(-5);
      const contexto = ultimasMensagens
        .map(m => `${m.sender_type === 'contact' ? 'Cliente' : 'Atendente'}: ${m.content}`)
        .join('\n');

      // ✅ Verificar cache
      const cacheKey = `nkdb-${thread.id}-${hashMensagens}`;
      const cached = CACHE_NKDB.get(cacheKey);
      
      if (cached && (agora - cached.timestamp) < CACHE_DURATION) {
        console.log('[NEXUS ENGINE] ✅ Usando resposta em cache');
        setSugestoesAtivas(cached.sugestoes);
        setConsultandoNKDB(false);
        return;
      }

      // Consultar NKDB com proteção
      const resultado = await consultarNKDBComProtecao(contexto);

      if (resultado && resultado.sugestoes) {
        // Salvar no cache
        CACHE_NKDB.set(cacheKey, {
          sugestoes: resultado.sugestoes,
          timestamp: agora
        });

        // Limpar cache antigo (manter apenas últimas 20 entradas)
        if (CACHE_NKDB.size > 20) {
          const primeiraChave = CACHE_NKDB.keys().next().value;
          CACHE_NKDB.delete(primeiraChave);
        }

        setSugestoesAtivas(resultado.sugestoes);
        
        if (onSugestaoResposta && resultado.sugestoes.length > 0) {
          onSugestaoResposta(resultado.sugestoes[0].texto);
        }
      }

    } catch (error) {
      console.error('[NEXUS ENGINE] ❌ Erro:', error);
      // ✅ NÃO mostrar toast de erro para não poluir a UI
      // O usuário não precisa saber que a IA falhou em segundo plano
    } finally {
      setConsultandoNKDB(false);
    }
  };

  const consultarNKDBComProtecao = async (contexto) => {
    try {
      console.log('[NEXUS ENGINE] 🔍 Consultando base de conhecimento...');

      // ✅ TIMEOUT: Limitar tempo de resposta a 10 segundos
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 10000);
      });

      const consultaPromise = base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de vendas inteligente.

Contexto da conversa:
${contexto}

Com base neste contexto, sugira UMA resposta profissional e útil para o atendente usar.

Seja breve, direto e profissional.`,
        response_json_schema: {
          type: "object",
          properties: {
            sugestoes: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  texto: { type: "string" },
                  tom: { type: "string" },
                  confianca: { type: "number" }
                }
              }
            }
          }
        }
      });

      const resultado = await Promise.race([consultaPromise, timeoutPromise]);

      console.log('[NEXUS ENGINE] ✅ Resposta recebida');
      return resultado;

    } catch (error) {
      if (error.message === 'Timeout') {
        console.log('[NEXUS ENGINE] ⏱️ Timeout na consulta');
      } else if (error.message?.includes('Rate limit')) {
        console.log('[NEXUS ENGINE] 🚫 Rate limit atingido - aguardando cooldown');
        // Aumentar intervalo mínimo temporariamente
        ultimaConsultaNKDB = Date.now() + 10000; // Adicionar 10s de penalidade
      } else {
        console.error('[NEXUS ENGINE] ❌ Erro ao consultar NKDB:', error.message);
      }
      throw error;
    }
  };

  // ✅ Não renderizar nada - funciona em background
  return null;
}