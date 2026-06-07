declare module "pdf-parse/lib/pdf-parse.js" {
  import pdfParse from "pdf-parse";
  export default pdfParse;
}

declare module "pdf-parse" {
  interface PdfData {
    numpages: number;
    numrender: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
    text: string;
    version: string;
  }

  interface PdfOptions {
    pagerender?: (pageData: unknown) => Promise<string>;
    max?: number;
    version?: string;
  }

  function pdfParse(dataBuffer: Buffer, options?: PdfOptions): Promise<PdfData>;
  export default pdfParse;
}
