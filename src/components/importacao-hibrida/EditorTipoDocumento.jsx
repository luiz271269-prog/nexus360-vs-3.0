import { useState, useEffect } from "react";
import { TipoDocumento } from "@/entities/TipoDocumento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { 
  Plus, Edit, Trash2, Save, X, Settings, FileText, Code
} from "lucide-react";

export default function EditorTipoDocumento({ tipos, onTiposChange }) {
  const [tiposList, setTiposList] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [editingTipo, setEditingTipo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    carregarTipos();
  }, []);

  const carregarTipos = async () => {
    setLoading(true);
    try {
      const data = await TipoDocumento.list("-created_date");
      setTiposList(data);
    } catch (error) {
      console.error("Erro ao carregar tipos:", error);
    }
    setLoading(false);
  };

  const handleSalvar = async (tipoData) => {
    setLoading(true);
    try {
      if (editingTipo) {
        await TipoDocumento.update(editingTipo.id, tipoData);
      } else {
        await TipoDocumento.create(tipoData);
      }
      setShowForm(false);
      setEditingTipo(null);
      await carregarTipos();
      if (onTiposChange) onTiposChange();
    } catch (error) {
      console.error("Erro ao salvar tipo:", error);
      alert("Erro ao salvar tipo de documento");
    }
    setLoading(false);
  };

  const handleExcluir = async (tipo) => {
    if (!confirm(`Tem certeza que deseja excluir o tipo "${tipo.nome}"?`)) {
      return;
    }
    
    setLoading(true);
    try {
      await TipoDocumento.delete(tipo.id);
      await carregarTipos();
      if (onTiposChange) onTiposChange();
    } catch (error) {
      console.error("Erro ao excluir tipo:", error);
      alert("Erro ao excluir tipo de documento");
    }
    setLoading(false);
  };

  const handleToggleAtivo = async (tipo) => {
    setLoading(true);
    try {
      await TipoDocumento.update(tipo.id, { ...tipo, ativo: !tipo.ativo });
      await carregarTipos();
      if (onTiposChange) onTiposChange();
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
            <Settings className="w-6 h-6 text-indigo-600" />
            Gerenciar Tipos de Documento
          </h2>
          <p className="text-slate-600 mt-1">Configure os tipos de documentos que a IA pode detectar</p>
        </div>
        <Button
          onClick={() => { setEditingTipo(null); setShowForm(true); }}
          className="bg-indigo-600 hover:bg-indigo-700"
        >
          <Plus className="w-4 h-4 mr-2" />
          Novo Tipo
        </Button>
      </div>

      {/* Lista de Tipos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {loading ? (
          Array(4).fill(0).map((_, i) => (
            <div key={i} className="bg-slate-100 rounded-xl h-48 animate-pulse" />
          ))
        ) : (
          tiposList.map((tipo) => (
            <TipoCard
              key={tipo.id}
              tipo={tipo}
              onEditar={() => { setEditingTipo(tipo); setShowForm(true); }}
              onExcluir={() => handleExcluir(tipo)}
              onToggleAtivo={() => handleToggleAtivo(tipo)}
              loading={loading}
            />
          ))
        )}
      </div>

      {tiposList.length === 0 && !loading && (
        <div className="text-center py-12 bg-slate-50/80 rounded-xl">
          <FileText className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-xl font-bold text-slate-800">Nenhum tipo cadastrado</p>
          <p className="text-slate-600 mt-2">Clique em "Novo Tipo" para começar.</p>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <TipoForm
          tipo={editingTipo}
          onSalvar={handleSalvar}
          onCancelar={() => { setShowForm(false); setEditingTipo(null); }}
          loading={loading}
        />
      )}
    </div>
  );
}

// Componente para Card de Tipo
function TipoCard({ tipo, onEditar, onExcluir, onToggleAtivo, loading }) {
  const numCampos = tipo.schema_campos?.properties ? Object.keys(tipo.schema_campos.properties).length : 0;
  const numExemplos = tipo.exemplos_treinamento?.length || 0;
  const numObrigatorios = tipo.campos_obrigatorios?.length || 0;

  return (
    <div className={`bg-white/90 backdrop-blur-sm rounded-xl p-6 border shadow-lg hover:shadow-xl transition-all ${
      !tipo.ativo ? 'opacity-60' : ''
    }`}>
      
      {/* Header do Card */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex-grow">
          <div className="flex items-center gap-3 mb-2">
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
              tipo.ativo ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'
            }`}>
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-800">{tipo.nome}</h3>
              <Badge variant="outline" className="text-xs">{tipo.codigo}</Badge>
            </div>
          </div>
          
          {tipo.descricao && (
            <p className="text-sm text-slate-600 mb-3 line-clamp-2">{tipo.descricao}</p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4">
          <Switch 
            checked={tipo.ativo} 
            onCheckedChange={onToggleAtivo}
            disabled={loading}
          />
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-slate-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-slate-800">{numCampos}</div>
          <div className="text-xs text-slate-500">Campos</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-emerald-700">{numExemplos}</div>
          <div className="text-xs text-slate-500">Exemplos</div>
        </div>
        <div className="bg-orange-50 rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-orange-700">{numObrigatorios}</div>
          <div className="text-xs text-slate-500">Obrigatórios</div>
        </div>
      </div>

      {/* Configurações Avançadas */}
      <div className="flex flex-wrap gap-2 mb-4">
        {tipo.multi_label && (
          <Badge className="bg-blue-100 text-blue-700 text-xs">Multi-label</Badge>
        )}
        <Badge variant="outline" className="text-xs">
          Min. {tipo.confianca_minima || 80}% confiança
        </Badge>
        <Badge variant="outline" className="text-xs">
          v{tipo.versao_schema || '1.0'}
        </Badge>
      </div>

      {/* Ações */}
      <div className="flex gap-2">
        <Button onClick={onEditar} variant="outline" className="flex-1" disabled={loading}>
          <Edit className="w-4 h-4 mr-2" />
          Editar
        </Button>
        <Button 
          onClick={onExcluir} 
          variant="outline" 
          className="text-red-600 hover:bg-red-50"
          disabled={loading}
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

// Componente para Form de Tipo
function TipoForm({ tipo, onSalvar, onCancelar, loading }) {
  const [formData, setFormData] = useState(tipo || {
    nome: '',
    codigo: '',
    descricao: '',
    schema_campos: { type: 'object', properties: {} },
    regras_validacao: {},
    exemplos_treinamento: [],
    confianca_minima: 80,
    multi_label: false,
    ativo: true,
    campos_obrigatorios: [],
    versao_schema: '1.0'
  });

  const [schemaJson, setSchemaJson] = useState(
    JSON.stringify(formData.schema_campos || { type: 'object', properties: {} }, null, 2)
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const parsedSchema = JSON.parse(schemaJson);
      await onSalvar({ ...formData, schema_campos: parsedSchema });
    } catch (error) {
      alert('Erro no formato JSON do schema. Verifique a sintaxe.');
    }
  };

  const handleChange = (campo, valor) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white/95 backdrop-blur-xl rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-auto shadow-2xl">
        
        <div className="p-6 border-b border-slate-200">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold text-slate-800">
              {tipo ? 'Editar Tipo' : 'Novo Tipo de Documento'}
            </h2>
            <Button onClick={onCancelar} size="icon" variant="ghost">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Informações Básicas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nome do Tipo *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => handleChange('nome', e.target.value)}
                placeholder="Ex: Nota Fiscal, Contrato..."
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Código *</Label>
              <Input
                value={formData.codigo}
                onChange={(e) => handleChange('codigo', e.target.value.toUpperCase())}
                placeholder="Ex: NF, CONTRATO..."
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={formData.descricao}
              onChange={(e) => handleChange('descricao', e.target.value)}
              placeholder="Descreva quando e como usar este tipo..."
              rows={3}
            />
          </div>

          {/* Schema JSON */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Code className="w-4 h-4" />
              Schema de Campos (JSON) *
            </Label>
            <Textarea
              value={schemaJson}
              onChange={(e) => setSchemaJson(e.target.value)}
              placeholder='{"type": "object", "properties": {"campo1": {"type": "string", "description": "Descrição"}}}'
              rows={8}
              className="font-mono text-sm"
            />
            <p className="text-xs text-slate-500">
              Define quais campos a IA deve extrair e seus tipos
            </p>
          </div>

          {/* Configurações Avançadas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Confiança Mínima (%)</Label>
              <Input
                type="number"
                min="0"
                max="100"
                value={formData.confianca_minima}
                onChange={(e) => handleChange('confianca_minima', parseInt(e.target.value) || 80)}
              />
            </div>
            <div className="space-y-2">
              <Label>Versão do Schema</Label>
              <Input
                value={formData.versao_schema}
                onChange={(e) => handleChange('versao_schema', e.target.value)}
                placeholder="1.0"
              />
            </div>
          </div>

          {/* Switches */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <Label>Multi-label</Label>
                <p className="text-sm text-slate-500">Pode coexistir com outros tipos no mesmo documento</p>
              </div>
              <Switch
                checked={formData.multi_label}
                onCheckedChange={(checked) => handleChange('multi_label', checked)}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <Label>Ativo</Label>
                <p className="text-sm text-slate-500">Disponível para classificação automática</p>
              </div>
              <Switch
                checked={formData.ativo}
                onCheckedChange={(checked) => handleChange('ativo', checked)}
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-4 pt-4 border-t">
            <Button type="button" onClick={onCancelar} variant="ghost">
              Cancelar
            </Button>
            <Button type="submit" disabled={loading} className="bg-indigo-600 hover:bg-indigo-700">
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : 'Salvar Tipo'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}