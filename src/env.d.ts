/// <reference path="../.astro/types.d.ts" />
/// <reference types="astro/client" />
declare namespace App { interface Locals { admin?: boolean; } }
declare module 'cloudflare:workers' {
  export const env: import('./lib/types').Bindings;
  export abstract class DurableObject<E> {
    protected ctx: import('@cloudflare/workers-types').DurableObjectState;
    protected env: E;
    constructor(ctx: import('@cloudflare/workers-types').DurableObjectState, env: E);
  }
}
