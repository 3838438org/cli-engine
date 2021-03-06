// @flow

import path from 'path'
import tmp from 'tmp'
import fs from 'fs-extra'

import Plugins from '../src/plugins'
import Yarn from '../src/plugins/yarn'

import {buildConfig} from 'cli-engine-config'

export async function tmpDirs (cfg: any = {}) {
  Yarn.extraOpts = ['--prefer-offline']

  let testDir = path.join(path.dirname(__filename))

  let tmpDir = path.resolve(path.join(__dirname, '..', 'tmp'))
  fs.mkdirsSync(tmpDir)

  let dataTemplate = path.join(tmpDir, 'tmp-data-XXXXXX')
  let cacheTemplate = path.join(tmpDir, 'tmp-cache-XXXXXX')

  let dataDir = tmp.dirSync({template: dataTemplate}).name
  let cacheDir = tmp.dirSync({template: cacheTemplate}).name

  fs.mkdirs(path.join(dataDir, 'plugins'))

  let root = path.join(testDir, 'roots', 'test-foo')
  let config = buildConfig(Object.assign({mock: true, root, cacheDir, dataDir}, cfg))
  let plugins = new Plugins(config)
  await plugins.load()

  let clean = function () {
    try {
      fs.removeSync(cacheDir)
      fs.removeSync(dataDir)
    } catch (err) {
      console.warn('Unable to clean up tmp - ignore on appveyor')
    }
  }

  return { clean, plugins, config, cacheDir, dataDir, root }
}
