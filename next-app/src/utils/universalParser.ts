/**
 * Universal Heuristic Parser v3
 *
 * Goal: Accept "any" input shape (string / number / object / array / browser Event / DOM element / FormData / URLSearchParams / etc.)
 * and robustly extract entry blocks + event metadata.
 *
 * v2 FIX retained: Prioritized Marker Categorization
 * - Uses ONE marker category for block splitting
 * - Priority: CIRCLED (①-㊿) > NUMBERED (1. 2.) > SYMBOLS (・-*) > EMPTY_LINES
 *
 * v3 ADDITIONS:
 * - parseUniversal now accepts unknown input (not only string)
 * - best-effort input normalization (browser events, elements, FormData, objects, arrays, JSON snippets)
 * - marker lines are no longer discarded; marker prefix is stripped and remaining content is parsed
 */

import { ParsedEntry } from './bulkTextParser';

export interface UniversalParseResult {
    entries: ParsedEntry[];
    confidence: number;
    strategyUsed: string;
    warnings: string[];
}

export interface ParseUniversalOptions {
    /** Maximum chars to keep after normalization (default 20000) */
    maxTextLength?: number;
    /** Do not strip HTML tags (default false) */
    keepHtml?: boolean;
    /** When input is a Blob/File, try to stringify only (sync) and add warning (default true) */
    allowNonSyncPayloads?: boolean;
}

// --- 1. Line Classification ---

type LineType = 'EMPTY' | 'CIRCLED_MARKER' | 'NUMBERED_MARKER' | 'SYMBOL_MARKER' | 'KEYVALUE' | 'DATE' | 'TEXT';

interface LineSignature {
    index: number;
    text: string;
    type: LineType;
    indent: number;
}

// Separate regexes for each marker category
const CIRCLED_MARKER = /^[\u2460-\u2473\u3251-\u325F\u32B1-\u32BF]/; // Circled numbers 1-50 (detailed ranges)
const NUMBERED_MARKER = /^\d{1,2}\.\s/; // "1. " or "12. " - requires space, max 2 digits to avoid years
const SYMBOL_MARKER = /^[・\-\*■◆●▼▲]/; // Bullet symbols

const DATE_PATTERN = /\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}|(\d{1,2}月\d{1,2}日)/;
const KEYVALUE_PATTERN = /^[^：:]+[：:]/;

function getLineSignature(line: string, index: number): LineSignature {
    const trimmed = line.trim();
    if (!trimmed) {
        return { index, text: line, type: 'EMPTY', indent: 0 };
    }

    const indent = line.search(/\S|$/);

    // Check markers in priority order
    if (CIRCLED_MARKER.test(trimmed)) {
        return { index, text: line, type: 'CIRCLED_MARKER', indent };
    }
    if (NUMBERED_MARKER.test(trimmed)) {
        return { index, text: line, type: 'NUMBERED_MARKER', indent };
    }
    if (SYMBOL_MARKER.test(trimmed)) {
        return { index, text: line, type: 'SYMBOL_MARKER', indent };
    }

    // Non-marker classifications
    if (KEYVALUE_PATTERN.test(trimmed)) {
        return { index, text: line, type: 'KEYVALUE', indent };
    }
    if (DATE_PATTERN.test(trimmed) && trimmed.length < 25) {
        return { index, text: line, type: 'DATE', indent };
    }

    return { index, text: line, type: 'TEXT', indent };
}

// --- 2. Block Splitting with Marker Priority ---

