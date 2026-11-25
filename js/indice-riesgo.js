/**
 * MERCU-CERO — Índice de riesgo (Tarea C)
 *
 * Fórmula: CEPAL (2024), Guía para priorizar y evaluar proyectos de remediación
 * ambiental: gestión de pasivos mineros, p. 108:
 *   IR = α·VSH + β·VS + (1 − α − β)·VE, redondeado al entero más cercano.
 * Niveles de vulnerabilidad: cuadro IV.4, p. 107.
 *
 * Las reglas para medir cada vulnerabilidad, los pesos y las distancias son
 * decisiones del equipo MERCU-CERO (no normas oficiales). Ver el documento
 * "MERCU-CERO: revisión del índice de riesgo (tarea C)".
 *
 * El índice ordena inspecciones y muestreos. NO confirma presencia de mercurio.
 */

export const CONFIG = {
  // Pesos (criterio del equipo)
  alfa: 0.5, // salud humana
  beta: 0.2, // social
  // ecoambiental = 1 - alfa - beta = 0.3

  // Valor de referencia de mercurio. Lo define la Tarea B.
  // Mientras sea null, ningún resultado de laboratorio se puede comparar
  // y la salud se calcula como provisional.
  referenciaHg: null, // { valor: number, unidad: 'mg/kg', matriz: 'sedimento', fuente: '...' }

  // Distancias (criterio del equipo)
  distanciaRioConexionM: 500, // hasta 500 m se considera conectado al río
  distanciaAreaProtegidaCercaKm: 1, // 0–1 km fuera del límite = "cerca"

  // Bandas NBI (criterio del equipo): >60 % = 3; 40–60 % = 2; <40 % = 1
  nbiAlto: 60,
  nbiMedio: 40,
};

/** Redondeo a 2 decimales sin errores de punto flotante. */
function r2(x) {
  return Math.round((x + Number.EPSILON) * 100) / 100;
}

/** ¿El sitio está conectado al agua? Cerca del río o su drenaje corre hacia el río. */
export function conectadoAlRio(sitio, cfg = CONFIG) {
  const cerca =
    typeof sitio.distanciaRioM === 'number' &&
    sitio.distanciaRioM <= cfg.distanciaRioConexionM;
  return cerca || sitio.drenaAlRio === true;
}

/**
 * VSH — vulnerabilidad de salud humana (decisión 1 del equipo).
 * Devuelve { nivel, provisional, motivo }.
 */
export function nivelSalud(sitio, cfg = CONFIG) {
  const hg = sitio.laboratorio?.hg;
  const hayLab = typeof hg === 'number';
  const hayRef = cfg.referenciaHg && typeof cfg.referenciaHg.valor === 'number';
  const exposicion = sitio.viaExposicion === true; // pescado, agua, alimentos

  if (hayLab && hayRef) {
    if (hg > cfg.referenciaHg.valor) {
      return exposicion
        ? { nivel: 3, provisional: false, motivo: 'Laboratorio supera la referencia y hay vía de exposición' }
        : { nivel: 2, provisional: false, motivo: 'Laboratorio supera la referencia, sin vía de exposición documentada' };
    }
    return { nivel: 1, provisional: false, motivo: 'Laboratorio por debajo de la referencia' };
  }

  // Sin laboratorio (o sin valor de referencia todavía): nivel provisional
  const conexion = conectadoAlRio(sitio, cfg) || exposicion;
  if (sitio.sospechaMinera === true && conexion) {
    return { nivel: 2, provisional: true, motivo: 'Sospecha de fuente minera con conexión a agua, alimentos o población' };
  }
  return { nivel: 1, provisional: true, motivo: 'Sin vía de exposición documentada en la evaluación inicial' };
}

/** VS — vulnerabilidad social: solo NBI municipal (decisión 2 del equipo). */
export function nivelSocial(sitio, cfg = CONFIG) {
  const nbi = sitio.nbiPct;
  if (typeof nbi !== 'number') return { nivel: null, motivo: 'Falta el NBI del municipio' };
  if (nbi > cfg.nbiAlto) return { nivel: 3, motivo: `NBI ${nbi} % (más de ${cfg.nbiAlto} %)` };
  if (nbi >= cfg.nbiMedio) return { nivel: 2, motivo: `NBI ${nbi} % (${cfg.nbiMedio}–${cfg.nbiAlto} %)` };
  return { nivel: 1, motivo: `NBI ${nbi} % (menos de ${cfg.nbiMedio} %)` };
}

