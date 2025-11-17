import React, { useState, useEffect, useCallback } from 'react';
import { base44 } from '@/api/base44Client';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  User, Briefcase, Phone, Mail, Building2, Tag,
  Loader2, Brain, X, ChevronRight, AlertCircle,
  Edit, ShieldAlert, ShieldCheck, Trash2, CheckCircle,
  UserPlus, CheckCircle2
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert } from '@/components/ui/alert';
import { format } from 'date-fns';
import { normalizarTelefone } from '../lib/phoneUtils';

export default function ContactInfoPanel({ contact, novoContatoTelefone, onClose, onUpdate, threadAtual }) {
  const [vendedores, setVendedores] = useState([]);
  const [atendentes, setAtendentes] = useState([]);
  const [editando, setEditando] = useState(!!novoContatoTelefone);
  const [salvando, setSalvando] = useState(false);
  const [usuario, setUsuario] = useState(null);

  const [formData, setFormData] = useState({
    nome: contact?.nome || '',
    tipo_contato: contact?.tipo_contato || 'lead',
    vendedor_responsavel: contact?.vendedor_responsavel || '',
    atendente_fidelizado_vendas: contact?.atendente_fidelizado_vendas || '',
    atendente_fidelizado_assistencia: contact?.atendente_fidelizado_assistencia || '',
    atendente_fidelizado_financeiro: contact?.atendente_fidelizado_financeiro || '',
    atendente_fidelizado_fornecedor: contact?.atendente_fidelizado_fornecedor || '',
    empresa: contact?.empresa || '',
    cargo: contact?.cargo || '',
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
    if (contact) {
      setFormData({
        nome: contact.nome || contact.telefone || '',
        tipo_contato: contact.tipo_contato || 'lead',
        vendedor_responsavel: contact.vendedor_responsavel || '',
        atendente_fidelizado_vendas: contact.atendente_fidelizado_vendas || '',
        atendente_fidelizado_assistencia: contact.atendente_fidelizado_assistencia || '',
        atendente_fidelizado_financeiro: contact.atendente_fidelizado_financeiro || '',
        atendente_fidelizado_fornecedor: contact.atendente_fidelizado_fornecedor || '',
        empresa: contact.empresa || '',
        cargo: contact.cargo || '',
        email: contact.email || '',
        telefone: contact.telefone || '',
        observacoes: contact.observacoes || ''
      });
      carregarVendedores();
      carregarAtendentes();
      setEditando(false);
    } else if (novoContatoTelefone) {
      setFormData({
        nome: '',
        tipo_contato: 'lead',
        vendedor_responsavel: usuario?.full_name || '',
        atendente_fidelizado_vendas: '',
        atendente_fidelizado_assistencia: '',
        atendente_fidelizado_financeiro: '',
        atendente_fidelizado_fornecedor: '',
        empresa: '',
        cargo: '',
        email: '',
        telefone: novoContatoTelefone,
        observacoes: ''
      });
      carregarVendedores();
      carregarAtendentes();
      setEditando(true);
    }
  }, [contact?.id, novoContatoTelefone, usuario]);

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
      const atendentesData = await base44.entities.User.filter({ is_whatsapp_attendant: true }, 'full_name');
      setAtendentes(atendentesData);
    } catch (error) {
      console.error('[ContactInfoPanel] Erro ao carregar atendentes:', error);
    }
  };

  const handleChange = (campo, valor) => {
    setFormData(prev => ({ ...prev, [campo]: valor }));
  };

  const handleSalvar = async () => {
    if (!formData.nome || formData.nome.trim() === '') {
      toast.error('❌ O campo "Nome" é obrigatório');
      return;
    }

    setSalvando(true);
    try {
      // CRIAÇÃO DE NOVO CONTATO
      if (novoContatoTelefone && !contact) {
        console.log('[ContactInfoPanel] 🆕 Criando novo contato:', formData);

        if (!formData.telefone || formData.telefone.trim() === '') {
          toast.error('❌ Telefone é obrigatório');
          setSalvando(false);
          return;
        }

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
        return;
      }

      // ATUALIZAÇÃO DE CONTATO EXISTENTE
      if (!podeEditarContatos) {
        toast.error("❌ Você não tem permissão para editar contatos");
        setSalvando(false);
        return;
      }

      let dataToSave = { ...formData };
      let telefoneNormalizado = formData.telefone;

      if (formData.telefone && formData.telefone !== contact.telefone) {
        telefoneNormalizado = normalizarTelefone(formData.telefone);

        if (!telefoneNormalizado) {
          toast.error('❌ Telefone inválido');
          setSalvando(false);
          return;
        }

        const contatosComMesmoTelefone = await base44.entities.Contact.filter({
          telefone: telefoneNormalizado
        });

        if (contatosComMesmoTelefone.length > 0 && contatosComMesmoTelefone[0].id !== contact.id) {
          toast.error('❌ Este telefone já está cadastrado em outro contato');
          setFormData(prev => ({ ...prev, telefone: contact.telefone }));
          setSalvando(false);
          return;
        }

        dataToSave.telefone = telefoneNormalizado;
      }

      const hasChanges = Object.keys(dataToSave).some(key => {
        const currentVal = dataToSave[key] === null ? '' : String(dataToSave[key]);
        const contactVal = contact[key] === null ? '' : String(contact[key]);
        return currentVal !== contactVal;
      });

      if (!hasChanges) {
        toast.info("Nenhuma alteração a ser salva.");
        setEditando(false);
        setSalvando(false);
        return;
      }

      await base44.entities.Contact.update(contact.id, dataToSave);

      // ✅ ATRIBUIÇÃO AUTOMÁTICA: Se definiu atendente fidelizado E há thread ativa
      if (threadAtual) {
        let atendenteParaAtribuir = null;
        let atendenteNome = null;

        // Verificar qual atendente fidelizado foi definido baseado no tipo
        if (formData.tipo_contato === 'fornecedor' && formData.atendente_fidelizado_fornecedor) {
          atendenteNome = formData.atendente_fidelizado_fornecedor;
        } else if (formData.tipo_contato === 'cliente' && formData.atendente_fidelizado_vendas) {
          atendenteNome = formData.atendente_fidelizado_vendas;
        }

        // Buscar o ID do atendente
        if (atendenteNome) {
          atendenteParaAtribuir = atendentes.find(a => a.full_name === atendenteNome);
        }

        // Se encontrou o atendente E a thread não está atribuída a ele ainda
        if (atendenteParaAtribuir && threadAtual.assigned_user_id !== atendenteParaAtribuir.id) {
          console.log('[ContactInfoPanel] 🎯 Atribuindo thread automaticamente para:', atendenteParaAtribuir.full_name);

          await base44.entities.MessageThread.update(threadAtual.id, {
            assigned_user_id: atendenteParaAtribuir.id,
            assigned_user_name: atendenteParaAtribuir.full_name,
            pre_atendimento_ativo: false,
            pre_atendimento_state: 'COMPLETED'
          });

          await base44.entities.AutomationLog.create({
            acao: 'atribuicao_automatica_por_classificacao',
            contato_id: contact.id,
            thread_id: threadAtual.id,
            usuario_id: usuario?.id || 'system',
            resultado: 'sucesso',
            timestamp: new Date().toISOString(),
            detalhes: {
              mensagem: `Conversa atribuída automaticamente para ${atendenteParaAtribuir.full_name} baseado na classificação do contato`,
              tipo_contato: formData.tipo_contato,
              atendente_fidelizado: atendenteNome,
              classificado_por: usuario?.full_name || 'Sistema'
            },
            origem: 'automatica',
            prioridade: 'normal'
          });

          toast.success(`✅ Conversa atribuída automaticamente para ${atendenteParaAtribuir.full_name}`);
        }
      }

      toast.success("✅ Contato atualizado com sucesso!");
      setEditando(false);
      if (onUpdate) await onUpdate({ ...contact, ...dataToSave });
    } catch (error) {
      console.error('[ContactInfoPanel] Erro ao salvar contato:', error);
      toast.error("Erro ao salvar contato");
    } finally {
      setSalvando(false);
    }
  };

  const handleBloquear = async () => {
    if (!podeBloquearContatos) {
      toast.error("❌ Você não tem permissão para bloquear contatos");
      return;
    }
    const action = contact.bloqueado ? 'desbloquear' : 'bloquear';
    if (!confirm(`Tem certeza que deseja ${action} este contato?`)) {
      return;
    }
    setSalvando(true);
    try {
      await base44.entities.Contact.update(contact.id, {
        bloqueado: !contact.bloqueado,
        motivo_bloqueio: !contact.bloqueado ? 'Bloqueado manualmente pelo usuário' : null,
        bloqueado_em: !contact.bloqueado ? new Date().toISOString() : null,
        bloqueado_por: !contact.bloqueado && usuario ? usuario.id : null
      });
      toast.success(`✅ Contato ${action}ado com sucesso!`);
      if (onUpdate) await onUpdate();
      if (action === 'bloquear') {
        onClose();
      }
    } catch (error) {
      console.error(`[ContactInfoPanel] Erro ao ${action} contato:`, error);
      toast.error(`Erro ao ${action} contato`);
    } finally {
      setSalvando(false);
    }
  };

  const handleDeletar = async () => {
    if (!podeDeletarContatos) {
      toast.error("❌ Você não tem permissão para deletar contatos");
      return;
    }
    if (!confirm('⚠️ ATENÇÃO: Deletar este contato removerá todas as conversas e mensagens associadas. Esta ação é IRREVERSÍVEL. Deseja continuar?')) {
      return;
    }
    setSalvando(true);
    try {
      await base44.entities.Contact.delete(contact.id);
      toast.success("✅ Contato deletado com sucesso!");
      onClose();
      if (onUpdate) await onUpdate();
    } catch (error) {
      console.error('[ContactInfoPanel] Erro ao deletar contato:', error);
      toast.error("Erro ao deletar contato");
    } finally {
      setSalvando(false);
    }
  };

  // FORMULÁRIO PARA NOVO CONTATO
  if (novoContatoTelefone && !contact) {
    const tiposContato = [
      { value: 'lead', label: 'Lead', icon: '🎯' },
      { value: 'cliente', label: 'Cliente', icon: '💎' },
      { value: 'fornecedor', label: 'Fornecedor', icon: '🏭' },
      { value: 'parceiro', label: 'Parceiro', icon: '🤝' }
    ];
    const tipoAtual = tiposContato.find(t => t.value === formData.tipo_contato);

    return (
      <motion.div
        initial={{ x: 400, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        exit={{ x: 400, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="w-96 h-full bg-white flex flex-col overflow-hidden"
      >
        <div className="bg-gradient-to-r from-green-400 via-emerald-500 to-teal-500 text-white p-4 shadow-lg flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={onClose}
                className="hover:bg-white/10 rounded-full p-1 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-medium text-lg">Novo Contato</h3>
            </div>

            {salvando && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full"
              >
                <Loader2 className="w-3 h-3 animate-spin" />
                Criando...
              </motion.div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 p-6 flex flex-col items-center">
            <div className="w-32 h-32 bg-gradient-to-br from-green-400 via-emerald-500 to-teal-500 rounded-full flex items-center justify-center text-white font-bold text-5xl shadow-xl mb-3">
              <UserPlus className="w-16 h-16" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-slate-700">Cadastrar Novo Contato</p>
              <p className="text-sm text-slate-500 mt-1 font-mono">{formData.telefone}</p>
            </div>
          </div>

          <div className="p-4 space-y-1">
            {/* Nome */}
            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <User className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-slate-500 mb-1 block">Nome *</Label>
                  <Input
                    value={formData.nome}
                    onChange={(e) => handleChange('nome', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Digite o nome completo"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Empresa */}
            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-slate-500 mb-1 block">Empresa</Label>
                  <Input
                    value={formData.empresa}
                    onChange={(e) => handleChange('empresa', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Nome da empresa"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Cargo */}
            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Briefcase className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-slate-500 mb-1 block">Cargo</Label>
                  <Input
                    value={formData.cargo}
                    onChange={(e) => handleChange('cargo', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Cargo na empresa"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Email */}
            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Mail className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-slate-500 mb-1 block">Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="email@exemplo.com"
                  />
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Telefone (somente leitura) */}
            <div className="bg-slate-50">
              <div className="flex items-center gap-3 p-3">
                <Phone className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-slate-500 mb-1 block">Telefone</Label>
                  <p className="text-base font-medium text-slate-700 py-1 font-mono">{formData.telefone}</p>
                </div>
              </div>
            </div>

            <div className="h-px bg-slate-100" />

            {/* Observações */}
            <div className="bg-white hover:bg-slate-50 transition-colors">
              <div className="flex items-center gap-3 p-3">
                <Brain className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <Label className="text-xs text-slate-500 mb-1 block">Observações</Label>
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => handleChange('observacoes', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Adicionar observações sobre o contato"
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Seção Classificação - NOVO CONTATO */}
          <div className="mt-6 px-4 pb-4 space-y-3">
            <h4 className="text-sm font-semibold text-slate-700 px-3">Classificação CRM</h4>

            {/* Tipo de Contato */}
            <div className="bg-white border-2 border-orange-200 rounded-lg hover:border-orange-400 transition-colors hover:shadow-md">
              <div className="flex items-center gap-3 p-3">
                <Tag className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-2 block">Tipo</Label>
                  <Select
                    value={formData.tipo_contato}
                    onValueChange={(value) => handleChange('tipo_contato', value)}
                  >
                    <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{tipoAtual?.icon}</span>
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {tiposContato.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{tipo.icon}</span>
                            <span>{tipo.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Atendente Fidelizado */}
            {formData.tipo_contato === 'fornecedor' && (
              <div className="bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 transition-colors hover:shadow-md">
                <div className="flex items-center gap-3 p-3">
                  <User className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500 mb-2 block">Atendente (Fornecedor)</Label>
                    <Select
                      value={formData.atendente_fidelizado_fornecedor || "nao_atribuido"}
                      onValueChange={(value) => handleChange('atendente_fidelizado_fornecedor', value === "nao_atribuido" ? "" : value)}
                    >
                      <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
                        <SelectValue placeholder="Não atribuído" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_atribuido">Não atribuído</SelectItem>
                        {atendentes.map(atendente => (
                          <SelectItem key={atendente.id} value={atendente.full_name}>
                            {atendente.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {formData.tipo_contato === 'cliente' && (
              <div className="bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 transition-colors hover:shadow-md">
                <div className="flex items-center gap-3 p-3">
                  <User className="w-5 h-5 text-purple-500 flex-shrink-0" />
                  <div className="flex-1">
                    <Label className="text-xs text-slate-500 mb-2 block">Atendente (Vendas)</Label>
                    <Select
                      value={formData.atendente_fidelizado_vendas || "nao_atribuido"}
                      onValueChange={(value) => handleChange('atendente_fidelizado_vendas', value === "nao_atribuido" ? "" : value)}
                    >
                      <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
                        <SelectValue placeholder="Não atribuído" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_atribuido">Não atribuído</SelectItem>
                        {atendentes.map(atendente => (
                          <SelectItem key={atendente.id} value={atendente.full_name}>
                            {atendente.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Vendedor Responsável */}
            <div className="bg-white border-2 border-orange-200 rounded-lg hover:border-orange-400 transition-colors hover:shadow-md">
              <div className="flex items-center gap-3 p-3">
                <User className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-2 block">Vendedor</Label>
                  <Select
                    value={formData.vendedor_responsavel || "nao_atribuido"}
                    onValueChange={(value) => handleChange('vendedor_responsavel', value === "nao_atribuido" ? "" : value)}
                  >
                    <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
                      <SelectValue placeholder="Selecionar vendedor" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_atribuido">Não atribuído</SelectItem>
                      {vendedores.map(vendedor => (
                        <SelectItem key={vendedor.id} value={vendedor.nome}>
                          {vendedor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Botões de Ação */}
        <div className="p-4 border-t bg-white flex gap-2">
          <Button
            onClick={onClose}
            variant="outline"
            className="flex-1"
            disabled={salvando}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleSalvar}
            disabled={salvando || !formData.nome.trim()}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            {salvando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
                Criando...
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Criar e Iniciar Conversa
              </>
            )}
          </Button>
        </div>
      </motion.div>
    );
  }

  if (!contact) return null;

  const tiposContato = [
    { value: 'lead', label: 'Lead', icon: '🎯', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { value: 'cliente', label: 'Cliente', icon: '💎', color: 'bg-green-50 text-green-700 border-green-200' },
    { value: 'fornecedor', label: 'Fornecedor', icon: '🏭', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { value: 'parceiro', label: 'Parceiro', icon: '🤝', color: 'bg-orange-50 text-orange-700 border-orange-200' }
  ];

  const tipoAtual = tiposContato.find(t => t.value === formData.tipo_contato);

  return (
    <motion.div
      initial={{ x: 400, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: 400, opacity: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="w-96 h-full bg-white flex flex-col overflow-hidden"
    >
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-amber-400 via-orange-500 to-red-500 text-white p-4 shadow-lg flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="hover:bg-white/10 rounded-full p-1 transition-all"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-medium text-lg">Informações do contato</h3>
          </div>

          {salvando && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full"
            >
              <Loader2 className="w-3 h-3 animate-spin" />
              Salvando...
            </motion.div>
          )}
        </div>
      </div>

      {/* Body - Scrollable */}
      <div className="flex-1 overflow-y-auto">
        {/* Profile Picture with Gradient */}
        <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 p-6 flex flex-col items-center">
          <div className="w-32 h-32 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 rounded-full flex items-center justify-center text-white font-bold text-5xl shadow-xl mb-3">
            {formData.nome?.charAt(0).toUpperCase() || '?'}
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-slate-800">{formData.nome || 'Sem nome'}</p>
            <p className="text-sm text-slate-500 mt-1">{formData.telefone}</p>
          </div>
        </div>

        {/* Editable Fields */}
        <div className="p-4 space-y-1">
          {/* Nome */}
          <div className="bg-white hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 p-3">
              <User className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-slate-500 mb-1 block">Nome</Label>
                {editando ? (
                  <Input
                    value={formData.nome}
                    onChange={(e) => handleChange('nome', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Digite o nome"
                  />
                ) : (
                  <p className="text-base font-medium text-slate-700 py-1">{formData.nome || 'Não informado'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Empresa */}
          <div className="bg-white hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 p-3">
              <Building2 className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-slate-500 mb-1 block">Empresa</Label>
                {editando ? (
                  <Input
                    value={formData.empresa}
                    onChange={(e) => handleChange('empresa', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Nome da empresa"
                  />
                ) : (
                  <p className="text-base font-medium text-slate-700 py-1">{formData.empresa || 'Não informado'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Cargo */}
          <div className="bg-white hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 p-3">
              <Briefcase className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-slate-500 mb-1 block">Cargo</Label>
                {editando ? (
                  <Input
                    value={formData.cargo}
                    onChange={(e) => handleChange('cargo', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Cargo na empresa"
                  />
                ) : (
                  <p className="text-base font-medium text-slate-700 py-1">{formData.cargo || 'Não informado'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Email */}
          <div className="bg-white hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 p-3">
              <Mail className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-slate-500 mb-1 block">Email</Label>
                {editando ? (
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="email@exemplo.com"
                  />
                ) : (
                  <p className="text-base font-medium text-slate-700 py-1">{formData.email || 'Não informado'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="h-px bg-slate-100" />

          {/* Telefone */}
          <div className="bg-white hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 p-3">
              <Phone className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-slate-500 mb-1 block">Telefone</Label>
                {editando ? (
                  <Input
                    value={formData.telefone}
                    onChange={(e) => handleChange('telefone', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Número de telefone"
                  />
                ) : (
                  <p className="text-base font-medium text-slate-700 py-1">{formData.telefone || 'Não informado'}</p>
                )}
              </div>
            </div>
          </div>
          <div className="h-px bg-slate-100" />

          {/* Observações */}
          <div className="bg-white hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3 p-3">
              <Brain className="w-5 h-5 text-slate-400 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <Label className="text-xs text-slate-500 mb-1 block">Observações</Label>
                {editando ? (
                  <Textarea
                    value={formData.observacoes}
                    onChange={(e) => handleChange('observacoes', e.target.value)}
                    className="border-0 bg-transparent p-0 h-auto focus-visible:ring-0 text-base"
                    placeholder="Adicionar observações sobre o contato"
                    rows={3}
                  />
                ) : (
                  <p className="text-sm font-medium text-slate-700 py-1 whitespace-pre-wrap">{formData.observacoes || 'Nenhuma observação'}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Seção Classificação - CONTATO EXISTENTE */}
        <div className="mt-6 px-4 pb-4 space-y-3">
          <h4 className="text-sm font-semibold text-slate-700 px-3">Classificação CRM</h4>

          {/* Tipo de Contato */}
          <div className="bg-white border-2 border-orange-200 rounded-lg hover:border-orange-400 transition-colors hover:shadow-md">
            <div className="flex items-center gap-3 p-3">
              <Tag className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-xs text-slate-500 mb-2 block">Tipo</Label>
                {editando ? (
                  <Select
                    value={formData.tipo_contato}
                    onValueChange={(value) => handleChange('tipo_contato', value)}
                    disabled={!podeEditarContatos}
                  >
                    <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{tipoAtual?.icon}</span>
                        <SelectValue />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {tiposContato.map(tipo => (
                        <SelectItem key={tipo.value} value={tipo.value}>
                          <div className="flex items-center gap-2">
                            <span className="text-xl">{tipo.icon}</span>
                            <span>{tipo.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex items-center gap-2 py-1">
                    <span className="text-xl">{tipoAtual?.icon}</span>
                    <span className="font-medium text-slate-700">{tipoAtual?.label}</span>
                  </div>
                )}
              </div>
              {!editando && <ChevronRight className="w-4 h-4 text-orange-500" />}
            </div>
          </div>

          {/* Atendente Fidelizado - Fornecedor */}
          {formData.tipo_contato === 'fornecedor' && (
            <div className="bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 transition-colors hover:shadow-md">
              <div className="flex items-center gap-3 p-3">
                <User className="w-5 h-5 text-purple-500 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-2 block">Atendente (Fornecedor)</Label>
                  {editando ? (
                    <Select
                      value={formData.atendente_fidelizado_fornecedor || "nao_atribuido"}
                      onValueChange={(value) => handleChange('atendente_fidelizado_fornecedor', value === "nao_atribuido" ? "" : value)}
                      disabled={!podeEditarContatos}
                    >
                      <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
                        <SelectValue placeholder="Não atribuído" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_atribuido">Não atribuído</SelectItem>
                        {atendentes.map(atendente => (
                          <SelectItem key={atendente.id} value={atendente.full_name}>
                            {atendente.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-slate-700 py-1">{formData.atendente_fidelizado_fornecedor || 'Não atribuído'}</p>
                  )}
                </div>
                {!editando && <ChevronRight className="w-4 h-4 text-purple-500" />}
              </div>
            </div>
          )}

          {/* Atendente Fidelizado - Cliente/Vendas */}
          {formData.tipo_contato === 'cliente' && (
            <div className="bg-white border-2 border-purple-200 rounded-lg hover:border-purple-400 transition-colors hover:shadow-md">
              <div className="flex items-center gap-3 p-3">
                <User className="w-5 h-5 text-purple-500 flex-shrink-0" />
                <div className="flex-1">
                  <Label className="text-xs text-slate-500 mb-2 block">Atendente (Vendas)</Label>
                  {editando ? (
                    <Select
                      value={formData.atendente_fidelizado_vendas || "nao_atribuido"}
                      onValueChange={(value) => handleChange('atendente_fidelizado_vendas', value === "nao_atribuido" ? "" : value)}
                      disabled={!podeEditarContatos}
                    >
                      <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
                        <SelectValue placeholder="Não atribuído" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="nao_atribuido">Não atribuído</SelectItem>
                        {atendentes.map(atendente => (
                          <SelectItem key={atendente.id} value={atendente.full_name}>
                            {atendente.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <p className="font-medium text-slate-700 py-1">{formData.atendente_fidelizado_vendas || 'Não atribuído'}</p>
                  )}
                </div>
                {!editando && <ChevronRight className="w-4 h-4 text-purple-500" />}
              </div>
            </div>
          )}

          {/* Vendedor Responsável */}
          <div className="bg-white border-2 border-orange-200 rounded-lg hover:border-orange-400 transition-colors hover:shadow-md">
            <div className="flex items-center gap-3 p-3">
              <User className="w-5 h-5 text-orange-500 flex-shrink-0" />
              <div className="flex-1">
                <Label className="text-xs text-slate-500 mb-2 block">Vendedor</Label>
                {editando ? (
                  <Select
                    value={formData.vendedor_responsavel || "nao_atribuido"}
                    onValueChange={(value) => handleChange('vendedor_responsavel', value === "nao_atribuido" ? "" : value)}
                    disabled={!podeEditarContatos}
                  >
                    <SelectTrigger className="border-0 p-0 h-auto focus:ring-0">
                      <SelectValue placeholder="Não atribuído" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="nao_atribuido">Não atribuído</SelectItem>
                      {vendedores.map(vendedor => (
                        <SelectItem key={vendedor.id} value={vendedor.nome}>
                          {vendedor.nome}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="font-medium text-slate-700 py-1">{formData.vendedor_responsavel || 'Não atribuído'}</p>
                )}
              </div>
              {!editando && <ChevronRight className="w-4 h-4 text-orange-500" />}
            </div>
          </div>
        </div>

        {/* Seção de Gerenciamento */}
        <div className="mt-6 px-4 pb-4 space-y-3 border-t pt-4">
          <h4 className="text-sm font-semibold text-slate-700 px-3">Gerenciamento</h4>

          {contact.bloqueado ? (
            <div className="space-y-2">
              <Alert className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4 text-red-600" />
                <div className="ml-2">
                  <p className="font-semibold text-red-900">Contato Bloqueado</p>
                  {contact.motivo_bloqueio && (
                    <p className="text-sm text-red-700 mt-1">{contact.motivo_bloqueio}</p>
                  )}
                  {contact.bloqueado_em && (
                    <p className="text-xs text-red-600 mt-1">
                      Em {format(new Date(contact.bloqueado_em), 'dd/MM/yyyy HH:mm')}
                    </p>
                  )}
                </div>
              </Alert>
              <Button
                variant="outline"
                className="w-full justify-start text-green-600 border-green-200 hover:bg-green-50"
                onClick={handleBloquear}
                disabled={salvando || !podeBloquearContatos}
                title={!podeBloquearContatos ? "Sem permissão para desbloquear contatos" : "Desbloquear contato"}
              >
                {salvando ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Desbloqueando...
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    Desbloquear Contato
                  </>
                )}
              </Button>
            </div>
          ) : (
            <>
              {!editando && (
                <>
                  <Button
                    onClick={() => {
                      if (podeEditarContatos) {
                        setEditando(true);
                      } else {
                        toast.error("❌ Você não tem permissão para editar contatos");
                      }
                    }}
                    variant="outline"
                    className="w-full justify-start"
                    disabled={!podeEditarContatos}
                    title={!podeEditarContatos ? "Sem permissão para editar contatos" : "Editar contato"}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Editar Contato
                  </Button>

                  <Button
                    onClick={handleBloquear}
                    variant="destructive"
                    className="w-full justify-start text-red-600 border-red-200 hover:bg-red-50"
                    disabled={salvando || !podeBloquearContatos}
                    title={!podeBloquearContatos ? "Sem permissão para bloquear contatos" : "Bloquear contato"}
                  >
                    {salvando ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Bloqueando...
                      </>
                    ) : (
                      <>
                        <ShieldAlert className="w-4 h-4 mr-2" />
                        Bloquear Contato
                      </>
                    )}
                  </Button>
                </>
              )}
            </>
          )}

          {editando && (
            <div className="flex gap-2 pt-4">
              <Button
                onClick={handleSalvar}
                disabled={salvando || !podeEditarContatos}
                className="flex-1"
                title={!podeEditarContatos ? "Sem permissão para editar" : "Salvar alterações"}
              >
                {salvando ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle className="w-4 h-4 mr-2" />}
                Salvar
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setEditando(false);
                  setFormData({
                    nome: contact.nome || contact.telefone || '',
                    tipo_contato: contact.tipo_contato || 'lead',
                    vendedor_responsavel: contact.vendedor_responsavel || '',
                    atendente_fidelizado_vendas: contact.atendente_fidelizado_vendas || '',
                    atendente_fidelizado_assistencia: contact.atendente_fidelizado_assistencia || '',
                    atendente_fidelizado_financeiro: contact.atendente_fidelizado_financeiro || '',
                    atendente_fidelizado_fornecedor: contact.atendente_fidelizado_fornecedor || '',
                    empresa: contact.empresa || '',
                    cargo: contact.cargo || '',
                    email: contact.email || '',
                    telefone: contact.telefone || '',
                    observacoes: contact.observacoes || ''
                  });
                }}
                disabled={salvando}
              >
                Cancelar
              </Button>
            </div>
          )}

          {podeDeletarContatos && (
            <Button
              onClick={handleDeletar}
              variant="destructive"
              className="w-full justify-start"
              disabled={salvando}
              title={!podeDeletarContatos ? "Sem permissão para deletar contatos" : "Deletar contato"}
            >
              {salvando ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4 mr-2" />
              )}
              Deletar Contato
            </Button>
          )}
        </div>

        {contact.tags && contact.tags.length > 0 && (
          <div className="px-4 pb-6">
            <h4 className="text-sm font-semibold text-slate-700 px-3 mb-3">Etiquetas</h4>
            <div className="flex flex-wrap gap-2 px-3">
              {contact.tags.map((tag, index) => (
                <Badge
                  key={index}
                  className="bg-gradient-to-r from-amber-100 to-orange-100 text-orange-700 border-orange-200"
                >
                  {tag.replace(/_/g, ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}