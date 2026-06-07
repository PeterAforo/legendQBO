/**
 * Custom PDF text extraction that preserves column spacing.
 * pdf-parse v1's default renderer concatenates text items without spaces,
 * losing the critical gap between description and amount columns.
 * This custom renderer inserts a space when there's a gap > 2px between items.
 */

interface TextItem {
  str: string;
  transform: number[];
  width: number;
}

interface TextContent {
  items: TextItem[];
}

interface PageData {
  getTextContent(options: { normalizeWhitespace: boolean; disableCombineTextItems: boolean }): Promise<TextContent>;
}

function spacedPageRender(pageData: PageData): Promise<string> {
  return pageData
    .getTextContent({ normalizeWhitespace: false, disableCombineTextItems: true })
    .then((tc: TextContent) => {
      let lastY: number | undefined;
      let lastX = 0;
      let lastW = 0;
      let text = "";

      for (const item of tc.items) {
        const x = item.transform[4];
        const y = item.transform[5];
        const w = item.width;

        if (lastY !== undefined && lastY !== y) {
          text += "\n";
          lastX = 0;
          lastW = 0;
        } else if (lastX > 0) {
          const gap = x - (lastX + lastW);
          if (gap > 2) text += " ";
        }

        text += item.str;
        lastY = y;
        lastX = x;
        lastW = w;
      }

      return text;
    });
}

export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
  // Import the inner lib directly to avoid pdf-parse's debug auto-run
  // which tries to read a test file when module.parent is undefined (ESM)
  const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default ?? (await import("pdf-parse/lib/pdf-parse.js"));
  const data = await pdfParse(buffer, { pagerender: spacedPageRender as unknown as (pageData: unknown) => Promise<string> });
  return data.text;
}
