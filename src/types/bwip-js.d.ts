declare module "bwip-js" {
  export interface ToCanvasOptions {
    bcid: string;
    text: string;
    scale?: number;
    height?: number;
    includetext?: boolean;
    textxalign?: string;
    [key: string]: any;
  }

  export function toCanvas(
    canvas: HTMLCanvasElement | string,
    opts: ToCanvasOptions
  ): HTMLCanvasElement;

  const bwipjs: {
    toCanvas(
      canvas: HTMLCanvasElement | string,
      opts: ToCanvasOptions
    ): HTMLCanvasElement;
    [key: string]: any;
  };

  export default bwipjs;
}
