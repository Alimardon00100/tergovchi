import { Inject, Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  PageNumber,
  Footer,
} from 'docx';
import { CaseService, assertRead, audit } from './case.service';
import type { CaseActor } from './case.service';
import { QualificationService } from './qualification.service';
const latin = require.resolve('@fontsource/noto-sans/files/noto-sans-latin-400-normal.woff');
const cyrillic = require.resolve('@fontsource/noto-sans/files/noto-sans-cyrillic-400-normal.woff');
const extended = require.resolve('@fontsource/noto-sans/files/noto-sans-latin-ext-400-normal.woff');
export async function renderCasePdf(lines: { text: string; heading?: boolean }[]) {
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 48, bottom: 48, left: 54, right: 54 },
    bufferPages: true,
    info: { Title: lines[0]?.text ?? 'Jinoyat ishi', Author: 'Tergovchi o‘quv tizimi' },
  });
  doc.registerFont('latin', latin);
  doc.registerFont('cyrillic', cyrillic);
  doc.registerFont('extended', extended);
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  for (const line of lines) {
    doc
      .font('latin')
      .fontSize(line.heading ? 15 : 10)
      .fillColor('#19252c');
    if (line.heading) {
      const required = doc.heightOfString(line.text, { width: doc.page.width - 108 }) + 40;
      if (doc.y + required > doc.page.height - doc.page.margins.bottom) doc.addPage();
    }
    const runs = line.text.match(
      /[\u0400-\u052f]+|[^\u0400-\u052f\u0100-\u02ff]+|[\u0100-\u02ff]+/g,
    ) ?? [''];
    runs.forEach((run, i) =>
      doc
        .font(
          /[\u0400-\u052f]/.test(run)
            ? 'cyrillic'
            : /[\u0100-\u02ff]/.test(run)
              ? 'extended'
              : 'latin',
        )
        .text(run, { continued: i < runs.length - 1, lineGap: 4 }),
    );
    doc.moveDown(line.heading ? 0.6 : 0.4);
  }
  const count = doc.bufferedPageRange().count;
  for (let page = 0; page < count; page++) {
    doc.switchToPage(page);
    const bottom = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;
    doc
      .font('latin')
      .fontSize(9)
      .fillColor('#52616b')
      .text(`${page + 1} / ${count}`, 54, doc.page.height - 35, {
        lineBreak: false,
        align: 'right',
        width: 487,
      });
    doc.page.margins.bottom = bottom;
  }
  doc.end();
  return done;
}
export async function renderCaseDocx(lines: { text: string; heading?: boolean }[]) {
  const doc = new Document({
    creator: 'Tergovchi',
    title: lines[0]?.text ?? 'Jinoyat ishi',
    styles: {
      default: {
        document: {
          run: { font: 'Calibri', size: 22, color: '19252C' },
          paragraph: { spacing: { before: 0, after: 120, line: 264 } },
        },
      },
      paragraphStyles: [
        {
          id: 'Normal',
          name: 'Normal',
          run: { font: 'Calibri', size: 22, color: '19252C' },
          paragraph: { spacing: { before: 0, after: 120, line: 264 } },
        },
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { font: 'Calibri', size: 32, bold: true, color: '2E74B5' },
          paragraph: { spacing: { before: 320, after: 160 }, keepNext: true },
        },
      ],
    },
    sections: [
      {
        properties: {
          page: {
            size: { width: 12240, height: 15840 },
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440, header: 708, footer: 708 },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ children: ['Sahifa ', PageNumber.CURRENT] })],
              }),
            ],
          }),
        },
        children: lines.map(
          (line) =>
            new Paragraph({
              ...(line.heading ? { heading: HeadingLevel.HEADING_1 } : {}),
              children: [
                new TextRun({ text: line.text, font: 'Calibri', size: line.heading ? 32 : 22 }),
              ],
            }),
        ),
      },
    ],
  });
  return Packer.toBuffer(doc);
}
@Injectable()
export class CaseExport {
  constructor(
    @Inject(CaseService) readonly cases: CaseService,
    @Inject(QualificationService) readonly qualifications: QualificationService,
  ) {}
  async export(actor: CaseActor, id: string, format: 'pdf' | 'docx') {
    const file = await this.cases.file(id);
    assertRead(actor, file);
    const [persons, scores] = await Promise.all([
      this.cases.persons(actor, id),
      this.qualifications.scores(actor, id),
    ]);
    const labels: Record<string, string> = {
      NEW: 'Yangi',
      ASSIGNED: 'Biriktirilgan',
      IN_INVESTIGATION: 'Tergovda',
      QUALIFICATION_SUBMITTED: 'Tekshirishga yuborilgan',
      SCORED: 'Baholangan',
      CLOSED: 'Yopilgan',
      SUSPENDED: 'To‘xtatilgan',
      SUSPECT: 'Gumonlanuvchi',
      WITNESS: 'Guvoh',
      VICTIM: 'Jabrlanuvchi',
      OTHER: 'Boshqa',
      SUBJECT: 'Subyekt',
      PARTICIPATION: 'Jinoyatda ishtirokchilik',
      OBJECT: 'Obyekt',
      OBJECTIVE: 'Obyektiv tomon',
      SUBJECTIVE: 'Subyektiv tomon',
    };
    const lines: { text: string; heading?: boolean }[] = [
      { text: 'JINOYAT ISHI — O‘QUV HISOBOTI', heading: true },
      { text: `${file.caseNumber} • ${file.title}` },
      {
        text: `Holati: ${labels[file.status]} | JK: ${file.jkArticles.join(', ')} | Bo‘linma: ${file.department.name}`,
      },
      {
        text: `Ochilgan: ${file.openedAt.toISOString()} | Muddat: ${file.deadlineAt.toISOString()}`,
      },
      { text: `Tergovchi: ${file.assignee?.displayName ?? 'Biriktirilmagan'}` },
      { text: 'JPK — PROTSESSUAL MA’LUMOTLAR', heading: true },
      { text: file.summary },
      { text: file.initialFacts },
    ];
    for (const e of file.episodes)
      lines.push(
        {
          text: `Epizod ${e.episodeNumber} • JK ${e.jkArticle} • Vazn ${e.weight.toString()}`,
          heading: true,
        },
        { text: `${e.location} | ${e.dateTime.toISOString()}` },
        { text: e.description },
      );
    lines.push({ text: 'ISH ISHTIROKCHILARI', heading: true });
    for (const p of persons)
      lines.push(
        { text: `${p.fullName} | ${labels[p.role]} | ${p.birthDate}` },
        { text: `Manzil: ${p.address}; PINFL: ${p.pinfl ?? 'Kiritilmagan'}` },
      );
    lines.push(
      { text: 'JK — KVALIFIKATSIYA NATIJALARI', heading: true },
      {
        text: `Eng yaxshi natija: ${scores.best ?? 'Baholanmagan'} / 100. Urinishlar: ${scores.attemptsUsed} / 3.`,
      },
    );
    for (const score of scores.items) {
      lines.push({
        text: `Urinish ${score.attemptNumber}: ${score.totalScore} / 100 | ${score.investigator} | Etalon versiyasi ${score.referenceRevision}`,
        heading: true,
      });
      for (const e of score.breakdown.episodes) {
        lines.push({
          text: `Epizod ${e.episodeNumber}: ${e.score.toFixed(2)} / 100 (vazn ${e.weight})`,
        });
        for (const el of e.elements)
          lines.push({ text: `${labels[el.element]}: ${el.points.toFixed(2)} / ${el.max}` });
      }
    }
    lines.push({
      text: `Tuzilgan: ${new Date().toISOString()}. Ushbu hujjat o‘quv prototipi hisoboti.`,
    });
    await audit(this.cases.db, actor, 'EXPORTED', id, { format, masked: actor.role === 'AUDITOR' });
    return {
      buffer: format === 'pdf' ? await renderCasePdf(lines) : await renderCaseDocx(lines),
      filename: `case-${file.caseNumber}.${format}`,
    };
  }
}
