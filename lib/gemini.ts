import {
  GoogleGenerativeAI,
  SchemaType,
  type GenerationConfig,
} from '@google/generative-ai';
import type { Analysis } from './types';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    confidence: { type: SchemaType.NUMBER, description: '0–100 confidence in the analysis.' },
    metalType: { type: SchemaType.STRING, description: 'e.g. "18K Yellow Gold".' },
    metalPurity: { type: SchemaType.STRING, description: 'e.g. "75.0% gold (750 hallmark)".' },
    gemstone: { type: SchemaType.STRING, description: 'Primary stone, e.g. "Natural Diamond".' },
    gemstoneDetails: { type: SchemaType.STRING, description: 'Carat, clarity, color, size, etc.' },
    estimatedValue: {
      type: SchemaType.OBJECT,
      properties: {
        low: { type: SchemaType.NUMBER },
        high: { type: SchemaType.NUMBER },
      },
      required: ['low', 'high'],
    },
    style: { type: SchemaType.STRING },
    era: { type: SchemaType.STRING, description: 'Date range, e.g. "1920s – 1935".' },
    condition: { type: SchemaType.STRING, description: 'Excellent / Very Good / Good / Fair.' },
    conditionScore: { type: SchemaType.NUMBER, description: '0–100.' },
    signals: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Four short authenticity signals.',
    },
    care: {
      type: SchemaType.ARRAY,
      items: { type: SchemaType.STRING },
      description: 'Four short care tips.',
    },
  },
  required: [
    'confidence', 'metalType', 'metalPurity', 'gemstone', 'gemstoneDetails',
    'estimatedValue', 'style', 'era', 'condition', 'conditionScore', 'signals', 'care',
  ],
} as const;

const PROMPT = `You are a jewelry appraiser. Analyze the image and produce a single JSON object
matching the provided schema. Be concise — each "signals" or "care" item must be one short
sentence. If a detail cannot be determined from the image, give a conservative best estimate
based on the visible style, materials, and craftsmanship. Estimated value should be a realistic
retail range in USD for a piece of this apparent quality. Confidence reflects how clearly the
image supports your conclusions.`;

export async function analyzeJewelryImage(input: {
  imageBytes: Uint8Array;
  mimeType: string;
  pieceName: string;
}): Promise<Analysis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY is not set');

  const genAI = new GoogleGenerativeAI(apiKey);
  const generationConfig: GenerationConfig = {
    responseMimeType: 'application/json',
    // The Generative AI SDK accepts a JSON-Schema-ish shape via responseSchema.
    // Casting to any keeps the type-check happy across SDK versions.
    responseSchema: responseSchema as unknown as GenerationConfig['responseSchema'],
    temperature: 0.4,
  };

  const model = genAI.getGenerativeModel({ model: MODEL, generationConfig });

  const base64 = Buffer.from(input.imageBytes).toString('base64');
  const result = await model.generateContent([
    { text: `${PROMPT}\n\nPiece label: ${input.pieceName || 'Untitled'}` },
    { inlineData: { data: base64, mimeType: input.mimeType } },
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text) as Analysis;
  return normalize(parsed);
}

function normalize(a: Analysis): Analysis {
  return {
    ...a,
    confidence: clamp(Math.round(a.confidence), 0, 100),
    conditionScore: clamp(Math.round(a.conditionScore), 0, 100),
    estimatedValue: {
      low: Math.max(0, Math.round(a.estimatedValue.low)),
      high: Math.max(0, Math.round(a.estimatedValue.high)),
    },
    signals: (a.signals || []).slice(0, 6),
    care: (a.care || []).slice(0, 6),
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}
