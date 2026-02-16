import { describe, it, expect } from "vitest";
import { generateZatcaTLV, decodeZatcaTLV } from "@/lib/zatca-qr";

describe("ZATCA TLV Encoding", () => {
  it("encodes and decodes correctly", () => {
    const input = {
      sellerName: "شركة التقنية المتقدمة",
      vatNumber: "310123456700003",
      timestamp: "2026-02-10T00:00:00.000Z",
      invoiceTotal: 11500,
      vatTotal: 1500,
    };

    const base64 = generateZatcaTLV(input);
    expect(base64).toBeTruthy();
    expect(typeof base64).toBe("string");

    const decoded = decodeZatcaTLV(base64);
    expect(decoded[1]).toBe("شركة التقنية المتقدمة");
    expect(decoded[2]).toBe("310123456700003");
    expect(decoded[3]).toBe("2026-02-10T00:00:00.000Z");
    expect(decoded[4]).toBe("11500.00");
    expect(decoded[5]).toBe("1500.00");
  });

  it("handles different amounts correctly", () => {
    const base64 = generateZatcaTLV({
      sellerName: "Test",
      vatNumber: "123456789012345",
      timestamp: "2026-01-01T12:00:00Z",
      invoiceTotal: 100.5,
      vatTotal: 15.08,
    });

    const decoded = decodeZatcaTLV(base64);
    expect(decoded[4]).toBe("100.50");
    expect(decoded[5]).toBe("15.08");
  });
});
