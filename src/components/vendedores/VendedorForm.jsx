import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { X, Save, Camera, User } from "lucide-react";

const GlassInput = (props) => (
  <Input {...props} className="bg-black/20 border-white/20 text-white placeholder:text-gray-400" />
);

const GlassSelect = ({ children, ...props }) => (
  <Select {...props}>
    <SelectTrigger className="bg-black/20 border-white/20 text-white"><SelectValue /></SelectTrigger>
    <SelectContent className="bg-gray-800 text-white border-white/20">{children}</SelectContent>
  </Select>
);

// Edita diretamente os campos de vendedor no User
export default function VendedorForm({ vendedor, onSalvar, onCancelar }) {
  const [formData, setFormData] = useState({
    codigo: vendedor?.codigo || "",
    telefone_ramal: vendedor?.telefone_ramal || "",
    foto_url: vendedor?.foto_url || "",
    meta_mensal: vendedor?.meta_mensal || 0,
    meta_semanal: vendedor?.meta_semanal || 0,
    status_vendedor: vendedor?.status_vendedor || "ativo",
    comissao_percentual: vendedor?.comissao_percentual || 0,
    data_admissao: vendedor?.data_admissao || "",
    meta_ligacoes_diarias: vendedor?.meta_ligacoes_diarias || 10,
    meta_whatsapp_diarios: vendedor?.meta_whatsapp_diarios || 5,
    meta_emails_diarios: vendedor?.meta_emails_diarios || 3,
    capacidade_maxima: vendedor?.capacidade_maxima || 20,
  });

  const [loading, setLoading] = useState(false);
  const [uploadandoFoto, setUploadandoFoto] = useState(false);
  const fileInputRef = React.useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    await onSalvar(formData);
    setLoading(false);
  };

  const handleChange = (campo, valor) => setFormData(prev => ({ ...prev, [campo]: valor }));

  const handleFotoUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    setUploadandoFoto(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      handleChange("foto_url", file_url);
    } catch (error) {
      console.error('Erro ao fazer upload da foto:', error);
    } finally {
      setUploadandoFoto(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900/70 backdrop-blur-xl border border-white/10 rounded-2xl p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h2 className="text-xl font-bold text-white">Editar Vendedor</h2>
            <p className="text-gray-400 text-sm mt-1">{vendedor?.full_name} · {vendedor?.email}</p>
          </div>
          <Button onClick={onCancelar} size="icon" variant="ghost"><X className="w-5 h-5" /></Button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Foto */}
          <div className="flex justify-center mb-4">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
              <div className="w-24 h-24 rounded-full bg-slate-800/50 border-2 border-dashed border-white/30 flex items-center justify-center overflow-hidden group-hover:border-blue-400 transition-colors">
                {uploadandoFoto ? (
                  <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
                ) : formData.foto_url ? (
                  <img src={formData.foto_url} alt="Foto" className="w-full h-full object-cover rounded-full" />
                ) : (
                  <div className="text-center"><User className="w-8 h-8 text-white/60 mx-auto mb-1" /><span className="text-xs text-white/60">Foto 3x4</span></div>
                )}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-full">
                  <Camera className="w-6 h-6 text-white" />
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFotoUpload} className="hidden" />
              <p className="text-xs text-gray-400 text-center mt-1">Clique para trocar</p>
            </div>
          </div>

          {/* Identificação */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div><Label className="text-gray-300 text-sm">Código (ex: V-01)</Label><GlassInput value={formData.codigo} onChange={(e) => handleChange("codigo", e.target.value)} required placeholder="V-01" /></div>
            <div><Label className="text-gray-300 text-sm">Ramal/Telefone</Label><GlassInput value={formData.telefone_ramal} onChange={(e) => handleChange("telefone_ramal", e.target.value)} /></div>
          </div>

          {/* Metas Financeiras */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Metas Financeiras</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><Label className="text-gray-300 text-sm">Meta Mensal (R$)</Label><GlassInput type="number" value={formData.meta_mensal} onChange={(e) => handleChange("meta_mensal", parseFloat(e.target.value) || 0)} /></div>
              <div><Label className="text-gray-300 text-sm">Meta Semanal (R$)</Label><GlassInput type="number" value={formData.meta_semanal} onChange={(e) => handleChange("meta_semanal", parseFloat(e.target.value) || 0)} /></div>
            </div>
          </div>

          {/* Metas Atividades */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Metas Diárias de Atividades</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div><Label className="text-gray-300 text-sm">Ligações/Dia</Label><GlassInput type="number" value={formData.meta_ligacoes_diarias} onChange={(e) => handleChange("meta_ligacoes_diarias", parseInt(e.target.value) || 0)} /></div>
              <div><Label className="text-gray-300 text-sm">WhatsApp/Dia</Label><GlassInput type="number" value={formData.meta_whatsapp_diarios} onChange={(e) => handleChange("meta_whatsapp_diarios", parseInt(e.target.value) || 0)} /></div>
              <div><Label className="text-gray-300 text-sm">E-mails/Dia</Label><GlassInput type="number" value={formData.meta_emails_diarios} onChange={(e) => handleChange("meta_emails_diarios", parseInt(e.target.value) || 0)} /></div>
            </div>
          </div>

          {/* Configurações */}
          <div className="border-t border-white/10 pt-4">
            <h3 className="text-white font-semibold mb-3 text-sm">Configurações</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label className="text-gray-300 text-sm">Status</Label>
                <GlassSelect value={formData.status_vendedor} onValueChange={(v) => handleChange("status_vendedor", v)}>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="inativo">Inativo</SelectItem>
                  <SelectItem value="ferias">Férias</SelectItem>
                </GlassSelect>
              </div>
              <div><Label className="text-gray-300 text-sm">Comissão (%)</Label><GlassInput type="number" value={formData.comissao_percentual} onChange={(e) => handleChange("comissao_percentual", parseFloat(e.target.value) || 0)} /></div>
              <div><Label className="text-gray-300 text-sm">Cap. Máxima Leads</Label><GlassInput type="number" value={formData.capacidade_maxima} onChange={(e) => handleChange("capacidade_maxima", parseInt(e.target.value) || 20)} /></div>
            </div>
            <div className="mt-3"><Label className="text-gray-300 text-sm">Data Admissão</Label><GlassInput type="date" value={formData.data_admissao} onChange={(e) => handleChange("data_admissao", e.target.value)} /></div>
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