/**
 *  entry.js
 *  
 */

const Bunker = require('react-native-bunker/src/bunker');
const App = require('../app.json');
const {AppRegistry} = require('react-native');

Bunker.InternalModules = {{InternalModules}};

/**
 *  创建 Bunker 对象，加入到全局 module 中
 *  
 */
__d(function (global, require, module, exports) {
  module.exports = exports = new Bunker(App);
}, {{BUNKERID}});

/**
 *  加载静态配制包
 *  必须有一个包对 bunker 进行配制：bunker.packageLoader = PackageLoader
 *
 *  type PackageLoader = (name)=> Promise<string>
 */
Bunker.StaticPackages = {{StaticPackages}};


/**
 *  __DEV__ == true 时，开发模块下，直接加载所有的包
 *
 *  DynamicPackages 实际上是动态包主模块的缓存
 *  在确定已加载的情况下，可能直接通过 DynamicPackage 获取包的主模块
 *  也可以通过这里查看模块是否已加载
 */
Bunker.DynamicPackages = {{DynamicPackages}}


AppRegistry.runApplication = (function (runApplication) {
  return function (appName, params) {
    if (appName === App.name) {
      App.params = params;
    }
    return runApplication.call(AppRegistry, appName, params);
  }
})(AppRegistry.runApplication)

/**
 *  加载 main 包
 */
require('react-native-bunker').loadPackage({{MainPackage}}).then(function () {
  AppRegistry.runApplication(App.name, App.params)
});