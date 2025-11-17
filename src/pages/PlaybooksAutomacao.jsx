
import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Play, Pause, Plus, Edit, Trash2, TrendingUp, Search } from "lucide-react";
import { toast } from "sonner";
import PlaybookVisualEditor from "../components/automacao/PlaybookVisualEditor";
import PermissionGuard, { PERMISSIONS } from "../components/security/PermissionGuard";

export default function PlaybooksAutomacao() {
  return (
    <PermissionGuard permission={PERMISSIONS.MANAGE_AUTOMATIONS}>
      <PlaybooksContent />
    </PermissionGuard>
  );
}

function PlaybooksContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showEditor, setShowEditor] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: playbooks = [], isLoading } = useQuery({
    queryKey: ['playbooks'],
    queryFn: () => base44.entities.FlowTemplate.list('-created_date'),
    initialData: []
  });

  const saveMutation = useMutation({
    mutationFn: (data) => {
      if (editingPlaybook) {
        return base44.entities.FlowTemplate.update(editingPlaybook.id, data);
      }
      return base44.entities.FlowTemplate.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries(['playbooks']);
      toast.success('Playbook salvo!');
      setShowEditor(false);
      setEditingPlaybook(null);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.FlowTemplate.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(['playbooks']);
      toast.success('Playbook excluído!');
    }
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, ativo }) => base44.entities.FlowTemplate.update(id, { ativo }),
    onSuccess: () => {
      queryClient.invalidateQueries(['playbooks']);
      toast.success('Status atualizado!');
    }
  });

  const filteredPlaybooks = playbooks.filter(p =>
    !searchTerm || p.nome?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showEditor) {
    return (
      <PlaybookVisualEditor
        playbook={editingPlaybook}
        onSave={(data) => saveMutation.mutate(data)}
        onCancel={() => {
          setShowEditor(false);
          setEditingPlaybook(null);
        }}
      />
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Playbooks de Automação</h1>
        <Button onClick={() => setShowEditor(true)} className="bg-purple-600">
          <Plus className="w-4 h-4 mr-2" />
          Novo Playbook
        </Button>
      </div>

      <div className="flex gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-5 h-5" />
            <Input
              placeholder="Buscar playbooks..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12">Carregando...</div>
      ) : filteredPlaybooks.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <p className="text-slate-500">Nenhum playbook encontrado.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlaybooks.map((playbook) => (
            <Card key={playbook.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{playbook.nome}</CardTitle>
                    <p className="text-sm text-slate-600">{playbook.descricao}</p>
                  </div>
                  <Badge variant={playbook.ativo ? "default" : "secondary"}>
                    {playbook.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1">
                    {playbook.gatilhos?.slice(0, 3).map((g, i) => (
                      <Badge key={i} variant="outline" className="text-xs">
                        {g}
                      </Badge>
                    ))}
                    {playbook.gatilhos?.length > 3 && (
                      <Badge variant="outline" className="text-xs">
                        +{playbook.gatilhos.length - 3}
                      </Badge>
                    )}
                  </div>

                  <div className="flex items-center justify-between text-sm text-slate-600">
                    <span>{playbook.steps?.length || 0} etapas</span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      {playbook.metricas?.taxa_sucesso || 0}% sucesso
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleMutation.mutate({ id: playbook.id, ativo: !playbook.ativo })}
                      className="flex-1"
                    >
                      {playbook.ativo ? <Pause className="w-4 h-4 mr-1" /> : <Play className="w-4 h-4 mr-1" />}
                      {playbook.ativo ? 'Pausar' : 'Ativar'}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditingPlaybook(playbook);
                        setShowEditor(true);
                      }}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm('Excluir este playbook?')) {
                          deleteMutation.mutate(playbook.id);
                        }
                      }}
                      className="text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
