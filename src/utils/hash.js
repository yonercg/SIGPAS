/* =========================================================
   SIGPAS · HASH DE CONTRASEÑAS
   Usa SHA-256 nativo del navegador (crypto.subtle).
   No requiere dependencias externas.
   ========================================================= */

export async function hashPassword(password) {
  if (!password) return "";

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(String(password));
    const buffer = await crypto.subtle.digest("SHA-256", data);

    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, "0"))
      .join("");
  } catch (error) {
    console.error("Error al hashear la contraseña:", error);
    return "";
  }
}
