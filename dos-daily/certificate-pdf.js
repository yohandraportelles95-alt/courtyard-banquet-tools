export const certificateLogo = new URL('../assets/branding/courtyard-logo.webp', import.meta.url).href;

const width = 612;
const height = 792;
const scale = 3;
const ink = '#25352e';
const muted = '#53614e';
const rule = '#dce3d4';
const address = '1201 Raiford Road, Carrollton, TX 75007 � 972 446 0001';

function newPage() {
  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = '#aeb8a0';
  ctx.strokeRect(37, 37, 538, 718);
  ctx.strokeStyle = '#e7ebdf';
  ctx.strokeRect(42, 42, 528, 708);
  ctx.textBaseline = 'alphabetic';
  return { canvas, ctx };
}

function line(ctx, y, left = 102, right = 510) {
  ctx.strokeStyle = rule;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();
}

function text(ctx, value, x, y, { size = 11, bold = false, serif = false, color = ink, align = 'left' } = {}) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px ' + (serif ? 'Georgia, serif' : 'Arial, sans-serif');
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.fillText(String(value), x, y);
}

function wrap(ctx, value, maxWidth, size, bold = false) {
  ctx.font = (bold ? 'bold ' : '') + size + 'px Arial, sans-serif';
  return String(value ?? '').replace(/\r\n?/g, '\n').split('\n').flatMap(paragraph => {
    const lines = [];
    let current = '';
    for (const word of paragraph.trim().split(/\s+/)) {
      const next = current ? current + ' ' + word : word;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
        continue;
      }
      if (current) lines.push(current);
      current = '';
      for (const character of word) {
        if (current && ctx.measureText(current + character).width > maxWidth) {
          lines.push(current);
          current = '';
        }
        current += character;
      }
    }
    lines.push(current);
    return lines;
  });
}

function logo(ctx, image, y = 73, logoWidth = 190) {
  const logoHeight = logoWidth * image.naturalHeight / image.naturalWidth;
  ctx.drawImage(image, (width - logoWidth) / 2, y, logoWidth, logoHeight);
}

async function renderPages(row, expiration) {
  const image = new Image();
  image.src = certificateLogo;
  await image.decode();
  let page = newPage();
  const pages = [page];
  let { ctx } = page;
  const centered = { align: 'center' };
  logo(ctx, image);
  text(ctx, 'DALLAS CARROLLTON & CONFERENCE CENTER', 306, 124, { ...centered, size: 9, bold: true, color: muted });
  text(ctx, 'Gift Certificate', 306, 181, { ...centered, size: 39, serif: true });
  let y = 215;
  const benefitSize = 14;
  for (const part of wrap(ctx, row.benefit, 435, benefitSize, true)) {
    text(ctx, part, 306, y, { ...centered, size: benefitSize, bold: true });
    y += 19;
  }
  y += 12;
  line(ctx, y);
  y += 23;
  const details = [
    ['Certificate number', row.number],
    ...(row.recipient ? [['Recipient', row.recipient]] : []),
    ...(row.organization ? [['Organization', row.organization]] : []),
    ['Expiration date', expiration],
    ['Issued by', row.issuedBy || 'Not recorded'],
  ];
  for (const [label, value] of details) {
    const bold = label === 'Certificate number';
    text(ctx, label, 103, y, { size: 10, color: muted });
    for (const part of wrap(ctx, value, 282, 11, bold)) {
      text(ctx, part, 230, y, { bold });
      y += 15;
    }
    y += 4;
  }
  line(ctx, y - 5);
  y += 26;
  text(ctx, 'Terms & Conditions', 103, y, { bold: true, color: muted });
  y += 19;
  const terms = wrap(ctx, row.terms, 406, 10.5);
  for (const part of terms) {
    if (y > 683) {
      page = newPage();
      pages.push(page);
      ctx = page.ctx;
      logo(ctx, image, 69, 150);
      text(ctx, 'Gift Certificate ' + row.number, 306, 128, { ...centered, size: 22, serif: true });
      text(ctx, 'Terms & Conditions (continued)', 103, 174, { bold: true, color: muted });
      y = 194;
    }
    text(ctx, part, 103, y, { size: 10.5, color: muted });
    y += 14;
  }
  for (const { ctx } of pages) {
    line(ctx, 706);
    text(ctx, address, 306, 725, { ...centered, size: 9, color: muted });
  }
  return pages;
}

const encode = text => new TextEncoder().encode(text);

function imagePdf(images) {
  const pieces = [];
  let length = 0;
  const offsets = [0];
  function append(value) {
    const bytes = typeof value === 'string' ? encode(value) : value;
    pieces.push(bytes);
    length += bytes.byteLength;
  }
  function object(number, description, stream) {
    offsets[number] = length;
    append(number + ' 0 obj\n' + description);
    if (stream) {
      append('\nstream\n');
      append(stream);
      append('\nendstream');
    }
    append('\nendobj\n');
  }
  append('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  const kids = images.map((_, i) => (3 + i * 3) + ' 0 R').join(' ');
  object(2, '<< /Type /Pages /Kids [' + kids + '] /Count ' + images.length + ' >>');
  images.forEach((jpeg, i) => {
    const page = 3 + i * 3;
    const paint = encode('q 612 0 0 792 0 0 cm /Certificate Do Q');
    object(page, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Certificate ' +
      (page + 1) + ' 0 R >> >> /Contents ' + (page + 2) + ' 0 R >>');
    object(page + 1, '<< /Type /XObject /Subtype /Image /Width ' + width * scale + ' /Height ' + height * scale +
      ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ' + jpeg.byteLength + ' >>', jpeg);
    object(page + 2, '<< /Length ' + paint.byteLength + ' >>', paint);
  });
  const xref = length;
  append('xref\n0 ' + offsets.length + '\n0000000000 65535 f \n');
  for (const offset of offsets.slice(1)) append(String(offset).padStart(10, '0') + ' 00000 n \n');
  append('trailer\n<< /Size ' + offsets.length + ' /Root 1 0 R >>\nstartxref\n' + xref + '\n%%EOF\n');
  return new Blob(pieces, { type: 'application/pdf' });
}

export async function downloadCertificatePdf(row, expiration) {
  const pages = await renderPages(row, expiration);
  const images = await Promise.all(pages.map(({ canvas }) => new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob.arrayBuffer()) : reject(new Error('Could not render the certificate.')), 'image/jpeg', 0.99);
  })));
  const url = URL.createObjectURL(imagePdf(images));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'Gift_Certificate_' + String(row.number).replace(/[^0-9a-z-]/gi, '_') + '.pdf';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
