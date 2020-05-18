
// These end-to-end tests use puppeteer and headless chrome using the default jest-environment configuration.

const fs = require("fs");
const { JupyterContext, sleep, JUPYTER_URL_PATH } = require("../src/jp_helpers");

const verbose = true;
//const JUPYTER_URL_PATH = "./_jupyter_url.txt";

var context = null;

beforeAll(function() {
    // this file is created when the jupyter server starts by jest/run_jupyter.py
    var url = fs.readFileSync(JUPYTER_URL_PATH, 'utf8');
    context = new JupyterContext(url, browser, verbose);
});

describe("headless browser tests", async () => {
    
    it("gets the browser version",  async () => {
        var version = await browser.version();
        console.log("browser version: " + version);
        expect(version).toBeTruthy();
    },
    120000, // timeout in 2 minutes...
    );
    
    it("gets a page object",  async () => {
        const page = await browser.newPage();
        console.log("page: " + page);
        expect(page).toBeTruthy();
    },
    120000, // timeout in 2 minutes...
    );

    //it("runs the debugger",  async () => {
    //    await jestPuppeteer.debug();
    //});

    it("gets a page title from an error page that talks about Jupyter",  async () => {
        const page = await browser.newPage();
        const url = "http://127.0.0.1:3000/html/index.html";
        // wait for the page to initialize...
        await page.goto(url, {waitUntil: 'networkidle2'});
        await page.waitForFunction(async () => !!(document.title));
        var title = await page.title();
        console.log("error page title is: " + title);
        expect(title.includes("Jupyter")).toBeTruthy();
    },
    120000, // timeout in 2 minutes...
    );

    it("finds a subdirectory on the notebooks index page",  async () => {
        var nb_context = await context.classic_notebook_context("");
        var title = await nb_context.page.title();
        console.log("start url page title is: " + title);
        var directory_found = await nb_context.wait_until_there("span.item_name", "notebook_tests");
        expect(directory_found).toBeTruthy();
    },
    120000, // timeout in 2 minutes...
    );

    it("opens and closes an example notebook",  async () => {
        const path = "notebooks/notebook_tests/example.ipynb";
        var nb_context = await context.classic_notebook_context(path);
        var title = await nb_context.page.title();
        console.log("example.ipynb page title is: " + title);
        var sample_text = 'Some example text';
        var example_text_found = await nb_context.wait_until_there(nb_context.selectors.container, sample_text);
        expect(example_text_found).toBeTruthy();
    },
    120000, // timeout in 2 minutes...
    );

    it("runs a widget in an example notebook",  async () => {
        const path = "notebooks/notebook_tests/example.ipynb";
        const test_string = "THIS IS THE SECRET TEST STRING";
        const secret_label = "SECRET BUTTON LABEL";
        const initial_string = "here it is:";
        var nb_context = await context.classic_notebook_context(path);
        console.log("wait for the page to initialize... looking for " + initial_string);
        await nb_context.wait_until_there(nb_context.selectors.container, initial_string);
        console.log("  restart and clear...");
        await nb_context.restart_and_clear();
        console.log("   verify the test text is not found or vanishes");
        await nb_context.wait_until_gone(nb_context.selectors.container, test_string);
        console.log("  restart and run all...");
        await nb_context.restart_and_run_all();
        console.log("   sleep to allow events to clear... (???)")
        await sleep(200);
        console.log("Verify that secret_label appears in widget output");
        await nb_context.wait_until_there(nb_context.selectors.container, secret_label);
        console.log("Verify that test_string appears in widget output")
        await nb_context.wait_until_there(nb_context.selectors.container, test_string);
        console.log("now shutting down notebook and kernel");
        await nb_context.shut_down_notebook();
        // success!
        expect(true).toBeTruthy();
    },
    120000, // timeout in 2 minutes...
    );

    it("saves an example notebook",  async () => {
        const path = "notebooks/notebook_tests/example.ipynb";
        const initial_string = "here it is:";
        var nb_context = await context.classic_notebook_context(path);
        console.log("wait for the page to initialize... looking for " + initial_string);
        await nb_context.wait_until_there(nb_context.selectors.container, initial_string);
        var old_status = await nb_context.set_checkpoint_status("bogus status should be replaced");
        await nb_context.save_and_checkpoint();
        // loop until status changed or timeout
        var new_status = old_status;
        console.log("  save and checkpoint... old='" +old_status + "'");
        while (new_status == old_status) {
            await sleep(1000);
            new_status = await nb_context.get_checkpoint_status();
        }
        console.log("  new status="+new_status);
        expect(new_status).not.toEqual(old_status);
        await nb_context.shut_down_notebook();
        // success!
        expect(true).toBeTruthy();
    },
    120000, // timeout in 2 minutes...
    );

    async function jupyter_live_page(path) {
        // get a page for a notebook using path='notebooks/notebook_tests/example.ipynb'
        var sub_url = jupyter_sub_url(path);
        const page = await browser.newPage();
        // wait for the page to initialize...
        await page.goto(sub_url, {waitUntil: 'networkidle2'});
        await page.waitForFunction(async () => !!(document.title));
        // https://stackoverflow.com/questions/47539043/how-to-get-all-console-messages-with-puppeteer-including-errors-csp-violations
        page
            .on('console', message =>
                console.log(`${message.type().substr(0, 3).toUpperCase()} ${message.text()}`))
            .on('pageerror', ({ message }) => console.log(message))
            .on('response', response =>
                console.log(`${response.status()} ${response.url()}`))
            .on('requestfailed', request =>
                console.log(`${request.failure().errorText} ${request.url()}`))
        return page;
    }

    function jupyter_sub_url(path) {
        // get a path to a notebook using path='notebooks/notebook_tests/example.ipynb'
        var basic_url = jupyter_start_url();
        return basic_url.replace("?", path + "?");
    }

    function jupyter_start_url() {
        // returns a string like http://localhost:3000/?token=0d1715cefedcff36352180eaeaf1a28d0a01728b7531c45d
        return fs.readFileSync('./_jupyter_url.txt', 'utf8')
    };

    function sleep(time) {
        return new Promise(function(resolve) { 
            setTimeout(resolve, time)
        });
    };

    async function check_truthy(js_expression_str) {
        var is_truthy = await page.evaluate("!!(" + js_expression_str + ")");
        if (is_truthy) {
            console.log("truthy: " + js_expression_str);
        } else {
            console.log("FALSY: " + js_expression_str);
        }
    };

});
