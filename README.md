# MdMTickets

Apunta los tickets y el dinero de las máquinas y mira quién va ganando.

Web: https://javieribarra050.github.io/MdMTickets/

## Desarrollo

Requiere Node 22 o superior.

```sh
npm install
npm run dev        # servidor local
npm test           # tests
npm run typecheck  # comprobación de tipos
npm run build      # build de producción en dist/
```

Cada PR pasa por la CI (tipos, tests y build). Al fusionar en `main` se publica solo en GitHub Pages.

## Base de datos (Supabase)

Las partidas viven en Supabase. Cualquiera puede leerlas, pero solo se apunta o se borra con el **código de grupo**, que se comprueba dentro de la base de datos y se guarda cifrado.

### Crear la base de datos

1. En el panel de Supabase, abre **SQL Editor**.
2. Pega y ejecuta, por orden, cada fichero de `supabase/migrations/`.
3. Elige el código de grupo y guárdalo cifrado (cambia `TU_CODIGO`):

   ```sql
   insert into private.group_code (code_hash)
   values (extensions.crypt('TU_CODIGO', extensions.gen_salt('bf')));
   ```

   Para cambiarlo más adelante: `update private.group_code set code_hash = extensions.crypt('NUEVO', extensions.gen_salt('bf'));`

### Conectar la app

Crea `.env.local` (no se sube al repo) con los datos de **Project Settings → API**:

```sh
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=la-clave-anon-public
```

Para el despliegue, esos dos valores van como *variables* del repo en **Settings → Secrets and variables → Actions → Variables**. La clave `anon` es pública por diseño; la `service_role` no se usa nunca.

## Instalar en el móvil

- **iPhone (Safari):** abre la web, toca **Compartir** y luego **Añadir a pantalla de inicio**.
- **Android (Chrome):** abre la web, toca el menú **⋮** y luego **Instalar aplicación** (o **Añadir a pantalla de inicio**).

Se abre a pantalla completa con su icono. Sin conexión la app abre, pero para apuntar y ver el ranking hace falta internet.
