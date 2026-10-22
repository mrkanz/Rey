/**
 * Google Apps Script Bridge & API Connector
 * Seamlessly manages communication with Google Apps Script backend
 * Supports both native GAS iframe (google.script.run) and standalone REST mode.
 */

class GASBridge {
  constructor() {
    this.endpointUrl = localStorage.getItem('GAS_WEBAPP_URL') || '';
    this.isNativeGAS = typeof google !== 'undefined' && google.script && google.script.run;
    this.isOnline = false;
  }

  /**
   * Set and save custom GAS Web App URL for standalone hosting
   */
  setEndpointUrl(url) {
    this.endpointUrl = (url || '').trim();
    localStorage.setItem('GAS_WEBAPP_URL', this.endpointUrl);
  }

  getEndpointUrl() {
    return this.endpointUrl;
  }

  /**
   * Test connection to Google Apps Script backend
   */
  async ping() {
    if (this.isNativeGAS) {
      return new Promise((resolve) => {
        google.script.run
          .withSuccessHandler((res) => {
            this.isOnline = true;
            resolve({ success: true, native: true, message: 'Connected to GAS Native Runtime' });
          })
          .withFailureHandler((err) => {
            resolve({ success: false, error: err.message });
          })
          .doPost({ parameter: { action: 'ping' } });
      });
    }

    if (!this.endpointUrl) {
      return { success: false, message: 'Mode Standalone (Client-Side Only / GAS Endpoint belum diatur)' };
    }

    try {
      const response = await fetch(this.endpointUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'ping' })
      });
      const data = await response.json();
      this.isOnline = data.success === true;
      return data;
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  isAvailable() {
    return !!this.isNativeGAS || (typeof this.endpointUrl === 'string' && this.endpointUrl.trim().length > 0);
  }

  /**
   * Convert Word, Excel, PPT, Image to PDF using Google Drive API
   */
  async convertOfficeToPdf(fileBase64, fileName, mimeType) {
    if (this.isNativeGAS) {
      return new Promise((resolve) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler((err) => resolve({ success: false, error: err.message }))
          .convertOfficeToPdf(fileBase64, fileName, mimeType);
      });
    }

    if (this.endpointUrl && this.endpointUrl.trim().length > 0) {
      try {
        const response = await fetch(this.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'convertOfficeToPdf',
            fileBase64: fileBase64,
            fileName: fileName,
            mimeType: mimeType
          })
        });
        return await response.json();
      } catch (err) {
        return { success: false, error: 'Network error: ' + err.message };
      }
    }

    return { success: false, reason: 'NO_GAS_ENDPOINT', error: 'Google Apps Script backend belum terhubung untuk konversi Office. Silakan deploy Code.gs atau atur URL Web App.' };
  }

  /**
   * Convert PDF to Word (.docx) or Text using Google OCR / Docs Engine
   */
  async convertPdfToOffice(fileBase64, fileName, targetFormat) {
    if (this.isNativeGAS) {
      return new Promise((resolve) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler((err) => resolve({ success: false, error: err.message }))
          .convertPdfToOffice(fileBase64, fileName, targetFormat);
      });
    }

    if (this.endpointUrl && this.endpointUrl.trim().length > 0) {
      try {
        const response = await fetch(this.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'convertPdfToOffice',
            fileBase64: fileBase64,
            fileName: fileName,
            targetFormat: targetFormat
          })
        });
        return await response.json();
      } catch (err) {
        return { success: false, error: 'Network error: ' + err.message };
      }
    }

    return { success: false, reason: 'NO_GAS_ENDPOINT', error: 'Google Apps Script backend belum terhubung.' };
  }

  /**
   * Save output file directly into user's Google Drive
   */
  async saveToDrive(fileBase64, fileName, mimeType, folderName) {
    if (this.isNativeGAS) {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .saveToDriveFolder(fileBase64, fileName, mimeType, folderName);
      });
    }

    if (this.endpointUrl) {
      try {
        const response = await fetch(this.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: 'saveToDrive',
            fileBase64: fileBase64,
            fileName: fileName,
            mimeType: mimeType,
            folderName: folderName
          })
        });
        return await response.json();
      } catch (err) {
        return { success: false, error: err.message };
      }
    }

    return { success: false, error: 'Koneksi Google Drive Cloud belum dikonfigurasi.' };
  }

  /**
   * Log transaction into Google Sheets Database
   */
  async logActivity(data) {
    // Also save in localStorage for instant offline access
    this.saveLocalHistory(data);

    if (this.isNativeGAS) {
      return new Promise((resolve) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler((e) => resolve({ success: false, error: e.message }))
          .logActivityToSheet(data);
      });
    }

    if (this.endpointUrl) {
      try {
        const res = await fetch(this.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'logActivity', data: data })
        });
        return await res.json();
      } catch (e) {
        return { success: false, error: e.message };
      }
    }

    return { success: true, localOnly: true };
  }

  /**
   * Get recent logs from Google Sheets Database
   */
  async getLogs(limit = 50) {
    if (this.isNativeGAS) {
      return new Promise((resolve, reject) => {
        google.script.run
          .withSuccessHandler(resolve)
          .withFailureHandler(reject)
          .getDatabaseLogs(limit);
      });
    }

    if (this.endpointUrl) {
      try {
        const res = await fetch(this.endpointUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({ action: 'getLogs', limit: limit })
        });
        return await res.json();
      } catch (e) {
        console.warn('Failed to fetch remote logs:', e);
      }
    }

    // Fallback to local logs
    return {
      success: true,
      logs: this.getLocalHistory(),
      sheetUrl: null
    };
  }

  saveLocalHistory(item) {
    try {
      const history = this.getLocalHistory();
      const newEntry = {
        id: 'LOC-' + Math.random().toString(36).substr(2, 9).toUpperCase(),
        timestamp: new Date().toLocaleString('id-ID'),
        action: item.action || 'Process',
        fileName: item.fileName || 'document',
        inputType: item.inputType || '-',
        outputType: item.outputType || '-',
        originalSizeKB: item.originalSizeBytes ? (item.originalSizeBytes / 1024).toFixed(1) : (item.originalSizeKB || '0'),
        finalSizeKB: item.finalSizeBytes ? (item.finalSizeBytes / 1024).toFixed(1) : (item.finalSizeKB || '0'),
        savedPercent: item.savedPercent || '0%',
        status: item.status || 'SUCCESS',
        client: 'Local Browser'
      };
      history.unshift(newEntry);
      if (history.length > 100) history.pop();
      localStorage.setItem('DOC_CONVERTER_HISTORY', JSON.stringify(history));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }
  }

  getLocalHistory() {
    try {
      return JSON.parse(localStorage.getItem('DOC_CONVERTER_HISTORY') || '[]');
    } catch {
      return [];
    }
  }
}

window.gasBridge = new GASBridge();
