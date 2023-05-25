const { resolve, join } = require('path')
const { readFileSync } = require('fs')

const maybeReadFile = file => {
  try {
    return readFileSync(file, 'utf8')
  } catch (er) {
    if (er.code !== 'ENOENT') {
      throw er
    }
    return null
  }
}

// we export a Map because a derived key can be an array of keys that we
// normalize when we create all the relationships in index.js
module.exports = new Map()
const derive = (key, ...values) => module.exports.set(key, values)

// These two configs are always tied to together so they are derived like this
// otherwise their dependency relationship would create a cycle which is not
// currently allowed in the config parser
derive(['global', 'location'], ({ global, location }) => {
  const isGlobal = global || location === 'global'
  return isGlobal ? { global: true, location: 'global' } : { global, location }
})

derive(['prefix', 'globalconfig', 'global-prefix'], ({ prefix, globalconfig }, config) => {
  const defaultPrefix = prefix ?? config.defaultGlobalPrefix
  // if the prefix is set on cli, env, or userconfig, then we need to
  // default the globalconfig file to that location, instead of the default
  // global prefix.  It's weird that `npm get globalconfig --prefix=/foo`
  // returns `/foo/etc/npmrc`, but better to not change it at this point.
  return {
    prefix: defaultPrefix,
    globalPrefix: defaultPrefix,
    globalconfig: globalconfig ?? resolve(defaultPrefix, 'etc/npmrc'),
  }
})

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

derive('local-prefix', ({ prefix, workspaces, global }, config) => {
  if (prefix != null) {
    return prefix
  }

  const { defaultLocalPrefix, cwd } = config
  const defaultPrefix = defaultLocalPrefix.root ?? cwd

  if (defaultLocalPrefix.root && (workspaces === false || global)) {
    return defaultPrefix
  }

  return defaultLocalPrefix.workspace ?? defaultPrefix
}, ['prefix', 'workspaces', 'global'])

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
    .map(s => s.trimLeft() + delim)
}, ['cafile'])

derive('color', ({ color }) => {
  return !color ? false : color === 'always' ? true : !!process.stdout.isTTY
})

derive('log-color', ({ color }) => {
  return !color ? false : color === 'always' ? true : !!process.stderr.isTTY
}, ['color'])

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

derive('progress', ({ progress }) => {
  return !progress ? false : !!process.stderr.isTTY && process.env.TERM !== 'dumb'
})

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

derive('user-agent', ({ userAgent, ciName, workspaces, workspace, npmVersion }) => {
  const ws = !!(workspaces || workspace?.length)
  return userAgent.replace(/\{node-version\}/gi, process.version)
    .replace(/\{npm-version\}/gi, npmVersion)
    .replace(/\{platform\}/gi, process.platform)
    .replace(/\{arch\}/gi, process.arch)
    .replace(/\{workspaces\}/gi, ws)
    .replace(/\{ci\}/gi, ciName ? `ci/${ciName}` : '')
    .trim()
}, ['ci-name', 'workspaces', 'workspace', 'npm-version'])

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