function splitBlocksUniversal(signatures: LineSignature[]): LineSignature[][] {
    // Collect line indices for each marker category
    const circledIndices: number[] = [];
    const numberedIndices: number[] = [];
    const symbolIndices: number[] = [];

    signatures.forEach((s, idx) => {
        switch (s.type) {
            case 'CIRCLED_MARKER':
                circledIndices.push(idx);
                break;
            case 'NUMBERED_MARKER':
                numberedIndices.push(idx);
                break;
            case 'SYMBOL_MARKER':
                symbolIndices.push(idx);
                break;
        }
    });

    // Choose ONLY ONE marker type based on priority
    let splitIndices: number[] = [];

    if (circledIndices.length >= 1) {
        splitIndices = circledIndices;
    } else if (numberedIndices.length >= 2) {
        splitIndices = numberedIndices;
    } else if (symbolIndices.length >= 3) {
        splitIndices = symbolIndices;
    }

    // Use marker-based splitting if we have indices
    if (splitIndices.length >= 1) {
        const blocks: LineSignature[][] = [];

        // NEW: Capture content BEFORE the first marker as block #0
        if (splitIndices[0] > 0) {
            const preMarkerBlock = signatures.slice(0, splitIndices[0]).filter((s) => s.type !== 'EMPTY');
            if (preMarkerBlock.length > 0) {
                blocks.push(preMarkerBlock);
            }
        }

        for (let i = 0; i < splitIndices.length; i += 1) {
            const start = splitIndices[i];
            const end = i + 1 < splitIndices.length ? splitIndices[i + 1] : signatures.length;

            const block = signatures.slice(start, end).filter((s) => s.type !== 'EMPTY');
            if (block.length > 0) blocks.push(block);
        }
        return blocks;
    }

    // Fallback: Empty line splitting (require 2+ empty lines for robustness)
    const blocksByEmpty: LineSignature[][] = [];
    let currentBlock: LineSignature[] = [];
    let consecutiveEmptyCount = 0;

    signatures.forEach((s) => {
        if (s.type === 'EMPTY') {
            consecutiveEmptyCount += 1;
        } else {
            // Split only on 2+ consecutive empty lines
            if (consecutiveEmptyCount >= 2 && currentBlock.length > 0) {
                blocksByEmpty.push(currentBlock);
                currentBlock = [];
            }
            currentBlock.push(s);
            consecutiveEmptyCount = 0;
        }
    });
    if (currentBlock.length > 0) blocksByEmpty.push(currentBlock);

    return blocksByEmpty;
}

// --- 3. Field Inference ---

function extractValue(text: string): string {
    return text.replace(/^[^：:]+[：:]\s*/, '').trim();
}

function stripMarkerPrefix(line: string): string {
    const s = line.trim();
    if (!s) return '';
    if (CIRCLED_MARKER.test(s)) return s.replace(/^[①-㊿]\s*/, '').trim();
    if (NUMBERED_MARKER.test(s)) return s.replace(/^\d{1,2}\.\s*/, '').trim();
    if (SYMBOL_MARKER.test(s)) return s.replace(/^[・\-\*■◆●▼▲]+\s*/, '').trim();
    return s;
}

function guessField(line: string): { type: 'date' | 'venue' | 'account' | 'event' | 'eventJp' | 'hashtag' | 'unknown'; value: string } {
    const text = line.trim();

    // Explicit Labels (highest priority)
    if (/^(日付|Date|日時)[：:]/i.test(text)) return { type: 'date', value: extractValue(text) };
    if (/^(会場|場所|Venue|会場場所)[：:]/i.test(text)) return { type: 'venue', value: extractValue(text) };
    if (/^(イベント名|Event|イベント|Title|Name)[：:]/i.test(text)) return { type: 'event', value: extractValue(text) };
    if (/^(日本語名|日本語|和名)[：:]/i.test(text)) return { type: 'eventJp', value: extractValue(text) };
    if (/^(ハッシュタグ|Hashtag|Tags?|タグ)[：:]/i.test(text)) return { type: 'hashtag', value: extractValue(text) };

    // Content Inference (pattern-based)
    if (DATE_PATTERN.test(text)) return { type: 'date', value: text };
    if (/@([a-zA-Z0-9_]+)/.test(text)) return { type: 'account', value: text };

    // Venue heuristics (common Japanese venue keywords)
    if (/(ホール|Hall|展示場|赤レンガ|スクエア|プラザ|ドーム|アリーナ|House|ハウス|Camp|キャンプ|マンガミュージアム|会議場|大学)/.test(text)) {
        return { type: 'venue', value: text };
    }

    return { type: 'unknown', value: text };
}

// --- 4. Input normalization (best-effort) ---

