import { observable, action, computed, makeObservable } from 'mobx';
import { MAIN, TESTNET } from 'utils/settings';
import { getChainId, getNetwork } from 'utils/helper';

class Session {
  @observable hasMnemonicOrNot = false;

  // WAN & ETH: 1 for main net, 3 for test net
  @observable chainId = 1; // TODO: Delete this param

  @observable network = MAIN; // main, testnet

  @computed get isMainNetwork() {
    return this.network === MAIN;
  }

  @observable auth = false;

  @observable isFirstLogin = true;

  @observable settings = {
    reinput_pwd: false,
    staking_advance: false,
    offline_wallet: false,
    // scan_ota: false,
    logout_timeout: '5',
    scan_ota_list: {},
    currency_unit: 'USD',
    long_addresses: false
  };

  @observable needFirstDBUpdate = false;

  constructor() {
    makeObservable(this);
  }

  @action setChainId(id) {
    self.chainId = id;
  }

  @action setNetwork(net) {
    self.network = net;
  }

  @action setIsFirstLogin(value) {
    self.isFirstLogin = value;
  }

  @action getMnemonic() {
    return new Promise((resolve, reject) => {
      wand.request('phrase_has', null, (err, val) => {
        if (!err) {
          self.hasMnemonicOrNot = val;
          resolve(val);
        } else {
          self.hasMnemonicOrNot = false;
          resolve(false);
        }
      });
    })
  }

  @action initChainId() {
    return getChainId().then(chainId => {
      self.chainId = chainId;
      return chainId;
    });
  }

  @action initNetwork() {
    return getNetwork().then(net => {
      self.network = net;
      return net;
    });
  }

  @action setMnemonicStatus(status) {
    self.hasMnemonicOrNot = status;
  }

  @action setAuth(val) {
    self.auth = val;
  }

  @action initSettings() {
    wand.request('setting_get', [{ keys: ['settings'] }], (err, ret) => {
      if (err) {
        console.log(`Init setting failed: ${JSON.stringify(err)}`);
        return;
      };
      self.settings = ret[0];
    })
  }

  @action updateSettings(newValue) {
    wand.request('setting_set', { settings: newValue }, (err, ret) => {
      if (err) return;
      if (ret) {
        Object.assign(self.settings, newValue);
      }
    })
  }

  @action updateInsteadSettings(key, value) {
    return new Promise((resolve, reject) => {
      wand.request('setting_set', { settings: { [key]: value } }, (err, ret) => {
        if (err) {
          reject(err);
        } else {
          self.settings[key] = value;
          resolve(ret);
        }
      })
    })
  }

  @action checkUpdateDB() {
    return new Promise((resolve, reject) => {
      wand.request('wallet_checkUpdateDB', {}, (err, ret) => {
        if (err) {
          reject(err);
        } else {
          resolve(ret);
        }
      })
    });
  }

  @action setNeedFirstDBUpdate(val) {
    this.needFirstDBUpdate = !!val;
  }
}

const self = new Session();
export default self;
