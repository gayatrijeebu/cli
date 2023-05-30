const t = require('tap')
const ConfigData = require('../lib/config-data.js')
const { Locations } = require('../lib/definitions/locations.js')

const mockConfig = (t, location) => {
  const config = new ConfigData(location)

  const logs = {}
  const logHandler = (level, _, ...args) => {
    if (!logs[level]) {
      logs[level] = []
    }
    logs[level].push(args.join(' '))
  }

  process.on('log', logHandler)
  t.teardown(() => process.off('log', logHandler))

  return {
    config,
    logs,
  }
}

t.test('loading', async t => {
  const { config, logs } = mockConfig(t, Locations.cli)

  config.load({
    'hash-algorithm': 'notok',
    'unknown-algorithm': 'huh',
    access: 'yes please',
  })

  t.strictSame(config.data, {})

  t.strictSame(logs.warn, [
    'invalid item `hash-algorithm` set with `notok`, not allowed to be set on config layer `cli`',
    'unknown item `unknown-algorithm` set with `huh`, not allowed to be set',
    'invalid item `access` set with `yes please`, Must be one of: "restricted", "public"',
  ])
})
