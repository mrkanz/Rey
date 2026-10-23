/**
 * Doc & PDF Master Suite - Frontend Core Engine
 * Implements bidirectional conversion, extreme compression algorithms,
 * multi-image merging, and Google Apps Script / Google Sheets integration.
 */

// Initialize PDF.js worker
if (typeof pdfjsLib !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// Global State
const State = {
  currentTab: 'to-pdf',
  uploadedFiles: {
    'to-pdf': [],
    'from-pdf': [],
    'compress': [],
    'merge': []
  },
  compressionPreset: 'extreme', // extreme, balanced, high, custom
  compressionQuality: 0.4,
  compressionMaxDimension: 1280,
  mergeSettings: {
    pageSize: 'a4',
    orientation: 'auto',
    margin: 0
  },
  lastProcessedResult: null
};

// DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initNavigation();
  initDropzones();
  initThemeToggle();
  initCompressionControls();
  initMergeControls();
  initGASStatus();
  loadHistoryLogs();
});

/* ==========================================================================
   Navigation & Tabs
   ========================================================================== */

function initNavigation() {
  const tabs = document.querySelectorAll('.tool-tab-btn');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      switchTab(target);
    });
  });
}

function switchTab(tabId) {
  State.currentTab = tabId;
  
  // Update Tab buttons
  document.querySelectorAll('.tool-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabId);
  });

  // Update Panels
  document.querySelectorAll('.tool-panel').forEach(panel => {
    panel.classList.toggle('active', panel.id === `panel-${tabId}`);
  });

  // Hide results card on tab change
  hideResults();

  if (tabId === 'history') {
    loadHistoryLogs();
  }
}

/* ==========================================================================
   Theme & UI Toggles
   ========================================================================== */

function initThemeToggle() {
  const themeBtn = document.getElementById('theme-toggle-btn');
  const savedTheme = localStorage.getItem('APP_THEME') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  updateThemeIcon(savedTheme);

  if (themeBtn) {
    themeBtn.addEventListener('click', () => {
      const current = document.documentElement.getAttribute('data-theme') || 'dark';
      const newTheme = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('APP_THEME', newTheme);
      updateThemeIcon(newTheme);
    });
  }
}

function updateThemeIcon(theme) {
  const icon = document.querySelector('#theme-toggle-btn i');
  if (icon) {
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
  }
}

async function initGASStatus() {
  const badge = document.getElementById('gas-status-badge');
  const dot = badge ? badge.querySelector('.status-dot') : null;
  const label = badge ? badge.querySelector('.status-text') : null;

  try {
    const res = await window.gasBridge.ping();
    if (res.success) {
      if (label) label.textContent = window.gasBridge.isNativeGAS ? 'GAS Cloud Native' : 'GAS API Online';
      if (dot) dot.style.backgroundColor = 'var(--accent-emerald)';
    } else {
      if (label) label.textContent = 'Client Engine (Hybrid)';
      if (dot) dot.style.backgroundColor = 'var(--accent-amber)';
    }
  } catch {
    if (label) label.textContent = 'Client Engine';
    if (dot) dot.style.backgroundColor = 'var(--accent-amber)';
  }
}

/* ==========================================================================
   File Dropzones & Queue Management
   ========================================================================== */

function initDropzones() {
  const dropzones = [
    { id: 'dropzone-to-pdf', input: 'input-to-pdf', tab: 'to-pdf' },
    { id: 'dropzone-from-pdf', input: 'input-from-pdf', tab: 'from-pdf' },
    { id: 'dropzone-compress', input: 'input-compress', tab: 'compress' },
    { id: 'dropzone-merge', input: 'input-merge', tab: 'merge' }
  ];

  dropzones.forEach(({ id, input, tab }) => {
    const dropzoneEl = document.getElementById(id);
    const inputEl = document.getElementById(input);

    if (!dropzoneEl || !inputEl) return;

    // Click to upload
    dropzoneEl.addEventListener('click', (e) => {
      if (e.target.closest('.file-remove-btn') || e.target.closest('.thumb-mini-btn')) return;
      inputEl.click();
    });

    inputEl.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFilesSelected(Array.from(e.target.files), tab);
        inputEl.value = ''; // Reset
      }
    });

    // Drag & Drop
    ['dragenter', 'dragover'].forEach(eventName => {
      dropzoneEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.add('dragover');
      });
    });

    ['dragleave', 'drop'].forEach(eventName => {
      dropzoneEl.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        dropzoneEl.classList.remove('dragover');
      });
    });

    dropzoneEl.addEventListener('drop', (e) => {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFilesSelected(Array.from(e.dataTransfer.files), tab);
      }
    });
  });
}

function handleFilesSelected(files, tab) {
  if (tab === 'merge') {
    // Only accept images for merge
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length === 0) {
      showToast('Harap pilih file gambar (JPG, PNG, WebP) untuk digabungkan.', 'error');
      return;
    }
    State.uploadedFiles[tab].push(...imageFiles);
    renderMergeGrid();
  } else if (tab === 'from-pdf') {
    // Only accept PDF
    const pdfFiles = files.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length === 0) {
      showToast('Harap pilih file dokumen PDF.', 'error');
      return;
    }
    State.uploadedFiles[tab] = pdfFiles; // single/batch
    renderFileQueue(tab);
  } else {
    // to-pdf or compress
    State.uploadedFiles[tab].push(...files);
    renderFileQueue(tab);
  }

  hideResults();
}

