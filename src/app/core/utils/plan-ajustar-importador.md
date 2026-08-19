Elaboré ese documento donde informe en base a este contenido, que detalla la problematica actual de ovif. Se basa en la siguiente información relevada por un agente: 

Informe: Carga de importes desde Excel — problema actual y solución

Resumen ejecutivo
Hoy, cuando se importan archivos Excel a los módulos de carga (recaudaciones, gastos, recursos y determinación tributaria), el sistema no lee el valor real de cada celda, sino el texto tal como Excel lo muestra en pantalla. Esa decisión, que parecía inofensiva, está provocando que algunos importes se guarden mal en la base de datos: unos quedan multiplicados por mil y otros pierden centavos de forma silenciosa. La solución definitiva es pasar a leer el dato crudo de cada celda (el número real que Excel guarda por debajo) y aplicar un redondeo y una validación controlados antes de guardar.

Por qué pasa esto
En Excel, una cosa es lo que se ve en la celda y otra es el número real almacenado. Por ejemplo, una celda puede mostrar 9.885.424,43 pero por debajo guardar 9.885.424,425. El formato de la columna redondea la vista a dos decimales, pero el valor real tiene más.

El sistema, al importar, toma el texto visible/formateado en lugar del número real. Y ese texto formateado de Excel tiene dos limitaciones que generan los errores:

Recorta los números a unas 10 cifras, descartando lo que sobra.
Es ambiguo con los separadores: no distingue bien cuándo un punto o una coma es "separador de miles" y cuándo es "decimal".
Los dos errores reales que aparecen hoy
Error 1 — Importes multiplicados por mil.
Cuando el valor real de una celda termina justo en tres decimales (algo que pasa por cómo Excel guarda ciertos cálculos), el sistema confunde el separador decimal con uno de miles y borra la coma. Resultado: el importe se guarda mil veces más grande.

Ejemplo real del último archivo: una recaudación de 9.885.424,43 se guardó como 9.885.424.425. Otra de 396.045,51 quedó en 396.045.505.
Error 2 — Pérdida silenciosa de centavos.
En los importes grandes (cientos de millones o miles de millones), el recorte a 10 cifras de Excel elimina los centavos sin avisar.

Ejemplo: 483.051.758,14 se guardó como 483.051.758,10 (se perdieron 4 centavos). Lo mismo pasó con varias coparticipaciones y partidas grandes.
Lo grave de ambos casos es que no saltan como error: el sistema los acepta como válidos y los guarda mal. Solo se detectan revisando manualmente contra el Excel original.

Aclaración importante: que algunos números se hayan guardado bien hasta ahora es pura casualidad (depende del tamaño del número y de si los centavos terminan en cero). No es que el sistema funcione bien; es que el problema solo se manifiesta en ciertos valores.

Alcance
El problema afecta a los cuatro módulos de carga (recaudaciones, gastos, recursos y determinación tributaria), porque todos comparten la misma forma de leer los archivos. El módulo de remuneraciones ya funciona bien, justamente porque desde su construcción lee el dato crudo en lugar del texto formateado. Es decir: ya tenemos en casa la prueba de que el enfoque correcto funciona en producción.

La solución definitiva y robusta
1. Leer el dato crudo.
En lugar de tomar el texto que Excel muestra, tomar el número real que la celda guarda por debajo. Esto elimina de raíz los dos errores: ya no hay recorte a 10 cifras ni confusión de separadores.

2. Redondear a dos decimales de forma controlada.
Una vez que tenemos el número real, lo redondeamos nosotros a dos decimales antes de guardarlo (en lugar de dejar que Excel decida o que la base de datos lo haga por su cuenta). Así, un 9.885.424,425 se guarda correctamente como 9.885.424,43.

3. Validar cada fila en la previsualización.
Antes de confirmar la carga, el sistema marca en la vista previa cualquier fila cuyo importe tenga más de dos decimales reales, para que la persona pueda revisarla. Esto se hace con un criterio tolerante: se considera "más de dos decimales" solo cuando la diferencia es significativa (del orden de medio centavo o más), de modo que no se marquen por error valores legítimos que arrastran imprecisiones mínimas propias del cálculo digital.

Nota sobre la validación: al leer el dato crudo ya no existe el "texto" original que tipeó el usuario, así que no se valida el formato escrito (con coma, puntos, etc.) sino el valor en sí. Lo que importa para la base no es cómo se escribió, sino que el monto sea correcto y con dos decimales.

Beneficios
Elimina los importes multiplicados por mil.
Elimina la pérdida silenciosa de centavos en montos grandes.
Avisa al usuario en la previsualización cuando un importe trae decimales de más, en vez de guardarlo mal en silencio.
Unifica el criterio de los cinco módulos bajo el mismo enfoque que ya usa (y valida) remuneraciones.
Es confiable a cualquier escala de monto que maneje el municipio.
Conclusión
El origen de los errores no es un caso aislado, sino la forma en que hoy se leen los archivos: tomando lo que Excel muestra en pantalla en lugar del valor real. Pasar a leer el dato crudo, sumado a un redondeo controlado a dos decimales y a una validación tolerante en la previsualización, resuelve los dos bugs de forma definitiva y deja la carga de importes consistente y segura en todos los módulos.

