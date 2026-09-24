import { Injectable, signal, computed, inject } from '@angular/core';
import { GeminiService } from './gemini.service';
import { ToastService } from './toast.service';
import { PdfService } from './pdf.service';
import { DbService } from './db.service';
import { StorageService, TranslatedDoc } from './storage.service';
import { PromptService } from './prompt.service';
import { ImageProcessorService, ExtractedImage } from './image-processor.service';

export type TranslationMode = 'lecture_slide' | 'zero_svg' | 'zero_math' | 'normal' | 'phase1' | 'phase2';
export type SearchModel = 'gemini-3.1-flash-lite' | 'gemini-3.8-flash' | 'gemini-flash-lite-latest' | 'gemini-flash-latest';

@Injectable({
  providedIn: 'root'
})
export class TranslationState {
  private geminiService = inject(GeminiService);
  private toastService = inject(ToastService);
  private pdfService = inject(PdfService);
  private dbService = inject(DbService);
  private storageService = inject(StorageService);
  private promptService = inject(PromptService);
  private imageProcessorService = inject(ImageProcessorService);

  private lastTranslationUsageMetadata: { promptTokenCount?: number; candidatesTokenCount?: number; [key: string]: unknown } | null = null;

  readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  readonly MAX_FILE_SIZE_HTML = 0.5 * 1024 * 1024; // 500KB
  readonly MAX_PDF_TOKENS_FLASH = 80000;
  readonly MAX_PDF_TOKENS_PRO = 30000;
  readonly MAX_HTML_TOKENS_FLASH = 120000;
  readonly MAX_HTML_TOKENS_PRO = 35000;

  selectedModel = signal<'gemini-3.8-flash' | 'gemini-pro-latest'>('gemini-3.8-flash');
  selectedFile = signal<File | null>(null);
  fileBase64 = signal<string | null>(null);
  mimeType = signal<string>('');
  
  userApiKey = signal<string>('');
  mode = signal<TranslationMode>('lecture_slide');
  useGoogleSearch = signal<boolean>(false);
  searchModel = signal<SearchModel>('gemini-3.1-flash-lite');
  isRemakeMode = signal<boolean>(false);
  
  isProcessing = signal<boolean>(false);
  progressMessage = signal<string>('');
  error = signal<string | null>(null);
  
  resultHtml = signal<string | null>(null);
  tokenCount = signal<number>(0);
  isCountingTokens = signal<boolean>(false);
  
  pdfTotalPages = signal<number>(0);
  pdfStartPage = signal<number>(1);
  pdfEndPage = signal<number>(1);
  croppedFile = signal<File | null>(null);
  pdfHash = signal<string | null>(null);
  htmlExtractedImages = signal<ExtractedImage[]>([]);
  
  elapsedTime = signal<number>(0);
  isLoadedFromHistory = signal<boolean>(false);
  activeHistoryItemId = signal<number | null>(null);
  historyItems = signal<TranslatedDoc[]>([]);
  rawOriginalFileBlob = signal<Blob | null>(null);

  isPdfUploaded = computed(() => this.mimeType() === 'application/pdf');
  isHtmlUploaded = computed(() => this.mimeType() === 'text/html');
  currentMaxTokens = computed(() => {
    const isFlash = this.selectedModel() === 'gemini-3.8-flash';
    if (this.mimeType() === 'text/html') {
      return isFlash ? this.MAX_HTML_TOKENS_FLASH : this.MAX_HTML_TOKENS_PRO;
    }
    return isFlash ? this.MAX_PDF_TOKENS_FLASH : this.MAX_PDF_TOKENS_PRO;
  });
  hasFile = computed(() => this.selectedFile() !== null);
  hasOriginalFile = computed(() => {
    const file = this.selectedFile();
    if (file && file.size > 0) return true;
    return !!this.rawOriginalFileBlob();
  });
  canProcess = computed(() => this.hasFile() && !this.isProcessing() && !this.isCountingTokens() && this.tokenCount() <= this.currentMaxTokens());
  tokenPercentage = computed(() => Math.min((this.tokenCount() / this.currentMaxTokens()) * 100, 100));
  isTwoPhaseMode = computed(() => this.mode() === 'phase1' || this.mode() === 'phase2');
  
