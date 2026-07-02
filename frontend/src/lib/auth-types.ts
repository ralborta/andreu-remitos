export type RolUsuario = "operador" | "administrador";

export type SessionUser = {
  id: string;
  username: string;
  nombre: string;
  rol: RolUsuario;
  activo: boolean;
};

export const ROL_LABEL: Record<RolUsuario, string> = {
  operador: "Operador",
  administrador: "Administrador",
};

export function isAdmin(user: SessionUser | null | undefined) {
  return user?.rol === "administrador";
}
