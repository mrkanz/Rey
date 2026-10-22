/**
 * Doc & PDF Master Suite - Google Apps Script Backend
 * Handles Office to PDF, PDF to Office (OCR/Drive Engine), Google Sheets Database Logging,
 * and Google Drive Storage Integration.
 */

// Configuration Constants
const CONFIG = {
  DB_SHEET_NAME: 'DocConverter_Database',
  DRIVE_STORAGE_FOLDER: 'DocConverter_Files',
  TEMP_TAG: '[TEMP_DOCCONV]'
};

/**
 * Serves the Web App UI
 */
/**
 * Serves the Web App UI (supports both single file and modular templates with include)
 */
function doGet(e) {
  try {
    return HtmlService.createTemplateFromFile('Index')
      .evaluate()
      .setTitle('Doc & PDF Master Suite | Ultimate Converter & Compressor')
      .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  } catch (err) {
    try {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('Doc & PDF Master Suite | Ultimate Converter & Compressor')
        .addMetaTag('viewport', 'width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    } catch (fallbackErr) {
      return HtmlService.createHtmlOutput('<h3>Error loading application: ' + err.message + '</h3>');
    }
  }
}

/**
 * Helper function to include HTML/CSS/JS files in Google Apps Script templates
 */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/**
 * Handles REST API POST requests for standalone web clients or mobile callers
 */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.tryLock(30000);
  
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    } else if (e && e.parameter) {
      payload = e.parameter;
    }
    
    const action = payload.action || 'ping';
    let result = { success: false, message: 'Action not recognized' };

    switch (action) {
      case 'ping':
        result = { success: true, message: 'DocConverter GAS Backend is Online!', timestamp: new Date().toISOString() };
        break;

      case 'convertOfficeToPdf':
        result = convertOfficeToPdf(payload.fileBase64, payload.fileName, payload.mimeType);
        break;

      case 'convertPdfToOffice':
        result = convertPdfToOffice(payload.fileBase64, payload.fileName, payload.targetFormat);
        break;

      case 'saveToDrive':
        result = saveToDriveFolder(payload.fileBase64, payload.fileName, payload.mimeType, payload.folderName);
        break;

      case 'logActivity':
        result = logActivityToSheet(payload.data);
        break;

      case 'getLogs':
        result = getDatabaseLogs(payload.limit || 50);
        break;

      case 'cleanup':
        result = cleanupTempFiles();
        break;

      default:
        result = { success: false, message: 'Unknown action: ' + action };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

/**
 * Converts Word (.docx/.doc), Excel (.xlsx/.xls), PPT (.pptx/.ppt), and Images to high-fidelity PDF
 * using Google Drive's native conversion engine.
 */
function convertOfficeToPdf(fileBase64, fileName, mimeType) {
  let tempFile = null;
  let tempConvertedFile = null;
  
  try {
    if (!fileBase64) throw new Error('File data is empty');
    
    const decodedBytes = Utilities.base64Decode(fileBase64);
    const originalSize = decodedBytes.length;
    const blob = Utilities.newBlob(decodedBytes, mimeType || 'application/octet-stream', fileName || 'document');
    
    // Determine the Google Drive target mime type for native document conversion
    let targetMimeType = null;
    const lowerName = (fileName || '').toLowerCase();
    
    if (lowerName.endsWith('.docx') || lowerName.endsWith('.doc') || mimeType.includes('word') || mimeType.includes('officedocument.wordprocessingml')) {
      targetMimeType = MimeType.GOOGLE_DOCS;
    } else if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || mimeType.includes('excel') || mimeType.includes('spreadsheet')) {
      targetMimeType = MimeType.GOOGLE_SHEETS;
    } else if (lowerName.endsWith('.pptx') || lowerName.endsWith('.ppt') || mimeType.includes('presentation') || mimeType.includes('powerpoint')) {
      targetMimeType = MimeType.GOOGLE_SLIDES;
    }

    let pdfBlob = null;

    if (targetMimeType) {
      // Use Drive API v2/v3 Advanced Service if enabled, or DriveApp fallback
      if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.insert) {
        const fileMetadata = {
          title: CONFIG.TEMP_TAG + ' ' + (fileName || 'doc'),
          mimeType: targetMimeType
        };
        tempConvertedFile = Drive.Files.insert(fileMetadata, blob, { convert: true });
        
        // Fetch exported PDF
        const pdfFileId = tempConvertedFile.id;
        const driveFile = DriveApp.getFileById(pdfFileId);
        pdfBlob = driveFile.getAs(MimeType.PDF);
      } else {
        // Fallback using DriveApp
        tempFile = DriveApp.createFile(blob);
        tempFile.setName(CONFIG.TEMP_TAG + ' ' + (fileName || 'doc'));
        pdfBlob = tempFile.getAs(MimeType.PDF);
      }
    } else {
      // Direct image or other convertible format
      tempFile = DriveApp.createFile(blob);
      tempFile.setName(CONFIG.TEMP_TAG + ' ' + (fileName || 'doc'));
      pdfBlob = tempFile.getAs(MimeType.PDF);
    }

    if (!pdfBlob) {
      throw new Error('Gagal menghasilkan PDF dari file ini.');
    }

    const pdfBytes = pdfBlob.getBytes();
    const resultBase64 = Utilities.base64Encode(pdfBytes);
    const outputName = (fileName ? fileName.substring(0, fileName.lastIndexOf('.')) : 'converted') + '.pdf';

    // Log to Google Sheet Database
    try {
      logActivityToSheet({
        action: 'Convert to PDF',
        fileName: fileName,
        inputType: fileName.split('.').pop().toUpperCase(),
        outputType: 'PDF',
        originalSizeBytes: originalSize,
        finalSizeBytes: pdfBytes.length,
        status: 'SUCCESS'
      });
    } catch (logErr) {
      console.warn('Logging error:', logErr);
    }

    return {
      success: true,
      fileName: outputName,
      mimeType: 'application/pdf',
      fileBase64: resultBase64,
      originalSize: originalSize,
      finalSize: pdfBytes.length
    };

  } catch (err) {
    return {
      success: false,
      error: 'Konversi Gagal: ' + err.message
    };
  } finally {
    // Cleanup temporary files
    try {
      if (tempFile) tempFile.setTrashed(true);
      if (tempConvertedFile && tempConvertedFile.id) {
        DriveApp.getFileById(tempConvertedFile.id).setTrashed(true);
      }
    } catch (cleanErr) {
      console.warn('Cleanup error:', cleanErr);
    }
  }
}

