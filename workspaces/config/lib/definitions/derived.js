const { resolve, join } = require('path')
const { readFileSync } = require('fs')
const { Derived } = require('./definition')

const maybeReadFile = file => {
  try {
    return readFileSync(file, 'utf8')
  } catch (er) {
    if (er.code !== 'ENOENT') {
      throw er
    }
  }
  return null
}

const E = module.exports = {
  derived: {},
  derivedKeys: [],
  // These are default values that cannot be overridden at any other level so they
  // are defined here instead of definitions since we do not want to document them
  // but they should still be applied to flat options, and derived functions can
  // depend on their values
  internal: {},
  internalKeys: [],
}
const derive = (keys, get, sources = []) => {
  const nested = Array.isArray(keys)
  const keysArr = [].concat(keys)

  for (const key of keysArr) {
    const derivedDef = new Derived(key, {
      get,
      nested,
      sources: keysArr.concat(sources),
    })

    E.derived[key] = derivedDef
    E.derivedKeys.push(key)
  }
}
const internal = (key, value = null) => {
  E.internal[key] = value
  E.internalKeys.push(key)
}

internal('npm-command')
internal('npm-args', [])
internal('npm-version')
internal('npm-bin')
internal('npm-exec-path')

internal('node-version')
internal('node-bin')
internal('platform')
internal('arch')
internal('stderr-tty')
internal('stdout-tty')
internal('dumb-term')

internal('exec-path')
internal('cwd')
internal('home')

internal('default-global-prefix')
internal('default-local-prefix-workspace')
internal('default-local-prefix-root')
internal('local-package')

// XXX should this be sha512?  is it even relevant?
internal('hash-algorithm', 'sha1')

// These two configs are always tied to together so they are derived like this
// otherwise their dependency relationship would create a cycle which is not
// currently allowed in the config parser
derive(['global', 'location'], ({ global, location }) => {
  const isGlobal = global || location === 'global'
  return isGlobal ? { global: true, location: 'global' } : { global, location }
})

derive(['prefix', 'globalconfig', 'global-prefix'],
  ({ prefix, globalconfig, defaultGlobalPrefix }) => {
    const defaultPrefix = prefix ?? defaultGlobalPrefix
    // if the prefix is set on cli, env, or userconfig, then we need to
    // default the globalconfig file to that location, instead of the default
    // global prefix.  It's weird that `npm get globalconfig --prefix=/foo`
    // returns `/foo/etc/npmrc`, but better to not change it at this point.
    return {
      prefix: defaultPrefix,
      globalPrefix: defaultPrefix,
      globalconfig: globalconfig ?? resolve(defaultPrefix, 'etc/npmrc'),
    }
  }, ['default-global-prefix'])

derive('omit', ({ omit, production, optional, only, include }) => {
  const derived = [...omit]

  if (/^prod(uction)?$/.test(only) || production) {
    derived.push('dev')
  }

  if (optional === false) {
    derived.push('optional')
  }

  return [...new Set(derived)].filter(type => !include.includes(type))
}, ['dev', 'production', 'optional', 'also', 'include'])

derive('include', ({ include, dev, production, optional, also }) => {
  const derived = [...include]

  if (production === false) {
    derived.push('dev')
  }

  if (/^dev/.test(also)) {
    derived.push('dev')
  }

  if (dev) {
    derived.push('dev')
  }

  if (optional === true) {
    derived.push('optional')
  }

  return [...new Set(derived)]
}, ['dev', 'production', 'optional', 'also'])

derive('local-prefix', (data) => {
  const {
    prefix,
    workspaces,
    global,
    defaultLocalPrefixRoot,
    defaultLocalPrefixWorkspace,
    cwd,
  } = data

  if (prefix != null) {
    return prefix
  }

  const defaultPrefix = defaultLocalPrefixRoot ?? cwd

  if (defaultLocalPrefixRoot && (workspaces === false || global)) {
    return defaultPrefix
  }

  return defaultLocalPrefixWorkspace ?? defaultPrefix
}, [
  'prefix',
  'workspaces',
  'global',
  'default-local-prefix-root',
  'default-local-prefix-workspace',
  'cwd',
])

// Rename cache to cache-root in flatOptions since cache points to cacache dir
derive(['cache-root', 'cache'], ({ cache }) => ({
  cacheRoot: cache,
  cache: join(cache, '_cacache'),
}))

derive('npx-cache', ({ cacheRoot }) => {
  return join(cacheRoot, '_npx')
}, ['cache-root'])

