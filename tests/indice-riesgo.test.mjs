// Pruebas del índice de riesgo. Ejecutar con: node --test tests/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG, calcularIndice, nivelSalud, rankear } from '../js/indice-riesgo.js';

// Referencia FICTICIA solo para las pruebas. La real la define la Tarea B.
const cfgConRef = { ...CONFIG, referenciaHg: { valor: 1, unidad: 'mg/kg', matriz: 'sedimento', fuente: 'PRUEBA' } };

const base = {
  nbiPct: 63.9,
  areaProtegida: { dentro: false, distanciaKm: 5, nombre: 'Madidi' },
};

test('Escenarios del documento del equipo: A=3,00 / B=2,30 / C=1,00', () => {
  const A = { id: 'A', ...base, laboratorio: { hg: 2 }, viaExposicion: true, areaProtegida: { dentro: true, nombre: 'Madidi' } };
  const B = { id: 'B', ...base, sospechaMinera: true, distanciaRioM: 300, areaProtegida: { dentro: true, nombre: 'Madidi' }, nbiPct: 50 };
  const C = { id: 'C', ...base, nbiPct: 30, distanciaRioM: 2000 };
  assert.equal(calcularIndice(A, cfgConRef).puntaje, 3);
  assert.equal(calcularIndice(B, cfgConRef).puntaje, 2.3);
  assert.equal(calcularIndice(C, cfgConRef).puntaje, 1);
  assert.equal(calcularIndice(B, cfgConRef).nivel, 2);
});

test('Salud: los cinco casos de la decisión 1', () => {
  const t = (s) => nivelSalud(s, cfgConRef);
  assert.equal(t({ laboratorio: { hg: 2 }, viaExposicion: true }).nivel, 3);
  assert.equal(t({ laboratorio: { hg: 2 }, viaExposicion: false }).nivel, 2);
  assert.equal(t({ laboratorio: { hg: 0.5 } }).nivel, 1);
  assert.equal(t({ sospechaMinera: true, distanciaRioM: 80 }).nivel, 2);
  assert.equal(t({ sospechaMinera: true, distanciaRioM: 2000 }).nivel, 1);
});

test('Regla del drenaje: lejos del río pero drena hacia él cuenta como conectado', () => {
  assert.equal(nivelSalud({ sospechaMinera: true, distanciaRioM: 2000, drenaAlRio: true }, cfgConRef).nivel, 2);
});

test('Sin valor de referencia, el resultado de laboratorio no se compara y queda provisional', () => {
  const r = nivelSalud({ laboratorio: { hg: 5 }, viaExposicion: true, sospechaMinera: true });
  assert.equal(r.provisional, true);
});

test('Decisión 3: 2,50 sin laboratorio da "Alto (preliminar)"', () => {
  const s = { id: 'X', sospechaMinera: true, distanciaRioM: 50, nbiPct: 64.9, areaProtegida: { dentro: true, nombre: 'Madidi' } };
  const r = calcularIndice(s, cfgConRef);
  assert.equal(r.puntaje, 2.5);
  assert.equal(r.nivel, 3);
  assert.equal(r.etiqueta, 'Alto (preliminar)');
  assert.ok(r.aviso);
});

test('Desempate por población aguas abajo', () => {
  const s1 = { id: 'S1', ...base, sospechaMinera: true, distanciaRioM: 50, poblacionAguasAbajo: 200 };
  const s2 = { id: 'S2', ...base, sospechaMinera: true, distanciaRioM: 50, poblacionAguasAbajo: 1500 };
  const r = rankear([s1, s2], cfgConRef);
  assert.equal(r[0].sitio.id, 'S2');
});

test('Faltan datos: no se calcula y se informa qué falta', () => {
  const r = calcularIndice({ id: 'Z', sospechaMinera: true }, cfgConRef);
  assert.equal(r.puntaje, null);
  assert.ok(r.faltantes.length >= 2);
});
