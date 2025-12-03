import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Phone, MessageCircle, Mail, Users, Clock } from "lucide-react";
import { Interacao } from "@/entities/Interacao";

export default function RegistroInteracaoModal({ cliente, vendedorNome, onSalvar, onCancelar }) {
  const [formData, setFormData] = useState({
    cliente_id: cliente.id,
    cliente_nome: cliente.razao_social,
    vendedor: vendedorNome,
    tipo_interacao: "ligacao",
    data_interacao: new Date().toISOString(),
    duracao_minutos: 0,
    resultado: "sucesso",
    observacoes: "",
    proximo_passo: "",
    data_proximo_contato: "",
    temperatura_cliente: "morno"
  });
  
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await Interacao.create(formData);
      onSalvar();
    } catch (error) {
      console.error("Erro ao salvar interação:", error);
    }
    setLoading(false);
  };

  const tiposInteracao = [
    { value: "ligacao", label: "Ligação", icon: Phone },
    { value: "whatsapp", label: "WhatsApp", icon: MessageCircle },
    { value: "email", label: "E-mail", icon: Mail },
    { value: "reuniao", label: "Reunião", icon: Users },
    { value: "visita", label: "Visita", icon: Users },
    { value: "outro", label: "Outro", icon: Clock }
  ];

  const resultados = [
    { value: "sucesso", label: "Sucesso - Cliente atendeu", color: "text-green-600" },
    { value: "sem_contato", label: "Sem contato", color: "text-gray-600" },
    { value: "reagendado", label: "Reagendado", color: "text-blue-600" },
    { value: "interessado", label: "Interessado", color: "text-emerald-600" },
    { value: "nao_interessado", label: "Não interessado", color: "text-red-600" },
    { value: "orcamento_solicitado", label: "Orçamento solicitado", color: "text-purple-600" },
    { value: "venda_fechada", label: "Venda fechada", color: "text-green-700" }
  ];

  const temperaturas = [
    { value: "frio", label: "Frio", color: "text-blue-500" },
    { value: "morno", label: "Morno", color: "text-yellow-500" },
    { value: "quente", label: "Quente", color: "text-orange-500" },
    { value: "muito_quente", label: "Muito Quente", color: "text-red-500" }
  ];

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white">Registrar Interação</h2>
            <p className="text-slate-400">Cliente: {cliente.razao_social}</p>
          </div>
          <Button onClick={onCancelar} size="icon" variant="ghost" className="text-slate-400">
            <X className="w-5 h-5" />
          </Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Tipo e Data */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-slate-300">Tipo de Contato</Label>
              <Select value={formData.tipo_interacao} onValueChange={(value) => setFormData(prev => ({...prev, tipo_interacao: value}))}>
                <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 text-white border-slate-700">
                  {tiposInteracao.map((tipo) => (
                    <SelectItem key={tipo.value} value={tipo.value}>
                      <div className="flex items-center gap-2">
                        <tipo.icon className="w-4 h-4" />
                        {tipo.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-slate-300">Duração (minutos)</Label>
              <Input 
                type="number" 
                value={formData.duracao_minutos}
                onChange={(e) => setFormData(prev => ({...prev, duracao_minutos: parseInt(e.target.value) || 0}))}
                className="bg-slate-800/50 border-slate-700 text-white"
                min="0"
              />
            </div>
          </div>

          {/* Resultado */}
          <div>
            <Label className="text-slate-300">Resultado do Contato</Label>
            <Select value={formData.resultado} onValueChange={(value) => setFormData(prev => ({...prev, resultado: value}))}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 text-white border-slate-700">
                {resultados.map((resultado) => (
                  <SelectItem key={resultado.value} value={resultado.value}>
                    <span className={resultado.color}>{resultado.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Temperatura do Cliente */}
          <div>
            <Label className="text-slate-300">Temperatura do Cliente</Label>
            <Select value={formData.temperatura_cliente} onValueChange={(value) => setFormData(prev => ({...prev, temperatura_cliente: value}))}>
              <SelectTrigger className="bg-slate-800/50 border-slate-700 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 text-white border-slate-700">
                {temperaturas.map((temp) => (
                  <SelectItem key={temp.value} value={temp.value}>
                    <span className={temp.color}>{temp.label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Observações */}
          <div>
            <Label className="text-slate-300">Observações</Label>
            <Textarea 
              value={formData.observacoes}
              onChange={(e) => setFormData(prev => ({...prev, observacoes: e.target.value}))}
              placeholder="Descreva como foi a conversa, principais pontos discutidos..."
              className="bg-slate-800/50 border-slate-700 text-white h-24"
            />
          </div>

          {/* Próximo Passo */}
          <div>
            <Label className="text-slate-300">Próximo Passo</Label>
            <Input 
              value={formData.proximo_passo}
              onChange={(e) => setFormData(prev => ({...prev, proximo_passo: e.target.value}))}
              placeholder="Ex: Enviar proposta, agendar reunião..."
              className="bg-slate-800/50 border-slate-700 text-white"
            />
          </div>

          {/* Data Próximo Contato */}
          <div>
            <Label className="text-slate-300">Próximo Contato Agendado</Label>
            <Input 
              type="date"
              value={formData.data_proximo_contato}
              onChange={(e) => setFormData(prev => ({...prev, data_proximo_contato: e.target.value}))}
              className="bg-slate-800/50 border-slate-700 text-white"
            />
          </div>

          <div className="flex justify-end gap-4 pt-4">
            <Button type="button" onClick={onCancelar} variant="ghost" className="text-slate-400">
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading} 
              className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:opacity-90 text-white"
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? "Salvando..." : "Salvar Interação"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}