import { Injectable } from '@angular/core';

export interface ExtractedImage {
  id: string;
  dataUrl: string;
}

@Injectable({
  providedIn: 'root'
})
export class ImageProcessorService {
  extractImagesFromHtml(html: string): { cleanHtml: string; extractedImages: ExtractedImage[] } {
    const extractedImages: ExtractedImage[] = [];
    
    const regex = /(?:src|href|data)=(['"])(data:image\/.*?)\1|url\((['"]?)(data:image\/.*?)\3\)/gi;
    
    const cleanHtml = html.replace(regex, (match, q1, g1, q2, g2) => {
      const dataUrl = g1 || g2;
      const id = `img_placeholder_${crypto.randomUUID()}`;
      extractedImages.push({ id, dataUrl });
      return match.replace(dataUrl, id);
    });

    return { cleanHtml, extractedImages };
  }

  extractHtml(text: string): string {
    const match = text.match(/```[a-zA-Z]*\s*([\s\S]*?)\s*```/);
    return match ? match[1] : text;
  }

  postProcessHtml(html: string, extractedImages: ExtractedImage[]): string {
    if (!html) return html;
    let processedHtml = html;

    if (extractedImages && extractedImages.length > 0) {
      const replacedImageIds = new Set<string>();

      // 1. Direct and suffix ID replacement
      for (const img of extractedImages) {
        const escapedId = img.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        
        // Exact match: src="id" or src="[id]"
        const srcRegex = new RegExp(`src=["']\\[?${escapedId}\\]?["']`, 'g');
        if (srcRegex.test(processedHtml)) {
          processedHtml = processedHtml.replace(srcRegex, `src="${img.dataUrl}"`);
          replacedImageIds.add(img.id);
        }

        // Suffix match: if img.id ends with img_X, also match src="img_X" or src="slide_img_X"
        const suffixMatch = img.id.match(/(img_.*)$/);
        if (suffixMatch) {
          const suffix = suffixMatch[1];
          const escapedSuffix = suffix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const suffixRegex = new RegExp(`src=["']\\[?(?:slide_)?${escapedSuffix}\\]?["']`, 'g');
          if (suffixRegex.test(processedHtml)) {
            processedHtml = processedHtml.replace(suffixRegex, `src="${img.dataUrl}"`);
            replacedImageIds.add(img.id);
          }
        }

        const fallbackRegex = new RegExp(`\\[IMAGE:\\s*${escapedId}\\]`, 'g');
        processedHtml = processedHtml.replace(fallbackRegex, `<img src="${img.dataUrl}" style="max-width: 100%; height: auto;">`);
      }

      // 2. Positional fallback: if Gemini outputted generic placeholders like <img src="[ID_CỦA_ẢNH]" ...>
      // or unreplaced dummy identifiers, assign any remaining unassigned extracted images
      const unassignedImages = extractedImages.filter(img => !replacedImageIds.has(img.id));
      let fallbackIndex = 0;

      processedHtml = processedHtml.replace(/<img\s+([^>]*?)src=["'](\[ID_CỦA_ẢNH\]|\[?ID_[^"']*\]?|\[?IMAGE:[^"']*\]?|img_[^"']*|slide_img_[^"']*)["']([^>]*?)>/gi, (match, before, srcVal, after) => {
        if (srcVal.startsWith('data:') || srcVal.startsWith('http')) {
          return match;
        }
        if (fallbackIndex < unassignedImages.length) {
          const chosenImg = unassignedImages[fallbackIndex++];
          return `<img ${before}src="${chosenImg.dataUrl}"${after}>`;
        }
        return match;
      });
    }

    // 3. Fallback for any lingering unresolved dummy placeholder src="..." so that the browser
    // never renders an ugly broken image box if no image was extracted
    processedHtml = processedHtml.replace(/<img\s+([^>]*?)src=["'](\[ID_CỦA_ẢNH\]|\[?ID_[^"']*\]?)["']([^>]*?)>/gi, (match, before, srcVal, after) => {
      const altMatch = (before + after).match(/alt=["']([^"']*)["']/i);
      const altText = altMatch ? altMatch[1] : 'Sơ đồ minh họa bài giảng';
      return `<div class="slide-figure-placeholder" style="padding: 24px 16px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; text-align: center; color: #475569; font-family: ui-sans-serif, system-ui, sans-serif; margin: 8px auto;">
        <div style="font-size: 26px; margin-bottom: 6px;">📊</div>
        <div style="font-weight: 600; font-size: 13px; color: #1e293b;">${altText}</div>
        <div style="font-size: 11px; margin-top: 4px; color: #64748b;">(Đồ thị / Sơ đồ nguyên bản)</div>
      </div>`;
    });

    // 4. Sanitize any raw markdown leaks or escaped LaTeX backslashes
    processedHtml = this.cleanMarkdownAndLatexLeaks(processedHtml);

    return processedHtml;
  }

  cleanMarkdownAndLatexLeaks(html: string): string {
    if (!html) return html;
    let s = html;

    // 1. Normalize escaped LaTeX backslashes from JSON or models (e.g. \\( to \( or \\] to \])
    s = s.replace(/\\\\(\(|\)|\[|\])/g, '\\$1');

    // 2. Normalize math arrows and operators leaking outside or inside math
    s = s.replace(/\$(\\rightarrow|\\to)\$/g, ' &rarr; ');
    s = s.replace(/\$(\\leftarrow)\$/g, ' &larr; ');
    s = s.replace(/\$(\\Rightarrow)\$/g, ' &rArr; ');
    s = s.replace(/\$(\\Leftrightarrow)\$/g, ' &hArr; ');

    // 3. Convert stray markdown bold **text** to <strong>text</strong> and `code` to <code>code</code>
    // Only replaces in text nodes, strictly preserving HTML tags, pre, code, script, and style blocks
    s = s.replace(
      /(<pre[\s\S]*?<\/pre>|<code[\s\S]*?<\/code>|<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>)|(\*{2}([^*\n]+?)\*{2})|(`([^`\n<]+)`)/gi,
      (match, tag, mdBold, boldText, mdCode, codeText) => {
        if (tag) return tag;
        if (mdBold && boldText) return `<strong>${boldText}</strong>`;
        if (mdCode && codeText) return `<code>${codeText}</code>`;
        return match;
      }
    );

    return s;
  }

  attachInteractiveScript(html: string): string {
    return this.ensureCompleteHtml(html);
  }

  ensureCompleteHtml(html: string): string {
    if (!html) return html;
    
    // Clean any stray markdown leaks and normalize math delimiters
    const processedHtml = this.cleanMarkdownAndLatexLeaks(html);

    const hasDocType = /<!DOCTYPE\s+html/i.test(processedHtml);
    const hasHead = /<head[\s>]/i.test(processedHtml);
    const hasBody = /<body[\s>]/i.test(processedHtml);

    const fullStyles = this.getSlideStyles();
    const fullScript = this.getSlideScripts();

    const mathAndFontHeadTags = `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet">
  <!-- KaTeX CSS & JS for high-speed instant LaTeX formula typesetting -->
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css">
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/contrib/auto-render.min.js"></script>
  <!-- MathJax 3 for comprehensive academic LaTeX environments (matrices, piecewise, equations) -->
  <script>
    window.MathJax = {
      tex: {
        inlineMath: [['\\\\(', '\\\\)'], ['$', '$']],
        displayMath: [['\\\\[', '\\\\]'], ['$$', '$$']],
        processEscapes: true,
        processEnvironments: true
      },
      options: {
        skipHtmlTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
      },
      startup: {
        ready: () => {
          if (window.MathJax && window.MathJax.startup) {
            window.MathJax.startup.defaultReady();
            window.MathJax.startup.promise.then(() => {
              if (typeof renderAllMath === 'function') renderAllMath();
            });
          }
        }
      }
    };
  </script>
  <script id="MathJax-script" async src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
  <style>
${fullStyles}
  </style>
`;

    // Case 1: Already has <!DOCTYPE html> or <head>
    if (hasDocType || hasHead) {
      let result = processedHtml;
      if (hasHead) {
        result = result.replace(/<head[\s>]/i, match => `${match}\n${mathAndFontHeadTags}\n`);
      }
      if (hasBody) {
        result = result.replace(/<\/body>/i, `<script>\n${fullScript}\n</script>\n</body>`);
      } else {
        result += `<script>\n${fullScript}\n</script>`;
      }
      return result;
    }

    // Case 2: Partial fragment (e.g. <div class="lecture-slides-container">...</div>)
    // Wrap into a pristine, fully self-contained standalone HTML document
    return `<!DOCTYPE html>
<html lang="vi">
<head>
  <title>Slide Bài Giảng Đã Dịch</title>
${mathAndFontHeadTags}
</head>
<body style="margin: 0; padding: 0; background: #f1f5f9; font-family: 'Inter', ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; -webkit-font-smoothing: antialiased;">
${processedHtml}
<script>
${fullScript}
</script>
</body>
</html>`;
  }

  private getSlideStyles(): string {
    return `
  /* TỰ DO KHÔNG GIAN CHIỀU DỌC & CHIỀU NGANG - ĐỒNG BỘ THEO SLIDE LỚN NHẤT */
  .lecture-slides-container {
    display: flex !important;
    flex-direction: column !important;
    align-items: center !important;
    width: 100% !important;
    min-width: fit-content !important;
    padding: 24px 16px !important;
    box-sizing: border-box !important;
  }

  .slide-canvas {
    width: 100% !important;
    min-width: min(100%, 940px) !important;
    min-height: auto !important;
    height: auto !important;
    overflow: visible !important;
    margin: 0 auto 36px auto !important;
    transition: width 0.15s ease !important;
    box-sizing: border-box !important;
  }
  .slide-body {
    flex: none !important;
    height: auto !important;
    overflow: visible !important;
    padding: 16px 32px 24px 32px !important;
  }
  .slide-body-two-column {
    display: grid !important;
    grid-template-columns: minmax(0, 1.25fr) minmax(320px, 1fr) !important;
    gap: 32px !important;
    align-items: start !important;
  }

  /* KHẮC PHỤC CHÈN ÉP DÒNG BULLET & CÔNG THỨC TOÁN */
  .sub-bullets {
    padding: 0 !important;
    margin-top: 10px !important;
  }
  .sub-bullets li, .bullet-item {
    display: block !important;
    position: relative !important;
    padding-left: 26px !important;
    margin-bottom: 14px !important;
    line-height: 1.6 !important;
  }
  .sub-bullets li > .bullet-sub-icon, .bullet-item > .bullet-icon {
    position: absolute !important;
    left: 0 !important;
    top: 2px !important;
  }
  .bullet-content {
    line-height: 1.6 !important;
  }

  /* KHỐI CÔNG THỨC TOÁN HỌC ĐỨNG RIÊNG MỘT DÒNG, THOÁNG ĐÃNG */
  .math-block {
    display: block !important;
    width: 100% !important;
    box-sizing: border-box !important;
    margin: 12px 0 !important;
    padding: 8px 14px !important;
    background: #f8fafc !important;
    border-radius: 8px !important;
    border-left: 3px solid #38bdf8 !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }
  .math-block::-webkit-scrollbar {
    height: 4px !important;
  }
  .math-block::-webkit-scrollbar-thumb {
    background: #cbd5e1 !important;
    border-radius: 4px !important;
  }

  /* TINH CHỈNH KATEX VÀ MATHJAX PHÙ HỢP KHÔNG GIAN BÀI GIẢNG */
  .katex, .MathJax {
    font-size: 1.05em !important;
    color: inherit !important;
  }
  .katex-display, .MathJax_Display {
    margin: 8px 0 !important;
    overflow-x: auto !important;
    overflow-y: hidden !important;
  }

  /* KHUNG CODE BÀI GIẢNG LẬP TRÌNH (SLIDE CODE) */
  .code-block-container {
    margin: 14px 0 !important;
    background: #0f172a !important;
    border-radius: 10px !important;
    border: 1px solid #334155 !important;
    overflow: hidden !important;
    box-shadow: 0 4px 14px rgba(0,0,0,0.12) !important;
  }
  .code-header {
    display: flex !important;
    align-items: center !important;
    justify-content: space-between !important;
    padding: 7px 14px !important;
    background: #1e293b !important;
    border-bottom: 1px solid #334155 !important;
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    font-size: 11.5px !important;
    color: #94a3b8 !important;
  }
  .code-lang {
    font-weight: 600 !important;
    color: #38bdf8 !important;
  }
  .code-title {
    color: #cbd5e1 !important;
  }
  .slide-code {
    margin: 0 !important;
    padding: 14px 18px !important;
    overflow-x: auto !important;
    font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
    font-size: 13px !important;
    line-height: 1.6 !important;
    color: #f1f5f9 !important;
    background: transparent !important;
  }

  /* THẺ REMAKE HỌC TẬP CHUYÊN SÂU (TAKE-NOTE, GIẢI THÍCH, MẸO THI) */
  .remake-card {
    margin: 16px 0 !important;
    border-radius: 12px !important;
    padding: 14px 18px !important;
    font-size: 13.5px !important;
    line-height: 1.6 !important;
    box-shadow: 0 2px 8px -2px rgba(0,0,0,0.06) !important;
    box-sizing: border-box !important;
  }
  .remake-card-header {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    margin-bottom: 8px !important;
  }
  .remake-badge {
    font-weight: 700 !important;
    font-size: 12.5px !important;
    letter-spacing: 0.02em !important;
    display: inline-flex !important;
    align-items: center !important;
    gap: 4px !important;
  }
  .remake-subtitle {
    font-size: 11.5px !important;
    opacity: 0.8 !important;
    margin-left: auto !important;
    font-style: italic !important;
  }
  .remake-take-note {
    background: #fefce8 !important;
    border: 1px solid #fef08a !important;
    border-left: 5px solid #eab308 !important;
    color: #713f12 !important;
  }
  .remake-code-insight {
    background: #f8fafc !important;
    border: 1px solid #e2e8f0 !important;
    border-left: 5px solid #6366f1 !important;
    color: #1e293b !important;
  }
  .remake-math-insight {
    background: #f0f9ff !important;
    border: 1px solid #bae6fd !important;
    border-left: 5px solid #0284c7 !important;
    color: #0c4a6e !important;
  }
  .remake-exam-tip {
    background: #f0fdf4 !important;
    border: 1px solid #bbf7d0 !important;
    border-left: 5px solid #16a34a !important;
    color: #14532d !important;
  }
  .remake-list {
    margin: 6px 0 0 0 !important;
    padding-left: 18px !important;
  }
  .remake-list li {
    margin-bottom: 6px !important;
    line-height: 1.55 !important;
  }

  /* CỘT HÌNH ẢNH RỘNG RÃI */
  .slide-col-visual {
    min-width: 300px !important;
  }
  .slide-figure {
    width: 100% !important;
  }
  .slide-img, .slide-svg {
    max-height: 380px !important;
    width: auto !important;
    max-width: 100% !important;
  }

  .interactive-img-wrapper { position: relative; display: inline-block; max-width: 100%; }
  .interactive-img-wrapper img.original-img { display: block; max-width: 100%; height: auto; }
  .translate-btn {
    position: absolute; top: 8px; right: 8px;
    background: rgba(17, 24, 39, 0.85); color: white; border: 1px solid rgba(255,255,255,0.2);
    padding: 6px 12px; border-radius: 6px; cursor: pointer; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; font-size: 12px; font-weight: 500;
    opacity: 0; transition: all 0.2s; z-index: 10; backdrop-filter: blur(4px); box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
  }
  .interactive-img-wrapper:hover .translate-btn { opacity: 1; }
  .translate-btn:hover { background: rgba(17, 24, 39, 1); }
  .reconstructed-wrapper { display: none; width: 100%; overflow: auto; }
  .show-reconstructed .reconstructed-wrapper { display: block; }
  .show-reconstructed img.original-img { display: none; }

  /* Lightbox & Zoom Badge */
  .slide-img, .slide-figure img, .original-img, .slide-svg {
    cursor: zoom-in;
    transition: transform 0.15s ease;
  }
  .slide-img:hover, .slide-figure img:hover, .original-img:hover {
    transform: scale(1.015);
  }

  .img-zoom-badge {
    position: absolute; bottom: 8px; left: 8px;
    background: rgba(15, 23, 42, 0.75); color: #ffffff;
    padding: 3px 8px; border-radius: 4px; font-size: 11px;
    pointer-events: none; opacity: 0; transition: opacity 0.2s;
    backdrop-filter: blur(4px); font-family: ui-sans-serif, system-ui, sans-serif;
    display: flex; align-items: center; gap: 4px; z-index: 5;
  }
  .interactive-img-wrapper:hover .img-zoom-badge,
  .slide-figure:hover .img-zoom-badge { opacity: 1; }

  #slide-lightbox-modal {
    position: fixed; inset: 0; z-index: 9999999;
    background: rgba(15, 23, 42, 0.92); backdrop-filter: blur(8px);
    display: none; align-items: center; justify-content: center;
    padding: 24px; box-sizing: border-box;
    animation: lbFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  #slide-lightbox-modal.active { display: flex; }
  @keyframes lbFadeIn { from { opacity: 0; } to { opacity: 1; } }

  .lightbox-card {
    position: relative; max-width: 92vw; max-height: 92vh;
    display: flex; flex-direction: column; align-items: center;
    background: #ffffff; padding: 16px; border-radius: 12px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }
  .lightbox-card img {
    max-width: 88vw; max-height: 78vh; width: auto; height: auto;
    object-fit: contain; border-radius: 6px; display: block;
  }
  .lightbox-card svg {
    max-width: 88vw; max-height: 78vh; width: 620px; height: auto;
  }
  .lightbox-caption-text {
    margin-top: 10px; font-size: 13px; color: #1e293b;
    font-family: ui-sans-serif, system-ui, sans-serif; font-weight: 500;
    text-align: center; max-width: 800px; line-height: 1.4;
  }
  .lightbox-close-btn {
    position: absolute; top: -14px; right: -14px;
    width: 32px; height: 32px; border-radius: 50%;
    background: #ef4444; color: #ffffff; border: 2px solid #ffffff;
    font-size: 16px; font-weight: bold; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25);
    transition: transform 0.15s, background 0.15s;
  }
  .lightbox-close-btn:hover { background: #dc2626; transform: scale(1.1); }

  #img-trans-toast-container {
    position: fixed; top: 16px; right: 16px; z-index: 999999;
    display: flex; flex-direction: column; gap: 8px; pointer-events: none;
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
  }
  .img-trans-toast {
    pointer-events: auto; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 500;
    box-shadow: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05);
    display: flex; align-items: center; gap: 8px; max-width: 450px;
    animation: imgToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  .img-trans-toast.error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
  .img-trans-toast.success { background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0; }
  @keyframes imgToastIn {
    from { opacity: 0; transform: translateY(-8px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes imgToastOut {
    from { opacity: 1; transform: translateY(0) scale(1); }
    to { opacity: 0; transform: translateY(-8px) scale(0.96); }
  }
`;
  }

  private getSlideScripts(): string {
    return `
  function showImgToast(message, isSuccess) {
    let container = document.getElementById('img-trans-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'img-trans-toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = 'img-trans-toast ' + (isSuccess ? 'success' : 'error');
    const icon = isSuccess ? '✓' : '⚠️';
    toast.innerHTML = '<span style="font-weight:bold;">' + icon + '</span><span style="flex:1;">' + message + '</span>';
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.animation = 'imgToastOut 0.3s forwards';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  function initLightbox() {
    let modal = document.getElementById('slide-lightbox-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'slide-lightbox-modal';
      modal.innerHTML = '<div class="lightbox-card" id="lightbox-card">' +
        '<button class="lightbox-close-btn" id="lightbox-close-btn" title="Đóng (Esc)">✕</button>' +
        '<div id="lightbox-media-container" style="display:flex; justify-content:center; align-items:center;"></div>' +
        '<div class="lightbox-caption-text" id="lightbox-caption-text"></div>' +
        '</div>';
      document.body.appendChild(modal);

      const close = () => modal.classList.remove('active');
      modal.addEventListener('click', (e) => {
        if (e.target === modal || (e.target && e.target.id === 'lightbox-close-btn')) {
          close();
        }
      });
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
          close();
        }
      });
    }
  }

  function openLightbox(mediaNodeOrSrc, caption) {
    initLightbox();
    const modal = document.getElementById('slide-lightbox-modal');
    const container = document.getElementById('lightbox-media-container');
    const capEl = document.getElementById('lightbox-caption-text');
    if (!modal || !container || !capEl) return;

    container.innerHTML = '';
    if (typeof mediaNodeOrSrc === 'string') {
      const img = document.createElement('img');
      img.src = mediaNodeOrSrc;
      container.appendChild(img);
    } else if (mediaNodeOrSrc && mediaNodeOrSrc.cloneNode) {
      const clone = mediaNodeOrSrc.cloneNode(true);
      container.appendChild(clone);
    }

    capEl.textContent = caption || '';
    modal.classList.add('active');
  }

  function initImages() {
    initLightbox();

    // Attach click zoom to SVG diagrams
    document.querySelectorAll('.slide-svg').forEach(svg => {
      if (svg.dataset.lightboxInit) return;
      svg.dataset.lightboxInit = "true";
      svg.addEventListener('click', (e) => {
        e.stopPropagation();
        const figure = svg.closest('figure');
        const caption = figure ? (figure.querySelector('figcaption')?.textContent || '') : (svg.getAttribute('aria-label') || '');
        openLightbox(svg, caption);
      });
    });

    document.querySelectorAll('img').forEach(img => {
      if (img.dataset.processInit) return;
      img.dataset.processInit = "true";

      img.addEventListener('error', () => {
        const placeholder = document.createElement('div');
        placeholder.className = 'slide-figure-placeholder';
        placeholder.style.cssText = 'padding: 20px 16px; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 8px; text-align: center; color: #475569; font-family: ui-sans-serif, system-ui, sans-serif; margin: 8px auto; max-width: 100%;';
        placeholder.innerHTML = '<div style="font-size: 26px; margin-bottom: 6px;">📊</div><div style="font-weight: 600; font-size: 13px; color: #1e293b;">' + (img.alt || 'Sơ đồ minh họa bài giảng') + '</div><div style="font-size: 11px; margin-top: 4px; color: #64748b;">(Đồ thị / Sơ đồ nguyên bản)</div>';
        if (img.parentNode) {
          img.parentNode.replaceChild(placeholder, img);
        }
      });

      // Click to open lightbox
      img.addEventListener('click', (e) => {
        if (e.target && e.target.classList.contains('translate-btn')) return;
        const figure = img.closest('figure');
        const caption = figure ? (figure.querySelector('figcaption')?.textContent || img.alt || '') : (img.alt || '');
        openLightbox(img.src, caption);
      });

      const process = () => {
        if (img.naturalWidth < 200 && img.naturalHeight < 200) return;
        if (img.parentElement.classList.contains('interactive-img-wrapper')) return;

        const wrapper = document.createElement('div');
        wrapper.className = 'interactive-img-wrapper';
        img.parentNode.insertBefore(wrapper, img);
        
        img.classList.add('original-img');
        wrapper.appendChild(img);

        const zoomBadge = document.createElement('span');
        zoomBadge.className = 'img-zoom-badge';
        zoomBadge.innerHTML = '🔍 Phóng to';
        wrapper.appendChild(zoomBadge);
        
        const btn = document.createElement('button');
        btn.className = 'translate-btn';
        
        const cachedHtmlAttr = img.getAttribute('data-translated-html');
        if (cachedHtmlAttr) {
          try {
            const decodedHtml = decodeURIComponent(cachedHtmlAttr);
            wrapper.dataset.translatedContent = "true";
            const rec = document.createElement('div');
            rec.className = 'reconstructed-wrapper';
            const shadow = rec.attachShadow({ mode: 'open' });
            shadow.innerHTML = decodedHtml;
            wrapper.appendChild(rec);
            wrapper.classList.add('show-reconstructed');
            btn.textContent = 'Hiển thị ảnh gốc';
          } catch (err) {
            console.error('Lỗi decode cached image html:', err);
            btn.textContent = 'Dịch sơ đồ/biểu đồ này';
          }
        } else {
          btn.textContent = 'Dịch sơ đồ/biểu đồ này';
        }

        wrapper.appendChild(btn);
        
        btn.addEventListener('click', (e) => {
           e.preventDefault();
           e.stopPropagation();
           if (wrapper.classList.contains('show-reconstructed')) {
              wrapper.classList.remove('show-reconstructed');
              btn.textContent = 'Dịch sơ đồ/biểu đồ này';
           } else {
              if (wrapper.dataset.translatedContent) {
                  wrapper.classList.add('show-reconstructed');
                  btn.textContent = 'Hiển thị ảnh gốc';
              } else {
                  const id = Math.random().toString(36).substring(7);
                  wrapper.dataset.reqId = id;
                  btn.textContent = 'Đang dịch...';
                  btn.disabled = true;
                  btn.style.opacity = '1';
                  window.parent.postMessage({ type: 'TRANSLATE_IMAGE', src: img.src, reqId: id }, '*');
              }
           }
        });
      };

      if (img.complete) {
        process();
      } else {
        img.addEventListener('load', process);
      }
    });
  }

  // RENDER TOÀN BỘ CÔNG THỨC TOÁN BẰNG KATEX & MATHJAX
  function renderAllMath() {
    // 1. KaTeX tốc độ cao: render ngay lập tức tất cả công thức inline và block
    if (typeof renderMathInElement === 'function') {
      try {
        renderMathInElement(document.body, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\\\[', right: '\\\\]', display: true },
            { left: '\\\\(', right: '\\\\)', display: false },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false,
          ignoredTags: ['script', 'noscript', 'style', 'textarea', 'pre', 'code']
        });
      } catch (err) {
        console.warn('KaTeX render warning:', err);
      }
    }

    // 2. MathJax 3 cho các môi trường toán phức tạp (hệ phương trình, ma trận, công thức dài)
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise()
        .then(() => {
          if (typeof syncAllSlideWidths === 'function') syncAllSlideWidths();
        })
        .catch(err => console.warn('MathJax typeset warning:', err));
    } else if (typeof syncAllSlideWidths === 'function') {
      syncAllSlideWidths();
    }
  }

  function syncAllSlideWidths() {
    const slides = Array.from(document.querySelectorAll('.slide-canvas'));
    if (!slides || slides.length === 0) return;
    
    if (slides.length === 1) {
      slides[0].style.width = '100%';
      slides[0].style.maxWidth = '1120px';
      slides[0].style.marginLeft = 'auto';
      slides[0].style.marginRight = 'auto';
      return;
    }

    // Reset inline width to let slides measure naturally
    slides.forEach(s => {
      s.style.width = 'auto';
      s.style.maxWidth = 'none';
      s.style.minWidth = '0';
    });

    // Determine the widest slide
    let maxW = 960;
    slides.forEach(s => {
      const naturalW = Math.max(s.scrollWidth, Math.ceil(s.getBoundingClientRect().width));
      if (naturalW > maxW) maxW = naturalW;
    });

    // Enforce uniform width across all slides for smooth scrolling
    slides.forEach(s => {
      s.style.width = maxW + 'px';
      s.style.minWidth = maxW + 'px';
      s.style.maxWidth = '100%';
      s.style.marginLeft = 'auto';
      s.style.marginRight = 'auto';
    });
  }

  function scheduleSyncWidths() {
    syncAllSlideWidths();
    setTimeout(syncAllSlideWidths, 100);
    setTimeout(syncAllSlideWidths, 400);
    setTimeout(syncAllSlideWidths, 1200);
  }

  // Khởi động render
  renderAllMath();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initImages();
      renderAllMath();
      scheduleSyncWidths();
    });
  } else {
    initImages();
    renderAllMath();
    scheduleSyncWidths();
  }

