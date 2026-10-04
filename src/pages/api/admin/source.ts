import type { APIRoute } from 'astro';
import { importSource } from '../../../lib/source-import';
export const POST: APIRoute = async ({request}) => {
  try {
    if (Number(request.headers.get('Content-Length')) > 4096) throw new Error('Source link is too long.');
    const body = await request.text();
    if (body.length > 4096) throw new Error('Source link is too long.');
    const {url} = JSON.parse(body);
    if (typeof url !== 'string') throw new Error('Paste an asset page URL.');
    return Response.json({source:await importSource(url)}, {headers:{'Cache-Control':'no-store'}});
  } catch(error) {
    return Response.json({error:error instanceof Error?error.message:'The source could not be read.'}, {status:400,headers:{'Cache-Control':'no-store'}});
  }
};
