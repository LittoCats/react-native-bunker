const {
  Platform,
  AsyncStorage,
  AppRegistry,
  View,
  Alert
} = require('react-native');
const crypto = require('crypto-js');

const PackageLoader = {};

const MAGIC = require('./magic');
const originalRequire = require;

/******************************************************************************/

/**
 *  just use as public api
 */

class Bunker {

  constructor({name}) {
    AppRegistry.registerComponent(name, ()=> View)
  }

  get InternalModules() {
    return Bunker.InternalModules;
  }

  get StaticPackages() {
    return Bunker.StaticPackages;
  }

  get DynamicPackages() {
    return Bunker.DynamicPackages;
  }

  /**
   *  
   */
  async loadPackage(name) {
    if (Bunker.DynamicPackages[name]) return Bunker.DynamicPackages[name];
    return loadPackage(name);
  }

  /**
   *  如果不在使用了, 可以通过这个方法释放缓存
   */
  async unloadPackage(name) {
    Bunker.DynamicPackages[name] = undefined;
  }

  set packageLoader(loader: (name: string)=> Promise) {
    PackageLoader.load = loader;
  }
}

module.exports = exports = Bunker

/******************************************************************************/

function loadPackage(name) {
  var original = '';
  return getCachedPackageScript(name).then(function (script) {
    script = script || '';
    const md5 = original = script.slice(2, 32+2);
    return (PackageLoader.load || defaultPackageLoader())({name, md5, script})
  }).then(function (script) {

    const md5 = script.slice(2, 32+2);

    if (md5 != original) {
      console.log(md5, original);
      return cachePackageScript(name, script);
    }else{
      return script;
    }
  }).then(function (script) {
    return compilePackage(script);
  }).then(function (module) {
    return module;
  })
}

/**
 *  使用局部缓存，当 mainModule 释放后，所有的资源全部释放
 */
function compilePackage(script) {

  const modules = Object.create(null);
  const globalObject = {__proto__: global};

  const main = new Function('__d', 'require', script).call({__proto__: global}, define, require);

  return main;

  function define(
    factory: FactoryFn,
    moduleId: number,
    dependencyMap
  ) {
    if (moduleId in modules) {
      // prevent repeated calls to `global.nativeRequire` to overwrite modules
      // that are already loaded
      return;
    }
    modules[moduleId] = {
      dependencyMap,
      exports: undefined,
      factory,
      hasError: false,
      isInitialized: false,
    };
  }

  function require(moduleId) {
    if (moduleId === MAGIC) return originalRequire(MAGIC);

    const module = modules[moduleId];

    return module && module.isInitialized
      ? module.exports
      : loadModuleImplementation(moduleId, module);
  }

  function loadModuleImplementation(moduleId, module) {

    // We must optimistically mark module as initialized before running the
    // factory to keep any require cycles inside the factory from causing an
    // infinite require loop.
    module.isInitialized = true;
    const exports = module.exports = {};
    const {factory, dependencyMap} = module;
    try {

      const moduleObject = {exports};

      // keep args in sync with with defineModuleCode in
      // packager/src//Resolver/index.js
      // and packager/src//ModuleGraph/worker.js
      factory(globalObject, require, moduleObject, exports, dependencyMap);

      // $FlowFixMe: This is only sound because we never access `factory` again
      module.factory = undefined;
      
      return (module.exports = moduleObject.exports);

    } catch (e) {
      module.hasError = true;
      module.error = e;
      module.isInitialized = false;
      module.exports = undefined;
      throw e;
    }
  }
}
/******************************************************************************/
function getPackageCacheId(name) {
  return crypto.MD5(`Bunker.DynamicPackages.${name}`).toString(crypto.enc.Hex);
}

function getCachedPackageScript(name) {
  const id = getPackageCacheId(name);
  return AsyncStorage.getItem(id);
}

function cachePackageScript(name, script) {
  const id = getPackageCacheId(name);
  return AsyncStorage.setItem(id, script).then(function () {
    return script;
  });
}

/******************************************************************************/

function defaultPackageLoader() {
  if (__DEV__) return defaultPackageLoaderImpl;
  Alert.alert(
    'Bunker Config Error',
    `
defaultPackageLoader just can be used for development.
For production, you should set packageLoader by

  const Bunker = require('react-native-bunker');
  Bunker.packageLoader = function ({name, md5, script}) {
    ...
  };

    `,
    []
    );
  throw new Error();
}

function defaultPackageLoaderImpl({name, md5, script}) {
  const id = crypto.MD5(name).toString(crypto.enc.Hex);

  return new Promise(function (resolve, reject) {

    const xhr = new XMLHttpRequest();
    xhr.onerror = function() {
      reject(new TypeError('Network request failed'))
    }
    xhr.onloadend = function() {
      
      const status = xhr.status;

      console.log(xhr)

      if (status === 200) {
        var body = 'response' in xhr ? xhr.response : xhr.responseText
        resolve(body);
      }else if (status === 304){
        resolve(script);
      }else{
        reject(new Error(`unrecognized status code ${status} from server.`))
      }
    }

    xhr.open('GET', `http://localhost:3000/${id}/${Platform.OS}`, true);
    xhr.setRequestHeader('content-md5', md5);
    // xhr.setRequestHeader('Cache-Control', 'no-cache');
    
    xhr.send();
  });
}