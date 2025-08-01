/**
 * InputValidator のテスト
 */

// テスト実行前に InputValidator を読み込み
document.addEventListener('DOMContentLoaded', () => {
  const script = document.createElement('script');
  script.src = '../src/shared/security/InputValidator.js';
  script.onload = () => {
    runInputValidatorTests();
  };
  document.head.appendChild(script);
});

function runInputValidatorTests() {
  describe('InputValidator', () => {
    let validator;
    
    beforeEach(() => {
      validator = new InputValidator();
    });
    
    describe('基本的な文字列検証', () => {
      it('有効な文字列を検証できる', () => {
        const result = validator.validateString('Hello World', { maxLength: 20 });
        expect(result.isValid).toBeTruthy();
        expect(result.sanitized).toBe('Hello World');
      });
      
      it('長すぎる文字列を検出できる', () => {
        const result = validator.validateString('A'.repeat(1001), { maxLength: 1000 });
        expect(result.isValid).toBeFalsy();
        expect(result.error).toContain('too long');
      });
      
      it('空文字列を適切に処理', () => {
        const result = validator.validateString('', { required: true });
        expect(result.isValid).toBeFalsy();
        expect(result.error).toContain('required');
      });
      
      it('null/undefined を適切に処理', () => {
        const result1 = validator.validateString(null, { required: true });
        const result2 = validator.validateString(undefined, { required: true });
        
        expect(result1.isValid).toBeFalsy();
        expect(result2.isValid).toBeFalsy();
      });
      
      it('デフォルト値を適用', () => {
        const result = validator.validateString('', { required: false, defaultValue: 'default' });
        expect(result.isValid).toBeTruthy();
        expect(result.sanitized).toBe('default');
      });
    });
    
    describe('XSS 対策', () => {
      it('スクリプトタグを除去', () => {
        const maliciousInput = '<script>alert("xss")</script>Hello';
        const result = validator.sanitizeHtml(maliciousInput);
        expect(result).toBe('Hello');
      });
      
      it('危険な属性を除去', () => {
        const maliciousInput = '<div onclick="alert(1)">Hello</div>';
        const result = validator.sanitizeHtml(maliciousInput);
        expect(result).toBe('<div>Hello</div>');
      });
      
      it('危険なプロトコルを除去', () => {
        const maliciousInput = '<a href="javascript:alert(1)">Link</a>';
        const result = validator.sanitizeHtml(maliciousInput);
        expect(result).toBe('<a>Link</a>');
      });
      
      it('iframe を除去', () => {
        const maliciousInput = '<iframe src="evil.com"></iframe>Hello';
        const result = validator.sanitizeHtml(maliciousInput);
        expect(result).toBe('Hello');
      });
      
      it('style タグを除去', () => {
        const maliciousInput = '<style>body{display:none}</style>Hello';
        const result = validator.sanitizeHtml(maliciousInput);
        expect(result).toBe('Hello');
      });
    });
    
    describe('YouTube URL 検証', () => {
      it('有効な YouTube URL を検証', () => {
        const validUrls = [
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          'https://youtube.com/watch?v=dQw4w9WgXcQ',
          'https://youtu.be/dQw4w9WgXcQ',
          'https://www.youtube.com/live/dQw4w9WgXcQ',
          'https://m.youtube.com/watch?v=dQw4w9WgXcQ'
        ];
        
        validUrls.forEach(url => {
          const result = validator.validateYouTubeUrl(url);
          expect(result.isValid).toBeTruthy();
          expect(result.videoId).toBe('dQw4w9WgXcQ');
        });
      });
      
      it('無効な YouTube URL を検出', () => {
        const invalidUrls = [
          'https://evil.com/watch?v=dQw4w9WgXcQ',
          'javascript:alert(1)',
          'https://youtube.com/watch?v=invalid',
          'https://www.youtube.com/watch?v=',
          'not-a-url'
        ];
        
        invalidUrls.forEach(url => {
          const result = validator.validateYouTubeUrl(url);
          expect(result.isValid).toBeFalsy();
        });
      });
      
      it('Video ID のフォーマットを検証', () => {
        const invalidVideoIds = [
          'too-short',
          'too-long-video-id',
          'invalid@chars',
          'spaces here',
          '../../etc/passwd'
        ];
        
        invalidVideoIds.forEach(videoId => {
          const url = `https://youtube.com/watch?v=${videoId}`;
          const result = validator.validateYouTubeUrl(url);
          expect(result.isValid).toBeFalsy();
        });
      });
      
      it('ライブ URL を正しく処理', () => {
        const liveUrl = 'https://www.youtube.com/live/dQw4w9WgXcQ';
        const result = validator.validateYouTubeUrl(liveUrl);
        expect(result.isValid).toBeTruthy();
        expect(result.videoId).toBe('dQw4w9WgXcQ');
      });
    });
    
    describe('質問文の検証', () => {
      it('有効な質問文を検証', () => {
        const validQuestions = [
          'これは有効な質問です',
          'Hello, how are you?',
          '今日の天気はどうですか？',
          'What is your favorite color?'
        ];
        
        validQuestions.forEach(question => {
          const result = validator.validateQuestion(question);
          expect(result.isValid).toBeTruthy();
          expect(result.sanitized).toBe(question);
        });
      });
      
      it('空の質問文を検出', () => {
        const emptyQuestions = ['', '   ', '\n\n\n'];
        
        emptyQuestions.forEach(question => {
          const result = validator.validateQuestion(question);
          expect(result.isValid).toBeFalsy();
          expect(result.error).toContain('empty');
        });
      });
      
      it('長すぎる質問文を検出', () => {
        const longQuestion = 'A'.repeat(10001);
        const result = validator.validateQuestion(longQuestion);
        expect(result.isValid).toBeFalsy();
        expect(result.error).toContain('too long');
      });
      
      it('危険な文字を除去', () => {
        const maliciousQuestion = '<script>alert("xss")</script>これは質問です';
        const result = validator.validateQuestion(maliciousQuestion);
        expect(result.isValid).toBeTruthy();
        expect(result.sanitized).toBe('これは質問です');
      });
      
      it('改行文字を正規化', () => {
        const questionWithNewlines = '質問の\r\n内容です\n\nお答えください';
        const result = validator.validateQuestion(questionWithNewlines);
        expect(result.isValid).toBeTruthy();
        expect(result.sanitized).toBe('質問の 内容です お答えください');
      });
    });
    
    describe('API キー検証', () => {
      it('有効な API キーフォーマットを検証', () => {
        const validApiKeys = [
          'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI',
          'AIzaSyABCDEFGHIJKLMNOPQRSTUVWXYZ1234567',
          'AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q'
        ];
        
        validApiKeys.forEach(apiKey => {
          const result = validator.validateApiKey(apiKey);
          expect(result.isValid).toBeTruthy();
          expect(result.sanitized).toBe(apiKey);
        });
      });
      
      it('無効な API キーを検出', () => {
        const invalidApiKeys = [
          'invalid-key',
          'AIzaSy-too-short',
          'AIzaSyTooLongApiKeyThatExceedsTheExpectedLength1234567890',
          'wrongprefix_DdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI',
          ''
        ];
        
        invalidApiKeys.forEach(apiKey => {
          const result = validator.validateApiKey(apiKey);
          expect(result.isValid).toBeFalsy();
        });
      });
      
      it('API キーのプレフィックスを検証', () => {
        const result = validator.validateApiKey('invalidPrefix_DdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI');
        expect(result.isValid).toBeFalsy();
        expect(result.error).toContain('prefix');
      });
    });
    
    describe('設定値の検証', () => {
      it('数値設定を検証', () => {
        const result = validator.validateNumericSetting('timeout', 5000, { min: 1000, max: 10000 });
        expect(result.isValid).toBeTruthy();
        expect(result.value).toBe(5000);
      });
      
      it('範囲外の数値を検出', () => {
        const result = validator.validateNumericSetting('timeout', 15000, { min: 1000, max: 10000 });
        expect(result.isValid).toBeFalsy();
        expect(result.error).toContain('range');
      });
      
      it('真偽値設定を検証', () => {
        const validValues = [true, false, 'true', 'false', 1, 0];
        
        validValues.forEach(value => {
          const result = validator.validateBooleanSetting('enabled', value);
          expect(result.isValid).toBeTruthy();
          expect(typeof result.value).toBe('boolean');
        });
      });
      
      it('無効な真偽値を検出', () => {
        const invalidValues = ['maybe', 'yes', 'no', 2, -1, null, undefined, {}];
        
        invalidValues.forEach(value => {
          const result = validator.validateBooleanSetting('enabled', value);
          expect(result.isValid).toBeFalsy();
        });
      });
    });
    
    describe('バッチ検証', () => {
      it('複数の値を一括検証', () => {
        const inputs = {
          question: 'これは有効な質問です',
          apiKey: 'AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI',
          timeout: 5000,
          enabled: true
        };
        
        const result = validator.validateBatch(inputs);
        expect(result.isValid).toBeTruthy();
        expect(result.results.question.isValid).toBeTruthy();
        expect(result.results.apiKey.isValid).toBeTruthy();
        expect(result.results.timeout.isValid).toBeTruthy();
        expect(result.results.enabled.isValid).toBeTruthy();
      });
      
      it('一部が無効な場合の処理', () => {
        const inputs = {
          question: '',
          apiKey: 'invalid-key',
          timeout: 5000,
          enabled: true
        };
        
        const result = validator.validateBatch(inputs);
        expect(result.isValid).toBeFalsy();
        expect(result.results.question.isValid).toBeFalsy();
        expect(result.results.apiKey.isValid).toBeFalsy();
        expect(result.results.timeout.isValid).toBeTruthy();
        expect(result.results.enabled.isValid).toBeTruthy();
      });
    });
    
    describe('パフォーマンス', () => {
      it('大量の文字列を効率的に検証', () => {
        const strings = Array.from({ length: 1000 }, (_, i) => `String ${i}`);
        
        const startTime = Date.now();
        
        const results = strings.map(str => validator.validateString(str));
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(results).toHaveLength(1000);
        expect(results.every(result => result.isValid)).toBeTruthy();
        expect(duration).toBeLessThan(1000); // 1秒以内
      });
      
      it('複雑な HTML を効率的にサニタイズ', () => {
        const complexHtml = `
          <div class="content">
            <h1>Title</h1>
            <p>Paragraph with <a href="http://example.com">link</a></p>
            <script>alert('xss')</script>
            <style>body { display: none; }</style>
            <iframe src="evil.com"></iframe>
          </div>
        `;
        
        const startTime = Date.now();
        
        const result = validator.sanitizeHtml(complexHtml);
        
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        expect(result).not.toContain('<script>');
        expect(result).not.toContain('<style>');
        expect(result).not.toContain('<iframe>');
        expect(duration).toBeLessThan(100); // 100ms以内
      });
    });
    
    describe('エラーハンドリング', () => {
      it('予期しない入力を安全に処理', () => {
        const weirdInputs = [
          { value: Symbol('test') },
          { value: function() {} },
          { value: new Date() },
          { value: /regex/ },
          { value: new Error('test') }
        ];
        
        weirdInputs.forEach(({ value }) => {
          const result = validator.validateString(value);
          expect(result.isValid).toBeFalsy();
          expect(result.error).toContain('Invalid input type');
        });
      });
      
      it('循環参照を持つオブジェクトを処理', () => {
        const circularObj = {};
        circularObj.self = circularObj;
        
        const result = validator.validateString(circularObj);
        expect(result.isValid).toBeFalsy();
        expect(result.error).toContain('Invalid input type');
      });
    });
    
    describe('設定とカスタマイズ', () => {
      it('設定を更新できる', () => {
        const newConfig = {
          maxStringLength: 5000,
          maxQuestionLength: 500,
          strictMode: true
        };
        
        validator.updateConfig(newConfig);
        
        expect(validator.config.maxStringLength).toBe(5000);
        expect(validator.config.maxQuestionLength).toBe(500);
        expect(validator.config.strictMode).toBe(true);
      });
      
      it('カスタムバリデーターを追加できる', () => {
        validator.addCustomValidator('email', (value) => {
          const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          return emailRegex.test(value);
        });
        
        const result = validator.validateCustom('email', 'test@example.com');
        expect(result.isValid).toBeTruthy();
      });
    });
  });
}