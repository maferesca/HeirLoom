// Spanish renderings of engine messages (the engine speaks English; ids/values are never translated).
const ES: Record<string, string> = {
  "Rainfed confirmed: irrigation = 0 mm": "Temporal confirmado: riego = 0 mm",
  "Water regime not given: simulated as rainfed (irrigation = 0)": "No indicaste temporal o riego: se simula como temporal (riego = 0)",
  "Irrigation declared but incomplete: simulated without irrigation; water result is conditional": "Declaraste riego pero faltan datos: se simula sin riego y el resultado de agua queda condicionado",
  "Soil values are illustrative demo assumptions": "Los valores de suelo son supuestos ilustrativos de la demo",
  "Water regime (rainfed, irrigated or both)": "Si es temporal, con riego o ambos",
  "Dates when irrigation is available": "Fechas en que hay riego",
  "Water depth per application (mm)": "Lámina de agua por riego (mm)",
  "Days between applications": "Días entre riegos",
  "Field capacity (m3/m3)": "Capacidad de campo (m³/m³)",
  "Wilting point (m3/m3)": "Punto de marchitez (m³/m³)",
  "Soil water parameters not available": "No hay parámetros de agua del suelo",
  "Measurement, regional source or a published pedotransfer function": "Medición, fuente regional o función de pedotransferencia publicada",
  "Same; SoilGrids alone does not provide it": "Igual; SoilGrids por sí solo no lo da",
  "No valid historical block (missing critical days)": "Ningún bloque histórico válido (faltan días críticos)",
  "Crops sown together cannot be represented: the engine simulates one crop per cycle. Not converted into a sequential rotation.": "Los cultivos sembrados juntos no se pueden representar: el motor simula un cultivo por ciclo. No se convirtió en una rotación secuencial.",
  "One crop per cycle (crops sown together cannot be placed on a timeline)": "Un solo cultivo por ciclo (los cultivos sembrados juntos no se pueden ubicar en la línea del tiempo)",
  "Intercrop (association) water model": "Modelo de agua para cultivos asociados",
  "You observe runoff/waterlogging: the model assumes RO=0 and CR=0, so water results may be optimistic.": "Observas escurrimiento o encharcamiento: el modelo supone escurrimiento 0 y ascenso capilar 0, así que el resultado de agua puede ser optimista.",
  "The simulated planting date is outside your stated planting window.": "La fecha de siembra simulada queda fuera de tu ventana de siembra.",
  "No planting window given: every date treated as viable": "No indicaste ventana de siembra: todas las fechas se consideran viables",
  "Current practice has crops sown together; alternatives are catalog candidates not tied to it.": "Tu práctica actual tiene cultivos sembrados juntos; las alternativas son candidatas del catálogo no ligadas a ella.",
  "Flowering window per crop (phenology) and pollination heat threshold": "Ventana de floración por cultivo (fenología) y umbral de calor de polinización",
  "Catalog fields are 'pending'; no sourced values": "Los campos del catálogo están pendientes; no hay valores con fuente",
  "AquaCrop pollination heat-stress function (eq. 3.2c)": "Función de estrés térmico de polinización de AquaCrop (ec. 3.2c)",
  "Not verified against a pinned official release": "No verificada contra una versión oficial fijada",
  "RothC official implementation (pinned version) with spin-up": "Implementación oficial de RothC (versión fijada) con inicialización",
  "Not integrated": "No integrado",
  "Soil organic carbon, bulk density, coarse fragments, clay by layer": "Carbono orgánico, densidad aparente, fragmentos gruesos y arcilla por capa",
  "SoilGrids rasters not downloaded": "Rásteres de SoilGrids no descargados",
  "Crop residue biomass and retained fraction": "Biomasa de residuos y fracción que se queda en el terreno",
  "Only qualitative answer collected": "Solo se recogió una respuesta cualitativa",
  "Rainfall erosivity R (GloREDa/ESDAC)": "Erosividad de la lluvia R (GloREDa/ESDAC)",
  "Requires registration and authorized download": "Requiere registro y descarga autorizada",
  "Slope and slope length (INEGI DEM, flow path)": "Pendiente y longitud de ladera (modelo de elevación INEGI)",
  "DEM not downloaded": "Modelo de elevación no descargado",
  "Soil erodibility K and cover factor C by crop stage": "Erodabilidad del suelo K y factor de cobertura C por etapa",
  "Needs published tables, not yet loaded": "Requiere tablas publicadas, aún no cargadas",
  "Commercial yields (modeled or regional DGSIAP, same modality)": "Rendimientos comerciales (modelados o DGSIAP regional, misma modalidad)",
  "Not loaded": "No cargado",
  "Prices and costs in MXN of one base year (FIRA / farmer)": "Precios y costos en MXN de un año base (FIRA o tuyos)",
  "Not loaded; farmer values optional": "No cargado; tus valores son opcionales",
  "Normalization P10/P90 from a frozen regional reference sample": "Normalización P10/P90 con una muestra regional de referencia congelada",
  "No reference sample exists yet": "Aún no existe la muestra de referencia",
  "RO=0, CR=0 (simplification; sensitivity not yet run)": "escurrimiento = 0 y ascenso capilar = 0 (simplificación; sensibilidad aún no evaluada)",
  "one cycle per year; no soil-water simulation between cycles (state carried over)": "un ciclo por año; sin simular el agua del suelo entre ciclos (se arrastra el estado)",
  "alternatives are deterministic catalog candidates ordered by difference from current practice; not filtered by dominance because H, S, E, U are pending": "las alternativas son candidatas del catálogo ordenadas por diferencia con tu práctica actual; no se filtran por dominancia porque H, S, E y U están pendientes",
  "root depth constant from planting at the lower bound of the FAO-56 range (no root growth)": "profundidad radicular constante desde la siembra, en el límite inferior del rango de FAO-56 (sin crecimiento de raíces)",
  "Kc climate adjustment (FAO-56 eq. 62) and wetting-frequency refinement of Kc ini not applied": "no se aplica el ajuste climático de Kc (FAO-56 ec. 62) ni el refinamiento de Kc inicial por frecuencia de humedecimiento",
  "Soil water parameters estimated from SoilGrids with a pedotransfer function (regional estimate, not a measurement)": "Los parámetros de agua del suelo se estimaron con SoilGrids y una función de pedotransferencia (estimación regional, no una medición)",
  "Complete in-domain texture and organic carbon for every layer": "Textura y carbono orgánico completos y dentro del dominio de la función en cada capa",
  "SoilGrids profile for this point": "Perfil de SoilGrids para este punto",
  "Farmer measurement, regional source or a published pedotransfer function": "Medición tuya, fuente regional o función de pedotransferencia publicada",
  "SoilGrids profile now available for the pilot point; RothC inputs still missing": "Ya hay perfil de SoilGrids para el punto piloto; faltan las demás entradas de RothC",
  "elevation for ETo = user value or NASA grid-cell elevation": "elevación para ETo = tu valor o la elevación de la celda NASA",
};