/**
 * Converts PDF to Word (.docx) or Text using Google OCR / Drive Docs Engine
 */
function convertPdfToOffice(fileBase64, fileName, targetFormat) {
  let tempPdf = null;
  let tempDoc = null;
  
  try {
    if (!fileBase64) throw new Error('File data is empty');
    
    const decodedBytes = Utilities.base64Decode(fileBase64);
    const originalSize = decodedBytes.length;
    const blob = Utilities.newBlob(decodedBytes, 'application/pdf', fileName || 'document.pdf');
    targetFormat = (targetFormat || 'docx').toLowerCase();

    let outputBlob = null;
    let outputName = '';
    let outputMime = '';

    if (targetFormat === 'docx' || targetFormat === 'doc') {
      // Use Drive API insert with convert: true & ocr: true to convert PDF to Google Docs
      if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.insert) {
        const fileMetadata = {
          title: CONFIG.TEMP_TAG + ' OCR ' + (fileName || 'pdf_doc'),
          mimeType: MimeType.GOOGLE_DOCS
        };
        tempDoc = Drive.Files.insert(fileMetadata, blob, { ocr: true, convert: true });
        
        // Export Google Doc as Microsoft Word (.docx)
        const docId = tempDoc.id;
        let exportUrl = null;
        try {
          const fileInfo = Drive.Files.get(docId);
          if (fileInfo && fileInfo.exportLinks && fileInfo.exportLinks['application/vnd.openxmlformats-officedocument.wordprocessingml.document']) {
            exportUrl = fileInfo.exportLinks['application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
          }
        } catch (linkErr) {
          console.warn('Could not read exportLinks:', linkErr);
        }

        if (!exportUrl) {
          exportUrl = 'https://docs.google.com/feeds/download/documents/export/Export?id=' + docId + '&exportFormat=docx';
        }

        const response = UrlFetchApp.fetch(exportUrl, {
          headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
          muteHttpExceptions: true
        });

        if (response.getResponseCode() !== 200) {
          throw new Error('Gagal mengunduh file Word dari Google Docs (HTTP ' + response.getResponseCode() + ')');
        }
        
        outputBlob = response.getBlob();
        outputName = (fileName ? fileName.substring(0, fileName.lastIndexOf('.')) : 'converted') + '.docx';
        outputMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      } else {
        throw new Error('Layanan Advanced Drive Service (v2) diperlukan di Google Apps Script backend untuk OCR Word di cloud.');
      }
    } else if (targetFormat === 'txt') {
      // Extract text via Google Docs OCR
      if (typeof Drive !== 'undefined' && Drive.Files && Drive.Files.insert) {
        const fileMetadata = {
          title: CONFIG.TEMP_TAG + ' OCR_TXT ' + (fileName || 'pdf_doc'),
          mimeType: MimeType.GOOGLE_DOCS
        };
        tempDoc = Drive.Files.insert(fileMetadata, blob, { ocr: true, convert: true });
        const doc = DocumentApp.openById(tempDoc.id);
        const textContent = doc.getBody().getText();
        
        outputBlob = Utilities.newBlob(textContent, 'text/plain', (fileName ? fileName.substring(0, fileName.lastIndexOf('.')) : 'converted') + '.txt');
        outputName = (fileName ? fileName.substring(0, fileName.lastIndexOf('.')) : 'converted') + '.txt';
        outputMime = 'text/plain';
      } else {
        throw new Error('Layanan Advanced Drive Service (v2) diperlukan di Google Apps Script backend untuk OCR Teks di cloud.');
      }
    } else {
      throw new Error('Format target ' + targetFormat + ' belum didukung langsung di cloud.');
    }

    const outputBytes = outputBlob.getBytes();
    const resultBase64 = Utilities.base64Encode(outputBytes);

    // Log Activity
    try {
      logActivityToSheet({
        action: 'Convert PDF to ' + targetFormat.toUpperCase(),
        fileName: fileName,
        inputType: 'PDF',
        outputType: targetFormat.toUpperCase(),
        originalSizeBytes: originalSize,
        finalSizeBytes: outputBytes.length,
        status: 'SUCCESS'
      });
    } catch (logErr) {
      console.warn('Logging error:', logErr);
    }

    return {
      success: true,
      fileName: outputName,
      mimeType: outputMime,
      fileBase64: resultBase64,
      originalSize: originalSize,
      finalSize: outputBytes.length
    };

  } catch (err) {
    return {
      success: false,
      error: 'Konversi PDF ke Office Gagal: ' + err.message
    };
  } finally {
    try {
      if (tempPdf) tempPdf.setTrashed(true);
      if (tempDoc && tempDoc.id) {
        DriveApp.getFileById(tempDoc.id).setTrashed(true);
      }
    } catch (e) {
      console.warn('Cleanup error:', e);
    }
  }
}

