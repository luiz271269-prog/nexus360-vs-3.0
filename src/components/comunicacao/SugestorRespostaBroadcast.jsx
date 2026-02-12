import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Copy, Check } from 'lucide-react';
import { toast } from 'sonner';

export default function SugestorRespostaBroadcast({
  thread,
  ultimaMensagemCliente,
  onSugerirResposta,
  contato,
  usuario
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [copiada, setCopiada] = useState(null);

  useEffect(() => {
    // Só gera sugestões se:
    // 1. Última mensagem é do cliente
    // 2. Thread foi resultado de broadcast recente (verifica broadcast_data)
    if (!ultimaMensagemCliente || !thread?.metadata?.broadcast_data) {
      return;
    }

    gerarSugestoes();
  }, [ultimaMensagemCliente, thread?.id]);

  const gerarSugestoes = async () => {
    setCarregando(true);
    try {
      // Detectar tipo de resposta do cliente
      const tipoResposta = detectarTipoResposta(ultimaMensagemCliente);
      
      // Gerar sugestões via IA contextualizada para broadcast
      const prompt = `
Cliente respondeu a envio em massa de promoção/novidade.
Tipo de resposta: ${tipoResposta}
Mensagem do cliente: "${ultimaMensagemCliente.substring(0, 150)}"
Contato: ${contato?.nome}
Empresa: ${contato?.empresa}
Atendente: ${usuario?.full_name}

Gere 3 respostas profissionais e amistosas que:
1. Reconheçam o interesse do cliente
2. Façam seguimento apropriado baseado no tipo de resposta
3. Sejam naturais e conversacionais (sem parecer template)
4. Convide para próxima ação (chat, telefone, agendamento)

Formato: JSON array com max 3 sugestões
[
  {"resposta": "texto...", "tipo": "interesse|duvida|rejeicao", "prioridade": "alta|media|baixa"}
]
      `;

      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: {
          type: 'object',
          properties: {
            sugestoes: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  resposta: { type: 'string' },
                  tipo: { type: 'string' },
                  prioridade: { type: 'string' }
                }
              }
            }
          }
        }
      });

      setSugestoes(resultado?.sugestoes || []);
    } catch (error) {
      console.error('[SugestorBroadcast] Erro:', error);
    } finally {
      setCarregando(false);
    }
  };

  const detectarTipoResposta = (mensagem) => {
    const msg = mensagem.toLowerCase();
    
    // Interesse
    if (/interesse|quero|preciso|cota|prec|pode|tem|cotar|valor|preço|quanto/i.test(msg)) {
      return 'interesse';
    }
    
    // Rejeição
    if (/não|nao|n preciso|de repente|depois|outro momento|agora não/i.test(msg)) {
      return 'rejeicao';
    }
    
    // Dúvida
    if (/como|qual|quando|onde|o que|quais|dúvida|duvida|questao|info|mais info/i.test(msg)) {
      return 'duvida';
    }
    
    return 'generico';
  };

  const copiarResposta = (texto) => {
    navigator.clipboard.writeText(texto);
    setCopiada(texto);
    toast.success('✅ Copiada!');
    setTimeout(() => setCopiada(null), 2000);
  };

  if (!ultimaMensagemCliente || !thread?.metadata?.broadcast_data) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-cyan-50 to-blue-50 border border-cyan-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="w-4 h-4 text-cyan-600" />
        <h4 className="text-sm font-semibold text-cyan-900">Respostas para Broadcast</h4>
      </div>

      {carregando ? (
        <div className="flex items-center gap-2 text-xs text-cyan-600">
          <div className="animate-spin">⚙️</div>
          Gerando respostas inteligentes...
        </div>
      ) : sugestoes.length > 0 ? (
        <div className="space-y-2">
          {sugestoes.map((sug, idx) => (
            <div
              key={idx}
              className="bg-white rounded border border-cyan-100 p-2 space-y-1.5 hover:border-cyan-300 transition"
            >
              <p className="text-xs text-slate-700 leading-relaxed">
                {sug.resposta}
              </p>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px] px-1.5 py-0.5">
                  {sug.tipo}
                </Badge>
                <div className="flex-1" />
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={() => copiarResposta(sug.resposta)}
                >
                  {copiada === sug.resposta ? (
                    <>
                      <Check className="w-3 h-3 mr-0.5 text-green-600" />
                      OK
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3 mr-0.5" />
                      Copiar
                    </>
                  )}
                </Button>
                <Button
                  size="xs"
                  className="h-6 px-1.5 text-[10px] bg-cyan-600 hover:bg-cyan-700"
                  onClick={() => {
                    if (onSugerirResposta) {
                      onSugerirResposta(sug.resposta);
                    }
                  }}
                >
                  <Send className="w-3 h-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-slate-500 italic">
          Nenhuma sugestão disponível no momento
        </p>
      )}
    </div>
  );
}