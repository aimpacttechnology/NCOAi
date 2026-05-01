import jsPDF from 'jspdf';

export type PDFDocType = 'counseling' | 'ncoer' | 'development-plan' | 'mentorship';

interface ExportOptions {
  type: PDFDocType;
  soldier: { name: string; rank: string };
  subtitle?: string;
  date?: string;
  content: string;
  filename?: string;
}

const DOC_HEADERS: Record<PDFDocType, string> = {
  'counseling':        'DA FORM 4856 — DEVELOPMENTAL COUNSELING FORM',
  'ncoer':             'DA FORM 2166-9 — NCOER EVALUATION BULLETS',
  'development-plan':  'INDIVIDUAL DEVELOPMENT PLAN',
  'mentorship':        'MENTORSHIP SESSION RECORD',
};

export function exportToPDF(opts: ExportOptions) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'letter' });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginBottom = 18;
  const contentW = pageW - marginX * 2;
  let y = 18;

  const addPage = () => {
    doc.addPage();
    y = 18;
    drawPageFooter();
  };

  const checkY = (needed = 8) => {
    if (y + needed > pageH - marginBottom) addPage();
  };

  const drawPageFooter = () => {
    const n = doc.getNumberOfPages();
    doc.setPage(n);
    doc.setFont('courier', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(130);
    doc.text('NCO.AI — Leadership Platform', marginX, pageH - 8);
    doc.text(`Page ${n}`, pageW - marginX, pageH - 8, { align: 'right' });
    doc.setTextColor(0);
  };

  // ── Cover block ────────────────────────────────────────────────────────────
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.text(DOC_HEADERS[opts.type], pageW / 2, y, { align: 'center' });
  y += 6;

  if (opts.subtitle) {
    doc.setFont('courier', 'normal');
    doc.setFontSize(9);
    doc.text(opts.subtitle, pageW / 2, y, { align: 'center' });
    y += 5;
  }

  doc.setDrawColor(180);
  doc.line(marginX, y, pageW - marginX, y);
  y += 5;

  doc.setFontSize(9);
  doc.setFont('courier', 'bold');
  doc.text(`SOLDIER:`, marginX, y);
  doc.setFont('courier', 'normal');
  doc.text(`${opts.soldier.rank} ${opts.soldier.name}`, marginX + 22, y);
  const dateStr = opts.date ?? new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  doc.text(`DATE: ${dateStr}`, pageW - marginX, y, { align: 'right' });
  y += 4;

  doc.setDrawColor(180);
  doc.line(marginX, y, pageW - marginX, y);
  y += 8;

  drawPageFooter();

  // ── Body ───────────────────────────────────────────────────────────────────
  const lines = opts.content.split('\n');

  for (const raw of lines) {
    const line = raw.trimEnd();

    // Section header  ##
    if (line.startsWith('## ') || line.startsWith('# ')) {
      checkY(10);
      y += 2;
      doc.setFont('courier', 'bold');
      doc.setFontSize(10);
      const text = line.replace(/^#+\s/, '').toUpperCase();
      doc.text(text, marginX, y);
      y += 2;
      doc.setDrawColor(200);
      doc.line(marginX, y, pageW - marginX, y);
      y += 5;
      doc.setFont('courier', 'normal');
      doc.setFontSize(9);
      continue;
    }

    // Bold line  **text**
    if (/^\*\*[^*]+\*\*$/.test(line)) {
      checkY(6);
      doc.setFont('courier', 'bold');
      doc.setFontSize(9);
      doc.text(line.replace(/\*\*/g, ''), marginX, y);
      y += 5;
      doc.setFont('courier', 'normal');
      continue;
    }

    // Blank line
    if (line.trim() === '') {
      y += 3;
      continue;
    }

    // Bullet line •
    const isBullet = line.startsWith('• ') || line.startsWith('- ');
    const indent = isBullet ? marginX + 4 : marginX;
    const text = isBullet ? line.replace(/^[•\-]\s/, '') : line;
    const wrapped = doc.splitTextToSize(text, contentW - (isBullet ? 4 : 0));

    checkY(wrapped.length * 5 + 2);
    if (isBullet) {
      doc.setFont('courier', 'normal');
      doc.text('•', marginX, y);
    }
    doc.text(wrapped, indent, y);
    y += wrapped.length * 5;
  }

  // Signature block for counseling
  if (opts.type === 'counseling') {
    checkY(35);
    y += 8;
    doc.setDrawColor(180);
    doc.line(marginX, y, pageW - marginX, y);
    y += 6;
    doc.setFont('courier', 'bold');
    doc.setFontSize(8);
    doc.text('LEADER SIGNATURE:', marginX, y);
    doc.text('DATE:', pageW / 2 + 10, y);
    y += 10;
    doc.line(marginX, y, pageW / 2 - 10, y);
    doc.line(pageW / 2 + 10, y, pageW - marginX, y);
    y += 8;
    doc.text('SOLDIER SIGNATURE:', marginX, y);
    doc.text('DATE:', pageW / 2 + 10, y);
    y += 10;
    doc.line(marginX, y, pageW / 2 - 10, y);
    doc.line(pageW / 2 + 10, y, pageW - marginX, y);
  }

  const name = opts.filename
    ?? `${opts.type}-${opts.soldier.name.replace(/[,\s]+/g, '-')}-${new Date().toISOString().split('T')[0]}`;
  doc.save(`${name}.pdf`);
}
