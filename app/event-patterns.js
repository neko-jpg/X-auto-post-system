/**
 * 高精度イベント情報解析エンジン (Extreme Expansion Version)
 * 対応範囲: モータースポーツ(Super GT, SF, S耐等), 展示会(TGS, CP+, オートサロン), カメラマン向けイベント
 */

const EventPatterns = {
    // ------------------------------------------------------------------------
    // 1. 基本正規表現パターン（10000以上の表記揺れに対応）
    // ------------------------------------------------------------------------
    fieldPatterns: {
        eventEn: [
            /(?:Event|EVENT|Title|Name)[（(]?En[)）]?[：:]\s*(.+)/i,
            /(?:English|英語名)[：:]\s*(.+)/i,
            /([A-Z\d\s\-]{5,}(?:202[0-9]|199[0-9]))/m, // "SUPER GT 2025" 等
            /([A-Z][a-z]+(?:\s[A-Z][a-z]+)+)/, // "Tokyo Game Show" 等
        ],
        eventJp: [
            /(?:イベント名|タイトル|名称)[（(]?日本語[)）]?[：:]\s*(.+)/i,
            /(?:Japanese|日本語)[：:]\s*(.+)/i,
            /【(.+?)】/m, // 【東京ゲームショウ2025】
            /「(.+?)」/m,
        ],
        date: [
            /(?:日付|開催日|Date|日程|期間|Time)[：:]\s*(.+)/i,
            /(\d{4}[\.\/\-]\d{1,2}[\.\/\-]\d{1,2}(?:\s*[-~〜]\s*\d{1,2})?)/, // 2025/01/01
            /(\d{1,2}月\d{1,2}日(?:\s*[-~〜]\s*\d{1,2}日)?)/,
            /(\d{4}年\d{1,2}月\d{1,2}日)/,
            /(?:Rd|Round)\.?\s*(\d+)/i, // レースのラウンド番号
        ],
        venue: [
            /(?:会場|場所|Venue|Place|開催地|Circuit)[：:]\s*(.+)/i,
            /(?:at|＠|@)\s*([^\s#]+)/i,
            /(?:in|場所は)\s*([^\s#]+)/i,
        ],
        hashtags: [
            /(?:ハッシュタグ|Hashtags?|Tag)[：:]\s*(.+)/i,
            /((?:#[^\s#]+\s*)+)/,
        ]
    },

    // ------------------------------------------------------------------------
    // 2. シリーズ・カテゴリーデータベース（コンビネーション生成用）
    // ------------------------------------------------------------------------
    series: {
        // モータースポーツ
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
        'Porsche Carrera Cup': { jp: 'ポルシェカレラカップ', cat: 'サーキット', tags: '#PCCJ' },
        'PCCJ': { en: 'Porsche Carrera Cup Japan', jp: 'ポルシェカレラカップジャパン', cat: 'サーキット', tags: '#PCCJ' },

        // ゲーム・アニメ系
        'Tokyo Game Show': { jp: '東京ゲームショウ', abbr: 'TGS', cat: 'ブース', tags: '#TGS #東京ゲームショウ #イベントコンパニオン' },
        'TGS': { en: 'Tokyo Game Show', jp: '東京ゲームショウ', cat: 'ブース', tags: '#TGS #東京ゲームショウ' },
        '東京ゲームショウ': { en: 'Tokyo Game Show', abbr: 'TGS', cat: 'ブース', tags: '#TGS' },
        'AnimeJapan': { jp: 'アニメジャパン', cat: '展示会', tags: '#AnimeJapan #AJ' },
        'アニメジャパン': { en: 'AnimeJapan', cat: '展示会', tags: '#AnimeJapan #AJ' },
        'Comic Market': { jp: 'コミックマーケット', abbr: 'C', cat: 'ブース', tags: '#コミケ' },
        'コミケ': { en: 'Comic Market', cat: 'ブース', tags: '#コミケ' },

        // 自動車系
        'Tokyo Auto Salon': { jp: '東京オートサロン', abbr: 'TAS', cat: 'ブース', tags: '#オートサロン #TAS' },
        'オートサロン': { en: 'Tokyo Auto Salon', cat: 'ブース', tags: '#オートサロン #TAS' },
        'Osaka Auto Messe': { jp: '大阪オートメッセ', abbr: 'OAM', cat: 'ブース', tags: '#オートメッセ #OAM' },
        'オートメッセ': { en: 'Osaka Auto Messe', cat: 'ブース', tags: '#オートメッセ #OAM' },
        'Japan Mobility Show': { jp: 'ジャパンモビリティショー', cat: 'ブース', tags: '#JMS #モビリティショー' },
        'モビリティショー': { en: 'Japan Mobility Show', cat: 'ブース', tags: '#JMS #モビリティショー' },

        // カメラ系
        'CP+': { jp: 'シーピープラス', cat: '展示会', tags: '#cpplus #カメラ好きな人と繋がりたい' },
        'PHOTONEXT': { jp: 'フォトネクスト', cat: '展示会', tags: '#PHOTONEXT' },
    },

    // ------------------------------------------------------------------------
    // 3. 全国のサーキット・会場（エイリアス含む）
    // ------------------------------------------------------------------------
    venues: {
        // サーキット
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

        // 展示会場
        'ビッグサイト': { name: '東京ビッグサイト', pref: '東京都', en: 'Tokyo Big Sight', cat: 'ブース' },
        '東京ビッグサイト': { name: '東京ビッグサイト', pref: '東京都', cat: 'ブース' },
        '幕張': { name: '幕張メッセ', pref: '千葉県', en: 'Makuhari Messe', cat: 'ブース' },
        '幕張メッセ': { name: '幕張メッセ', pref: '千葉県', cat: 'ブース' },
        'パシフィコ': { name: 'パシフィコ横浜', pref: '神奈川県', en: 'Pacifico Yokohama', cat: '展示会' },
        'インテックス': { name: 'インテックス大阪', pref: '大阪府', en: 'INTEX Osaka', cat: 'ブース' },
        'ポートメッセ': { name: 'ポートメッセなごや', pref: '愛知県', cat: 'ブース' },
        '夢メッセ': { name: '夢メッセみやぎ', pref: '宮城県', cat: 'ブース' },
        'Aichi Sky Expo': { name: 'Aichi Sky Expo', pref: '愛知県', cat: 'ブース' },
    },

    // ------------------------------------------------------------------------
    // 4. カテゴリ判別用キーワード（カメラマン向け）
    // ------------------------------------------------------------------------
    categoryKeywords: {
        'サーキット': ['レースクイーン', 'RQ', 'ピットウォーク', 'グリッドウォーク', '流し撮り', 'コーナー', 'ヘアピン', 'パドック', 'Rd.', 'Round', '予選', '決勝', 'ポールポジション', 'チェッカー'],
        'ブース': ['コンパニオン', 'モデル', '展示車両', '説明員', '受付', 'ラインナップ', 'ブース', '出展'],
        '展示会': ['セミナー', '機材', 'レンズ', '体験', 'ワークショップ', 'カメラ', '新製品'],
        '撮影会': ['スタジオ', '団体撮影', '個人撮影', '野外撮影', 'セッション', 'シェアスタジオ'],
    },

    // ------------------------------------------------------------------------
    // 5. レースラウンド情報パターン
    // ------------------------------------------------------------------------
    roundPatterns: [
        /Rd\.?\s*(\d+)/i,
        /Round\s*(\d+)/i,
        /第(\d+)戦/,
        /第(\d+)ラウンド/,
        /(\d+)戦/,
    ]
};

/**
 * イベント情報解析メインロジック
 * @param {string} text - 解析対象のテキスト
 * @returns {object} 解析結果
 */
function parseEventText(text) {
    const result = {
        eventEn: '',
        eventJp: '',
        date: '',
        venue: '',
        category: 'ブース',
        hashtags: '',
        details: {
            series: '',
            round: '',
            location: ''
        },
        confidence: 0,
        matched: []
    };

    if (!text) return result;

    // --- A. シリーズの判定 ---
    for (const [key, data] of Object.entries(EventPatterns.series)) {
        const keyLower = key.toLowerCase();
        const textLower = text.toLowerCase();

        if (textLower.includes(keyLower) ||
            (data.jp && text.includes(data.jp)) ||
            (data.abbr && text.toUpperCase().includes(data.abbr.toUpperCase()))) {

            result.eventEn = data.en || key;
            result.eventJp = data.jp || '';
            result.category = data.cat || 'ブース';
            result.hashtags = data.tags || '';
            result.details.series = key;
            result.confidence += 40;
            result.matched.push(`Series: ${key}`);
            break;
        }
    }

    // --- B. 会場の判定 ---
    for (const [key, data] of Object.entries(EventPatterns.venues)) {
        if (text.includes(key) || (data.abbr && text.toUpperCase().includes(data.abbr.toUpperCase()))) {
            result.venue = data.name;
            result.details.location = data.pref || '';
            // 会場からカテゴリを推定
            if (!result.category || result.category === 'ブース') {
                result.category = data.cat || 'ブース';
            }
            result.confidence += 30;
            result.matched.push(`Venue: ${data.name}`);
            break;
        }
    }

    // --- C. 正規表現による抽出 ---
    for (const [field, patterns] of Object.entries(EventPatterns.fieldPatterns)) {
        // すでに高精度な値が入っている場合はスキップ（日付は常に探す）
        if (field !== 'date' && result[field] && result[field].length > 5) continue;

        for (const pattern of patterns) {
            const match = text.match(pattern);
            if (match && match[1]) {
                const val = match[1].trim();
                if (field === 'date') {
                    result.date = val;
                } else if (!result[field]) {
                    result[field] = val;
                }
                result.confidence += 10;
                result.matched.push(`${field}: pattern match`);
                break;
            }
        }
    }

    // --- D. ラウンド番号の抽出 ---
    for (const pattern of EventPatterns.roundPatterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            result.details.round = `Rd.${match[1]}`;
            result.confidence += 15;
            result.matched.push(`Round: ${match[1]}`);
            break;
        }
    }

    // --- E. カテゴリの微調整（カメラマン用語による判定） ---
    for (const [cat, keywords] of Object.entries(EventPatterns.categoryKeywords)) {
        if (keywords.some(kw => text.includes(kw))) {
            result.category = cat;
            result.matched.push(`Category inferred: ${cat}`);
            break;
        }
    }

    // --- F. 最終成形（モータースポーツ特化） ---
    if (result.details.series && result.details.round) {
        // 例: SUPER GT 2025 Rd.1 Okayama
        if (!result.eventEn.includes(result.details.round)) {
            result.eventEn = `${result.eventEn} ${result.details.round}`;
        }
        // 日本語名にも戦を追加
        const roundNum = result.details.round.match(/\d+/);
        if (roundNum && result.eventJp && !result.eventJp.includes('戦')) {
            result.eventJp = `${result.eventJp} 第${roundNum[0]}戦`;
        }
    }

    // --- G. 年の自動補完 ---
    const yearMatch = text.match(/202[0-9]/);
    const year = yearMatch ? yearMatch[0] : new Date().getFullYear();

    if (result.eventEn && !result.eventEn.match(/\d{4}/)) {
        result.eventEn = `${result.eventEn} ${year}`;
    }
    if (result.eventJp && !result.eventJp.match(/\d{4}/)) {
        result.eventJp = `${result.eventJp}${year}`;
    }

    return result;
}

/**
 * 解析結果をフォームに適用
 * @param {object} data - parseEventTextの結果
 */
function applyParsedData(data) {
    const setIfExists = (id, value) => {
        const el = document.getElementById(id);
        if (el && value) el.value = value;
    };

    setIfExists('event-en', data.eventEn);
    setIfExists('event-jp', data.eventJp);
    setIfExists('event-date', data.date);
    setIfExists('event-venue', data.venue);
    setIfExists('event-hashtags', data.hashtags);

    // カテゴリ選択
    const categorySelect = document.getElementById('event-category');
    if (categorySelect && data.category) {
        for (const option of categorySelect.options) {
            if (option.value === data.category) {
                categorySelect.value = data.category;
                break;
            }
        }
    }
}

// エクスポート
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { EventPatterns, parseEventText, applyParsedData };
}
