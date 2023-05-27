
const { definitions, definitionKeys } = require('./definitions')
const { derived, derivedKeys, internal, internalKeys } = require('./derived')
const { Types } = require('../type-defs')
const { LocationEntries, Locations } = require('./locations')

// aliases where they get expanded into a completely different thing
// these are NOT supported in the environment or npmrc files, only
// expanded on the CLI.
// TODO: when we switch off of nopt, use an arg parser that supports
// more reasonable aliasing and short opts right in the definitions set.
const shorthands = {
  'enjoy-by': ['--before'],
  d: ['--loglevel', 'info'],
  dd: ['--loglevel', 'verbose'],
  ddd: ['--loglevel', 'silly'],
  quiet: ['--loglevel', 'warn'],
  q: ['--loglevel', 'warn'],
  s: ['--loglevel', 'silent'],
  silent: ['--loglevel', 'silent'],
  verbose: ['--loglevel', 'verbose'],
  desc: ['--description'],
  help: ['--usage'],
  local: ['--no-global'],
  n: ['--no-yes'],
  no: ['--no-yes'],
  porcelain: ['--parseable'],
  readonly: ['--read-only'],
  reg: ['--registry'],
}

// These are the configs that we can nerf-dart. Not all of them currently even
// *have* config definitions so we have to explicitly validate them here
const nerfDarts = [
  '_auth',
  '_authToken',
  'username',
  '_password',
  'email',
  'certfile',
  'keyfile',
]

const E = module.exports = {
  nerfDarts,
  // definition instances and their keys
  definitions,
  definitionKeys,
  // internal
  internal,
  internalKeys,
  // shorthands
  shorthands,
  shorthandKeys: Object.keys(shorthands),
  // derived instances and their keys
  derived,
  derivedKeys,
  // type data and default values collected
  // from definitions since we need this info often
  // in object form
  defaults: {},
  types: {},
}

const setDefine = (key, def) => {
  E.defaults[key] = def.default

  for (const [where] of LocationEntries) {
    // a type is allowed for each location if the definition didnt specify any
    // locations, or if the location is default or if this is one of the definitions
    // valid locations. anything else gets set to a special type that will not allow
    // any value
    E.types[where][key] = def.isAllowed(where) ? def.type : [Types.NotAllowed]
  }

  for (const s of def.short) {
    E.shorthands[s] = [`--${key}`]
    E.shortKeys.push(s)
  }
}

const setInternal = (key, v) => {
  // E.internal[key] = v
  // E.internalKeys.push(key)
}

const setDerive = (keys, der) => {

}

const main = () => {
  for (const [where] of LocationEntries) {
    E.types[where] = {}
  }

  for (const key of definitionKeys) {
    setDefine(key, definitions[key])
  }

  // Everything needs to be added before derived values are created
  Object.freeze(E.definitions)
  Object.freeze(E.definitionKeys)
  Object.freeze(E.defaults)
  Object.freeze(E.types)
  Object.freeze(E.shorthands)
  Object.freeze(E.shorthandKeys)

  for (const key of internalKeys) {
    setInternal(key, internal[key])
  }

  Object.freeze(E.internal)
  Object.freeze(E.internalKeys)

  for (const key of derivedKeys) {
    setDerive(key, derived[key])
  }

  // graph it

  Object.freeze(E.derived)
  Object.freeze(E.derivedKeys)
}

main()
