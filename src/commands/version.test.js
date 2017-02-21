// @flow
/* globals
   test
   expect
 */

import Command from './version'

test('shows the version', async function () {
  let cmd = new Command(['cli-engine', 'version'], {mock: true})
  await cmd.init()
  await cmd.run()
  expect(cmd.stdout.output).toMatch(/^cli-engine/)
})
