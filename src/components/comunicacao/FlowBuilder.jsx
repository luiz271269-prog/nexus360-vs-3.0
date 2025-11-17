import { useState, useEffect } from "react";
import { FlowTemplate } from "@/entities/FlowTemplate";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Bot, Zap, MessageSquare, Plus, Loader2 } from "lucide-react";

export default function FlowBuilder({ onClose }) {
  const [fluxosAtivos, setFluxosAtivos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    carregarFluxos();
  }, []);

  const carregarFluxos = async () => {
    setLoading(true);
    try {
      const data = await FlowTemplate.list("-created_date");
      setFluxosAtivos(data);
    } catch (error) {
      console.error("Erro ao carregar fluxos:", error);
      // Fallback para lista vazia em caso de erro, como timeout
      setFluxosAtivos([]);
    }
    setLoading(false);
  };

  const fluxosModelo = [
    {
      nome: "Pós-venda e Fidelização",
      categoria: "pos_venda",
      descricao: "Sequência de pós-venda e satisfação.",
      trigger: "Venda finalizada",
      icon: MessageSquare,
      cor: "green",
      steps: [
        { tipo: "aguardar", config: { minutos: 120 }, descricao: "Aguardar 2 horas" },
        { tipo: "whatsapp_texto", config: { template: "Sua compra foi um sucesso! Esperamos que goste. Para qualquer dúvida, estou à disposição." }, descricao: "Msg Pós-venda" }
      ]
    },
    {
      nome: "Campanha Promocional",
      categoria: "promocional",
      descricao: "Envio segmentado de promoções.",
      trigger: "Data específica",
      icon: Zap,
      cor: "purple",
      steps: [
        { tipo: "whatsapp_texto", config: { template: "Temos uma oferta especial para você esta semana! Confira..." }, descricao: "Msg Promocional" }
      ]
    }
  ];

  const criarFluxoModelo = async (modelo) => {
    setCreating(true);
    try {
      await FlowTemplate.create({
        nome: modelo.nome,
        categoria: modelo.categoria,
        trigger_type: "manual",
        trigger_config: { motivo: modelo.trigger },
        steps: modelo.steps,
        ativo: true,
        segmentos_alvo: ["todos"]
      });
      alert(`Fluxo "${modelo.nome}" criado e ativado com sucesso!`);
      carregarFluxos();
    } catch (error) {
      console.error("Erro ao criar fluxo:", error);
      alert("Erro ao criar fluxo a partir do template.");
    }
    setCreating(false);
  };

  const getCategoriaInfo = (categoria) => {
    const cores = {
      nurturing: "bg-blue-100 text-blue-700",
      follow_up: "bg-orange-100 text-orange-700",
      pos_venda: "bg-green-100 text-green-700",
      promocional: "bg-purple-100 text-purple-700"
    };
    return cores[categoria] || "bg-gray-100 text-gray-700";
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            <Bot className="w-6 h-6 text-indigo-600" />
            <h2 className="text-2xl font-bold text-slate-800">Creator de Fluxos</h2>
          </div>
          <Button onClick={onClose} size="icon" variant="ghost">
            <X className="w-5 h-5" />
          </Button>
        </div>
        
        <div className="mb-8">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Fluxos Ativos ({fluxosAtivos.length})</h3>
          {loading ? (
             <div className="text-center py-8"><Loader2 className="w-8 h-8 mx-auto animate-spin text-indigo-600"/></div>
          ) : fluxosAtivos.length === 0 ? (
            <div className="text-center py-8 bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
              <Bot className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-slate-600">Nenhum fluxo criado ainda</p>
              <p className="text-slate-500 text-sm mt-1">Use os templates abaixo para começar</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fluxosAtivos.map((fluxo) => (
                <div key={fluxo.id} className="border border-slate-200 rounded-lg p-4 bg-white shadow-sm">
                  <div className="flex justify-between items-start mb-3">
                    <h4 className="font-medium text-slate-900">{fluxo.nome}</h4>
                    <Badge className={getCategoriaInfo(fluxo.categoria)}>
                      {fluxo.categoria}
                    </Badge>
                  </div>
                  <div className="text-sm text-slate-600 space-y-1">
                    <p><span className="font-semibold">Gatilho:</span> {fluxo.trigger_type}</p>
                    <p><span className="font-semibold">Passos:</span> {fluxo.steps?.length || 0}</p>
                    <p><span className="font-semibold">Status:</span> {fluxo.ativo ? <span className="text-green-600">Ativo</span> : "Inativo"}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-slate-200 pt-6">
          <h3 className="text-lg font-semibold text-slate-800 mb-4">Templates Prontos</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fluxosModelo.map((modelo, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      modelo.cor === 'blue' ? 'bg-blue-100' :
                      modelo.cor === 'orange' ? 'bg-orange-100' :
                      modelo.cor === 'green' ? 'bg-green-100' : 'bg-purple-100'
                    }`}>
                      <modelo.icon className={`w-5 h-5 ${
                        modelo.cor === 'blue' ? 'text-blue-600' :
                        modelo.cor === 'orange' ? 'text-orange-600' :
                        modelo.cor === 'green' ? 'text-green-600' : 'text-purple-600'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-medium text-slate-900">{modelo.nome}</h4>
                      <p className="text-sm text-slate-600">{modelo.descricao}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between text-sm text-slate-500 mb-4">
                  <span>Gatilho: {modelo.trigger}</span>
                  <span>{modelo.steps?.length || 0} passos</span>
                </div>

                <Button 
                  onClick={() => criarFluxoModelo(modelo)}
                  disabled={creating}
                  className="w-full"
                  variant="outline"
                >
                  {creating ? <Loader2 className="w-4 h-4 mr-2 animate-spin"/> : <Plus className="w-4 h-4 mr-2" />}
                  {creating ? "Criando..." : "Usar Template"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end mt-6">
          <Button onClick={onClose} className="bg-indigo-600 hover:bg-indigo-700">
            Fechar
          </Button>
        </div>
      </div>
    </div>
  );
}