function normalizeAnyInputToText(input: unknown, options: ParseUniversalOptions): { text: string; type: string; warnings: string[] } {
    const warnings: string[] = [];
    const maxLen = typeof options.maxTextLength === 'number' ? options.maxTextLength : 20000;

    const type = detectInputType(input);
    let text = '';

    try {
        if (input == null) {
            text = '';
        } else if (typeof input === 'string') {
            text = input;
        } else if (typeof input === 'number' || typeof input === 'boolean' || typeof input === 'bigint') {
            text = String(input);
        } else if (Array.isArray(input)) {
            text = input
                .map((x) => normalizeAnyInputToText(x, options).text)
                .filter(Boolean)
                .join('\n');
        } else if (isBrowserEvent(input)) {
            // Common event types: input/change/paste/drop/submit
            const parts: string[] = [];
            const anyEv = input as any;
            parts.push(`[event:${anyEv.type || 'unknown'}]`);

            const target = anyEv.target || anyEv.currentTarget;
            if (target) {
                const extracted = extractTextFromElement(target);
                if (extracted) parts.push(extracted);

                // DataTransfer (drop)
                if (anyEv.dataTransfer?.getData) {
                    const dtText = anyEv.dataTransfer.getData('text') || anyEv.dataTransfer.getData('text/plain');
                    if (dtText) parts.push(dtText);
                }

                // Clipboard (paste)
                if (anyEv.clipboardData?.getData) {
                    const cbText = anyEv.clipboardData.getData('text') || anyEv.clipboardData.getData('text/plain');
                    if (cbText) parts.push(cbText);
                }
            }

            // Some frameworks put payload in detail
            if (anyEv.detail != null) {
                const detailText = normalizeAnyInputToText(anyEv.detail, options).text;
                if (detailText) parts.push(detailText);
            }

            text = parts.filter(Boolean).join('\n');
        } else if (isFormData(input)) {
            const parts: string[] = [];
            for (const [k, v] of (input as any).entries()) {
                if (typeof v === 'string') parts.push(`${k}: ${v}`);
            }
            text = parts.join('\n');
        } else if (isURLSearchParams(input)) {
            text = String((input as any).toString());
        } else if (isHTMLElementLike(input)) {
            text = extractTextFromElement(input as any);
        } else if (isBlobLike(input)) {
            const allow = options.allowNonSyncPayloads !== false;
            if (allow) {
                const anyBlob = input as any;
                text = `[blob:${anyBlob.type || 'unknown'} size=${anyBlob.size ?? 'unknown'} name=${anyBlob.name ?? ''}]`;
                warnings.push('Blob/Fileは同期的に読み取れないため、text() で読み出した文字列を渡してください。');
            } else {
                text = '';
                warnings.push('Blob/File入力は無効化されています。');
            }
        } else if (typeof input === 'object') {
            // If the object already resembles a {text: ...} payload, prefer it.
            const anyObj = input as any;
            if (typeof anyObj.text === 'string' && anyObj.text.trim()) {
                text = anyObj.text;
            } else {
                // Try to pull common fields to avoid noisy JSON dumps.
                const candidates = extractStructuredCandidates(anyObj);
                if (candidates.length) {
                    text = candidates.join('\n');
                } else {
                    try {
                        text = JSON.stringify(anyObj, null, 2);
                    } catch {
                        text = String(anyObj);
                    }
                }
            }
        } else {
            text = String(input);
        }
    } catch {
        try {
            text = String(input as any);
        } catch {
            text = '';
            warnings.push('入力の文字列化に失敗しました。');
        }
    }

    // If string looks like JSON, try to parse and re-render to text (improves extraction).
    const structured = tryParseStructuredText(text);
    if (structured != null) {
        const st = structuredToText(structured);
        if (st) text = `${st}\n${text}`;
    }

    if (!options.keepHtml) text = stripHtml(text);
    text = sanitizeText(text);

    if (text.length > maxLen) text = `${text.slice(0, maxLen)}\n…(truncated)`;

    return { text, type, warnings };
}

function detectInputType(input: unknown): string {
    if (input == null) return 'null';
    if (typeof input === 'string') return 'string';
    if (Array.isArray(input)) return 'array';
    if (typeof input === 'object') {
        if (isBrowserEvent(input)) return 'event';
        if (isFormData(input)) return 'formdata';
        if (isURLSearchParams(input)) return 'urlsearchparams';
        if (isHTMLElementLike(input)) return 'element';
        if (isBlobLike(input)) return 'blob';
        return 'object';
    }
    return typeof input;
}

function isBrowserEvent(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false;
    const anyX = x as any;
    return ('type' in anyX || 'target' in anyX || 'currentTarget' in anyX) && !Array.isArray(anyX);
}

function isHTMLElementLike(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false;
    const anyX = x as any;
    return (anyX.nodeType === 1 || anyX.nodeType === 9) && typeof anyX.tagName === 'string';
}

function isFormData(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false;
    const anyX = x as any;
    return typeof anyX.entries === 'function' && typeof anyX.append === 'function';
}

function isURLSearchParams(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false;
    const anyX = x as any;
    return typeof anyX.toString === 'function' && typeof anyX.get === 'function' && typeof anyX.set === 'function';
}

