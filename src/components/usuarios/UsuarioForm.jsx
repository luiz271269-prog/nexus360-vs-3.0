import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  User, 
  Shield, 
  MessageSquare, 
  Clock, 
  BarChart3,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Users,
  FileText,
  Phone
} from "lucide-react";
import { toast } from "sonner";
import ConfiguracaoPermissoesWhatsApp from "./ConfiguracaoPermissoesWhatsApp";

export default function UsuarioForm({ usuario, onSave, onCancel }) {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    role: "user",
    is_whatsapp_attendant: false,
    attendant_sector: "geral",
    attendant_role: "junior",
    availability_status: "offline",
    max_concurrent_conversations: 5,
    whatsapp_phone: "",
    notificar_novas_conversas: true,
    horario_atendimento: {
      inicio: "08:00",
      fim: "18:00",
      dias_semana: [1, 2, 3, 4, 5]
    },
    permissoes_comunicacao: {
      pode_criar_contatos: true,
      pode_editar_contatos: true,
      pode_bloquear_contatos: false,
      pode_deletar_contatos: false,
      pode_enviar_mensagens: true,
      pode_enviar_midias: true,
      pode_enviar_audios: true,
      pode_encaminhar_mensagens: true,
      pode_apagar_mensagens: false,
      pode_transferir_conversas: true,
      pode_ver_todas_conversas: false,
      pode_atribuir_conversas: false,
      pode_usar_templates: true,
      pode_criar_templates: false,
      pode_usar_respostas_rapidas: true,
      pode_criar_respostas_rapidas: false,
      pode_ver_historico_completo: true,
      pode_exportar_conversas: false,
      pode_acessar_relatorios: false,
      pode_configurar_integracao: false
    },
    whatsapp_permissions: []
  });

  const [activeTab, setActiveTab] = useState("basico");

  useEffect(() => {
    if (usuario) {
      setFormData({
        full_name: usuario.full_name || "",
        email: usuario.email || "",
        role: usuario.role || "user",
        is_whatsapp_attendant: usuario.is_whatsapp_attendant || false,
        attendant_sector: usuario.attendant_sector || "geral",
        attendant_role: usuario.attendant_role || "junior",
        availability_status: usuario.availability_status || "offline",
        max_concurrent_conversations: usuario.max_concurrent_conversations || 5,
        whatsapp_phone: usuario.whatsapp_phone || "",
        notificar_novas_conversas: usuario.notificar_novas_conversas !== undefined ? usuario.notificar_novas_conversas : true,
        horario_atendimento: usuario.horario_atendimento || {
          inicio: "08:00",
          fim: "18:00",
          dias_semana: [1, 2, 3, 4, 5]
        },
        permissoes_comunicacao: usuario.permissoes_comunicacao || {
          pode_criar_contatos: true,
          pode_editar_contatos: true,
          pode_bloquear_contatos: false,
          pode_deletar_contatos: false,
          pode_enviar_mensagens: true,
          pode_enviar_midias: true,
          pode_enviar_audios: true,
          pode_encaminhar_mensagens: true,
          pode_apagar_mensagens: false,
          pode_transferir_conversas: true,
          pode_ver_todas_conversas: false,
          pode_atribuir_conversas: false,
          pode_usar_templates: true,
          pode_criar_templates: false,
          pode_usar_respostas_rapidas: true,
          pode_criar_respostas_rapidas: false,
          pode_ver_historico_completo: true,
          pode_exportar_conversas: false,
          pode_acessar_relatorios: false,
          pode_configurar_integracao: false
        },
        whatsapp_permissions: usuario.whatsapp_permissions || []
      });
    }
  }, [usuario]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!formData.full_name || !formData.email) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    onSave(formData);
  };

  const toggleDiaSemana = (dia) => {
    setFormData(prev => ({
      ...prev,
      horario_atendimento: {
        ...prev.horario_atendimento,
        dias_semana: prev.horario_atendimento.dias_semana.includes(dia)
          ? prev.horario_atendimento.dias_semana.filter(d => d !== dia)
          : [...prev.horario_atendimento.dias_semana, dia].sort()
      }
    }));
  };

  const diasSemanaLabels = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

  const aplicarPerfilPadrao = (perfil) => {
    const perfis = {
      atendente_basico: {
        pode_criar_contatos: true,
        pode_editar_contatos: true,
        pode_bloquear_contatos: false,
        pode_deletar_contatos: false,
        pode_enviar_mensagens: true,
        pode_enviar_midias: true,
        pode_enviar_audios: true,
        pode_encaminhar_mensagens: true,
        pode_apagar_mensagens: false,
        pode_transferir_conversas: true,
        pode_ver_todas_conversas: false,
        pode_atribuir_conversas: false,
        pode_usar_templates: true,
        pode_criar_templates: false,
        pode_usar_respostas_rapidas: true,
        pode_criar_respostas_rapidas: false,
        pode_ver_historico_completo: true,
        pode_exportar_conversas: false,
        pode_acessar_relatorios: false,
        pode_configurar_integracao: false
      },
      supervisor: {
        pode_criar_contatos: true,
        pode_editar_contatos: true,
        pode_bloquear_contatos: true,
        pode_deletar_contatos: false,
        pode_enviar_mensagens: true,
        pode_enviar_midias: true,
        pode_enviar_audios: true,
        pode_encaminhar_mensagens: true,
        pode_apagar_mensagens: true,
        pode_transferir_conversas: true,
        pode_ver_todas_conversas: true,
        pode_atribuir_conversas: true,
        pode_usar_templates: true,
        pode_criar_templates: true,
        pode_usar_respostas_rapidas: true,
        pode_criar_respostas_rapidas: true,
        pode_ver_historico_completo: true,
        pode_exportar_conversas: true,
        pode_acessar_relatorios: true,
        pode_configurar_integracao: false
      },
      gerente: {
        pode_criar_contatos: true,
        pode_editar_contatos: true,
        pode_bloquear_contatos: true,
        pode_deletar_contatos: true,
        pode_enviar_mensagens: true,
        pode_enviar_midias: true,
        pode_enviar_audios: true,
        pode_encaminhar_mensagens: true,
        pode_apagar_mensagens: true,
        pode_transferir_conversas: true,
        pode_ver_todas_conversas: true,
        pode_atribuir_conversas: true,
        pode_usar_templates: true,
        pode_criar_templates: true,
        pode_usar_respostas_rapidas: true,
        pode_criar_respostas_rapidas: true,
        pode_ver_historico_completo: true,
        pode_exportar_conversas: true,
        pode_acessar_relatorios: true,
        pode_configurar_integracao: true
      }
    };

    if (perfis[perfil]) {
      setFormData(prev => ({
        ...prev,
        permissoes_comunicacao: perfis[perfil]
      }));
      toast.success(`Perfil "${perfil.replace('_', ' ')}" aplicado com sucesso!`);
    }
  };

  const PermissionSwitch = ({ label, name, description }) => (
    <div className="flex items-center justify-between py-3 px-4 hover:bg-slate-50 rounded-lg transition-colors">
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium cursor-pointer">{label}</Label>
          {formData.permissoes_comunicacao[name] ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <XCircle className="w-4 h-4 text-slate-300" />
          )}
        </div>
        {description && <p className="text-xs text-slate-500 mt-1">{description}</p>}
      </div>
      <Switch
        checked={formData.permissoes_comunicacao[name] || false}
        onCheckedChange={(checked) => setFormData(prev => ({
          ...prev,
          permissoes_comunicacao: {
            ...prev.permissoes_comunicacao,
            [name]: checked
          }
        }))}
      />
    </div>
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="basico" className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Básico
          </TabsTrigger>
          <TabsTrigger value="atendente" className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4" />
            Atendente
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Permissões
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="flex items-center gap-2">
            <Phone className="w-4 h-4" />
            WhatsApp
          </TabsTrigger>
          <TabsTrigger value="horarios" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Horários
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: BÁSICO */}
        <TabsContent value="basico" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informações Básicas
              </CardTitle>
              <CardDescription>Dados principais do usuário</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="full_name">Nome Completo *</Label>
                <Input
                  id="full_name"
                  value={formData.full_name}
                  onChange={(e) => setFormData({...formData, full_name: e.target.value})}
                  placeholder="Nome completo"
                  required
                />
              </div>

              <div>
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="email@empresa.com"
                  required
                  disabled={!!usuario}
                />
                {usuario && (
                  <p className="text-xs text-slate-500 mt-1">
                    O e-mail não pode ser alterado após criação
                  </p>
                )}
              </div>

              <div>
                <Label htmlFor="role">Tipo de Acesso</Label>
                <Select
                  value={formData.role}
                  onValueChange={(value) => setFormData({...formData, role: value})}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">
                      <div className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-red-500" />
                        <span>Administrador</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="user">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-blue-500" />
                        <span>Usuário Padrão</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: ATENDENTE */}
        <TabsContent value="atendente" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Configurações de Atendimento WhatsApp
              </CardTitle>
              <CardDescription>
                Ative esta opção se o usuário vai atender conversas do WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                <div>
                  <Label className="text-base font-semibold">Atendente WhatsApp</Label>
                  <p className="text-sm text-slate-600 mt-1">
                    Permite que este usuário receba e gerencie conversas
                  </p>
                </div>
                <Switch
                  checked={formData.is_whatsapp_attendant}
                  onCheckedChange={(checked) => setFormData({...formData, is_whatsapp_attendant: checked})}
                />
              </div>

              {formData.is_whatsapp_attendant && (
                <>
                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Setor</Label>
                      <Select
                        value={formData.attendant_sector}
                        onValueChange={(value) => setFormData({...formData, attendant_sector: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="vendas">Vendas</SelectItem>
                          <SelectItem value="assistencia">Assistência Técnica</SelectItem>
                          <SelectItem value="financeiro">Financeiro</SelectItem>
                          <SelectItem value="fornecedor">Fornecedor</SelectItem>
                          <SelectItem value="geral">Geral</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Nível/Função</Label>
                      <Select
                        value={formData.attendant_role}
                        onValueChange={(value) => setFormData({...formData, attendant_role: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="junior">Júnior</SelectItem>
                          <SelectItem value="pleno">Pleno</SelectItem>
                          <SelectItem value="senior">Sênior</SelectItem>
                          <SelectItem value="coordenador">Coordenador</SelectItem>
                          <SelectItem value="gerente">Gerente</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Status de Disponibilidade</Label>
                      <Select
                        value={formData.availability_status}
                        onValueChange={(value) => setFormData({...formData, availability_status: value})}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="online">🟢 Online</SelectItem>
                          <SelectItem value="ocupado">🟡 Ocupado</SelectItem>
                          <SelectItem value="em_pausa">🟠 Em Pausa</SelectItem>
                          <SelectItem value="offline">🔴 Offline</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label>Máx. Conversas Simultâneas</Label>
                      <Input
                        type="number"
                        min="1"
                        max="50"
                        value={formData.max_concurrent_conversations}
                        onChange={(e) => setFormData({...formData, max_concurrent_conversations: parseInt(e.target.value)})}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>WhatsApp do Atendente (para notificações)</Label>
                    <Input
                      type="tel"
                      value={formData.whatsapp_phone}
                      onChange={(e) => setFormData({...formData, whatsapp_phone: e.target.value})}
                      placeholder="+5548999322400"
                    />
                    <p className="text-xs text-slate-500 mt-1">
                      Formato: +DDI + DDD + Número (ex: +5548999322400)
                    </p>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <Label>Notificar Novas Conversas</Label>
                      <p className="text-xs text-slate-500 mt-1">
                        Receber alertas quando uma conversa for atribuída
                      </p>
                    </div>
                    <Switch
                      checked={formData.notificar_novas_conversas}
                      onCheckedChange={(checked) => setFormData({...formData, notificar_novas_conversas: checked})}
                    />
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 3: PERMISSÕES */}
        <TabsContent value="permissoes" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Permissões da Central de Comunicação
              </CardTitle>
              <CardDescription>
                Configure o que este usuário pode fazer no WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarPerfilPadrao('atendente_basico')}
                >
                  Perfil: Atendente Básico
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarPerfilPadrao('supervisor')}
                >
                  Perfil: Supervisor
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => aplicarPerfilPadrao('gerente')}
                >
                  Perfil: Gerente
                </Button>
              </div>

              <Separator />

              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  Gestão de Contatos
                </h4>
                <PermissionSwitch
                  label="Criar Contatos"
                  name="pode_criar_contatos"
                  description="Adicionar novos contatos ao sistema"
                />
                <PermissionSwitch
                  label="Editar Contatos"
                  name="pode_editar_contatos"
                  description="Modificar dados de contatos existentes"
                />
                <PermissionSwitch
                  label="Bloquear Contatos"
                  name="pode_bloquear_contatos"
                  description="Bloquear/desbloquear contatos (lista negra)"
                />
                <PermissionSwitch
                  label="Deletar Contatos"
                  name="pode_deletar_contatos"
                  description="Remover contatos permanentemente"
                />
              </div>

              <Separator />

              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4" />
                  Envio de Mensagens
                </h4>
                <PermissionSwitch
                  label="Enviar Mensagens de Texto"
                  name="pode_enviar_mensagens"
                  description="Enviar mensagens de texto simples"
                />
                <PermissionSwitch
                  label="Enviar Mídias (Imagens, Vídeos, Docs)"
                  name="pode_enviar_midias"
                  description="Anexar e enviar arquivos de mídia"
                />
                <PermissionSwitch
                  label="Enviar Áudios"
                  name="pode_enviar_audios"
                  description="Gravar e enviar mensagens de voz"
                />
                <PermissionSwitch
                  label="Encaminhar Mensagens"
                  name="pode_encaminhar_mensagens"
                  description="Encaminhar mensagens para outros contatos"
                />
                <PermissionSwitch
                  label="Apagar Mensagens"
                  name="pode_apagar_mensagens"
                  description="Apagar mensagens enviadas (para todos)"
                />
              </div>

              <Separator />

              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4" />
                  Gestão de Conversas
                </h4>
                <PermissionSwitch
                  label="Transferir Conversas"
                  name="pode_transferir_conversas"
                  description="Transferir conversas para outros atendentes"
                />
                <PermissionSwitch
                  label="Ver Todas as Conversas"
                  name="pode_ver_todas_conversas"
                  description="Acessar conversas de outros atendentes (supervisão)"
                />
                <PermissionSwitch
                  label="Atribuir Conversas"
                  name="pode_atribuir_conversas"
                  description="Atribuir conversas não atribuídas para si ou outros"
                />
              </div>

              <Separator />

              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <FileText className="w-4 h-4" />
                  Templates e Respostas Rápidas
                </h4>
                <PermissionSwitch
                  label="Usar Templates"
                  name="pode_usar_templates"
                  description="Utilizar templates de mensagens aprovados"
                />
                <PermissionSwitch
                  label="Criar Templates"
                  name="pode_criar_templates"
                  description="Criar novos templates para aprovação"
                />
                <PermissionSwitch
                  label="Usar Respostas Rápidas"
                  name="pode_usar_respostas_rapidas"
                  description="Utilizar respostas rápidas existentes"
                />
                <PermissionSwitch
                  label="Criar Respostas Rápidas"
                  name="pode_criar_respostas_rapidas"
                  description="Criar novas respostas rápidas"
                />
              </div>

              <Separator />

              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <BarChart3 className="w-4 h-4" />
                  Dados e Relatórios
                </h4>
                <PermissionSwitch
                  label="Ver Histórico Completo"
                  name="pode_ver_historico_completo"
                  description="Acessar todo o histórico de mensagens"
                />
                <PermissionSwitch
                  label="Exportar Conversas"
                  name="pode_exportar_conversas"
                  description="Baixar conversas em PDF/CSV"
                />
                <PermissionSwitch
                  label="Acessar Relatórios"
                  name="pode_acessar_relatorios"
                  description="Ver relatórios e analytics"
                />
              </div>

              <Separator />

              <div className="space-y-1">
                <h4 className="font-semibold text-sm flex items-center gap-2 mb-2">
                  <Shield className="w-4 h-4" />
                  Configurações Avançadas
                </h4>
                <PermissionSwitch
                  label="Configurar Integração WhatsApp"
                  name="pode_configurar_integracao"
                  description="Gerenciar integrações e webhooks"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 4: PERMISSÕES WHATSAPP POR INSTÂNCIA */}
        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Phone className="w-5 h-5" />
                Permissões por Instância WhatsApp
              </CardTitle>
              <CardDescription>
                Configure quais canais este usuário pode acessar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ConfiguracaoPermissoesWhatsApp
                whatsappPermissions={formData.whatsapp_permissions}
                onChange={(novasPermissoes) => setFormData({
                  ...formData,
                  whatsapp_permissions: novasPermissoes
                })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 5: HORÁRIOS */}
        <TabsContent value="horarios" className="space-y-4 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Horário de Atendimento
              </CardTitle>
              <CardDescription>
                Configure os horários em que o atendente está disponível
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Hora de Início</Label>
                  <Input
                    type="time"
                    value={formData.horario_atendimento.inicio}
                    onChange={(e) => setFormData({
                      ...formData,
                      horario_atendimento: {
                        ...formData.horario_atendimento,
                        inicio: e.target.value
                      }
                    })}
                  />
                </div>

                <div>
                  <Label>Hora de Término</Label>
                  <Input
                    type="time"
                    value={formData.horario_atendimento.fim}
                    onChange={(e) => setFormData({
                      ...formData,
                      horario_atendimento: {
                        ...formData.horario_atendimento,
                        fim: e.target.value
                      }
                    })}
                  />
                </div>
              </div>

              <div>
                <Label className="mb-3 block">Dias da Semana</Label>
                <div className="flex gap-2 flex-wrap">
                  {diasSemanaLabels.map((dia, index) => (
                    <Button
                      key={index}
                      type="button"
                      variant={formData.horario_atendimento.dias_semana.includes(index) ? "default" : "outline"}
                      size="sm"
                      onClick={() => toggleDiaSemana(index)}
                      className={formData.horario_atendimento.dias_semana.includes(index) ? "bg-green-600 hover:bg-green-700" : ""}
                    >
                      {dia}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Horário Configurado
                    </p>
                    <p className="text-sm text-blue-700 mt-1">
                      {formData.horario_atendimento.inicio} às {formData.horario_atendimento.fim}
                      {" - "}
                      {formData.horario_atendimento.dias_semana.map(d => diasSemanaLabels[d]).join(", ")}
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* BOTÕES DE AÇÃO */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700">
          <CheckCircle2 className="w-4 h-4 mr-2" />
          {usuario ? 'Atualizar Usuário' : 'Criar Usuário'}
        </Button>
      </div>
    </form>
  );
}