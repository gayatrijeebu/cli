const t = require('tap')
const ConfigLocations = require('../lib/config-locations.js')

t.test('basic', async t => {
  const l = new ConfigLocations()

  // console.error({ ...l.data })

  const e = Object.entries({ ...l.data })
    .sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([k, v]) => [k, v && typeof v === 'object' && !Array.isArray(v) ? { ...v } : v])

  console.log(Object.fromEntries(e))

  t.ok(l)
})
