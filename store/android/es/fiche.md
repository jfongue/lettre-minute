# Ficha de Play Store — Lettre Minute (español)

Textos y respuestas para copiar en Play Console. Los recursos gráficos están
un nivel más arriba: `../icon-512.png`, `../feature-graphic.png` (1024 × 500),
`../screenshots/` (1080 × 1920, claro y oscuro). Para regenerarlos:
`scripts/render-store.sh`.

## Ficha principal (español)

**Nombre** (30 caracteres máx.)
> Lettre Minute

**Descripción breve** (80 caracteres máx.)
> Una letra, una categoría, 60 segundos. Cuanto más rara la palabra, más puntos.

**Descripción completa** (4000 caracteres máx.)

> Cae una letra, aparece una categoría y arranca el crono. Países con B,
> animales con M, colores con V… Tienes sesenta segundos para escribir todas
> las palabras que puedas.
>
> El juego comprueba cada palabra mientras escribes, gracias a un diccionario
> de más de {WORD_COUNT} palabras creado a partir de Wikidata y Wikcionario.
> «Gatos» vale como «gato», y una errata no te penaliza: «Mexcio» vale como
> «México».
>
> LAS PALABRAS RARAS VALEN MÁS
> Una palabra que escribe todo el mundo da 10 puntos. Una que nadie encuentra
> da hasta el triple. Y el bonus se desgasta si repites la misma palabra en
> cada partida: toca variar.
>
> ENCADENA
> Cada palabra validada seguida sube el multiplicador, hasta ×2. Saltar
> cuesta cinco segundos y reinicia la racha.
>
> SUBE DE NIVEL
> Cada punto te da experiencia, y cada nivel desbloquea una categoría nueva:
> frutas y verduras, profesiones, deportes, partes del cuerpo, materiales,
> capitales, marcas, insectos…
>
> HAZ CRECER EL DICCIONARIO
> ¿Falta una palabra? Proponla con un toque. Cuando la piden tres jugadores,
> entra en el diccionario y tú ganas 150 XP.
>
> • Sin registro, sin publicidad
> • Se puede jugar sin conexión
> • Tema claro y oscuro
> • Tus datos se borran con un gesto desde el inicio

**Categoría de la aplicación**: Juego › Palabras
**Etiquetas**: Palabras, Preguntas, Un jugador, Cultura general
**Dirección de correo de contacto**: por completar (pública en la ficha)
**Política de privacidad**: la dirección pública de
`store/privacy/confidentialite.es.html` una vez publicada (hoy la página
francesa es `VITE_PRIVACY_URL`)

## Contenido de la aplicación (Play Console › Política › Contenido de la aplicación)

| Apartado | Respuesta |
| --- | --- |
| Acceso a la aplicación | Sin restricciones: todo es accesible sin iniciar sesión |
| Anuncios | No, la aplicación no contiene anuncios |
| Clasificación de contenido (IARC) | Categoría «Juego»; no a todas las preguntas (violencia, miedo, sexualidad, apuestas, lenguaje, drogas, compras digitales); los jugadores no intercambian mensajes ni comparten nada entre sí. Resultado esperado: PEGI 3 / Todos |
| Público objetivo | 13 años o más. Elegir una franja de menos de 13 años hace entrar la app en el programa Familias y sus requisitos adicionales |
| Aplicación de noticias | No |
| Apps gubernamentales / de salud / financieras | No |
| ID de publicidad | No, la aplicación no usa el ID de publicidad |

## Seguridad de los datos

Rellenar **solo si la compilación incluye las claves de Supabase**; sin
ellas, nada sale del teléfono y la respuesta es «no se recogen datos».

- Recogida o compartición de datos: **sí, se recogen**; **no se comparten**
- Datos cifrados en tránsito: **sí** (HTTPS hacia Supabase)
- Forma de solicitar la eliminación: **sí**, en la app (inicio › Borrar mis
  datos) y en `VITE_PRIVACY_URL#effacer`

| Tipo de datos (Play) | Qué es aquí | Recogidos | Compartidos | Tratamiento efímero | Obligatorio | Finalidad |
| --- | --- | --- | --- | --- | --- | --- |
| Información personal › ID de usuario | El identificador anónimo de Supabase | Sí | No | No | Sí | Funcionalidad de la aplicación |
| Actividad en la aplicación › Otras acciones | Partidas, puntuaciones, palabras jugadas, XP | Sí | No | No | Sí | Funcionalidad de la aplicación |
| Actividad en la aplicación › Otro contenido generado por el usuario | Palabras propuestas al diccionario | Sí | No | No | No (el jugador elige proponer) | Funcionalidad de la aplicación |

Todo lo demás (ubicación, contactos, fotos, correo, nombre, dispositivo,
diagnósticos, fallos): **no se recoge**.

## Eliminación de la cuenta (Play Console › Política › Eliminación de datos)

- ¿La app permite crear una cuenta? **Sí**, se crea automáticamente una
  cuenta anónima
- Enlace de eliminación fuera de la app: `VITE_PRIVACY_URL#effacer`
- Eliminación parcial de datos sin eliminar la cuenta: no se ofrece