derive('tuf-cache', ({ cacheRoot }) => {
  return join(cacheRoot, '_tuf')
}, ['cache-root'])

derive('logs-dir', ({ logsDir, cacheRoot }) => {
  return logsDir ?? join(cacheRoot, '_logs')
}, ['cache-root'])

derive('prefer-online', ({ cacheMax, preferOnline }) => {
  return cacheMax <= 0 ? true : preferOnline
}, ['cache-max'])

derive('prefer-offline', ({ cacheMin, preferOffline }) => {
  return cacheMin >= 9999 ? true : preferOffline
}, ['cache-min'])

derive('ca', ({ cafile }) => {
  const raw = cafile ? maybeReadFile(cafile) : null
  if (!raw) {
    return
  }
  const delim = '-----END CERTIFICATE-----'
  return raw.replace(/\r\n/g, '\n')
    .split(delim)
    .filter(s => s.trim())
    .map(s => s.trimStart() + delim)
}, ['cafile'])

derive('color', ({ color, stdoutTTY }) => {
  return !color ? false : color === 'always' ? true : !!stdoutTTY
}, ['stdout-tty'])

derive('log-color', ({ color, stderrTTY }) => {
  return !color ? false : color === 'always' ? true : !!stderrTTY
}, ['color', 'stderr-tty'])

derive('search.limit', ({ searchlimit }) => {
  return searchlimit
}, ['searchlimit'])

derive('search.description', ({ description }) => {
  return description
}, ['description'])

derive('search.exclude', ({ searchexclude }) => {
  return searchexclude.toLowerCase()
}, ['searchexclude'])

derive('search.opts', ({ searchopts }) => {
  return searchopts
}, ['searchopts'])

derive('progress', ({ progress, stderrTTY, dumbTerm }) => {
  return !progress ? false : !!stderrTTY && !dumbTerm
}, ['stderr-tty', 'dumb-term'])

derive('save-bundle', ({ saveBundle, savePeer }) => {
  // XXX update arborist to just ignore it if resulting saveType is peer
  // otherwise this won't have the expected effect:
  //
  // npm config set save-peer true
  // npm i foo --save-bundle --save-prod <-- should bundle
  return saveBundle && !savePeer
}, ['save-peer'])

derive('install-strategy', ({ globalStyle, legacyBundling, installStrategy }) => {
  return globalStyle ? 'shallow' : legacyBundling ? 'nested' : installStrategy
}, ['global-style', 'legacy-bundling'])

derive('save-prefix', ({ savePrefix, saveExact }) => {
  return saveExact ? '' : savePrefix
}, ['save-exact'])

derive('save-type', ({ saveDev, saveOptional, savePeer, saveProd }) => {
  if (savePeer && saveOptional) {
    return 'peerOptional'
  }
  if (savePeer) {
    return 'peer'
  }
  if (saveOptional) {
    return 'optional'
  }
  if (saveDev) {
    return 'dev'
  }
  if (saveProd) {
    return 'prod'
  }
}, ['save-dev', 'save-optional', 'save-peer', 'save-prod'])

// projectScope is kept for compatibility with npm-registry-fetch
derive('project-scope', ({ scope }) => {
  return scope
}, ['scope'])

derive('user-agent', (data) => {
  const {
    userAgent,
    ciName,
    workspaces,
    workspace,
    npmVersion,
    nodeVersion,
    platform,
    arch,
  } = data

  const ws = !!(workspaces || workspace?.length)
  const ci = ciName ? `ci/${ciName}` : ''

  return userAgent
    .replace(/\{node-version\}/gi, nodeVersion)
    .replace(/\{npm-version\}/gi, npmVersion)
    .replace(/\{platform\}/gi, platform)
    .replace(/\{arch\}/gi, arch)
    .replace(/\{workspaces\}/gi, ws)
    .replace(/\{ci\}/gi, ci)
    .trim()
}, ['ci-name', 'workspaces', 'workspace', 'npm-version', 'node-version', 'platform', 'arch'])

derive('silent', ({ loglevel }) => {
  return loglevel === 'silent'
}, ['loglevel'])

derive('workspaces-enabled', ({ workspaces }) => {
  return workspaces !== false
}, ['workspaces'])

derive('package-lock', ({ packageLock, packageLockOnly }) => {
  return packageLock || packageLockOnly
}, ['package-lock-only'])

derive('auth-type', ({ otp, authType }) => {
  return otp ? 'legacy' : authType
}, ['otp'])
