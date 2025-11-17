
import { TrendingUp, FileText } from "lucide-react"; // Added FileText import

export default function Relatorios() {
  return (
    <div className="space-y-6 p-6"> {/* Changed root div styling */}
      {/* Header com Gradiente Laranja */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl shadow-xl border-2 border-slate-700/50 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-2xl flex items-center justify-center shadow-2xl shadow-orange-500/50">
              <FileText className="w-9 h-9 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 bg-clip-text text-transparent">
                Relatórios Executivos
              </h1>
              <p className="text-slate-300 mt-1">
                Análises estratégicas e reports customizados
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Original content, adapted to fit new layout */}
      {/* Removed h-[80vh] from this div as it no longer needs to fill the entire viewport height below the header */}
      <div className="flex items-center justify-center"> 
        <div className="text-center bg-white/5 p-12 rounded-2xl">
          <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white">Relatórios Avançados</h1>
          <p className="text-gray-400 mt-2">Esta funcionalidade está em desenvolvimento.</p>
        </div>
      </div>
    </div>
  );
}
