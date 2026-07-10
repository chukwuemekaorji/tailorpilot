/// <reference types="chrome" />

declare module "*.css";

declare module "*.png" {
  const src: string
  export default src
}
