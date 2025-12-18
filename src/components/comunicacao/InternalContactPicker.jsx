import React, { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Building2, Search, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';

export default function InternalContactPicker({ open, onClose, onSelectUser, onSelectSector }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);

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
    if (!searchTerm) return usuarios;
    const term = searchTerm.toLowerCase();
    return usuarios.filter(u => 
      u.full_name?.toLowerCase().includes(term) ||
      u.email?.toLowerCase().includes(term) ||
      u.attendant_sector?.toLowerCase().includes(term)
    );
  }, [usuarios, searchTerm]);

  // Filtrar setores por busca
  const setoresFiltrados = useMemo(() => {
    if (!searchTerm) return setores;
    const term = searchTerm.toLowerCase();
    return setores.filter(s => s.toLowerCase().includes(term));
  }, [setores, searchTerm]);

  const handleUserClick = async (userId) => {
    try {
      setLoading(true);
      await onSelectUser(userId);
      onClose();
    } catch (err) {
      console.error('Erro ao selecionar usuário:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSectorClick = async (sectorName) => {
    try {
      setLoading(true);
      await onSelectSector(sectorName);
      onClose();
    } catch (err) {
      console.error('Erro ao selecionar setor:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-600" />
            Equipe interna / Setor
          </DialogTitle>
        </DialogHeader>

        {/* Busca */}
        <div className="relative">
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
              Usuários ({usuariosFiltrados.length})
            </TabsTrigger>
            <TabsTrigger value="setores">
              <Building2 className="w-4 h-4 mr-2" />
              Setores ({setoresFiltrados.length})
            </TabsTrigger>
          </TabsList>

          {/* Aba Usuários */}
          <TabsContent value="usuarios" className="flex-1 overflow-y-auto mt-4 space-y-2">
            {loadingUsers ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-purple-600" />
              </div>
            ) : usuariosFiltrados.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Nenhum usuário encontrado
              </div>
            ) : (
              usuariosFiltrados.map(usuario => (
                <button
                  key={usuario.id}
                  onClick={() => handleUserClick(usuario.id)}
                  disabled={loading}
                  className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors text-left disabled:opacity-50"
                >
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center text-white font-semibold shadow-md">
                    {usuario.full_name?.charAt(0).toUpperCase() || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-800 truncate">
                      {usuario.full_name || 'Sem nome'}
                    </div>
                    <div className="text-xs text-slate-500 truncate">
                      {usuario.email}
                      {usuario.attendant_sector && (
                        <span className="ml-2 px-2 py-0.5 bg-slate-100 rounded-full">
                          {usuario.attendant_sector}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))
            )}
          </TabsContent>

          {/* Aba Setores */}
          <TabsContent value="setores" className="flex-1 overflow-y-auto mt-4 space-y-2">
            {setoresFiltrados.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                Nenhum setor encontrado
              </div>
            ) : (
              setoresFiltrados.map(setor => {
                const usuariosDoSetor = usuarios.filter(u => u.attendant_sector === setor);
                return (
                  <button
                    key={setor}
                    onClick={() => handleSectorClick(setor)}
                    disabled={loading}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-purple-50 transition-colors text-left disabled:opacity-50"
                  >
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-400 to-blue-500 flex items-center justify-center text-white shadow-md">
                      <Building2 className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-slate-800 truncate">
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
      </DialogContent>
    </Dialog>
  );
}