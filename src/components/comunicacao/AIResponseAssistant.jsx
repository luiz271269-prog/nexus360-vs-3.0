import { useState, useEffect, useRef, useCallback } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2, RefreshCw, ChevronDown, ChevronUp, Wand2, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const TONS = [
  { key: "contato", label: "Como o contato fala", emoji: "🪞" },
  { key: "formal", label: "Formal", emoji: "👔" },
  { key: "amigavel", label: "Amigável", emoji: "😊" },
  { key: "objetiva", label: "Direto", emoji: "🎯" },
  { key: "empatico", label: "Empático", emoji: "🤝" },
];

export default function AIResponseAssistant({
  threadId,
  contactId,
  ultimaMensagemCliente,
  onUseResposta,
  visible,
  onClose,
}) {
  const [sugestoes, setSugestoes] = useState([]);
  const [status, setStatus] = useState("idle"); // idle | loading | ready | error
  const [tomSelecionado, setTomSelecionado] = useState("contato");
  const [rascunhoKeywords, setRascunhoKeywords] = useState("");
  const [gerandoRascunho, setGerandoRascunho] = useState(false);
  const [expandido, setExpandido] = useState(true);
  const [analise, setAnalise] = useState(null);
  const seqRef = useRef(0);
  const jaCarregouRef = useRef(null); // guarda a key da última carga

  const loadKey = `${threadId}-${ultimaMensagemCliente}`;

  const gerarSugestoes = useCallback(async (force = false) => {
    if (!threadId && !contactId) return;
    const seq = ++seqRef.current;
    setStatus("loading");
    setSugestoes([]);
    setAnalise(null);

    try {
      const resultado = await base44.functions.invoke("gerarSugestoesRespostaContato", {
        thread_id: threadId || null,
        contact_id: contactId || null,
        limit: 50,
        language: "pt-BR",
        tones: [tomSelecionado === "contato" ? "espelhar_contato" : tomSelecionado, "formal", "amigavel"],
        force,
      });

      if (seq !== seqRef.current) return;

      if (resultado.data?.success && resultado.data.suggestions?.length) {
        setSugestoes(
          resultado.data.suggestions.map((s) => ({
            texto: s.message,
            tom: s.tone,
            title: s.title,
          }))
        );
        setAnalise(resultado.data.analysis || null);
        setStatus("ready");
        jaCarregouRef.current = loadKey;
      } else {
        throw new Error(resultado.data?.error || "Sem sugestões");
      }
    } catch {
      if (seq !== seqRef.current) return;
      setStatus("error");
      // Fallback local
      setSugestoes([
        { texto: "Obrigado pela sua mensagem! Vou verificar e retorno em breve.", tom: "formal" },
        { texto: "Entendido! Já estou verificando pra você 😊", tom: "amigavel" },
        { texto: "Recebi. Aguarde um momento enquanto analiso.", tom: "objetiva" },
      ]);
    }
  }, [threadId, contactId, tomSelecionado, loadKey]);

  // Auto-gerar ao abrir ou quando chega nova mensagem do contato
  useEffect(() => {
    if (!visible) return;
    if (jaCarregouRef.current === loadKey && status === "ready") return;
    const t = setTimeout(() => gerarSugestoes(false), 300);
    return () => clearTimeout(t);
  }, [visible, loadKey]);

  // Regerar ao mudar tom
  useEffect(() => {
    if (!visible || status === "idle") return;
    const t = setTimeout(() => gerarSugestoes(true), 200);
    return () => clearTimeout(t);
  }, [tomSelecionado]);

  const gerarRascunho = async () => {
    if (!rascunhoKeywords.trim()) {
      toast.error("Digite algumas palavras-chave para o rascunho");
      return;
    }
    setGerandoRascunho(true);
    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Você é um assistente de comunicação empresarial.
Gere UMA mensagem profissional e natural em português brasileiro.

Contexto da conversa: ${analise?.conversation_type || "atendimento geral"}
Tom desejado: ${TONS.find((t) => t.key === tomSelecionado)?.label || "natural"}
${analise?.contact_communication_style ? `Estilo do contato: ${analise.contact_communication_style}` : ""}
Última mensagem do cliente: "${ultimaMensagemCliente || "não disponível"}"

Palavras-chave para o rascunho: ${rascunhoKeywords}

Escreva APENAS a mensagem final, sem aspas, sem explicações. Seja conciso e adequado ao contexto.`,
      });

      if (resultado) {
        const texto = typeof resultado === "string" ? resultado.trim() : resultado?.content?.trim();
        if (texto) {
          onUseResposta(texto);
          setRascunhoKeywords("");
          toast.success("Rascunho aplicado!");
        }
      }
    } catch {
      toast.error("Erro ao gerar rascunho");
    } finally {
      setGerandoRascunho(false);
    }
  };

  const refinarSugestao = async (sugestao) => {
    try {
      const resultado = await base44.integrations.Core.InvokeLLM({
        prompt: `Reescreva a mensagem abaixo com tom "${TONS.find((t) => t.key === tomSelecionado)?.label}".
${analise?.contact_communication_style ? `Adapte para o estilo de comunicação do contato: ${analise.contact_communication_style}` : ""}
Mantenha o mesmo significado. Escreva APENAS a mensagem reescrita, sem aspas.

Mensagem original: "${sugestao}"`,
      });

      const texto = typeof resultado === "string" ? resultado.trim() : resultado?.content?.trim();
      if (texto) {
        onUseResposta(texto);
        toast.success("Resposta refinada aplicada!");
      }
    } catch {
      toast.error("Erro ao refinar");
    }
  };

  if (!visible) return null;

  return (
    <div className="border-t border-purple-200 bg-gradient-to-b from-purple-50 to-white">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-purple-600">
        <div className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-white" />
          <span className="text-white text-xs font-semibold">Assistente IA</span>
          {analise?.conversation_type && (
            <span className="text-purple-200 text-[10px]">· {analise.conversation_type}</span>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setExpandido((p) => !p)}
            className="text-white/70 hover:text-white"
          >
            {expandido ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
          </button>
          <button onClick={onClose} className="text-white/70 hover:text-white">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {expandido && (
        <div className="px-3 py-2 space-y-2">
          {/* Seletor de Tom */}
          <div className="flex gap-1 flex-wrap">
            {TONS.map((tom) => (
              <button
                key={tom.key}
                onClick={() => setTomSelecionado(tom.key)}
                className={cn(
                  "text-[10px] px-2 py-0.5 rounded-full border transition-all",
                  tomSelecionado === tom.key
                    ? "bg-purple-600 text-white border-purple-600"
                    : "bg-white text-slate-600 border-slate-300 hover:border-purple-400"
                )}
              >
                {tom.emoji} {tom.label}
              </button>
            ))}
            <button
              onClick={() => gerarSugestoes(true)}
              disabled={status === "loading"}
              className="text-[10px] px-2 py-0.5 rounded-full border border-slate-300 text-slate-500 hover:border-purple-400 hover:text-purple-600 transition-all"
              title="Regerar sugestões"
            >
              <RefreshCw className={cn("w-3 h-3 inline", status === "loading" && "animate-spin")} />
            </button>
          </div>

          {/* Sugestões rápidas */}
          {status === "loading" && (
            <div className="flex items-center gap-2 py-1">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              <span className="text-xs text-slate-500">Analisando conversa...</span>
            </div>
          )}

          {(status === "ready" || status === "error") && sugestoes.length > 0 && (
            <div className="space-y-1">
              {sugestoes.map((s, i) => (
                <div
                  key={i}
                  className="group flex items-start gap-2 bg-white border border-purple-100 hover:border-purple-400 rounded-lg px-2 py-1.5 cursor-pointer transition-all hover:shadow-sm"
                >
                  <button
                    onClick={() => onUseResposta(s.texto)}
                    className="flex-1 text-left"
                  >
                    <p className="text-[11px] text-slate-700 leading-snug line-clamp-2">{s.texto}</p>
                  </button>
                  <button
                    onClick={() => refinarSugestao(s.texto)}
                    title="Refinar com tom selecionado"
                    className="opacity-0 group-hover:opacity-100 text-purple-400 hover:text-purple-600 flex-shrink-0 mt-0.5 transition-opacity"
                  >
                    <Wand2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Gerador de rascunho por palavras-chave */}
          <div className="flex gap-1.5 items-center border-t border-purple-100 pt-2">
            <input
              type="text"
              value={rascunhoKeywords}
              onChange={(e) => setRascunhoKeywords(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && gerarRascunho()}
              placeholder="Palavras-chave → gerar rascunho..."
              className="flex-1 text-[11px] px-2 py-1 border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-purple-400 bg-white"
            />
            <Button
              type="button"
              onClick={gerarRascunho}
              disabled={gerandoRascunho || !rascunhoKeywords.trim()}
              className="h-6 px-2 text-[10px] bg-purple-600 hover:bg-purple-700 text-white flex-shrink-0"
            >
              {gerandoRascunho ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Wand2 className="w-3 h-3" />
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}