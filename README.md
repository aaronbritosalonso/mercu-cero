# MERCU-CERO

App web para encontrar, verificar y priorizar relaves mineros que pueden llevar mercurio a los ríos del norte de La Paz (cuenca alta del río Beni, Bolivia). Proyecto de hackatón.

## Qué hace
1. **Detectar**: 40 posibles pozas de relave detectadas con imágenes Sentinel-2 (mayo a septiembre de 2025) en Google Earth Engine.
2. **Priorizar**: índice de riesgo basado en la guía de CEPAL (2024): salud (50 %), comunidad (20 %, NBI del Censo 2024) y naturaleza (30 %, distancia a áreas protegidas, WDPA).
3. **Verificar**: ficha PROTEGE para reportes desde el lugar; se guarda en el teléfono sin señal.
4. **Laboratorio**: carga de resultados de mercurio y recálculo del índice.

## Funciona sin internet
Es una app web instalable (PWA). La primera vez se abre con internet; después funciona en modo avión. En el celular: abrir el link y elegir "Agregar a la pantalla de inicio".

## Qué es real y qué es simulado
- Real: imagen satelital, pozas detectadas, ríos, área protegida, municipios, NBI, población (WorldPop 2020), revisión visual de las 10 primeras pozas.
- Simulado: reportes PROTEGE, resultados de laboratorio, envío de reportes (todavía no hay servidor) y el valor de referencia de mercurio (1 mg/kg).

El satélite no detecta mercurio: detecta lugares que parecen relaves. Solo un análisis de laboratorio confirma el mercurio.

## Fuentes
Copernicus Sentinel-2 · JRC Global Surface Water · WDPA · geoBoundaries · INE y UDAPE (NBI, Censo 2024) · WorldPop · CEPAL (2024), *Guía para priorizar y evaluar proyectos de remediación ambiental: gestión de pasivos mineros*.
