/// <reference types="vite/client" />

// Spelled out so a typo in a variable name is a build error rather than
// undefined at runtime. All four are optional: the app runs without them, on
// the sample campus, with sign in switched off.
interface ImportMetaEnv {
  readonly VITE_FIREBASE_API_KEY?: string
  readonly VITE_FIREBASE_AUTH_DOMAIN?: string
  readonly VITE_FIREBASE_PROJECT_ID?: string
  readonly VITE_FIREBASE_APP_ID?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
