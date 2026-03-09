import React from "react";
import { X, Bot, Clock, Zap, AlertTriangle, TrendingDown, FileText, Shield, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const alertas = [
  {
    icon: "⏰",
    cor: "bg-amber-50 border-amber-300",
    corTitulo: "text-amber-700",
    titulo: "Conversa parada X minutos",
    mensagem: `⏰ *Atenção!* Conversa parada há *45 minutos*.\n📊 Score: *72/100 (ALTO)*`,
    explicacao: "O Jarvis detectou que o cliente respondeu mas ninguém retornou. O número de minutos e o score indicam a urgência. Score acima de 55 = ALTO.",
    acao: "Verifique a conversa e responda o cliente. Pode ser uma oportunidade de venda!"
  },
  {
    icon: "🤖",
    cor: "bg-blue-50 border-blue-300",
    corTitulo: "text-blue-700",
    titulo: "Follow-up automático enviado",
    mensagem: `🤖 Jarvis enviou mensagem automática ao cliente (score CRÍTICO).`,
    explicacao: "Score acima de 75 + mais de 30 min parado → Jarvis enviou uma mensagem profissional de follow-up automaticamente pelo WhatsApp.",
    acao: "Nenhuma ação imediata necessária. O Jarvis já atuou. Continue a conversa normalmente quando o cliente responder."
  },
  {
    icon: "🔴",
    cor: "bg-red-50 border-red-300",
    corTitulo: "text-red-700",
    titulo: "Risco relacional detectado",
    mensagem: `🔴 Risco relacional: *ALTO*\n💡 Próxima ação: ligação pessoal`,
    explicacao: "A IA analisou o histórico de conversas e identificou sinais de insatisfação ou desengajamento. O cliente pode estar prestes a desistir.",
    acao: "Ligue para o cliente! Este é um alerta sério — não responda apenas por texto."
  },
  {
    icon: "📋",
    cor: "bg-orange-50 border-orange-300",
    corTitulo: "text-orange-700",
    titulo: "Orçamento parado há 3+ dias",
    mensagem: `📋 *Orçamento em negociação parado há 3+ dias*\n👤 Cliente: Empresa XYZ\n💰 Valor: R$ 15.000`,
    explicacao: "Um orçamento está em negociação mas sem atualização há mais de 3 dias. Isso aumenta o risco de perda da venda.",
    acao: "Entre em contato com o cliente para verificar o status da decisão."
  },
  {
    icon: "📌",
    cor: "bg-yellow-50 border-yellow-300",
    corTitulo: "text-yellow-700",
    titulo: "Resumo de contatos pendentes (anti-fadiga)",
    mensagem: `📋 Jarvis suprimiu 3 alerta(s) por anti-fadiga. Verifique os contatos pendentes.`,
    explicacao: "O Jarvis enviou muitos alertas para você nas últimas 2 horas. Para não te sobrecarregar, agrupou os próximos em um resumo único na fila de tarefas.",
    acao: "Acesse a fila de trabalho para ver os contatos que precisam de atenção."
  },
  {
    icon: "🛑",
    cor: "bg-slate-50 border-slate-400",
    corTitulo: "text-slate-700",
    titulo: "Freio de mão ativado (apenas gerência)",
    mensagem: `🛑 FREIO DE MÃO: 10 disparos automáticos na última hora. Modo alerta apenas.`,
    explicacao: "O Jarvis atingiu o limite de 10 mensagens automáticas por hora para proteger o chip de WhatsApp. Ele continua monitorando, mas só envia alertas internos.",
    acao: "Isso é automático e não requer ação. O sistema se restabelece automaticamente em 1 hora."
  }
];

function AlertaItem({ alerta }) {
  const [aberto, setAberto] = React.useState(false);
  return (
    <div className={`border rounded-lg overflow-hidden ${alerta.cor}`}>
      <button
        onClick={() => setAberto(!aberto)}
        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xl flex-shrink-0">{alerta.icon}</span>
          <span className={`font-semibold text-sm ${alerta.corTitulo}`}>{alerta.titulo}</span>
        </div>
        {aberto ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />}
      </button>
      {aberto && (
        <div className="px-3 pb-3 space-y-2 border-t border-current/10">
          {/* Exemplo real */}
          <div className="mt-2 bg-white/80 rounded-lg p-2.5 border border-current/10">
            <p className="text-[10px] text-slate-400 mb-1 font-medium uppercase tracking-wide">Exemplo de mensagem:</p>
            <pre className="text-xs text-slate-700 whitespace-pre-wrap font-sans">{alerta.mensagem}</pre>
          </div>
          {/* Explicação */}
          <div>
            <p className="text-[11px] font-semibold text-slate-600 mb-0.5">📖 O que significa:</p>
            <p className="text-xs text-slate-600">{alerta.explicacao}</p>
          </div>
          {/* Ação */}
          <div className="bg-green-50 rounded-lg px-3 py-2 border border-green-200">
            <p className="text-[11px] font-semibold text-green-700 mb-0.5">✅ O que fazer:</p>
            <p className="text-xs text-green-700">{alerta.acao}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ManualJarvis({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg flex items-center justify-center">
              <Bot className="w-4 h-4 text-white" />
            </div>
            <div>
              <h2 className="text-white font-bold text-sm">Manual de Bolso — Alertas do Jarvis</h2>
              <p className="text-slate-400 text-[11px]">Guia rápido para a equipe de vendas</p>
            </div>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Intro */}
        <div className="flex-shrink-0 bg-purple-50 border-b border-purple-200 px-4 py-3">
          <div className="flex items-start gap-2">
            <Shield className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-semibold text-purple-800">O Jarvis é seu assistente, não um chefe!</p>
              <p className="text-xs text-purple-700 mt-0.5">
                Ele monitora conversas silenciosamente e só te alerta quando há risco real de perder um cliente.
                Você sempre tem a última palavra — o Jarvis apenas lembra.
              </p>
            </div>
          </div>
        </div>

        {/* Score rápido */}
        <div className="flex-shrink-0 px-4 py-2 bg-slate-50 border-b border-slate-200">
          <p className="text-[11px] font-bold text-slate-600 mb-1.5 uppercase tracking-wide">Tabela de Scores</p>
          <div className="grid grid-cols-4 gap-1.5">
            {[
              { label: 'BAIXO', range: '0–34', cor: 'bg-slate-200 text-slate-600', emoji: '💤' },
              { label: 'MÉDIO', range: '35–54', cor: 'bg-yellow-100 text-yellow-700', emoji: '👀' },
              { label: 'ALTO', range: '55–74', cor: 'bg-orange-100 text-orange-700', emoji: '🔔' },
              { label: 'CRÍTICO', range: '75–100', cor: 'bg-red-100 text-red-700', emoji: '🚨' },
            ].map(s => (
              <div key={s.label} className={`rounded-lg px-2 py-1.5 text-center ${s.cor}`}>
                <div className="text-base leading-none">{s.emoji}</div>
                <div className="text-[10px] font-bold mt-0.5">{s.label}</div>
                <div className="text-[9px] opacity-75">{s.range}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Lista de alertas (scrollável) */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wide mb-3">Clique em cada alerta para ver a explicação</p>
          {alertas.map((a, i) => <AlertaItem key={i} alerta={a} />)}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-4 py-3 bg-slate-50 border-t border-slate-200">
          <Button onClick={onClose} className="w-full bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-800 hover:to-slate-900 text-white">
            Entendido! Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}