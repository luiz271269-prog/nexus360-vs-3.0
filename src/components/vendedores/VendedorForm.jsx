import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Camera, User, AlertCircle } from "lucide-react";

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
  const [formData, setFormData] = useState({
    user_id: "",
    codigo: "",
    telefone: "",
    foto_url: "",
    meta_mensal: 0,
    meta_semanal: 0,
    status: "ativo",
    comissao_percentual: 0,
    data_admissao: "",
    meta_ligacoes_diarias: 10,
    meta_whatsapp_diarios: 5,
    meta_emails_diarios: 3,
    ...vendedor
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
      setUsuarios(users || []);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoadingUsuarios(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.user_id) {
      alert('Selecione um usuário para vincular ao vendedor.');
      return;
    }
    setLoading(true);
    // Preencher nome e email a partir do usuário selecionado antes de salvar
    const usuarioSelecionado = usuarios.find(u => u.id === formData.user_id);
    const dadosParaSalvar = {
      ...formData,
      nome: usuarioSelecionado?.full_name || formData.nome || '',
      email: usuarioSelecionado?.email || formData.email || '',
    };
    await onSalvar(dadosParaSalvar);
    setLoading(false);
  };

  const handleChange = (campo, valor) => setFormData(prev => ({ ...prev, [campo]: valor }));

  const handleFotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Selecione apenas imagens'); return; }
    setUploadandoFoto(true);
    try {
      const { UploadFile } = await import("@/integrations/Core");
      const { file_url } = await UploadFile({ file });
      handleChange("foto_url", file_url);
    } catch (error) {
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
          const renamedFile = new File([file], `foto-vendedor-${Date.now()}.png`, { type: file.type });
          setUploadandoFoto(true);
          try {
            const { UploadFile } = await import("@/integrations/Core");
            const { file_url } = await UploadFile({ file: renamedFile });
            handleChange("foto_url", file_url);
          } catch { alert('Erro ao colar foto'); }
          finally { setUploadandoFoto(false); }
        }
      }
    }
  };

  const usuarioSelecionado = usuarios.find(u => u.id === formData.user_id);

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold text-white">{vendedor ? "Editar Vendedor" : "Novo Vendedor"}</h2>
          <Button onClick={onCancelar} size="icon" variant="ghost"><X className="w-5 h-5" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          {/* SELEÇÃO DO USUÁRIO */}
          <div className="bg-gradient-to-r from-blue-500/20 to-purple-500/20 border-2 border-blue-400/30 rounded-xl p-4">
            <Label className="text-blue-300 text-base font-semibold mb-3 block">Usuário do Sistema</Label>

            {loadingUsuarios ? (
              <div className="text-white/60 text-sm">Carregando usuários...</div>
            ) : (
              <div className="space-y-3">
                <Select value={formData.user_id || ''} onValueChange={(v) => handleChange("user_id", v)}>
                  <SelectTrigger className="bg-black/20 border-white/20 text-white">
                    <SelectValue placeholder="Selecione o usuário..." />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-800 text-white border-white/20">
                    {usuarios.map(usuario => (
                      <SelectItem key={usuario.id} value={usuario.id}>
                        <span>{usuario.full_name}</span>
                        <span className="text-xs text-gray-400 ml-2">({usuario.email})</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {usuarioSelecionado ? (
                  <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 text-sm text-green-300">
                    ✓ <strong>{usuarioSelecionado.full_name}</strong> — {usuarioSelecionado.email}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                    <p className="text-amber-300 text-sm">Selecione um usuário para criar o vendedor.</p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Foto */}
          <div className="flex justify-center">
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
                  <img src={formData.foto_url} alt="Foto" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="text-center">
                    <User className="w-8 h-8 text-white/60 mx-auto mb-1" />
                    <span className="text-xs text-white/60">Foto 3x4</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFotoUpload} className="hidden" />
              <p className="text-xs text-gray-400 text-center mt-2">Clique ou Ctrl+V para colar</p>
            </div>
          </div>

          {/* Dados complementares */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-gray-300 text-sm">Código</Label><GlassInput value={formData.codigo} onChange={(e) => handleChange("codigo", e.target.value)} required /></div>
            <div><Label className="text-gray-300 text-sm">Telefone</Label><GlassInput value={formData.telefone} onChange={(e) => handleChange("telefone", e.target.value)} /></div>
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
            <Button type="submit" disabled={loading || uploadandoFoto || !formData.user_id} className="bg-indigo-600 hover:bg-indigo-500 text-white font-semibold">
              <Save className="w-4 h-4 mr-2" /> {loading ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}