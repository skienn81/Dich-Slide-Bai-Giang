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
    badge: 'Mới nhất',
    badgeColor: 'emerald',
    description: 'Thế hệ Flash 3.8 mới nhất, tốc độ cao, đa phương thức mạnh mẽ (80K tokens)',
    recommended: true
  },
  {
    id: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    shortName: 'Flash 2.5',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Rất ổn định • Ít nghẽn',
    badgeColor: 'sky',
    description: 'Hạn mức TPM cực cao, ít khi quá tải, dự phòng hoàn hảo khi 3.8 bận (80K tokens)',
    recommended: true
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    shortName: 'Flash 3.7',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Flash 3.7',
    badgeColor: 'emerald',
    description: 'Cân bằng giữa tốc độ và khả năng suy luận, 80K tokens'
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    shortName: 'Flash 3.5',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Flash 3.5',
    badgeColor: 'emerald',
    description: 'Phiên bản Flash 3.5 ổn định cao, phản hồi nhanh (80K tokens)'
  },
  {
    id: 'gemini-2.0-flash',
    name: 'Gemini 2.0 Flash',
    shortName: 'Flash 2.0',
    category: 'flash',
    maxPdfTokens: 60000,
    maxHtmlTokens: 90000,
    badge: 'Siêu tốc',
    badgeColor: 'amber',
    description: 'Phản hồi cực nhanh cho tài liệu vừa và nhỏ (60K tokens)'
  },
  {
    id: 'gemini-2.5-flash-lite',
    name: 'Gemini 2.5 Flash-Lite',
    shortName: 'Flash 2.5 Lite',
    category: 'flash',
    maxPdfTokens: 80000,
    maxHtmlTokens: 120000,
    badge: 'Siêu nhẹ',
    badgeColor: 'teal',
    description: 'Tiết kiệm token tối đa, độ trễ thấp nhất (80K tokens)'
  },
  {
    id: 'gemini-pro-latest',
    name: 'Gemini Pro Latest',
    shortName: 'Pro',
    category: 'pro',
    maxPdfTokens: 30000,
    maxHtmlTokens: 35000,
    badge: 'Toán & Kỹ thuật',
    badgeColor: 'indigo',
    description: 'Phân tích lập luận và công thức toán học chuyên sâu (30K tokens)'
  },
  {
    id: 'gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    shortName: 'Pro 2.5',
    category: 'pro',
    maxPdfTokens: 30000,
    maxHtmlTokens: 35000,
    badge: 'Pro 2.5',
    badgeColor: 'indigo',
    description: 'Bản Pro ổn định cao cho slide học thuật phức tạp (30K tokens)'
  }
];

export function getModelInfo(modelId: string): ModelOption {
  return AVAILABLE_MODELS.find(m => m.id === modelId) || AVAILABLE_MODELS[0];
}

export function isFlashModel(modelId: string): boolean {
  const m = getModelInfo(modelId);
  return m.category === 'flash';
}
