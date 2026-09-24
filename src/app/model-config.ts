export interface ModelOption {
  id: string;
  name: string;
  shortName: string;
  category: 'flash' | 'pro';
  maxPdfTokens: number;
  maxHtmlTokens: number;
  badge?: string;
  badgeColor?: 'emerald' | 'sky' | 'indigo' | 'amber' | 'teal';
  description: string;
  recommended?: boolean;
}

export const AVAILABLE_MODELS: ModelOption[] = [
  {
    id: 'gemini-3.8-flash',
    name: 'Gemini 3.8 Flash',
    shortName: 'Flash 3.8',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Mặc định • 80K',
    badgeColor: 'emerald',
    description: 'Thế hệ Flash 3.8 mới nhất, tốc độ cao, đa phương thức mạnh mẽ (80K tokens)',
    recommended: true
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    shortName: 'Flash 3.7',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Khuyên dùng • 80K',
    badgeColor: 'sky',
    description: 'Rất ổn định, suy luận tốt, dự phòng hoàn hảo khi 3.8 quá tải (80K tokens)',
    recommended: true
  },
  {
    id: 'gemini-3.6-flash',
    name: 'Gemini 3.6 Flash',
    shortName: 'Flash 3.6',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: '80K tokens',
    badgeColor: 'emerald',
    description: 'Dòng Flash 3.6 ổn định cao, tốc độ phản hồi nhanh (80K tokens)'
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    shortName: 'Flash 3.5',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: '80K tokens',
    badgeColor: 'emerald',
    description: 'Mô hình Flash 3.5 dự phòng đáng tin cậy (80K tokens)'
  },
  {
    id: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    shortName: 'Flash 3.5 Lite',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Siêu nhẹ • 80K',
    badgeColor: 'teal',
    description: 'Bản Flash-Lite 3.5 tối ưu độ trễ, tiết kiệm tài nguyên (80K tokens)'
  },
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    shortName: 'Flash 3.1 Lite',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Siêu nhẹ • 80K',
    badgeColor: 'teal',
    description: 'Bản Lite 3.1 phản hồi tức thì cho tài liệu dung lượng nhẹ (80K tokens)'
  },
  {
    id: 'gemini-3-flash-preview',
    name: 'Gemini 3 Flash Preview',
    shortName: 'Flash 3 Preview',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Preview • 80K',
    badgeColor: 'amber',
    description: 'Bản Preview của thế hệ Gemini 3 Flash (80K tokens)'
  },
  {
    id: 'gemini-flash-latest',
    name: 'Gemini Flash Latest',
    shortName: 'Flash Latest',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Auto Update • 80K',
    badgeColor: 'emerald',
    description: 'Tự động trỏ tới phiên bản Flash mới nhất của Google (80K tokens)'
  },
  {
    id: 'gemini-flash-lite-latest',
    name: 'Gemini Flash-Lite Latest',
    shortName: 'Flash-Lite Latest',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Auto Update • 80K',
    badgeColor: 'teal',
    description: 'Tự động trỏ tới bản Flash-Lite mới nhất của Google (80K tokens)'
  },
  {
    id: 'gemini-pro-latest',
    name: 'Gemini Pro Latest',
    shortName: 'Pro',
    category: 'pro',
    maxPdfTokens: 30000,
    maxHtmlTokens: 35000,
    badge: 'Toán & Kỹ thuật • 30K',
    badgeColor: 'indigo',
    description: 'Phân tích lập luận và công thức toán học chuyên sâu (30K tokens)'
  }
];

export function getModelInfo(modelId: string): ModelOption {
  return AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
}

export function isFlashModel(modelId: string): boolean {
  const m = getModelInfo(modelId);
  return m.category === 'flash';
}
