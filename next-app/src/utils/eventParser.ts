/**
 * Event Parser - TypeScript version
 * Ported from event-patterns.js with enhancements
 * 
 * Extracts event metadata from text: title, date, venue, hashtags, category, etc.
 */

// --- Type Definitions ---

export interface SeriesData {
    jp?: string;
    en?: string;
    abbr?: string;
    cat: 'サーキット' | 'ブース' | '展示会' | '撮影会';
    tags: string;
}

export interface VenueData {
    name: string;
    pref: string;
    en?: string;
    abbr?: string;
    cat: string;
}

export interface ParsedEventDetails {
    series: string;
    round: string;
    location: string;
}

export interface ParsedEventMeta {
    sourceText: string;
    rawInputType?: string;
    urls?: string[];
    normalizedDateStart?: string;
    normalizedDateEnd?: string;
}

export interface ParsedEvent {
    eventEn: string;
    eventJp: string;
    date: string;
    venue: string;
    category: string;
    hashtags: string;
    details: ParsedEventDetails;
    confidence: number;
    matched: string[];
    meta?: ParsedEventMeta;
}

// --- Pattern Database ---

export const EventPatterns = {
    // Field extraction patterns
    fieldPatterns: {
        eventEn: [
            /(?:Event|EVENT|Title|Name)[（(]?En[)）]?[：:>\-]\s*(.+)/i,
            /(?:English|英語名|英語タイトル|Title\s*\(EN\))[：:>\-]\s*(.+)/i,
            /\b([A-Z\d][A-Z\d\s\-_/]{3,}(?:19\d{2}|20\d{2})?)\b/m,
            /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,})\b/m,
        ],
        eventJp: [
            /(?:イベント名|タイトル|名称)[（(]?日本語[)）]?[：:>\-]\s*(.+)/i,
            /(?:Japanese|日本語|日本語名|和名|Title\s*\(JP\))[：:>\-]\s*(.+)/i,
            /【\s*(.+?)\s*】/m,
            /「\s*(.+?)\s*」/m,
            /『\s*(.+?)\s*』/m,
        ],
        date: [
            /(?:日付|開催日|Date|日程|期間|Time|When|日時|開催期間)[：:>\-]\s*(.+)/i,
            /(\b(19\d{2}|20\d{2})[.\/\-](0?\d|1[0-2])[.\/\-](0?\d|[12]\d|3[01])(?:\s+\d{1,2}:\d{2}(?::\d{2})?)?(?:\s*(?:-|~|〜|–|—|to)\s*(?:\d{1,2}:\d{2}(?::\d{2})?)?)?)/,
            /(\b(19\d{2}|20\d{2})[.\/\-](0?\d|1[0-2])[.\/\-](0?\d|[12]\d|3[01])\s*(?:-|~|〜|–|—|to)\s*(19\d{2}|20\d{2})[.\/\-](0?\d|1[0-2])[.\/\-](0?\d|[12]\d|3[01]))/,
            /(\b(0?\d|1[0-2])月(0?\d|[12]\d|3[01])日(?:\s*(?:-|~|〜|–|—|to)\s*(0?\d|[12]\d|3[01])日)?)/,
            /(\b(19\d{2}|20\d{2})年(0?\d|1[0-2])月(0?\d|[12]\d|3[01])日(?:\s*(?:-|~|〜|–|—|to)\s*(0?\d|[12]\d|3[01])日)?)/,
            /(\b(?:today|tomorrow|yesterday|本日|今日|明日|昨日)\b)/i,
            /(?:Rd|Round)\.?\s*(\d+)/i,
        ],
        venue: [
            /(?:会場|場所|Venue|Place|開催地|Circuit|Where|会場名|開催場所)[：:>\-]\s*(.+)/i,
            /(?:at|＠|@)\s*([^\n#]+?)(?=\s*(?:\n|#|$))/i,
            /(?:in)\s+([^\n#]+?)(?=\s*(?:\n|#|$))/i,
        ],
        hashtags: [
            /(?:ハッシュタグ|Hashtags?|Tags?)[：:>\-]\s*(.+)/i,
            /((?:#[^\s#]+\s*){1,})/,
        ],
        url: [
            /(https?:\/\/[^\s)\]}]+)|\b(www\.[^\s)\]}]+)\b/i,
        ],
    },

    // Series database
    series: {
        // Motorsports
        'SUPER GT': { jp: 'スーパーGT', cat: 'サーキット', tags: '#SUPERGT #SGT #GTカメラ部' },
        'Super Formula': { jp: 'スーパーフォーミュラ', cat: 'サーキット', tags: '#SuperFormula #SF #SFカメラ部' },
        'Super Taikyu': { jp: 'スーパー耐久', cat: 'サーキット', tags: '#S耐 #SuperTaikyu' },
        'スーパー耐久': { en: 'Super Taikyu', cat: 'サーキット', tags: '#S耐 #SuperTaikyu' },
        'S耐': { en: 'Super Taikyu', jp: 'スーパー耐久', cat: 'サーキット', tags: '#S耐 #SuperTaikyu' },
        'D1 Grand Prix': { jp: 'D1グランプリ', cat: 'サーキット', tags: '#D1GP #D1' },
        'D1GP': { en: 'D1 Grand Prix', jp: 'D1グランプリ', cat: 'サーキット', tags: '#D1GP #D1' },
        'MotoGP': { jp: 'モトGP', cat: 'サーキット', tags: '#MotoGP' },
        'F1': { jp: 'F1世界選手権', cat: 'サーキット', tags: '#F1JP #JapaneseGP' },
        '8耐': { en: 'Suzuka 8 Hours', jp: '鈴鹿8時間耐久ロードレース', cat: 'サーキット', tags: '#鈴鹿8耐' },
        '鈴鹿8耐': { en: 'Suzuka 8 Hours', cat: 'サーキット', tags: '#鈴鹿8耐' },
        'TCR Japan': { jp: 'TCRジャパン', cat: 'サーキット', tags: '#TCRJapan' },
        'PCCJ': { en: 'Porsche Carrera Cup Japan', jp: 'ポルシェカレラカップジャパン', cat: 'サーキット', tags: '#PCCJ' },
        'WEC': { jp: '世界耐久選手権', cat: 'サーキット', tags: '#WEC #6HFuji' },

        // Game/Anime Events
        'Tokyo Game Show': { jp: '東京ゲームショウ', abbr: 'TGS', cat: 'ブース', tags: '#TGS #東京ゲームショウ #イベントコンパニオン' },
        'TGS': { en: 'Tokyo Game Show', jp: '東京ゲームショウ', cat: 'ブース', tags: '#TGS #東京ゲームショウ' },
        '東京ゲームショウ': { en: 'Tokyo Game Show', abbr: 'TGS', cat: 'ブース', tags: '#TGS' },
        'AnimeJapan': { jp: 'アニメジャパン', cat: '展示会', tags: '#AnimeJapan #AJ' },
        'アニメジャパン': { en: 'AnimeJapan', cat: '展示会', tags: '#AnimeJapan #AJ' },
        'Comic Market': { jp: 'コミックマーケット', abbr: 'C', cat: 'ブース', tags: '#コミケ' },
        'コミケ': { en: 'Comic Market', cat: 'ブース', tags: '#コミケ' },
        'ワンダーフェスティバル': { en: 'Wonder Festival', abbr: 'WF', cat: 'ブース', tags: '#ワンフェス #WF' },

        // Auto Events
        'Tokyo Auto Salon': { jp: '東京オートサロン', abbr: 'TAS', cat: 'ブース', tags: '#オートサロン #TAS' },
        'オートサロン': { en: 'Tokyo Auto Salon', cat: 'ブース', tags: '#オートサロン #TAS' },
        'Osaka Auto Messe': { jp: '大阪オートメッセ', abbr: 'OAM', cat: 'ブース', tags: '#オートメッセ #OAM' },
        'オートメッセ': { en: 'Osaka Auto Messe', cat: 'ブース', tags: '#オートメッセ #OAM' },
        'Japan Mobility Show': { jp: 'ジャパンモビリティショー', cat: 'ブース', tags: '#JMS #モビリティショー' },
        'モビリティショー': { en: 'Japan Mobility Show', cat: 'ブース', tags: '#JMS #モビリティショー' },
        '東京モーターショー': { en: 'Tokyo Motor Show', cat: 'ブース', tags: '#TMS #東京モーターショー' },

        // Camera/Photo Events
        'CP+': { jp: 'シーピープラス', cat: '展示会', tags: '#cpplus #カメラ好きな人と繋がりたい' },
        'PHOTONEXT': { jp: 'フォトネクスト', cat: '展示会', tags: '#PHOTONEXT' },

        // Tech Events
        'CEATEC': { jp: 'シーテック', cat: '展示会', tags: '#CEATEC' },
        'Inter BEE': { jp: 'インタービー', cat: '展示会', tags: '#InterBEE' },
    } as Record<string, SeriesData>,

    // Venue database
    venues: {
        // Circuits
        '鈴鹿': { name: '鈴鹿サーキット', pref: '三重県', en: 'Suzuka Circuit', cat: 'サーキット' },
        'SUZUKA': { name: '鈴鹿サーキット', pref: '三重県', cat: 'サーキット' },
        '富士': { name: '富士スピードウェイ', pref: '静岡県', en: 'Fuji Speedway', abbr: 'FSW', cat: 'サーキット' },
        'FSW': { name: '富士スピードウェイ', pref: '静岡県', cat: 'サーキット' },
        'もてぎ': { name: 'モビリティリゾートもてぎ', pref: '栃木県', en: 'Mobility Resort Motegi', cat: 'サーキット' },
        'ツインリンク': { name: 'モビリティリゾートもてぎ', pref: '栃木県', cat: 'サーキット' },
        'MOTEGI': { name: 'モビリティリゾートもてぎ', pref: '栃木県', cat: 'サーキット' },
        'SUGO': { name: 'スポーツランドSUGO', pref: '宮城県', en: 'Sportsland SUGO', cat: 'サーキット' },
        '菅生': { name: 'スポーツランドSUGO', pref: '宮城県', cat: 'サーキット' },
        'オートポリス': { name: 'オートポリス', pref: '大分県', en: 'Autopolis', abbr: 'AP', cat: 'サーキット' },
        'AP': { name: 'オートポリス', pref: '大分県', cat: 'サーキット' },
        '岡山国際': { name: '岡山国際サーキット', pref: '岡山県', en: 'Okayama International Circuit', abbr: 'OIC', cat: 'サーキット' },
        'OIC': { name: '岡山国際サーキット', pref: '岡山県', cat: 'サーキット' },
        'OKAYAMA': { name: '岡山国際サーキット', pref: '岡山県', cat: 'サーキット' },
        '筑波': { name: '筑波サーキット', pref: '茨城県', cat: 'サーキット' },
        'TC2000': { name: '筑波サーキット', pref: '茨城県', cat: 'サーキット' },
        'エビス': { name: 'エビスサーキット', pref: '福島県', cat: 'サーキット' },
        '十勝': { name: '十勝スピードウェイ', pref: '北海道', cat: 'サーキット' },
        'セントラル': { name: 'セントラルサーキット', pref: '兵庫県', cat: 'サーキット' },
        '袖ヶ浦': { name: '袖ヶ浦フォレストレースウェイ', pref: '千葉県', cat: 'サーキット' },

        // Expo/Convention Centers
        'ビッグサイト': { name: '東京ビッグサイト', pref: '東京都', en: 'Tokyo Big Sight', cat: 'ブース' },
        '東京ビッグサイト': { name: '東京ビッグサイト', pref: '東京都', cat: 'ブース' },
        '幕張': { name: '幕張メッセ', pref: '千葉県', en: 'Makuhari Messe', cat: 'ブース' },
        '幕張メッセ': { name: '幕張メッセ', pref: '千葉県', cat: 'ブース' },
        'パシフィコ': { name: 'パシフィコ横浜', pref: '神奈川県', en: 'Pacifico Yokohama', cat: '展示会' },
        'インテックス': { name: 'インテックス大阪', pref: '大阪府', en: 'INTEX Osaka', cat: 'ブース' },
        'ポートメッセ': { name: 'ポートメッセなごや', pref: '愛知県', cat: 'ブース' },
        '夢メッセ': { name: '夢メッセみやぎ', pref: '宮城県', cat: 'ブース' },
        'Aichi Sky Expo': { name: 'Aichi Sky Expo', pref: '愛知県', cat: 'ブース' },
        '京都国際マンガミュージアム': { name: '京都国際マンガミュージアム', pref: '京都府', cat: '展示会' },
        'サンシャインシティ': { name: 'サンシャインシティ', pref: '東京都', cat: 'ブース' },
        '池袋サンシャイン': { name: 'サンシャインシティ', pref: '東京都', cat: 'ブース' },
    } as Record<string, VenueData>,

    // Category keywords
    categoryKeywords: {
        'サーキット': [
            'レースクイーン', 'RQ', 'ピットウォーク', 'グリッドウォーク', '流し撮り',
            'コーナー', 'ヘアピン', 'パドック', 'Rd.', 'Round', '予選', '決勝',
            'ポールポジション', 'チェッカー', 'サーキット', 'Circuit', 'Paddock',
            'Qualifying', 'Race', 'GT', 'SF'
        ],
        'ブース': [
            'コンパニオン', 'モデル', '展示車両', '説明員', '受付', 'ラインナップ',
            'ブース', '出展', 'Booth', 'Exhibitor', 'イベントコンパニオン'
        ],
        '展示会': [
            'セミナー', '機材', 'レンズ', '体験', 'ワークショップ', 'カメラ',
            '新製品', 'Expo', 'Exhibition', 'Conference', 'Summit'
        ],
        '撮影会': [
            'スタジオ', '団体撮影', '個人撮影', '野外撮影', 'セッション',
            'シェアスタジオ', '撮影会', 'Photo session', 'ポートレート'
        ],
    } as Record<string, string[]>,

    // Round patterns
    roundPatterns: [
        /Rd\.?\s*(\d+)/i,
        /Round\s*(\d+)/i,
        /第(\d+)戦/,
        /第(\d+)ラウンド/,
        /(\d+)戦/
    ],
};

