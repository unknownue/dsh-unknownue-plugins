/**
 * Global type declarations for the dsh-unknownue-plugins client.
 */

interface Window {
  monaco?: any;
  require?: any;
  __ModuleLoader__?: {
    load(config: { id: string; factory: (require: (id: string) => any) => any }): void;
  };
}

// CSS imports via esbuild text loader
declare module "*.css" {
  const content: string;
  export default content;
}
