/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Address of the API (e.g. https://my-api.onrender.com). Leave empty in development: the Vite proxy is used. */
  readonly VITE_API_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
