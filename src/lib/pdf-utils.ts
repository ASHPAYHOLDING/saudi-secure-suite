/**
 * Robust PDF generation utility for Arabic RTL documents.
 * Uses A4 mm-based layout for cross-browser print consistency.
 */

const PDF_STYLES = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');

*, *::before, *::after {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html {
  direction: rtl;
  -webkit-text-size-adjust: 100%;
}

body {
  font-family: 'IBM Plex Sans Arabic', 'Arial', sans-serif;
  direction: rtl;
  color: #1a1a2e;
  background: white;
  line-height: 1.6;
  font-size: 12px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* A4 page setup — consistent across all browsers */
@page {
  size: A4;
  margin: 12mm;
}

/* Print rules */
@media print {
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
    background: white !important;
  }
  body { padding: 0 !important; margin: 0 !important; }

  .invoice-page {
    width: auto !important;
    min-height: auto !important;
    margin: 0 !important;
    border: none !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    background: white !important;
  }
  .invoice-content {
    padding: 0 !important;
    max-width: none !important;
  }
}

/* Screen preview */
@media screen {
  body {
    padding: 0;
    margin: 0;
    display: flex;
    justify-content: center;
  }
}

/* English / numeric text */
.font-english, [dir="ltr"], .num {
  font-family: 'Inter', 'Arial', sans-serif;
  direction: ltr;
  unicode-bidi: embed;
}

/* Prevent Arabic text from breaking mid-word */
p, td, th, span, li, div {
  word-break: keep-all;
  overflow-wrap: break-word;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  page-break-inside: auto;
}
tr { page-break-inside: avoid; }
th, td {
  text-align: right;
  padding: 9px 14px;
  font-size: 11px;
  vertical-align: middle;
}

/* Page-break safety */
h1, h2, h3, h4 { page-break-after: avoid; page-break-inside: avoid; }
.break-avoid { break-inside: avoid; page-break-inside: avoid; }

img { max-width: 100%; height: auto; }
`;

interface PrintDocumentOptions {
  title: string;
  extraStyles?: string;
  brandFont?: string;
  onAfterPrint?: () => void;
}

/**
 * Opens a print-optimized window with proper Arabic font rendering.
 */
export const printDocument = (
  contentEl: HTMLElement,
  options: PrintDocumentOptions
): void => {
  const { title, extraStyles = "", brandFont, onAfterPrint } = options;
  const fontFamily = brandFont || "IBM Plex Sans Arabic";
  const clonedContent = contentEl.cloneNode(true) as HTMLElement;

  // Resolve computed styles so they survive the print window
  const resolveStyles = (el: HTMLElement) => {
    const computed = window.getComputedStyle(el);

    const color = computed.color;
    const bgColor = computed.backgroundColor;
    const borderColor = computed.borderColor;
    if (color && color !== 'rgba(0, 0, 0, 0)') el.style.color = color;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') el.style.backgroundColor = bgColor;
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') el.style.borderColor = borderColor;

    const layoutProps = [
      'display', 'flexDirection', 'flexWrap', 'alignItems', 'justifyContent',
      'gap', 'rowGap', 'columnGap',
      'gridTemplateColumns', 'gridTemplateRows', 'gridColumn', 'gridRow',
      'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
      'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
      'width', 'maxWidth', 'minWidth', 'height', 'maxHeight', 'minHeight',
      'borderRadius', 'borderWidth', 'borderStyle',
      'overflow', 'textAlign', 'fontSize', 'fontWeight', 'lineHeight',
      'letterSpacing', 'opacity', 'position',
      'flex', 'flexGrow', 'flexShrink', 'flexBasis',
      'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
      'borderTopStyle', 'borderBottomStyle', 'borderLeftStyle', 'borderRightStyle',
      'borderTopColor', 'borderBottomColor', 'borderLeftColor', 'borderRightColor',
    ] as const;

    for (const prop of layoutProps) {
      const val = computed[prop as any];
      if (val && val !== '' && val !== 'normal' && val !== 'none' && val !== 'auto' && val !== '0px') {
        (el.style as any)[prop] = val;
      }
    }

    const display = computed.display;
    if (display) el.style.display = display;

    Array.from(el.children).forEach((child) => {
      if (child instanceof HTMLElement) resolveStyles(child);
    });
  };

  resolveStyles(clonedContent);

  // Strip Tailwind classes
  const stripClasses = (el: HTMLElement) => {
    el.removeAttribute('class');
    Array.from(el.children).forEach((child) => {
      if (child instanceof HTMLElement) stripClasses(child);
    });
  };
  stripClasses(clonedContent);

  const htmlContent = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontFamily).replace(/%20/g, '+')}:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>${PDF_STYLES.replace(/IBM Plex Sans Arabic/g, fontFamily)}\n${extraStyles}</style>
</head>
<body>${clonedContent.innerHTML}</body>
</html>`;

  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    printViaIframe(htmlContent, onAfterPrint);
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
    if (onAfterPrint) {
      printWindow.addEventListener("afterprint", onAfterPrint);
    }
  };

  if (printWindow.document.fonts) {
    printWindow.document.fonts.ready.then(() => setTimeout(triggerPrint, 300));
  } else {
    setTimeout(triggerPrint, 1200);
  }
};

const printViaIframe = (htmlContent: string, onAfterPrint?: () => void): void => {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "-10000px";
  iframe.style.left = "-10000px";
  iframe.style.width = "210mm";
  iframe.style.height = "297mm";
  iframe.style.border = "none";
  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!iframeDoc) return;

  iframeDoc.open();
  iframeDoc.write(htmlContent);
  iframeDoc.close();

  const trigger = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      document.body.removeChild(iframe);
      onAfterPrint?.();
    }, 1000);
  };

  if (iframeDoc.fonts) {
    iframeDoc.fonts.ready.then(() => setTimeout(trigger, 300));
  } else {
    setTimeout(trigger, 1200);
  }
};

export const INVOICE_PRINT_STYLES = `
/* Stripe-style minimal invoice — A4 print */
@page { size: A4; margin: 12mm; }

body {
  padding: 0 !important;
  margin: 0 !important;
  background: #fff !important;
  line-height: 1.6;
}

table { width: 100%; border-collapse: collapse; }
th {
  font-weight: 600;
  font-size: 10px;
  letter-spacing: 0.03em;
  background: rgba(15, 23, 42, 0.03) !important;
  color: #374151 !important;
  border-bottom: 1px solid rgba(15, 23, 42, 0.1);
  padding: 9px 14px;
}
td {
  padding: 9px 14px;
  font-size: 11px;
  border-bottom: 1px solid rgba(15, 23, 42, 0.06);
}
tbody tr:last-child td { border-bottom: none; }

img, svg { max-width: 100%; height: auto; }

.break-avoid { break-inside: avoid; page-break-inside: avoid; }

@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

export const CONTRACT_PRINT_STYLES = `
.contract-body h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.contract-body h3 { font-size: 14px; font-weight: 600; margin-top: 18px; margin-bottom: 6px; }
.contract-body p { margin-bottom: 8px; line-height: 1.9; }
.contract-body strong { font-weight: 600; }
`;