/**
 * VE — vulnerabilidad ecoambiental.
 * sitio.areaProtegida: { dentro: boolean, distanciaKm: number|null, nombre: string }
 */
export function nivelEco(sitio, cfg = CONFIG) {
  const ap = sitio.areaProtegida;
  if (!ap) return { nivel: null, motivo: 'Falta la ubicación respecto a áreas protegidas' };
  if (ap.dentro) return { nivel: 3, motivo: `Dentro de ${ap.nombre ?? 'un área protegida'}` };
  if (typeof ap.distanciaKm === 'number' && ap.distanciaKm <= cfg.distanciaAreaProtegidaCercaKm) {
    return { nivel: 2, motivo: `A ${ap.distanciaKm} km de ${ap.nombre ?? 'un área protegida'}` };
  }
  if (typeof ap.distanciaKm === 'number') return { nivel: 1, motivo: 'Lejos de áreas protegidas' };
  return { nivel: null, motivo: 'Falta la distancia al área protegida' };
}

const ETIQUETAS = { 1: 'Bajo', 2: 'Medio', 3: 'Alto' };

/**
 * Calcula el índice de un sitio.
 * Devuelve el puntaje decimal (para ordenar), el nivel 1–3 (para mostrar),
 * si es preliminar, los motivos y los datos faltantes.
 */
export function calcularIndice(sitio, cfg = CONFIG) {
  const salud = nivelSalud(sitio, cfg);
  const social = nivelSocial(sitio, cfg);
  const eco = nivelEco(sitio, cfg);

  const faltantes = [];
  if (social.nivel === null) faltantes.push(social.motivo);
  if (eco.nivel === null) faltantes.push(eco.motivo);
  if (typeof sitio.laboratorio?.hg !== 'number') faltantes.push('Resultado de laboratorio');
  if (!cfg.referenciaHg) faltantes.push('Valor de referencia de mercurio (Tarea B)');

  // Sin social o eco no se puede calcular el índice
  if (social.nivel === null || eco.nivel === null) {
    return { id: sitio.id, puntaje: null, nivel: null, etiqueta: 'Sin datos suficientes', preliminar: true, salud, social, eco, faltantes };
  }

  const gamma = 1 - cfg.alfa - cfg.beta;
  const puntaje = r2(cfg.alfa * salud.nivel + cfg.beta * social.nivel + gamma * eco.nivel);
  // Redondeo al entero más cercano (CEPAL p. 108): 2,50 → 3
  const nivel = Math.min(3, Math.max(1, Math.floor(puntaje + 0.5)));
  const preliminar = salud.provisional;

  return {
    id: sitio.id,
    puntaje,
    nivel,
    etiqueta: ETIQUETAS[nivel] + (preliminar ? ' (preliminar)' : ''),
    preliminar,
    aviso: preliminar ? 'Preliminar: requiere verificación con análisis de laboratorio' : null,
    salud,
    social,
    eco,
    faltantes,
  };
}

/**
 * Ordena los sitios de mayor a menor riesgo.
 * Desempate: población aguas abajo (decisión 2 del equipo), luego id.
 */
export function rankear(sitios, cfg = CONFIG) {
  return sitios
    .map((s) => ({ sitio: s, resultado: calcularIndice(s, cfg) }))
    .sort((a, b) => {
      const pa = a.resultado.puntaje ?? -1;
      const pb = b.resultado.puntaje ?? -1;
      if (pb !== pa) return pb - pa;
      const da = a.sitio.poblacionAguasAbajo ?? 0;
      const db = b.sitio.poblacionAguasAbajo ?? 0;
      if (db !== da) return db - da;
      return String(a.sitio.id).localeCompare(String(b.sitio.id));
    })
    .map((x, i) => ({ puesto: i + 1, ...x }));
}
