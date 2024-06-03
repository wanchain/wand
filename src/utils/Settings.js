import fs from 'fs'
import low from 'lowdb'
import FileSync from 'lowdb/adapters/FileSync'
import { app } from 'electron'
import Logger from './Logger'
import yargs from 'yargs'
import WalletHelper from '~/src/utils/Helper'

// caches for config
let _mode = undefined
let _network = undefined
let _lang = undefined
let _isDev = undefined
let _settings = undefined

const defaultConfig = {
  mode: 'light',
  network: 'main',
  lang: 'en',
  skippedUpdateVersion: null,
  settings: {
    reinput_pwd: false,
    staking_advance: false,
    offline_wallet: false,
    long_addresses: false,
    // scan_ota: false,
    scan_ota_list: {},
    logout_timeout: '5',
    currency_unit: 'USD',
    main: {
      tokens: {
        "2153201998-0x0000000000000000000000000000000000000000": {
          "select": true
        },
        "2147483708-0x0000000000000000000000000000000000000000": {
          "select": true
        },
        "2153201998-0xc6f4465a6a521124c8e3096b62575c157999d361": {
          "account": "0xc6f4465a6a521124c8e3096b62575c157999d361",
          "ancestor": "FNX",
          "chain": "Wanchain",
          "chainSymbol": "WAN",
          "decimals": "18",
          "select": false,
          "symbol": "FNX"
        },
        "2153201998-0xcb72ef349870780fdc4786e8c86aab5b4fa36b73": {
          "account": "0xcb72ef349870780fdc4786e8c86aab5b4fa36b73",
          "ancestor": "RVX",
          "chain": "Wanchain",
          "chainSymbol": "WAN",
          "decimals": "18",
          "select": false,
          "symbol": "RVX"
        }
      },
      cc_selected: {
        "1": true,
        "2": true
      }
    },
    testnet: {
      tokens: {
        "2153201998-0x0000000000000000000000000000000000000000": {
          "select": true
        },
        "2147483708-0x0000000000000000000000000000000000000000": {
          "select": true
        },
        "2153201998-0x0664b5e161a741bcdec503211beeec1e8d0edb37": {
          "account": "0x0664b5e161a741bcdec503211beeec1e8d0edb37",
          "ancestor": "FNX",
          "chain": "Wanchain",
          "chainSymbol": "WAN",
          "decimals": "18",
          "select": false,
          "symbol": "FNX"
        }
      },
      cc_selected: {
        "1": true,
        "2": true
      }
    }
  }
}

const cscContractAddr = "0x00000000000000000000000000000000000000da";

const htlcAddresses = {
  testnet: {
    weth: '0xfbaffb655906424d501144eefe35e28753dea037',
    eth: '0x358b18d9dfa4cce042f2926d014643d4b3742b31',
  },
  main: {
    weth: '0x7a333ba427fce2e0c6dd6a2d727e5be6beb13ac2',
    eth: '0x78eb00ec1c005fec86a074060cc1bc7513b1ee88',
  }
};

const argv = yargs
  .options({
    'network': {
      demand: false,
      default: null,
      describe: 'Network to connect to: main or testnet',
      nargs: 1,
      type: 'string'
    },
    'mode': {
      demand: false,
      default: null,
      describe: 'Mode the wallet will be running on',
      nargs: 1,
      type: 'string'
    }
  })
  .help('h')
  .alias('h', 'help')
  .argv

/** Setting class */
class Settings {
  /**
   * Create an instance of Settings with a logger appended
   */
  constructor() {
    this._logger = Logger.getLogger('settings')
    this._logger.info('setting initialized')
    let ver = app.getVersion();
    if (ver.indexOf('-') === -1) {
      this.userPath = app.getPath('userData');
    }
    else {
      this.userPath = app.getPath('userData') + '/test';
    }
    if (!fs.existsSync(this.userPath)) {
      fs.mkdirSync(this.userPath);
    }
    this._logger.info('User data path: ' + this.userPath);

    try {
      this._db = low(new FileSync(this.userPath + '/config.json'));
    } catch (err) {
      let path = this.userPath + '/config.json';
      fs.copyFileSync(path, this.userPath + '/config-copy.json');
      fs.writeFileSync(path, '{}');
      this._db = low(new FileSync(path));
    } finally {
      this._logger.info('low db done');
      this.updateSettingsByConfig();
    }
  }

  updateSettingsByConfig() {
    let settings = this.get('settings');
    Object.keys(defaultConfig.settings).forEach(item => {
      if (settings[item] === undefined) {
        this.set(`settings.${item}`, defaultConfig.settings[item])
      }
    })
  }

  resetSettingsByOptions(attrs) {
    for (let attr of attrs) {
      if (attr in defaultConfig.settings) {
        this.set(`settings.${attr}`, defaultConfig.settings[attr]);
      }
    }
  }

