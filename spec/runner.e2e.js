// E2e test runner for HTML test pages
// Serves test pages via HTTP (with optional CSP headers) and runs them in Puppeteer.
//
// Usage: node spec/runner.e2e.js [knockout-file] [--trusted-types] [--strict]
//   Default test page: spec/e2e-tests.html
//   Default knockout-file: build/output/knockout-latest.js
//
// Examples:
//   node spec/runner.e2e.js --strict
//   node spec/runner.e2e.js --trusted-types
//   node spec/runner.e2e.js build/output/knockout-latest.debug.js --strict

const http = require('http');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

const PORT = 0; // auto-assign
const ROOT = path.resolve(__dirname, '..');

// Parse arguments
var args = process.argv.slice(2);
var ttIndex = args.indexOf('--trusted-types');
var csp = null;
if (ttIndex >= 0) {
    csp = "trusted-types knockout knockout-test; require-trusted-types-for 'script'";
    args.splice(ttIndex, 1);
}
var strictIndex = args.indexOf('--strict');
var strict = false;
if (strictIndex >= 0) {
    strict = true;
    args.splice(strictIndex, 1);
}
var koFile = args[0] || 'build/output/knockout-latest.js';
var testPage = 'spec/e2e-tests.html';

function serve(req, res) {
    if (req.url === '/favicon.ico') {
        res.writeHead(204);
        res.end();
        return;
    }
    // Map knockout.js to the build being tested
    var filePath = (req.url === '/knockout.js')
        ? path.join(ROOT, koFile)
        : path.join(ROOT, req.url === '/' ? testPage : req.url);
    var ext = path.extname(filePath);
    var contentType = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' }[ext] || 'application/octet-stream';

    fs.readFile(filePath, function(err, data) {
        if (err) {
            res.writeHead(404);
            res.end('Not found: ' + req.url);
        } else {
            var headers = { 'Content-Type': contentType };
            if (csp && ext === '.html') {
                headers['Content-Security-Policy'] = csp;
            }
            // Prepend "use strict" to knockout.js to simulate ES module strict mode
            if (strict && req.url === '/knockout.js') {
                data = '"use strict";\n' + data;
            }
            res.writeHead(200, headers);
            res.end(data);
        }
    });
}

var MAX_RETRIES = 3;
var ATTEMPT_TIMEOUT = 15000;

// Run the test page in a fresh browser. Rejects on timeout or launch failure.
function runAttempt(port) {
    return new Promise(function(resolve, reject) {
        var browser, timer, settled = false;

        function closeBrowser() {
            var b = browser;
            browser = null;
            return b ? b.close().catch(function(){}) : Promise.resolve();
        }

        function settle(fn) {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            fn();
        }

        timer = setTimeout(function() {
            settle(function() {
                closeBrowser().then(function() { reject(new Error('Attempt timed out')); });
            });
        }, ATTEMPT_TIMEOUT);

        (async function() {
            browser = await puppeteer.launch({ headless: true });
            var page = await browser.newPage();

            var errors = [];
            page.on('pageerror', function(err) { errors.push(err.message); });
            page.on('console', function(msg) {
                if (msg.type() === 'error') errors.push('[console] ' + msg.text());
            });

            await page.goto('http://localhost:' + port + '/', { waitUntil: 'load', timeout: 10000 });
            await page.waitForFunction(function() { return window.__testResults; }, { timeout: 8000 });
            var results = await page.evaluate(function() { return window.__testResults || []; });

            await closeBrowser();
            settle(function() { resolve({ results: results, errors: errors }); });
        })().catch(function(err) {
            closeBrowser();
            settle(function() { reject(err); });
        });
    });
}

(async function() {
    var flags = [csp ? "CSP" : "", strict ? "strict" : ""].filter(Boolean).join(", ");
    console.log("Running " + testPage + " (" + koFile + ")" + (flags ? " [" + flags + "]" : ""));

    var server = http.createServer(serve);
    await new Promise(function(resolve) { server.listen(PORT, resolve); });
    var port = server.address().port;

    var outcome;
    for (var attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            outcome = await runAttempt(port);
            break;
        } catch (err) {
            if (attempt < MAX_RETRIES) {
                console.log('  Attempt ' + attempt + ' failed (' + err.message + '), retrying...');
            } else {
                console.error('  All ' + MAX_RETRIES + ' attempts failed (' + err.message + ')');
                server.close();
                process.exit(1);
            }
        }
    }

    var passed = 0, failed = 0;
    outcome.results.forEach(function(r) {
        if (r.pass) {
            console.log('  ✓ ' + r.name);
            passed++;
        } else {
            console.log('  ✗ ' + r.name + ': ' + r.error);
            failed++;
        }
    });

    if (outcome.errors.length > 0) {
        console.log('\nPage errors:');
        outcome.errors.forEach(function(e) { console.log('  ' + e); });
        failed++;
    }

    console.log('\n' + passed + ' passed, ' + failed + ' failed');
    server.close();
    process.exit(failed > 0 ? 1 : 0);
})();
