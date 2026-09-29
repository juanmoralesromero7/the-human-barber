# The Human Barber — puesta en marcha

## 1. Base de datos (Supabase, gratis)
1. Crea cuenta en supabase.com → **New project** (región Europa).
2. **SQL Editor** → pega todo `sql/schema.sql` → **Run**.
3. **Authentication → Providers → Email**: desactiva **Allow new users to sign up** (así nadie más puede crear cuentas).
4. **Authentication → Users → Add user**: tu email y una contraseña larga (marca *Auto confirm*). Esa es tu cuenta de administrador.
5. **Project Settings → API**: copia *Project URL* y la clave *anon public*.

## 2. Probar en tu ordenador (opcional)
```
cp .env.example .env   # rellena las dos variables
npm install && npm run dev
```

## 3. Publicar (Vercel, gratis)
1. Sube la carpeta a un repositorio de GitHub (el `.env` NO se sube).
2. vercel.com → **Add New Project** → importa el repo.
3. En **Environment Variables** añade `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`.
4. **Deploy**. Comparte el enlace con los estudiantes.

## Uso
- Estudiantes: `https://tu-web.vercel.app`
- Administración: `https://tu-web.vercel.app/?admin` (añádelo a la pantalla de inicio del móvil).
- La clave *anon* es pública por diseño; la seguridad la dan las políticas RLS del SQL. Nunca uses la clave *service_role* en la web.
