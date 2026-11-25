// MERCU-CERO — Paso 1: detección de sitios candidatos (posibles relaves)
// Zona piloto: Guanay – Tipuani – Mapiri – Kaká (cuenca alta del río Beni, La Paz, Bolivia)
//
// IMPORTANTE: esto NO detecta mercurio. Detecta huellas físicas compatibles con
// relaves (pozas de agua fuera del cauce y suelo desnudo/sedimento) cerca de ríos.
// Los umbrales son iniciales y hay que calibrarlos mirando las imágenes.

// ---------- 1. Zona de estudio (rectángulo amplio alrededor de la zona piloto) ----------
var aoi = ee.Geometry.Rectangle([-68.40, -15.80, -67.60, -15.10]);
Map.centerObject(aoi, 10);

// ---------- 2. Sentinel-2 (época seca, menos nubes) ----------
var INICIO = '2025-05-01', FIN = '2025-09-30';

function enmascararNubes(img) {
  var scl = img.select('SCL');
  // 3 = sombra de nube, 8/9 = nubes, 10 = cirros, 11 = nieve
  var ok = scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)).and(scl.neq(11));
  return img.updateMask(ok).divide(10000).copyProperties(img, img.propertyNames());
}

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterBounds(aoi)
  .filterDate(INICIO, FIN)
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 30))
  .map(enmascararNubes)
  .median()
  .clip(aoi);

// ---------- 3. Índices ----------
var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('NDVI');   // vegetación
var ndwi = s2.normalizedDifference(['B3', 'B8']).rename('NDWI');   // agua
var bsi = s2.expression(                                            // suelo desnudo
  '((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))',
  {B11: s2.select('B11'), B4: s2.select('B4'), B8: s2.select('B8'), B2: s2.select('B2')}
).rename('BSI');

// ---------- 4. Capas de apoyo ----------
// Agua permanente (cauces de ríos): JRC Global Surface Water, % de ocurrencia histórica
var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater').select('occurrence').unmask(0).clip(aoi);
var rioPermanente = gsw.gte(50);

// Zonas urbanas (para excluirlas): ESA WorldCover, clase 50 = construido
var urbano = ee.ImageCollection('ESA/WorldCover/v200').first().clip(aoi).eq(50);

// ---------- 5. Firmas de relave (UMBRALES A CALIBRAR) ----------
var UMBRAL_NDWI_POZA = 0.0;   // agua visible
var UMBRAL_NDVI_SUELO = 0.20; // sin vegetación
var UMBRAL_BSI_SUELO = 0.05;  // suelo/sedimento desnudo

// Poza: agua que NO es cauce permanente (pozas de sedimentación nuevas)
var poza = ndwi.gt(UMBRAL_NDWI_POZA).and(gsw.lt(50));
// Suelo desnudo / sedimento lavado, fuera de ciudades y del agua
var suelo = ndvi.lt(UMBRAL_NDVI_SUELO).and(bsi.gt(UMBRAL_BSI_SUELO))
  .and(urbano.not()).and(poza.not()).and(rioPermanente.not());

// Clase: 1 = poza, 2 = suelo desnudo / sedimento
var clase = ee.Image(0).where(suelo, 2).where(poza, 1).selfMask().rename('clase').toInt();

// ---------- 6. Distancia al río (metros) ----------
var distRio = rioPermanente.selfMask().unmask(0)
  .fastDistanceTransform(512, 'pixels', 'squared_euclidean')
  .sqrt().multiply(30)
  .reproject({crs: 'EPSG:4326', scale: 30})
  .rename('dist_rio_m');

// ---------- 7. Convertir a polígonos ----------
var poligonos = clase.addBands(distRio).reduceToVectors({
  geometry: aoi,
  scale: 20,
  geometryType: 'polygon',
  eightConnected: true,
  labelProperty: 'clase',
  reducer: ee.Reducer.min(),     // distancia mínima al río dentro del polígono
  maxPixels: 1e10,
  tileScale: 4
});

var AREA_MIN_HA = 0.5;
var candidatos = poligonos.map(function (f) {
  var area = f.geometry().area(1).divide(10000);
  var c = f.geometry().centroid(1).coordinates();
  var tipo = ee.Algorithms.If(ee.Number(f.get('clase')).eq(1), 'poza', 'suelo_desnudo');
  return f.set({
    area_ha: area,
    tipo: tipo,
    dist_rio_m: f.get('min'),
    lon: c.get(0),
    lat: c.get(1),
    estado: 'candidato_no_verificado',
    fuente: 'Sentinel-2 ' + INICIO + '/' + FIN + ' + JRC GSW + ESA WorldCover'
  });
})
// Solo los de tamaño mínimo y a menos de 1 km de un río
.filter(ee.Filter.gte('area_ha', AREA_MIN_HA))
.filter(ee.Filter.lte('dist_rio_m', 1000));

// ---------- 8. Ver en el mapa ----------
Map.addLayer(s2, {bands: ['B4', 'B3', 'B2'], min: 0, max: 0.3}, 'Sentinel-2 color real');
Map.addLayer(rioPermanente.selfMask(), {palette: ['1f6fb2']}, 'Ríos (agua permanente)');
Map.addLayer(clase, {min: 1, max: 2, palette: ['00e5ff', 'ff7a00']}, 'Firmas: poza / suelo', false);
Map.addLayer(candidatos, {color: 'ff0000'}, 'Candidatos');

print('Cantidad de candidatos:', candidatos.size());
print('Primeros 20:', candidatos.limit(20));

// ---------- 9. Selección para la app: pozas cerca del río ----------
print('Candidatos por tipo:', candidatos.aggregate_histogram('tipo'));
var prioritarios = candidatos
  .filter(ee.Filter.eq('tipo', 'poza'))
  .filter(ee.Filter.rangeContains('area_ha', 0.5, 30))
  .filter(ee.Filter.lte('dist_rio_m', 500))
  .sort('area_ha', false)
  .limit(40);
print('Pozas seleccionadas para la app:', prioritarios.size());
Map.addLayer(prioritarios, {color: 'ffff00'}, 'Pozas seleccionadas (app)');
var filas = prioritarios.toList(40).map(function (f) {
  f = ee.Feature(f);
  return ee.List([ee.Number(f.get('area_ha')).format('%.2f'), ee.Number(f.get('dist_rio_m')).format('%.0f'),
    ee.Number(f.get('lon')).format('%.5f'), ee.Number(f.get('lat')).format('%.5f')]).join(',');
});
print('DATOS_APP (area_ha,dist_rio_m,lon,lat)', filas.join(';'));

// ---------- 10. Exportar a Google Drive como GeoJSON ----------
// Después de ejecutar, ir a la pestaña "Tasks" y presionar RUN en cada tarea.
Export.table.toDrive({collection: prioritarios, description: 'mercu_cero_pozas_app', folder: 'MERCU-CERO', fileFormat: 'GeoJSON'});
Export.table.toDrive({collection: candidatos, description: 'mercu_cero_candidatos_todos', folder: 'MERCU-CERO', fileFormat: 'GeoJSON'});
