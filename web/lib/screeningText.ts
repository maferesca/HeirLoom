// Renders the engine's screening reason codes (code + params) in the user's language.
type P = Record<string, unknown>;
const crop = (lang: string, c: string) => (c === "maize" ? (lang === "es" ? "maíz" : "maize") : c === "bean" ? (lang === "es" ? "frijol" : "dry bean") : c);
const list = (lang: string, xs: string[]) => xs.map((x) => crop(lang, x)).join(", ");

const ES: Record<string, (p: P, l: string) => string> = {
  all_crops_available: (p, l) => `Cultivos disponibles: ${list(l, p.crops as string[])}`,
  not_allowed: (p, l) => `${crop(l, p.crop as string)} no está entre los cultivos que puedes o quieres sembrar`,
  seed_unavailable: (p, l) => `Declaraste que no consigues semilla de ${crop(l, p.crop as string)}`,
  equipment_unsupported: (p, l) => `Declaraste que tu equipo no sirve para ${crop(l, p.crop as string)}`,
  no_buyer: (p, l) => `Declaraste que no tienes comprador para ${crop(l, p.crop as string)}`,
  date_in_window: () => "Tu fecha habitual cae dentro de tu ventana de siembra",
  no_window_all_viable: () => "Sin ventana declarada: todas las fechas se consideran posibles",
  date_outside_window: () => "Tu fecha habitual queda fuera de tu ventana de siembra",
  no_overlap: (p) => `Sin traslape: en el peor caso quedan ${p.minGapDays} días entre la cosecha y la siguiente siembra`,
  cycles_overlap: (p, l) => `Traslape: el ciclo ${p.cycle} (${crop(l, p.crop as string)}, ${p.days} días) termina ${p.overlapDays} días después de que abre la siguiente siembra`,
  rotation: () => "Rotación: usa más de un cultivo",
  monoculture_label: () => "Monocultivo (un solo cultivo repetido)",
  monoculture_only_option: () => "Monocultivo: es la única opción con los cultivos permitidos",
  monoculture_when_rotation_possible: () => "Monocultivo descartado: con los cultivos permitidos sí es posible una rotación (regla del proyecto)",
  water_rule_missing: () => "Compatibilidad de agua entre cultivos sucesivos: sin evaluar (no hay una regla respaldada)",
  family_pest_rule_missing: (p) => `Familia y plagas (${(p.families as string[]).join(" → ")}): sin evaluar (se necesita una regla con fuente local)`,
  single_crop_pool: (p, l) => `Con solo ${crop(l, p.crop as string)} permitido no es posible una rotación (se necesitan al menos dos cultivos); ` + (p.alternative ? "la única candidata es un monocultivo." : "no hay otra secuencia viable."),
  few_alternatives: (p) => `Solo ${p.count} alternativa(s) viable(s) con las restricciones declaradas`,
  intercrop_current: () => "Tu práctica actual incluye cultivos sembrados juntos. El modelo solo calcula agua para las alternativas de cultivos sucesivos.",
};
const EN: Record<string, (p: P, l: string) => string> = {
  all_crops_available: (p, l) => `Crops available: ${list(l, p.crops as string[])}`,
  not_allowed: (p, l) => `${crop(l, p.crop as string)} is not among the crops you can or want to plant`,
  seed_unavailable: (p, l) => `You declared no seed is available for ${crop(l, p.crop as string)}`,
  equipment_unsupported: (p, l) => `You declared your equipment cannot handle ${crop(l, p.crop as string)}`,
  no_buyer: (p, l) => `You declared no buyer for ${crop(l, p.crop as string)}`,
  date_in_window: () => "Your usual date falls inside your planting window",
  no_window_all_viable: () => "No window declared: every date counts as possible",
  date_outside_window: () => "Your usual date falls outside your planting window",
  no_overlap: (p) => `No overlap: in the worst case ${p.minGapDays} days remain between harvest and the next planting`,
  cycles_overlap: (p, l) => `Overlap: cycle ${p.cycle} (${crop(l, p.crop as string)}, ${p.days} days) ends ${p.overlapDays} days after the next planting window opens`,
  rotation: () => "Rotation: uses more than one crop",
  monoculture_label: () => "Monoculture (a single crop repeated)",
  monoculture_only_option: () => "Monoculture: the only option with the allowed crops",
  monoculture_when_rotation_possible: () => "Monoculture discarded: a rotation is possible with the allowed crops (project rule)",
  water_rule_missing: () => "Water compatibility between successive crops: not evaluated (no backed rule)",
  family_pest_rule_missing: (p) => `Family and pests (${(p.families as string[]).join(" → ")}): not evaluated (needs a rule with a local source)`,
  single_crop_pool: (p, l) => `With only ${crop(l, p.crop as string)} allowed no rotation is possible (at least two crops are needed); ` + (p.alternative ? "the only candidate is a monoculture." : "there is no other viable sequence."),
  few_alternatives: (p) => `Only ${p.count} viable alternative(s) with the declared restrictions`,
  intercrop_current: () => "Your current practice includes crops planted together. The model only computes water for the alternatives with successive crops.",
};

export function reasonText(lang: string, code: string, params: P = {}): string {
  const f = (lang === "es" ? ES : EN)[code];
  return f ? f(params, lang) : code;
}