  window.addEventListener('load', () => {
    renderAllMath();
    scheduleSyncWidths();
  });

  window.addEventListener('resize', syncAllSlideWidths);

  // Đảm bảo bắt kịp khi CDN tải xong bất đồng bộ
  let mathCheckCount = 0;
  const mathTimer = setInterval(() => {
    mathCheckCount++;
    renderAllMath();
    if (mathCheckCount >= 6) clearInterval(mathTimer);
  }, 400);

  window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'IMAGE_TRANSLATED') {
          const wrapper = document.querySelector('.interactive-img-wrapper[data-req-id="' + event.data.reqId + '"]');
          if (wrapper) {
              const btn = wrapper.querySelector('.translate-btn');
              btn.disabled = false;
              btn.style.opacity = ''; 
              if (event.data.success) {
                  wrapper.dataset.translatedContent = "true";
                  const imgEl = wrapper.querySelector('img.original-img');
                  if (imgEl) {
                      imgEl.setAttribute('data-translated-html', encodeURIComponent(event.data.html));
                  }
                  const rec = document.createElement('div');
                  rec.className = 'reconstructed-wrapper';
                  const shadow = rec.attachShadow({ mode: 'open' });
                  shadow.innerHTML = event.data.html;
                  wrapper.appendChild(rec);
                  wrapper.classList.add('show-reconstructed');
                  btn.textContent = 'Hiển thị ảnh gốc';

                  showImgToast('Tái tạo sơ đồ/biểu đồ thành công!', true);

                  window.parent.postMessage({
                      type: 'PERSIST_TRANSLATED_IMAGE',
                      src: imgEl ? imgEl.getAttribute('src') : null,
                      translatedHtml: event.data.html
                  }, '*');
              } else {
                  btn.textContent = 'Dịch sơ đồ/biểu đồ này';
                  showImgToast(event.data.message || 'Không thể dịch ảnh này.', false);
              }
          }
      }
  });
`;
  }
}