function isBlobLike(x: unknown): boolean {
    if (!x || typeof x !== 'object') return false;
    const anyX = x as any;
    // Blob/File typically has size+type and (arrayBuffer|text) functions.
    return typeof anyX.size === 'number' && typeof anyX.type === 'string' && (typeof anyX.text === 'function' || typeof anyX.arrayBuffer === 'function');
}

function extractTextFromElement(el: any): string {
    try {
        if (!el) return '';
        if (typeof el.value === 'string' && el.value.trim()) return el.value;
        if (typeof el.textContent === 'string' && el.textContent.trim()) return el.textContent;
        if (typeof el.innerText === 'string' && el.innerText.trim()) return el.innerText;
        return '';
    } catch {
        return '';
    }
}

function extractStructuredCandidates(obj: any): string[] {
    const out: string[] = [];

    // Common keys that often contain event info
    const commonKeys = [
        'text',
        'title',
        'name',
        'subject',
        'message',
        'body',
        'content',
        'description',
        'desc',
        'event',
        'eventEn',
        'eventJp',
        'date',
        'when',
        'time',
        'period',
        'venue',
        'place',
        'where',
        'location',
        'hashtags',
        'tags',
        'series',
        'round',
        'url',
        'link',
        // bulk entry related
        'boothName',
        'boothAccount',
        'personName',
        'personAccount',
        'rawText',
    ];

    // Include nested payloads commonly used by frameworks
    const nestedKeys = ['detail', 'data', 'payload', 'params', 'meta', 'eventInfo'];

    const pushKV = (k: string, v: any) => {
        if (v == null) return;
        if (typeof v === 'string') {
            const s = v.trim();
            if (s) out.push(`${k}: ${s}`);
            return;
        }
        if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
            out.push(`${k}: ${String(v)}`);
            return;
        }
        if (Array.isArray(v)) {
            const joined = v
                .map((x) => (typeof x === 'string' ? x : safeToString(x)))
                .filter(Boolean)
                .join(' / ');
            if (joined) out.push(`${k}: ${joined}`);
            return;
        }
        if (typeof v === 'object') {
            const shallow = shallowPick(v, commonKeys);
            if (Object.keys(shallow).length) out.push(`${k}: ${safeToString(shallow)}`);
            else out.push(`${k}: ${safeToString(v)}`);
        }
    };

    // pick common keys
    for (const k of commonKeys) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) pushKV(k, obj[k]);
    }

    // nested
    for (const k of nestedKeys) {
        if (Object.prototype.hasOwnProperty.call(obj, k) && obj[k] && typeof obj[k] === 'object') {
            const nested = obj[k];
            for (const ck of commonKeys) {
                if (Object.prototype.hasOwnProperty.call(nested, ck)) pushKV(`${k}.${ck}`, nested[ck]);
            }
        }
    }

    // if still empty, try to include all shallow string fields
    if (!out.length) {
        // Avoid Object.entries for maximum TS target compatibility
        // eslint-disable-next-line guard-for-in
        for (const k in obj) {
            if (!Object.prototype.hasOwnProperty.call(obj, k)) continue;
            const v = (obj as any)[k];
            if (typeof v === 'string' && v.trim()) out.push(`${k}: ${v.trim()}`);
        }
    }

    return dedupeStrings(out);
}

function shallowPick(obj: any, keys: string[]): Record<string, any> {
    const out: Record<string, any> = {};
    for (const k of keys) {
        if (Object.prototype.hasOwnProperty.call(obj, k)) out[k] = obj[k];
    }
    return out;
}

function safeToString(x: any): string {
    try {
        return typeof x === 'string' ? x : JSON.stringify(x);
    } catch {
        try {
            return String(x);
        } catch {
            return '';
        }
    }
}


function dedupeStrings(list: string[]): string[] {
    const seen: { [k: string]: 1 } = Object.create(null);
    const out: string[] = [];
    for (let i = 0; i < list.length; i += 1) {
        const s = list[i];
        if (!s) continue;
        if (seen[s]) continue;
        seen[s] = 1;
        out.push(s);
    }
    return out;
}

