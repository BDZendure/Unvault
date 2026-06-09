// Smoke test the Gemini API key against the same model + schema lib/gemini.ts uses.
//
// Run with:  node --env-file=.env.local scripts/gemini-test.mjs

import { readFile, readdir } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const required = ['GEMINI_API_KEY'];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`missing env: ${k}`);
    process.exit(1);
  }
}

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash-exp';
const IMAGES_DIR = new URL('../testing_images/', import.meta.url).pathname;

const MIME = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    confidence: { type: SchemaType.NUMBER },
    metalType: { type: SchemaType.STRING },
    metalPurity: { type: SchemaType.STRING },
    gemstone: { type: SchemaType.STRING },
    gemstoneDetails: { type: SchemaType.STRING },
    estimatedValue: {
      type: SchemaType.OBJECT,
      properties: {
        low: { type: SchemaType.NUMBER },
        high: { type: SchemaType.NUMBER },
      },
      required: ['low', 'high'],
    },
    style: { type: SchemaType.STRING },
    era: { type: SchemaType.STRING },
    condition: { type: SchemaType.STRING },
    conditionScore: { type: SchemaType.NUMBER },
    signals: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    care: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
  },
  required: [
    'confidence', 'metalType', 'metalPurity', 'gemstone', 'gemstoneDetails',
    'estimatedValue', 'style', 'era', 'condition', 'conditionScore', 'signals', 'care',
  ],
};

const PROMPT = `You are a jewelry appraiser. Analyze the image and produce a single JSON object
matching the provided schema. Be concise — each "signals" or "care" item must be one short
sentence. If a detail cannot be determined from the image, give a conservative best estimate
based on the visible style, materials, and craftsmanship. Estimated value should be a realistic
retail range in USD for a piece of this apparent quality. Confidence reflects how clearly the
image supports your conclusions.`;

async function analyze(filePath, label) {
  const ext = extname(filePath).toLowerCase();
  const mimeType = MIME[ext];
  if (!mimeType) throw new Error(`unsupported file type: ${ext}`);

  const bytes = await readFile(filePath);
  const base64 = bytes.toString('base64');

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
      temperature: 0.4,
    },
  });

  const t0 = Date.now();
  const result = await model.generateContent([
    { text: `${PROMPT}\n\nPiece label: ${label}` },
    { inlineData: { data: base64, mimeType } },
  ]);
  const ms = Date.now() - t0;
  const parsed = JSON.parse(result.response.text());
  return { ms, parsed };
}

const targets = (await readdir(IMAGES_DIR))
  .filter((n) => /\.(jpe?g|png|webp)$/i.test(n))
  .sort();

if (targets.length === 0) {
  console.error(`no images found in ${IMAGES_DIR}`);
  process.exit(1);
}

console.log(`model: ${MODEL}`);
console.log(`images: ${targets.join(', ')}\n`);

let failures = 0;
for (const name of targets) {
  const label = name.replace(/\.[^.]+$/, '');
  console.log(`── ${name} ──`);
  try {
    const { ms, parsed } = await analyze(join(IMAGES_DIR, name), label);
    console.log(`  ok (${ms}ms)`);
    console.log(`  ${parsed.metalType} · ${parsed.gemstone}`);
    console.log(`  value: $${parsed.estimatedValue.low}–$${parsed.estimatedValue.high}`);
    console.log(`  confidence: ${parsed.confidence} · condition: ${parsed.condition} (${parsed.conditionScore})`);
    console.log(`  era: ${parsed.era} · style: ${parsed.style}`);
    console.log(`  signals: ${parsed.signals.length} · care: ${parsed.care.length}`);
  } catch (e) {
    failures++;
    console.log(`  FAIL: ${e?.message ?? e}`);
  }
  console.log('');
}

process.exit(failures > 0 ? 1 : 0);
