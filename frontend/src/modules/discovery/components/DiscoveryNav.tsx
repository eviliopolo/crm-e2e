import { NavLink } from 'react-router-dom';
import { useAuth } from '../../auth/hooks/useAuth';

const linkClass = ({ isActive }: { isActive: boolean }) =>
  [
    '-mb-px border-b-2 px-4 py-2 text-sm transition-colors',
    isActive
      ? 'border-accent font-bold text-accent'
      : 'border-transparent text-muted hover:text-accent',
  ].join(' ');

type DiscoveryNavProps = {
  /** Catalog tabs stay on admin/detail pages; the OUV board hides them. */
  showAdminTabs?: boolean;
};

export function DiscoveryNav({ showAdminTabs = true }: DiscoveryNavProps) {
  const { user } = useAuth();
  const isSoporte =
    user?.role_name === 'SoporteComercial' || user?.role_name === 'Admin';

  return (
    <nav
      className="mb-4 flex flex-wrap gap-1 border-b border-border"
      aria-label="Oportunidades"
    >
      <NavLink to="/opportunities" end className={linkClass}>
        Bandeja OUV
      </NavLink>
      <NavLink to="/opportunities/ganadas" end className={linkClass}>
        Oportunidades ganadas
      </NavLink>
      <NavLink to="/opportunities/perdidas" end className={linkClass}>
        Oportunidades perdidas
      </NavLink>
      <NavLink to="/opportunities/descartadas" end className={linkClass}>
        Oportunidades descartadas
      </NavLink>
      {showAdminTabs && isSoporte ? (
        <>
          <NavLink
            to="/opportunities/admin/motivos-perdida"
            className={linkClass}
          >
            Motivos pérdida
          </NavLink>
          <NavLink
            to="/opportunities/admin/motivos-descarte"
            className={linkClass}
          >
            Motivos descarte
          </NavLink>
          <NavLink
            to="/opportunities/admin/zona-checklist-templates"
            className={linkClass}
          >
            Checklist zonas
          </NavLink>
        </>
      ) : null}
    </nav>
  );
}
