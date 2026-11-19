declare module 'png-chunks-extract' {
  export interface Chunk {
    name: string;
    data: Uint8Array;
  }
  export default function extract(data: Uint8Array): Chunk[];
}

declare module 'png-chunks-encode' {
  export interface Chunk {
    name: string;
    data: Uint8Array;
  }
  export default function encode(chunks: Chunk[]): Uint8Array;
}
