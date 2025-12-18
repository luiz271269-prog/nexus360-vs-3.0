import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Search, Loader2, X, Send, Paperclip, CheckSquare, Square, Image as ImageIcon, FileText, Mic } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function InternalMessageComposer({ open, onClose, currentUser }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [selectedSectors, setSelectedSectors] = useState([]);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [progress, setProgress] = useState({ sent: 0, errors: 0, total: 0 });

  const [attachedFile, setAttachedFile] = useState(null);
  const [attachedFileType, setAttachedFileType] = useState(null);
  const [attachedFilePreview, setAttachedFilePreview] = useState(null);

  // Buscar todos os usuários
  const { data: usuarios = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['usuarios-internos'],
    queryFn: () => base44.asServiceRole.entities.User.list(),
    enabled: open,
    staleTime: 2 * 60 * 1000
  });

  // Extrair setores únicos
  const setores = useMemo(() => {
    const setoresUnicos = new Set();
    usuarios.forEach(u => {
      if (u.attendant_sector) setoresUnicos.add(u.attendant_sector);
    });
    return Array.from(setoresUnicos).sort();
  }, [usuarios]);

  // Filtrar usuários por busca
  const usuariosFiltrados = useMemo(() => {
    if (!searchTerm) return usuarios.filter(u => u.id !== currentUser?.id);
    const term = searchTerm.toLowerCase();
    return usuarios.filter(u => 
      u.id !== currentUser?.id &&
      (u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.attendant_sector?.toLowerCase().includes(term))
    );
  }, [usuarios, searchTerm, currentUser?.id]);

  // Filtrar setores por busca
  const setoresFiltrados = useMemo(() => {
    if (!searchTerm) return setores;
    const term = searchTerm.toLowerCase();
    return setores.filter(s => s.toLowerCase().includes(term));
  }, [setores, searchTerm]);

  const toggleUser = (userId) => {
    setSelectedUsers(prev => 
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const toggleSector = (sectorName) => {
    setSelectedSectors(prev => 
      prev.includes(sectorName) ? prev.filter(s => s !== sectorName) : [...prev, sectorName]
    );
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Determinar tipo
    let type = 'document';
    if (file.type.startsWith('image/')) type = 'image';
    else if (file.type.startsWith('video/')) type = 'video';
    else if (file.type.startsWith('audio/')) type = 'audio';

    setAttachedFile(file);
    setAttachedFileType(type);

    // Preview para imagem
    if (type === 'image') {
      const reader = new FileReader();
      reader.onload = (e) => setAttachedFilePreview(e.target.result);
      reader.readAsDataURL(file);
    } else {
      setAttachedFilePreview(null);
    }
  };

  const clearAttachment = () => {
    setAttachedFile(null);
    setAttachedFileType(null);
    setAttachedFilePreview(null);
  };

  const handleSend = async () => {
    // Validar
    const hasText = messageText.trim().length > 0;
    const hasMedia = !!attachedFile;

    if (!hasText && !hasMedia) {
      toast.error('Digite uma mensagem ou anexe um arquivo');
      return;
    }

    const totalDestinos = selectedUsers.length + selectedSectors.length;
    if (totalDestinos === 0) {
      toast.error('Selecione pelo menos um usuário ou setor');
      return;
    }

    setSending(true);
    setProgress({ sent: 0, errors: 0, total: totalDestinos });

    let mediaUrl = null;
    
    // Upload de mídia se houver
    if (attachedFile) {
      try {
        toast.info('📤 Fazendo upload...');
        const uploadResponse = await base44.integrations.Core.UploadFile({ file: attachedFile });
        mediaUrl = uploadResponse.file_url;
      } catch (err) {
        toast.error('Erro ao fazer upload: ' + err.message);
        setSending(false);
        return;
      }
    }

    let sent = 0;
    let errors = 0;

    // 1. Enviar para usuários selecionados (1:1)
    for (const userId of selectedUsers) {
      try {
        const result = await base44.functions.invoke('getOrCreateInternalThread', {
          target_user_id: userId
        });

        if (result?.thread) {
          await base44.functions.invoke('sendInternalMessage', {
            thread_id: result.thread.id,
            content: messageText.trim() || (attachedFile ? `[${attachedFileType}]` : ''),
            media_type: attachedFileType || 'none',
            media_url: mediaUrl,
            metadata: { broadcast: true, destination_type: 'user' }
          });
          sent++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`Erro ao enviar para usuário ${userId}:`, err);
        errors++;
      }

      setProgress({ sent, errors, total: totalDestinos });
      await new Promise(r => setTimeout(r, 300)); // Delay entre envios
    }

    // 2. Enviar para setores selecionados (grupos)
    for (const sectorName of selectedSectors) {
      try {
        const result = await base44.functions.invoke('getOrCreateSectorThread', {
          sector_name: sectorName
        });

        if (result?.thread) {
          await base44.functions.invoke('sendInternalMessage', {
            thread_id: result.thread.id,
            content: messageText.trim() || (attachedFile ? `[${attachedFileType}]` : ''),
            media_type: attachedFileType || 'none',
            media_url: mediaUrl,
            metadata: { broadcast: true, destination_type: 'sector', sector_name: sectorName }
          });
          sent++;
        } else {
          errors++;
        }
      } catch (err) {
        console.error(`Erro ao enviar para setor ${sectorName}:`, err);
        errors++;
      }

      setProgress({ sent, errors, total: totalDestinos });
      await new Promise(r => setTimeout(r, 300));
    }

    setSending(false);

    if (sent > 0) {
      toast.success(`✅ ${sent} mensagem(ns) enviada(s)!`);
    }
    if (errors > 0) {
      toast.error(`❌ ${errors} erro(s) no envio`);
    }

    // Limpar e fechar
    setMessageText('');
    clearAttachment();
    setSelectedUsers([]);
    setSelectedSectors([]);
    onClose();
  };

  const totalSelecionados = selectedUsers.length + selectedSectors.length;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Envio Interno - Equipe / Setor
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 flex gap-4 min-h-0">
          {/* Painel Esquerdo - Seleção de Destinatários */}
          <div className="w-1/2 flex flex-col border-r border-slate-200 pr-4">
            {/* Busca */}
            <div className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Buscar usuário ou setor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Tabs defaultValue="usuarios" className="flex-1 flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="usuarios">
                  <Users className="w-4 h-4 mr-2" />
                  Usuários ({selectedUsers.length})
                </TabsTrigger>
                <TabsTrigger value="setores">
                  <Building2 className="w-4 h-4 mr-2" />
                  Setores ({selectedSectors.length})
                </TabsTrigger>
              </TabsList>

              {/* Aba Usuários */}
              <TabsContent value="usuarios" className="flex-1 overflow-y-auto mt-3 space-y-1">
                {loadingUsers ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
                  </div>
                ) : usuariosFiltrados.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    Nenhum usuário encontrado
                  </div>
                ) : (
                  usuariosFiltrados.map(usuario => {
                    const isSelected = selectedUsers.includes(usuario.id);
                    return (
                      <button
                        key={usuario.id}
                        onClick={() => toggleUser(usuario.id)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${
                          isSelected 
                            ? 'bg-purple-100 border-2 border-purple-400' 
                            : 'hover:bg-purple-50 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-purple-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-semibold text-sm shadow-md">
                          {usuario.full_name?.charAt(0).toUpperCase() || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate text-sm">
                            {usuario.full_name || 'Sem nome'}
                          </div>
                          <div className="text-xs text-slate-500 truncate">
                            {usuario.attendant_sector && (
                              <span className="px-1.5 py-0.5 bg-slate-100 rounded-full">
                                {usuario.attendant_sector}
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </TabsContent>

              {/* Aba Setores */}
              <TabsContent value="setores" className="flex-1 overflow-y-auto mt-3 space-y-1">
                {setoresFiltrados.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 text-sm">
                    Nenhum setor encontrado
                  </div>
                ) : (
                  setoresFiltrados.map(setor => {
                    const isSelected = selectedSectors.includes(setor);
                    const usuariosDoSetor = usuarios.filter(u => u.attendant_sector === setor);
                    
                    return (
                      <button
                        key={setor}
                        onClick={() => toggleSector(setor)}
                        className={`w-full flex items-center gap-3 p-2 rounded-lg transition-all text-left ${
                          isSelected 
                            ? 'bg-indigo-100 border-2 border-indigo-400' 
                            : 'hover:bg-indigo-50 border-2 border-transparent'
                        }`}
                      >
                        <div className="flex-shrink-0">
                          {isSelected ? (
                            <CheckSquare className="w-5 h-5 text-indigo-600" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-400" />
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shadow-md">
                          <Building2 className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-slate-800 truncate text-sm">
                            Setor {setor}
                          </div>
                          <div className="text-xs text-slate-500">
                            {usuariosDoSetor.length} {usuariosDoSetor.length === 1 ? 'membro' : 'membros'}
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </TabsContent>
            </Tabs>
          </div>

          {/* Painel Direito - Composer de Mensagem */}
          <div className="w-1/2 flex flex-col">
            {/* Destinatários Selecionados */}
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-slate-600">
                  Destinatários ({totalSelecionados})
                </span>
                {totalSelecionados > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setSelectedUsers([]);
                      setSelectedSectors([]);
                    }}
                    className="h-6 text-xs text-slate-500"
                  >
                    Limpar
                  </Button>
                )}
              </div>
              
              <div className="max-h-32 overflow-y-auto space-y-1 border border-slate-200 rounded-lg p-2 bg-slate-50">
                {totalSelecionados === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-4">
                    Nenhum destinatário selecionado
                  </p>
                ) : (
                  <>
                    {selectedUsers.map(userId => {
                      const usuario = usuarios.find(u => u.id === userId);
                      return (
                        <div key={userId} className="flex items-center gap-2 bg-white rounded px-2 py-1 border border-purple-200">
                          <Users className="w-3 h-3 text-purple-600" />
                          <span className="text-xs text-slate-700 flex-1 truncate">
                            {usuario?.full_name || 'Usuário'}
                          </span>
                          <button onClick={() => toggleUser(userId)} className="text-slate-400 hover:text-red-500">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      );
                    })}
                    {selectedSectors.map(setor => (
                      <div key={setor} className="flex items-center gap-2 bg-white rounded px-2 py-1 border border-indigo-200">
                        <Building2 className="w-3 h-3 text-indigo-600" />
                        <span className="text-xs text-slate-700 flex-1 truncate">
                          Setor {setor}
                        </span>
                        <button onClick={() => toggleSector(setor)} className="text-slate-400 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>

            {/* Preview de Arquivo */}
            {attachedFile && (
              <div className="mb-3 border border-slate-200 rounded-lg p-2 bg-slate-50">
                <div className="flex items-center gap-2">
                  {attachedFileType === 'image' && attachedFilePreview ? (
                    <img src={attachedFilePreview} alt="Preview" className="w-16 h-16 object-cover rounded" />
                  ) : (
                    <div className="w-16 h-16 bg-slate-200 rounded flex items-center justify-center">
                      <FileText className="w-8 h-8 text-slate-400" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-slate-700 truncate">{attachedFile.name}</p>
                    <p className="text-xs text-slate-500">{(attachedFile.size / 1024).toFixed(1)} KB</p>
                  </div>
                  <button onClick={clearAttachment} className="text-slate-400 hover:text-red-500">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Campo de Mensagem */}
            <Textarea
              placeholder="Digite sua mensagem..."
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              className="flex-1 resize-none mb-3"
              disabled={sending}
            />

            {/* Barra de Ações */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <label className="cursor-pointer">
                  <input
                    type="file"
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx"
                    onChange={handleFileSelect}
                    className="hidden"
                    disabled={sending}
                  />
                  <div className="p-2 hover:bg-slate-100 rounded-lg transition-colors">
                    <Paperclip className="w-5 h-5 text-slate-600" />
                  </div>
                </label>
              </div>

              <Button
                onClick={handleSend}
                disabled={sending || totalSelecionados === 0 || (!messageText.trim() && !attachedFile)}
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {sending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando {progress.sent}/{progress.total}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar ({totalSelecionados})
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}