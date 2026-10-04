export const CATEGORIES = ['props','characters','scenes'] as const;
export const LICENSES = ['CC0','CC-BY-4.0','CC-BY-SA-4.0','CUSTOM'] as const;
export const SIZES = ['small','micro','vert','hero'] as const;
export const MODEL_LIMIT = 32 * 1024 * 1024;
export const SOURCE_LIMIT = 80 * 1024 * 1024;
export const IMAGE_LIMIT = 8 * 1024 * 1024;
export const BODY_LIMIT = SOURCE_LIMIT + 2 * IMAGE_LIMIT + 65536;
const field = (form: FormData, key: string) => String(form.get(key) ?? '').trim();
function text(value: string, label: string, min: number, max: number) {
  if (value.length < min || value.length > max) throw new Error(`${label} must be ${min}–${max} characters.`);
  return value;
}
function option<T extends readonly string[]>(value: string, allowed: T, label: string): T[number] {
  if (!allowed.includes(value)) throw new Error(`Choose a valid ${label}.`);
  return value;
}
function link(value: string, label: string) {
  if (!value) return '';
  const url = new URL(value);
  if (!['http:','https:'].includes(url.protocol) || url.username || url.password || value.length > 2000) throw new Error(`${label} must be an http(s) URL.`);
  return url.href;
}
export function metadata(form: FormData) {
  const name = text(field(form,'name'),'Name',1,120);
  const slug = field(form,'slug') || name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
  if (!/^[a-z0-9][a-z0-9-]{0,79}$/.test(slug)) throw new Error('Use a slug of up to 80 lowercase letters, digits and hyphens.');
  const tags = [...new Set(field(form,'tags').split(',').map(t=>t.trim().toLowerCase()).filter(Boolean))];
  if (tags.length > 16 || tags.some(t=>t.length > 40)) throw new Error('Use at most 16 tags, each up to 40 characters.');
  const colour = field(form,'colour') || '#d9e4de';
  if (!/^#[a-f0-9]{6}$/i.test(colour)) throw new Error('Choose a valid tile colour.');
  const license = option(field(form,'license'),LICENSES,'license');
  const creator = text(field(form,'creator'),'Creator',0,200);
  const source_url = link(field(form,'source_url'),'Source');
  const license_url = link(field(form,'license_url'),'License');
  if (license !== 'CC0' && (!creator || !license_url)) throw new Error('This license requires a creator and license URL.');
  const shortCredit = `“${name}”${creator ? ` by ${creator}` : ''}, licensed under ${license}.`;
  const fullCredit = `“${name}”${creator ? ` by ${creator}` : ''}${source_url ? ` (${source_url})` : ''}, licensed under ${license}${license_url ? ` (${license_url})` : ''}.`;
  const automaticCredit = license !== 'CC0' || creator || source_url ? (fullCredit.length <= 2000 ? fullCredit : shortCredit) : '';
  const attribution = text(field(form,'attribution') || automaticCredit,'Attribution',0,2000);
  const rawCategory=field(form,'category');
  const category=['vehicles','nature','environments'].includes(rawCategory)?'props':rawCategory;
  if(category!==rawCategory && !tags.includes(rawCategory) && tags.length<16)tags.push(rawCategory);
  return { name, slug, description: text(field(form,'description'),'Description',1,4000), tags,
    category: option(category,CATEGORIES,'category'), license, creator, source_url, license_url, attribution,
    tile_size: option(field(form,'tile_size') || 'small',SIZES,'tile size'), colour, published: field(form,'published') === '1' ? 1 : 0 };
}
export async function inspectModel(file: File) {
  if (!file.name.toLowerCase().endsWith('.glb') || file.size < 20 || file.size > MODEL_LIMIT) throw new Error('Upload a self-contained GLB, up to 32 MB.');
  const buffer = await file.arrayBuffer();
  const view = new DataView(buffer);
  if (view.getUint32(0,true) !== 0x46546c67 || view.getUint32(4,true) !== 2 || view.getUint32(8,true) !== file.size || view.getUint32(16,true) !== 0x4e4f534a) throw new Error('The file is not a valid GLB 2.0 model.');
  const length = view.getUint32(12,true);
  if (length > file.size - 20) throw new Error('The GLB JSON chunk is incomplete.');
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,length)));
  if (json.asset?.version !== '2.0') throw new Error('The GLB must use glTF 2.0.');
  if ([...(json.buffers ?? []), ...(json.images ?? [])].some(item=>item.uri && !item.uri.startsWith('data:'))) throw new Error('The GLB references external files. Embed its textures and buffers first.');
  return { buffer, animations: (json.animations ?? []).map((a: {name?: string},i: number)=>a.name || `Animation ${i+1}`), rigged: json.skins?.length ? 1 : 0 };
}
export async function inspectImage(file: File, staticOnly = false) {
  if (file.size < 8 || file.size > IMAGE_LIMIT) throw new Error('Previews must be PNG, JPEG, WebP or GIF, up to 8 MB.');
  const buffer = await file.arrayBuffer(), b = new Uint8Array(buffer);
  const prefix = new TextDecoder().decode(b.slice(0,12));
  const kind = b[0]===137 && prefix.slice(1,4)==='PNG' ? 'png' : b[0]===255 && b[1]===216 && b[2]===255 ? 'jpg' : prefix.startsWith('GIF87a') || prefix.startsWith('GIF89a') ? 'gif' : prefix.startsWith('RIFF') && prefix.slice(8,12)==='WEBP' ? 'webp' : '';
  if (!kind || !file.name.toLowerCase().match(new RegExp(`\\.${kind==='jpg'?'jpe?g':kind}$`))) throw new Error('The preview extension and image bytes must match PNG, JPEG, WebP or GIF.');
  const animatedWebp = kind === 'webp' && (prefix.includes('ANIM') || new TextDecoder().decode(b.slice(12,64)).includes('ANIM') || (new TextDecoder().decode(b.slice(12,16)) === 'VP8X' && !!(b[20] & 2)));
  if (staticOnly && (kind === 'gif' || animatedWebp)) throw new Error('The still thumbnail must be a non-animated PNG, JPEG or WebP.');
  return { buffer, kind, animated: kind === 'gif' || animatedWebp, mime: kind==='jpg' ? 'image/jpeg' : `image/${kind}` };
}
