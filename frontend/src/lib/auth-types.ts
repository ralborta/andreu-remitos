export type RolUsuario = "operador" | "supervisor" | "administrador";

export type SessionUser = {
  id: string;
  username: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
};

export const ROL_LABEL: Record<RolUsuario, string> = {
  operador: "Operador",
  supervisor: "Supervisor",
  administrador: "Administrador",
};

export function isAdmin(user: SessionUser | null | undefined) {
  return user?.rol === "administrador";
}

/** Puede eliminar remitos (supervisor o administrador). */
export function canDeleteRemitos(user: SessionUser | null | undefined) {
  return user?.rol === "administrador" || user?.rol === "supervisor";
}
