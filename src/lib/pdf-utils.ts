/**
 * Robust PDF generation utility for Arabic RTL documents.
 * Handles font preloading, pixel-perfect layout, and mobile-friendly printing.
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
  line-height: 1.7;
  font-size: 13px;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Page setup */
@page {
  size: A4;
  margin: 12mm 15mm 15mm 15mm;
}

/* Force color printing */
@media print {
  html, body {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }
  body {
    padding: 0;
  }
}

/* Screen preview padding */
@media screen {
  body {
    padding: 24px;
    max-width: 210mm;
    margin: 0 auto;
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
  word-wrap: break-word;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  page-break-inside: auto;
}

tr {
  page-break-inside: avoid;
  page-break-after: auto;
}

th, td {
  text-align: right;
  padding: 10px 14px;
  font-size: 12px;
  vertical-align: middle;
}

/* Headings shouldn't orphan */
h1, h2, h3, h4 {
  page-break-after: avoid;
  page-break-inside: avoid;
}

/* Signature blocks stay together */
.signature-block, .stamp-area {
  page-break-inside: avoid;
}

/* Image handling */
img {
  max-width: 100%;
  height: auto;
  image-rendering: -webkit-optimize-contrast;
  image-rendering: crisp-edges;
}
`;

interface PrintDocumentOptions {
  /** Document title for the print window */
  title: string;
  /** Additional CSS to inject */
  extraStyles?: string;
  /** Custom Arabic font family name */
  brandFont?: string;
  /** Callback after print dialog closes */
  onAfterPrint?: () => void;
}

/**
 * Opens a print-optimized window with proper Arabic font rendering.
 * Waits for fonts to load before triggering print.
 */
export const printDocument = (
  contentEl: HTMLElement,
  options: PrintDocumentOptions
): void => {
  const { title, extraStyles = "", brandFont, onAfterPrint } = options;
  const fontFamily = brandFont || "IBM Plex Sans Arabic";
  // Clone content to avoid modifying the original
  const clonedContent = contentEl.cloneNode(true) as HTMLElement;

  // Resolve ALL computed styles (colors + layout) so they survive the print window
  const resolveStyles = (el: HTMLElement) => {
    const computed = window.getComputedStyle(el);

    // Colors
    const color = computed.color;
    const bgColor = computed.backgroundColor;
    const borderColor = computed.borderColor;
    if (color && color !== 'rgba(0, 0, 0, 0)') el.style.color = color;
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') el.style.backgroundColor = bgColor;
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') el.style.borderColor = borderColor;

    // Layout properties that Tailwind generates
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

    // Preserve display even for flex/grid
    const display = computed.display;
    if (display) el.style.display = display;

    // Process children
    Array.from(el.children).forEach((child) => {
      if (child instanceof HTMLElement) resolveStyles(child);
    });
  };

  resolveStyles(clonedContent);

  // Remove Tailwind classes (they won't resolve in print window)
  const stripClasses = (el: HTMLElement) => {
    el.removeAttribute('class');
    Array.from(el.children).forEach((child) => {
      if (child instanceof HTMLElement) stripClasses(child);
    });
  };
  stripClasses(clonedContent);

  // Build the HTML
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
    // Fallback: try iframe approach for mobile / popup blockers
    printViaIframe(htmlContent, onAfterPrint);
    return;
  }

  printWindow.document.write(htmlContent);
  printWindow.document.close();

  // Wait for fonts + images to fully load
  const triggerPrint = () => {
    printWindow.focus();
    printWindow.print();
    if (onAfterPrint) {
      printWindow.addEventListener("afterprint", onAfterPrint);
    }
  };

  // Use document.fonts API if available, fallback to timeout
  if (printWindow.document.fonts) {
    printWindow.document.fonts.ready.then(() => {
      // Additional delay for images
      setTimeout(triggerPrint, 300);
    });
  } else {
    setTimeout(triggerPrint, 1200);
  }
};

/**
 * Fallback: print via hidden iframe (for mobile / popup-blocked browsers)
 */
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

/**
 * Extra styles for invoice documents
 */
export const INVOICE_PRINT_STYLES = `
/* Base table */
.inv-table, table { width: 100%; border-collapse: collapse; }
.inv-table th, .inv-table td, table th, table td { padding: 10px 14px; text-align: right; font-size: 12px; }
.inv-table th, table th { font-weight: 600; font-size: 11px; }
.inv-table td, table td { border-bottom: 1px solid #e5e7eb; }
.inv-table tbody tr:last-child td, table tbody tr:last-child td { border-bottom: none; }
.inv-table .num { font-family: 'Inter', monospace; direction: ltr; text-align: left; }
.summary-row td { padding: 6px 14px; font-size: 12px; }
.total-row td { font-weight: 700; font-size: 14px; padding: 12px 14px; }

/* Print-specific overrides */
body { padding: 0 !important; margin: 0 !important; }
img { max-width: 100%; height: auto; }
svg { max-width: 100%; height: auto; }

/* Page breaks */
@media print {
  * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
}
`;

/**
 * Extra styles for contract documents
 */
export const CONTRACT_PRINT_STYLES = `
.contract-body h2 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
.contract-body h3 { font-size: 14px; font-weight: 600; margin-top: 18px; margin-bottom: 6px; }
.contract-body p { margin-bottom: 8px; line-height: 1.9; }
.contract-body strong { font-weight: 600; }
`;