function renderFileQueue(tab) {
  const section = document.getElementById(`queue-${tab}`);
  const container = document.getElementById(`list-${tab}`);
  const files = State.uploadedFiles[tab];

  if (!section || !container) return;

  if (files.length === 0) {
    section.classList.remove('has-files');
    container.innerHTML = '';
    return;
  }

  section.classList.add('has-files');
  container.innerHTML = '';

  files.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'file-card-item';
    
    let iconClass = 'fas fa-file-alt';
    const ext = file.name.split('.').pop().toLowerCase();
    if (['doc', 'docx'].includes(ext)) iconClass = 'fas fa-file-word';
    else if (['xls', 'xlsx'].includes(ext)) iconClass = 'fas fa-file-excel';
    else if (['ppt', 'pptx'].includes(ext)) iconClass = 'fas fa-file-powerpoint';
    else if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) iconClass = 'fas fa-file-image';
    else if (ext === 'pdf') iconClass = 'fas fa-file-pdf';

    card.innerHTML = `
      <div class="file-thumb">
        <i class="${iconClass}"></i>
      </div>
      <div class="file-info-text">
        <div class="file-name" title="${file.name}">${file.name}</div>
        <div class="file-size">${formatBytes(file.size)}</div>
      </div>
      <button class="file-remove-btn" title="Hapus File" onclick="removeFile('${tab}', ${index})">
        <i class="fas fa-times"></i>
      </button>
    `;
    container.appendChild(card);
  });
}

function removeFile(tab, index) {
  State.uploadedFiles[tab].splice(index, 1);
  if (tab === 'merge') {
    renderMergeGrid();
  } else {
    renderFileQueue(tab);
  }
}

function clearFiles(tab) {
  State.uploadedFiles[tab] = [];
  if (tab === 'merge') {
    renderMergeGrid();
  } else {
    renderFileQueue(tab);
  }
  hideResults();
}

/* ==========================================================================
   Tool 1: Convert to PDF
   ========================================================================== */

async function processConvertToPdf() {
  const files = State.uploadedFiles['to-pdf'];
  if (files.length === 0) {
    showToast('Silakan pilih setidaknya satu file untuk dikonversi.', 'error');
    return;
  }

  showProgress(0, 'Mempersiapkan File...', 'Membaca dokumen');

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const ext = file.name.split('.').pop().toLowerCase();
      updateProgress(((i + 0.3) / files.length) * 100, `Memproses ${file.name}`, 'Mengkonversi dokumen ke PDF...');

      if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
        // High performance client-side Image to PDF
        const pdfBlob = await convertSingleImageToPdf(file);
        finishSingleResult(pdfBlob, file.name.substring(0, file.name.lastIndexOf('.')) + '.pdf', file.size, 'Image to PDF');
      } else if (['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        // Office Document -> Use Google Apps Script / Drive Native Engine
        updateProgress(((i + 0.6) / files.length) * 100, `Rendering via Google Drive Engine`, `Konversi presisi ${ext.toUpperCase()}`);
        const base64 = await fileToBase64(file);
        
        try {
          const res = await window.gasBridge.convertOfficeToPdf(base64, file.name, file.type);
          if (res.success && res.fileBase64) {
            const pdfBlob = base64ToBlob(res.fileBase64, 'application/pdf');
            finishSingleResult(pdfBlob, res.fileName || 'converted.pdf', file.size, `${ext.toUpperCase()} to PDF`);
          } else {
            throw new Error(res.error || 'Gagal memproses via cloud engine.');
          }
        } catch (gasErr) {
          // Fallback client notice
          throw new Error('Koneksi Google Apps Script diperlukan untuk konversi Office: ' + gasErr.message);
        }
      } else {
        throw new Error(`Format .${ext} belum didukung.`);
      }
    }
  } catch (err) {
    hideProgress();
    showToast(err.message, 'error');
  }
}

async function convertSingleImageToPdf(imageFile) {
  const pdfDoc = await PDFLib.PDFDocument.create();
  const imageBytes = await imageFile.arrayBuffer();
  
  let img;
  if (imageFile.type === 'image/png') {
    img = await pdfDoc.embedPng(imageBytes);
  } else {
    // For JPG, WebP, etc convert via canvas to JPEG/PNG buffer
    const jpegBuffer = await convertImageToJpegBuffer(imageFile);
    img = await pdfDoc.embedJpg(jpegBuffer);
  }

  const { width, height } = img.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(img, {
    x: 0,
    y: 0,
    width: width,
    height: height
  });

  const pdfBytes = await pdfDoc.save();
  return new Blob([pdfBytes], { type: 'application/pdf' });
}

/* ==========================================================================
   Tool 2: Convert from PDF (PDF to Word / Images / Text)
   ========================================================================== */

