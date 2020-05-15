const { setup: setupDevServer } = require('jest-dev-server')
const { setup: setupPuppeteer } = require('jest-environment-puppeteer')

module.exports = async function globalSetup(globalConfig) {

  // set up a web server to server pages for end to end testing
  await setupDevServer({
    command: 'python -u jest/run_jupyter.py > _jupyter_server_out.txt',
    launchTimeout: 10000,
    port: 3000
  })

  // also do standard puppeteer setup
  await setupPuppeteer(globalConfig);

  console.log("globalSetup.js started jest/run_jupyter.py");
}