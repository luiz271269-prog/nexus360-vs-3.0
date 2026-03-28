import { createClient } from 'npm:@base44/sdk@0.8.23';

/**
 * ⚠️ URGENTE - Função para inicializar permissões
 * TODOS OS ATENDENTES TÊM ACESSO COMPLETO À COMUNICAÇÃO
 */

Deno.serve(async (req) => {
    try {
        const base44 = createClient({
            appId: Deno.env.get('BASE44_APP_ID'),
            apiKey: Deno.env.get('BASE44_SERVICE_ROLE_KEY')
        });

        console.log('[INIT] 🚀 Iniciando configuração de permissões...');

        // 1. CRIAR MÓDULOS
        const modules = [
            {
                name: "Módulo de Comunicação WhatsApp",
                module_key: "comunicacao",
                description: "WhatsApp e atendimento de clientes",
                icon: "MessageSquare",
                order: 1,
                is_active: true,
                page_items: [
                    { name: "Central de Comunicação", page_key: "Comunicacao", route: "/comunicacao", icon: "MessageSquare" },
                    { name: "Mesa de Comunicação Central", page_key: "MesaComunicaoCentral", route: "/mesa-comunicacao-central", icon: "Layers" }
                ]
            },
            {
                name: "Módulo de Vendas",
                module_key: "vendas",
                description: "Gestão de vendas e orçamentos",
                icon: "TrendingUp",
                order: 2,
                is_active: true,
                page_items: [
                    { name: "Orçamentos", page_key: "Orcamentos", route: "/orcamentos", icon: "FileText" },
                    { name: "Vendas", page_key: "Vendas", route: "/vendas", icon: "TrendingUp" },
                    { name: "Clientes", page_key: "Clientes", route: "/clientes", icon: "Building2" }
                ]
            },
            {
                name: "Módulo de Gestão",
                module_key: "gestao",
                description: "Gestão de pessoas e recursos",
                icon: "Users",
                order: 3,
                is_active: true,
                page_items: [
                    { name: "Vendedores", page_key: "Vendedores", route: "/vendedores", icon: "Users" },
                    { name: "Produtos", page_key: "Produtos", route: "/produtos", icon: "Package" }
                ]
            },
            {
                name: "Módulo de Analytics",
                module_key: "analytics",
                description: "Relatórios e análises",
                icon: "BarChart3",
                order: 4,
                is_active: true,
                page_items: [
                    { name: "Dashboard", page_key: "Dashboard", route: "/dashboard", icon: "Home" },
                    { name: "Relatórios", page_key: "Relatorios", route: "/relatorios", icon: "BarChart3" }
                ]
            },
            {
                name: "Módulo Administrativo",
                module_key: "admin",
                description: "Configurações e administração",
                icon: "Settings",
                order: 5,
                is_active: true,
                page_items: [
                    { name: "Usuários", page_key: "Usuarios", route: "/usuarios", icon: "UserCog" },
                    { name: "Permissões", page_key: "UserPermissions", route: "/user-permissions", icon: "Shield" },
                    { name: "Auditoria", page_key: "Auditoria", route: "/auditoria", icon: "Shield" }
                ]
            }
        ];

        // Limpar módulos existentes primeiro
        console.log('[INIT] 🧹 Limpando módulos antigos...');
        await base44.entities.PermissionModule.filter({}).then(async (old) => {
            for (const m of old) {
                await base44.entities.PermissionModule.delete(m.id);
            }
        });

        // Criar novos módulos
        for (const module of modules) {
            console.log(`[INIT] 📦 Criando módulo: ${module.name}`);
            await base44.entities.PermissionModule.create(module);
        }

        // 2. LIMPAR PERMISSÕES ANTIGAS
        console.log('[INIT] 🧹 Limpando permissões antigas...');
        const oldPermissions = await base44.entities.RolePagePermission.filter({});
        for (const perm of oldPermissions) {
            await base44.entities.RolePagePermission.delete(perm.id);
        }

        // 3. CRIAR PERMISSÕES PARA ATENDENTE (ACESSO TOTAL À COMUNICAÇÃO)
        console.log('[INIT] 👤 Criando permissões para ATENDENTE...');
        const atendentePermissions = [
            // ✅ COMUNICAÇÃO - ACESSO TOTAL
            { 
                role_name: "atendente", 
                module_key: "comunicacao", 
                page_key: "Comunicacao", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: false,
                can_approve: false,
                can_export: false
            },
            { 
                role_name: "atendente", 
                module_key: "comunicacao", 
                page_key: "MesaComunicaoCentral", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: false,
                can_approve: false,
                can_export: false
            },
            // Vendas - Apenas leitura e criação de orçamentos
            { 
                role_name: "atendente", 
                module_key: "vendas", 
                page_key: "Orcamentos", 
                can_read: true, 
                can_create: true, 
                can_update: false, 
                can_delete: false,
                can_approve: false,
                can_export: false
            },
            { 
                role_name: "atendente", 
                module_key: "vendas", 
                page_key: "Vendas", 
                can_read: true, 
                can_create: false, 
                can_update: false, 
                can_delete: false
            },
            { 
                role_name: "atendente", 
                module_key: "vendas", 
                page_key: "Clientes", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: false
            },
            // Gestão - Apenas visualização
            { 
                role_name: "atendente", 
                module_key: "gestao", 
                page_key: "Vendedores", 
                can_read: true, 
                can_create: false
            },
            { 
                role_name: "atendente", 
                module_key: "gestao", 
                page_key: "Produtos", 
                can_read: true, 
                can_create: false
            },
            // Analytics - Apenas Dashboard
            { 
                role_name: "atendente", 
                module_key: "analytics", 
                page_key: "Dashboard", 
                can_read: true
            }
        ];

        // 4. CRIAR PERMISSÕES PARA SUPERVISOR
        console.log('[INIT] 👔 Criando permissões para SUPERVISOR...');
        const supervisorPermissions = [
            // Comunicação - Acesso completo
            { 
                role_name: "supervisor", 
                module_key: "comunicacao", 
                page_key: "Comunicacao", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true,
                can_approve: false,
                can_export: true
            },
            { 
                role_name: "supervisor", 
                module_key: "comunicacao", 
                page_key: "MesaComunicaoCentral", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true,
                can_approve: false,
                can_export: true
            },
            // Vendas - Acesso completo exceto deletar
            { 
                role_name: "supervisor", 
                module_key: "vendas", 
                page_key: "Orcamentos", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: false,
                can_approve: false,
                can_export: true
            },
            { 
                role_name: "supervisor", 
                module_key: "vendas", 
                page_key: "Vendas", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: false,
                can_export: true
            },
            { 
                role_name: "supervisor", 
                module_key: "vendas", 
                page_key: "Clientes", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: false,
                can_export: true
            },
            // Gestão - Acesso completo
            { 
                role_name: "supervisor", 
                module_key: "gestao", 
                page_key: "Vendedores", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: false
            },
            { 
                role_name: "supervisor", 
                module_key: "gestao", 
                page_key: "Produtos", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: false
            },
            // Analytics
            { 
                role_name: "supervisor", 
                module_key: "analytics", 
                page_key: "Dashboard", 
                can_read: true
            },
            { 
                role_name: "supervisor", 
                module_key: "analytics", 
                page_key: "Relatorios", 
                can_read: true, 
                can_export: true
            }
        ];

        // 5. CRIAR PERMISSÕES PARA AUTORIZADOR
        console.log('[INIT] 🔐 Criando permissões para AUTORIZADOR...');
        const autorizadorPermissions = [
            // Comunicação - Acesso total
            { 
                role_name: "autorizador", 
                module_key: "comunicacao", 
                page_key: "Comunicacao", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true,
                can_approve: true,
                can_export: true
            },
            { 
                role_name: "autorizador", 
                module_key: "comunicacao", 
                page_key: "MesaComunicaoCentral", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true,
                can_approve: true,
                can_export: true
            },
            // Vendas - Acesso total com aprovação
            { 
                role_name: "autorizador", 
                module_key: "vendas", 
                page_key: "Orcamentos", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true,
                can_approve: true,
                can_export: true
            },
            { 
                role_name: "autorizador", 
                module_key: "vendas", 
                page_key: "Vendas", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true,
                can_approve: true,
                can_export: true
            },
            { 
                role_name: "autorizador", 
                module_key: "vendas", 
                page_key: "Clientes", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true,
                can_export: true
            },
            // Gestão - Acesso total
            { 
                role_name: "autorizador", 
                module_key: "gestao", 
                page_key: "Vendedores", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true
            },
            { 
                role_name: "autorizador", 
                module_key: "gestao", 
                page_key: "Produtos", 
                can_read: true, 
                can_create: true, 
                can_update: true, 
                can_delete: true
            },
            // Analytics
            { 
                role_name: "autorizador", 
                module_key: "analytics", 
                page_key: "Dashboard", 
                can_read: true
            },
            { 
                role_name: "autorizador", 
                module_key: "analytics", 
                page_key: "Relatorios", 
                can_read: true, 
                can_export: true
            },
            // Admin - Visualizar usuários
            { 
                role_name: "autorizador", 
                module_key: "admin", 
                page_key: "Usuarios", 
                can_read: true
            },
            { 
                role_name: "autorizador", 
                module_key: "admin", 
                page_key: "Auditoria", 
                can_read: true
            }
        ];

        // Consolidar todas as permissões
        const allPermissions = [
            ...atendentePermissions,
            ...supervisorPermissions,
            ...autorizadorPermissions
        ];

        // Inserir permissões
        for (const permission of allPermissions) {
            console.log(`[INIT] 🔑 Criando: ${permission.role_name} -> ${permission.page_key}`);
            await base44.entities.RolePagePermission.create(permission);
        }

        console.log('[INIT] ✅ ========== CONCLUÍDO ==========');
        console.log('[INIT] 📊 Estatísticas:');
        console.log(`[INIT]   - Módulos criados: ${modules.length}`);
        console.log(`[INIT]   - Permissões criadas: ${allPermissions.length}`);
        console.log(`[INIT]   - Atendente: ${atendentePermissions.length} permissões`);
        console.log(`[INIT]   - Supervisor: ${supervisorPermissions.length} permissões`);
        console.log(`[INIT]   - Autorizador: ${autorizadorPermissions.length} permissões`);

        return Response.json({
            success: true,
            message: "✅ Permissões configuradas com sucesso!",
            stats: {
                modules_created: modules.length,
                permissions_created: allPermissions.length,
                atendente_permissions: atendentePermissions.length,
                supervisor_permissions: supervisorPermissions.length,
                autorizador_permissions: autorizadorPermissions.length
            }
        });

    } catch (error) {
        console.error('[INIT] ❌ ERRO:', error);
        return Response.json({
            success: false,
            error: error.message,
            stack: error.stack
        }, { status: 500 });
    }
});