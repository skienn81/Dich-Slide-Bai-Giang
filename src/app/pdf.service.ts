/* eslint-disable @typescript-eslint/no-explicit-any */
import { Injectable } from '@angular/core';
import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

export interface PdfCropResult {
  fileBase64: string;
  croppedFile: File;
}

@Injectable({
  providedIn: 'root'
})
export class PdfService {

  async hashFile(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    // Thêm mốc thời gian (timestamp) để đảm bảo tính duy nhất tuyệt đối cho mỗi phiên dịch,
    // tránh trùng lặp hoặc chia sẻ tài nguyên ảnh giữa các lần dịch khác nhau.
    return `${sha256}_${Date.now()}`;
  }

  async extractImagesFromPDF(file: File, pdfHash: string): Promise<{ id: string, dataUrl: string }[]> {
    const arrayBuffer = await file.arrayBuffer();
    const data = new Uint8Array(arrayBuffer.slice(0));
    const pdf = await pdfjsLib.getDocument({ data }).promise;
    const images: { id: string, dataUrl: string }[] = [];
    let imgCount = 0;

    const validObjectTypes = [
      (pdfjsLib as any).OPS?.paintImageXObject,
      (pdfjsLib as any).OPS?.paintInlineImageXObject,
      (pdfjsLib as any).OPS?.paintImageXObjectRepeat
    ].filter(v => v !== undefined);

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);

        // Render page onto an off-screen canvas.
        // In PDF.js, rendering is MANDATORY to trigger the worker pipeline that decodes
        // and resolves all paintImageXObject data into page.objs and page.commonObjs!
        const viewport = page.getViewport({ scale: 1.5 });
        const renderCanvas = document.createElement('canvas');
        renderCanvas.width = viewport.width;
        renderCanvas.height = viewport.height;
        const renderCtx = renderCanvas.getContext('2d');
        if (renderCtx) {
          try {
            await page.render({ canvas: renderCanvas, canvasContext: renderCtx, viewport }).promise;
          } catch (renderErr) {
            console.warn(`[PDF Processor] Lỗi render trang ${pageNum}:`, renderErr);
          }
        }

        const processedNames = new Set<string>();

        const extractFromObj = (imgData: any, name: string) => {
          if (!imgData || processedNames.has(name)) return;
          processedNames.add(name);

          try {
            const width = imgData.width || (imgData.bitmap && imgData.bitmap.width) || (typeof ImageBitmap !== 'undefined' && imgData instanceof ImageBitmap ? imgData.width : 0);
            const height = imgData.height || (imgData.bitmap && imgData.bitmap.height) || (typeof ImageBitmap !== 'undefined' && imgData instanceof ImageBitmap ? imgData.height : 0);

            if (!width || !height) return;
            // Lower threshold to 30px so formulas, small diagrams, icons, and plots are not discarded
            if (width < 30 || height < 30) return;

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            if (typeof ImageBitmap !== 'undefined' && imgData instanceof ImageBitmap) {
              ctx.drawImage(imgData, 0, 0);
            } else if (imgData.bitmap) {
              ctx.drawImage(imgData.bitmap, 0, 0);
            } else if (imgData.data) {
              const imgImageData = ctx.createImageData(width, height);
              const srcData = imgData.data;
              const destData = imgImageData.data;

              if (srcData.length === width * height * 3) {
                let j = 0;
                for (let k = 0; k < srcData.length; k += 3) {
                  destData[j] = srcData[k];
                  destData[j + 1] = srcData[k + 1];
                  destData[j + 2] = srcData[k + 2];
                  destData[j + 3] = 255;
                  j += 4;
                }
              } else if (srcData.length === width * height * 4) {
                destData.set(srcData);
              } else if (srcData.length === width * height) {
                let j = 0;
                for (const val of srcData) {
                  destData[j] = val;
                  destData[j + 1] = val;
                  destData[j + 2] = val;
                  destData[j + 3] = 255;
                  j += 4;
                }
              } else {
                try {
                  destData.set(srcData.subarray(0, destData.length));
                } catch {
                  return;
                }
              }
              ctx.putImageData(imgImageData, 0, 0);
            } else if (imgData instanceof HTMLImageElement || (imgData.image && imgData.image instanceof HTMLImageElement)) {
              ctx.drawImage(imgData.image || imgData, 0, 0);
            } else {
              return;
            }

            let targetW = width;
            let targetH = height;
            if (targetW > 1024) {
              const scale = 1024 / targetW;
              targetW = 1024;
              targetH = Math.round(targetH * scale);
            }

            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = targetW;
            tempCanvas.height = targetH;
            const tempCtx = tempCanvas.getContext('2d');
            if (tempCtx) {
              tempCtx.imageSmoothingEnabled = true;
              tempCtx.imageSmoothingQuality = 'high';
              tempCtx.drawImage(canvas, 0, 0, targetW, targetH);
              const dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
              // Clean ID format
              images.push({ id: `${pdfHash}_img_${imgCount++}`, dataUrl });
            }
          } catch (err) {
            console.warn(`[PDF Processor] Lỗi khi xử lý điểm ảnh ${name} trang ${pageNum}:`, err);
          }
        };

