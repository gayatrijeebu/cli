const ConfigData = require('./config-data')
const { getFlatKey } = require('./definitions/definition')
const { LocationNames, Locations } = require('./definitions/locations')
const {
  definitions,
  derived,
  internals,
  sortedKeys,
  defaults,
  internalDefaults,
} = require('./definitions')

const hasOwn = (o, k) => Object.prototype.hasOwnProperty.call(o, k)

class ConfigLocations extends Map {
  #list = []
  #revList = []
  #indexes = {}

  #flatData = {}
  #dependsData = {}

  #cache = new Map()

  // #data = {}
  // #rawData = {}
  // #allData = {}
  // #allFlatData = {}

  constructor () {
    super()

    for (const where of LocationNames) {
      let data
      if (where === Locations.default) {
        data = defaults
      } else if (where === Locations.internal) {
        data = internalDefaults
      }
      this.add(where, data)
    }

    for (const key of sortedKeys) {
      const def = this.#getDef(key)
      const getValue = this.#getValue(def)

      this.#setFlatData(key, getValue, this.#dependsData)

      for (const flatKey of def.flatten) {
        this.#setFlatData(flatKey.split('.'), getValue)
      }
    }

    // symbols for mutating config data are shared here so that no method is exposed
    // that can mutate a location's config data execpt for these
    for (const key of Object.keys(ConfigData.mutateSymbols)) {
      if (key === 'load') {
        continue
      }
      this[key] = () => {
        throw new Error(`Cannot call ${key} on config locations`)
      }
    }
  }

  get data () {
    return this.#flatData
  }

  #getDef (key) {
    return derived[key] ?? internals[key] ?? definitions[key]
  }

  #getValue (def) {
    return () => {
      if (this.#cache.has(def)) {
        return this.#cache.get(def)
      }
      const result = def.isDerived
        ? def.getValue(this.#dependsData)
        : def.getValue(this.getData(null, def.key), this.#dependsData)
      this.#cache.set(def, result)
      return result
    }
  }

  #setFlatData (keys, getValue, obj = this.#flatData) {
    if (keys.length === 1 || typeof keys === 'string') {
      const key = Array.isArray(keys) ? keys[0] : keys
      Object.defineProperty(obj, getFlatKey(key), {
        configurable: false,
        enumerable: true,
        get: getValue,
      })
    } else {
      const next = getFlatKey(keys.shift())
      if (!hasOwn(obj, next)) {
        Object.defineProperty(obj, next, {
          configurable: false,
          enumerable: true,
          value: {},
        })
      }
      this.#setFlatData(keys, getValue, obj[next])
    }
  }

  load (where, ...args) {
    return this.get(where)[ConfigData.mutateSymbols.load](...args)
  }

  get (where) {
    if (!this.has(where)) {
      throw new Error(`Cannot get invalid config location of \`${where}\``)
    }
    return super.get(where)
  }

  add (location, configData) {
    const data = new ConfigData(location, {
      getData: (k) => this.getData(null, k),
      data: configData,
    })

    this.#indexes[data.where] = this.#list.push(data.where) - 1
    this.#revList.unshift(data.where)
    super.set(data.where, data)

    // TODO: for later, figure out how to invalidate and cache these
    for (const [k, v] of data.flatData.entries()) {
      this.#setFlatData([k], () => v)
    }

    return data
  }

  find (where, key) {
    for (const config of this.#reverseValues(where)) {
      if (config.has(key)) {
        return config.where
      }
    }
    return null
  }

  getData (where, key) {
    if (where === null) {
      for (const config of this.#reverseValues()) {
        if (config.has(key)) {
          return config.get(key)
        }
      }
    }
  }

  hasData (where, key) {
    if (where === null) {
      for (const config of this.#reverseValues()) {
        if (config.has(key)) {
          return true
        }
      }
      return false
    }
    return this.get(where).has(key)
  }

  setData (where, key, val) {
    this.#mutateData(key)
    return this.get(where)[ConfigData.mutateSymbols.set](key, val)
  }

  deleteData (where, key) {
    this.#mutateData(key)
    return this.get(where)[ConfigData.mutateSymbols.delete](key)
  }

  #mutateData (key) {
    const def = this.#getDef(key)
    for (const d of def.dependencies) {
      this.#cache.delete(d)
    }
  }

  // defaults -> internal
  * values (startWhere) {
    const index = startWhere ? this.#indexes[startWhere] : 0
    const locations = index ? this.#list.slice(index) : this.#list
    for (const where of locations) {
      yield this.get(where)
    }
  }

  // internal -> defaults
  * #reverseValues (startWhere) {
    const index = startWhere ? this.#revList.length - 1 - this.#indexes[startWhere] : 0
    const locations = index ? this.#revList.slice(index) : this.#revList
    for (const where of locations) {
      yield this.get(where)
    }
  }
}

module.exports = ConfigLocations
