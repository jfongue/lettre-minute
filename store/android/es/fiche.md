# Ficha de Play Store — Letra Minuto (español)

Textos y respuestas para copiar en Play Console (es-ES y es-419). Los recursos
gráficos: `../icon-512.png`, `feature-graphic.png` (1024 × 500, en esta
carpeta), `../listing/es/` (las cinco capturas con leyenda que hay que subir,
1080 × 1920) y `../screenshots/es/` (las capturas en bruto a partir de las que
se generan). Para regenerarlos: `scripts/render-store.sh`.

## Ficha principal (español)

**Nombre** (30 caracteres máx.)
> Letra Minuto

**Descripción breve** (80 caracteres máx.)
> El Stop exprés: una letra, un tema, 60 segundos. ¡Reta a tus amigos!

**Descripción completa** (4000 caracteres máx.)

> El Stop de toda la vida, a toda velocidad. Cae una letra, aparece un tema y
> arranca el crono: países con B, animales con M, oficios con P… Tienes
> sesenta segundos para encontrar todos los que puedas.
>
> RETA A TUS AMIGOS
> Invita hasta a siete amigos a la misma partida: mismas letras, mismos temas,
> y cada uno juega cuando quiere. Clasificación, trofeos y revancha.
>
> PODERES PARA HACER UN POCO DE TRAMPA
> Cambia de letra, adelántate al siguiente tema, deja pasar dos faltas… Diez
> poderes por ganar: encuentra tu combinación favorita.
>
> NUEVOS TEMAS EN CADA NIVEL
> Gana nuevos temas para un reto aún mayor: frutas y verduras, oficios,
> deportes, partes del cuerpo, ciudades, marcas…
>
> PARA LOS MÁS COMPETITIVOS
> Las palabras más raras dan hasta el triple de puntos: descúbrelas o propón
> las tuyas.
>
> • Sin registro, cuenta opcional
> • Un solo anuncio breve, al elegir un nuevo tema
> • Se juega sin conexión en solitario
> • En siete idiomas

**Categoría de la aplicación**: Juegos › Palabras
**Etiquetas** (5 como máximo, de la lista de Play Console): Palabras,
Preguntas, Cultura general, Un jugador, Multijugador
**Dirección de correo de contacto**: fongue.jeremy@gmail.com (pública en la
ficha)
**Política de privacidad** (una sola dirección para toda la app):
https://jfongue.github.io/lettre-minute/confidentialite.html, es decir
`VITE_PRIVACY_URL`; la traducción al español está en
https://jfongue.github.io/lettre-minute/confidentialite.es.html, y las dos
páginas se enlazan entre sí

## Contenido de la aplicación (Play Console › Política › Contenido de la aplicación)

| Apartado | Respuesta |
| --- | --- |
| Acceso a la aplicación | Sin restricciones: todo es accesible sin iniciar sesión |
| Anuncios | **Sí**: un intersticial de AdMob tras cada elección de categoría a partir de la segunda |
| Clasificación de contenido (IARC) | Categoría «Juego»; no a todas las preguntas (violencia, miedo, sexualidad, apuestas, lenguaje, drogas, compras digitales); **interacción entre usuarios: sí** (nombre de jugador, avatar y puntuaciones visibles en las clasificaciones, entre amigos y en los retos; sin mensajería ni texto libre intercambiado, salvo el nombre). Resultado esperado: PEGI 3 / Todos los públicos, con el elemento interactivo «Los usuarios interactúan» |
| Público objetivo | 13 años o más. Elegir una franja de menos de 13 años hace entrar la app en el programa Familias y sus requisitos adicionales |
| Aplicación de noticias | No |
| Apps gubernamentales / de salud / financieras | No |
| ID de publicidad | **Sí**, a través del SDK de AdMob; finalidades: publicidad, analíticas, prevención de fraudes. El SDK añade el permiso `AD_ID` al manifiesto |

## Seguridad de los datos

Las filas de Supabase solo valen si la compilación incluye sus claves; las
filas de AdMob valen para toda compilación Android, ya que el SDK publicitario
siempre está incluido. Las declaraciones de AdMob siguen la guía «Seguridad de
los datos» de la ayuda de AdMob, que hay que releer en cada actualización del
SDK.

- Recogida o compartición de datos: **sí, se recogen** y **sí, se comparten**
  (con Google, para la publicidad)
- Datos cifrados en tránsito: **sí** (HTTPS hacia Supabase y Google)
- Forma de solicitar la eliminación: **sí**, en la app (Menú › Perfil ›
  Borrar mis datos) y en
  https://jfongue.github.io/lettre-minute/confidentialite.es.html#effacer

| Tipo de datos (Play) | Qué es aquí | Recogidos | Compartidos | Tratamiento efímero | Obligatorio | Finalidad |
| --- | --- | --- | --- | --- | --- | --- |
| Información personal › ID de usuario | El identificador anónimo de Supabase | Sí | No | No | Sí | Funciones de la aplicación |
| Información personal › Nombre | Nombre de jugador, elegido al crear la cuenta, visible para los demás jugadores | Sí | No | No | No (cuenta opcional) | Funciones de la aplicación, gestión de la cuenta |
| Información personal › Dirección de correo electrónico | Inicio de sesión y código para restablecer la contraseña (introducida o enviada por Google) | Sí | No | No | No (cuenta opcional) | Funciones de la aplicación, gestión de la cuenta |
| Información personal › Otra información | Lista de amigos, retos | Sí | No | No | No | Funciones de la aplicación |
| Dispositivo u otros IDs | Token de notificaciones de Firebase (retos) | Sí | No | No | No (el jugador acepta las notificaciones) | Funciones de la aplicación |
| Actividad en la aplicación › Otras acciones | Partidas, puntuaciones, palabras jugadas, XP | Sí | No | No | Sí | Funciones de la aplicación |
| Actividad en la aplicación › Otro contenido generado por el usuario | Palabras propuestas al diccionario | Sí | No | No | No (el jugador elige proponer) | Funciones de la aplicación |
| Ubicación › Ubicación aproximada | Deducida de la dirección IP por AdMob | Sí | Sí | No | Sí | Publicidad o marketing, analíticas, prevención de fraudes |
| Dispositivo u otros IDs | ID de publicidad (AdMob) | Sí | Sí | No | Sí | Publicidad o marketing, analíticas, prevención de fraudes |
| Actividad en la aplicación › Interacciones en la aplicación | Visualizaciones y toques en el anuncio (AdMob) | Sí | Sí | No | Sí | Publicidad o marketing, analíticas, prevención de fraudes |
| Información y rendimiento de la aplicación › Diagnósticos, registros de fallos | Enviados por el SDK de AdMob | Sí | Sí | No | Sí | Analíticas, prevención de fraudes |

Todo lo demás (ubicación precisa, contactos, fotos, número de teléfono): **no
se recoge**. La contraseña solo se guarda cifrada con hash, por Supabase Auth.

## Eliminación de la cuenta (Play Console › Política › Eliminación de datos)

- ¿La app permite crear una cuenta? **Sí**: se crea automáticamente una
  cuenta anónima, y el jugador puede ponerle nombre (nombre, correo y
  contraseña, o Google). El borrado elimina tanto una como otra
- Enlace de eliminación fuera de la app:
  https://jfongue.github.io/lettre-minute/confidentialite.es.html#effacer
- Eliminación parcial de datos sin eliminar la cuenta: no se ofrece