        // 1. Process images referenced in the operator list
        const operatorList = await page.getOperatorList();
        for (let i = 0; i < operatorList.fnArray.length; i++) {
          const fn = operatorList.fnArray[i];
          if (validObjectTypes.includes(fn)) {
            const imgName = operatorList.argsArray[i][0];
            if (typeof imgName === 'object' && imgName !== null) {
              extractFromObj(imgName, `inline_${pageNum}_${i}`);
            } else if (typeof imgName === 'string') {
              let imgObj: any = null;
              try {
                if ((page as any).objs && typeof (page as any).objs.has === 'function' && (page as any).objs.has(imgName)) {
                  imgObj = (page as any).objs.get(imgName);
                }
                if (!imgObj && (page as any).commonObjs && typeof (page as any).commonObjs.has === 'function' && (page as any).commonObjs.has(imgName)) {
                  imgObj = (page as any).commonObjs.get(imgName);
                }
              } catch (getErr) {
                console.warn(`[PDF Processor] Không thể lấy object ${imgName}:`, getErr);
              }

              if (imgObj) {
                extractFromObj(imgObj, imgName);
              }
            }
          }
        }

        // 2. Also inspect any resolved objects in page.objs and page.commonObjs
        try {
          const pageObjs = (page as any).objs;
          if (pageObjs && typeof pageObjs[Symbol.iterator] === 'function') {
            for (const [id, obj] of pageObjs) {
              if (obj && (obj.data || obj.bitmap || (obj.width && obj.height) || (typeof ImageBitmap !== 'undefined' && obj instanceof ImageBitmap))) {
                extractFromObj(obj, String(id));
              }
            }
          }
        } catch { /* ignore iterator error */ }

        try {
          const commonObjs = (page as any).commonObjs;
          if (commonObjs && typeof commonObjs[Symbol.iterator] === 'function') {
            for (const [id, obj] of commonObjs) {
              if (obj && (obj.data || obj.bitmap || (obj.width && obj.height) || (typeof ImageBitmap !== 'undefined' && obj instanceof ImageBitmap))) {
                extractFromObj(obj, String(id));
              }
            }
          }
        } catch { /* ignore iterator error */ }

