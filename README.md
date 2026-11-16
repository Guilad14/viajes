# Mi Expedición

PWA en español para gestionar y publicar fichas de montaña. El [catálogo público](https://guilad14.github.io/viajes/) se consulta sin cuenta. El [editor local](https://guilad14.github.io/viajes/editor.html) trabaja en este navegador con IndexedDB. Cada dispositivo gestiona su propia copia de los borradores. Solo quien tiene acceso de escritura al hosting puede cambiar el catálogo público.

## Cargar y publicar una expedición

1. En **Editor local**, creá una ficha o abrí un borrador. Agregá región, dificultad, itinerario, notas y cambios.
2. Importá un GPX de hasta 20 MB. Se conservan todos los puntos válidos del recorrido y los tramos se mantienen separados. Un GPX con track reemplaza el recorrido de la ficha. Los waypoints del archivo se agregan a la lista de puntos, y un GPX con solo waypoints conserva el recorrido actual.
3. Agregá puntos con coordenadas o con **Ubicar punto en el mapa**. Usá las categorías waypoint, campamento, dificultad, nota y cambio de itinerario. Podés editar y eliminar cada punto.
4. Pulsá **Guardar borrador** y después **Preparar publicación**. Seleccioná las fichas que querés publicar y revisá que las rutas, las notas y los puntos sean aptos para compartir. Descargá `expediciones.json`. También podés importar ese archivo como copia local en otro navegador.
5. Reemplazá `expediciones.json` en la raíz del hosting. El archivo representa todo el catálogo. Lo que quede fuera de la selección se retira de la vista pública al desplegar el nuevo archivo.

### Publicar en GitHub Pages

1. En el [repositorio](https://github.com/Guilad14/viajes), abrí [Settings → Pages](https://github.com/Guilad14/viajes/settings/pages).
2. En **Build and deployment**, elegí **Deploy from a branch**, seleccioná `main` y `/(root)`. Guardá.
3. Esperá el despliegue en [Actions](https://github.com/Guilad14/viajes/actions) y abrí [la URL pública](https://guilad14.github.io/viajes/).
4. Para actualizar, subí el nuevo `expediciones.json` a la raíz en `main`. Después del despliegue, recargá la app para ver el catálogo actualizado.

GitHub Pages ofrece alojamiento estático gratuito para este repositorio público. Para otro hosting estático HTTPS, publicá los archivos HTML, CSS, JS, el manifiesto, los PNG, el catálogo JSON y `ejemplo.gpx` juntos en el mismo directorio. Los enlaces relativos permiten servir la app desde una subruta.

### Privacidad de los borradores

La pantalla del editor puede abrirse sin cuenta. Los datos de edición quedan en IndexedDB del navegador que los carga. El catálogo público lee exclusivamente `expediciones.json`. El archivo original GPX se procesa en el dispositivo. La app conserva geometría, altitudes y los nombres, categorías y descripciones de los puntos. No conserva marcas de tiempo, autores, extensiones ni credenciales del GPX. Evitá cargar información sensible en los campos libres.

En el editor, el mapa base se activa manualmente porque las solicitudes de teselas a OpenStreetMap revelan al proveedor el área que se está consultando. Cuando está desactivado o no hay conexión, el trazado y los marcadores se ven sobre una cuadrícula. Las fichas y rutas guardadas por los prototipos anteriores se pueden recuperar como borradores la primera vez que se abre este editor desde el mismo navegador y origen.

## Revisar datos e instalación

- Abrí el catálogo en el celular y elegí **Volcán Lanín**. La ficha de ejemplo debe mostrar **16,13 km**, **+2.576 m**, **−2.576 m**, **3.776 m** de altitud máxima y **5 puntos de interés**. El botón **⌖** encuadra los dos tramos del recorrido.
- Elegí **Hielo Azul**. Debe mostrar **11,6 km**, **+1.055 m**, **−1.055 m**, **1.495 m** y **3 puntos**. El perfil usa distancia acumulada. Los segmentos y los huecos de altitud se dibujan separados.
- Probá el editor con [ejemplo.gpx](https://guilad14.github.io/viajes/ejemplo.gpx) en una ficha nueva. Agregá, editá y eliminá un punto. Guardá, recargá el editor y verificá el borrador. Abrí el catálogo en una ventana privada para comprobar que solo aparecen las fichas publicadas.
- En una URL HTTPS, Chrome o Edge ofrecen **Instalar app** desde su menú cuando el navegador la considera instalable. En iPhone, usá **Compartir → Agregar a inicio** en Safari. Verificá que se abra en una ventana independiente.
- Después de la primera apertura completa, desactivá internet y volvé a abrir la app. Deberían cargar el catálogo guardado, el trazado, los marcadores, el perfil y el editor. La foto y el mapa base dependen de recursos en línea.
- En desarrollo, serví el directorio desde `localhost` con `python -m http.server 8000` y abrí `http://localhost:8000/`. En DevTools → Application, revisá que el manifiesto tenga los íconos de 192 y 512 px y que `sw.js` esté activo.

Los dos recorridos de prueba son ficticios. Los desniveles de otros GPX son sumas de diferencias entre alturas consecutivas y dependen de la calidad del archivo.

Foto del Lanín de [Luis Argerich](https://commons.wikimedia.org/wiki/File:Lanin_Huechulafquen.jpg), [CC BY 2.0](https://creativecommons.org/licenses/by/2.0/), con recorte visual en la portada. Teselas y datos cartográficos © [OpenStreetMap](https://www.openstreetmap.org/copyright).
