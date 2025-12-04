import React, { useState, useEffect } from "react";
import { SubFlowTemplate } from "@/entities/SubFlowTemplate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Package, Plus, Edit, Trash2, Play } from "lucide-react";
import { toast } from "sonner";
import FlowBuilderV2 from "./FlowBuilderV2";

/**
 * Gerenciador de Sub-Fluxos Reutilizáveis
 */
export default function SubFlowManager() {
  const [subFlows, setSubFlows] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingSubFlow, setEditingSubFlow] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarSubFlows();
  }, []);

  const carregarSubFlows = async () => {
    try {
      const data = await SubFlowTemplate.list('-created_date');
      setSubFlows(data);
    } catch (error) {
      console.error("Erro ao carregar sub-fluxos:", error);
      toast.error("Erro ao carregar sub-fluxos");
    }
    setLoading(false);
  };

  const criarSubFlow = () => {
    setEditingSubFlow(null);
    setShowEditor(true);
  };

  const editarSubFlow = (subFlow) => {
    setEditingSubFlow(subFlow);
    setShowEditor(true);
  };

  const salvarSubFlow = async (dadosSubFlow) => {
    try {
      if (editingSubFlow) {
        await SubFlowTemplate.update(editingSubFlow.id, dadosSubFlow);
        toast.success("Sub-fluxo atualizado");
      } else {
        await SubFlowTemplate.create(dadosSubFlow);
        toast.success("Sub-fluxo criado");
      }
      
      setShowEditor(false);
      setEditingSubFlow(null);
      carregarSubFlows();
      
    } catch (error) {
      console.error("Erro ao salvar sub-fluxo:", error);
      toast.error("Erro ao salvar sub-fluxo");
    }
  };

  const excluirSubFlow = async (id) => {
    if (!confirm("Tem certeza que deseja excluir este sub-fluxo?")) return;
    
    try {
      await SubFlowTemplate.delete(id);
      toast.success("Sub-fluxo excluído");
      carregarSubFlows();
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir sub-fluxo");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-600">Carregando...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Sub-Fluxos Reutilizáveis</h2>
          <p className="text-slate-600 mt-1">
            Crie blocos de automação que podem ser reutilizados em múltiplos fluxos
          </p>
        </div>
        <Button onClick={criarSubFlow} className="bg-gradient-to-r from-teal-600 to-cyan-600">
          <Plus className="w-5 h-5 mr-2" />
          Novo Sub-Fluxo
        </Button>
      </div>

      {subFlows.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Package className="w-16 h-16 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Nenhum sub-fluxo criado
            </h3>
            <p className="text-slate-600 mb-4">
              Sub-fluxos são blocos reutilizáveis que podem ser usados em diferentes automações
            </p>
            <Button onClick={criarSubFlow}>
              <Plus className="w-4 h-4 mr-2" />
              Criar Primeiro Sub-Fluxo
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {subFlows.map((subFlow) => (
            <Card key={subFlow.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center">
                      <Package className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{subFlow.nome}</CardTitle>
                      <Badge variant="outline" className="mt-1">{subFlow.categoria}</Badge>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-600 mb-4">
                  {subFlow.descricao || 'Sem descrição'}
                </p>
                <div className="text-xs text-slate-500 mb-4">
                  {subFlow.steps?.length || 0} blocos
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => editarSubFlow(subFlow)}
                    className="flex-1"
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => excluirSubFlow(subFlow.id)}
                  >
                    <Trash2 className="w-4 h-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showEditor} onOpenChange={setShowEditor}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
          <FlowBuilderV2
            flowId={editingSubFlow?.id}
            onSave={salvarSubFlow}
            onCancel={() => setShowEditor(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}