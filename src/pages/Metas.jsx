import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import DashboardMetas from "../components/dashboard/DashboardMetas";

/**
 * Página dedicada a Metas e Gamificação
 */
export default function Metas() {
  const [usuario, setUsuario] = useState(null);
  const [vendedor, setVendedor] = useState(null);
  const [loading, setLoading] = useState(true);

  // Carregar usuário
  useEffect(() => {
    carregarUsuario();
  }, []);

  // Buscar vendedor se não for gerente
  useEffect(() => {
    if (usuario && usuario.role !== 'admin') {
      buscarVendedor();
    }
  }, [usuario]);

  const carregarUsuario = async () => {
    try {
      const user = await base44.auth.me();
      setUsuario(user);
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    } finally {
      setLoading(false);
    }
  };

  const buscarVendedor = async () => {
    try {
      const vendedores = await base44.entities.Vendedor.filter({
        email: usuario.email
      });
      if (vendedores.length > 0) {
        setVendedor(vendedores[0]);
      }
    } catch (error) {
      console.error('Erro ao buscar vendedor:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!usuario) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-slate-600">Erro ao carregar usuário</p>
        </div>
      </div>
    );
  }

  const isGerente = usuario.role === 'admin';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900">
            {isGerente ? '📊 Metas do Time' : '🎯 Minhas Metas'}
          </h1>
          <p className="text-slate-600 mt-2">
            {isGerente 
              ? 'Acompanhe o desempenho da equipe em tempo real'
              : 'Acompanhe seu progresso e conquiste seus objetivos!'
            }
          </p>
        </div>

        <DashboardMetas 
          vendedorId={vendedor?.id} 
          isGerente={isGerente} 
        />
      </div>
    </div>
  );
}