// MERCU-CERO: Sentinel-1 (radar) y cambio de vegetación con Sentinel-2 para las 40 pozas
var P=[['S2-09',-68.30444,-15.25526],['S2-10',-68.31485,-15.24307],['S2-20',-68.3056,-15.1376],['S2-12',-68.32942,-15.24191],['S2-34',-68.13756,-15.23729],['S2-39',-68.18383,-15.16279],['S2-21',-67.6813,-15.22021],['S2-16',-67.6773,-15.10224],['S2-40',-68.19711,-15.28906],['S2-33',-68.19003,-15.29037],['S2-07',-68.29396,-15.27065],['S2-06',-68.15609,-15.30094],['S2-29',-68.29084,-15.13307],['S2-24',-68.10395,-15.3348],['S2-25',-68.37379,-15.22923],['S2-38',-68.06882,-15.3571],['S2-36',-68.17214,-15.1947],['S2-11',-67.65851,-15.77907],['S2-32',-67.80622,-15.48394],['S2-30',-67.70517,-15.67415],['S2-15',-67.61698,-15.43103],['S2-03',-67.60903,-15.39645],['S2-31',-67.67683,-15.3395],['S2-23',-67.68808,-15.29466],['S2-05',-67.673,-15.29372],['S2-19',-67.69441,-15.28559],['S2-35',-67.70605,-15.25783],['S2-26',-67.70171,-15.24652],['S2-18',-67.67758,-15.2138],['S2-01',-67.60569,-15.18588],['S2-02',-67.61994,-15.16733],['S2-04',-67.62995,-15.15196],['S2-13',-67.64718,-15.14087],['S2-14',-68.017,-15.5596],['S2-08',-68.02671,-15.57248],['S2-22',-68.05933,-15.58052],['S2-27',-67.67869,-15.74349],['S2-28',-67.76038,-15.62552],['S2-17',-67.90636,-15.60148],['S2-37',-67.67316,-15.76051]];
var fc=ee.FeatureCollection(P.map(function(p){return ee.Feature(ee.Geometry.Point([p[1],p[2]]),{id:p[0]})}));
var aoi=ee.Geometry.Rectangle([-68.40,-15.80,-67.60,-15.10]);
// --- Sentinel-1 GRD (dB), temporada seca 2025, polarización VV ---
var s1=ee.ImageCollection('COPERNICUS/S1_GRD').filterBounds(aoi).filterDate('2025-05-01','2025-10-01')
  .filter(ee.Filter.eq('instrumentMode','IW')).filter(ee.Filter.listContains('transmitterReceiverPolarisation','VV')).select('VV');
var vv=s1.median();
var agua=vv.lt(-16).rename('agua');           // agua quieta: baja retrodispersión
// --- Sentinel-2: NDVI mediana temporada seca 2019 vs 2025 ---
function ndvi(a){return ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterBounds(aoi).filterDate(a+'-05-01',a+'-10-01')
  .map(function(i){var scl=i.select('SCL');return i.updateMask(scl.neq(3).and(scl.neq(8)).and(scl.neq(9)).and(scl.neq(10)))})
  .median().normalizedDifference(['B8','B4'])}
var n19=ndvi('2019'),n25=ndvi('2025');
var perdida=n19.gt(0.6).and(n25.lt(0.4)).rename('perdida');   // era vegetación densa y ya no
var img=vv.rename('vv').addBands(agua).addBands(n19.rename('n19')).addBands(n25.rename('n25'));
var r1=img.reduceRegions({collection:fc.map(function(f){return f.buffer(60)}),reducer:ee.Reducer.mean(),scale:10});
var r2=perdida.multiply(ee.Image.pixelArea()).divide(1e4).reduceRegions({collection:fc.map(function(f){return f.buffer(500)}),reducer:ee.Reducer.sum(),scale:10});
var nS1=s1.size();
r1.evaluate(function(a){r2.evaluate(function(b){nS1.evaluate(function(n){
  var m={};b.features.forEach(function(f){m[f.properties.id]=f.properties.sum});
  var rows=a.features.map(function(f){var p=f.properties;return [p.id,(p.vv||0).toFixed(1),(p.agua||0).toFixed(2),(p.n19||0).toFixed(2),(p.n25||0).toFixed(2),(m[p.id]||0).toFixed(2)].join(',')});
  print('RESULTADO_MERCU n_s1='+n+' ;'+rows.join(';'));
})})});
