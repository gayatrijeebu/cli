// These are default values that cannot be overridden at any other level so they
// are defined here instead of definitions since we do not want to document them
// but they should still be applied to flat options, and derived are functions
// that will be re-run and these are static values that can set.

const value = (key, v) => module.exports[key] = v

value('npm-command', null)
value('npm-args', [])
value('npm-version', null)
value('npm-bin', null)
value('node-bin', null)
// XXX should this be sha512?  is it even relevant?
value('hash-algorithm', 'sha1')
