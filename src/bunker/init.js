const fs = require('fs');
const path = require('path');

const {projRoot} = require('./utils');

exports.run = run;

function run(program) {
  fillPackageScript();
  linkEntry();
}

function fillPackageScript() {
  var src = path.resolve(projRoot, 'package.json');
  var pj = require(src);

  pj.scripts.bunker = 'node node_modules/react-bunker/src/bunker/cli.js bundle'

  fs.writeFileSync(src, JSON.stringify(pj, null, 2));
}

function linkEntry() {
  var entry = `require("${path.resolve(__dirname, '../entry.js')}")`;
  fs.writeFileSync(path.resolve(projRoot, 'node_modules/react-bunker-entry.js'), entry);
}

function createBunkerConfigure() {
  try {
    var bunkerc = path.resolve(projRoot, '.bunkerc');
    fs.accessSync(bunkerc, fs.constants.F_OK);
    console.log('.bunkerc already exists. To re-install it, remove it first.')
  }catch(e) {
    var template = fs.readFileSync(path.resolve(__dirname, '../bunker.yaml'));
    fs.writeFileSync(bunkerc, template);
  }
}

createBunkerConfigure()