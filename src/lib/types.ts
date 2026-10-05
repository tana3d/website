import type { D1Database, R2Bucket } from '@cloudflare/workers-types';
export interface Bindings {
  DB: D1Database; LIBRARY: R2Bucket; RELEASES?: R2Bucket;
  GITHUB_CLIENT_ID?: string; GITHUB_CLIENT_SECRET?: string; GITHUB_ADMIN_ID?: string; ADMIN_SESSION_SECRET?: string; LOCAL_ADMIN?: string;
}
export interface Asset {
  model_format: 'glb' | 'blend' | 'zip';
  downloads: number;
  id: string; slug: string; name: string; description: string;
  tags: string[]; category: string; license: string; creator: string;
  source_url: string; license_url: string; attribution: string;
  model_key: string; model_bytes: number; preview_key: string; poster_key: string;
  preview_animated: number; animations: string[]; rigged: number;
  tile_size: string; colour: string; published: number; created_at: string; updated_at: string;
}
export type AssetRow = Omit<Asset, 'tags' | 'animations' | 'model_format'> & { tags: string; animations: string };
export const modelFormat = (key:string):Asset['model_format'] => key.toLowerCase().endsWith('.zip') ? 'zip' : key.toLowerCase().endsWith('.blend') ? 'blend' : 'glb';
export const modelMime = (format:Asset['model_format']) => ({glb:'model/gltf-binary',blend:'application/octet-stream',zip:'application/zip'}[format]);
export const fromRow = (row: AssetRow): Asset => ({ ...row, model_format:modelFormat(row.model_key), downloads:row.downloads ?? 0, tags: JSON.parse(row.tags), animations: JSON.parse(row.animations) });
export const mediaUrl = (key: string) => '/media/' + key.split('/').map(encodeURIComponent).join('/');
export const fileSize = (bytes: number) => bytes < 1048576 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / 1048576).toFixed(1)} MB`;

export const categoryName = (category: string) => ({props: "Objects", characters: "Characters", scenes: "Scenes"}[category] ?? category);
