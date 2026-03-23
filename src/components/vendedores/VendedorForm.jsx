import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Camera, User, Link as LinkIcon, CheckCircle, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const GlassInput = (props) => (
  <Input {...props} className="bg-black/20 border-white/20 text-white placeholder:text-gray-400" />
);

const GlassSelect = ({ children, ...props }) => (
  <Select {...props}>
    <SelectTrigger className="bg-black/20 border-white/20 text-white">
      <SelectValue />
    </SelectTrigger>
    <SelectContent className="bg-gray-800 text-white border-white/20">{children}</SelectContent>
  </Select>
);

export default function VendedorForm({ vendedor, onSalvar, onCancelar }) {
  const [formData, setFormData] = useState(vendedor || {
    user_id: "", codigo: "", telefone: "", foto_url: "",
    meta_mensal: 0, meta_semanal: 0, status: "ativo",
    comissao_percentual: 0, data_admissao: "",
    meta_ligacoes_diarias: 10,
    meta_whatsapp_diarios: 5,
    meta_emails_diarios: 3
  });
  
  const [loading, setLoading] = useState(false);
  const [uploadandoFoto, setUploadandoFoto] = useState(false);
  const [usuarios, setUsuarios] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    carregarUsuarios();
  }, []);

  const carregarUsuarios = async () => {
    setLoadingUsuarios(true);
    try {
      const users = await base44.entities.User.list();
      // Filtrar apenas usuários com role 'user' (vendedores)
      const vendedoresUsuarios = users.filter(u => u.role === 'user');
      setUsuarios(vendedoresUsuarios);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSalvar(formData);
    setLoading(false);
  };

  const handleChange = (campo, valor) => setFormData(prev => ({ ...prev, [campo]: valor }));

  const handleVincularUsuario = (userId) => {
    setFormData(prev => ({ ...prev, user_id: userId }));
  };

  const handleFotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    setUploadandoFoto(true);
    try {
      const { UploadFile } = await import("@/integrations/Core");
      const { file_url } = await UploadFile({ file });
      handleChange("foto_url", file_url);
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
      alert('Erro ao fazer upload da foto');
    } finally {
      setUploadandoFoto(false);
    }
  };

  const handlePasteFoto = async (e) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          const fileName = `foto-vendedor-${Date.now()}.png`;
          const renamedFile = new File([file], fileName, { type: file.type });
          
          setUploadandoFoto(true);
          try {
            const { UploadFile } = await import("@/integrations/Core");
            const { file_url } = await UploadFile({ file: renamedFile });
            handleChange("foto_url", file_url);
          } catch (error) {
            console.error('Erro ao colar foto:', error);
            alert('Erro ao colar foto');
          } finally {
            setUploadandoFoto(false);
          }
        }
      }
    }
  };

  const usuarioVinculado = usuarios.find(u => u.id === formData.user_id);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{vendedor ? "Editar Vendedor" : "Novo Vendedor"}</h2>
          <Button onClick={onCancelar} size="icon" variant="ghost"><X className="w-5 h-5" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* VINCULAÇÃO COM USUÁRIO - DESTAQUE NO TOPO */}
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-400/30 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 mb-3">
              <LinkIcon className="w-5 h-5 text-blue-400" />
              <Label className="text-blue-300 text-base font-semibold">Vincular Usuário (Login)</Label>
            </div>
            
            {loadingUsuarios ? (
              <div className="text-white/60 text-sm">Carregando usuários...</div>
            ) : (
              <div className="space-y-3">
                <Select 
                  value={formData.user_id || ''} 
                  onValueChange={handleVincularUsuario}
                >
                  <SelectTrigger className="bg-black/20 border-white/20 text-white">
                    <SelectValue placeholder="Selecione um usuário para vincular..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-white/20">
                    <SelectItem value={null}>Nenhum usuário vinculado</SelectItem>
                    {usuarios.map(usuario => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        <div className="flex items-center gap-2">
                          <span>{usuario.full_name}</span>
                          <span className="text-xs text-gray-400">({usuario.email})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {usuarioVinculado ? (
                  <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/30 rounded-lg p-3">
                    <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-green-300 font-medium text-sm">Vinculado com sucesso!</p>
                      <p className="text-green-400/80 text-xs mt-1">
                        {usuarioVinculado.full_name} poderá fazer login e acessar o sistema.
                      </p>
                      <p className="text-green-400/60 text-xs mt-1">
                        Email: {usuarioVinculado.email}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-amber-300 font-medium text-sm">Nenhum usuário vinculado</p>
                      <p className="text-amber-400/80 text-xs mt-1">
                        Este vendedor não terá acesso ao sistema. Vincule um usuário para permitir login.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Dados Pessoais */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Área da Foto - Formato Redondo */}
            <div className="md:col-span-2 flex justify-center mb-4">
              <div 
                className="relative group cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
                onPaste={handlePasteFoto}
                tabIndex={0}
              >
                <div className="w-24 h-24 rounded-full bg-slate-800/50 border-2 border-dashed border-white/30 flex items-center justify-center overflow-hidden group-hover:border-blue-400 transition-colors">
                  {uploadandoFoto ? (
                    <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                  ) : formData.foto_url ? (
                    <img 
                      src={formData.foto_url} 
                      alt="Foto do vendedor" 
                      className="w-full h-full object-cover rounded-full"
                    />
                  ) : (
                    <div className="text-center">
                      <User className="w-8 h-8 text-white/60 mx-auto mb-2" />
                      <span className="text-sm text-white/60">Foto 3x4</span>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                    <Camera className="w-6 h-6 text-white" />
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFotoUpload}
                  className="hidden"
                />
                <p className="text-xs text-gray-400 text-center mt-2">Clique ou Ctrl+V para colar</p>
              </div>
            </div>

            <div><Label className="text-gray-300 text-sm">Código</Label><GlassInput value={formData.codigo} onChange={(e) => handleChange("codigo", e.target.value)} required /></div>
            <div><Label className="text-gray-300 text-sm">Ramal/Telefone</Label><GlassInput value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} /></div>
          </div>

          {/* Metas Financeiras */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Metas Financeiras</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-gray-300 text-sm">Meta Mensal (R$)</Label><GlassInput type="number" value={formData.meta_mensal} onChange={(e) => handleChange("meta_mensal", parseFloat(e.target.value) || 0)} /></div>
              <div><Label className="text-gray-300 text-sm">Meta Semanal (R$)</Label><GlassInput type="number" value={formData.meta_semanal} onChange={(e) => handleChange("meta_semanal", parseFloat(e.target.value) || 0)} /></div>
            </div>
          </div>

          {/* Metas de Atividades */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Metas de Atividades Diárias</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label className="text-gray-300 text-sm">Ligações/Dia</Label><GlassInput type="number" value={formData.meta_ligacoes_diarias} onChange={(e) => handleChange("meta_ligacoes_diarias", parseInt(e.target.value) || 0)} /></div>
              <div><Label className="text-gray-300 text-sm">WhatsApp/Dia</Label><GlassInput type="number" value={formData.meta_whatsapp_diarios} onChange={(e) => handleChange("meta_whatsapp_diarios", parseInt(e.target.value) || 0)} /></div>
              <div><Label className="text-gray-300 text-sm">E-mails/Dia</Label><GlassInput type="number" value={formData.meta_emails_diarios} onChange={(e) => handleChange("meta_emails_diarios", parseInt(e.target.value) || 0)} /></div>
            </div>
          </div>

          {/* Configurações */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Configurações</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <Label className="text-gray-300 text-sm">Status</Label>
                <GlassSelect value={formData.status} onValueChange={(v) => handleChange("status", v)}>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                </GlassSelect>
              </div>
              <div><Label className="text-gray-300 text-sm">Data Admissão</Label><GlassInput type="date" value={formData.data_admissao} onChange={(e) => handleChange("data_admissao", e.target.value)} /></div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" onClick={onCancelar} variant="ghost">Cancelar</Button>
            <Button type="submit" disabled={loading || uploadandoFoto} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
              <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}