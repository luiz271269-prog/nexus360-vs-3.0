import { Button } from "@/components/ui/button";
import { X, Download } from "lucide-react";

export default function DetalhesModal({ 
  title, 
  dados, 
  colunas, 
  onClose, 
  onExport
}) {
  if (!dados || dados.length === 0) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
        <div className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl p-8 max-w-md w-full shadow-2xl">
          <div className="text-center">
            <h2 className="text-xl font-bold text-slate-800 mb-4">{title}</h2>
            <p className="text-slate-600 mb-6">Nenhum dado encontrado para este período.</p>
            <Button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 text-white">
              Fechar
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/90 backdrop-blur-xl border border-slate-200/50 rounded-2xl w-full max-w-6xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="p-6 border-b border-slate-200/50 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">{title}</h2>
            <p className="text-slate-600">{dados.length} registros encontrados</p>
          </div>
          <div className="flex gap-3">
            {onExport && (
              <Button
                onClick={() => onExport(dados)}
                variant="outline"
                className="bg-white/80 border-slate-200"
              >
                <Download className="w-4 h-4 mr-2" />
                Exportar
              </Button>
            )}
            <Button
              onClick={onClose}
              variant="ghost"
              size="icon"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Tabela */}
        <div className="flex-grow overflow-auto p-6">
          <div className="border border-slate-200 rounded-lg overflow-hidden bg-white/80">
            <table className="w-full text-sm">
              <thead className="bg-slate-100/80">
                <tr>
                  {colunas.map((coluna, index) => (
                    <th key={index} className="p-3 text-left border-r border-slate-200 last:border-r-0 font-semibold text-slate-700">
                      {coluna.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {dados.map((item, index) => (
                  <tr key={index} className="border-b border-slate-200 last:border-b-0 hover:bg-slate-50/50">
                    {colunas.map((coluna, colIndex) => (
                      <td key={colIndex} className="p-3 border-r border-slate-200 last:border-r-0">
                        {coluna.formato ? coluna.formato(item[coluna.campo]) : item[coluna.campo]}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200/50 bg-slate-50/80">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-600">
              Total de {dados.length} registros
            </p>
            <Button onClick={onClose} className="bg-slate-600 hover:bg-slate-700 text-white">
              Fechar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}