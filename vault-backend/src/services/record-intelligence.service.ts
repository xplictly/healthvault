import pdfParse from 'pdf-parse';

export interface RecordInsight {
  category: string;
  confidence: number;
  summary: string;
  keywords: string[];
  extractedMetrics: string[];
  disclaimer: string;
  engine: string;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Laboratory Report': ['lab', 'laboratory', 'glucose', 'hemoglobin', 'cholesterol', 'wbc', 'rbc', 'platelet', 'reference range', 'test result'],
  Prescription: ['prescription', 'dosage', 'tablet', 'capsule', 'medication', 'rx', 'pharmacy', 'daily', 'mg'],
  'Radiology Report': ['radiology', 'x-ray', 'mri', 'ct scan', 'ultrasound', 'imaging', 'scan', 'findings'],
  'Discharge Summary': ['discharge', 'admission', 'hospital', 'diagnosis', 'treatment summary', 'follow-up'],
  'Medical Summary': ['patient', 'medical', 'history', 'clinical', 'health', 'report'],
};

export async function analyzeMedicalRecord(
  buffer: Buffer,
  mimeType: string,
  fileName: string,
): Promise<RecordInsight> {
  let text = '';

  if (mimeType === 'application/pdf' || fileName.toLowerCase().endsWith('.pdf')) {
    try {
      const parsed = await pdfParse(buffer);
      text = parsed.text || '';
    } catch {
      text = '';
    }
  } else if (mimeType.startsWith('text/') || mimeType === 'application/json') {
    text = buffer.toString('utf8');
  } else if (mimeType.startsWith('image/')) {
    const { recognize } = await import('tesseract.js');
    const result = await recognize(buffer, 'eng');
    text = result.data.text || '';
  }

  const searchable = `${fileName} ${text}`.toLowerCase();
  let bestCategory = 'Medical Record';
  let bestScore = 0;

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = keywords.reduce((total, keyword) => total + (searchable.includes(keyword) ? 1 : 0), 0);
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  const keywordSet = CATEGORY_KEYWORDS[bestCategory] || [];
  const keywords = keywordSet.filter((keyword) => searchable.includes(keyword)).slice(0, 6);
  const confidence = bestScore === 0 ? 38 : Math.min(96, 52 + bestScore * 8);

  const normalized = text.replace(/\s+/g, ' ').trim();
  const summary = normalized
    ? `${normalized.slice(0, 220)}${normalized.length > 220 ? '...' : ''}`
    : `A ${bestCategory.toLowerCase()} was identified from the filename and available document metadata. Text extraction is unavailable for this file format.`;

  const metricMatches = text.match(/.{0,20}(?:mg\/dl|mmol\/l|g\/dl|bpm|mmhg|%|mg|mcg)\b.{0,30}/gi) || [];
  const extractedMetrics = Array.from(new Set(metricMatches.map((value) => value.trim()))).slice(0, 8);

  return {
    category: bestCategory,
    confidence,
    summary,
    keywords,
    extractedMetrics,
    disclaimer: 'Decision support only. This local analysis is not a medical diagnosis and must not replace a qualified clinician.',
    engine: 'HealthVault Local Record Intelligence v1',
  };
}
