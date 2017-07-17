const fs = require('fs');
const fse = require('fs-extra');
const path = require('path');
const { spawn } = require('child_process');
const crypto = require('crypto');
const Module = require('module');
const assert = require('assert');

require('colors');

const utils = require('./utils');

/******************************************************************************/

var __DEV__, projRoot, outputDir, platforms;

/******************************************************************************/

/**
 * 生成并输出 react-bunker-config
 * 输出文件为 ${projRoot}/node_modules/react-bunker-config 
 */
function buildConfig() {
  console.log('Build config ...'.green);

  const {bunkerc} = utils;

  const source = bunkerc.source;
  const projPackage = require(path.resolve(projRoot, 'package.json'));

  // 处理 modules 定义
  const module_declare = (bunkerc.modules || [])
    .concat(Object.keys(projPackage.dependencies || {}))
    .filter(declare=> !!declare)
    .sort(ModuleDeclareSortor)
    .reduce(ModuleDeclareReducer, [])
    .map((declare)=> buildModuleDeclare(declare, 'require', declare=> resolveModuleEntryFile(declare, projRoot, source)));

  // 处理 bundles 定义
  const bundle_declare = (bunkerc.bundles || [])
    .filter(declare=> !!declare)
    .sort(ModuleDeclareSortor)
    .filter(id=> id.slice(0, 2) !== '<<') // 不需要缓存的模块，不需要写入 config 文件
    .reduce(ModuleDeclareReducer, [])
    .map((declare)=> buildModuleDeclare(declare, __DEV__ ? 'require' : 'loadBundle', (id)=> !__DEV__ ? id : resolveBundleEntryFile(id, projRoot, source)));

  // 处理 BundleLoader
  const bundleLoader_declare = `require("${resolveBundleEntryFile(bunkerc['bundle-loader'], projRoot, source)}")`;

  // 合成 react-bunker-config
  const appBunkerConfig = buildAppBunkerConfig(bundleLoader_declare, module_declare, bundle_declare);

  // 输出
  const output = path.resolve(projRoot, 'node_modules', 'react-native-bunker-config.js');
  fse.ensureFileSync(output);

  fs.writeFileSync(output, appBunkerConfig);

  console.log('\nDone.'.green);
}

function buildAppBunkerConfig(loader, modules, bundles) {
  return `
module.exports = {
  getBundleLoader,
  getModuleDefinations,
  getBundleDefinations
};

const Modules = {
  ${modules.join(',\n  ')}
};
const Bundles = {
  ${bundles.join(',\n  ')}
};

async function loadBundle(declare) {
  return exports[declare] || (exports[declare] = await loadBundle.impl(declare));
}

function getBundleLoader() {
  return ${loader};
}

function getModuleDefinations() {
  return Modules;
}

function getBundleDefinations(loader) {
  loadBundle.impl = loader;
  return Bundles;
}
`
}

function ModuleDeclareSortor(ld, rd) {
  const lid = extractDeclare(ld).id;
  const rid = extractDeclare(rd).id;

  return lid > rid ? 1 : lid === rid ? 0 : -1;
}

/**
 *  去除重复的声明（dependencies 和 bunkerc 都声明了）
 *  
 *  从声明中找到别名路径嵌套的情况，不为其设置 别名
 *
 *  {
 *    a: [a, b],
 *    f: [a, b, e]
 *  }
 *  
 *  f 的别名将被置空
 */
function ModuleDeclareReducer(modules, declare) {
  const {id, alias} = extractDeclare(declare);
  for (var module of modules) {
    if (id === module[0]) return modules;

    var previous = module[1] || [];
    var recursive = previous.reduce(function (recursive, name, index) {
      return recursive && name === alias[index]
    }, true);
    if (recursive) {
      alias.splice(0, alias.length);
    }
  }
  modules.push([id, alias])
  return modules;
}

/**
 *  @declare string | Object
 *
 */
function buildModuleDeclare([id, aliases], loader, resolve) {
  const getter = `function() { return ${loader}("${resolve(id)}"); }`;
  const alias = JSON.stringify(aliases).slice(1, -1);
  return `${JSON.stringify(id)}: [${alias}${alias.length ? ', ' : ''}${getter}]`
}

