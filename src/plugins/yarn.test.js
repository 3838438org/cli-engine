// @flow

import Yarn from './yarn'
import path from 'path'
import cp from 'child_process'
import EventEmitter from 'events'
import {buildConfig} from 'cli-engine-config'

jest.mock('child_process')

let yarn: Yarn
let cacheDir

let init = (config = {}) => {
  yarn = new Yarn(buildConfig({mock: true, ...config}), '/foo/bar')
  cacheDir = path.join(yarn.config.cacheDir, 'yarn')
  return yarn
}
beforeEach(() => {
  if (!yarn) init()
})

afterEach(() => {
  jest.resetAllMocks()
  // flow$ignore
  yarn = null
})

function mockFork (options: {
  code?: number,
  stderr?: string
} = {}, cb) {
  cp.fork.mockImplementationOnce((modulePath, args, opts) => {
    if (cb) cb(modulePath, args, opts)
    let p = new EventEmitter()
    p.stdout = new EventEmitter()
    p.stdout.setEncoding = jest.fn()
    p.stderr = new EventEmitter()
    p.stderr.setEncoding = jest.fn()
    p.stdin = new EventEmitter()
    p.stdin.setEncoding = jest.fn()
    p.stdin.write = jest.fn()
    process.nextTick(() => {
      if (options.stdout) p.stdout.emit('data', options.stdout)
      if (options.stderr) p.stderr.emit('data', options.stderr)
      p.emit('exit', options.code || 0)
    })
    return p
  })
}

describe('checkForYarnLock', () => {
  test('checks for yarn lockfile', async () => {
    expect.assertions(2)

    mockFork({}, (module, args, options) => {
      expect(args).toEqual([
        '--non-interactive',
        `--mutex=file:${cacheDir}`,
        `--cache-folder=${cacheDir}`
      ])
    })

    mockFork({}, (module, args, options) => {
      expect(args).toEqual([
        'foo',
        '--non-interactive',
        `--mutex=file:${cacheDir}`,
        `--cache-folder=${cacheDir}`
      ])
    })

    await yarn.exec(['foo'])
  })
})

describe('with checkForYarnLock stubbed out', () => {
  const checkForYarnLock = Yarn.prototype.checkForYarnLock
  beforeEach(() => {
    // flow$ignore
    Yarn.prototype.checkForYarnLock = jest.fn()
  })
  afterEach(() => {
    // flow$ignore
    Yarn.prototype.checkForYarnLock = checkForYarnLock
  })
  test('has correct args', async () => {
    expect.assertions(1)

    mockFork({}, (module, args, options) => {
      expect(args).toEqual([
        'foo',
        'bar',
        '--non-interactive',
        `--mutex=file:${cacheDir}`,
        `--cache-folder=${cacheDir}`
      ])
    })

    await yarn.exec(['foo', 'bar'])
  })

  test('has correct modulePath', async () => {
    expect.assertions(1)

    let yarnjs = path.resolve(yarn.bin)
    mockFork({}, (module, args, options) => {
      expect(module).toEqual(yarnjs)
    })

    await yarn.exec()
  })

  test('has path env', async () => {
    expect.assertions(1)

    mockFork({}, (module, args, options) => {
      expect(options.env[yarn.pathKey()].split(path.delimiter)[0]).toEqual(path.dirname(process.execPath))
    })

    await yarn.exec()
  })

  test('has correct options', async () => {
    expect.assertions(1)

    mockFork({}, (module, args, options) => {
      expect(options).toMatchObject({
        cwd: '/foo/bar',
        stdio: [null, null, null, 'ipc']
      })
    })

    await yarn.exec()
  })

  test('does not emit stdout when debug is off', async () => {
    expect.assertions(1)
    mockFork({code: 0, stdout: 'why hello there'})
    await yarn.exec()
    expect(yarn.cli.stdout.output).toEqual('')
  })

  test('emits stdout when debug is on', async () => {
    init({debug: 1})
    expect.assertions(1)
    mockFork({code: 0, stdout: 'why hello there'})
    await yarn.exec()
    expect(yarn.cli.stdout.output).toEqual('why hello there')
  })

  test('emits stderr when debug is on', async () => {
    init({debug: 1})
    expect.assertions(1)
    mockFork({code: 0, stderr: 'why hello there'})
    await yarn.exec()
    expect(yarn.cli.stderr.output).toEqual('why hello there')
  })

  test('raises error', async () => {
    expect.assertions(1)

    mockFork({code: 1, stderr: 'UH OH'})

    await yarn.exec().catch(err => {
      expect(err.message).toContain('UH OH')
    })
  })

  test('adds --network-concurrency=1 when necessary', async () => {
    expect.assertions(3)

    mockFork({code: 1, stderr: 'EAI_AGAIN'}, (module, args, options) => {
      expect(args).not.toContain('--network-concurrency=1')
    })

    mockFork({code: 1, stderr: 'EAI_AGAIN'}, (module, args, options) => {
      expect(args).toContain('--network-concurrency=1')
    })

    await yarn.exec().catch(err => {
      expect(err.message).toContain('EAI_AGAIN')
    })
  })

  describe('with cacheDir', () => {
    let yarnCacheDir = global.yarnCacheDir
    beforeEach(() => {
      global.yarnCacheDir = null
    })
    afterEach(() => {
      global.yarnCacheDir = yarnCacheDir
    })

    test('has correct args', async () => {
      expect.assertions(1)

      mockFork({}, (module, args, options) => {
        expect(args).toEqual([
          'foo',
          'bar',
          '--non-interactive',
          `--mutex=file:${cacheDir}`,
          `--cache-folder=${cacheDir}`
        ])
      })

      await yarn.exec(['foo', 'bar'])
    })
  })

  describe('windows', () => {
    test('finds path case insensitively', () => {
      init({windows: true})
      expect(yarn.pathKey({pATH: ''})).toEqual('pATH')
    })

    test('defaults to Path', () => {
      init({windows: true})
      expect(yarn.pathKey({nothing_useful: ''})).toEqual('Path')
    })
  })
})
