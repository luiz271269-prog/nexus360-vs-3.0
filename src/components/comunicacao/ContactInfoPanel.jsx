import React from 'react';
const { useState, useEffect } = React;
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  User, Briefcase, Phone, Mail, Building2, Tag,
  Loader2, Brain, X, AlertCircle,
  ShieldAlert, ShieldCheck, Trash2, CheckCircle2, UserPlus
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { format } from 'date-fns';
import { normalizarTelefone } from '../lib/phoneUtils';
import SegmentacaoInteligente from './SegmentacaoInteligente';
import AtribuidorAtendenteRapido from './AtribuidorAtendenteRapido';
import SeletorEtiquetasContato from './SeletorEtiquetasContato';

export default function ContactInfoPanel({ contact, novoContatoTelefone, onClose, onUpdate, threadAtual }) {
  const [vendedores, setVendedores] = useState([]);
  const [atendentes, setAtendentes] = useState([]);
  const [salvando, setSalvando] = useState(false);
  const [usuario, setUsuario] = useState(null);

  const [formData, setFormData] = useState({
    empresa: contact?.empresa || '',
    cargo: contact?.cargo || '',
    nome: contact?.nome || '',
    tipo_contato: contact?.tipo_contato || 'lead',
    vendedor_responsavel: contact?.vendedor_responsavel || '',
    atendente_fidelizado_vendas: contact?.atendente_fidelizado_vendas || '',
    atendente_fidelizado_fornecedor: contact?.atendente_fidelizado_fornecedor || '',
    email: contact?.email || '',
    telefone: novoContatoTelefone || contact?.telefone || '',
    observacoes: contact?.observacoes || ''
  });

  useEffect(() => {
    const carregarUsuario = async () => {
      try {
        const user = await base44.auth.me();
        setUsuario(user);
      } catch (error) {
        console.error('[ContactInfoPanel] Erro ao carregar usuário:', error);
      }
    };
    carregarUsuario();
  }, []);

  const permissoes = usuario?.permissoes_comunicacao || {};
  const podeEditarContatos = permissoes.pode_editar_contatos !== false;
  const podeBloquearContatos = permissoes.pode_bloquear_contatos === true;
  const podeDeletarContatos = permissoes.pode_deletar_contatos === true;

  useEffect(() => {
    carregarVendedores();
    carregarAtendentes();
    
    if (contact) {
      setFormData({
        empresa: contact.empresa || '',
        cargo: contact.cargo || '',
        nome: contact.nome || contact.telefone || '',
        tipo_contato: contact.tipo_contato || 'lead',
        vendedor_responsavel: contact.vendedor_responsavel || '',
        atendente_fidelizado_vendas: contact.atendente_fidelizado_vendas || '',
        atendente_fidelizado_fornecedor: contact.atendente_fidelizado_fornecedor || '',
        email: contact.email || '',
        telefone: contact.telefone || '',
        observacoes: contact.observacoes || ''
      });
    }
  }, [contact?.id, novoContatoTelefone]);

  const carregarVendedores = async () => {
    try {
      const vendedoresData = await base44.entities.Vendedor.list('nome');
      setVendedores(vendedoresData);
    } catch (error) {
      console.error('[ContactInfoPanel] Erro ao carregar vendedores:', error);
    }
  };

  const carregarAtendentes = async () => {
    try {
      // Buscar TODOS os usuários do sistema, não apenas atendentes de WhatsApp
      const atendentesData = await base44.entities.User.list('full_name');
      setAtendentes(atendentesData);
    } catch (error) {
      console.error('[ContactInfoPanel] Erro ao carregar atendentes:', error);
    }
  };

  const handleChange = async (campo, valor) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
    
    // AUTO-SAVE instantâneo para contato existente
    if (contact && !novoContatoTelefone && podeEditarContatos) {
      try {
        await base44.entities.Contact.update(contact.id, { [campo]: valor });
        if (onUpdate) await onUpdate();
      } catch (error) {
        console.error('[ContactInfoPanel] Erro ao auto-salvar:', error);
        toast.error('Erro ao salvar');
      }
    }
  };

  const handleCriarContato = async () => {
    if (!formData.nome || formData.nome.trim() === '') {
      toast.error('❌ Nome é obrigatório');
      return;
    }

    setSalvando(true);
    try {
      const telefoneNormalizado = normalizarTelefone(formData.telefone);
      if (!telefoneNormalizado) {
        toast.error('❌ Telefone inválido');
        setSalvando(false);
        return;
      }

      const dadosParaSalvar = {
        ...formData,
        telefone: telefoneNormalizado
      };

      if (onUpdate) await onUpdate(dadosParaSalvar);
    } catch (error) {
      console.error('[ContactInfoPanel] Erro ao criar:', error);
      toast.error('Erro ao criar contato');
    } finally {
      setSalvando(false);
    }
  };

  const handleBloquear = async () => {
    if (!podeBloquearContatos) {
      toast.error("❌ Sem permissão para bloquear");
      return;
    }
    const action = contact.bloqueado ? 'desbloquear' : 'bloquear';
    if (!confirm(`Tem certeza que deseja ${action} este contato?`)) return;
    
    setSalvando(true);
    try {
      await base44.entities.Contact.update(contact.id, {
        bloqueado: !contact.bloqueado,
        motivo_bloqueio: !contact.bloqueado ? 'Bloqueado manualmente' : null,
        bloqueado_em: !contact.bloqueado ? new Date().toISOString() : null,
        bloqueado_por: !contact.bloqueado && usuario ? usuario.id : null
      });
      toast.success(`✅ Contato ${action}ado!`);
      if (onUpdate) await onUpdate();
      if (action === 'bloquear') onClose();
    } catch (error) {
      toast.error(`Erro ao ${action}`);
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async () => {
    if (!podeDeletarContatos) {
      toast.error("❌ Sem permissão");
      return;
    }
    if (!confirm('⚠️ Deletar contato e todas conversas? IRREVERSÍVEL!')) return;
    
    setSalvando(true);
    try {
      await base44.entities.Contact.delete(contact.id);
      toast.success("✅ Deletado!");
      onClose();
      if (onUpdate) await onUpdate();
    } catch (error) {
      toast.error("Erro ao deletar");
    } finally {
      setSalvando(false);
    }
  };

  const tiposContato = [
    { value: 'lead', label: 'Lead', icon: '🎯' },
    { value: 'cliente', label: 'Cliente', icon: '💎' },
    { value: 'fornecedor', label: 'Fornecedor', icon: '🏭' },
    { value: 'parceiro', label: 'Parceiro', icon: '🤝' }
  ];
  const tipoAtual = tiposContato.find(t => t.value === formData.tipo_contato);

  // ========================================
  // NOVO CONTATO
  // ========================================
  if (novoContatoTelefone && !contact) {
    return (
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        className="w-96 h-full bg-white flex flex-col overflow-hidden"
      >
        <div className="bg-gradient-to-r from-green-400 to-teal-500 text-white p-4 shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={onClose} className="hover:bg-white/10 rounded-full p-1">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-medium text-lg">Novo Contato</h3>
            </div>
            {salvando && (
              <motion.div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" />
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="bg-gradient-to-br from-green-50 to-teal-50 p-6 flex flex-col items-center">
            <div className="w-20 h-20 bg-gradient-to-br from-green-400 to-teal-500 rounded-full flex items-center justify-center text-white shadow-xl mb-2">
              <UserPlus className="w-10 h-10" />
            </div>
            <p className="text-sm text-slate-500 font-mono">{formData.telefone}</p>
          </div>

          {/* Cards Classificação - 1cm */}
          <div className="p-3 space-y-2 bg-slate-50 border-b">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg px-3 shadow h-[1cm] flex items-center gap-2">
              <Tag className="w-4 h-4 flex-shrink-0" />
              <Select value={formData.tipo_contato} onValueChange={(value) => handleChange('tipo_contato', value)}>
                <SelectTrigger className="border-0 bg-transparent text-white h-6 p-0 focus:ring-0 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposContato.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.icon} {tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.tipo_contato === 'fornecedor' && (
              <div className="bg-purple-500 text-white rounded-lg px-3 shadow h-[1cm] flex items-center gap-2">
                <User className="w-4 h-4 flex-shrink-0" />
                <Select
                  value={formData.atendente_fidelizado_fornecedor || "nao"}
                  onValueChange={(value) => handleChange('atendente_fidelizado_fornecedor', value === "nao" ? "" : value)}
                >
                  <SelectTrigger className="border-0 bg-transparent text-white h-6 p-0 focus:ring-0 flex-1">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não atribuído</SelectItem>
                    {atendentes.map(a => <SelectItem key={a.id} value={a.full_name}>{a.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.tipo_contato === 'cliente' && (
              <div className="bg-purple-500 text-white rounded-lg px-3 shadow h-[1cm] flex items-center gap-2">
                <User className="w-4 h-4 flex-shrink-0" />
                <Select
                  value={formData.atendente_fidelizado_vendas || "nao"}
                  onValueChange={(value) => handleChange('atendente_fidelizado_vendas', value === "nao" ? "" : value)}
                >
                  <SelectTrigger className="border-0 bg-transparent text-white h-6 p-0 focus:ring-0 flex-1">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não atribuído</SelectItem>
                    {atendentes.map(a => <SelectItem key={a.id} value={a.full_name}>{a.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-amber-500 text-white rounded-lg px-3 shadow h-[1cm] flex items-center gap-2">
              <User className="w-4 h-4 flex-shrink-0" />
              <Select
                value={formData.vendedor_responsavel || "nao"}
                onValueChange={(value) => handleChange('vendedor_responsavel', value === "nao" ? "" : value)}
              >
                <SelectTrigger className="border-0 bg-transparent text-white h-6 p-0 focus:ring-0 flex-1">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não atribuído</SelectItem>
                  {vendedores.map(v => <SelectItem key={v.id} value={v.nome}>{v.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campos na ordem: Empresa → Cargo → Nome */}
          <div className="p-4 space-y-1">
            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Empresa</Label>
                  <Input
                    value={formData.empresa}
                    onChange={(e) => handleChange('empresa', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="Nome da empresa"
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Briefcase className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Cargo</Label>
                  <Input
                    value={formData.cargo}
                    onChange={(e) => handleChange('cargo', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="Cargo"
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <User className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Nome *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => handleChange('nome', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="Nome completo"
                    autoFocus
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Mail className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-slate-50">
              <div className="flex items-center gap-3 p-3">
                <Phone className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Telefone</Label>
                  <p className="text-base font-medium text-slate-700 font-mono">{formData.telefone}</p>
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Brain className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => handleChange('observacoes', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="Observações"
                    rows={2}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t flex gap-2">
          <Button onClick={onClose} variant="outline" className="flex-1" disabled={salvando}>
            Cancelar
          </Button>
          <Button
            onClick={handleCriarContato}
            disabled={salvando || !formData.nome.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
            Criar
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!contact) return null;

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-96 h-full bg-white flex flex-col overflow-hidden"
    >
      <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white p-4 shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="hover:bg-white/10 rounded-full p-1">
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-medium text-lg">Informações do contato</h3>
          </div>
          {salvando && (
            <motion.div className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
              <Loader2 className="w-3 h-3 animate-spin" />
            </motion.div>
          )}
        </div>
      </div>

      <Tabs defaultValue="dados" className="flex-1 flex flex-col overflow-hidden">
        <TabsList className="grid w-full grid-cols-2 mx-4 mt-2">
          <TabsTrigger value="dados"><User className="w-4 h-4 mr-2" />Dados</TabsTrigger>
          <TabsTrigger value="ia"><Brain className="w-4 h-4 mr-2" />IA</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="flex-1 overflow-y-auto m-0">
          {/* Cards Classificação - 1cm altura NO TOPO */}
          <div className="p-3 space-y-2 bg-slate-50 border-b">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg px-3 shadow h-[1cm] flex items-center gap-2">
              <Tag className="w-4 h-4 flex-shrink-0" />
              <Select
                value={formData.tipo_contato}
                onValueChange={(value) => handleChange('tipo_contato', value)}
                disabled={!podeEditarContatos}
              >
                <SelectTrigger className="border-0 bg-transparent text-white h-6 p-0 focus:ring-0 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {tiposContato.map(tipo => (
                    <SelectItem key={tipo.value} value={tipo.value}>{tipo.icon} {tipo.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {formData.tipo_contato === 'fornecedor' && (
              <div className="bg-purple-500 text-white rounded-lg px-3 shadow h-[1cm] flex items-center gap-2">
                <User className="w-4 h-4 flex-shrink-0" />
                <Select
                  value={formData.atendente_fidelizado_fornecedor || "nao"}
                  onValueChange={(value) => handleChange('atendente_fidelizado_fornecedor', value === "nao" ? "" : value)}
                  disabled={!podeEditarContatos}
                >
                  <SelectTrigger className="border-0 bg-transparent text-white h-6 p-0 focus:ring-0 flex-1">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não atribuído</SelectItem>
                    {atendentes.map(a => <SelectItem key={a.id} value={a.full_name}>{a.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {formData.tipo_contato === 'cliente' && (
              <div className="bg-purple-500 text-white rounded-lg px-3 shadow h-[1cm] flex items-center gap-2">
                <User className="w-4 h-4 flex-shrink-0" />
                <Select
                  value={formData.atendente_fidelizado_vendas || "nao"}
                  onValueChange={(value) => handleChange('atendente_fidelizado_vendas', value === "nao" ? "" : value)}
                  disabled={!podeEditarContatos}
                >
                  <SelectTrigger className="border-0 bg-transparent text-white h-6 p-0 focus:ring-0 flex-1">
                    <SelectValue placeholder="Atendente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="nao">Não atribuído</SelectItem>
                    {atendentes.map(a => <SelectItem key={a.id} value={a.full_name}>{a.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-amber-500 text-white rounded-lg px-3 shadow h-[1cm] flex items-center gap-2">
              <User className="w-4 h-4 flex-shrink-0" />
              <Select
                value={formData.vendedor_responsavel || "nao"}
                onValueChange={(value) => handleChange('vendedor_responsavel', value === "nao" ? "" : value)}
                disabled={!podeEditarContatos}
              >
                <SelectTrigger className="border-0 bg-transparent text-white h-6 p-0 focus:ring-0 flex-1">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nao">Não atribuído</SelectItem>
                  {vendedores.map(v => <SelectItem key={v.id} value={v.nome}>{v.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Campos - ORDEM: Empresa → Cargo → Nome */}
          <div className="p-4 space-y-1">
            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Empresa</Label>
                  <Input
                    value={formData.empresa}
                    onChange={(e) => handleChange('empresa', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="Nome da empresa"
                    disabled={!podeEditarContatos}
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Briefcase className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Cargo</Label>
                  <Input
                    value={formData.cargo}
                    onChange={(e) => handleChange('cargo', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="Cargo"
                    disabled={!podeEditarContatos}
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <User className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Nome</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => handleChange('nome', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="Nome completo"
                    disabled={!podeEditarContatos}
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Mail className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="email@exemplo.com"
                    disabled={!podeEditarContatos}
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-slate-50">
              <div className="flex items-center gap-3 p-3">
                <Phone className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Telefone</Label>
                  <p className="text-base font-medium text-slate-700 font-mono">{formData.telefone}</p>
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Brain className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => handleChange('observacoes', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0"
                    placeholder="Observações"
                    rows={2}
                    disabled={!podeEditarContatos}
                  />
                </div>
              </div>
            </div>
            <div className="h-px bg-slate-100" />

            {/* Etiquetas */}
            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Tag className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-1 block">Etiquetas</Label>
                  <SeletorEtiquetasContato
                    contato={contact}
                    onUpdate={onUpdate}
                    setorUsuario={usuario?.attendant_sector || 'geral'}
                    tipoContato={formData.tipo_contato}
                    variant="default"
                    disabled={!podeEditarContatos}
                  />
                </div>
              </div>
            </div>
            </div>

            {/* Gerenciamento */}
          <div className="mt-4 px-4 pb-4 border-t pt-4">
            {contact.bloqueado ? (
              <Alert className="bg-red-50 border-red-200 p-3">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="ml-2">
                  <p className="font-semibold text-sm text-red-900">Bloqueado</p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-2 text-green-600"
                    onClick={handleBloquear}
                    disabled={!podeBloquearContatos}
                  >
                    <ShieldCheck className="w-3 h-3 mr-1" /> Desbloquear
                  </Button>
                </div>
              </Alert>
            ) : (
              <div className="flex gap-2">
                <Button onClick={handleBloquear} variant="outline" size="sm" className="flex-1" disabled={!podeBloquearContatos}>
                  <ShieldAlert className="w-3 h-3 mr-1" /> Bloquear
                </Button>
                {podeDeletarContatos && (
                  <Button onClick={handleDeletar} variant="destructive" size="sm" className="flex-1">
                    <Trash2 className="w-3 h-3 mr-1" /> Deletar
                  </Button>
                )}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="ia" className="flex-1 overflow-y-auto p-4 m-0">
          <SegmentacaoInteligente contactId={contact.id} />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}