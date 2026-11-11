import type { jsPDF } from "jspdf";

const FONT_FAMILY = "FactoryKorean";
let loading: Promise<[string, string]> | undefined;

async function readFont(style: "Regular" | "Bold"): Promise<string> {
  const response = await fetch(
    `${import.meta.env.BASE_URL}fonts/FactoryKorean-${style}.ttf`,
  );
  if (!response.ok)
    throw new Error(
      "PDF 한글 글꼴을 불러오지 못했습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.",
    );
  const bytes = new Uint8Array(await response.arrayBuffer());
  const chunks: string[] = [];
  for (let offset = 0; offset < bytes.length; offset += 32768)
    chunks.push(String.fromCharCode(...bytes.subarray(offset, offset + 32768)));
  return btoa(chunks.join(""));
}

/** Fonts are loaded from this deployment only when the user exports a PDF. */
export async function registerReportFonts(doc: jsPDF): Promise<void> {
  loading ??= Promise.all([readFont("Regular"), readFont("Bold")]).catch(
    (error) => {
      loading = undefined;
      throw error;
    },
  );
  const [regular, bold] = await loading;
  doc.addFileToVFS("FactoryKorean-Regular.ttf", regular);
  doc.addFont("FactoryKorean-Regular.ttf", FONT_FAMILY, "normal");
  doc.addFileToVFS("FactoryKorean-Bold.ttf", bold);
  doc.addFont("FactoryKorean-Bold.ttf", FONT_FAMILY, "bold");
  doc.setFont(FONT_FAMILY, "normal");
}