        // 3. Quét phát hiện Figure/Fig. và tự động cắt sơ đồ mạch / đồ thị vector trực tiếp từ canvas trang PDF
        try {
          const textContent = await page.getTextContent();
          const items = (textContent?.items || []) as any[];

          interface LineBlock {
            text: string;
            x: number;
            y: number;
            w: number;
            h: number;
          }

          const lines: LineBlock[] = [];
          for (const it of items) {
            if (!it.str || !it.transform) continue;
            const x = it.transform[4];
            const y = it.transform[5];
            const w = it.width || 0;
            const h = it.height || Math.abs(it.transform[0]) || 12;

            const existing = lines.find(l => Math.abs(l.y - y) < 4);
            if (existing) {
              existing.text += ' ' + it.str;
              existing.w = Math.max(existing.w, x + w - existing.x);
            } else {
              lines.push({ text: it.str, x, y, w, h });
            }
          }

          // Sắp xếp các dòng từ trên xuống dưới (trong hệ tọa độ PDF, y lớn hơn là nằm cao hơn)
          lines.sort((a, b) => b.y - a.y);

          for (let li = 0; li < lines.length; li++) {
            const line = lines[li];
            const trimmed = line.text.trim();
            // Bắt các mẫu: Figure 6.1, Figure P6.28, Figure E6.13, Fig. 6.3, (b) Figure 6.12...
            const match = trimmed.match(/(?:^|\b)(?:Figure|Fig\.)\s+((?:[A-Z0-9]+[.-])?[A-Z0-9]+(?:\.[A-Z0-9]+)?)/i);
            if (match) {
              const rawFigNum = match[1];
              const figId = rawFigNum.replace(/[^a-zA-Z0-9_]/g, '_');
              const imageId = `${pdfHash}_fig_${figId}`;

              if (images.some(img => img.id === imageId)) continue;

              // Tọa độ y trong PDF tính từ đáy lên. Sơ đồ/hình vẽ nằm ở phía TRÊN dòng caption (y lớn hơn).
              const pageH = page.view ? page.view[3] : viewport.height / 1.5;
              // Tìm dòng văn bản chính (body paragraph) hoặc caption liền kề phía trên để xác định đỉnh hình
              let topPdfY = pageH - 45;
              for (let pi = li - 1; pi >= 0; pi--) {
                const prev = lines[pi];
                if (prev.y > line.y + 25) {
                  const isBodyOrHeader = prev.w > 160 || prev.text.trim().length > 35 || /(?:^|\b)(?:Figure|Fig\.)/i.test(prev.text.trim()) || prev.y >= pageH - 55;
                  if (isBodyOrHeader) {
                    topPdfY = prev.y - 6;
                    break;
                  }
                }
              }

              // Đáy ảnh bao gồm cả dòng chú thích để hình ảnh trọn vẹn
              const bottomPdfY = line.y - (line.h || 12) - 6;
              const heightPdf = topPdfY - bottomPdfY;

              if (heightPdf > 40) {
                const pageW = page.view ? page.view[2] : viewport.width / 1.5;
                const ptTop = viewport.convertToViewportPoint(25, topPdfY);
                const ptBottom = viewport.convertToViewportPoint(pageW - 25, bottomPdfY);

                const cropX = Math.max(0, Math.min(ptTop[0], ptBottom[0]));
                const cropY = Math.max(0, Math.min(ptTop[1], ptBottom[1]));
                const cropW = Math.min(renderCanvas.width - cropX, Math.abs(ptBottom[0] - ptTop[0]));
                const cropH = Math.min(renderCanvas.height - cropY, Math.abs(ptBottom[1] - ptTop[1]));

                if (cropW > 80 && cropH > 40) {
                  const figCanvas = document.createElement('canvas');
                  figCanvas.width = cropW;
                  figCanvas.height = cropH;
                  const figCtx = figCanvas.getContext('2d');
                  if (figCtx) {
                    figCtx.imageSmoothingEnabled = true;
                    figCtx.imageSmoothingQuality = 'high';
                    figCtx.drawImage(renderCanvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
                    const dataUrl = figCanvas.toDataURL('image/jpeg', 0.95);
                    images.push({ id: imageId, dataUrl });
                  }
                }
              }
            }
          }
        } catch (textErr) {
          console.warn(`[PDF Processor] Lỗi phát hiện/cắt sơ đồ trang ${pageNum}:`, textErr);
        }

      } catch (err) {
        console.warn(`[PDF Processor] Lỗi xử lý trang ${pageNum} để trích xuất ảnh:`, err);
      }
    }

    return images;
  }

  async getPageCount(file: File): Promise<number> {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    return pdfDoc.getPageCount();
  }

  async cropPdf(file: File, start: number, end: number, totalPages: number): Promise<PdfCropResult> {
    if (start > end) {
      throw new Error('Trang bắt đầu không được lớn hơn trang kết thúc.');
    }

    const arrayBuffer = await file.arrayBuffer();
    const originalPdf = await PDFDocument.load(arrayBuffer);
    const newPdf = await PDFDocument.create();

    const pageIndices = [];
    for (let i = start - 1; i < Math.min(end, totalPages); i++) {
      pageIndices.push(i);
    }

    const copiedPages = await newPdf.copyPages(originalPdf, pageIndices);
    copiedPages.forEach(page => newPdf.addPage(page));

    const pdfBytes = await newPdf.save();
    const croppedBlob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const croppedFileObj = new File([croppedBlob], file.name, { type: 'application/pdf' });

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = (reader.result as string).split(',')[1];
        resolve({
          fileBase64: base64String,
          croppedFile: croppedFileObj
        });
      };
      reader.onerror = () => reject(new Error('Lỗi khi đọc file cắt.'));
      reader.readAsDataURL(croppedFileObj);
    });
  }
}
