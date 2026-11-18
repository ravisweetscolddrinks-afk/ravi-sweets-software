// Pure ISO/IEC 15417 Code 128B Barcode Encoder & TSPL Label Printer Command Builder
// Supports all printable ASCII characters (32-126), including digits, letters, and '*'

// Standard 107 Code 128 patterns (values 0..105 have 6 alternating bar/space widths summing to 11;
// value 106 is STOP with 7 alternating bar/space widths summing to 13)
const CODE128_PATTERNS: readonly string[] = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213", // 0-9
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132", // 10-19
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211", // 20-29
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313", // 30-39
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331", // 40-49
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111", // 50-59
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214", // 60-69
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111", // 70-79
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141", // 80-89
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141", // 90-99
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112",                              // 100-106
];

const START_B = 104;
const STOP_CODE = 106;

export interface Code128Bar {
  x: number;
  width: number;
}

export interface Code128Result {
  bars: Code128Bar[];
  totalModules: number;
  sanitizedText: string;
}

/**
 * Encodes an ASCII string (32..126) into ISO/IEC 15417 Code 128B vector bar positions.
 */
export function encodeCode128B(input: string, quietZoneModules: number = 10): Code128Result {
  // Keep only printable ASCII characters supported by Code 128B (32..126)
  const sanitizedText = (input || "")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126;
    })
    .join("");

  if (!sanitizedText) {
    return { bars: [], totalModules: 0, sanitizedText: "" };
  }

  const codes: number[] = [START_B];
  let checksum = START_B;

  for (let i = 0; i < sanitizedText.length; i++) {
    const val = sanitizedText.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }

  codes.push(checksum % 103);
  codes.push(STOP_CODE);

  const bars: Code128Bar[] = [];
  let cursor = quietZoneModules;

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code];
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      // Even indices (0, 2, 4, 6) are black bars; odd indices (1, 3, 5) are white spaces
      if (j % 2 === 0) {
        bars.push({ x: cursor, width });
      }
      cursor += width;
    }
  }

  const totalModules = cursor + quietZoneModules;
  return { bars, totalModules, sanitizedText };
}

export interface BarcodeLabelPrintItem {
  headerText: string;
  productName: string;
  packText: string; // e.g. "250g" or "1 KG" or "4 pcs"
  barcodeValue: string; // e.g. "1001*250" or "2005*4"
  amount: number;
  copies: number;
}

export interface LabelSpec {
  widthMm: number;      // single sticker width in mm (e.g. 50)
  heightMm: number;     // single sticker height in mm (e.g. 25)
  columns: 1 | 2;       // 1-up or 2-up roll
  gapMm: number;        // vertical gap between rows in mm (default 3)
  colGapMm: number;     // horizontal gap between columns for 2-up (default 2)
  dpi: 203 | 300;       // thermal barcode printer DPI (203 = 8 dots/mm, 300 = 12 dots/mm)
}

function escapeTspl(str: string): string {
  return (str || "").replace(/"/g, "'").replace(/[\r\n]/g, " ").trim();
}

/**
 * Generates raw TSPL commands for direct USB thermal barcode printers
 * (TSC TE244 / TTP-244, TVS LP-46, Rugtek, Xprinter, GoDEX, etc.)
 */
export function buildTsplBuffer(items: BarcodeLabelPrintItem[], spec: LabelSpec): Uint8Array {
  const dpmm = spec.dpi === 300 ? 12 : 8; // dots per mm
  const singleW = Math.round(spec.widthMm * dpmm);
  const singleH = Math.round(spec.heightMm * dpmm);
  const colGapDots = Math.round(spec.colGapMm * dpmm);
  const totalRollWidthMm =
    spec.columns === 2 ? spec.widthMm * 2 + spec.colGapMm : spec.widthMm;

  // Expand copies into individual stickers
  const expanded: BarcodeLabelPrintItem[] = [];
  for (const item of items) {
    const count = Math.max(1, Math.min(500, Math.floor(item.copies || 1)));
    for (let i = 0; i < count; i++) {
      expanded.push(item);
    }
  }

  const lines: string[] = [];
  lines.push(`SIZE ${totalRollWidthMm} mm, ${spec.heightMm} mm`);
  lines.push(`GAP ${spec.gapMm} mm, 0 mm`);
  lines.push("SPEED 4");
  lines.push("DENSITY 10");
  lines.push("DIRECTION 1");
  lines.push("REFERENCE 0,0");

  const drawSticker = (sticker: BarcodeLabelPrintItem, offsetX: number) => {
    const padX = Math.round(2 * dpmm);
    const usableW = singleW - padX * 2;
    const header = escapeTspl(sticker.headerText || "RAVI SWEETS AND COOL DRINKS");
    const prodLabel = escapeTspl(`${sticker.productName} (${sticker.packText})`).slice(0, 34);
    const code = escapeTspl(sticker.barcodeValue);
    const amtText = `Rs. ${Number(sticker.amount).toFixed(2)}`;

    // Vertical layout scaled proportionally to sticker height
    const yHeader = Math.round(1.5 * dpmm);
    const yProd = Math.round(5.0 * dpmm);
    const yBarcode = Math.round(8.5 * dpmm);
    const barcodeH = Math.max(Math.round(7.5 * dpmm), Math.round(singleH * 0.34));
    const yAmount = Math.min(singleH - Math.round(4.5 * dpmm), yBarcode + barcodeH + Math.round(4.2 * dpmm));

    // Narrow bar width (dots) tuned so Code 128 fits comfortably inside label width
    const estimatedModules = (code.length + 3) * 11 + 13;
    const narrow = estimatedModules * 2 <= usableW ? 2 : 1;
    const barcodeWidthDots = estimatedModules * narrow;
    const barcodeX = offsetX + Math.max(padX, Math.floor((singleW - barcodeWidthDots) / 2));

    // Header: RAVI SWEETS AND COOL DRINKS
    lines.push(`TEXT ${offsetX + padX},${yHeader},"1",0,1,1,"${header.slice(0, 30)}"`);
    // Product Name + Weight/Qty
    lines.push(`TEXT ${offsetX + padX},${yProd},"1",0,1,1,"${prodLabel}"`);
    // Native Code 128 Barcode (readable=1 prints human-readable code below bars)
    lines.push(`BARCODE ${barcodeX},${yBarcode},"128",${barcodeH},1,0,${narrow},${narrow},"${code}"`);
    // Amount below barcode
    lines.push(`TEXT ${offsetX + padX},${yAmount},"2",0,1,1,"Amount: ${amtText}"`);
  };

  for (let i = 0; i < expanded.length; i += spec.columns) {
    lines.push("CLS");
    drawSticker(expanded[i], 0);
    if (spec.columns === 2 && expanded[i + 1]) {
      drawSticker(expanded[i + 1], singleW + colGapDots);
    }
    lines.push("PRINT 1,1");
  }

  const payload = lines.join("\r\n") + "\r\n";
  return new TextEncoder().encode(payload);
}

