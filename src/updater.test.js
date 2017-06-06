// @flow

import {type Config, buildConfig} from 'cli-engine-config'
import Output from 'cli-engine-command/lib/output'
import Updater from './updater'
import nock from 'nock'
import fs from 'fs-extra'
import path from 'path'
import moment from 'moment'

jest.mock('fs-extra')

let assets = nock('https://cli-engine.heroku.com')
let config: Config
let output: Output
let updater: Updater

beforeEach(() => {
  fs.__files()
  config = buildConfig({
    version: '1.2.3-b2ea476',
    s3: {host: 'cli-engine.heroku.com'}
  })
  output = new Output({config, mock: true})
  updater = new Updater(output)
  nock.cleanAll()
})

afterEach(() => {
  assets.done()
  jest.clearAllMocks()
})

describe('warnIfUpdateAvailable', () => {
  describe('without a file', () => {
    it('hits the network to find version', async () => {
      assets.get('/cli-engine/channels/stable/version')
        .reply(200, {channel: 'stable', version: '1.3.0-b2ea476'})
      await updater.warnIfUpdateAvailable()
      expect(output.stderr.output).toEqual(' ▸    cli-engine: update available from 1.2.3-b2ea476 to 1.3.0-b2ea476\n')
    })
  })

  describe('with a file', () => {
    let version = version => {
      fs.__files({
        [config.cacheDir]: {
          'stable.version': {channel: 'stable', version}
        }
      })
    }
    it('shows warning when minor is greater', async () => {
      version('1.3.0-b2ea476')
      await updater.warnIfUpdateAvailable()
      expect(output.stderr.output).toEqual(' ▸    cli-engine: update available from 1.2.3-b2ea476 to 1.3.0-b2ea476\n')
    })

    it('shows warning when major is greater', async () => {
      version('2.0.0-b2ea476')
      await updater.warnIfUpdateAvailable()
      expect(output.stderr.output).toEqual(' ▸    cli-engine: update available from 1.2.3-b2ea476 to 2.0.0-b2ea476\n')
    })

    it('shows nothing when minor is less', async () => {
      version('1.1.0-b2ea476')
      await updater.warnIfUpdateAvailable()
      expect(output.stderr.output).toEqual('')
    })

    it('shows nothing when patch is greater', async () => {
      version('1.2.4-b2ea476')
      await updater.warnIfUpdateAvailable()
      expect(output.stderr.output).toEqual('')
    })
  })
})

describe('fetchVersion', () => {
  it('gets the version from disk', async () => {
    fs.__files({
      [config.cacheDir]: {
        'stable.version': {channel: 'stable', version: '1.2.3-b2ea476'}
      }
    })
    let v = await updater.fetchVersion('stable')
    expect(v.version).toEqual('1.2.3-b2ea476')
  })

  it('gets the version from the API', async () => {
    assets.get('/cli-engine/channels/stable/version')
      .reply(200, {channel: 'stable', version: '1.2.3-b2ea476'})
    let v = await updater.fetchVersion('stable')
    expect(v.version).toEqual('1.2.3-b2ea476')
  })

  it('gets the version from the API when file version is old', async () => {
    fs.__files({
      [config.cacheDir]: {
        'stable.version': {
          mtime: moment().subtract(31, 'days').toDate(),
          content: {channel: 'stable', version: '1.2.3-b2ea476'}
        }
      }
    })
    assets.get('/cli-engine/channels/stable/version')
      .reply(200, {channel: 'stable', version: '2.0.0-b2ea476'})
    let v = await updater.fetchVersion('stable')
    expect(v.version).toEqual('2.0.0-b2ea476')
  })

  it('gets the version from disk if it is somewhat old', async () => {
    fs.__files({
      [config.cacheDir]: {
        'stable.version': {
          mtime: moment().subtract(29, 'days').toDate(),
          content: {channel: 'stable', version: '1.2.3-b2ea476'}
        }
      }
    })
    let v = await updater.fetchVersion('stable')
    expect(v.version).toEqual('1.2.3-b2ea476')
  })

  it('saves the version to disk', async () => {
    assets.get('/cli-engine/channels/stable/version')
      .reply(200, {channel: 'stable', version: '1.2.3-b2ea476'})
    await updater.fetchVersion('stable')
    expect(fs.writeJSON).toBeCalledWith(path.join(config.cacheDir, 'stable.version'), {channel: 'stable', version: '1.2.3-b2ea476'})
  })
})