export function tr(lang: string, s: string): string {
  if (lang !== "es" || !s) return s;
  if (ES[s]) return ES[s];
  let m = s.match(/^initial depletion = ([\d.]+) x TAW at the start of each block \(no spin-up\)$/);
  if (m) return `agotamiento inicial = ${m[1]} × agua aprovechable al inicio de cada bloque (sin calentamiento)`;
  m = s.match(/^Irrigation applied: (.+) mm every (\d+) d inside the window; infrastructure and cost not modeled$/);
  if (m) return `Riego aplicado: ${m[1]} mm cada ${m[2]} días dentro de tu ventana; infraestructura y costo no modelados`;
  m = s.match(/^Only (\d+) viable alternative\(s\): allowed crops = \[(.*?)\](?:; excluded by the user: \[(.*?)\])?(; the pilot catalog has only these crops)?$/);
  if (m) {
    const nm = (x: string) => x.replace(/'maize'/g, "maíz").replace(/'bean'/g, "frijol");
    return `Solo ${m[1]} alternativa(s) viable(s): cultivos permitidos = ${nm(m[2])}` + (m[3] ? `; excluidos por ti: ${nm(m[3])}` : "") + (m[4] ? "; el catálogo piloto solo tiene estos cultivos" : "");
  }
  m = s.match(/^With only (\w+) allowed, no rotation \(at least two crops\) is possible; (the only candidate is a monoculture\.|there is no other viable sequence\.)$/);
  if (m) {
    const c = m[1] === "maize" ? "maíz" : m[1] === "bean" ? "frijol" : m[1];
    return `Con solo ${c} permitido no es posible una rotación (se necesitan al menos dos cultivos); ` + (m[2].startsWith("the only") ? "la única candidata es un monocultivo." : "no hay otra secuencia viable.");
  }
  m = s.match(/^Only (\d+) viable alternative\(s\) with allowed crops \[(.*?)\](?:; excluded by the user: \[(.*?)\])?$/);
  if (m) {
    const nm = (x: string) => x.replace(/'maize'/g, "maíz").replace(/'bean'/g, "frijol");
    return `Solo ${m[1]} alternativa(s) viable(s) con los cultivos permitidos ${nm(m[2])}` + (m[3] ? `; excluidos por ti: ${nm(m[3])}` : "");
  }
  m = s.match(/^Crops outside the pilot catalog: (.*)$/);
  if (m) return `Cultivos fuera del catálogo piloto: ${m[1]}`;
  return s;
}