function sanitizeText(s: string): string {
    let text = String(s);

    // Normalize common full-width punctuation and dashes
    text = text
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/[：]/g, ':')
        .replace(/[（]/g, '(')
        .replace(/[）]/g, ')')
        .replace(/[［]/g, '[')
        .replace(/[］]/g, ']')
        .replace(/[〜～]/g, '〜')
        .replace(/[–—−]/g, '-')
        .replace(/\t/g, ' ')
        .replace(/[ ]{2,}/g, ' ');

    // Decode a few common HTML entities (without external libs)
    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    // Trim lines but preserve empty lines (needed for block splitting)
    text = text
        .split('\n')
        .map((line) => line.trim())
        .join('\n');

    return text;
}

function stripHtml(html: string): string {
    return String(html)
        .replace(/<\s*br\s*\/?>/gi, '\n')
        .replace(/<\s*\/p\s*>/gi, '\n')
        .replace(/<\s*\/div\s*>/gi, '\n')
        .replace(/<\s*\/li\s*>/gi, '\n')
        .replace(/<[^>]*>/g, ' ');
}

function tryParseStructuredText(text: string): any | null {
    const t = String(text).trim();
    if (!t) return null;

    // Entire text JSON
    const whole = tryParseJson(t);
    if (whole != null) return whole;

    // Fenced code blocks ```json ...```
    const fenced = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
        const inner = tryParseJson(fenced[1]);
        if (inner != null) return inner;
    }

    // First {...} substring
    const brace = extractFirstJsonObject(t);
    if (brace) {
        const inner = tryParseJson(brace);
        if (inner != null) return inner;
    }

    return null;
}

function tryParseJson(s: string): any | null {
    try {
        const t = String(s).trim();
        if (!t) return null;
        if (!(t.charAt(0) === '{' || t.charAt(0) === '[')) return null;
        return JSON.parse(t);
    } catch {
        return null;
    }
}

function extractFirstJsonObject(text: string): string {
    const s = String(text);
    const start = s.indexOf('{');
    if (start < 0) return '';
    let depth = 0;
    for (let i = start; i < s.length; i += 1) {
        const ch = s[i];
        if (ch === '{') depth += 1;
        if (ch === '}') {
            depth -= 1;
            if (depth === 0) return s.slice(start, i + 1);
        }
    }
    return '';
}

function structuredToText(obj: any): string {
    if (obj == null) return '';
    if (typeof obj === 'string') return obj;
    if (Array.isArray(obj)) return obj.map((x) => structuredToText(x)).filter(Boolean).join('\n');
    if (typeof obj !== 'object') return String(obj);

    const lines: string[] = [];
    const push = (k: string, v: any) => {
        if (v == null) return;
        if (typeof v === 'string' && v.trim()) lines.push(`${k}: ${v.trim()}`);
        else if (typeof v === 'number' || typeof v === 'boolean') lines.push(`${k}: ${String(v)}`);
        else if (Array.isArray(v) && v.length) {
            lines.push(`${k}: ${v.map((x) => (typeof x === 'string' ? x : safeToString(x))).join(' / ')}`);
        }
    };

    push('title', (obj as any).title || (obj as any).name || (obj as any).event || (obj as any).eventName || (obj as any).summary);
    push('eventEn', (obj as any).eventEn);
    push('eventJp', (obj as any).eventJp);
    push('date', (obj as any).date || (obj as any).when || (obj as any).time || (obj as any).startDate);
    push('venue', (obj as any).venue || (obj as any).place || (obj as any).where || (obj as any).location);
    push('hashtags', (obj as any).hashtags || (obj as any).tags);
    push('url', (obj as any).url || (obj as any).link);

    if ((obj as any).eventInfo && typeof (obj as any).eventInfo === 'object') {
        const ei = (obj as any).eventInfo;
        push('eventInfo.eventEn', ei.eventEn);
        push('eventInfo.eventJp', ei.eventJp);
        push('eventInfo.date', ei.date);
        push('eventInfo.venue', ei.venue);
        push('eventInfo.hashtags', ei.hashtags);
        push('eventInfo.category', ei.category);
    }

    if (!lines.length) {
        try {
            return JSON.stringify(obj, null, 2);
        } catch {
            return '';
        }
    }

    return lines.join('\n');
}

// --- Main Parser Function ---