¿hace falta que el Excel venga sin separadores de miles y ya redondeado?
Separadores de miles: ya no importan, y esa es justamente la ventaja. Los separadores de miles son solo formato de visualización, no forman parte del número guardado. Cuando leés el dato crudo de una celda numérica, no recibís 9.885.424,43, recibís el número 9885424.43 puro. Es decir: el problema de los separadores desaparece porque dejás de leer el texto formateado. No necesitás pedirle a nadie que quite los puntos de miles.

La única condición real es que el importe sea un número de verdad en Excel, no texto. Si alguien tipea el monto como texto (celda en formato texto, o exportado así desde otro sistema), ahí sí el dato crudo es una cadena y hay que interpretar separadores. Por eso conviene que los importes vengan como número.

Redondeo previo a 2 decimales: deseable pero no obligatorio. No hace falta porque redondeamos nosotros. Lo único que cambia es que, si el dato ya viene con 2 decimales reales, la previsualización no marca nada; si trae un tercer decimal, lo redondeamos y además lo señalamos para que lo revisen.

¿Quedan mitigados los 6 riesgos? — uno por uno
1. Ceros a la izquierda en códigos → No es un problema real acá (ya estaba "perdido").
En estos módulos los códigos se validan y guardan como enteros desde siempre, así que el cero a la izquierda ya no se conserva hoy (el 6111002 en la base no tiene cero adelante). raw:true no cambia nada. Solo importaría si un código necesitara conservar el cero como parte de su identidad, que no es el caso en este dominio. Mitigado / no aplica.

2. Fechas como número de serie → Mitigado, y casi inaplicable.
Los 4 módulos no tienen columnas de fecha: anio, cuota, altas_periodo, bajas_periodo son enteros, no fechas. El riesgo solo aparecería si alguien, por error, formatea una de esas celdas como fecha en Excel. Se cubre activando la lectura de fechas (que las devuelve como fecha real y no como número suelto) y, si hiciera falta, copiando el mecanismo de conversión que remuneraciones ya usa. Mitigado.

3. Artefactos de punto flotante → Este es el que la propuesta resuelve de lleno.
Era el riesgo más serio (cambiar el ×1000 por colas de decimales tipo …4299999996). El redondeo explícito a 2 decimales lo elimina por completo: el valor crudo se redondea antes de validar y de guardar, así que nunca llega una cola de decimales a la base. Mitigado totalmente — es el corazón de la solución.

4. Validación inconsistente texto vs. número → Mitigado unificando el manejo.
La clave es tener una sola función que acepte las dos formas: si la celda es número, lo redondea; si es texto, lo interpreta (separadores) y luego lo redondea. Es exactamente el enfoque que ya aplica remuneraciones. Así dos celdas que se ven iguales terminan en el mismo resultado, sin importar cómo las guardó Excel. Mitigado.

5. Mensajes de error desalineados → Mitigado mostrando el valor final en la previsualización.
La previsualización pasa a mostrar el valor real que se va a guardar (ya redondeado), que se vuelve la fuente de verdad. El usuario revisa y confirma ese número, no la vista de Excel. Y en el caso límite (Excel muestra ,43 pero por debajo hay ,425), que la preview lo señale es el comportamiento deseado: saca a la luz el decimal oculto en vez de guardarlo mal en silencio. Mitigado.

6. Booleanos / porcentajes / moneda → No aplican, y en moneda hasta mejora.
Estos módulos no tienen columnas booleanas ni de porcentaje. En cuanto a moneda: leer el dato crudo es mejor, porque un importe con formato $ 9.885.424,43 hoy (texto formateado) podría fallar al interpretarse por el símbolo $, mientras que en crudo llega el número limpio. No aplica / mejora.

Conclusión
Separadores de miles: dejan de ser un problema; no hay que pedir que los quiten.
Redondeo previo: deseable para evitar marcas en la preview, pero no obligatorio (redondeamos nosotros).
De los 6 riesgos: el crítico (#3, punto flotante) queda resuelto por el redondeo; #4 y #5 quedan mitigados por unificar el manejo y mostrar el valor final en la preview; y #1, #2 y #6 son no-aplicables o irrelevantes para estos 4 módulos (no hay ceros a la izquierda significativos, ni fechas, ni booleanos/porcentajes).
En resumen: sí, la propuesta deja los seis riesgos cubiertos o sin efecto, siempre que se acompañe raw:true con los tres ingredientes que veníamos charlando — redondeo a 2 decimales, validación tolerante en la preview, y lectura de fechas activada por las dudas.
