import { Component, ChangeDetectionStrategy, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LucideAngularModule, FileText, Sparkles, Zap, Key, ChevronDown, CheckCircle2 } from 'lucide-angular';
import { SearchBarComponent } from './search-bar.component';
import { AVAILABLE_MODELS, ModelOption, getModelInfo } from './model-config';

@Component({
  selector: 'app-header-controls',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, SearchBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="bg-white border-b border-slate-200 relative z-40">
      <div class="max-w-[1400px] mx-auto px-4 sm:px-6 lg:px-8 py-3 lg:py-0 lg:h-16 flex flex-col sm:flex-row sm:flex-wrap lg:flex-nowrap items-center sm:justify-center lg:justify-between gap-3 sm:gap-4 lg:gap-0">
        
        <!-- Left side: Logo + Model Controls -->
        <div class="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-5 w-full lg:w-auto">
          
          <!-- Logo and Title -->
          <div class="flex items-center gap-2">
            <div class="bg-indigo-600 text-white p-1.5 rounded-lg shrink-0">
              <lucide-icon [img]="FileText" class="w-5 h-5" aria-hidden="true"></lucide-icon>
            </div>
            <div class="block">
              <h1 class="text-lg sm:text-xl font-bold font-display tracking-tight text-slate-900 leading-tight">
                PDF silaTranslator
              </h1>
              <button 
                type="button"
                [disabled]="isProcessing"
                (click)="onOpenApiKeyModal()"
                title="{{ isProcessing ? 'Không thể cấu hình khi đang xử lý' : (hasUserApiKey ? 'Sửa API Key của bạn' : 'Cấu hình API Key của bạn') }}"
                class="flex items-center gap-1 text-[11px] font-medium mt-0.5 transition-colors focus:outline-none text-left"
                [class.cursor-not-allowed]="isProcessing"
                [class.cursor-pointer]="!isProcessing"
                [ngClass]="hasUserApiKey ? 'text-emerald-600 hover:text-emerald-700' : (isProcessing ? 'text-slate-400' : 'text-slate-500 hover:text-indigo-600 underline decoration-slate-300 hover:decoration-indigo-600 underline-offset-2')"
              >
                <lucide-icon [img]="Key" class="w-3 h-3"></lucide-icon>
                <span class="sm:hidden">{{ hasUserApiKey ? 'Đang dùng key của bạn' : 'Nhập API Key' }}</span>
                <span class="hidden sm:inline">{{ hasUserApiKey ? 'Đang dùng key của bạn' : 'Nhập (cấu hình) API Key' }}</span>
              </button>
            </div>
          </div>

          <!-- Multi-Model Selector Bar -->
          <div class="relative flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200/80 shadow-inner">
            
            <!-- Quick Pill 1: Flash 3.8 -->
            <button 
              type="button"
              [disabled]="isProcessing"
              (click)="onModelChange('gemini-3.8-flash')"
              title="Gemini 3.8 Flash (80K tokens - Thế hệ mới nhất)"
              class="group relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
              [class.cursor-not-allowed]="isProcessing"
              [class.cursor-pointer]="!isProcessing"
              [class.opacity-50]="isProcessing && selectedModel !== 'gemini-3.8-flash'"
              [ngClass]="selectedModel === 'gemini-3.8-flash' ? 'bg-white text-emerald-600 shadow-sm ring-1 ring-slate-900/5' : (isProcessing ? 'text-slate-400' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50')"
            >
              <lucide-icon [img]="Zap" class="w-3.5 h-3.5 text-emerald-500"></lucide-icon>
              <span>Flash 3.8</span>
              <span class="text-[9.5px] font-mono px-1 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-bold">80K</span>
            </button>

            <!-- Quick Pill 2: Flash 2.5 (Rất ổn định khi 3.8 quá tải) -->
            <button 
              type="button"
              [disabled]="isProcessing"
              (click)="onModelChange('gemini-2.5-flash')"
              title="Gemini 2.5 Flash (80K tokens - Rất ổn định, ít nghẽn mạng)"
              class="group relative flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
              [class.cursor-not-allowed]="isProcessing"
              [class.cursor-pointer]="!isProcessing"
              [class.opacity-50]="isProcessing && selectedModel !== 'gemini-2.5-flash'"
              [ngClass]="selectedModel === 'gemini-2.5-flash' ? 'bg-white text-sky-600 shadow-sm ring-1 ring-slate-900/5' : (isProcessing ? 'text-slate-400' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50')"
            >
              <lucide-icon [img]="Zap" class="w-3.5 h-3.5 text-sky-500"></lucide-icon>
              <span>Flash 2.5</span>
              <span class="text-[9.5px] font-mono px-1 py-0.2 rounded bg-sky-50 text-sky-700 border border-sky-200/60 font-bold">80K</span>
            </button>

            <!-- Dropdown for All Models (Flash 3.7, Flash 3.5, Pro, Lite...) -->
            <div class="relative">
              <button 
                type="button"
                [disabled]="isProcessing"
                (click)="toggleMenu()"
                class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200"
                [class.cursor-not-allowed]="isProcessing"
                [class.cursor-pointer]="!isProcessing"
                [ngClass]="isCustomModelSelected ? 'bg-white text-indigo-600 shadow-sm ring-1 ring-slate-900/5' : (isProcessing ? 'text-slate-400' : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50')"
                title="Xem danh sách 8 mô hình Gemini (Pro, Flash 3.7, 3.5, 2.0...)"
              >
                @if (isCustomModelSelected) {
                  <lucide-icon [img]="currentModelInfo.category === 'flash' ? Zap : Sparkles" class="w-3.5 h-3.5" [class.text-emerald-500]="currentModelInfo.category === 'flash'" [class.text-indigo-500]="currentModelInfo.category === 'pro'"></lucide-icon>
                  <span>{{ currentModelInfo.shortName }}</span>
                  <span class="text-[9.5px] font-mono px-1 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 font-bold">{{ currentModelInfo.maxPdfTokens / 1000 }}K</span>
                } @else {
                  <span>Thêm...</span>
                }
                <lucide-icon [img]="ChevronDown" class="w-3 h-3 transition-transform duration-200" [class.rotate-180]="isMenuOpen"></lucide-icon>
              </button>

              @if (isMenuOpen) {
                <!-- Overlay to close -->
                <div class="fixed inset-0 z-40" (click)="closeMenu()"></div>

                <!-- Dropdown panel -->
                <div class="absolute right-0 sm:left-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div class="px-3 py-2 border-b border-slate-100 flex items-center justify-between mb-1">
                    <span class="text-[11px] font-bold tracking-wider uppercase text-slate-500">Danh mục mô hình Gemini</span>
                    <span class="text-[10px] text-slate-400 font-mono">Token trần PDF</span>
                  </div>

                  <!-- Flash Models Group -->
                  <div class="py-1">
                    <div class="px-3 pt-1 pb-1 text-[10.5px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                      <lucide-icon [img]="Zap" class="w-3 h-3"></lucide-icon>
                      Dòng Flash (Tốc độ cao & 60K-80K Tokens)
                    </div>
                    <div class="space-y-1">
                      @for (m of flashModels; track m.id) {
                        <button
                          type="button"
                          (click)="selectModelFromMenu(m.id)"
                          class="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 transition-colors cursor-pointer"
                          [ngClass]="selectedModel === m.id ? 'bg-emerald-50/80 text-emerald-950 font-semibold ring-1 ring-emerald-300' : 'hover:bg-slate-50 text-slate-700'"
                        >
                          <lucide-icon [img]="Zap" class="w-4 h-4 text-emerald-500 shrink-0 mt-0.5"></lucide-icon>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="font-medium text-slate-900">{{ m.name }}</span>
                              <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 font-bold">{{ m.maxPdfTokens / 1000 }}K tokens</span>
                              @if (m.badge) {
                                <span class="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-emerald-100 text-emerald-800">{{ m.badge }}</span>
                              }
                            </div>
                            <p class="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5">{{ m.description }}</p>
                          </div>
                          @if (selectedModel === m.id) {
                            <lucide-icon [img]="CheckCircle2" class="w-4 h-4 text-emerald-600 shrink-0 mt-0.5"></lucide-icon>
                          }
                        </button>
                      }
                    </div>
                  </div>

                  <!-- Pro Models Group -->
                  <div class="py-1 border-t border-slate-100 mt-1">
                    <div class="px-3 pt-1.5 pb-1 text-[10.5px] font-bold text-indigo-600 uppercase tracking-wider flex items-center gap-1">
                      <lucide-icon [img]="Sparkles" class="w-3 h-3"></lucide-icon>
                      Dòng Pro (Lập luận chuyên sâu 30K Tokens)
                    </div>
                    <div class="space-y-1">
                      @for (m of proModels; track m.id) {
                        <button
                          type="button"
                          (click)="selectModelFromMenu(m.id)"
                          class="w-full text-left px-3 py-2 rounded-xl text-xs flex items-start gap-2.5 transition-colors cursor-pointer"
                          [ngClass]="selectedModel === m.id ? 'bg-indigo-50/80 text-indigo-950 font-semibold ring-1 ring-indigo-300' : 'hover:bg-slate-50 text-slate-700'"
                        >
                          <lucide-icon [img]="Sparkles" class="w-4 h-4 text-indigo-500 shrink-0 mt-0.5"></lucide-icon>
                          <div class="flex-1 min-w-0">
                            <div class="flex items-center gap-1.5 flex-wrap">
                              <span class="font-medium text-slate-900">{{ m.name }}</span>
                              <span class="px-1.5 py-0.2 rounded text-[10px] font-mono bg-slate-100 text-slate-700 border border-slate-200 font-bold">{{ m.maxPdfTokens / 1000 }}K tokens</span>
                              @if (m.badge) {
                                <span class="px-1.5 py-0.2 rounded text-[9.5px] font-semibold bg-indigo-100 text-indigo-800">{{ m.badge }}</span>
                              }
                            </div>
                            <p class="text-[11px] text-slate-500 font-normal line-clamp-1 mt-0.5">{{ m.description }}</p>
                          </div>
                          @if (selectedModel === m.id) {
                            <lucide-icon [img]="CheckCircle2" class="w-4 h-4 text-indigo-600 shrink-0 mt-0.5"></lucide-icon>
                          }
                        </button>
                      }
                    </div>
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
        
        <!-- Search Bar -->
        <div class="w-full lg:w-auto flex justify-center lg:justify-end mt-2 lg:mt-0">
          <app-search-bar [isProcessing]="isProcessing" class="w-full lg:w-auto"></app-search-bar>
        </div>
      </div>
    </header>
  `
})
export class HeaderControlsComponent {
  readonly FileText = FileText;
  readonly Sparkles = Sparkles;
  readonly Zap = Zap;
  readonly Key = Key;
  readonly ChevronDown = ChevronDown;
  readonly CheckCircle2 = CheckCircle2;

  readonly allModels = AVAILABLE_MODELS;
  readonly flashModels = AVAILABLE_MODELS.filter(m => m.category === 'flash');
  readonly proModels = AVAILABLE_MODELS.filter(m => m.category === 'pro');

  isMenuOpen = false;

  @Input() isProcessing = false;
  @Input() selectedModel = 'gemini-3.8-flash';
  @Input() hasUserApiKey = false;
  
  @Output() modelChange = new EventEmitter<string>();
  @Output() openApiKeyModal = new EventEmitter<void>();

  get currentModelInfo(): ModelOption {
    return getModelInfo(this.selectedModel);
  }

  get isCustomModelSelected(): boolean {
    return this.selectedModel !== 'gemini-3.8-flash' && this.selectedModel !== 'gemini-2.5-flash';
  }

  toggleMenu() {
    if (this.isProcessing) return;
    this.isMenuOpen = !this.isMenuOpen;
  }

  closeMenu() {
    this.isMenuOpen = false;
  }

  selectModelFromMenu(modelId: string) {
    this.onModelChange(modelId);
    this.isMenuOpen = false;
  }

  onModelChange(model: string) {
    this.modelChange.emit(model);
  }

  onOpenApiKeyModal() {
    this.openApiKeyModal.emit();
  }
}
