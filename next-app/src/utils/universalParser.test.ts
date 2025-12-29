/**
 * Universal Parser Test Suite
 * 
 * Tests various input formats to ensure the parser correctly identifies blocks
 * and extracts fields.
 */

import { parseUniversal, UniversalParseResult } from './universalParser';

// --- Test Cases ---

const testCircledNumbers = `
㉑

イベント名：TECH SHIFT 2026
日本語名：テック・シフト 2026
日付：2026.04.03-04
会場：渋谷ストリームホール
ハッシュタグ：#TechShift #技術転換

㉒

イベント名：FUTURE MAKERS CAMP
日本語名：フューチャー・メーカーズ・キャンプ
日付：2026.04.10-11
会場：東京ビッグサイト
ハッシュタグ：#FutureMakers #創造

㉓

イベント名：INNOVATION DAY
日本語名：イノベーション・デイ
日付：2026.04.17
会場：幕張メッセ
ハッシュタグ：#InnovationDay #未来

㉔

イベント名：DIGITAL SUMMIT 2026
日本語名：デジタル・サミット 2026
日付：2026.04.24-25
会場：パシフィコ横浜
ハッシュタグ：#DigitalSummit #テック

㉕

イベント名：STARTUP EXPO
日本語名：スタートアップ・エキスポ
日付：2026.05.01-02
会場：さいたまスーパーアリーナ
ハッシュタグ：#StartupExpo #起業

㉖

イベント名：MAKER FAIRE TOKYO
日本語名：メイカーフェア東京
日付：2026.05.08-09
会場：東京ビッグサイト
ハッシュタグ：#MakerFaire #ものづくり

㉗

イベント名：AI CONFERENCE 2026
日本語名：AIカンファレンス 2026
日付：2026.05.15
会場：東京国際フォーラム
ハッシュタグ：#AIConference #人工知能

㉘

イベント名：ROBOTICS SHOW
日本語名：ロボティクス・ショー
日付：2026.05.22-23
会場：名古屋国際展示場
ハッシュタグ：#RoboticsShow #ロボット

㉙

イベント名：CLEAN TECH EXPO
日本語名：クリーンテック・エキスポ
日付：2026.05.29-30
会場：大阪ATCホール
ハッシュタグ：#CleanTech #環境

㉚

イベント名：SPACE INNOVATION SUMMIT
日本語名：宇宙イノベーション・サミット
日付：2026.06.05-06
会場：JAXA相模原キャンパス
ハッシュタグ：#SpaceInnovation #宇宙
`;

const testNumberedList = `
1. TECH SHIFT 2026
日付：2026.04.03-04
会場：渋谷ストリームホール

2. FUTURE MAKERS CAMP
日付：2026.04.10-11
会場：東京ビッグサイト

3. INNOVATION DAY
日付：2026.04.17
会場：幕張メッセ
`;

const testDoubleNewlines = `
TECH SHIFT 2026
日付：2026.04.03-04
会場：渋谷ストリームホール


FUTURE MAKERS CAMP
日付：2026.04.10-11
会場：東京ビッグサイト


INNOVATION DAY
日付：2026.04.17
会場：幕張メッセ
`;

const testMixedMarkers = `
㉑

イベント名：EVENT ONE
・詳細1
・詳細2
日付：2026.04.03

㉒

イベント名：EVENT TWO
・詳細A
・詳細B
日付：2026.04.10
`;

// Test 5: Content BEFORE first marker should be captured
const testPreMarkerContent = `
日本語名：没入型テクノロジー・デイ
日付：2026.07.18
会場：チームラボプラネッツ周辺施設
ハッシュタグ：#ImmersiveTech #没入体験

㉙

イベント名：YOUTH INNOVATION FORUM
日本語名：ユース・イノベーション・フォーラム
日付：2026.03.01
会場：早稲田大学 国際会議場
ハッシュタグ：#YouthInnovation #学生主導
`;

// --- Test Runner ---

function runTests() {
    console.log('=== Universal Parser Test Suite ===\n');

    // Test 1: Circled Numbers (10 entries)
    console.log('Test 1: Circled Numbers (expecting 10 entries)');
    const result1 = parseUniversal(testCircledNumbers);
    console.log(`  Result: ${result1.entries.length} entries`);
    console.log(`  Pass: ${result1.entries.length === 10 ? '✓' : '✗'}`);
    if (result1.entries.length > 0) {
        console.log(`  First entry event: ${result1.entries[0].eventInfo?.eventEn || 'N/A'}`);
        console.log(`  Last entry event: ${result1.entries[result1.entries.length - 1].eventInfo?.eventEn || 'N/A'}`);
    }
    console.log();

    // Test 2: Numbered List (3 entries)
    console.log('Test 2: Numbered List (expecting 3 entries)');
    const result2 = parseUniversal(testNumberedList);
    console.log(`  Result: ${result2.entries.length} entries`);
    console.log(`  Pass: ${result2.entries.length === 3 ? '✓' : '✗'}`);
    console.log();

    // Test 3: Double Newlines (3 entries)
    console.log('Test 3: Double Newlines (expecting 3 entries)');
    const result3 = parseUniversal(testDoubleNewlines);
    console.log(`  Result: ${result3.entries.length} entries`);
    console.log(`  Pass: ${result3.entries.length === 3 ? '✓' : '✗'}`);
    console.log();

    // Test 4: Mixed Markers - Circled should take priority (2 entries)
    console.log('Test 4: Mixed Markers (expecting 2 entries, circles prioritized over bullets)');
    const result4 = parseUniversal(testMixedMarkers);
    console.log(`  Result: ${result4.entries.length} entries`);
    console.log(`  Pass: ${result4.entries.length === 2 ? '✓' : '✗'}`);
    console.log();

    // Test 5: Pre-marker content (2 entries)
    console.log('Test 5: Pre-marker content (expecting 2 entries)');
    const result5 = parseUniversal(testPreMarkerContent);
    console.log(`  Result: ${result5.entries.length} entries`);
    console.log(`  Pass: ${result5.entries.length === 2 ? '✓' : '✗'}`);
    if (result5.entries.length > 0) {
        console.log(`  First entry JP event: ${result5.entries[0].eventInfo?.eventJp || 'N/A'}`);
    }
    console.log();

    // Summary
    const allPassed = result1.entries.length === 10 &&
        result2.entries.length === 3 &&
        result3.entries.length === 3 &&
        result4.entries.length === 2 &&
        result5.entries.length === 2;

    console.log('=== Summary ===');
    console.log(`All tests passed: ${allPassed ? '✓ YES' : '✗ NO'}`);

    return allPassed;
}

// Export for potential use
export { runTests };

// Run if executed directly
if (typeof process !== 'undefined' && process.argv[1]?.includes('universalParser.test')) {
    runTests();
}
