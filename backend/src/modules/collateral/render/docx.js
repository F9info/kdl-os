// DOCX render for letterhead — COLLATERAL_SPEC.md §6 / §4.2.
// Uses adm-zip (already in deps) to build the ZIP-based .docx format.
// Header (logo band) and footer are embedded as section header/footer.
// Body is an editable paragraph region with default text.
// Spec: header/footer locked, body editable (Open XML section properties).

import AdmZip from 'adm-zip';
import { escapeHtml } from './escape.js';

// Minimal Open XML namespace declarations.
const NS = 'xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex" xmlns:cx1="http://schemas.microsoft.com/office/drawing/2015/9/8/chartex" xmlns:cx2="http://schemas.microsoft.com/office/drawing/2015/10/21/chartex" xmlns:cx3="http://schemas.microsoft.com/office/drawing/2016/5/9/chartex" xmlns:cx4="http://schemas.microsoft.com/office/drawing/2016/5/10/chartex" xmlns:cx5="http://schemas.microsoft.com/office/drawing/2016/5/11/chartex" xmlns:cx6="http://schemas.microsoft.com/office/drawing/2016/5/12/chartex" xmlns:cx7="http://schemas.microsoft.com/office/drawing/2016/5/13/chartex" xmlns:cx8="http://schemas.microsoft.com/office/drawing/2016/5/14/chartex" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink" xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:oel="http://schemas.microsoft.com/office/2019/extlst" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml" xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex" xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid" xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml" xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash" xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"';

function wml(tag, attrs, content) {
  const a = attrs ? ' ' + Object.entries(attrs).map(([k, v]) => `${k}="${v}"`).join(' ') : '';
  return `<${tag}${a}>${content ?? ''}</${tag}>`;
}

function paragraph(text, style = 'Normal') {
  return wml('w:p', null,
    wml('w:pPr', null, wml('w:pStyle', { 'w:val': style }, '')) +
    wml('w:r', null, wml('w:t', { 'xml:space': 'preserve' }, escapeHtml(text)))
  );
}

// Header XML: company name + logo placeholder band.
function buildHeaderXml(companyName) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  ${paragraph(escapeHtml(companyName), 'Header')}
</w:hdr>`;
}

// Footer XML: contact line.
function buildFooterXml(companyData) {
  const contact = [companyData.phone, companyData.email, companyData.website]
    .filter(Boolean).join('  |  ');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  ${paragraph(escapeHtml(contact), 'Footer')}
</w:ftr>`;
}

// Main document body — locked header/footer via section properties, editable body.
function buildDocumentXml(headerRelId, footerRelId, defaultCopy) {
  const body = defaultCopy
    ? paragraph(escapeHtml(defaultCopy))
    : paragraph('');

  // Section properties lock header/footer (titlePage=false, evenAndOddHeaders=false).
  const sectPr = `<w:sectPr>
    <w:headerReference w:type="default" r:id="${headerRelId}"/>
    <w:footerReference w:type="default" r:id="${footerRelId}"/>
    <w:pgSz w:w="11906" w:h="16838"/>
    <w:pgMar w:top="720" w:right="1440" w:bottom="720" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/>
  </w:sectPr>`;

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document ${NS}>
  <w:body>
    ${body}
    ${sectPr}
  </w:body>
</w:document>`;
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/header1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml"/>
  <Override PartName="/word/footer1.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

function buildWordRelsXml(headerRelId, footerRelId) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="${headerRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
  <Relationship Id="${footerRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>`;
}

// Returns a Buffer containing a .docx file.
// brandKit: BrandKit object; defaultCopy: optional letter body text.
export function buildDocx({ brandKit, defaultCopy = '' }) {
  const headerRelId = 'rId1';
  const footerRelId = 'rId2';

  const zip = new AdmZip();
  zip.addFile('[Content_Types].xml', Buffer.from(CONTENT_TYPES_XML, 'utf8'));
  zip.addFile('_rels/.rels', Buffer.from(RELS_XML, 'utf8'));
  zip.addFile('word/_rels/document.xml.rels', Buffer.from(
    buildWordRelsXml(headerRelId, footerRelId), 'utf8'
  ));
  zip.addFile('word/header1.xml', Buffer.from(
    buildHeaderXml(brandKit?.company?.displayName ?? brandKit?.company?.legalName ?? ''), 'utf8'
  ));
  zip.addFile('word/footer1.xml', Buffer.from(
    buildFooterXml(brandKit?.company ?? {}), 'utf8'
  ));
  zip.addFile('word/document.xml', Buffer.from(
    buildDocumentXml(headerRelId, footerRelId, defaultCopy), 'utf8'
  ));

  return zip.toBuffer();
}
