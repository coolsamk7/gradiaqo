/// <reference types="vite/client" />

/** The API's base URL, e.g. http://localhost:3000. Set in vite.config.ts from VITE_API_URL. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- a build-time constant replaced by Vite
declare const __API_URL__: string;

/** The site's own address, e.g. https://gradiaqo.com, for canonical links. Set in vite.config.ts. */
// eslint-disable-next-line @typescript-eslint/naming-convention -- a build-time constant replaced by Vite
declare const __SITE_URL__: string;