/**
 * Saves converted/compressed files directly into user's Google Drive
 */
function saveToDriveFolder(fileBase64, fileName, mimeType, customFolder) {
  try {
    if (!fileBase64) throw new Error('No file data provided');
    
    const folderName = customFolder || CONFIG.DRIVE_STORAGE_FOLDER;
    let targetFolder = null;
    const folders = DriveApp.getFoldersByName(folderName);
    
    if (folders.hasNext()) {
      targetFolder = folders.next();
    } else {
      targetFolder = DriveApp.createFolder(folderName);
    }

    const decodedBytes = Utilities.base64Decode(fileBase64);
    const blob = Utilities.newBlob(decodedBytes, mimeType || 'application/octet-stream', fileName || 'output_file');
    const createdFile = targetFolder.createFile(blob);
    
    return {
      success: true,
      fileId: createdFile.getId(),
      fileName: createdFile.getName(),
      fileUrl: createdFile.getUrl(),
      downloadUrl: createdFile.getDownloadUrl(),
      folderName: folderName,
      size: createdFile.getSize()
    };
  } catch (err) {
    return {
      success: false,
      error: 'Gagal menyimpan ke Google Drive: ' + err.message
    };
  }
}

/**
 * Logs conversion & compression activities to a Google Sheets Database
 */
