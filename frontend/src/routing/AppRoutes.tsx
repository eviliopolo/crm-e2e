import { lazy, type ReactNode } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { ProtectedRoute } from '../modules/auth/components/ProtectedRoute';
import { PublicRoute } from '../modules/auth/components/PublicRoute';
import { AdminRoute } from '../modules/auth/components/AdminRoute';
import { RoleRoute } from '../modules/auth/components/RoleRoute';
import { ModulePlaceholderPage } from '../modules/shared/pages/ModulePlaceholderPage';

const LoginPage = lazy(() => import('../modules/auth/pages/LoginPageLazy'));
const AdminUsersPage = lazy(() => import('../modules/auth/pages/AdminUsersPageLazy'));
const AuditLogPage = lazy(() => import('../modules/audit/pages/AuditLogPageLazy'));
const LeadsListPage = lazy(
  () => import('../modules/demand-generation/pages/LeadsListPageLazy'),
);
const LeadDetailPage = lazy(
  () => import('../modules/demand-generation/pages/LeadDetailPageLazy'),
);
const CampaignsListPage = lazy(
  () => import('../modules/demand-generation/pages/CampaignsListPageLazy'),
);
const CampaignFormPage = lazy(
  () => import('../modules/demand-generation/pages/CampaignFormPageLazy'),
);
const MqlInboxPage = lazy(
  () => import('../modules/demand-generation/pages/MqlInboxPageLazy'),
);
const MarketingDashboardPage = lazy(
  () => import('../modules/demand-generation/pages/MarketingDashboardPageLazy'),
);
const AgendaInboxPage = lazy(
  () => import('../modules/demand-generation/pages/AgendaInboxPageLazy'),
);
const QualificationHomePage = lazy(
  () => import('../modules/qualification/pages/QualificationHomePageLazy'),
);
const AssignedSqlsPage = lazy(
  () => import('../modules/qualification/pages/AssignedSqlsPageLazy'),
);
const SqlDetailPage = lazy(
  () => import('../modules/qualification/pages/SqlDetailPageLazy'),
);
const OuvsBoardPage = lazy(
  () => import('../modules/discovery/pages/OuvsBoardPageLazy'),
);
const OuvDetailPage = lazy(
  () => import('../modules/discovery/pages/OuvDetailPageLazy'),
);
const MotivosPerdidaPage = lazy(
  () => import('../modules/discovery/pages/MotivosPerdidaPageLazy'),
);
const MotivosDescartePage = lazy(
  () => import('../modules/discovery/pages/MotivosDescartePageLazy'),
);
const ZonaChecklistAdminPage = lazy(
  () => import('../modules/discovery/pages/ZonaChecklistAdminPageLazy'),
);
const AccountsListPage = lazy(
  () => import('../modules/accounts/pages/AccountsListPageLazy'),
);
const PeopleListPage = lazy(
  () => import('../modules/accounts/pages/PeopleListPageLazy'),
);
const SoporteComercialInboxPage = lazy(
  () => import('../modules/offer-closing/pages/SoporteComercialInboxPageLazy'),
);
const VentaGanadaDetailPage = lazy(
  () => import('../modules/offer-closing/pages/VentaGanadaDetailPageLazy'),
);
const ServicesListPage = lazy(
  () => import('../modules/implementation/pages/ServicesListPageLazy'),
);
const ProjectExecutionPage = lazy(
  () => import('../modules/implementation/pages/ProjectExecutionPageLazy'),
);
const ReportesProyectoPage = lazy(
  () => import('../modules/implementation/pages/ReportesProyectoPageLazy'),
);

function protectedElement(title: string, description: string) {
  return (
    <ProtectedRoute>
      <ModulePlaceholderPage title={title} description={description} />
    </ProtectedRoute>
  );
}

function adminElement(page: ReactNode) {
  return (
    <ProtectedRoute>
      <AdminRoute>{page}</AdminRoute>
    </ProtectedRoute>
  );
}

