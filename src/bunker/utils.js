var fs = require('fs');
var path = require('path');
var YAML = require('js-yaml');
var Module = require('module');

var assert = require('assert');

/**
 *
 */
exports.camelcase = function (str) {
  return str.replace(/((^)|([\s._-]+))[a-z]/g, function (str) {
    return str.replace(/[^a-z.]/g, '').toUpperCase();
  })
}

/**
 *
 */
exports.projRoot = projRoot();
function projRoot() {
  var projRoot = __dirname.replace(/react-bunker[\s\S]*$/, '').replace(/node_modules[\s\S]*$/, '');

  /**
   *  如果 package.json 存在，且 dependencies 中包含 react 模块，说明是 react 项目
   */
  try {
    var pj = require(path.resolve(projRoot, 'package.json'));
    if (!pj || !pj.dependencies || !pj.dependencies.react) throw new Error();
  }catch(e){
    throw new Error('Invalid react project');
  }

  return projRoot;
}

/**
 *
 */
Object.defineProperty(exports, "bunkerc", {get: loadBunkerConfig})
function loadBunkerConfig() {
  try {
    var bunkerc = YAML.safeLoad(fs.readFileSync(path.resolve(exports.projRoot, '.bunkerc')).toString());
  }catch(e){
    console.log('.bunkerc not found. Please use `react-bunker init` to init it.');
    process.exit();
  } 

  /**
   *  check source/bundle-loader
   */

  try {
    fs.accessSync(path.resolve(projRoot(), bunkerc.source), fs.constants.F_OK);
  }catch(e){
    assert(!e, 'source is configured error in .bunkerc.')  
  }
  
  assert(Module._resolveFilename(path.resolve(projRoot(), bunkerc.source, bunkerc['bundle-loader'])), 'bundle-loader is configured error in .bunkerc.')

  return bunkerc;
}