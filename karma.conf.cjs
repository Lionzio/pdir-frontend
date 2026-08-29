// puppeteer >=20 retorna Promise de executablePath(); usamos o caminho do cache diretamente.
const puppeteer = require('puppeteer');
const chromePath = typeof puppeteer.executablePath === 'function'
  ? (function() { try { const r = puppeteer.executablePath(); return typeof r === 'string' ? r : null; } catch { return null; } })()
  : null;
if (chromePath) {
  process.env.CHROME_BIN = chromePath;
} else if (!process.env.CHROME_BIN) {
  // Fallback: puppeteer cache path padrão para win64
  const os = require('os');
  const path = require('path');
  const fallback = path.join(os.homedir(), '.cache', 'puppeteer', 'chrome', 'win64-150.0.7871.24', 'chrome-win64', 'chrome.exe');
  if (require('fs').existsSync(fallback)) process.env.CHROME_BIN = fallback;
}

module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['jasmine', '@angular-devkit/build-angular'],
    plugins: [
      require('karma-jasmine'),
      require('karma-chrome-launcher'),
      require('karma-jasmine-html-reporter'),
      require('karma-coverage'),
      require('@angular-devkit/build-angular/plugins/karma')
    ],
    client: {
      clearContext: false // leave Jasmine Spec Runner output visible in browser
    },
    coverageReporter: {
      dir: require('path').join(__dirname, './coverage/pdir-frontend'),
      subdir: '.',
      reporters: [
        { type: 'html' },
        { type: 'text-summary' }
      ]
    },
    reporters: ['progress', 'kjhtml'],
    port: 9876,
    colors: true,
    logLevel: config.LOG_INFO,
    autoWatch: true,
    customLaunchers: {
      ChromeHeadlessNoSandbox: {
        base: 'ChromeHeadless',
        flags: ['--no-sandbox', '--disable-gpu']
      }
    },
    browsers: ['ChromeHeadlessNoSandbox'],
    singleRun: true,
    restartOnFileChange: true
  });
};
