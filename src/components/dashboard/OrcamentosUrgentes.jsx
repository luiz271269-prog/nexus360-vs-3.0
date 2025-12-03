import { AlertTriangle, Clock, DollarSign } from "lucide-react";

export default function OrcamentosUrgentes({ orcamentos }) {
  const hoje = new Date();
  const urgentes = orcamentos.filter(o => {
    if (!o.prazo_validade) return false;
    const prazo = new Date(o.prazo_validade);
    const diasRestantes = Math.ceil((prazo - hoje) / (1000 * 60 * 60 * 24));
    return diasRestantes <= 7 && diasRestantes >= 0;
  }).sort((a, b) => new Date(a.prazo_validade) - new Date(b.prazo_validade));

  if (urgentes.length === 0) return null;

  return (
    <div className="bg-white/80 backdrop-blur-lg rounded-2xl p-6 border border-slate-200/50 shadow-lg">
      <div className="flex items-center gap-3 mb-6">
        <AlertTriangle className="w-6 h-6 text-orange-600" />
        <h2 className="text-xl font-bold text-slate-800">Orçamentos Urgentes</h2>
      </div>
      <div className="space-y-4">
        {urgentes.map((orcamento) => {
          const diasRestantes = Math.ceil((new Date(orcamento.prazo_validade) - hoje) / (1000 * 60 * 60 * 24));
          return (
            <div key={orcamento.id} className="bg-slate-50/80 p-4 rounded-xl border border-slate-200/50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <p className="font-bold text-slate-800">{orcamento.cliente_nome}</p>
                <p className="text-sm text-slate-600">{orcamento.vendedor}</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-slate-500" />
                  <span className="font-medium text-slate-700">R$ {orcamento.valor_total?.toLocaleString('pt-BR') || '0'}</span>
                </div>
                <div className="flex items-center gap-2 text-sm font-semibold bg-orange-100 text-orange-700 px-3 py-1 rounded-full">
                  <Clock className="w-4 h-4" />
                  <span>
                    {diasRestantes <= 0 ? 'Vence Hoje' : `${diasRestantes} dia(s)`}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}