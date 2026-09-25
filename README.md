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