export function parseUniversal(text: string): UniversalParseResult;
export function parseUniversal(input: unknown, options?: ParseUniversalOptions): UniversalParseResult;
export function parseUniversal(input: unknown, options: ParseUniversalOptions = {}): UniversalParseResult {
    const normalized = normalizeAnyInputToText(input, options);

    const raw = normalized.text;
    if (!raw) {
        return {
            entries: [],
            confidence: 0,
            strategyUsed: `Heuristic-Universal-v3 (empty input, type=${normalized.type})`,
            warnings: normalized.warnings,
        };
    }

    const rawLines = raw.split(/\r?\n/);
    const signatures = rawLines.map((l, i) => getLineSignature(l, i));

    const blocks = splitBlocksUniversal(signatures);

    const entries: ParsedEntry[] = blocks.map((block) => {
        const entry: ParsedEntry =
            ({
                boothName: '',
                boothAccount: '',
                personName: '',
                personAccount: '',
                role: 'モデル',
                confidence: 70,
                rawText: block.map((s) => s.text).join('\n'),
                eventInfo: {
                    eventEn: '',
                    eventJp: '',
                    date: '',
                    venue: '',
                    hashtags: '',
                    category: 'ブース',
                },
            } as any);

        // Process each line in block
        block.forEach((lineSig) => {
            const rawLine = lineSig.text.trim();
            if (!rawLine) return;

            // IMPORTANT (v3): marker lines may contain payload after the marker
            const line = stripMarkerPrefix(rawLine);
            if (!line) return;

            const guess = guessField(line);
            const val = guess.value;

            switch (guess.type) {
                case 'date':
                    (entry as any).eventInfo.date = val;
                    break;
                case 'venue':
                    (entry as any).eventInfo.venue = val;
                    break;
                case 'event':
                    (entry as any).eventInfo.eventEn = val;
                    break;
                case 'eventJp':
                    (entry as any).eventInfo.eventJp = val;
                    break;
                case 'hashtag':
                    (entry as any).eventInfo.hashtags = val;
                    break;
                case 'account': {
                    const match = val.match(/@([a-zA-Z0-9_]+)/);
                    if (match && !entry.personAccount) {
                        entry.personAccount = match[1];
                    }
                    break;
                }
                case 'unknown':
                    // Fill in empty fields in order of priority
                    if (!(entry as any).eventInfo.eventEn && !(entry as any).eventInfo.eventJp) {
                        if (/[ぁ-んァ-ヶ一-龥]/.test(val)) {
                            (entry as any).eventInfo.eventJp = val;
                        } else {
                            (entry as any).eventInfo.eventEn = val;
                        }
                    } else if (!entry.boothName) {
                        entry.boothName = val;
                    } else if (!entry.personName && /[ぁ-んァ-ヶ一-龥]/.test(val) && val.length <= 24) {
                        // light heuristic: a short Japanese line often is a name
                        entry.personName = val;
                    }
                    break;
            }

            // Extract any hashtags from the line
            if (line.indexOf('#') !== -1) {
                const tags = line.match(/#[a-zA-Z0-9_\u3040-\u30ff\u4e00-\u9faf]+/g);
                if (tags) {
                    const existing = (entry as any).eventInfo.hashtags;
                    (entry as any).eventInfo.hashtags = (existing ? `${existing} ` : '') + tags.join(' ');
                }
            }
        });

        // Cleanup
        (entry as any).eventInfo.hashtags = String((entry as any).eventInfo.hashtags || '').trim();

        return entry;
    });

    // Confidence heuristic: degrade if everything is empty
    const anyUseful = entries.some((e: any) =>
        Boolean(e?.boothName || e?.personName || e?.eventInfo?.eventEn || e?.eventInfo?.eventJp || e?.eventInfo?.date || e?.eventInfo?.venue)
    );

    return {
        entries,
        confidence: anyUseful ? 80 : 55,
        strategyUsed: `Heuristic-Universal-v3 (type=${normalized.type})`,
        warnings: normalized.warnings,
    };
}

/**
 * Async-like wrapper (browser drop/upload friendly).
 *
 * This makes "File/Blob" inputs truly supported by reading them with .text() before parsing.
 * It returns either a ParsedResult (sync path) or a thenable (Promise-like) when .text() is used.
 *
 * - If you need a guaranteed Promise, wrap the return value with `Promise.resolve(...)` in your caller.
 */
export function parseUniversalAsync(input: unknown, options?: ParseUniversalOptions): any {
    const x: any = input as any;

    // Best-effort File/Blob support (sync code cannot read file contents)
    if (x && typeof x === 'object' && typeof x.text === 'function') {
        try {
            return x.text().then(
                (content: any) => parseUniversal(String(content), options),
                () => parseUniversal(input, options)
            );
        } catch {
            // fall through
        }
    }

    return parseUniversal(input, options);
}
