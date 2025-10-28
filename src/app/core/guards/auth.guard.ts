import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

const OPERADOR_SIN_MUNICIPIOS_KEY = 'operadorSinMunicipios';

const extractRoleNames = (user: any): string[] => {
  if (!user) {
    return [];
  }

  const rawRoles = Array.isArray(user?.Roles)
    ? user.Roles
    : Array.isArray(user?.roles)
      ? user.roles
      : [];

  const roleNames = rawRoles
    .map((rol: any) => {
      if (typeof rol === 'string') {
        return rol;
      }
      if (rol && typeof rol?.nombre === 'string') {
        return rol.nombre;
      }
      return null;
    })
    .filter((nombre: string | null | undefined): nombre is string => typeof nombre === 'string' && nombre.length > 0)
    .map((nombre: string) => nombre.trim().toLowerCase());

  const inlineRoles = [user?.rol, user?.Rol, user?.role]
    .filter((nombre: unknown): nombre is string => typeof nombre === 'string' && nombre.length > 0)
    .map((nombre: string) => nombre.trim().toLowerCase());

  return Array.from(new Set([...roleNames, ...inlineRoles]));
};

export const AuthGuard: CanActivateFn = (route, state) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  const token = localStorage.getItem('token');
  if (!token) {
    router.navigate(['/login']);
    return false;
  }

  const user = authService.getUser();
  const roleNames = extractRoleNames(user);

  if (roleNames.includes('administrador')) {
    return true;
  }

  if (roleNames.includes('operador')) {
    const operadorSinMunicipios = localStorage.getItem(OPERADOR_SIN_MUNICIPIOS_KEY) === 'true';
    if (operadorSinMunicipios) {
      router.navigate(['/sin-acceso']);
      return false;
    }
  }

  return true;
};