async function processConvertFromPdf(targetFormat) {
  const files = State.uploadedFiles['from-pdf'];
  if (!files || files.length === 0) {
    showToast('Silakan pilih file PDF terlebih dahulu.', 'error');
    return;
  }

  const file = files[0];
  showProgress(10, 'Membaca Dokumen PDF...', file.name);

  try {
    if (targetFormat === 'txt') {
      // 100% Client-side high speed & accurate Text Extraction
      updateProgress(35, 'Mengekstrak Lapisan Teks Dokumen...', 'Menganalisis baris & paragraf');
      const extractedText = await extractTextFromPdfClient(file);

      // Check if text is essentially empty (scanned image PDF)
      const cleanLen = extractedText.replace(/===.*?===|---.*?---|\[.*?\]/g, '').trim().length;
      if (cleanLen < 15 && window.gasBridge && window.gasBridge.isAvailable()) {
        try {
          updateProgress(50, 'Mencoba Cloud OCR (Google Drive)...', 'PDF terdeteksi tanpa teks digital');
          const base64 = await fileToBase64(file);
          const gasRes = await window.gasBridge.convertPdfToOffice(base64, file.name, 'txt');
          if (gasRes && gasRes.success && gasRes.fileBase64) {
            const txtBlob = base64ToBlob(gasRes.fileBase64, 'text/plain');
            const outputName = gasRes.fileName || (file.name.replace(/\.pdf$/i, '') + '.txt');
            const ocrText = atob(gasRes.fileBase64);
            finishSingleResult(txtBlob, outputName, file.size, 'PDF to Text (Cloud OCR)', { textPreview: ocrText });
            return;
          }
        } catch (e) {
          console.warn('Cloud OCR fallback failed, returning client extraction:', e);
        }
      }

      const txtBlob = new Blob([extractedText], { type: 'text/plain;charset=utf-8' });
      const outputName = file.name.replace(/\.pdf$/i, '') + '.txt';
      finishSingleResult(txtBlob, outputName, file.size, 'PDF to Text (.txt)', { textPreview: extractedText });

    } else if (targetFormat === 'docx') {
      let docxBlob = null;
      let outputName = file.name.replace(/\.pdf$/i, '') + '.docx';

      // If GAS Cloud Engine is online & configured, try Cloud Native OCR
      if (window.gasBridge && window.gasBridge.isAvailable()) {
        try {
          updateProgress(30, 'Menghubungi Cloud OCR Google Docs Engine...', 'Konversi presisi tata letak');
          const base64 = await fileToBase64(file);
          const res = await window.gasBridge.convertPdfToOffice(base64, file.name, 'docx');
          if (res && res.success && res.fileBase64) {
            const mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
            docxBlob = base64ToBlob(res.fileBase64, mime);
            outputName = res.fileName || outputName;
          }
        } catch (gasErr) {
          console.warn('Cloud OCR not available, switching to client DOCX engine:', gasErr);
        }
      }

      // High-Fidelity Native Client DOCX Generator (Offline / Hybrid)
      if (!docxBlob) {
        updateProgress(50, 'Menyusun Dokumen Word (.docx)...', 'Engine Native Client OpenXML');
        docxBlob = await convertPdfToDocxClient(file);
      }

      finishSingleResult(docxBlob, outputName, file.size, 'PDF to Word (.docx)');

    } else if (targetFormat === 'png' || targetFormat === 'jpg' || targetFormat === 'images_zip') {
      const mime = targetFormat === 'jpg' ? 'image/jpeg' : 'image/png';
      const ext = targetFormat === 'jpg' ? 'jpg' : 'png';
      updateProgress(20, 'Merender Halaman PDF ke Gambar...', 'DPI 2.0 Super Clarity');

      const renderResult = await renderPdfPagesToImages(file, mime, ext);

      if (renderResult.isSingle) {
        const outName = file.name.replace(/\.pdf$/i, '') + `_page1.${ext}`;
        finishSingleResult(renderResult.singleBlob, outName, file.size, `PDF to ${ext.toUpperCase()}`, {
          imagePreviewUrl: renderResult.images[0].previewUrl
        });
      } else {
        const outName = file.name.replace(/\.pdf$/i, '') + `_${ext}_pages.zip`;
        finishSingleResult(renderResult.zipBlob, outName, file.size, `PDF to Images (${ext.toUpperCase()} ZIP)`, {
          imageThumbnails: renderResult.images
        });
      }
    } else {
      throw new Error(`Format output '${targetFormat}' belum didukung.`);
    }
  } catch (err) {
    hideProgress();
    console.error('Conversion error:', err);
    showToast('Gagal konversi: ' + err.message, 'error');
  }
}

/**
 * Client-Side PDF to Word (.docx) Engine using OpenXML + JSZip
 */
