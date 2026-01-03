/// <reference types="vite/client" />

// Support for ReactComponent when importing SVG files
declare module "*.svg" {
  import * as React from "react";
  export const ReactComponent: React.FunctionComponent<React.SVGProps<SVGSVGElement> & { title?: string }>;
}
