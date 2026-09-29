// frontend/src/lib/supabase.js
// Cliente de Supabase — conexión central a la base de datos

import { createClient } from "@supabase/supabase-js";

// Las variables vienen del archivo .env (con prefijo VITE_ obligatorio)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Validación defensiva: si falta alguna credencial, fallamos rápido
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "❌ Faltan las variables de entorno de Supabase. " +
      "Verifica que el archivo .env tenga VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY, " +
      "y reinicia el servidor con npm run dev.",
  );
}

// Cliente único que se usará en toda la app
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