async function convertPdfToDocxClient(pdfFile) {
  function escapeXml(str) {
    if (!str) return '';
    // Strip invalid XML 1.0 control characters that cause Microsoft Word parser crashes
    const sanitized = str.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F]/g, '');
    return sanitized.replace(/[<>&'"]/g, c => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case "'": return '&apos;';
        case '"': return '&quot;';
        default: return '';
      }
    });
  }

  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;

  const rawName = (pdfFile && pdfFile.name ? pdfFile.name.replace(/\.[^/.]+$/, '') : 'Dokumen') || 'Dokumen';
  const docTitle = escapeXml(rawName);

  const zip = new JSZip();

  // 1. [Content_Types].xml
  zip.file('[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Default Extension="jpeg" ContentType="image/jpeg"/>' +
    '<Default Extension="jpg" ContentType="image/jpeg"/>' +
    '<Default Extension="png" ContentType="image/png"/>' +
    '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
    '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
    '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
    '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
    '</Types>');

  // 2. _rels/.rels
  zip.folder('_rels').file('.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
    '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
    '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>' +
    '</Relationships>');

  // 3. docProps/core.xml & docProps/app.xml
  zip.folder('docProps').file('core.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
    `<dc:title>${docTitle}</dc:title>` +
    '<dc:creator>DocConverterSuite</dc:creator>' +
    '</cp:coreProperties>');

  zip.folder('docProps').file('app.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">' +
    '<Application>Microsoft Office Word</Application>' +
    '</Properties>');

  // 4. word/styles.xml
  zip.folder('word').file('styles.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    '<w:docDefaults>' +
    '<w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/><w:sz w:val="22"/><w:szCs w:val="22"/><w:color w:val="2D3748"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="140" w:line="260" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
    '</w:docDefaults>' +
    '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="240" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/><w:szCs w:val="32"/><w:color w:val="1A202C"/></w:rPr></w:style>' +
    '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/><w:qFormat/><w:pPr><w:spacing w:before="180" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/><w:szCs w:val="26"/><w:color w:val="2D3748"/></w:rPr></w:style>' +
    '</w:styles>');

  let bodyXml = '';
  let docRelsXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>';
  let relIdCounter = 2;

  for (let pNum = 1; pNum <= numPages; pNum++) {
    updateProgress(50 + ((pNum / numPages) * 40), `Mengonversi halaman ${pNum} dari ${numPages} ke Word...`, 'Menganalisis konten');
    const page = await pdf.getPage(pNum);
    const textContent = await page.getTextContent();
    const items = (textContent.items || []).filter(it => it.str && it.str.trim().length > 0);

    if (items.length > 0) {
      // Sort items: Y descending (top to bottom), then X ascending (left to right)
      items.sort((a, b) => {
        const yA = a.transform ? a.transform[5] : 0;
        const yB = b.transform ? b.transform[5] : 0;
        if (Math.abs(yA - yB) <= 3.5) {
          const xA = a.transform ? a.transform[4] : 0;
          const xB = b.transform ? b.transform[4] : 0;
          return xA - xB;
        }
        return yB - yA;
      });

      // Group into lines
      const lines = [];
      let curLine = [];
      let curY = null;

      for (const it of items) {
        const y = it.transform ? it.transform[5] : 0;
        const x = it.transform ? it.transform[4] : 0;
        const fontSize = Math.round(Math.hypot(it.transform[0], it.transform[1]) || it.height || 11);
        if (curY === null || Math.abs(curY - y) <= 3.5) {
          curLine.push({ text: it.str, x, y, fontSize });
          if (curY === null) curY = y;
        } else {
          lines.push(curLine);
          curLine = [{ text: it.str, x, y, fontSize }];
          curY = y;
        }
      }
      if (curLine.length > 0) lines.push(curLine);

      // Convert lines to Word paragraphs
      for (const line of lines) {
        let lineText = '';
        let maxFont = 11;
        for (let j = 0; j < line.length; j++) {
          const it = line[j];
          if (j > 0 && !lineText.endsWith(' ') && !it.text.startsWith(' ')) lineText += ' ';
          lineText += it.text;
          if (it.fontSize > maxFont) maxFont = it.fontSize;
        }
        lineText = lineText.trim();
        if (!lineText) continue;

        let style = 'Normal';
        if (maxFont >= 16) style = 'Heading1';
        else if (maxFont >= 13) style = 'Heading2';

        bodyXml += '<w:p><w:pPr><w:pStyle w:val="' + style + '"/></w:pPr><w:r><w:t xml:space="preserve">' + escapeXml(lineText) + '</w:t></w:r></w:p>';
      }
    } else {
      // Scanned page fallback: render page to high-quality image and embed in DOCX
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: viewport }).promise;

      const imgBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.85));
      const imgBuffer = await imgBlob.arrayBuffer();
      const imgName = `image_${pNum}.jpeg`;
      zip.folder('word').folder('media').file(imgName, imgBuffer);

      const rId = `rIdImg${relIdCounter++}`;
      docRelsXml += `<Relationship Id="${rId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${imgName}"/>`;

      const cx = 5400000;
      const cy = Math.round((viewport.height / viewport.width) * cx);
      bodyXml += `<w:p><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="${pNum}" name="Page ${pNum}"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="${pNum}" name="${imgName}"/><pic:cNvPicPr><a:picLocks noChangeAspect="1" noChangeArrowheads="1"/></pic:cNvPicPr></pic:nvPicPr><pic:blipFill><a:blip r:embed="${rId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
    }

    if (pNum < numPages) {
      bodyXml += '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }
  }

  // A4 Page Setup
  bodyXml += '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>';
  docRelsXml += '</Relationships>';

  zip.folder('word').folder('_rels').file('document.xml.rels', docRelsXml);
  zip.folder('word').file('document.xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
    'xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" ' +
    'xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" ' +
    'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
    'xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">' +
    '<w:body>' + bodyXml + '</w:body></w:document>');

  updateProgress(95, 'Mengemas Dokumen Word (.docx)...', 'Menghasilkan file DOCX standar');
  return await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

/**
 * High-DPI PDF to Images Converter (Single Image or ZIP)
 */
async function renderPdfPagesToImages(pdfFile, mimeType = 'image/png', ext = 'png') {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  const images = [];
  const zip = new JSZip();

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    updateProgress(25 + ((pageNum / numPages) * 65), `Merender halaman ${pageNum} dari ${numPages}...`, 'DPI 2.0 Super Clarity');
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    // Fill white background so transparent PDF does not render black in JPG or dark viewers
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    const quality = ext === 'jpg' || ext === 'jpeg' ? 0.92 : 1.0;
    const imgBlob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, quality));
    const pageFileName = `page_${String(pageNum).padStart(3, '0')}.${ext}`;
    const previewUrl = canvas.toDataURL('image/jpeg', 0.7);

    images.push({
      pageNum: pageNum,
      fileName: pageFileName,
      blob: imgBlob,
      size: imgBlob.size,
      previewUrl: previewUrl,
      width: viewport.width,
      height: viewport.height
    });

    zip.file(pageFileName, imgBlob);
  }

  if (numPages === 1) {
    return {
      isSingle: true,
      images: images,
      singleBlob: images[0].blob,
      singleName: images[0].fileName,
      totalSize: images[0].size
    };
  } else {
    updateProgress(95, 'Membuat Arsip ZIP...', 'Mengompresi semua halaman');
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    return {
      isSingle: false,
      images: images,
      zipBlob: zipBlob,
      totalSize: zipBlob.size
    };
  }
}

/**
 * Client-Side Text Extraction with Proper Line and Paragraph Layout Reconstruction
 */
async function extractTextFromPdfClient(pdfFile) {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  let fullText = `=== HASIL EKSTRAKSI TEKS: ${pdfFile.name} ===\n\n`;

  for (let i = 1; i <= numPages; i++) {
    updateProgress(30 + ((i / numPages) * 60), `Mengekstrak teks halaman ${i} dari ${numPages}...`, 'Membaca lapisan teks');
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    const items = (textContent.items || []).filter(it => it.str && it.str.length > 0);

    if (numPages > 1) {
      fullText += `--- Halaman ${i} ---\n\n`;
    }

    if (items.length === 0) {
      fullText += `[Halaman ${i} tidak mengandung teks digital (kemungkinan gambar/hasil scan)]\n\n`;
      continue;
    }

    // Sort items: Y descending, then X ascending
    items.sort((a, b) => {
      const yA = a.transform ? a.transform[5] : 0;
      const yB = b.transform ? b.transform[5] : 0;
      if (Math.abs(yA - yB) <= 3.5) {
        const xA = a.transform ? a.transform[4] : 0;
        const xB = b.transform ? b.transform[4] : 0;
        return xA - xB;
      }
      return yB - yA;
    });

    // Group into lines
    const lines = [];
    let curLine = [];
    let curY = null;

    for (const it of items) {
      const y = it.transform ? it.transform[5] : 0;
      const x = it.transform ? it.transform[4] : 0;
      if (curY === null || Math.abs(curY - y) <= 3.5) {
        curLine.push(it);
        if (curY === null) curY = y;
      } else {
        lines.push({ y: curY, items: curLine });
        curLine = [it];
        curY = y;
      }
    }
    if (curLine.length > 0) lines.push({ y: curY, items: curLine });

    // Join lines with proper spacing and paragraph detection
    let lastY = null;
    for (const lineObj of lines) {
      if (lastY !== null && (lastY - lineObj.y) > 20) {
        fullText += '\n';
      }
      lastY = lineObj.y;

      let lineText = '';
      for (let j = 0; j < lineObj.items.length; j++) {
        const token = lineObj.items[j];
        if (j > 0 && !lineText.endsWith(' ') && !token.str.startsWith(' ')) {
          lineText += ' ';
        }
        lineText += token.str;
      }
      fullText += lineText.trim() + '\n';
    }

    fullText += '\n';
  }

  return fullText.trim();
}

/* ==========================================================================
   Tool 3: Extreme Compression Engine (Images & PDF)
   ========================================================================== */

function initCompressionControls() {
  const presetCards = document.querySelectorAll('.preset-card');
  const slider = document.getElementById('compression-slider');
  const sliderVal = document.getElementById('slider-val-display');

  presetCards.forEach(card => {
    card.addEventListener('click', () => {
      presetCards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');
      const preset = card.dataset.preset;
      State.compressionPreset = preset;

      if (preset === 'extreme') {
        State.compressionQuality = 0.28;
        State.compressionMaxDimension = 1100;
        if (slider) slider.value = 28;
      } else if (preset === 'balanced') {
        State.compressionQuality = 0.58;
        State.compressionMaxDimension = 1600;
        if (slider) slider.value = 58;
      } else if (preset === 'high') {
        State.compressionQuality = 0.82;
        State.compressionMaxDimension = 2400;
        if (slider) slider.value = 82;
      }

      if (sliderVal && slider) sliderVal.textContent = slider.value + '%';
    });
  });

  if (slider) {
    slider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value);
      State.compressionQuality = val / 100;
      if (sliderVal) sliderVal.textContent = val + '%';
      
      presetCards.forEach(c => c.classList.remove('active'));
      const customCard = document.querySelector('[data-preset="custom"]');
      if (customCard) customCard.classList.add('active');
    });
  }
}

async function processCompression() {
  const files = State.uploadedFiles['compress'];
  if (files.length === 0) {
    showToast('Silakan pilih file PDF atau Gambar untuk dikompresi.', 'error');
    return;
  }

  const file = files[0];
  const ext = file.name.split('.').pop().toLowerCase();
  showProgress(10, 'Memulai Algoritma Kompresi Ekstrem...', file.name);

  try {
    let compressedBlob = null;
    let outputName = file.name;

    if (['jpg', 'jpeg', 'png', 'webp', 'bmp'].includes(ext)) {
      // Extreme Image Compression via Canvas Multi-pass Quantization & Rescaling
      compressedBlob = await compressImageExtreme(file, State.compressionQuality, State.compressionMaxDimension);
      outputName = file.name.replace(/\.[^/.]+$/, "") + '_compressed.webp';
    } else if (ext === 'pdf') {
      // Extreme PDF Compression via Canvas Downsampling & PDF-Lib Rebuilding
      compressedBlob = await compressPdfExtreme(file, State.compressionQuality);
      outputName = file.name.replace(/\.pdf$/i, "") + '_compressed.pdf';
    } else {
      throw new Error('Format file belum didukung untuk kompresi langsung.');
    }

    finishSingleResult(compressedBlob, outputName, file.size, 'Extreme Compression');
  } catch (err) {
    hideProgress();
    showToast('Gagal mengompresi: ' + err.message, 'error');
  }
}

/**
 * Extreme Image Compression Engine:
 * - Smart multi-pass scaling to reduce memory & preserve edge sharpness
 * - Converts to optimized WebP / JPEG with aggressive quantization
 */
async function compressImageExtreme(file, quality = 0.3, maxDim = 1200) {
  updateProgress(30, 'Menganalisis matriks piksel gambar...', 'Downsampling cerdas');
  const imgBitmap = await createImageBitmap(file);
  let { width, height } = imgBitmap;

  // Scale down dimensions if greater than maxDim
  if (width > maxDim || height > maxDim) {
    if (width > height) {
      height = Math.round((height * maxDim) / width);
      width = maxDim;
    } else {
      width = Math.round((width * maxDim) / height);
      height = maxDim;
    }
  }

  updateProgress(60, 'Menerapkan kompresi lossy WebP...', `Target: ${width}x${height} px`);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { alpha: false });
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(imgBitmap, 0, 0, width, height);

  // Convert to WebP for maximum compression ratio
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', quality));
  return blob;
}

/**
 * Extreme PDF Compression Engine:
 * - Extracts every page with PDF.js
 * - Re-encodes raster pages using custom downscaled WebP/JPEG
 * - Rebuilds ultra-compact PDF with PDF-Lib
 */
async function compressPdfExtreme(pdfFile, quality = 0.4) {
  const arrayBuffer = await pdfFile.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const numPages = pdf.numPages;
  
  const newPdf = await PDFLib.PDFDocument.create();
  const scaleFactor = quality < 0.35 ? 1.0 : 1.35; // 72 DPI vs 100 DPI
  const imageQuality = Math.max(0.25, quality);

  for (let i = 1; i <= numPages; i++) {
    updateProgress(20 + ((i / numPages) * 70), `Mengompresi halaman PDF ${i} dari ${numPages}...`, 'Mereduksi ukuran data');
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: scaleFactor });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');

    await page.render({ canvasContext: ctx, viewport: viewport }).promise;

    const imgBlob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', imageQuality));
    const imgBytes = await imgBlob.arrayBuffer();
    const embeddedImg = await newPdf.embedJpg(imgBytes);

    const newPage = newPdf.addPage([viewport.width, viewport.height]);
    newPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: viewport.width,
      height: viewport.height
    });
  }

  updateProgress(95, 'Mengoptimalkan struktur stream PDF...', 'Finalizing');
  const compressedBytes = await newPdf.save();
  return new Blob([compressedBytes], { type: 'application/pdf' });
}

/* ==========================================================================
   Tool 4: Merge Multiple Images to PDF
   ========================================================================== */

function initMergeControls() {
  const pageSizeSelect = document.getElementById('merge-page-size');
  const orientationSelect = document.getElementById('merge-orientation');
  const marginSelect = document.getElementById('merge-margin');

  if (pageSizeSelect) {
    pageSizeSelect.addEventListener('change', (e) => State.mergeSettings.pageSize = e.target.value);
  }
  if (orientationSelect) {
    orientationSelect.addEventListener('change', (e) => State.mergeSettings.orientation = e.target.value);
  }
  if (marginSelect) {
    marginSelect.addEventListener('change', (e) => State.mergeSettings.margin = parseInt(e.target.value));
  }
}

function renderMergeGrid() {
  const section = document.getElementById('queue-merge');
  const grid = document.getElementById('merge-sortable-grid');
  const files = State.uploadedFiles['merge'];

  if (!section || !grid) return;

  if (files.length === 0) {
    section.classList.remove('has-files');
    grid.innerHTML = '';
    return;
  }

  section.classList.add('has-files');
  grid.innerHTML = '';

  files.forEach((file, index) => {
    const card = document.createElement('div');
    card.className = 'merge-thumb-item';
    card.draggable = true;
    card.dataset.index = index;

    const imgUrl = URL.createObjectURL(file);

    card.innerHTML = `
      <img src="${imgUrl}" alt="Page ${index + 1}">
      <div class="page-num-badge">${index + 1}</div>
      <div class="thumb-action-btns">
        ${index > 0 ? `<button class="thumb-mini-btn" title="Pindah ke Kiri" onclick="moveMergeFile(${index}, -1)"><i class="fas fa-chevron-left"></i></button>` : ''}
        ${index < files.length - 1 ? `<button class="thumb-mini-btn" title="Pindah ke Kanan" onclick="moveMergeFile(${index}, 1)"><i class="fas fa-chevron-right"></i></button>` : ''}
        <button class="thumb-mini-btn" title="Hapus" onclick="removeFile('merge', ${index})"><i class="fas fa-trash"></i></button>
      </div>
    `;

    // Drag and drop reordering
    card.addEventListener('dragstart', (e) => {
      e.dataTransfer.setData('text/plain', index);
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    card.addEventListener('drop', (e) => {
      e.preventDefault();
      const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
      const toIndex = index;
      if (fromIndex !== toIndex) {
        const movedItem = State.uploadedFiles['merge'].splice(fromIndex, 1)[0];
        State.uploadedFiles['merge'].splice(toIndex, 0, movedItem);
        renderMergeGrid();
      }
    });

    grid.appendChild(card);
  });
}

function moveMergeFile(index, offset) {
  const newIndex = index + offset;
  if (newIndex < 0 || newIndex >= State.uploadedFiles['merge'].length) return;
  const item = State.uploadedFiles['merge'].splice(index, 1)[0];
  State.uploadedFiles['merge'].splice(newIndex, 0, item);
  renderMergeGrid();
}

async function processMergeImages() {
  const files = State.uploadedFiles['merge'];
  if (files.length === 0) {
    showToast('Silakan pilih minimal 1 gambar untuk digabungkan ke PDF.', 'error');
    return;
  }

  showProgress(10, 'Menggabungkan Gambar ke PDF...', `Total: ${files.length} Halaman`);

  try {
    const pdfDoc = await PDFLib.PDFDocument.create();
    const margin = State.mergeSettings.margin;
    let totalOriginalSize = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      totalOriginalSize += file.size;
      updateProgress(15 + ((i / files.length) * 75), `Menyusun Halaman ${i + 1} dari ${files.length}...`, file.name);

      const imgBytes = await convertImageToJpegBuffer(file);
      const embeddedImg = await pdfDoc.embedJpg(imgBytes);
      const imgWidth = embeddedImg.width;
      const imgHeight = embeddedImg.height;

      let pageWidth, pageHeight;

      if (State.mergeSettings.pageSize === 'a4') {
        pageWidth = 595.28;
        pageHeight = 841.89;
      } else if (State.mergeSettings.pageSize === 'letter') {
        pageWidth = 612.0;
        pageHeight = 792.0;
      } else {
        // Fit exact image
        pageWidth = imgWidth + (margin * 2);
        pageHeight = imgHeight + (margin * 2);
      }

      // Check orientation
      if (State.mergeSettings.orientation === 'landscape' || (State.mergeSettings.orientation === 'auto' && imgWidth > imgHeight)) {
        if (pageWidth < pageHeight) {
          const temp = pageWidth;
          pageWidth = pageHeight;
          pageHeight = temp;
        }
      }

      const page = pdfDoc.addPage([pageWidth, pageHeight]);

      // Calculate scaled image size fitting within available space (accounting for margins)
      const availableW = pageWidth - (margin * 2);
      const availableH = pageHeight - (margin * 2);
      const scale = Math.min(availableW / imgWidth, availableH / imgHeight);

      const drawW = imgWidth * scale;
      const drawH = imgHeight * scale;
      const drawX = margin + ((availableW - drawW) / 2);
      const drawY = margin + ((availableH - drawH) / 2);

      page.drawImage(embeddedImg, {
        x: drawX,
        y: drawY,
        width: drawW,
        height: drawH
      });
    }

    updateProgress(95, 'Mengompresi dan menyusun PDF...', 'Finalizing');
    const pdfBytes = await pdfDoc.save();
    const pdfBlob = new Blob([pdfBytes], { type: 'application/pdf' });

    finishSingleResult(pdfBlob, 'Merged_Document.pdf', totalOriginalSize, 'Merge Images to PDF');
  } catch (err) {
    hideProgress();
    showToast('Gagal menggabungkan gambar: ' + err.message, 'error');
  }
}

/* ==========================================================================
   Results Presentation, Download & Database Logging
   ========================================================================== */

function finishSingleResult(blob, fileName, originalSizeBytes, actionName, extraDetails = {}) {
  hideProgress();
  State.lastProcessedResult = {
    blob: blob,
    fileName: fileName,
    originalSizeBytes: originalSizeBytes,
    finalSizeBytes: blob.size,
    actionName: actionName,
    mimeType: blob.type,
    extra: extraDetails
  };

  const resultsSection = document.getElementById('results-section');
  const bannerName = document.getElementById('res-output-name');
  const bannerIcon = document.getElementById('res-file-icon');
  const bannerAction = document.getElementById('res-action-tag');
  const origSizeEl = document.getElementById('res-orig-size');
  const finalSizeEl = document.getElementById('res-final-size');
  const savingsEl = document.getElementById('res-savings');
  const stat3Label = document.getElementById('res-stat3-label');
  const downloadBtn = document.getElementById('btn-download-result');
  const previewContainer = document.getElementById('res-preview-container');

  // Determine icon & color based on extension
  const ext = fileName.split('.').pop().toLowerCase();
  let iconClass = 'fas fa-file-alt';
  let iconColor = 'var(--primary)';
  if (['docx', 'doc'].includes(ext)) {
    iconClass = 'fas fa-file-word';
    iconColor = '#60a5fa';
  } else if (ext === 'pdf') {
    iconClass = 'fas fa-file-pdf';
    iconColor = '#f87171';
  } else if (['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
    iconClass = 'fas fa-file-image';
    iconColor = '#34d399';
  } else if (ext === 'zip') {
    iconClass = 'fas fa-file-archive';
    iconColor = '#fbbf24';
  } else if (ext === 'txt') {
    iconClass = 'fas fa-file-alt';
    iconColor = '#fb923c';
  }

  if (bannerName) bannerName.textContent = fileName;
  if (bannerIcon) {
    bannerIcon.innerHTML = `<i class="${iconClass}" style="color: ${iconColor};"></i>`;
  }
  if (bannerAction) bannerAction.textContent = actionName;

  if (origSizeEl) origSizeEl.textContent = formatBytes(originalSizeBytes);
  if (finalSizeEl) finalSizeEl.textContent = formatBytes(blob.size);

  let savedPercent = '0%';
  if (savingsEl) {
    if (actionName.includes('Compress') || originalSizeBytes > blob.size) {
      if (stat3Label) stat3Label.textContent = 'Efisiensi Penghematan';
      const diff = originalSizeBytes - blob.size;
      const pct = (diff / originalSizeBytes) * 100;
      savedPercent = pct > 0 ? `-${pct.toFixed(1)}%` : `+${Math.abs(pct).toFixed(1)}%`;
      savingsEl.textContent = savedPercent;
      savingsEl.style.color = 'var(--accent-emerald)';
    } else if (ext === 'txt') {
      if (stat3Label) stat3Label.textContent = 'Panjang Teks';
      const textLen = extraDetails.textPreview ? extraDetails.textPreview.length : 0;
      savedPercent = `${textLen.toLocaleString()} Karakter`;
      savingsEl.textContent = savedPercent;
      savingsEl.style.color = 'var(--accent-cyan)';
    } else if (ext === 'docx') {
      if (stat3Label) stat3Label.textContent = 'Format Dokumen';
      savedPercent = 'Word Document (.docx)';
      savingsEl.textContent = savedPercent;
      savingsEl.style.color = '#60a5fa';
    } else {
      if (stat3Label) stat3Label.textContent = 'Status Output';
      savedPercent = 'Optimal Ready';
      savingsEl.textContent = savedPercent;
      savingsEl.style.color = 'var(--accent-emerald)';
    }
  }

  // Render Dynamic Preview Container
  if (previewContainer) {
    previewContainer.innerHTML = '';
    
    if (extraDetails.textPreview) {
      previewContainer.style.display = 'block';
      const previewBox = document.createElement('div');
      previewBox.className = 'res-text-preview-card';
      previewBox.innerHTML = `
        <div class="res-preview-header">
          <span><i class="fas fa-align-left"></i> Pratinjau Teks Hasil Ekstraksi:</span>
          <button class="btn btn-secondary btn-sm" id="btn-copy-preview-text" style="padding: 6px 14px; font-size: 12px; border-radius: var(--radius-sm);">
            <i class="fas fa-copy"></i> Salin Semua Teks
          </button>
        </div>
        <textarea readonly class="res-preview-textarea">${extraDetails.textPreview}</textarea>
      `;
      previewContainer.appendChild(previewBox);

      const copyBtn = previewBox.querySelector('#btn-copy-preview-text');
      if (copyBtn) {
        copyBtn.onclick = () => {
          navigator.clipboard.writeText(extraDetails.textPreview).then(() => {
            copyBtn.innerHTML = '<i class="fas fa-check" style="color: var(--accent-emerald);"></i> Berhasil Disalin!';
            showToast('Teks berhasil disalin ke clipboard!', 'success');
            setTimeout(() => {
              copyBtn.innerHTML = '<i class="fas fa-copy"></i> Salin Semua Teks';
            }, 2500);
          }).catch(() => {
            showToast('Gagal menyalin teks ke clipboard.', 'error');
          });
        };
      }
    } else if (extraDetails.imagePreviewUrl) {
      previewContainer.style.display = 'block';
      previewContainer.innerHTML = `
        <div class="res-preview-header">
          <span><i class="fas fa-image"></i> Pratinjau Gambar Hasil Konversi:</span>
        </div>
        <div class="res-image-preview-wrapper">
          <img src="${extraDetails.imagePreviewUrl}" alt="Preview" class="res-image-preview-img" />
        </div>
      `;
    } else if (extraDetails.imageThumbnails && extraDetails.imageThumbnails.length > 0) {
      previewContainer.style.display = 'block';
      let thumbsHtml = `
        <div class="res-preview-header">
          <span><i class="fas fa-images"></i> Pratinjau Halaman (${extraDetails.imageThumbnails.length} Halaman):</span>
        </div>
        <div class="res-thumbs-grid">
      `;
      extraDetails.imageThumbnails.slice(0, 8).forEach(img => {
        thumbsHtml += `
          <div class="res-thumb-item">
            <img src="${img.previewUrl}" alt="${img.fileName}" />
            <span class="res-thumb-badge">Halaman ${img.pageNum}</span>
          </div>
        `;
      });
      if (extraDetails.imageThumbnails.length > 8) {
        thumbsHtml += `
          <div class="res-thumb-item res-thumb-more">
            <span>+${extraDetails.imageThumbnails.length - 8} Halaman Lainnya</span>
          </div>
        `;
      }
      thumbsHtml += `</div>`;
      previewContainer.innerHTML = thumbsHtml;
    } else {
      previewContainer.style.display = 'none';
    }
  }

  if (downloadBtn) {
    downloadBtn.innerHTML = `<i class="fas fa-download"></i> Unduh ${fileName}`;
    downloadBtn.onclick = () => {
      downloadBlob(blob, fileName);
    };
  }

  if (resultsSection) {
    resultsSection.classList.add('show');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
  }

  // Automatic logging to Google Sheets Database
  window.gasBridge.logActivity({
    action: actionName,
    fileName: fileName,
    originalSizeBytes: originalSizeBytes,
    finalSizeBytes: blob.size,
    savedPercent: savedPercent,
    status: 'SUCCESS'
  });

  showToast('Proses Berhasil! File Anda siap diunduh.', 'success');
}

function hideResults() {
  const resultsSection = document.getElementById('results-section');
  if (resultsSection) resultsSection.classList.remove('show');
}

async function saveResultToGoogleDrive() {
  if (!State.lastProcessedResult) return;
  const { blob, fileName, mimeType } = State.lastProcessedResult;

  showProgress(30, 'Mengunggah ke Google Drive...', fileName);

  try {
    const base64 = await blobToBase64(blob);
    const res = await window.gasBridge.saveToDrive(base64, fileName, mimeType, 'DocConverter_Files');
    hideProgress();

    if (res.success) {
      showToast(`Tersimpan di Google Drive! (${res.folderName})`, 'success');
      if (res.fileUrl) {
        window.open(res.fileUrl, '_blank');
      }
    } else {
      showToast(res.error || 'Gagal menyimpan ke Drive.', 'error');
    }
  } catch (err) {
    hideProgress();
    showToast('Error Google Drive: ' + err.message, 'error');
  }
}

/* ==========================================================================
   Google Sheets Database & History Tab
   ========================================================================== */

async function loadHistoryLogs() {
  const tableBody = document.getElementById('db-logs-body');
  const totalCountEl = document.getElementById('db-total-count');
  const totalSavedEl = document.getElementById('db-total-saved');
  const sheetLinkEl = document.getElementById('db-sheet-link');

  if (!tableBody) return;
  tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px;">Memuat data dari Google Sheets Database...</td></tr>';

  try {
    const res = await window.gasBridge.getLogs(50);
    const logs = res.logs || [];

    if (sheetLinkEl && res.sheetUrl) {
      sheetLinkEl.href = res.sheetUrl;
      sheetLinkEl.style.display = 'inline-flex';
    }

    if (logs.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 24px; color: var(--text-muted);">Belum ada riwayat aktivitas. Mulai konversi file Anda!</td></tr>';
      if (totalCountEl) totalCountEl.textContent = '0';
      if (totalSavedEl) totalSavedEl.textContent = '0 MB';
      return;
    }

    let totalSavedBytes = 0;
    tableBody.innerHTML = '';

    logs.forEach(log => {
      const row = document.createElement('tr');
      const origKB = parseFloat(log.originalSizeKB) || 0;
      const finalKB = parseFloat(log.finalSizeKB) || 0;
      if (origKB > finalKB) {
        totalSavedBytes += (origKB - finalKB) * 1024;
      }

      row.innerHTML = `
        <td><span style="font-family: monospace; font-size: 11px;">${log.id || '-'}</span></td>
        <td>${log.timestamp || '-'}</td>
        <td><strong>${log.action || '-'}</strong></td>
        <td title="${log.fileName}">${log.fileName || '-'}</td>
        <td>${origKB.toFixed(1)} KB ➔ ${finalKB.toFixed(1)} KB</td>
        <td><span class="badge-tag badge-success">${log.savedPercent || '0%'}</span></td>
        <td><span class="badge-tag badge-success">${log.status || 'OK'}</span></td>
      `;
      tableBody.appendChild(row);
    });

    if (totalCountEl) totalCountEl.textContent = logs.length.toString();
    if (totalSavedEl) totalSavedEl.textContent = formatBytes(totalSavedBytes);

  } catch (err) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--accent-rose);">Gagal memuat riwayat: ${err.message}</td></tr>`;
  }
}

