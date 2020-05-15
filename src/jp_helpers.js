"use strict";

function jp_helpers_is_loaded() {
    return true;
}

class JupyterContext {
    constructor(url_with_token, browser, verbose) {
        this.verbose = verbose;
        this.url_with_token = url_with_token;
        this.browser = browser;
    };
    async classic_notebook_context(path) {
        var context = new ClassicNotebookContext(this, path);
        await context.get_page();
        return context;
    };
};

function sleep(time) {
    return new Promise(function(resolve) { 
        setTimeout(resolve, time)
    });
};

class ClassicNotebookContext {
    constructor(jupyter_context, path, verbose) {
        this.jupyter_context = jupyter_context;
        this.path = path;
        this.verbose = verbose || jupyter_context.verbose;
        this.page = null;
    };

    async get_page() {
        if (this.page) {
            return this.page;
        }
        var path = this.path;
        var page_url = this.jupyter_context.url_with_token.replace("?", path + "?");
        const page = await this.jupyter_context.browser.newPage();
        // https://stackoverflow.com/questions/47539043/how-to-get-all-console-messages-with-puppeteer-including-errors-csp-violations
        page
            .on('console', message =>
                console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
            .on('pageerror', ({ message }) => console.log(message))
            .on('response', response =>
                console.log(`${response.status()} ${response.url()}`))
            .on('requestfailed', request =>
                console.log(`${request.failure().errorText} ${request.url()}`))
        if (this.verbose) {
            console.log("  sending page to " + page_url);
        }
        await page.goto(page_url, {waitUntil: 'networkidle2'});
        await page.waitForFunction(async () => !!(document.title));
        this.page = page;
        return page;
    };

    async wait_until_there(selector, substring, sleeptime) {
        // keep looking until the test timeout.
        // This implementation uses polling: fancier methods sometimes failed (??)
        sleeptime = sleeptime || 1000
        var found = false;
        while (!found) {
            console.log("looking in " + selector + " for " + substring);
            found = await this.match_exists(selector, substring);
            if (!found) {
                await sleep(sleeptime)
            }
        }
        return true;
    };

    async wait_until_gone(selector, substring, sleeptime) {
        // keep looking until the test timeout.
        // This implementation uses polling: fancier methods sometimes failed (??)
        sleeptime = sleeptime || 1000
        var found = true;
        while (found) {
            console.log("looking in " + selector + " for absense of " + substring);
            found = await this.match_exists(selector, substring);
            if (found) {
                await sleep(sleeptime)
            }
        };
        return false;
    };

    async match_exists(selector, text_substring) {
        var page = await this.get_page();
        var verbose = this.verbose;
        var match_exists = await page.evaluate((selector) => !!document.querySelector(selector), selector);
        if (!match_exists) {
            if (verbose) {
                console.log("no match for selector " + selector);
            }
            return false;  // no selector match, no text match
        } else if (!text_substring) {
            return true;   // no substring, and the selector was found,
        }
        // extracting text into puppeteer context.  Fancier matching in the browser sometimes didn't work (??)
        var texts = await page.$$eval(
            selector,
            (elements) => elements.map((el) => el.textContent),
        );
        var text_found = false;
        if (verbose) {
            console.log("   looking for " + text_substring + " in " + texts.length);
        }
        for (var i=0; i<texts.length; i++) {
            if (texts[i].includes(text_substring)) {
                text_found = true;
                if (verbose) {
                    console.log("   found " + text_substring + " at index " + i);
                }
            }
        }
        // debugging...
        if (verbose &&  !text_found) {
            console.log("   NOT FOUND");
            console.log(texts[0]);
        }
        return text_found;
    };
}

exports.default = jp_helpers_is_loaded;
exports.JupyterContext = JupyterContext;
exports.sleep = sleep;
