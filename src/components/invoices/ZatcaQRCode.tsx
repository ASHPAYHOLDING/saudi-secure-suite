import { QRCodeSVG } from "qrcode.react";
import { generateZatcaTLV, type ZatcaQRInput } from "@/lib/zatca-qr";

interface ZatcaQRCodeProps {
  sellerName: string;
  vatNumber: string;
  timestamp: string;
  invoiceTotal: number;
  vatTotal: number;
  size?: number;
}

const ZatcaQRCode = ({
  sellerName,
  vatNumber,
  timestamp,
  invoiceTotal,
  vatTotal,
  size = 96,
}: ZatcaQRCodeProps) => {
  const input: ZatcaQRInput = {
    sellerName,
    vatNumber,
    timestamp,
    invoiceTotal,
    vatTotal,
  };

  const tlvBase64 = generateZatcaTLV(input);

  return (
    <div className="inline-flex flex-col items-center gap-1.5">
      <div className="rounded-lg border border-border bg-white p-2">
        <QRCodeSVG
          value={tlvBase64}
          size={size}
          level="M"
          includeMargin={false}
        />
      </div>
      <p className="text-[8px] text-muted-foreground font-english text-center leading-tight max-w-[120px]">
        ZATCA TLV Compliant
      </p>
    </div>
  );
};

export default ZatcaQRCode;
