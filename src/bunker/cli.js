#!/usr/bin/env node

var path = require('path');
var program = require('commander');

program
.version(require('../../package.json').version)

program
.command('init')
  .description('初始化配制文件')
  .option('-f --force', '如果 .bunkerc 存在，覆盖', false)
  .action(action);

program
.command('bundle')
  .description('按配制，将 react project 打包成不同的分包')
  .option('-d --dev', '开发模式，开发模式下，只生成 react-bunker-entry.js 文件，不打包', true)
  .option('-p --platform [items]', '平台，ios android', list, ['ios', 'android'])
  .option('-o --output <value>', '输出目录', './build')
  .action(action);

if (module === require.main) {
  program.parse(process.argv)
}

function action(program) {
  require(`./${program._name}`).run(program)
}


function list(val) {
  return val.split(/\s*,\s*/g);
}