import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { X, Save, Sparkles, AlertCircle, Info, Check, Loader2, Clock, MessageSquare } from "lucide-react";
import VoiceInput from "../ui/VoiceInput";
import { listarVendedoresParaSelect } from '../lib/vendedorSync';
import { REGRAS_VALIDACAO_POR_ETAPA } from './ClienteFormValidation';
import { toast } from "sonner";
import HistoricoQualificacaoCliente from './HistoricoQualificacaoCliente';

const NOMES_ETAPAS = {
  novo_lead: 'Novo Lead',
  primeiro_contato: 'Primeiro Contato',
  em_conversa: 'Em Conversa',
  levantamento_dados: 'Levantamento de Dados',
  pre_qualificado: 'Pré-Qualificado',
  qualificacao_tecnica: 'Qualificação Técnica',
  em_aquecimento: 'Em Aquecimento',
  lead_qualificado: 'Lead Qualificado',
  desqualificado: 'Desqualificado',
  Prospect: 'Prospect',
  Ativo: 'Cliente Ativo',
  'Em Risco': 'Cliente Em Risco',
  Promotor: 'Cliente Promotor'
};

const GlassInput = (props) => {
  const isDestacado = props.destacado;
  return (
    <Input
      {...props}
      className={`${isDestacado ? 'bg-yellow-500/20 border-yellow-400/50 ring-2 ring-yellow-400/30 animate-pulse' : 'bg-black/20 border-white/20'} text-white placeholder:text-gray-400`} />);
};

const GlassTextarea = (props) => {
  const isDestacado = props.destacado;
  return (
    <Textarea
      {...props}
      className={`${isDestacado ? 'bg-yellow-500/20 border-yellow-400/50 ring-2 ring-yellow-400/30 animate-pulse' : 'bg-black/20 border-white/20'} text-white placeholder:text-gray-400`} />);
};

const GlassSelect = ({ children, destacado, ...props }) =>
<Select {...props}>
    <SelectTrigger className={`${destacado ? 'bg-yellow-500/20 border-yellow-400/50 ring-2 ring-yellow-400/30 animate-pulse' : 'bg-black/20 border-white/20'} text-white`}>
      <SelectValue placeholder="Selecione..." />
    </SelectTrigger>
    <SelectContent className="bg-gray-800 text-white border-white/20">{children}</SelectContent>
  </Select>;

