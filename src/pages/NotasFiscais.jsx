import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  FileText, Search, Upload, Send, CheckCircle2, Clock,
  AlertCircle, Download, RefreshCw, Plus, Smartphone, Eye
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { dispararNotaFiscalWhatsApp } from "@/functions/dispararNotaFiscalWhatsApp";

// ─── Helpers ────────────────────────────────────────────────────────────────

const TIPO_LABEL = {
  nfe: "NF-e", nfse: "NFS-e", nfce: "NFC-e", boleto: "Boleto", recibo: "Recibo"
};
const TIPO_COLOR = {
  nfe: "bg-blue-100 text-blue-800", nfse: "bg-purple-100 text-purple-800",
  nfce: "bg-teal-100 text-teal-800", boleto: "bg-orange-100 text-orange-800",
  recibo: "bg-slate-100 text-slate-700"
};
const STATUS_COLOR = {
  emitida: "bg-green-100 text-green-800",
  cancelada: "bg-red-100 text-red-800",
  pendente: "bg-yellow-100 text-yellow-800",
  erro: "bg-red-100 text-red-700"
};
const FONTE_LABEL = {
  manual: "Manual", nfe_io: "NFe.io", enotas: "eNotas", omie: "Omie",
  bling: "Bling", nfse_gov: "Prefeitura", upload_direto: "Upload"
};

