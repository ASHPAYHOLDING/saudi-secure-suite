/**
 * ZATCA-compliant TLV (Tag-Length-Value) encoder for QR codes.
 * Encodes invoice data per ZATCA e-invoicing standard (Phase 1 & 2).
 *
 * TLV Tags:
 *   1 - Seller Name
 *   2 - VAT Registration Number
 *   3 - Timestamp (ISO 8601)
 *   4 - Invoice Total (with VAT)
 *   5 - VAT Total
 */

/** Encode a single TLV field */
function encodeTLV(tag: number, value: string): Uint8Array {
  const encoder = new TextEncoder();
  const valueBytes = encoder.encode(value);
  const tlv = new Uint8Array(2 + valueBytes.length);
  tlv[0] = tag;
  tlv[1] = valueBytes.length;
  tlv.set(valueBytes, 2);
  return tlv;
}

/** Concatenate multiple Uint8Arrays */
function concatBytes(arrays: Uint8Array[]): Uint8Array {
  const totalLength = arrays.reduce((sum, arr) => sum + arr.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of arrays) {
    result.set(arr, offset);
    offset += arr.length;
  }
  return result;
}

/** Convert Uint8Array to base64 string */
function uint8ToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export interface ZatcaQRInput {
  sellerName: string;
  vatNumber: string;
  timestamp: string; // ISO 8601 format
  invoiceTotal: number;
  vatTotal: number;
}

/**
 * Generate a ZATCA-compliant TLV-encoded base64 string for QR code generation.
 */
export function generateZatcaTLV(input: ZatcaQRInput): string {
  const fields = [
    encodeTLV(1, input.sellerName),
    encodeTLV(2, input.vatNumber),
    encodeTLV(3, input.timestamp),
    encodeTLV(4, input.invoiceTotal.toFixed(2)),
    encodeTLV(5, input.vatTotal.toFixed(2)),
  ];
  return uint8ToBase64(concatBytes(fields));
}

/**
 * Decode a ZATCA TLV base64 string back to fields (for verification).
 */
export function decodeZatcaTLV(base64: string): Record<number, string> {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  const decoder = new TextDecoder();
  const result: Record<number, string> = {};
  let offset = 0;

  while (offset < bytes.length) {
    const tag = bytes[offset];
    const length = bytes[offset + 1];
    const value = decoder.decode(bytes.slice(offset + 2, offset + 2 + length));
    result[tag] = value;
    offset += 2 + length;
  }

  return result;
}
