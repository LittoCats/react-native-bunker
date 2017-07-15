/**
 *
 */
!function (symbol) {
  if (typeof global[symbol] !== 'undefined') throw new Error('react-native-entry should just imported once by main bundle.');
  global[symbol] = createBunker(require('../build/config'));
}(require('./symbol'));

/*******************************************************************************
                              类型声明
*******************************************************************************/
type loadBundleScript = (declare: string, md5: string)=> Promise<{script: string, md5: string}>;
type BundleLoader = Object<{loadBundleScript: loadBundleScript}>;

/*******************************************************************************

*******************************************************************************/

/**
 *  @bundleLoader 包加载器，管理业务包的脚本，必须实现
 *    loadBundleScript: (declare, md5)=> Promise<{script, md5}>
 *
 *  @modules 预加载的功能模块，包括项目 package.json 中声名的依赖
 *
 *  @bundles 项目需要动态加载的业务包，
 *
 *  {getBundleLoader: ()=> BundleLoader, getModuleDefinations: ()=> Object, getBundleDefinations: (loadBundle: (declare: string)=> any)=> Object}
 */
function createBunker({getBundleLoader, getModuleDefinations, getBundleDefinations}) {
  
  const Modules = buildModuleGenerator(getModuleDefinations());
  const Bundles = buildModuleGenerator(getBundleDefinations(async function (declare) {
    return loadBundle(declare, getBundleLoader().loadBundleScript);
  }));

  class Bunker {

    /**
     *  获取 config 中声明的预加载的功能模块
     *
     *  sync
     */
    get Modules() { return Modules; }
    get module() { 
      return getModule;
    }

    /**
     *  async
     */
    get Bundles() { return Bundles; }
    get bundle() {
      return getBundle;
    }
  }

  return new Bunker();

  async function getBundle(declare) {
    return Bundles[declare] || loadBundle(declare, getBundleLoader().loadBundleScript);
  }
  function getModule(declare) {
    return Modules[declare];
    // || throw new Error(`Module '${declare}' not found, please ensure it had been declared in .bunkerc or project dependencies.`);
  }

  /**
   *  生成只读对象, 通过该对象可以只读访问声明的模块
   *
   *  这里不在考虑嵌套模块的问题，生成配制时，已经处理过了
   *
   *  {[declare]: [... [alias], getter]}
   */
  function buildModuleGenerator(configs) {
    const Module = new Object();
    Object.keys(configs).forEach(function (key) {
      const declare = key;

      const [getter] = configs[key].slice(-1);
      const alias = configs[key].slice(0, -1);

      const descriptor = {configurable: false, get: getter};

      Object.defineProperty(Module, declare, descriptor);

      if (alias.lengh < 1) return;
      // 处理 alias
      const [name] = alias.slice(-1);
      const host = resolve(alias.slice(0, -1), Module);  
      Object.defineProperty(host, name, descriptor);
    });
    return Module;

    /**
     *  
     */
    function resolve(names, previous) {
      var alias, next;
      while(alias = names.shift()) {
        next = previous[alias];
        if (!next) {
          next = {};
          Object.defineProperty(previous, alias, {configurable: false, get: function(){ return next; }})
        }
      }

      return next || previous;
    }
  }
}

/*******************************************************************************
                              加载 Bundle

Bundle 加载完成后，添加到 cache 中，下次加载时，如果 md5 没有发生变化，不需要重新加载
*******************************************************************************/

/**
 *  
 */
async function loadBundle(request, loadBundleScript) {
  const Bundles = loadBundle.__Bundles = loadBundle.__Bundles || {};

  const {bundle, sig} = Bundles[request] || {};

  const {script, md5} = await loadBundleScript(request, sig);

  if (bundle && sig === md5) return bundle.exports;

  // 重新编译 bundle
  const exports = await compileBundleScript(script);
  Bundles[request] = {
    sig: md5,
    bundle: {
      exports
    }
  }

  return exports;
}

/**
 *  这实际上是一个 polyfill, 应与 react-native 中 bundler/Resolver/polyfills/require.js 定义一致
 *  
 *  因为只在 pruduction 运行，因此不需要过多的 debug 代码
 */
async function compileBundleScript(script) {
  var modules = Object.create(null);
  var shadowGlobal = {__proto__: global};

  return new Function('__d', 'require', script).call(shadowGlobal, define, _require);

  function define(factory, moduleId, dependencyMap) {
    if (moduleId in modules) {
      return;
    }
    modules[moduleId] = {
      dependencyMap: dependencyMap,
      exports: undefined,
      factory: factory,
      hasError: false,
      isInitialized: false 
    };
  }

  function _require(moduleId) {
    var module = modules[moduleId];
    return module && module.isInitialized ? module.exports : loadModuleImplementation(moduleId, module);
  }

  function loadModuleImplementation(moduleId, module) {
    module.isInitialized = true;
    var exports = module.exports = {};
    var factory = module.factory,
        dependencyMap = module.dependencyMap;

    var moduleObject = { exports: exports };

    factory(shadowGlobal, _require, moduleObject, exports, dependencyMap);
    
    module.factory = undefined;
    module.dependencyMap = undefined;

    return module.exports = moduleObject.exports;
  }
}