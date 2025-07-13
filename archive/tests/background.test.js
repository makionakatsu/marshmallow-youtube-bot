// tests/background.test.js

// background.service_worker.js からテスト対象の関数をインポート（または直接定義）
// Service Workerのコンテキスト外でテストするため、関数を直接コピーしてテストします。

/**
 * テキストをYouTube Live Chat用にサニタイズする (XSS防止)
 * Service WorkerでDOM APIが使えないため、手動でエスケープする
 * @param {string} text
 * @returns {string}
 */
function sanitizeTextForYouTube(text) {
  return text.replace(/&/g, '&amp;')
             .replace(/</g, '&lt;')
             .replace(/>/g, '&gt;')
             .replace(/"/g, '&quot;')
             .replace(/'/g, '&#039;');
}

/**
 * 質問テキストをYouTube Live Chat用に整形する
 * @param {string} text
 * @returns {string}
 */
function formatQuestionText(text) {
  let formattedText = text.replace(/\n/g, ' '); // 改行を半角スペースへ変換
  return `Q: ${formattedText}`;
}

// テスト関数
function runTest(name, testFunction) {
  try {
    testFunction();
    console.log(`✅ ${name}`);
  } catch (error) {
    console.error(`❌ ${name}`);
    console.error(error);
    process.exit(1); // テスト失敗時に終了
  }
}

// sanitizeTextForYouTube のテスト
runTest('sanitizeTextForYouTube: 基本的なエスケープ', () => {
  const input = '<script>alert("hello & world")</script>';
  const expected = '&lt;script&gt;alert(&quot;hello &amp; world&quot;)&lt;/script&gt;';
  const actual = sanitizeTextForYouTube(input);
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}, Got: ${actual}`);
  }
});

runTest('sanitizeTextForYouTube: エスケープ不要な文字', () => {
  const input = 'Hello, world!';
  const expected = 'Hello, world!';
  const actual = sanitizeTextForYouTube(input);
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}, Got: ${actual}`);
  }
});

runTest('sanitizeTextForYouTube: 空文字列', () => {
  const input = '';
  const expected = '';
  const actual = sanitizeTextForYouTube(input);
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}, Got: ${actual}`);
  }
});

// formatQuestionText のテスト
runTest('formatQuestionText: 200字以内', () => {
  const input = 'これは短い質問です。';
  const expected = 'Q: これは短い質問です。';
  const actual = formatQuestionText(input);
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}, Got: ${actual}`);
  }
});

runTest('formatQuestionText: 200字超で切り捨て（変更後）', () => {
  const longText = 'a'.repeat(250); // 250文字の'a'
  const expected = 'Q: ' + longText; // 切り捨てなし
  const actual = formatQuestionText(longText);
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}, Got: ${actual}`);
  }
});

runTest('formatQuestionText: 改行の変換', () => {
  const input = '質問1\n質問2\n質問3';
  const expected = 'Q: 質問1 質問2 質問3';
  const actual = formatQuestionText(input);
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}, Got: ${actual}`);
  }
});

runTest('formatQuestionText: 空文字列', () => {
  const input = '';
  const expected = 'Q: ';
  const actual = formatQuestionText(input);
  if (actual !== expected) {
    throw new Error(`Expected: ${expected}, Got: ${actual}`);
  }
});

console.log('\nAll tests passed!');
