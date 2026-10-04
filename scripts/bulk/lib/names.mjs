// Name tokenising and variant detection shared by curation steps.
export const COLOURS = new Set(['red','green','blue','yellow','orange','purple','pink','brown','black','white','grey','gray','cyan','teal','gold','golden','magenta','violet','beige','tan','crimson','lime','navy']);
export const split = name => name.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2').replace(/([A-Za-z])(\d)/g, '$1 $2').replace(/(\d)([A-Za-z])/g, '$1 $2').split(/[^A-Za-z0-9]+/).filter(Boolean).map(s => s.toLowerCase());
const isVariantToken = t => /^\d+$/.test(t) || /^[a-z]$/.test(t);
// Key that is equal for pure recolours / quality tiers / numbered variants of one design.
export const baseKey = name => split(name).filter(t => !COLOURS.has(t) && !isVariantToken(t) && !['hq','lq','color','colored','default','dark'].includes(t)).join(' ');
// Key equal for recolours and quality tiers only (letters/digits still distinguish designs).
export const designKey = name => split(name).filter(t => !COLOURS.has(t) && !['hq','lq','color','colored'].includes(t)).join(' ');
