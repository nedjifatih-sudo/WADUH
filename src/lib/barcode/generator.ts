import QRCode from "qrcode";
import bwipjs from "bwip-js";

/**
 * Generates a QR Code as Data URL
 */
export async function generateQRCodeDataUrl(text: string): Promise<string> {
  try {
    return await QRCode.toDataURL(text, {
      width: 256,
      margin: 2,
      color: {
        dark: "#111827",
        light: "#FFFFFF",
      },
    });
  } catch (err) {
    console.error("QR Code generation failed:", err);
    return "";
  }
}

/**
 * Generates a Code128 Barcode as Data URL via canvas
 */
export async function generateBarcodeDataUrl(
  text: string,
  bcid: string = "code128"
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      bwipjs.toCanvas(canvas, {
        bcid,
        text,
        scale: 3,
        height: 10,
        includetext: true,
        textxalign: "center",
      });
      resolve(canvas.toDataURL("image/png"));
    } catch (err) {
      console.error("Barcode generation error:", err);
      resolve("");
    }
  });
}

/**
 * Helper to generate standardized enterprise SKU and Asset Tags
 */
export function generateAutoSKU(categoryPrefix: string = "PRD"): string {
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `SKU-${categoryPrefix.toUpperCase().slice(0, 3)}-${randomNum}`;
}

export function generateAutoAssetTag(): string {
  const year = new Date().getFullYear();
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  return `AST-${year}-${randomNum}`;
}
