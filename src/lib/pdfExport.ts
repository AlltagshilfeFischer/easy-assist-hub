import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

/**
 * Export an HTML element to PDF (A4 portrait).
 * The element is rendered to canvas and placed in the PDF.
 */
export async function exportElementToPdf(
  element: HTMLElement,
  filename: string
): Promise<void> {
  // Temporarily make element visible for rendering
  const originalDisplay = element.style.display;
  element.style.display = 'block';

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: '#ffffff',
  });

  element.style.display = originalDisplay;

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();

  const imgWidth = pdfWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  // If content fits on one page
  if (imgHeight <= pdfHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
  } else {
    // Multi-page
    let heightLeft = imgHeight;
    let position = 0;

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight;

    while (heightLeft > 0) {
      position = -(imgHeight - heightLeft);
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pdfHeight;
    }
  }

  pdf.save(filename);
}

/**
 * Export a table/report data directly to PDF using jsPDF.
 */
export function exportTableToPdf(
  headers: string[],
  rows: string[][],
  title: string,
  filename: string
): void {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();

  // Title
  pdf.setFontSize(14);
  pdf.text(title, 14, 20);

  // Date
  pdf.setFontSize(9);
  pdf.setTextColor(128);
  pdf.text(`Erstellt: ${new Date().toLocaleDateString('de-DE')}`, 14, 27);
  pdf.setTextColor(0);

  // Table
  const colWidth = (pageWidth - 28) / headers.length;
  let y = 35;
  const lineHeight = 7;

  // Header
  pdf.setFontSize(9);
  pdf.setFont('helvetica', 'bold');
  headers.forEach((h, i) => {
    pdf.text(h, 14 + i * colWidth, y);
  });
  y += 2;
  pdf.setDrawColor(200);
  pdf.line(14, y, pageWidth - 14, y);
  y += lineHeight;

  // Rows
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  for (const row of rows) {
    if (y > pdf.internal.pageSize.getHeight() - 20) {
      pdf.addPage();
      y = 20;
    }
    row.forEach((cell, i) => {
      pdf.text(String(cell), 14 + i * colWidth, y);
    });
    y += lineHeight;
  }

  pdf.save(filename);
}