  updateTokenItem(addr, value) {
    let network = this.get('network');
    if (this.get(`settings.${network}.tokens`)) {
      this.set(`settings.${network}.tokens["${addr}"]`, value);
    }
  }

  removeTokenItem(addr) {
    let network = this.get('network');
    if (this.get(`settings.${network}.tokens`)) {
      if (this.get(`settings.${network}.tokens["${addr}"]`)) {
        this.remove(`settings.${network}.tokens["${addr}"]`);
      }
    }
  }

  updateTokenKeyValue(addr, key, value) {
    let network = this.get('network');
    if (this.get(`settings.${network}.tokens["${addr}"]`)) {
      this.set(`settings.${network}.tokens["${addr}"]["${key}"]`, value);
    }
  }

  updateCcTokenSelections(id, selected) {
    let network = this.get('network');
    if (this.get(`settings.${network}.cc_selected`) === undefined) {
      this.set(`settings.${network}.cc_selected`, defaultConfig.settings[network].cc_selected);
    }
    this.set(`settings.${network}.cc_selected.[${id}]`, selected);
  }

  addToken(addr, obj) {
    let network = this.get('network');
    this.set(`settings.${network}.tokens["${addr}"]`, obj);
  }

  updateDapps(obj) {
    let network = this.get('network');
    this.set(`settings.${network}.dapps`, obj);
  }

  getDapps() {
    let network = this.get('network');
    return this.get(`settings.${network}.dapps`);
  }

  get appName() {
    return 'WAN Wallet'
  }

  get cscContractAddr() {
    return cscContractAddr;
  }

  get htlcAddresses() {
    return htlcAddresses[this.get('network')];
  }

  get tokens() {
    let network = this.get('network');
    return this.get(`settings.${network}.tokens`);
  }

  get CcTokenSelections() {
    let network = this.get('network');
    return this.get(`settings.${network}.cc_selected`);
  }

  get isDev() {
    if (_isDev) {
      return _isDev
    }

    return _isDev = process.env.NODE_ENV === 'development'
  }

  /**
   * Return application directory
   * @return {string} application data path, platform dependent
   */
  get userDataPath() {
    return this.userPath;
  }

  get appLogPath() {
    return WalletHelper.getLogPath()
  }

  /**
   * Return mode of WanWallet, light or full 
   * @return {string} wallet mode, light or full
   */
  get mode() {
    if (_mode) {
      return _mode
    }

    if (argv.mode) {
      return _mode = argv.mode
    }

    return _mode = this._get('mode') || defaultConfig.mode
  }

  /**
   * Return the network wallet is connected to, either main or testnet
   * @return {string} wanchain network, either mainnet or testnet
   */
  get network() {
    // return 'testnet'; // TODO
    if (_network) {
      return _network
    }

    if (argv.network) {
      return _network = argv.network
    }

    return _network = this._get('network') || defaultConfig.network
  }

  get language() {
    if (_lang) {
      return _lang
    }

    if (argv.lang) {
      return _lang = argv._lang
    }

    return _lang = this._get('lang') || defaultConfig.lang
  }

  get settings() {
    if (_settings) {
      return _settings
    }

    return _settings = this._get('settings') || defaultConfig.settings
  }

  get autoLockTimeout() {
    // auto lock the wallet if main window loses focus for a period of time. 5 min
    const logout = this.settings.logout_timeout || defaultConfig.settings.logout_timeout
    return Number.parseInt(logout) * 60 * 1000;
  }

  get idleCheckInterval() {
    return 1 * 60 * 1000
  }

  get skippedUpdateVersion() {
    return this._get('skippedUpdateVersion') || defaultConfig.skippedUpdateVersion
  }

  get(key) {
    return this._get(key)
  }

  _get(key) {
    let val = this._db.get(key).value();
    if (!val) {
      if (key in defaultConfig) {
        val = defaultConfig[key];
        this._set(key, defaultConfig[key]);
      }
    }
    return val;
  }

  set(key, value) {
    this._set(key, value)
  }

  _set(key, value) {
    this._db.set(key, value).write()
  }

  remove(key) {
    this._remove(key)
  }

  _remove(key) {
    this._db.unset(key).write()
  }

  switchNetwork() {
    const beforeSwitchNetwork = _network
    _network = undefined

    const [afterSwitchNetwork] = ['main', 'testnet'].filter(item => item !== beforeSwitchNetwork)

    this._set('network', afterSwitchNetwork)

    _network = afterSwitchNetwork
  }

  switchLang(langCode) {
    const beforeSwitchLang = _lang
    _lang = undefined

    this._set('lang', langCode)

    _lang = langCode
  }

  skipUpdateVersion(ver) {
    this._set('skippedUpdateVersion', ver);
  }
}

export default new Settings()
