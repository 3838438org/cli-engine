// @flow

import Command from 'cli-engine-command'
import Plugins from '../../plugins'
import path from 'path'

let cli = 'heroku'
if (global.config) {
  cli = global.config.bin
}

export default class PluginsLink extends Command<*> {
  static topic = 'plugins'
  static command = 'link'
  static args = [
    {name: 'path', optional: true, description: 'local file path to plugin root'}
  ]
  static description = 'links a local plugin to the CLI for development'
  static help = `Example:
    $ ${cli} plugins:link .
    Installing dependencies for /Users/dickeyxxx/src/github.com/heroku/heroku-status... done
    Running prepare script for /Users/dickeyxxx/src/github.com/heroku/heroku-status... done`

  plugins: Plugins

  async run () {
    this.plugins = new Plugins(this.config)
    let p = path.resolve(this.argv[0] || process.cwd())
    this.out.action.start(`Linking ${p}`)
    await this.plugins.addLinkedPlugin(p)
  }
}