function logActivityToSheet(data) {
  try {
    data = data || {};
    let ss = null;
    const files = DriveApp.getFilesByName(CONFIG.DB_SHEET_NAME);
    
    if (files.hasNext()) {
      ss = SpreadsheetApp.open(files.next());
    } else {
      ss = SpreadsheetApp.create(CONFIG.DB_SHEET_NAME);
      const sheet = ss.getActiveSheet();
      sheet.setName('Activity_Logs');
      
      // Setup beautiful header
      const headers = [
        'Log ID',
        'Timestamp',
        'Action / Tool',
        'File Name',
        'Input Format',
        'Output Format',
        'Original Size (KB)',
        'Final Size (KB)',
        'Saved / Compression (%)',
        'Status',
        'Client Environment'
      ];
      
      sheet.appendRow(headers);
      
      // Style headers
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setBackground('#4f46e5');
      headerRange.setFontColor('#ffffff');
      headerRange.setFontWeight('bold');
      headerRange.setHorizontalAlignment('center');
      sheet.setFrozenRows(1);
    }

    const sheet = ss.getSheetByName('Activity_Logs') || ss.getActiveSheet();
    const timestamp = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyy-MM-dd HH:mm:ss');
    const logId = 'LOG-' + Utilities.getUuid().substring(0, 8).toUpperCase();
    
    const origKB = data.originalSizeBytes ? (data.originalSizeBytes / 1024).toFixed(2) : (data.originalSizeKB || '0');
    const finalKB = data.finalSizeBytes ? (data.finalSizeBytes / 1024).toFixed(2) : (data.finalSizeKB || '0');
    
    let savedPercent = '0%';
    if (Number(origKB) > 0 && Number(finalKB) > 0) {
      const diff = Number(origKB) - Number(finalKB);
      const pct = (diff / Number(origKB)) * 100;
      savedPercent = pct > 0 ? pct.toFixed(1) + '%' : '0%';
    }

    const newRow = [
      logId,
      timestamp,
      data.action || 'Conversion/Compression',
      data.fileName || 'Unnamed',
      data.inputType || '-',
      data.outputType || '-',
      origKB,
      finalKB,
      savedPercent,
      data.status || 'SUCCESS',
      data.client || 'Web Browser'
    ];

    sheet.appendRow(newRow);

    return {
      success: true,
      logId: logId,
      sheetUrl: ss.getUrl()
    };

  } catch (err) {
    console.error('Database logging error:', err);
    return {
      success: false,
      error: err.message
    };
  }
}

/**
 * Returns latest transaction history from Google Sheets database
 */
function getDatabaseLogs(limit) {
  try {
    limit = limit || 50;
    const files = DriveApp.getFilesByName(CONFIG.DB_SHEET_NAME);
    if (!files.hasNext()) {
      return { success: true, logs: [], sheetUrl: null };
    }

    const ss = SpreadsheetApp.open(files.next());
    const sheet = ss.getSheetByName('Activity_Logs') || ss.getActiveSheet();
    const lastRow = sheet.getLastRow();
    
    if (lastRow <= 1) {
      return { success: true, logs: [], sheetUrl: ss.getUrl() };
    }

    const numRows = Math.min(limit, lastRow - 1);
    const startRow = lastRow - numRows + 1;
    const values = sheet.getRange(startRow, 1, numRows, 11).getValues();
    
    const logs = values.map(function(row) {
      return {
        id: row[0],
        timestamp: row[1],
        action: row[2],
        fileName: row[3],
        inputType: row[4],
        outputType: row[5],
        originalSizeKB: row[6],
        finalSizeKB: row[7],
        savedPercent: row[8],
        status: row[9],
        client: row[10]
      };
    }).reverse(); // Most recent first

    return {
      success: true,
      logs: logs,
      sheetUrl: ss.getUrl()
    };

  } catch (err) {
    return {
      success: false,
      error: 'Gagal mengambil data log: ' + err.message
    };
  }
}

/**
 * Cleans up temporary conversion files created in Drive
 */
function cleanupTempFiles() {
  try {
    const files = DriveApp.searchFiles('title contains "' + CONFIG.TEMP_TAG + '" and trashed = false');
    let count = 0;
    while (files.hasNext()) {
      const file = files.next();
      file.setTrashed(true);
      count++;
    }
    return { success: true, cleanedFilesCount: count };
  } catch (err) {
    return { success: false, error: err.message };
  }
}
