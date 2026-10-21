import { redirect } from "next/navigation";

/** SOL abierto: no hay pantalla de usuario/contraseña. */
export default function LoginPage() {
  redirect("/");
}
