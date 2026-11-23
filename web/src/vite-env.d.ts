/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Optional absolute API origin. Leave unset to use the same origin (/api). */
  readonly VITE_API_URL?: string;
}
