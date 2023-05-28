const t = require('tap')

t.test('basic', async t => {
  const d = t.mock('../../lib/definitions/index.js')
  // console.log(d.shorthands)
  t.ok(d)
})
