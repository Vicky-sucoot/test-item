// 從文字型 PDF 擷取文字，依座標重建行（掃描影像 PDF 無文字層，會擷取不到內容）
import { getDocumentProxy } from "unpdf";

interface TextItemLike {
  str: string;
  transform: number[];
  hasEOL?: boolean;
}

export async function extractPdfText(data: Uint8Array): Promise<{ text: string; pages: number }> {
  const pdf = await getDocumentProxy(data);
  const pageTexts: string[] = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    let line = "";
    let lastY: number | null = null;
    const lines: string[] = [];
    for (const raw of content.items as unknown[]) {
      const it = raw as TextItemLike;
      if (typeof it.str !== "string") continue;
      const y = it.transform?.[5] ?? 0;
      if (lastY !== null && Math.abs(y - lastY) > 2 && line) {
        lines.push(line);
        line = "";
      }
      line += it.str;
      lastY = y;
      if (it.hasEOL) {
        lines.push(line);
        line = "";
        lastY = null;
      }
    }
    if (line) lines.push(line);
    pageTexts.push(lines.map((l) => l.trimEnd()).join("\n"));
  }
  return { text: pageTexts.join("\n"), pages: pdf.numPages };
}
