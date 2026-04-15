import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MARGIN_MM = 15;
const CONTENT_WIDTH_MM = A4_WIDTH_MM - MARGIN_MM * 2;
const SECTION_GAP_MM = 4;

/**
 * Generates a PDF from an HTML string using section-based capture
 * to prevent content from being cut off at page boundaries.
 */
export async function generatePDFFromHTML(html: string, filename: string) {
  // Create a hidden container
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = '800px';
  container.style.background = '#fff';
  container.style.zIndex = '-1';
  container.innerHTML = html;
  document.body.appendChild(container);

  // Wait for rendering
  await new Promise(r => setTimeout(r, 300));

  try {
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Find sections marked with data-pdf-section, or fall back to direct children
    let sections = Array.from(
      container.querySelectorAll('[data-pdf-section]')
    ) as HTMLElement[];

    if (sections.length === 0) {
      // Fall back to top-level children as sections
      sections = Array.from(container.children) as HTMLElement[];
    }

    if (sections.length === 0) {
      // Ultimate fallback: capture entire container
      sections = [container];
    }

    let currentY = MARGIN_MM;
    let isFirstPage = true;

    for (const section of sections) {
      const canvas = await html2canvas(section, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
      });

      const scaleFactor = CONTENT_WIDTH_MM / (canvas.width / 2);
      const heightMM = (canvas.height / 2) * scaleFactor;
      const remainingSpace = A4_HEIGHT_MM - MARGIN_MM - currentY;

      // If section doesn't fit and we're not at the top of a page, add a new page
      if (heightMM > remainingSpace && currentY > MARGIN_MM) {
        pdf.addPage();
        currentY = MARGIN_MM;
        isFirstPage = false;
      }

      // If a single section is taller than a page, split it into strips
      if (heightMM > A4_HEIGHT_MM - MARGIN_MM * 2) {
        const usableHeight = A4_HEIGHT_MM - MARGIN_MM * 2;
        const stripHeightPx = (usableHeight / scaleFactor) * 2; // in canvas pixels
        let canvasOffset = 0;
        let remainingCanvasHeight = canvas.height;

        while (remainingCanvasHeight > 0) {
          const thisStripHeight = Math.min(stripHeightPx, remainingCanvasHeight);
          const thisStripMM = (thisStripHeight / 2) * scaleFactor;

          // Create a sub-canvas for this strip
          const stripCanvas = document.createElement('canvas');
          stripCanvas.width = canvas.width;
          stripCanvas.height = thisStripHeight;
          const ctx = stripCanvas.getContext('2d')!;
          ctx.drawImage(canvas, 0, canvasOffset, canvas.width, thisStripHeight, 0, 0, canvas.width, thisStripHeight);

          if (currentY > MARGIN_MM && thisStripMM > A4_HEIGHT_MM - MARGIN_MM - currentY) {
            pdf.addPage();
            currentY = MARGIN_MM;
          }

          const imgData = stripCanvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', MARGIN_MM, currentY, CONTENT_WIDTH_MM, thisStripMM);
          currentY += thisStripMM;

          canvasOffset += thisStripHeight;
          remainingCanvasHeight -= thisStripHeight;

          if (remainingCanvasHeight > 0) {
            pdf.addPage();
            currentY = MARGIN_MM;
          }
        }
      } else {
        const imgData = canvas.toDataURL('image/png');
        pdf.addImage(imgData, 'PNG', MARGIN_MM, currentY, CONTENT_WIDTH_MM, heightMM);
        currentY += heightMM + SECTION_GAP_MM;
      }
    }

    pdf.save(filename);
  } finally {
    document.body.removeChild(container);
  }
}

/**
 * Opens a print dialog from an HTML string.
 */
export function printHTML(html: string) {
  const w = window.open('', '_blank');
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.onload = () => { w.print(); };
}
