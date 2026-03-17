// Jasmine reporter that collects results into window.__testResults
// for use with the e2e test runner (spec/runner.e2e.js)
(function() {
    var results = [];

    class ResultsReporter {
        constructor() { }
        reportSpecResults(spec) {
            var r = spec.results();
            var entry = { name: spec.getFullName(), pass: r.passed() };
            if (!r.passed()) {
                var items = r.getItems();
                var msgs = [];
                for (var i = 0; i < items.length; i++) {
                    if (!items[i].passed()) msgs.push(items[i].message);
                }
                entry.error = msgs.join('; ');
            }
            results.push(entry);
        }
        reportRunnerResults() {
            window.__testResults = results;
        }
    }

    jasmine.getEnv().addReporter(new ResultsReporter());
})();
