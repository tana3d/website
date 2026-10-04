import { parse, type DefaultTreeAdapterMap } from 'parse5';

type Node = DefaultTreeAdapterMap['node'];
type Element = DefaultTreeAdapterMap['element'];
type Source = { provider: string; url: URL; request: URL };
export type SourceDetails = {
  provider: string; name: string; slug: string; description: string; tags: string[];
  creator: string; license: string; license_url: string; source_url: string;
  attribution: string; category: 'props'|'characters'|'scenes'; preview_url: string;
  warnings: string[];
};
const CC0 = 'https://creativecommons.org/publicdomain/zero/1.0/';

export function sourceLocation(value: string): Source {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Paste a full asset page URL.'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.port || value.length > 2000) throw new Error('Use an HTTPS asset page URL.');
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname.replace(/\/$/, '');
  url = new URL(`https://${host}${path}`);
  if (host === 'sketchfab.com') {
    // Sketchfab has public model IDs of both 31 and 32 hexadecimal characters.
    const match = path.match(/^\/(?:3d-models\/[^/]*-|models\/)([a-f0-9]{31,32})$/i);
    if (match) return { provider: 'Sketchfab', url, request: new URL(`https://api.sketchfab.com/v3/models/${match[1]}`) };
  }
  if (host === 'kenney.nl' && /^\/assets\/[a-z0-9-]+$/.test(path)) return { provider: 'Kenney', url, request: url };
  if (host === 'quaternius.com' && /^\/packs\/[a-z0-9-]+\.html$/.test(path)) return { provider: 'Quaternius', url, request: url };
  if (host === 'polyhaven.com' && /^\/a\/[a-zA-Z0-9_-]+$/.test(path)) return { provider: 'Poly Haven', url, request: url };
  throw new Error('Supported asset pages: Sketchfab, Kenney, Quaternius and Poly Haven.');
}
function licenseDetails(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('No verifiable open licence was found on this page.'); }
  if (!['creativecommons.org','www.creativecommons.org'].includes(url.hostname)) throw new Error('No supported open licence was found on this page.');
  const path = url.pathname.replace(/\/$/, '');
  const license = path === '/publicdomain/zero/1.0' ? 'CC0' : path === '/licenses/by/4.0' ? 'CC-BY-4.0' : path === '/licenses/by-sa/4.0' ? 'CC-BY-SA-4.0' : '';
  if (!license) throw new Error('This source does not use CC0, CC BY 4.0 or CC BY-SA 4.0. Its licence cannot be imported automatically.');
  return { license, license_url: `https://creativecommons.org${path}/` };
}
const clean = (value: unknown, max = 4000) => String(value ?? '').replace(/<[^>]*>/g, '').trim().slice(0,max);
const tags = (values: unknown[]) => [...new Set(values.map(v=>clean(v,40).toLowerCase()).filter(Boolean))].slice(0,16);
function finish(source: Source, data: Partial<SourceDetails> & { license_url: string }): SourceDetails {
  const name = clean(data.name,120), creator = clean(data.creator,200);
  if (!name || !creator) throw new Error('The source did not include a title and creator.');
  const licence = licenseDetails(data.license_url);
  const slug = name.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,80).replace(/-$/,'');
  return { provider: source.provider, name, slug, description: clean(data.description) || `${name} by ${creator}.`,
    tags: tags(data.tags ?? []), creator, ...licence, source_url: source.url.href,
    attribution: `“${name}” by ${creator} (${source.url.href}), licensed under ${licence.license} (${licence.license_url}).`,
    category: data.category ?? 'props', preview_url: clean(data.preview_url,2000), warnings: data.warnings ?? [] };
}
function elements(node: Node): Element[] {
  const children = 'childNodes' in node ? node.childNodes : [];
  return children.flatMap(child => [...('tagName' in child ? [child] : []), ...elements(child)]);
}
const attr = (node: Element, name: string) => node.attrs.find(a=>a.name===name)?.value ?? '';
function text(node: Node): string {
  if ('value' in node) return node.value;
  if ('tagName' in node && ['script','style'].includes(node.tagName)) return '';
  return ('childNodes' in node ? node.childNodes.map(text).join(' ') : '').replace(/\s+/g,' ').trim();
}
export function parseSource(source: Source, body: string): SourceDetails {
  if (source.provider === 'Sketchfab') {
    const data = JSON.parse(body);
    const categories = (data.categories ?? []).map((c: {slug:string})=>c.slug);
    const category = categories.includes('characters-creatures') || categories.includes('people') ? 'characters' : 'props';
    const images = [...(data.thumbnails?.images ?? [])].sort((a,b)=>Math.abs(a.width-1024)-Math.abs(b.width-1024));
    const warnings: string[] = [];
    if (!data.isDownloadable) warnings.push('The creator has not enabled model downloads.');
    if (category === 'characters' && !data.animationCount) warnings.push('This character has no source animations; published characters need an animated GLB.');
    return finish(source, { name:data.name, description:data.description, creator:data.user?.displayName || data.user?.username,
      tags:(data.tags ?? []).map((t: {name:string})=>t.name), license_url:data.license?.url, category, preview_url:images[0]?.url, warnings });
  }
  const all = elements(parse(body));
  const meta = (name: string) => all.find(n=>n.tagName==='meta' && (attr(n,'name')===name || attr(n,'property')===name));
  const content = (name: string) => { const node=meta(name);return node?attr(node,'content'):''; };
  if (source.provider === 'Poly Haven') {
    const structured = all.filter(n=>n.tagName==='script' && attr(n,'type')==='application/ld+json').flatMap(n=>{
      try { const json=JSON.parse(n.childNodes.map(c=>'value' in c?c.value:'').join(''));return json['@graph'] ?? (Array.isArray(json)?json:[json]); } catch { return []; }
    });
    const model = structured.find(n=>n['@type']==='3DModel');
    if (!model) throw new Error('This Poly Haven page is not a 3D model.');
    return finish(source, { name:model.name, description:model.description, creator:(model.creator ?? []).map((c:{name:string})=>c.name).join(', ') || model.creditText,
      tags:String(model.keywords ?? '').split(','), license_url:model.license, preview_url:model.thumbnailUrl });
  }
  const licenceLink = all.find(n=>n.tagName==='a' && attr(n,'href').includes('creativecommons.org/publicdomain/zero/1.0'));
  if (!licenceLink) throw new Error('This pack page does not explicitly identify a supported open licence.');
  const title = content('og:title') || text(all.find(n=>n.tagName==='title')!);
  const name = source.provider==='Kenney' ? title.replace(/\s*[·•|–-]\s*Kenney.*$/,'') : title.replace(/^Quaternius\s*[·•|–-]\s*/,'');
  const row = all.find(n=>n.tagName==='tr' && text(n).startsWith('Tags'));
  const packTags = row ? elements(row).filter(n=>n.tagName==='a').map(text) : content('keywords').split(',').filter(Boolean);
  return finish(source, { name, description:content('og:description') || content('description'), creator:source.provider,
    tags:packTags, license_url:CC0, preview_url:content('og:image'),
    warnings:['This link describes an asset pack. Adjust the title and tags for the individual GLB you upload.'] });
}
export async function importSource(value: string, fetcher: typeof fetch = fetch): Promise<SourceDetails> {
  const source = sourceLocation(value);
  const response = await fetcher(source.request, { redirect:'manual', signal:AbortSignal.timeout(10000), headers:{Accept:source.provider==='Sketchfab'?'application/json':'text/html'} });
  if (!response.ok) throw new Error(`The source could not be read (${response.status}). Check the asset link.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error('The source returned an empty page.');
  const chunks: Uint8Array[] = []; let size=0;
  try { for (;;) { const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2*1024*1024)throw new Error('The source page is too large.');chunks.push(value); } }
  finally { await reader.cancel(); }
  const bytes = new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return parseSource(source,new TextDecoder().decode(bytes));
}