// --- Utility Functions ---

function sanitizeText(s: string): string {
    let text = String(s);

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

    text = text
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");

    text = text
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');

    return text;
}

function extractUrls(text: string): string[] {
    const urls: string[] = [];
    const re = /(https?:\/\/[^\s)\]}]+)|\b(www\.[^\s)\]}]+)\b/gi;
    let m;
    while ((m = re.exec(text))) {
        const u = m[0];
        if (u) urls.push(u);
    }
    return Array.from(new Set(urls));
}

function normalizeHashtags(s: string): string {
    const tags = String(s)
        .split(/\s+/)
        .map(t => t.trim())
        .filter(Boolean)
        .map(t => (t.startsWith('#') ? t : `#${t}`))
        .map(t => t.replace(/^##+/, '#'))
        .filter(t => t.length > 1);
    return Array.from(new Set(tags)).join(' ');
}

function mergeHashtags(a: string, b: string): string {
    const merged = `${a || ''} ${b || ''}`.trim();
    return merged ? normalizeHashtags(merged) : '';
}

function extractHashtagBlock(text: string): string {
    const re = /((?:#[^\s#]+\s*){1,})/g;
    const blocks: string[] = [];
    let m;
    while ((m = re.exec(text))) {
        if (m[1]) blocks.push(m[1]);
    }
    return blocks.join(' ');
}

function toIsoDate(y: number, m: number, d: number): string {
    if (!y || !m || !d) return '';
    if (m < 1 || m > 12) return '';
    if (d < 1 || d > 31) return '';
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return '';
    const mm = String(m).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
}

function resolveDefaultYear(text: string, defaultYear?: number): number {
    const yearMatch = String(text).match(/\b(19\d{2}|20\d{2})\b/);
    if (yearMatch) return Number(yearMatch[1]);
    if (typeof defaultYear === 'number') return defaultYear;
    return new Date().getFullYear();
}

function normalizeDateRange(raw: string, defaultYear: number): { start: string; end?: string } | null {
    if (!raw) return null;
    const s = String(raw).trim();

    // Range: yyyy/mm/dd - yyyy/mm/dd
    let m = s.match(/\b(19\d{2}|20\d{2})[.\/\-](0?\d|1[0-2])[.\/\-](0?\d|[12]\d|3[01])\s*(?:-|~|〜|–|—|to)\s*(19\d{2}|20\d{2})[.\/\-](0?\d|1[0-2])[.\/\-](0?\d|[12]\d|3[01])\b/);
    if (m) {
        const start = toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
        const end = toIsoDate(Number(m[4]), Number(m[5]), Number(m[6]));
        if (start && end) return { start, end };
    }

    // Single: yyyy/mm/dd
    m = s.match(/\b(19\d{2}|20\d{2})[.\/\-](0?\d|1[0-2])[.\/\-](0?\d|[12]\d|3[01])\b/);
    if (m) {
        const start = toIsoDate(Number(m[1]), Number(m[2]), Number(m[3]));
        if (start) return { start };
    }

    // JP full: yyyy年m月d日 (optional range to d日)
    m = s.match(/\b(19\d{2}|20\d{2})年(0?\d|1[0-2])月(0?\d|[12]\d|3[01])日(?:\s*(?:-|~|〜|–|—|to)\s*(0?\d|[12]\d|3[01])日)?/);
    if (m) {
        const y = Number(m[1]);
        const mo = Number(m[2]);
        const d1 = Number(m[3]);
        const start = toIsoDate(y, mo, d1);
        if (!start) return null;
        if (m[4]) {
            const d2 = Number(m[4]);
            const end = toIsoDate(y, mo, d2);
            return end ? { start, end } : { start };
        }
        return { start };
    }

    // JP short: m月d日 (optional range to d日)
    m = s.match(/\b(0?\d|1[0-2])月(0?\d|[12]\d|3[01])日(?:\s*(?:-|~|〜|–|—|to)\s*(0?\d|[12]\d|3[01])日)?/);
    if (m) {
        const mo = Number(m[1]);
        const d1 = Number(m[2]);
        const start = toIsoDate(defaultYear, mo, d1);
        if (!start) return null;
        if (m[3]) {
            const d2 = Number(m[3]);
            const end = toIsoDate(defaultYear, mo, d2);
            return end ? { start, end } : { start };
        }
        return { start };
    }

    return null;
}

// --- Detection Functions ---

function detectSeries(text: string, result: ParsedEvent): void {
    const tLower = text.toLowerCase();

    for (const [key, data] of Object.entries(EventPatterns.series)) {
        const keyLower = String(key).toLowerCase();
        const hit =
            tLower.includes(keyLower) ||
            (data?.jp && text.includes(data.jp)) ||
            (data?.abbr && text.toUpperCase().includes(String(data.abbr).toUpperCase()));

        if (hit) {
            result.eventEn = data.en || key;
            result.eventJp = data.jp || '';
            result.category = data.cat || result.category || 'ブース';
            result.hashtags = mergeHashtags(result.hashtags, data.tags || '');
            result.details.series = key;
            result.confidence += 40;
            result.matched.push(`Series: ${key}`);
            return;
        }
    }

    // Loose heuristic: find e.g. "SUPER GT" like uppercase phrases
    const m = text.match(/\b([A-Z][A-Z0-9]{1,}(?:\s+[A-Z0-9]{2,}){1,5})\b/);
    if (m && m[1]) {
        const candidate = m[1].trim();
        if (!/^(HTTP|HTTPS|WWW|EVENT|TITLE|NAME|DATE|TIME|VENUE|PLACE)$/i.test(candidate)) {
            result.details.series = candidate;
            if (!result.eventEn) result.eventEn = candidate;
            result.confidence += 10;
            result.matched.push(`Series: guessed (${candidate})`);
        }
    }
}

function detectVenue(text: string, result: ParsedEvent): void {
    for (const [key, data] of Object.entries(EventPatterns.venues)) {
        if (text.includes(key) || (data?.abbr && text.toUpperCase().includes(String(data.abbr).toUpperCase()))) {
            result.venue = data.name;
            result.details.location = data.pref || '';
            if (!result.category || result.category === 'ブース') result.category = data.cat || result.category;
            result.confidence += 30;
            result.matched.push(`Venue: ${data.name}`);
            return;
        }
    }
}

function inferCategory(text: string, result: ParsedEvent): void {
    for (const [cat, keywords] of Object.entries(EventPatterns.categoryKeywords)) {
        if (keywords.some(kw => text.includes(kw))) {
            result.category = cat;
            result.matched.push(`Category inferred: ${cat}`);
            result.confidence += 5;
            return;
        }
    }
}

function guessTitle(text: string): string {
    const lines = String(text)
        .split('\n')
        .map(l => l.trim())
        .filter(Boolean);

    for (const line of lines) {
        if (/^(#\S+\s*)+$/.test(line)) continue;
        if (/https?:\/\//i.test(line) || /^www\./i.test(line)) continue;
        if (/^(date|time|when|venue|place|where|event|title|name)\s*:/i.test(line)) continue;
        if (/^(日付|開催日|日程|期間|会場|場所|イベント名|タイトル)\s*:/i.test(line)) continue;

        const cleaned = line.replace(/^[•\-・▶️\*]+\s*/g, '').trim();

        if (/(19\d{2}|20\d{2})[.\/\-](0?\d|1[0-2])[.\/\-](0?\d|[12]\d|3[01])/.test(cleaned)) continue;
        if (/(0?\d|1[0-2])月(0?\d|[12]\d|3[01])日/.test(cleaned)) continue;

        if (cleaned.length >= 4) return cleaned.slice(0, 120);
    }

    return '';
}

function guessVenue(text: string): string {
    const m = text.match(/(?:会場|場所|Venue|Place|開催地|Circuit|Where)\s*[:\-]\s*([^\n#]+)/i);
    if (m && m[1]) return m[1].trim();

    const m2 = text.match(/(?:at|＠|@)\s*([^\n#]+?)(?=\s*(?:\n|#|$))/i);
    if (m2 && m2[1]) return m2[1].trim();

    const m3 = text.match(/\b(in)\s+([^\n#]+?)(?=\s*(?:\n|#|$))/i);
    if (m3 && m3[2]) return m3[2].trim();

    return '';
}

// --- Main Parser Function ---

export interface ParseEventOptions {
    defaultYear?: number;
}

export function parseEventText(text: string, options: ParseEventOptions = {}): ParsedEvent {
    const result: ParsedEvent = {
        eventEn: '',
        eventJp: '',
        date: '',
        venue: '',
        category: 'ブース',
        hashtags: '',
        details: {
            series: '',
            round: '',
            location: '',
        },
        confidence: 0,
        matched: [],
        meta: {
            sourceText: '',
            urls: [],
        },
    };

    if (!text) return result;

    const clean = sanitizeText(String(text));
    result.meta!.sourceText = clean;
    result.meta!.urls = extractUrls(clean);

    // Series detection
    detectSeries(clean, result);

    // Venue detection
    detectVenue(clean, result);

    // Regex extraction
    for (const [field, regexList] of Object.entries(EventPatterns.fieldPatterns)) {
        if (field !== 'date' && (result as any)[field] && String((result as any)[field]).length > 5) continue;

        for (const re of regexList) {
            const m = clean.match(re);
            if (m && m[1]) {
                const val = String(m[1]).trim();

                if (field === 'hashtags') {
                    const combined = mergeHashtags(result.hashtags, val);
                    if (combined && combined !== result.hashtags) {
                        result.hashtags = combined;
                        result.confidence += 8;
                        result.matched.push('hashtags: pattern match');
                    }
                } else if (field === 'url') {
                    // handled via extractUrls
                } else if (field === 'date') {
                    if (!result.date || val.length > result.date.length) {
                        result.date = val;
                        result.confidence += 10;
                        result.matched.push('date: pattern match');
                    }
                } else if (!(result as any)[field]) {
                    (result as any)[field] = val;
                    result.confidence += 10;
                    result.matched.push(`${field}: pattern match`);
                }
                break;
            }
        }
    }

    // Round number extraction
    for (const re of EventPatterns.roundPatterns) {
        const m = clean.match(re);
        if (m && m[1]) {
            result.details.round = `Rd.${m[1]}`;
            result.confidence += 15;
            result.matched.push(`Round: ${m[1]}`);
            break;
        }
    }

    // Category inference
    inferCategory(clean, result);

    // Year completion
    const defaultYear = resolveDefaultYear(clean, options.defaultYear);
    if (result.eventEn && !/\b\d{4}\b/.test(result.eventEn)) {
        result.eventEn = `${result.eventEn} ${defaultYear}`;
        result.confidence += 3;
        result.matched.push('Year: appended to eventEn');
    }
    if (result.eventJp && !/\b\d{4}\b/.test(result.eventJp)) {
        result.eventJp = `${result.eventJp}${defaultYear}`;
        result.confidence += 3;
        result.matched.push('Year: appended to eventJp');
    }

    // Title fallback
    if (!result.eventEn && !result.eventJp) {
        const guess = guessTitle(clean);
        if (guess) {
            if (/[\u3040-\u30ff\u3400-\u9fff]/.test(guess)) {
                result.eventJp = guess;
            } else {
                result.eventEn = guess;
            }
            result.confidence += 12;
            result.matched.push('Title: guessed from text');
        }
    }

    // Venue fallback
    if (!result.venue) {
        const v = guessVenue(clean);
        if (v) {
            result.venue = v;
            result.confidence += 8;
            result.matched.push('Venue: guessed from text');
        }
    }

    // Hashtags fallback
    if (!result.hashtags) {
        const h = mergeHashtags('', extractHashtagBlock(clean));
        if (h) {
            result.hashtags = h;
            result.confidence += 5;
            result.matched.push('hashtags: extracted from text');
        }
    }

    // Date normalization
    const normalizedDate = normalizeDateRange(result.date, defaultYear);
    if (normalizedDate) {
        result.meta!.normalizedDateStart = normalizedDate.start;
        if (normalizedDate.end) result.meta!.normalizedDateEnd = normalizedDate.end;
        result.matched.push('Date: normalized');
        result.confidence += 5;
    }

    // Clamp confidence
    result.confidence = Math.max(0, Math.min(100, result.confidence));

    return result;
}

/**
 * Generate hashtags based on event info
 */
export function generateHashtags(eventEn: string, eventJp: string, category: string): string {
    const tags: string[] = [];

    // Check series database
    for (const [key, data] of Object.entries(EventPatterns.series)) {
        if (eventEn.includes(key) || eventJp.includes(key) || (data.jp && eventJp.includes(data.jp))) {
            if (data.tags) {
                tags.push(...data.tags.split(' ').filter(t => t.startsWith('#')));
            }
        }
    }

    // Add category-based tags
    if (category === 'サーキット') {
        tags.push('#レースクイーン', '#RQ');
    } else if (category === 'ブース') {
        tags.push('#イベントコンパニオン');
    } else if (category === '撮影会') {
        tags.push('#ポートレート', '#portrait');
    }

    return [...new Set(tags)].join(' ');
}
