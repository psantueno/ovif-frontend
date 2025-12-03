export const getUserRoleNames = (user: any): string[] => {
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

export const getLandingPathByRoles = (roleNames: string[]): string => {
  if (roleNames.includes('operador')) {
    return '/home';
  }

  return '/panel-carga-mensual';
};
