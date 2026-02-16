/**
 * DigitalStamp — renders the company's digital stamp for invoices/documents.
 * Read-only display component; non-editable by employees.
 */
interface StampData {
  companyName: string;
  crNumber: string;
  vatNumber?: string;
  imageUrl?: string;
  enabled: boolean;
}

interface DigitalStampProps {
  stamp?: StampData | null;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: { outer: 100, inner: 80, text: 7, gap: 2 },
  md: { outer: 140, inner: 112, text: 9, gap: 3 },
  lg: { outer: 180, inner: 144, text: 11, gap: 4 },
};

const DigitalStamp = ({ stamp, size = "md" }: DigitalStampProps) => {
  if (!stamp || !stamp.enabled) return null;

  const s = sizeMap[size];

  // If there's a custom uploaded stamp image, render it
  if (stamp.imageUrl) {
    return (
      <div className="flex flex-col items-center gap-2">
        <img
          src={stamp.imageUrl}
          alt="ختم الشركة"
          style={{ width: s.outer, height: s.outer, objectFit: 'contain' }}
          className="opacity-80 pointer-events-none select-none"
          draggable={false}
        />
        <p style={{ fontSize: s.text - 1 }} className="text-muted-foreground text-center">
          ختم إلكتروني معتمد
        </p>
      </div>
    );
  }

  // Generated digital stamp (circular design)
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative flex items-center justify-center rounded-full select-none pointer-events-none"
        style={{
          width: s.outer,
          height: s.outer,
          border: `3px double hsl(220 30% 14%)`,
          opacity: 0.75,
        }}
      >
        {/* Inner circle */}
        <div
          className="absolute rounded-full"
          style={{
            width: s.inner,
            height: s.inner,
            border: `1.5px solid hsl(220 30% 14%)`,
          }}
        />
        {/* Company name - curved top */}
        <div className="absolute flex flex-col items-center justify-center text-center px-3" style={{ width: s.inner - 8 }}>
          <p
            className="font-bold leading-tight"
            style={{
              fontSize: s.text + 1,
              color: 'hsl(220 30% 14%)',
              lineHeight: 1.3,
            }}
          >
            {stamp.companyName}
          </p>
          <div
            className="my-1 w-3/4"
            style={{ height: 1, background: 'hsl(220 30% 14% / 0.3)' }}
          />
          <p
            className="font-english"
            style={{
              fontSize: s.text - 1,
              color: 'hsl(220 30% 14% / 0.7)',
              direction: 'ltr',
            }}
          >
            س.ت: {stamp.crNumber}
          </p>
          {stamp.vatNumber && (
            <p
              className="font-english"
              style={{
                fontSize: s.text - 2,
                color: 'hsl(220 30% 14% / 0.6)',
                direction: 'ltr',
              }}
            >
              ض: {stamp.vatNumber}
            </p>
          )}
        </div>
        {/* Star decoration */}
        <div
          className="absolute"
          style={{
            bottom: s.gap + 6,
            fontSize: s.text - 1,
            color: 'hsl(172 66% 36%)',
          }}
        >
          ★
        </div>
      </div>
      <p style={{ fontSize: s.text - 2 }} className="text-muted-foreground text-center">
        ختم إلكتروني معتمد
      </p>
    </div>
  );
};

export default DigitalStamp;
export type { StampData };