function fmtMoeda(v) {
  return v != null ? `R$ ${Number(v).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—";
}

function fmtData(d) {
  if (!d) return "—";
  try { return format(new Date(d), "dd/MM/yyyy"); } catch { return d; }
}

// ─── Formulário de nova NF ───────────────────────────────────────────────────
function ModalNovaNF({ onClose, onSaved }) {
  const [form, setForm] = useState({
    numero_nf: "", tipo: "nfe", status: "emitida",
    contact_id: "", cliente_nome: "", cliente_cnpj_cpf: "",
    valor_total: "", data_emissao: "", data_vencimento: "",
    descricao_servico: "", pdf_url: "", xml_url: "", fonte: "upload_direto"
  });

  const [pdfFile, setPdfFile] = useState(null);
  const [uploading, setUploading] = useState(false);

  const handleUploadPDF = async (file) => {
    setUploading(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setForm(f => ({ ...f, pdf_url: file_url }));
      setPdfFile(file.name);
      toast.success("PDF carregado com sucesso!");
    } catch (e) {
      toast.error("Erro ao fazer upload do PDF");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!form.numero_nf || !form.contact_id) {
      toast.error("Número da NF e Contact ID são obrigatórios");
      return;
    }
    await base44.entities.NotaFiscal.create({
      ...form,
      valor_total: form.valor_total ? Number(form.valor_total) : null
    });
    toast.success("Nota fiscal cadastrada!");
    onSaved();
    onClose();
  };

  const F = ({ label, name, type = "text", children }) => (
    <div>
      <label className="text-xs font-medium text-slate-600 block mb-1">{label}</label>
      {children || (
        <Input
          type={type}
          value={form[name] || ""}
          onChange={e => setForm(f => ({ ...f, [name]: e.target.value }))}
          className="h-8 text-sm"
        />
      )}
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-bold text-slate-900 text-lg">Nova Nota Fiscal</h2>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <div className="p-5 grid grid-cols-2 gap-4">
          <F label="Número NF *" name="numero_nf" />
          <F label="Contact ID *" name="contact_id" />
          <F label="Tipo">
            <select value={form.tipo} onChange={e => setForm(f => ({ ...f, tipo: e.target.value }))}
              className="w-full h-8 text-sm border border-slate-200 rounded-md px-2">
              {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </F>
          <F label="Status">
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
              className="w-full h-8 text-sm border border-slate-200 rounded-md px-2">
              {["emitida", "pendente", "cancelada", "erro"].map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </F>
          <F label="Nome do Cliente" name="cliente_nome" />
          <F label="CNPJ/CPF" name="cliente_cnpj_cpf" />
          <F label="Valor Total" name="valor_total" type="number" />
          <F label="Data de Emissão" name="data_emissao" type="date" />
          <F label="Orçamento ID" name="orcamento_id" />
          <F label="Fonte">
            <select value={form.fonte} onChange={e => setForm(f => ({ ...f, fonte: e.target.value }))}
              className="w-full h-8 text-sm border border-slate-200 rounded-md px-2">
              {Object.entries(FONTE_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </F>
          <div className="col-span-2">
            <F label="Descrição do Serviço/Produto" name="descricao_servico" />
          </div>
          <div className="col-span-2">
            <label className="text-xs font-medium text-slate-600 block mb-1">PDF da Nota Fiscal</label>
            {form.pdf_url ? (
              <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
                <span className="text-xs text-green-700 truncate">{pdfFile || "PDF carregado"}</span>
                <Button variant="ghost" size="sm" className="ml-auto text-xs h-6" onClick={() => setForm(f => ({ ...f, pdf_url: "" }))}>
                  Trocar
                </Button>
              </div>
            ) : (
              <label className="flex items-center gap-2 p-3 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-orange-400 hover:bg-orange-50 transition-all">
                <Upload className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-500">{uploading ? "Enviando..." : "Clique para fazer upload do PDF"}</span>
                <input type="file" accept=".pdf" className="hidden" disabled={uploading}
                  onChange={e => e.target.files?.[0] && handleUploadPDF(e.target.files[0])} />
              </label>
            )}
          </div>
          <div className="col-span-2">
            <F label="URL do PDF (se já hospedado)" name="pdf_url" />
          </div>
          <div className="col-span-2">
            <F label="URL do XML" name="xml_url" />
          </div>
        </div>
        <div className="p-5 border-t border-slate-200 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={handleSave}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0">
            <Plus className="w-4 h-4 mr-1" />Salvar Nota Fiscal
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Card de NF ─────────────────────────────────────────────────────────────
function CardNF({ nf, contacts, onEnviar }) {
  const [enviando, setEnviando] = useState(false);
  const contato = contacts?.find(c => c.id === nf.contact_id);

  const handleEnviar = async () => {
    if (!nf.pdf_url) { toast.error("Esta NF não possui PDF cadastrado"); return; }
    setEnviando(true);
    try {
      const res = await dispararNotaFiscalWhatsApp({
        nota_fiscal_id: nf.id,
        contact_id: nf.contact_id,
        thread_id: nf.thread_id || null
      });
      if (res?.data?.success) {
        toast.success(`✅ Nota ${nf.numero_nf} enviada via WhatsApp!`);
        onEnviar();
      } else {
        toast.error(res?.data?.error || "Falha ao enviar a NF");
      }
    } catch (e) {
      toast.error(e.message || "Erro ao enviar NF");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all p-4">
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${TIPO_COLOR[nf.tipo] || "bg-slate-100 text-slate-700"}`}>
              {TIPO_LABEL[nf.tipo] || nf.tipo}
            </span>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[nf.status] || "bg-slate-100"}`}>
              {nf.status}
            </span>
            {nf.enviada_whatsapp && (
              <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700 flex items-center gap-1">
                <Smartphone className="w-2.5 h-2.5" /> Enviada
              </span>
            )}
          </div>
          <h3 className="font-bold text-slate-900 text-sm">{nf.numero_nf}</h3>
          <p className="text-xs text-slate-500">{nf.cliente_nome || contato?.nome || "—"}</p>
        </div>
        <div className="text-right">
          <p className="font-bold text-slate-900 text-sm">{fmtMoeda(nf.valor_total)}</p>
          <p className="text-xs text-slate-400">{fmtData(nf.data_emissao)}</p>
        </div>
      </div>

      {nf.descricao_servico && (
        <p className="text-xs text-slate-600 mb-3 line-clamp-2 bg-slate-50 rounded px-2 py-1">
          {nf.descricao_servico}
        </p>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        {nf.pdf_url && (
          <a href={nf.pdf_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Eye className="w-3 h-3" />PDF
            </Button>
          </a>
        )}
        {nf.xml_url && (
          <a href={nf.xml_url} target="_blank" rel="noopener noreferrer">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
              <Download className="w-3 h-3" />XML
            </Button>
          </a>
        )}
        <Button
          size="sm"
          disabled={enviando || !nf.pdf_url}
          onClick={handleEnviar}
          className={`h-7 text-xs gap-1 ml-auto ${
            nf.enviada_whatsapp
              ? "bg-green-100 text-green-700 hover:bg-green-200 border border-green-300"
              : "bg-gradient-to-r from-green-500 to-emerald-600 text-white border-0"
          }`}
        >
          {enviando ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          {enviando ? "Enviando..." : nf.enviada_whatsapp ? "Reenviar" : "Enviar WA"}
        </Button>
      </div>

      <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-400">
        <span>{FONTE_LABEL[nf.fonte] || nf.fonte}</span>
        {nf.enviada_whatsapp_em && (
          <>
            <span>•</span>
            <span>Enviado em {fmtData(nf.enviada_whatsapp_em)}</span>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Página principal ────────────────────────────────────────────────────────
export default function NotasFiscais() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("todos");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: notas = [], isLoading } = useQuery({
    queryKey: ["notas-fiscais"],
    queryFn: () => base44.entities.NotaFiscal.list("-created_date", 100),
    staleTime: 30 * 1000
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-nf"],
    queryFn: () => base44.entities.Contact.list("-created_date", 200),
    staleTime: 5 * 60 * 1000
  });

  const notasFiltradas = notas.filter(nf => {
    const buscaNorm = busca.toLowerCase();
    const matchBusca = !busca ||
      nf.numero_nf?.toLowerCase().includes(buscaNorm) ||
      nf.cliente_nome?.toLowerCase().includes(buscaNorm) ||
      nf.chave_acesso?.includes(busca) ||
      nf.descricao_servico?.toLowerCase().includes(buscaNorm);
    const matchStatus = filtroStatus === "todos" || nf.status === filtroStatus;
    const matchTipo = filtroTipo === "todos" || nf.tipo === filtroTipo;
    return matchBusca && matchStatus && matchTipo;
  });

  const stats = {
    total: notas.length,
    emitidas: notas.filter(n => n.status === "emitida").length,
    enviadas_wa: notas.filter(n => n.enviada_whatsapp).length,
    sem_pdf: notas.filter(n => !n.pdf_url).length
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50/30 to-slate-50 p-6">
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
              <FileText className="w-7 h-7 text-orange-500" />
              Notas Fiscais
            </h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Gerencie e envie documentos fiscais aos clientes via WhatsApp
            </p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-orange-500 to-amber-500 text-white border-0 gap-2"
          >
            <Plus className="w-4 h-4" />Nova Nota Fiscal
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Total", value: stats.total, icon: FileText, color: "text-blue-600 bg-blue-50" },
            { label: "Emitidas", value: stats.emitidas, icon: CheckCircle2, color: "text-green-600 bg-green-50" },
            { label: "Enviadas WA", value: stats.enviadas_wa, icon: Smartphone, color: "text-emerald-600 bg-emerald-50" },
            { label: "Sem PDF", value: stats.sem_pdf, icon: AlertCircle, color: "text-red-600 bg-red-50" }
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${s.color}`}>
                <s.icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900">{s.value}</p>
                <p className="text-xs text-slate-500">{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Filtros */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5 flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              value={busca}
              onChange={e => setBusca(e.target.value)}
              placeholder="Buscar por número, cliente, chave..."
              className="pl-9 h-9"
            />
          </div>
          <select
            value={filtroStatus}
            onChange={e => setFiltroStatus(e.target.value)}
            className="h-9 text-sm border border-slate-200 rounded-md px-3"
          >
            <option value="todos">Todos os status</option>
            <option value="emitida">Emitidas</option>
            <option value="pendente">Pendentes</option>
            <option value="cancelada">Canceladas</option>
            <option value="erro">Com erro</option>
          </select>
          <select
            value={filtroTipo}
            onChange={e => setFiltroTipo(e.target.value)}
            className="h-9 text-sm border border-slate-200 rounded-md px-3"
          >
            <option value="todos">Todos os tipos</option>
            {Object.entries(TIPO_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => qc.invalidateQueries({ queryKey: ["notas-fiscais"] })}
            className="h-9"
          >
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>

        {/* Grid de notas */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(6).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 animate-pulse">
                <div className="h-4 bg-slate-200 rounded w-1/2 mb-2" />
                <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
                <div className="h-3 bg-slate-200 rounded w-1/3" />
              </div>
            ))}
          </div>
        ) : notasFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <FileText className="w-14 h-14 text-slate-200 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">
              {busca ? "Nenhuma NF encontrada para esta busca" : "Nenhuma nota fiscal cadastrada"}
            </p>
            {!busca && (
              <Button onClick={() => setModalOpen(true)} className="mt-4 bg-orange-500 text-white">
                <Plus className="w-4 h-4 mr-1" />Cadastrar primeira NF
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {notasFiltradas.map(nf => (
              <CardNF
                key={nf.id}
                nf={nf}
                contacts={contacts}
                onEnviar={() => qc.invalidateQueries({ queryKey: ["notas-fiscais"] })}
              />
            ))}
          </div>
        )}
      </div>

      {modalOpen && (
        <ModalNovaNF
          onClose={() => setModalOpen(false)}
          onSaved={() => qc.invalidateQueries({ queryKey: ["notas-fiscais"] })}
        />
      )}
    </div>
  );
}