function extractDeclare(declare) {
  if (typeof declare === 'string') declare = {[declare]: declare.split(/\//g).map(utils.camelcase)};
  const id = Object.keys(declare).shift();
  const alias = Array.isArray(declare[id]) ? declare[id] : [declare[id]];

  return {id, alias};
}

/**
 *  1. 查找 ${projRoot}
 *  2. 查找 ${projRoot}/${source}
 *  3. 查找 ${projRoot}/node_modules/
 *  4. 查找 ${projRoot}/node_modules/${request}/${basename(request)}
 */
function resolveModuleEntryFile(request, projRoot, source) {
  var filename;
  try {
    filename = filename || findPath(projRoot, request);
  }catch(e) {}

  try {
     filename = filename || findPath(projRoot, source, request);
  }catch(e) {}

  try {
    filename = filename || findPath(projRoot, 'node_modules', request);
  }catch(e) {}

  try {
    filename = filename || findPath(projRoot, 'node_modules', request, path.basename(request));
  }catch(e) {}

  if (filename) return filename;
  throw new Error(`Can't find module ${request}`);

  function findPath() {
    var filename = Module._resolveFilename(path.resolve.apply(null, arguments));
    if (filename.slice(0, projRoot.length) === projRoot) return filename;
  }
}

function resolveBundleEntryFile(request, projRoot, source) {
  try {
    var filename = Module._resolveFilename(path.resolve(projRoot, source, request));
    if (filename.slice(0, projRoot.length) === projRoot) return filename;
  }catch(e) {
    throw new Error(`Can't find bundle ${request}`);
  }
}

/*******************************************************************************
                            调用打包功能

只有 bunkerc.bundles 的内容需要打包
*******************************************************************************/

function bundle() {
  const {bunkerc} = utils;
  const srcRoot = path.resolve(projRoot, bunkerc.source);

  // 需要打独立包的 bundle 列表
  const bundleList = (bunkerc.bundles || [])
    .map(extractDeclare)
    .map(dec=> dec.id.replace(/^<</g, ''))
    .sort()
    .reduce((list, next)=> list.concat(next !== list[list.length-1] ? [next] : []) , [])
    .map(dec=> path.resolve(srcRoot, dec));

  // 缓存文件夹
  const cacheDir = path.resolve(__dirname, '../../.bundles');
  fse.ensureDirSync(cacheDir);

  // 顺序打包
  bundleList.reduce(function (promise, declare) {
    return promise.then(()=> bundle(declare));
  }, Promise.resolve())
  .then(()=> console.log('\nBundle done.'.green))
  .catch(e=> console.log(e))
  .then(()=> fse.removeSync(cacheDir));

  function bundle(declare) {
    const entry = Module._resolveFilename(declare);
    return platforms.reduce((promise, platform)=> promise.then(()=> bundle(platform)), Promise.resolve())

    function bundle(platform) {
      const output = path.resolve(cacheDir, crypto.createHash('MD5').update(`${entry}.${platform}`).digest('hex'));
      return bundleImpl(platform, entry, output).then(readFile).then(compileBundleScript).then(writeFile);

      function readFile() {
        return fs.readFileSync(output);
      }

      function writeFile(script) {
        const output = path.resolve(outputDir, JSON.stringify(path.relative(srcRoot, declare)).slice(1, -1))+'.'+platform+'.js'
        fse.ensureDirSync(path.dirname(output));
        fs.writeFileSync(output, script);
      }
    }
  }
}

function bundleImpl(platform, entry, output) {
  return new Promise(function (resolve, reject) {
    console.log(`\nreact-native bundle --dev false --platform ${platform} --entry-file ${entry} --bundle-output ${output}\n`.green);
    const bundle = spawn('react-native', [
      'bundle',
      '--dev', 'false',
      '--platform', platform,
      '--entry-file', entry,
      '--bundle-output', output
    ]);

    bundle.stdout.on('data', data=> process.stdout.write(data));
    bundle.stderr.on('data', data=> {
      process.stdout.write(data);
    });

    bundle.on('close', code=>{
      code === 0 ? resolve() : reject(`Faild.`);
    });
    bundle.on('error', reject);
  });  
}

function compileBundleScript(script) {
  const modules = [];
  const entryid = [];

  new Function('global', '__d', 'require', script).call({}, {}, define, _require);

  assert(modules.length, 'no valid module factory found.'.red);
  assert(entryid.length, 'no entry module found'.red);

  return modules.map(({factory, id})=> `__d(${factory.toString()}, ${id});`).concat([`return require(${entryid.pop()});`]).join('\n');

  function define(factory, id) {
    modules.push({factory, id});
  }

  function _require(id) {
    entryid.push(id);
  }
}

/******************************************************************************/

exports.run = run;

function run(program) {
  __DEV__ = !!program.dev;
  projRoot = path.resolve(program.projRoot || utils.projRoot);
  outputDir = path.resolve(program.output);
  platforms = program.platform;

  console.log('__DEV__   :', __DEV__);
  console.log('projRoot  :', projRoot);
  console.log('outputDir :', outputDir);
  console.log('platforms :', platforms);

  console.log('\n');

  buildConfig(); 

  if (!__DEV__) {
    bundle();
  }
}