export function AppRoutes() {
  return useRoutes([
    {
      path: '/',
      element: (
        <ProtectedRoute>
          <Navigate to="/opportunities" replace />
        </ProtectedRoute>
      ),
    },
    {
      path: '/login',
      element: (
        <PublicRoute>
          <LoginPage />
        </PublicRoute>
      ),
    },
    {
      path: '/opportunities',
      element: (
        <ProtectedRoute>
          <OuvsBoardPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/opportunities/ganadas',
      element: (
        <ProtectedRoute>
          <OuvsBoardPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/opportunities/perdidas',
      element: (
        <ProtectedRoute>
          <OuvsBoardPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/opportunities/descartadas',
      element: (
        <ProtectedRoute>
          <OuvsBoardPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/opportunities/admin/motivos-perdida',
      element: (
        <ProtectedRoute>
          <RoleRoute roles={['SoporteComercial', 'Admin']}>
            <MotivosPerdidaPage />
          </RoleRoute>
        </ProtectedRoute>
      ),
    },
    {
      path: '/opportunities/admin/motivos-descarte',
      element: (
        <ProtectedRoute>
          <RoleRoute roles={['SoporteComercial', 'Admin']}>
            <MotivosDescartePage />
          </RoleRoute>
        </ProtectedRoute>
      ),
    },
    {
      path: '/opportunities/admin/zona-checklist-templates',
      element: (
        <ProtectedRoute>
          <RoleRoute roles={['SoporteComercial', 'Admin']}>
            <ZonaChecklistAdminPage />
          </RoleRoute>
        </ProtectedRoute>
      ),
    },
    {
      path: '/opportunities/:id',
      element: (
        <ProtectedRoute>
          <OuvDetailPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand',
      element: (
        <ProtectedRoute>
          <LeadsListPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/leads/:id',
      element: (
        <ProtectedRoute>
          <LeadDetailPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/campaigns',
      element: (
        <ProtectedRoute>
          <CampaignsListPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/campaigns/new',
      element: (
        <ProtectedRoute>
          <CampaignFormPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/mqls',
      element: (
        <ProtectedRoute>
          <MqlInboxPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/agenda',
      element: (
        <ProtectedRoute>
          <RoleRoute roles={['SoporteComercial', 'GestorMercadeo']}>
            <AgendaInboxPage />
          </RoleRoute>
        </ProtectedRoute>
      ),
    },
    {
      path: '/demand/dashboard',
      element: (
        <ProtectedRoute>
          <MarketingDashboardPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/qualification',
      element: (
        <ProtectedRoute>
          <QualificationHomePage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/qualification/assigned',
      element: (
        <ProtectedRoute>
          <RoleRoute roles={['EjecutivoComercial', 'DirectorMercadeo']}>
            <AssignedSqlsPage />
          </RoleRoute>
        </ProtectedRoute>
      ),
    },
    {
      path: '/qualification/sqls/:id',
      element: (
        <ProtectedRoute>
          <SqlDetailPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/presales',
      element: protectedElement(
        'Preventa (PRE)',
        'Actividades Preventa — módulo technical-feasibility (próximamente).',
      ),
    },
    {
      path: '/pricing',
      element: protectedElement(
        'Pricing (PRI)',
        'Análisis de margen — módulo pricing (próximamente).',
      ),
    },
    {
      path: '/offers',
      element: (
        <ProtectedRoute>
          <SoporteComercialInboxPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/offers/:ouvId',
      element: (
        <ProtectedRoute>
          <VentaGanadaDetailPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/services',
      element: (
        <ProtectedRoute>
          <ServicesListPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/services/reportes',
      element: (
        <ProtectedRoute>
          <ReportesProyectoPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/services/:ouvId',
      element: (
        <ProtectedRoute>
          <ProjectExecutionPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/after-sales',
      element: protectedElement(
        'Posventa',
        'Renovaciones y ChurnRate — módulo post-sales (próximamente).',
      ),
    },
    {
      path: '/accounts/empresas',
      element: (
        <ProtectedRoute>
          <AccountsListPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/accounts/contactos',
      element: (
        <ProtectedRoute>
          <PeopleListPage />
        </ProtectedRoute>
      ),
    },
    {
      path: '/admin/users',
      element: adminElement(<AdminUsersPage />),
    },
    {
      path: '/admin/audit',
      element: adminElement(<AuditLogPage />),
    },
    {
      path: '*',
      element: protectedElement(
        'No encontrado',
        'La ruta solicitada no existe. Usa el menú lateral para navegar.',
      ),
    },
  ]);
}
