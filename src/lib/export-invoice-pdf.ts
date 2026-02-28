/**
 * High-fidelity PDF export using html2canvas + jsPDF.
 * Produces crisp, centered A4 output identical across Chrome/Safari/Windows/Mac.
 */
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * Export an invoice element to a downloaded PDF file.
 * @param element - The invoice content DOM element (not the page wrapper)
 * @param filename - Output filename (without .pdf extension)
 */
export async function exportInvoicePdf(
  element: HTMLElement,
  filename = "invoice"
): Promise<void> {
  // 1) Enter export mode — stabilise layout
  document.body.classList.add("pdf-export-mode");
  element.classList.add("pdf-export-target");

  // 2) Wait for Arabic fonts + two animation frames to settle
  await document.fonts.ready;
  // Double rAF ensures browser has fully shaped Arabic glyphs with loaded fonts
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // Extra tick for Safari font rendering
  await new Promise((r) => setTimeout(r, 200));

  try {
    // 3) Capture at high resolution
    const scale = Math.max(window.devicePixelRatio || 1, 3);

    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      backgroundColor: "#ffffff",
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
      removeContainer: true,
      logging: false,
      // Ensure no ancestor transforms interfere
      onclone: (clonedDoc) => {
        const clonedEl = clonedDoc.body.querySelector(".pdf-export-target");
        if (clonedEl instanceof HTMLElement) {
          // Remove any transforms on ancestors
          let parent = clonedEl.parentElement;
          while (parent) {
            parent.style.transform = "none";
            parent.style.position = "static";
            parent = parent.parentElement;
          }
        }
      },
    });

    // 4) Create PDF with precise A4 dimensions
    const pdf = new jsPDF({ orientation: "p", unit: "mm", format: "a4" });

    const imgWidth = A4_WIDTH_MM;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let position = 0;
    let heightLeft = imgHeight;

    // First page
    pdf.addImage(
      canvas.toDataURL("image/png"),
      "PNG",
      0,
      position,
      imgWidth,
      imgHeight,
      undefined,
      "FAST"
    );
    heightLeft -= A4_HEIGHT_MM;

    // Additional pages if content exceeds A4 height
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(
        canvas.toDataURL("image/png"),
        "PNG",
        0,
        position,
        imgWidth,
        imgHeight,
        undefined,
        "FAST"
      );
      heightLeft -= A4_HEIGHT_MM;
    }

    pdf.save(`${filename}.pdf`);
  } finally {
    // 5) Clean up export mode
    document.body.classList.remove("pdf-export-mode");
    element.classList.remove("pdf-export-target");
  }
}
