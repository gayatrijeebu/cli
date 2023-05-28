
const {
  definitions,
  definitionKeys,
  internals,
  internalKeys,
  derived,
  derivedKeys,
} = require('./definitions')
const { Types } = require('../type-defs')
const { LocationNames } = require('./locations')

// These are the configs that we can nerf-dart. Not all of them currently even
// *have* config definitions so we have to explicitly validate them here
const nerfDarts = Object.freeze([
  '_auth',
  '_authToken',
  'username',
  '_password',
  'email',
  'certfile',
  'keyfile',
])

const E = module.exports = {
  nerfDarts,
  // definition instances and their keys
  definitions,
  definitionKeys,
  // internal
  internals,
  internalKeys,
  // shorthands
  shorthands: {},
  shorthandKeys: [],
  // derived instances and their keys
  derived,
  derivedKeys,
  // type data and default values collected from definitions since we need this
  // info often in object form
  defaults: {},
  types: {},
}

const setDefine = (key, def) => {
  E.defaults[key] = def.default

  for (const where of LocationNames) {
    // a type is allowed for each location if the definition didnt specify any
    // locations, or if the location is default or if this is one of the definitions
    // valid locations. anything else gets set to a special type that will not allow
    // any value
    E.types[where][key] = def.isAllowed(where) ? def.type : [Types.NotAllowed]
  }

  for (const [k, v] of def.shorthands) {
    E.shorthands[k] = v
    E.shorthandKeys.push(k)
  }
}

const setInternal = (key, v) => {
  // E.internal[key] = v
  // E.internalKeys.push(key)
}

const setDerive = (keys, der) => {

}

const main = () => {
  for (const where of LocationNames) {
    E.types[where] = {}
  }

  Object.freeze(E.definitions)
  Object.freeze(E.definitionKeys)
  for (const key of definitionKeys) {
    setDefine(key, definitions[key])
  }

  // Everything needs to be added before derived values are created
  Object.freeze(E.shorthands)
  Object.freeze(E.shorthandKeys)
  Object.freeze(E.defaults)
  Object.freeze(E.types)

  Object.freeze(E.internal)
  Object.freeze(E.internalKeys)
  for (const key of internalKeys) {
    setInternal(key, internals[key])
  }

  Object.freeze(E.derived)
  Object.freeze(E.derivedKeys)
  for (const key of derivedKeys) {
    setDerive(key, derived[key])
  }

  // graph it
}

main()