  formattedTime = computed(() => {
    const totalSeconds = this.elapsedTime();
    const m = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  });

  private timerInterval: ReturnType<typeof setInterval> | undefined;

  constructor() {
    // Mặc định tính năng Remake luôn là OFF khi tải ứng dụng để tiết kiệm token và tránh quá tải model
    this.isRemakeMode.set(false);
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('sila_pdf_translator_remake_mode');
    }
  }

  toggleRemakeMode() {
    const nextVal = !this.isRemakeMode();
    this.isRemakeMode.set(nextVal);
    if (nextVal) {
      this.showToast('success', 'Đã bật chế độ Remake Slide! AI sẽ sáng tạo take-note, mổ xẻ code & chú giải công thức học tập.');
    } else {
      this.showToast('info', 'Đã tắt chế độ Remake Slide (chuyển về dịch bài giảng chuẩn).');
    }
  }

  async remakeCurrentDocument() {
    if (this.isProcessing()) return;

    this.mode.set('lecture_slide');
    this.isRemakeMode.set(true);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('sila_pdf_translator_remake_mode', 'true');
    }

    if (this.fileBase64()) {
      await this.processFile();
      return;
    }

    const currentHtml = this.resultHtml();
    if (!currentHtml) {
      this.showToast('error', 'Chưa có slide nào để Remake. Hãy tải tài liệu hoặc dịch trước.');
      return;
    }

    this.isProcessing.set(true);
    this.error.set(null);
    this.elapsedTime.set(0);
    this.timerInterval = setInterval(() => {
      this.elapsedTime.update(v => v + 1);
    }, 1000);

    try {
      this.progressMessage.set('Đang Remake slide học tập (bổ sung take-note, giải thích code & công thức)...');
      const [instruction, prompt] = await Promise.all([
        this.loadPrompt('remake_slide_system_instructions.md'),
        this.loadPrompt('remake_slide_prompt.md')
      ]);

      const result = await this.geminiService.translateHtml(
        currentHtml,
        prompt + '\n\n[LƯU Ý]: Đây là bài giảng đã được dịch. Hãy giữ nguyên các nội dung đã dịch và hình ảnh, đồng thời BỔ SUNG CÁC KHỐI REMAKE TAKE-NOTE, GIẢI THÍCH CODE TỪNG DÒNG, MỔ XẺ CÔNG THỨC & MẸO ÔN THI.',
        instruction,
        this.useGoogleSearch(),
        this.selectedModel(),
        this.htmlExtractedImages()
      );
      this.lastTranslationUsageMetadata = result.usageMetadata;
      const rawHtml = this.imageProcessorService.extractHtml(result.text);
      this.resultHtml.set(this.imageProcessorService.postProcessHtml(rawHtml, this.htmlExtractedImages()));
      this.showToast('success', 'Đã Remake slide thành công với đầy đủ take-note và giải thích chuyên sâu!');
      await this.saveToHistory();
    } catch (e: unknown) {
      const parsedError = this.geminiService.parseGeminiError(e);
      this.showToast('error', `Lỗi khi Remake slide: ${parsedError}`);
    } finally {
      this.isProcessing.set(false);
      if (this.timerInterval) clearInterval(this.timerInterval);
    }
  }

  showToast(type: 'error' | 'info' | 'success', message: string) {
    this.toastService.show(type, message);
  }

  async handlePdfFile(file: File) {
    if (file.type !== 'application/pdf') {
      this.showToast('error', 'Vui lòng tải lên tệp PDF.');
      this.resetFileState();
      return;
    }
    
    if (file.size > this.MAX_FILE_SIZE) {
      this.showToast('error', 'Lỗi: Tệp tải lên vượt quá giới hạn 10MB.');
      this.resetFileState();
      return;
    }

    this.resetPartialState(file);
    this.isCountingTokens.set(true);

    try {
      const pages = await this.pdfService.getPageCount(file);
      this.pdfTotalPages.set(pages);
      this.pdfStartPage.set(1);
      this.pdfEndPage.set(pages);
      await this.processPdfCrop();
    } catch (e) {
      console.error('Error reading PDF:', e);
      this.showToast('error', 'Lỗi khi đọc file PDF.');
      this.isCountingTokens.set(false);
    }
  }

  async processPdfCrop() {
    this.isCountingTokens.set(true);
    this.pdfHash.set(null);
    try {
      const file = this.selectedFile();
      if (!file) return;

      const start = Math.max(1, this.pdfStartPage());
      const end = Math.min(this.pdfTotalPages(), this.pdfEndPage());

      if (start > end) {
        this.showToast('error', 'Trang bắt đầu không được lớn hơn trang kết thúc.');
        this.isCountingTokens.set(false);
        return;
      }

      const result = await this.pdfService.cropPdf(file, start, end, this.pdfTotalPages());
      this.croppedFile.set(result.croppedFile);
      this.fileBase64.set(result.fileBase64);
      await this.checkTokenLimit(result.fileBase64, file.type);

      // Extract images from the cropped PDF
      try {
        const hash = await this.pdfService.hashFile(result.croppedFile);
        this.pdfHash.set(hash);
        const extractedImages = await this.pdfService.extractImagesFromPDF(result.croppedFile, hash);
        
        // Save images to IndexedDB
        await this.dbService.clearImagesByPdf(hash);
        for (const img of extractedImages) {
           await this.dbService.saveImage(img.id, hash, img.dataUrl);
        }
      } catch (err) {
        console.warn('Lỗi khi trích xuất hình ảnh từ PDF:', err);
      }
    } catch (error) {
      console.error('Error cropping PDF:', error);
      this.showToast('error', 'Lỗi khi cắt PDF.');
      this.isCountingTokens.set(false);
    }
  }

  handleHtmlFile(file: File) {
    this.resetPartialState(file);

    const reader = new FileReader();
    reader.onload = async () => {
      const textContent = reader.result as string;
      const { cleanHtml, extractedImages } = this.imageProcessorService.extractImagesFromHtml(textContent);
      
      const encoder = new TextEncoder();
      const byteLength = encoder.encode(cleanHtml).length;
      
      if (byteLength > this.MAX_FILE_SIZE_HTML) {
        this.showToast('error', 'Lỗi: Tệp HTML (sau khi tách ảnh) vượt quá giới hạn 500KB.');
        this.resetFileState();
        return;
      }
      
      this.htmlExtractedImages.set(extractedImages);
      // store the clean base64 html
      const cleanBase64 = btoa(unescape(encodeURIComponent(cleanHtml)));
      this.fileBase64.set(cleanBase64);
      await this.checkTokenLimit(cleanBase64, file.type);
    };
    reader.readAsText(file);
  }

  private readFileAsBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const res = reader.result as string;
        const base64 = res.includes(',') ? res.split(',')[1] : res;
        resolve(base64);
      };
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  private resetFileState() {
    this.selectedFile.set(null);
    this.fileBase64.set(null);
    this.rawOriginalFileBlob.set(null);
  }

  private resetPartialState(file: File) {
    this.error.set(null);
    this.selectedFile.set(file);
    this.mimeType.set(file.type);
    this.resultHtml.set(null);
    this.croppedFile.set(null);
    this.pdfTotalPages.set(0);
    this.rawOriginalFileBlob.set(file);
  }

  private async checkTokenLimit(base64String: string, mimeType: string) {
    this.isCountingTokens.set(true);
    try {
      const tokens = await this.geminiService.countTokens(base64String, mimeType);
      this.tokenCount.set(tokens);
      const maxTokens = this.currentMaxTokens();
      if (tokens > maxTokens) {
        if (this.selectedModel() !== 'gemini-3.8-flash') {
          this.showToast('error', `Tài liệu có ${tokens.toLocaleString()} tokens (vượt trần ${maxTokens.toLocaleString()} của bản Pro). Bạn hãy chuyển sang mô hình Gemini 3.8 Flash ở thanh công cụ để nâng giới hạn lên 80.000 tokens hoặc dùng tính năng "Cắt trang".`);
        } else {
          this.showToast('error', `Lỗi: Nội dung vượt quá giới hạn ${maxTokens.toLocaleString()} tokens (${tokens.toLocaleString()} tokens). Vui lòng dùng tính năng "Cắt trang" để dịch theo từng phần.`);
        }
      }
    } catch (e: unknown) {
      const parsedError = this.geminiService.parseGeminiError(e);
      this.showToast('error', `Lỗi khi kiểm tra dung lượng tài liệu: ${parsedError}`);
    } finally {
      this.isCountingTokens.set(false);
    }
  }

  async loadPrompt(filename: string): Promise<string> {
    return this.promptService.loadPrompt(filename);
  }

  async processFile() {
    if (!this.canProcess() || !this.fileBase64()) return;

    this.isProcessing.set(true);
    this.error.set(null);
    this.resultHtml.set(null);
    this.elapsedTime.set(0);
    
    this.timerInterval = setInterval(() => {
      this.elapsedTime.update(v => v + 1);
    }, 1000);

    try {
      const base64 = this.fileBase64()!;
      const mime = this.mimeType();
      const currentMode = this.mode();
      
      let extractedImages: ExtractedImage[] = [];
      if (this.pdfHash()) {
        try {
          extractedImages = await this.dbService.getImagesByPdf(this.pdfHash()!);
          if (extractedImages.length === 0) {
            const fileToExtract = this.croppedFile() || this.selectedFile();
            if (fileToExtract && (fileToExtract.type === 'application/pdf' || fileToExtract.name.endsWith('.pdf'))) {
              extractedImages = await this.pdfService.extractImagesFromPDF(fileToExtract, this.pdfHash()!);
              for (const img of extractedImages) {
                await this.dbService.saveImage(img.id, this.pdfHash()!, img.dataUrl);
              }
            }
          }
        } catch (e) {
          console.warn('Không thể lấy ảnh từ DB', e);
        }
      }

      if (currentMode === 'lecture_slide') {
        if (this.isRemakeMode()) {
          this.progressMessage.set('Đang Remake slide bài giảng (dịch & bổ sung take-note, giải thích code, mẹo thi)...');
          const [instruction, prompt] = await Promise.all([
            this.loadPrompt('remake_slide_system_instructions.md'),
            this.loadPrompt('remake_slide_prompt.md')
          ]);
          const result = await this.geminiService.translate(base64, mime, prompt, instruction, this.useGoogleSearch(), this.selectedModel(), extractedImages);
          this.lastTranslationUsageMetadata = result.usageMetadata;
          const rawHtml = this.imageProcessorService.extractHtml(result.text);
          this.resultHtml.set(this.imageProcessorService.postProcessHtml(rawHtml, extractedImages));
        } else {
          this.progressMessage.set('Dịch bài giảng tiếng Anh (Slide Presentation)...');
          const [instruction, prompt] = await Promise.all([
            this.loadPrompt('lecture_slide_system_instructions.md'),
            this.loadPrompt('lecture_slide_prompt.md')
          ]);
          const result = await this.geminiService.translate(base64, mime, prompt, instruction, this.useGoogleSearch(), this.selectedModel(), extractedImages);
          this.lastTranslationUsageMetadata = result.usageMetadata;
          const rawHtml = this.imageProcessorService.extractHtml(result.text);
          this.resultHtml.set(this.imageProcessorService.postProcessHtml(rawHtml, extractedImages));
        }
      }
      else if (currentMode === 'zero_math') {
        this.progressMessage.set('Dịch file PDF sang tiếng Việt (Tài liệu khoa học xã hội)...');
        const [instruction, prompt] = await Promise.all([
          this.loadPrompt('zero_math_system_instructions.md'),
          this.loadPrompt('zero_math_prompt.md')
        ]);
        const result = await this.geminiService.translate(base64, mime, prompt, instruction, this.useGoogleSearch(), this.selectedModel(), extractedImages);
        this.lastTranslationUsageMetadata = result.usageMetadata;
        const rawHtml = this.imageProcessorService.extractHtml(result.text);
        this.resultHtml.set(this.imageProcessorService.postProcessHtml(rawHtml, extractedImages));
      }
      else if (currentMode === 'zero_svg') {
        this.progressMessage.set('Dịch file PDF sang tiếng Việt (Tài liệu khoa học nói chung)...');
        const [instruction, prompt] = await Promise.all([
          this.loadPrompt('zero_svg_system_instructions.md'),
          this.loadPrompt('zero_svg_prompt.md')
        ]);
        const result = await this.geminiService.translate(base64, mime, prompt, instruction, this.useGoogleSearch(), this.selectedModel(), extractedImages);
        this.lastTranslationUsageMetadata = result.usageMetadata;
        const rawHtml = this.imageProcessorService.extractHtml(result.text);
        this.resultHtml.set(this.imageProcessorService.postProcessHtml(rawHtml, extractedImages));
      }
      else if (currentMode === 'normal') {
        this.progressMessage.set('Dịch file PDF sang tiếng Việt (Tài liệu toán chuyên ngành)...');
        const [instruction, prompt] = await Promise.all([
          this.loadPrompt('math_system_instructions.md'),
          this.loadPrompt('math_prompt.md')
        ]);
        const result = await this.geminiService.translate(base64, mime, prompt, instruction, this.useGoogleSearch(), this.selectedModel(), extractedImages);
        this.lastTranslationUsageMetadata = result.usageMetadata;
        const rawHtml = this.imageProcessorService.extractHtml(result.text);
        this.resultHtml.set(this.imageProcessorService.postProcessHtml(rawHtml, extractedImages));
      }
      else if (currentMode === 'phase1') {
        this.progressMessage.set('Chuyển định dạng PDF sang HTML (English / Giữ nguyên nội dung)...');
        const [instruction, prompt] = await Promise.all([
          this.loadPrompt('phase_1_system_instructions.md'),
          this.loadPrompt('phase_1_prompt.md')
        ]);
        const result = await this.geminiService.translate(base64, mime, prompt, instruction, false, this.selectedModel(), extractedImages);
        this.lastTranslationUsageMetadata = result.usageMetadata;
        const rawHtml = this.imageProcessorService.extractHtml(result.text);
        this.resultHtml.set(this.imageProcessorService.postProcessHtml(rawHtml, extractedImages));
      }
      else if (currentMode === 'phase2') {
        if (this.selectedFile()?.type !== 'text/html') {
           throw new Error("Phase 2 cần đầu vào là định dạng HTML. Hãy tải file HTML lên.");
        }
        
        this.progressMessage.set('Dịch file HTML sang Tiếng Việt...');
        const [instruction, prompt] = await Promise.all([
          this.loadPrompt('phase_2_system_instructions.md'),
          this.loadPrompt('phase_2_prompt.md')
        ]);
        
        const htmlContent = base64;
        const result = await this.geminiService.translateHtml(htmlContent, prompt, instruction, this.useGoogleSearch(), this.selectedModel(), this.htmlExtractedImages());
        this.lastTranslationUsageMetadata = result.usageMetadata;
        const rawHtml = this.imageProcessorService.extractHtml(result.text);
        this.resultHtml.set(this.imageProcessorService.postProcessHtml(rawHtml, this.htmlExtractedImages()));
      }

      this.progressMessage.set('Done!');
      if (currentMode === 'phase1') {
        this.showToast('success', 'Quá trình chuyển đổi tài liệu hoàn tất!');
      } else {
        this.showToast('success', 'Quá trình dịch tài liệu hoàn tất!');
      }

      await this.saveToHistory();
      
    } catch (e: unknown) {
      const parsedError = this.geminiService.parseGeminiError(e);
      
      if (parsedError.includes('429') || parsedError.toLowerCase().includes('quota')) {
        if (this.selectedModel() !== 'gemini-3.8-flash') {
          this.showToast('error', 'Lỗi 429: Bản Pro đã bị quá hạn mức yêu cầu (Rate Limit). Vui lòng chuyển sang mô hình Gemini 3.8 Flash ở thanh tiêu đề (hạn mức TPM cao hơn gấp hàng chục lần) để tiếp tục ngay.');
        } else {
          this.showToast('error', 'Lỗi: API Key của bạn đã vượt quá giới hạn (Quota exceeded). Sử dụng API Key khác để tiếp tục ngay hoặc đợi sang ngày hôm sau.');
        }
      } 
      else if (parsedError.includes('503') || parsedError.toLowerCase().includes('overloaded') || parsedError.toLowerCase().includes('high demand')) {
        this.showToast('error', 'Lỗi: Máy chủ mô hình đang có lượng truy cập tăng đột biến (High demand/Overloaded). Vui lòng thử lại sau vài giây hoặc chuyển sang tab Pro.');
      }
      else if (parsedError.toLowerCase().includes('safety') || parsedError.toLowerCase().includes('blocked')) {
        this.showToast('error', 'Lỗi: Tài liệu bị từ chối do vi phạm chính sách an toàn của Google.');
      }
      else if (parsedError.includes('JSON.parse: unexpected character')) {
        this.showToast('error', 'Lỗi: Máy chủ nhận quá nhiều yêu cầu hoặc phản hồi lỗi. Vui lòng thử lại sau vài giây.');
      }
      else {
        this.showToast('error', `Lỗi: ${parsedError}`);
      }
    } finally {
      this.isProcessing.set(false);
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
      }
    }
  }

  private async saveToHistory() {
    const file = this.selectedFile();
    const content = this.resultHtml();
    const currentMode = this.mode();
    if (file && content) {
      let vietnameseTitle = file.name;
      const h1Match = content.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
      if (h1Match) {
        vietnameseTitle = h1Match[1].replace(/<[^>]*>/g, '').trim();
      } else {
        const h2Match = content.match(/<h2[^>]*>([\s\S]*?)<\/h2>/i);
        if (h2Match) {
          vietnameseTitle = h2Match[1].replace(/<[^>]*>/g, '').trim();
        }
      }
      
      if (!vietnameseTitle || vietnameseTitle.length === 0) {
        vietnameseTitle = file.name;
      } else if (vietnameseTitle.length > 100) {
        vietnameseTitle = vietnameseTitle.substring(0, 97) + '...';
      }

      let fileBlobToSave: Blob | undefined = this.rawOriginalFileBlob() || undefined;
      if (!fileBlobToSave && file && file.size > 0) {
        fileBlobToSave = file;
      }

      const savedId = await this.storageService.saveTranslation({
        originalFileName: file?.name || 'tai_lieu_goc',
        vietnameseTitle: vietnameseTitle,
        mode: currentMode,
        model: this.selectedModel(),
        timestamp: Date.now(),
        content: content,
        pdfHash: this.pdfHash() || undefined,
        originalFileBlob: fileBlobToSave,
        originalFileMimeType: this.mimeType() || undefined,
        promptTokens: this.lastTranslationUsageMetadata?.promptTokenCount,
        candidatesTokens: this.lastTranslationUsageMetadata?.candidatesTokenCount
      }).catch(err => {
        console.error('Lỗi khi lưu lịch sử:', err);
        return undefined;
      });

      if (savedId) {
        this.activeHistoryItemId.set(savedId);
        await this.fetchHistory();
      }
    }
  }

  async updateImageTranslationInContent(imageSrc: string, translatedHtml: string) {
    const currentHtml = this.resultHtml();
    if (!currentHtml || !imageSrc) return;

    const encoded = encodeURIComponent(translatedHtml);
    let updatedHtml = currentHtml;

    if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
      try {
        const parser = new DOMParser();
        const doc = parser.parseFromString(currentHtml, 'text/html');
        const imgs = Array.from(doc.querySelectorAll('img'));
        let found = false;
        for (const img of imgs) {
          const srcAttr = img.getAttribute('src');
          if (srcAttr === imageSrc || (imageSrc.length > 20 && srcAttr && imageSrc.includes(srcAttr))) {
            img.setAttribute('data-translated-html', encoded);
            found = true;
            break;
          }
        }
        if (found) {
          updatedHtml = doc.documentElement.outerHTML;
        }
      } catch (e) {
        console.warn('Lỗi khi parse HTML để cập nhật data-translated-html:', e);
      }
    }

    if (updatedHtml !== currentHtml) {
      this.resultHtml.set(updatedHtml);
      const activeId = this.activeHistoryItemId();
      if (activeId) {
        await this.storageService.updateTranslationContent(activeId, updatedHtml);
        await this.fetchHistory();
      }
    }
  }

  cancelTimer() {
    if (this.timerInterval) {
      clearInterval(this.timerInterval);
    }
  }

  resetSession() {
    this.cancelTimer();
    this.selectedFile.set(null);
    this.isLoadedFromHistory.set(false);
    this.activeHistoryItemId.set(null);
    this.selectedModel.set('gemini-pro-latest');
    this.fileBase64.set(null);
    this.rawOriginalFileBlob.set(null);
    this.mimeType.set('');
    this.resultHtml.set(null);
    this.error.set(null);
    this.tokenCount.set(0);
    this.progressMessage.set('');
    this.elapsedTime.set(0);
  }

  async fetchHistory() {
    try {
      const items = await this.storageService.getAll();
      this.historyItems.set(items);
    } catch (err) {
      console.error('Không thể tải lịch sử:', err);
      this.showToast('error', 'Không thể đọc dữ liệu lịch sử dịch.');
    }
  }

  async deleteHistoryItem(id: number) {
    try {
      const itemToDelete = this.historyItems().find(item => item.id === id);
      if (itemToDelete && itemToDelete.pdfHash) {
        try {
          await this.dbService.clearImagesByPdf(itemToDelete.pdfHash);
        } catch (err) {
          console.error('Lỗi khi xóa ảnh của tài liệu:', err);
        }
      }
      await this.storageService.delete(id);
      await this.fetchHistory();
      this.showToast('success', 'Đã xóa bản dịch khỏi lịch sử thành công.');
    } catch (err) {
      console.error('Không thể xóa item:', err);
      this.showToast('error', 'Không thể xóa bản dịch khỏi lịch sử.');
    }
  }

  restoreFromHistory(doc: TranslatedDoc) {
    const isHtml = doc.mode === 'phase2';
    const mime = doc.originalFileMimeType || (isHtml ? 'text/html' : 'application/pdf');
    const dummyFile = new File([], doc.originalFileName, { type: mime });
    
    this.selectedFile.set(dummyFile);
    this.isLoadedFromHistory.set(true);
    this.activeHistoryItemId.set(doc.id || null);
    this.mimeType.set(dummyFile.type);
    this.resultHtml.set(doc.content);
    this.mode.set(doc.mode as TranslationMode);
    this.rawOriginalFileBlob.set(doc.originalFileBlob || null);
    
    if (doc.model === 'gemini-pro-latest') {
      this.selectedModel.set('gemini-pro-latest');
    } else {
      this.selectedModel.set('gemini-3.8-flash');
    }
    
    this.tokenCount.set(0);
    this.error.set(null);
    this.progressMessage.set('Đã khôi phục từ lịch sử');
  }

  downloadOriginalFile() {
    const file = this.selectedFile();
    const blob = this.rawOriginalFileBlob();
    const fileName = file?.name || 'tai_lieu_goc.pdf';

    let targetBlob: Blob | null = null;

    if (file && file.size > 0) {
      targetBlob = file;
    } else if (blob) {
      targetBlob = blob;
    }

    if (targetBlob) {
      const url = URL.createObjectURL(targetBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else {
      this.showToast('error', 'Không tìm thấy file gốc để tải về.');
    }
  }
}
