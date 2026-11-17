# Mi Expedición — Demo PWA

Demo estática, gratuita, instalable desde celular y lista para GitHub Pages.

## Publicar

En GitHub: **Settings → Pages → Build and deployment → Deploy from a branch → main / (root) → Save**. La URL será `https://guilad14.github.io/viajes/` cuando GitHub Pages finalice la publicación.

## Funcionalidades de esta demo

- Acceso demostrativo por nombre y código (sin validación real).
- Panel con seis módulos y diseño responsive.
- Checklist obligatoria, opcional y personal con almacenamiento local.
- Cronograma con confirmación de lectura local.
- Punto de encuentro, enlaces e información de ejemplo.
- Mapa OpenStreetMap y carga local de GPX, distancia, desnivel, perfil de elevación, importación/edición de puntos y descarga del GPX.
- PWA con manifiesto y service worker. Los mapas online requieren conexión.

## Limitaciones importantes

**Esta es una demo pública, no una aplicación con acceso privado.** Cualquier código se acepta. No hay autenticación, backend, gestión real de expediciones ni aislamiento entre usuarios. Los datos se guardan por navegador con localStorage, no por persona. El GPX se procesa solo en el dispositivo y no queda publicado para otros participantes. No cargar información privada. Las fechas, itinerario y punto de encuentro son ilustrativos y no deben usarse para organizar ascensos reales.

La siguiente etapa es agregar Supabase, autenticación segura para el administrador, sesiones por invitación, reglas de acceso por participante y almacenamiento persistente.
