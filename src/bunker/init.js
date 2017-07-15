const fs = require('fs');
const path = require('path');

const utils = require('./utils');
const {projRoot} = utils;

exports.run = run;

function run(program) {
  fillPackageScript();
  linkEntry();
}

function fillPackageScript() {
  var src = path.resolve(projRoot, 'package.json');
  var pj = require(src);

  pj.scripts.bunker = './node_modules/.bin/react-native-bunker bundle'

  fs.writeFileSync(src, JSON.stringify(pj, null, 2));
}

function linkEntry() {
  var entry = `require("${path.resolve(__dirname, '../entry.js')}")`;
  var app = require(path.resolve(projRoot, 'app.json'));
  
  var entryFile = utils.camelcase(`${app.name}`);

  fs.writeFileSync(path.resolve(projRoot, `node_modules/${entryFile}Entry.js`), entry);
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