export default function ClienteForm({ cliente, novoStatus, onSave, onCancel }) {
  const [formData, setFormData] = useState(cliente || {
    razao_social: "",
    nome_fantasia: "",
    cnpj: "",
    telefone: "",
    email: "",
    endereco: "",
    contato_principal_nome: "",
    contato_principal_cargo: "",
    numero_maquinas: 0,
    numero_funcionarios: 0,
    interesses_produtos: [],
    vendedor_responsavel: "",
    classificacao: "B - Médio Potencial",
    segmento: "PME",
    status: "novo_lead",
    necessidade_verificada: false,
    capacidade_compra_verificada: false,
    motivo_desqualificacao: "",
    observacoes: "",
    valor_recorrente_mensal: 0
  });
  const [interesseAtual, setInteresseAtual] = useState("");

  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);

  const statusAlvo = novoStatus || formData.status;
  const regrasEtapa = REGRAS_VALIDACAO_POR_ETAPA[statusAlvo];
  const camposDestacados = regrasEtapa?.camposDestacados || [];

  const getTituloFormulario = () => {
    if (novoStatus) {
      return `Avançar Lead para: ${NOMES_ETAPAS[novoStatus] || novoStatus}`;
    }

    if (cliente) {
      return "Editar Lead/Cliente";
    }

    return "Novo Lead";
  };

  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    if (!cliente?.id) {
      return;
    }

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    setSaveStatus('saving');

    saveTimeoutRef.current = setTimeout(async () => {
      await salvarAutomaticamente();
    }, 1000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [formData, cliente?.id]);

  const salvarAutomaticamente = async () => {
    try {
      const dataToSave = {
        ...formData,
        valor_recorrente_mensal: Number(formData.valor_recorrente_mensal) || 0,
        numero_maquinas: Number(formData.numero_maquinas) || 0,
        numero_funcionarios: Number(formData.numero_funcionarios) || 0
      };

      await onSave(dataToSave, true);

      setSaveStatus('saved');

    } catch (error) {
      console.error('Erro ao salvar automaticamente:', error);
      setSaveStatus('error');
      toast.error('Erro ao salvar automaticamente');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const dataToSave = {
        ...formData,
        valor_recorrente_mensal: Number(formData.valor_recorrente_mensal) || 0,
        numero_maquinas: Number(formData.numero_maquinas) || 0,
        numero_funcionarios: Number(formData.numero_funcionarios) || 0
      };

      await onSave(dataToSave, false);
    } catch (error) {
      console.error('Erro ao salvar cliente:', error);
      toast.error('Erro ao salvar as informações.');
    }
  };

  const handleChange = (campo, valor) => {
    setFormData((prev) => ({ ...prev, [campo]: valor }));
  };

  const handleAdicionarInteresse = () => {
    if (interesseAtual.trim()) {
      const interessesAtuais = formData.interesses_produtos || [];
      setFormData((prev) => ({
        ...prev,
        interesses_produtos: [...interessesAtuais, interesseAtual.trim()]
      }));
      setInteresseAtual("");
    }
  };

  const handleRemoverInteresse = (index) => {
    const interessesAtuais = formData.interesses_produtos || [];
    setFormData((prev) => ({
      ...prev,
      interesses_produtos: interessesAtuais.filter((_, i) => i !== index)
    }));
  };

  const handleVoiceTranscription = (result, metadata) => {
    if (typeof result === 'object') {
      Object.keys(result).forEach((campo) => {
        if (formData.hasOwnProperty(campo) && result[campo]) {
          setFormData((prev) => ({ ...prev, [campo]: result[campo] }));
        }
      });
    }
  };

  const handleVoiceError = (error) => {
    console.error('Erro na transcrição:', error);
  };

  const isLeadStatus = ['novo_lead', 'primeiro_contato', 'em_conversa', 'levantamento_dados',
  'pre_qualificado', 'qualificacao_tecnica', 'em_aquecimento',
  'lead_qualificado', 'desqualificado'].includes(formData.status);

  const SaveIndicator = () => {
    if (!cliente?.id) return null;

    return (
      <div className="flex items-center gap-2 px-3 py-1 rounded-lg bg-black/20 border border-white/10 w-fit">
        {saveStatus === 'saving' &&
        <>
            <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
            <span className="text-sm text-blue-400">Salvando...</span>
          </>
        }
        {saveStatus === 'saved' &&
        <>
            <Check className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400">Salvo</span>
          </>
        }
        {saveStatus === 'error' &&
        <>
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm text-red-400">Erro!</span>
          </>
        }
      </div>);
  };

  return (
    <div className="bg-gray-900/90 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-[95vw] w-full max-h-[95vh] overflow-hidden shadow-2xl">
      <div className="flex justify-between items-center mb-3">
        <div className="flex flex-col gap-1">
          <h2 className="text-white text-lg font-bold flex items-center gap-2">
            {getTituloFormulario()}
            {isLeadStatus &&
            <span className="px-2 py-1 bg-blue-500 text-white text-xs rounded-full">
                Funil
              </span>
            }
          </h2>
          <SaveIndicator />
        </div>
        <div className="flex items-center gap-2">
          <VoiceInput
            onTranscription={handleVoiceTranscription}
            onError={handleVoiceError}
            contextType="form"
            contextData={{
              formFields: ["razao_social", "nome_fantasia", "cnpj", "telefone", "email", "endereco", "observacoes"],
              formType: "cliente"
            }}
            placeholder="Fale os dados"
            size="sm"
            className="bg-white/10 hover:bg-white/20 border-white/20" />

          <Button onClick={onCancel} size="icon" variant="ghost">
            <X className="w-5 h-5 text-white" />
          </Button>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        {/* Grid 40% Formulário / 60% Histórico */}
        <div className="grid grid-cols-1 lg:grid-cols-[40%_60%] gap-4">
          {/* COLUNA 1: FORMULÁRIO (40%) */}
          <div className="space-y-2 overflow-y-auto max-h-[calc(95vh-180px)] pr-2">
            
            <h3 className="bg-orange-500 text-white px-2 py-1 font-bold text-xs rounded">Dados da Empresa</h3>
            
            <div>
              <Label className="text-gray-300 text-[11px] flex items-center gap-1">
                Razão Social <span className="text-red-400">*</span>
                {camposDestacados.includes('razao_social') && <span className="text-yellow-400 text-[10px] animate-pulse">⚡</span>}
              </Label>
              <GlassInput
                value={formData.razao_social}
                onChange={(e) => handleChange("razao_social", e.target.value)}
                destacado={camposDestacados.includes('razao_social')}
                placeholder="Nome oficial"
                className="h-7 text-xs"
                required />
            </div>
            
            <div>
              <Label className="text-gray-300 text-[11px]">Nome Fantasia</Label>
              <GlassInput
                value={formData.nome_fantasia}
                onChange={(e) => handleChange("nome_fantasia", e.target.value)}
                destacado={camposDestacados.includes('nome_fantasia')}
                placeholder="Nome comercial"
                className="h-7 text-xs" />
            </div>
            
            <div>
              <Label className="text-gray-300 text-[11px]">CNPJ</Label>
              <GlassInput
                value={formData.cnpj}
                onChange={(e) => handleChange("cnpj", e.target.value)}
                destacado={camposDestacados.includes('cnpj')}
                placeholder="00.000.000/0000-00"
                className="h-7 text-xs" />
            </div>

            <h3 className="bg-orange-500 text-white px-2 py-1 font-bold text-xs rounded mt-2">Contato</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-gray-300 text-[11px] flex items-center gap-1">
                  Email {camposDestacados.includes('email') && <span className="text-yellow-400 text-[10px] animate-pulse">⚡</span>}
                </Label>
                <GlassInput
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  destacado={camposDestacados.includes('email')}
                  placeholder="email@empresa.com"
                  className="h-7 text-xs" />
              </div>
              
              <div>
                <Label className="text-gray-300 text-[11px] flex items-center gap-1">
                  Telefone {camposDestacados.includes('telefone') && <span className="text-yellow-400 text-[10px] animate-pulse">⚡</span>}
                </Label>
                <GlassInput
                  value={formData.telefone}
                  onChange={(e) => handleChange("telefone", e.target.value)}
                  destacado={camposDestacados.includes('telefone')}
                  placeholder="(48) 99999-9999"
                  className="h-7 text-xs" />
              </div>
            </div>
            
            <div>
              <Label className="text-gray-300 text-[11px]">Endereço</Label>
              <GlassInput
                value={formData.endereco}
                onChange={(e) => handleChange("endereco", e.target.value)}
                destacado={camposDestacados.includes('endereco')}
                placeholder="Rua, número, bairro, cidade"
                className="h-7 text-xs" />
            </div>

            <h3 className="bg-orange-500 text-white px-2 py-1 font-bold text-xs rounded mt-2">Contato Principal</h3>
            
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-gray-300 text-[11px] flex items-center gap-1">
                  Nome {camposDestacados.includes('contato_principal_nome') && <span className="text-yellow-400 text-[10px] animate-pulse">⚡</span>}
                </Label>
                <GlassInput
                  value={formData.contato_principal_nome}
                  onChange={(e) => handleChange("contato_principal_nome", e.target.value)}
                  placeholder="João Silva"
                  destacado={camposDestacados.includes('contato_principal_nome')}
                  className="h-7 text-xs" />
              </div>
              
              <div>
                <Label className="text-gray-300 text-[11px] flex items-center gap-1">
                  Cargo {camposDestacados.includes('contato_principal_cargo') && <span className="text-yellow-400 text-[10px] animate-pulse">⚡</span>}
                </Label>
                <GlassInput
                  value={formData.contato_principal_cargo}
                  onChange={(e) => handleChange("contato_principal_cargo", e.target.value)}
                  placeholder="Gerente"
                  destacado={camposDestacados.includes('contato_principal_cargo')}
                  className="h-7 text-xs" />
              </div>
            </div>

            {/* GESTÃO E CLASSIFICAÇÃO - 3 CAMPOS LADO A LADO + MENSAGEM DA ETAPA */}
            <div className="bg-gradient-to-r from-orange-500/20 via-red-500/20 to-orange-500/20 rounded-lg border border-orange-400/50 p-2 mt-2">
              {regrasEtapa && novoStatus && (
                <div className="flex items-center gap-2 mb-2 pb-2 border-b border-orange-400/30">
                  <Sparkles className="w-3 h-3 text-yellow-300 flex-shrink-0" />
                  <p className="text-white font-bold text-[11px] leading-tight flex-1">
                    {regrasEtapa.mensagemEtapa}
                  </p>
                </div>
              )}
              
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <Label className="text-gray-300 text-[11px]">Status</Label>
                  <GlassSelect value={formData.status} onValueChange={(v) => handleChange("status", v)} destacado={camposDestacados.includes('status')}>
                    <SelectItem value="novo_lead">🆕 Novo Lead</SelectItem>
                    <SelectItem value="primeiro_contato">📞 Primeiro</SelectItem>
                    <SelectItem value="em_conversa">💬 Conversa</SelectItem>
                    <SelectItem value="levantamento_dados">📋 Levantamento</SelectItem>
                    <SelectItem value="pre_qualificado">✅ Pré-Qual</SelectItem>
                    <SelectItem value="qualificacao_tecnica">🔍 Técnica</SelectItem>
                    <SelectItem value="em_aquecimento">🔥 Aquecimento</SelectItem>
                    <SelectItem value="lead_qualificado">🎯 Qualificado</SelectItem>
                    <SelectItem value="desqualificado">❌ Desqualif.</SelectItem>
                    <SelectItem value="Prospect">🤝 Prospect</SelectItem>
                    <SelectItem value="Ativo">✅ Ativo</SelectItem>
                    <SelectItem value="Em Risco">⚠️ Em Risco</SelectItem>
                    <SelectItem value="Promotor">⭐ Promotor</SelectItem>
                  </GlassSelect>
                </div>

                <div>
                  <Label className="text-gray-300 text-[11px]">Classificação</Label>
                  <GlassSelect value={formData.classificacao} onValueChange={(v) => handleChange("classificacao", v)} destacado={camposDestacados.includes('classificacao')}>
                    <SelectItem value="A - Alto Potencial">🅰️ A - Alto</SelectItem>
                    <SelectItem value="B - Médio Potencial">🅱️ B - Médio</SelectItem>
                    <SelectItem value="C - Baixo Potencial">©️ C - Baixo</SelectItem>
                  </GlassSelect>
                </div>

                <div>
                  <Label className="text-gray-300 text-[11px]">Segmento</Label>
                  <GlassSelect value={formData.segmento} onValueChange={(v) => handleChange("segmento", v)} destacado={camposDestacados.includes('segmento')}>
                    <SelectItem value="Corporativo">🏢 Corporativo</SelectItem>
                    <SelectItem value="PME">🏭 PME</SelectItem>
                    <SelectItem value="Micro">🏪 Micro</SelectItem>
                  </GlassSelect>
                </div>
              </div>

              {formData.status === 'desqualificado' && (
                <div className="mt-2">
                  <Label className="text-gray-300 text-[11px]">Motivo</Label>
                  <GlassTextarea
                    value={formData.motivo_desqualificacao}
                    onChange={(e) => handleChange("motivo_desqualificacao", e.target.value)}
                    rows={2}
                    placeholder="Motivo..."
                    destacado={camposDestacados.includes('motivo_desqualificacao')}
                    className="text-xs" />
                </div>
              )}
            </div>

            <h3 className="bg-orange-500 text-white px-2 py-1 font-bold text-xs rounded mt-2">Dados Operacionais</h3>

            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label className="text-gray-300 text-[11px]">Máquinas</Label>
                <GlassInput
                  type="number"
                  value={formData.numero_maquinas}
                  onChange={(e) => handleChange("numero_maquinas", e.target.value)}
                  destacado={camposDestacados.includes('numero_maquinas')}
                  placeholder="0"
                  className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-gray-300 text-[11px]">Funcionários</Label>
                <GlassInput
                  type="number"
                  value={formData.numero_funcionarios}
                  onChange={(e) => handleChange("numero_funcionarios", e.target.value)}
                  destacado={camposDestacados.includes('numero_funcionarios')}
                  placeholder="0"
                  className="h-7 text-xs" />
              </div>
              <div>
                <Label className="text-gray-300 text-[11px]">Valor (R$)</Label>
                <GlassInput
                  type="number"
                  value={formData.valor_recorrente_mensal}
                  onChange={(e) => handleChange("valor_recorrente_mensal", e.target.value)}
                  destacado={camposDestacados.includes('valor_recorrente_mensal')}
                  placeholder="0.00"
                  className="h-7 text-xs" />
              </div>
            </div>

            <div>
              <Label className="text-gray-300 text-[11px]">Produtos de Interesse</Label>
              <div className="flex gap-1 mb-1">
                <GlassInput
                  value={interesseAtual}
                  onChange={(e) => setInteresseAtual(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAdicionarInteresse();
                    }
                  }}
                  placeholder="Digite e Enter"
                  destacado={camposDestacados.includes('interesses_produtos')}
                  className="h-7 text-xs" />
                <Button type="button" onClick={handleAdicionarInteresse} className="bg-indigo-600 hover:bg-indigo-500 h-7 px-2 text-xs">+</Button>
              </div>
              <div className="flex flex-wrap gap-1">
                {(formData.interesses_produtos || []).map((interesse, index) =>
                <span
                  key={index}
                  className="px-2 py-0.5 bg-indigo-500 text-white text-[10px] rounded-full cursor-pointer hover:bg-red-600"
                  onClick={() => handleRemoverInteresse(index)}>
                    {interesse} ✕
                  </span>
                )}
              </div>
            </div>

            {['qualificacao_tecnica', 'pre_qualificado', 'lead_qualificado', 'em_aquecimento'].includes(statusAlvo) &&
            <div className={`space-y-1 p-2 rounded-lg border ${
            camposDestacados.includes('necessidade_verificada') || camposDestacados.includes('capacidade_compra_verificada') ?
            'bg-yellow-500/20 border-yellow-400/50 ring-2 ring-yellow-400/30' :
            'bg-indigo-900/30 border-indigo-500/30'}`
            }>
                <Label className="text-gray-300 text-[11px] flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-indigo-400" />
                  BANT
                </Label>
                <div className="flex items-center space-x-2">
                  <Checkbox
                  id="necessidade"
                  checked={formData.necessidade_verificada}
                  onCheckedChange={(checked) => handleChange("necessidade_verificada", checked)} />
                  <label htmlFor="necessidade" className="text-[11px] text-gray-300 cursor-pointer">
                    ✅ Necessidade
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                  id="capacidade"
                  checked={formData.capacidade_compra_verificada}
                  onCheckedChange={(checked) => handleChange("capacidade_compra_verificada", checked)} />
                  <label htmlFor="capacidade" className="text-[11px] text-gray-300 cursor-pointer">
                    ✅ Capacidade
                  </label>
                </div>
              </div>
            }

            <h3 className="bg-orange-500 text-white px-2 py-1 font-bold text-xs rounded mt-2">Observações</h3>
            
            <div>
              <GlassTextarea
                value={formData.observacoes}
                onChange={(e) => handleChange("observacoes", e.target.value)}
                rows={3}
                destacado={camposDestacados.includes('observacoes')}
                placeholder="Conversas, materiais, próximos passos..."
                className="text-xs" />
            </div>
          </div>

          {/* COLUNA 2: HISTÓRICO DE COMUNICAÇÃO (60%) */}
          <div className="bg-black/40 rounded-xl border border-orange-500/30 p-3 overflow-y-auto max-h-[calc(95vh-180px)]">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-orange-500/30">
              <MessageSquare className="w-4 h-4 text-orange-400" />
              <h3 className="text-orange-300 font-bold text-sm">Histórico de Comunicação</h3>
            </div>

            {cliente?.id ? (
              <HistoricoQualificacaoCliente clienteId={cliente.id} />
            ) : (
              <div className="text-center py-8 text-orange-400/50">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-xs">Histórico disponível após criar o lead</p>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2 border-t border-white/10">
          <Button type="button" onClick={onCancel} variant="ghost" className="text-white hover:bg-white/10 h-8 text-xs">
            Fechar
          </Button>
          
          <Button
            type="submit"
            className="bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 text-white font-semibold px-6 shadow-lg h-8 text-xs">
            <Save className="w-4 h-4 mr-2" />
            {novoStatus ? '✅ Avançar e Salvar' : 'Salvar'}
          </Button>
        </div>
      </form>
    </div>);
}