declare module 'mammoth/mammoth.browser' {
  export interface MammothMessage {
    message: string;
    type: string;
  }

  export interface MammothResult {
    value: string;
    messages?: MammothMessage[];
  }

  export function convertToHtml(options: {
    arrayBuffer: ArrayBuffer;
  }): Promise<MammothResult>;
}

declare module 'prismjs/components/prism-markup';