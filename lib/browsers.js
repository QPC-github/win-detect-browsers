'use strict'

const path = require('path')
const existent = require('existent')
const debug = require('debug')('win-detect-browsers')
const ffChannel = require('./firefox-release-channel')
const resolve = require('resolve')

exports.chrome = {
  find: function () {
    // Joined with filename (or [browser name].exe)
    this.dir('LOCALAPPDATA', 'Google\\Chrome\\Application')

    // Chrome Canary
    this.dir('LOCALAPPDATA', 'Google\\Chrome SxS\\Application')

    // programFiles() is a shortcut to dir() that checks both
    // "Program Files" and "Program Files (x86)" if on 64-bit Windows
    this.programFiles('Google\\Chrome\\Application')

    // Expanded to HKEY_LOCAL_MACHINE\Software, HKEY_CURRENT_USER\Software
    // and if on a x64 machine, their 32-bit (Software\WoW6432) counterparts.
    // Should also find 64-bit Chrome if installed, because 32-bit Chrome
    // uses the 32-bit registry and 64-bit Chrome uses the regular registry,
    // with the same subkeys.
    this.registry('Google\\Update', 'LastInstallerSuccessLaunchCmdLine')

    // Note: this one returns the binary's parent path
    this.registry('Microsoft\\Windows\\CurrentVersion\\App Paths\\chrome.exe', null, true)

    this.startMenu('Google Chrome')
    this.inPath()
    this.env('CHROME_BIN')

    // Custom search methods
    this.findUpdateClients()
    this.findProgIds()
  },

  findUpdateClients: require('./chrome/find-update-clients'),
  findProgIds: require('./chrome/find-progids')
}

exports.chromium = {
  bin: 'chrome.exe',

  // Can't search for chromium in PATH, because the binary name conflicts with chrome
  find: function () {
    this.dir('LOCALAPPDATA', 'Chromium\\Application')
    this.registry('Chromium', 'InstallerSuccessLaunchCmdLine')
    this.env('CHROMIUM_BIN')
  }
}

exports.firefox = {
  find: function () {
    this.programFiles('Mozilla Firefox')
    this.programFiles('Firefox Developer Edition')
    this.programFiles('Firefox Nightly')

    this.startMenu()
    this.registry('Mozilla\\Mozilla Firefox', 'PathToExe')

    this.versionRegistry(
      // First get version, then path
      'Mozilla\\Mozilla Firefox', 'CurrentVersion',
      'Mozilla\\Mozilla Firefox\\%s\\Main', 'PathToExe'
    )

    this.inPath()
  },

  post: function (result) {
    const name = result.info.ProductName

    if (name === 'FirefoxDeveloperEdition' || name === 'Firefox Developer Edition') {
      result.channel = 'developer'
    } else if (name === 'FirefoxNightly' || name === 'Firefox Nightly') {
      result.channel = 'nightly'
    } else {
      result.channel = ffChannel(result.info.ProductVersion || '')
    }

    return result
  }
}

exports.ie = {
  bin: 'iexplore.exe',

  find: function () {
    this.programFiles('Internet Explorer')
    this.startMenu()
    this.inPath()
  }
}

exports.maxthon = {
  bin: 'Maxthon.exe',

  find: function () {
    this.programFiles('Maxthon\\Bin')
    this.startMenu()
    this.registry('Classes\\MaxthonAddonFile\\shell\\open\\command')
    this.inPath()
  }
}

exports.phantomjs = {
  // Without .exe suffix, so phantomjs.cmd can be found in PATH
  bin: 'phantomjs',

  find: function () {
    this.inPath()
    this.env('PHANTOMJS_BIN')

    const cwd = process.cwd()
    const cb = this.plan(1)
    const self = this

    // 2.x
    resolve('phantomjs-prebuilt', { basedir: cwd }, function (err, mod) {
      if (!err) return self.found(require(mod).path, 'phantomjs-prebuilt', cb)

      // 1.x
      resolve('phantomjs', { basedir: cwd }, function (err, mod) {
        if (!err) self.found(require(mod).path, 'phantomjs', cb)
        else cb()
      })
    })
  },

  pre: function (file, done, _noRecursion) {
    if (!isCmd(file)) return done(file)

    // If installed by nodejs module, we can get the executable
    // path from the module. The module also provides a
    // version number, but we ignore that to keep things simple.

    const mod1x = 'node_modules/phantomjs/lib/phantomjs.js'
    const mod2x = 'node_modules/phantomjs-prebuilt/lib/phantomjs.js'
    const global = '..'
    const local = '../../..'
    const self = this

    const locations = [
      path.resolve(file, global, mod1x),
      path.resolve(file, local, mod1x),
      path.resolve(file, global, mod2x),
      path.resolve(file, local, mod2x)
    ]

    next()

    function next () {
      if (!locations.length) {
        debug('Could not resolve "%s" to module', file)
        return done()
      }

      const loc = locations.pop()

      existent(loc, function (err) {
        if (!err) getBinary(loc)
        else next()
      })
    }

    function isCmd (path) {
      return path.slice(-4).toLowerCase() === '.cmd'
    }

    function getBinary (mod) {
      const path = require(mod).path

      // a local module can point to global installation
      if (isCmd(path)) {
        if (_noRecursion) return done()
        return self.pre(path, done, true)
      }

      done(path)
    }
  }
}

exports.opera = {
  bin: 'Launcher.exe',

  find: function () {
    this.programFiles('Opera')
    this.registry('Clients\\StartMenuInternet\\OperaStable\\shell\\open\\command')
    this.registry('Classes\\OperaStable\\shell\\open\\command')

    this.programFiles('Opera beta')
    this.registry('Clients\\StartMenuInternet\\OperaBeta\\shell\\open\\command')
    this.registry('Classes\\OperaBeta\\shell\\open\\command')

    this.programFiles('Opera developer')
    this.registry('Clients\\StartMenuInternet\\OperaDeveloper\\shell\\open\\command')
    this.registry('Classes\\OperaDeveloper\\shell\\open\\command')

    this.inPath()
  },

  post: function (b) {
    const product = b.info.ProductName || b.info.FileDescription || ''
    const channel = product.toLowerCase().split(' ')[1]

    if (channel === 'beta') b.channel = 'beta'
    else if (channel === 'developer') b.channel = 'developer'
    else b.channel = 'stable'

    return b
  }
}

// Incomplete (Safari for Windows is dead anyway)
exports.safari = {
  find: function () {
    this.startMenu()
    this.registry('Apple Computer, Inc.\\Safari', 'BrowserExe')
    this.inPath()
  }
}

exports.yandex = {
  bin: 'browser.exe',

  find: function () {
    this.dir('LOCALAPPDATA', 'Yandex\\YandexBrowser\\Application')
    this.registry('YandexBrowser', 'InstallerSuccessLaunchCmdLine')

    this.startMenu()
    this.inPath()
  }
}