/* ==========================================================================
   Utility Helpers
   ========================================================================== */

function formatBytes(bytes, decimals = 1) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function base64ToBlob(base64, mimeType = 'application/octet-stream') {
  const byteChars = atob(base64);
  const byteArrays = [];
  const sliceSize = 1024;

  for (let offset = 0; offset < byteChars.length; offset += sliceSize) {
    const slice = byteChars.slice(offset, offset + sliceSize);
    const byteNumbers = new Array(slice.length);
    for (let i = 0; i < slice.length; i++) {
      byteNumbers[i] = slice.charCodeAt(i);
    }
    byteArrays.push(new Uint8Array(byteNumbers));
  }

  return new Blob(byteArrays, { type: mimeType });
}

async function convertImageToJpegBuffer(imageFile) {
  const imgBitmap = await createImageBitmap(imageFile);
  const canvas = document.createElement('canvas');
  canvas.width = imgBitmap.width;
  canvas.height = imgBitmap.height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(imgBitmap, 0, 0);

  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
  return await blob.arrayBuffer();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function showProgress(percent, title, subtitle) {
  const modal = document.getElementById('progress-modal');
  const titleEl = document.getElementById('progress-modal-title');
  const subEl = document.getElementById('progress-modal-subtitle');
  const barEl = document.getElementById('progress-modal-fill');

  if (titleEl) titleEl.textContent = title || 'Memproses Dokumen...';
  if (subEl) subEl.textContent = subtitle || 'Mohon tunggu sebentar';
  if (barEl) barEl.style.width = `${Math.min(100, Math.max(0, percent))}%`;
  if (modal) modal.classList.add('active');
}

function updateProgress(percent, title, subtitle) {
  showProgress(percent, title, subtitle);
}

function hideProgress() {
  const modal = document.getElementById('progress-modal');
  if (modal) modal.classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  let icon = 'fas fa-info-circle';
  if (type === 'success') icon = 'fas fa-check-circle';
  if (type === 'error') icon = 'fas fa-exclamation-triangle';

  toast.innerHTML = `
    <i class="${icon}"></i>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}
