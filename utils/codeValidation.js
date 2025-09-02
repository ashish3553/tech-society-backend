// utils/codeValidation.js - Quick validation utility
const crypto = require('crypto');

class CodeValidator {
  constructor() {
    this.MAX_CODE_LENGTH = 50000; // 50KB
    this.FORBIDDEN_PATTERNS = [
      /exec\s*\(/i,
      /eval\s*\(/i,
      /system\s*\(/i,
      /import\s+os/i,
      /subprocess/i,
      /#include\s*<sys\//i
    ];
  }

  validateCode(code) {
    if (!code || typeof code !== 'string') {
      return { valid: false, message: 'Code is required' };
    }

    if (code.length > this.MAX_CODE_LENGTH) {
      return { valid: false, message: 'Code is too long' };
    }

    // Check for dangerous patterns
    for (const pattern of this.FORBIDDEN_PATTERNS) {
      if (pattern.test(code)) {
        return { valid: false, message: 'Code contains forbidden patterns' };
      }
    }

    return { valid: true };
  }

  validateLanguage(language) {
    const supportedLanguages = ['javascript', 'python', 'java', 'cpp', 'c'];
    
    if (!supportedLanguages.includes(language)) {
      return { valid: false, message: `Unsupported language: ${language}` };
    }

    return { valid: true };
  }
}

module.exports = new CodeValidator();