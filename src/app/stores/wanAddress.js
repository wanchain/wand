/* eslint-disable no-fallthrough */

import wanUtil from 'wanchain-util';
import Identicon from 'identicon.js';
import intl from 'react-intl-universal';
import { observable, action, computed, toJS, makeObservable } from 'mobx';

import tokens from './tokens';
import staking from './staking';
import session from './session';
import languageIntl from './languageIntl';
import { checkAddrType, getWalletIdByType, getTypeByWalletId, resetSettingsByOptions } from 'utils/helper';
import { WANPATH, WALLETID } from 'utils/settings';
import { timeFormat, fromWei, formatNum, toChecksumAddress } from 'utils/support';
import { BigNumber } from 'bignumber.js';

const WAN = "m/44'/5718350'/0'/0/";

class WanAddress {
  @observable addrInfo = {
    normal: {},
    ledger: {},
    trezor: {},
    import: {},
    rawKey: {}
  };

  @observable currentPage = [];

  @observable selectedAddr = '';

  @observable transHistory = {};

  constructor() {
    makeObservable(this);
  }

  @action addAddress(newAddr) {
    self.addrInfo['normal'][newAddr.address] = {
      name: newAddr.name ? newAddr.name : `WAN-Account${Number(newAddr.start) + 1}`,
      address: newAddr.address,
      waddress: newAddr.waddress,
      balance: '0',
      wbalance: '0',
      path: newAddr.start
    };
  }

  @action deleteAddress(type, addr) {
    delete self.addrInfo[type][toChecksumAddress(addr)];
    this.updateTransHistory();
  }

  @action updateAddress(type, newAddress = {}) {
    if (typeof type === 'string') {
      self.addrInfo[type] = newAddress;
    } else {
      type.forEach(item => { self.addrInfo[item] = newAddress })
    }
  }

  @action addAddresses(type, addrArr) {
    addrArr.forEach(addr => {
      if (!Object.keys(self.addrInfo[type]).includes(addr.address)) {
        if (addr.name === undefined && type === 'ledger') {
          addr.name = `Ledger${parseInt(((/[0-9]+$/)).exec(addr.path)[0]) + 1}`;
        }
        if (addr.name === undefined && type === 'trezor') {
          addr.name = `Trezor${parseInt(((/[0-9]+$/)).exec(addr.path)[0]) + 1}`;
        }
        if (addr.name === undefined) {
          addr.name = `WAN-Account${parseInt(((/[0-9]+$/)).exec(addr.path)[0]) + 1}`;
        }
        self.addrInfo[type][addr.address] = {
          name: addr.name,
          balance: addr.balance || '0',
          address: addr.address,
          path: addr.path
        }
      }
    })
  }

  @action updateTransHistory(initialize = false) {
    if (initialize) {
      self.transHistory = {};
    }
    wand.request('transaction_showRecords', (err, val) => {
      if (!err && val.length !== 0) {
        let tmp = {};
        val = val.filter(item => item.chainType === 'WAN');
        val.forEach(item => {
          item.from = toChecksumAddress(item.from);
          if (item.txHash !== '' && (item.txHash !== item.hashX || item.status === 'Failed')) {
            tmp[item.txHash] = item;
          }
          if (item.txHash === '' && item.status === 'Failed') {
            tmp[item.hashX] = item;
          }
        })
        self.transHistory = tmp;
      }
    })
  }

  @action setSelectedAddr(addr) {
    if (typeof addr === 'string') {
      self.selectedAddr = [addr];
    } else {
      self.selectedAddr = addr;
    }
  }

  @action updateWANBalance(data) {
    let { balance: arr, privateBalance: parr } = data;
    if (arr === undefined && parr === undefined) {
      arr = data;
      parr = undefined;
    }
    let keys = Object.keys(arr);
    let normal = Object.keys(self.addrInfo['normal']);
    let ledger = Object.keys(self.addrInfo['ledger']);
    let trezor = Object.keys(self.addrInfo['trezor']);
    let importArr = Object.keys(self.addrInfo['import']);
    let rawKey = Object.keys(self.addrInfo['rawKey']);
    keys.forEach(item => {
      let wanAddress = toChecksumAddress(item);
      if (normal.includes(wanAddress) && self.addrInfo['normal'][wanAddress].balance !== arr[item]) {
        self.addrInfo['normal'][wanAddress].balance = arr[item];
      }
      if (ledger.includes(wanAddress) && self.addrInfo['ledger'][wanAddress].balance !== arr[item]) {
        self.addrInfo['ledger'][wanAddress].balance = arr[item];
      }
      if (trezor.includes(wanAddress) && self.addrInfo['trezor'][wanAddress].balance !== arr[item]) {
        self.addrInfo['trezor'][wanAddress].balance = arr[item];
      }
      if (importArr.includes(wanAddress) && self.addrInfo['import'][wanAddress].balance !== arr[item]) {
        self.addrInfo['import'][wanAddress].balance = arr[item];
      }
      if (rawKey.includes(wanAddress) && self.addrInfo['rawKey'][wanAddress].balance !== arr[item]) {
        self.addrInfo['rawKey'][wanAddress].balance = arr[item];
      }
    });

    if (!(parr instanceof Object)) {
      return;
    }
    let pKeys = Object.keys(parr);
    pKeys.forEach(item => {
      if (normal.includes(item) && self.addrInfo['normal'][item].wbalance !== parr[item]) {
        self.addrInfo['normal'][item].wbalance = parr[item];
      }
      if (importArr.includes(item) && self.addrInfo['import'][item].wbalance !== parr[item]) {
        self.addrInfo['import'][item].wbalance = parr[item];
      }
      if (rawKey.includes(item) && self.addrInfo['rawKey'][item].wbalance !== parr[item]) {
        self.addrInfo['rawKey'][item].wbalance = parr[item];
      }
    });
  }

  @action updateName(arr, wid) {
    let type = getTypeByWalletId(wid);
    if (type === 'ledger') {
      let index = arr.path.lastIndexOf('\/') + 1
      arr.path = `${arr.path.slice(0, index)}0/${arr.path.slice(index)}`;
    }
    wand.request('account_update', { walletID: wid, path: arr.path, meta: { name: arr.name, addr: arr.address.toLowerCase(), waddr: arr.waddress ? arr.waddress.toLowerCase() : '' } }, (err, val) => {
      if (!err && val) {
        self.addrInfo[type][arr['address']]['name'] = arr.name;
      }
    });
  }

  @action getUserAccountFromDB() {
    wand.request('account_getAll', { chainID: 5718350 }, (err, ret) => {
      if (err) {
        console.log('Get user from DB failed ', err);
        return false;
      }
      let info = ret.accounts;
      let accountObj = {};
      let checkExist = v => {
        if (accountObj[v]) {
          return true;
        } else {
          accountObj[v] = true;
          return false;
        }
      }
      if (info && Object.keys(info).length) {
        let typeFunc = id => {
          switch (id) {
            case '1':
              return 'normal';
            case '5':
              return 'import';
            case '6':
              return 'rawKey';
          }
        };
        Object.keys(info).forEach(path => {
          Object.keys(info[path]).forEach(id => {
            if (['1', '5', '6'].includes(id)) {
              let address = toChecksumAddress(info[path][id]['addr']);
              if (checkExist(address)) {
                // Delete the duplicate account info from DB file.
                wand.request('account_delete', { walletID: parseInt(id), path }, async (err, ret) => {
                  if (err) console.log('Delete user from DB failed ', err);
                });
                return false;
              } else {
                let waddress = info[path][id]['waddr'];
                let obj = {
                  name: info[path][id]['name'],
                  balance: 0,
                  wbalance: 0,
                  path: path.substr(path.lastIndexOf('\/') + 1),
                  address: address
                };
                if (waddress) {
                  obj.waddress = wanUtil.toChecksumOTAddress(waddress);
                }
                self.addrInfo[typeFunc(id)][address] = obj;
              }
            }
          })
        })
      }
    })
  }

  @action async updateUserAccountDB(ver, upgradeThisVersionOnly = false) {
    if (ver === undefined || ver === '') {
      ver = '1.0.0';
    }
    console.log('User DB current version:', ver);
    switch (ver) {
      case '1.0.0':
        // This part is in order to update the hdwallet.json file, which need to get private from sdk, and this operation need login authentication.
        try {
          console.log('Update from V1.0.0========================');
          if (!session.hasMnemonicOrNot) {
            session.setNeedFirstDBUpdate(false);
          } else if (session.hasMnemonicOrNot && !session.auth) {
            // After the user logs into the wallet, the update operation is performed.
            session.setNeedFirstDBUpdate(true);
          } else {
            let normalInfo = self.addrInfo.normal;
            let importInfo = self.addrInfo.import;
            let rawKeyInfo = self.addrInfo.rawKey;
            let typeFunc = id => {
              switch (String(id)) {
                case '1':
                  return 'normal';
                case '5':
                  return 'import';
                case '6':
                  return 'rawKey';
              }
            };
            let noWaddressArr = [];
            let setWaddress = obj => {
              self.addrInfo[typeFunc(obj.id)][toChecksumAddress(obj.address)].waddress = wanUtil.toChecksumOTAddress(obj.waddress); // error
            };
            let filterData = function (data, type) {
              Object.keys(data).forEach(item => {
                let waddress = data[item]['waddress'];
                let name = data[item]['name'];
                let id = getWalletIdByType(type);
                let path = WAN + data[item]['path'];
                // If can not get the waddress, call a request to 'address_getOne' to get the waddress
                if (typeof waddress === 'undefined') {
                  noWaddressArr.push({ id, name, chainType: 'WAN', path });
                }
              });
            }
            filterData(normalInfo, 'normal');
            filterData(importInfo, 'import');
            filterData(rawKeyInfo, 'rawKey');

            // Insert none waddress account's waddress info into DB file.
            if (noWaddressArr.length !== 0) {
              try {
                await Promise.all(noWaddressArr.map(item => {
                  return new Promise((resolve, reject) => {
                    wand.request('address_getOne', { walletID: item.id, chainType: item.chainType, path: item.path }, (err, val) => {
                      if (!err) {
                        // Update the account waddress after obtaining waddress.
                        wand.request('account_update', { walletID: item.id, path: item.path, meta: { name: item.name, addr: `0x${val.address.toLowerCase()}`, waddr: `0x${val.waddress}` } }, (err, res) => {
                          if (!err && res) {
                            setWaddress({
                              id: item.id,
                              address: val.address,
                              waddress: `0x${val.waddress}`
                            });
                            resolve();
                          } else {
                            console.log('Update address information failed');
                            reject(new Error(err.desc));
                          }
                        })
                      } else {
                        console.log('Get one address failed', err);
                        reject(new Error(err.desc));
                      }
                    });
                  });
                }));
                session.setNeedFirstDBUpdate(false);
              } catch (e) {
                console.log('e:', e);
                session.setNeedFirstDBUpdate(true);
              }
            } else {
              session.setNeedFirstDBUpdate(false);
            }
          }
        } catch (e) {
          console.log('Update V1.0.0 user DB failed:', e);
        }
        if (upgradeThisVersionOnly) {
          break;
        }
      case '1.0.1':
        try {
          console.log('Update from V1.0.1========================');
          await resetSettingsByOptions(['main', 'testnet']);
        } catch (e) {
          console.log('Update V1.0.1 user DB failed:', e);
        }
        if (upgradeThisVersionOnly) {
          break;
        }
        break; // The latest DB version should contain `break;`, it's necessary.
      default:
        console.log('Unknown version');
    }
    // Set DB's userTblVersion
    wand.request('wallet_setUserTblVersion', (err, val) => {
      if (err) {
        console.log('Set user DB version failed');
      }
    });
  }

  @action addKeyStoreAddr({ path, name, addr, waddr }) {
    addr = toChecksumAddress(addr.toLowerCase());
    self.addrInfo['import'][addr] = {
      name: name,
      balance: '0',
      wbalance: '0',
      path: path,
      address: addr,
      waddress: waddr
    };
  }

  @action addRawKey({ path, name, addr, waddr }) {
    addr = toChecksumAddress(addr);
    self.addrInfo['rawKey'][addr] = {
      name: name,
      balance: '0',
      wbalance: '0',
      path: path,
      address: addr,
      waddress: wanUtil.toChecksumOTAddress(waddr)
    };
  }

  @action setCurrPage(page) {
    self.currentPage = page;
  }

  @action getPrivateAddr(addr) {
    let addrList = self.getAddrList;
    for (let i = 0; i < addrList.length; i++) {
      if (addrList[i].address === addr) {
        return addrList[i].waddress
      }
    }
    return '';
  }

  @computed get getAddrList() {
    let addrList = [];
    let normalArr = self.addrInfo['normal'];
    let importArr = self.addrInfo['import'];
    let rawKeyArr = self.addrInfo['rawKey'];
    [normalArr, importArr, rawKeyArr].forEach((obj, index) => {
      const walletID = obj === normalArr ? WALLETID.NATIVE : (obj === importArr ? WALLETID.KEYSTOREID : WALLETID.RAWKEY);
      Object.keys(obj).forEach((item) => {
        addrList.push({
          key: `${WAN}${obj[item].path}-${item}`,
          name: obj[item].name,
          address: toChecksumAddress(item),
          waddress: obj[item].waddress,
          balance: obj[item].balance,
          wbalance: obj[item].wbalance,
          path: `${WAN}${obj[item].path}`,
          action: 'send',
          wid: walletID
        });
      });
    });
    return addrList.sort((f, s) => {
      if (f.wid === s.wid) {
        return parseInt(f.path.substring(f.path.lastIndexOf('/') + 1)) > parseInt(s.path.substring(s.path.lastIndexOf('/') + 1)) ? 1 : -1;
      } else {
        return f.wid > s.wid ? 1 : -1;
      }
    });
  }

  @computed get getNormalAddrList() {
    let addrList = [];
    let normalArr = Object.keys(self.addrInfo['normal']);
    normalArr.forEach((item, index) => {
      let type = 'normal';
      addrList.push({
        key: item,
        name: self.addrInfo[type][item].name,
        address: toChecksumAddress(item),
        balance: self.addrInfo[type][item].balance,
        path: `${WANPATH}${self.addrInfo[type][item].path}`,
        action: 'send',
        wid: WALLETID.NATIVE
      });
    });
    return addrList;
  }

  @computed get ledgerAddrList() {
    let addrList = [];
    let type = 'ledger';
    Object.keys(self.addrInfo[type]).forEach((item, index) => {
      addrList.push({
        key: item,
        name: self.addrInfo[type][item].name,
        address: toChecksumAddress(item),
        balance: self.addrInfo[type][item].balance,
        path: self.addrInfo[type][item].path,
        action: 'send',
        wid: WALLETID.LEDGER
      });
    });
    return addrList;
  }

  @computed get trezorAddrList() {
    let addrList = [];
    let type = 'trezor';
    Object.keys(self.addrInfo[type]).forEach((item, index) => {
      addrList.push({
        key: item,
        name: self.addrInfo[type][item].name,
        address: toChecksumAddress(item),
        balance: self.addrInfo[type][item].balance,
        path: self.addrInfo[type][item].path,
        action: 'send',
        wid: WALLETID.TREZOR
      });
    });
    return addrList;
  }

  @computed get historyList() {
    try {
      let historyList = [];
      let page = self.currentPage;
      let addrList = [];
      if (self.selectedAddr) {
        addrList = self.selectedAddr
      } else {
        page.forEach(name => {
          addrList = addrList.concat(Object.keys(self.addrInfo[name] || {}));
        })
      }
      Object.keys(self.transHistory).forEach(item => {
        let data = self.transHistory[item];
        if (addrList.includes(data['from']) && !('transferTo' in data)) {
          let status = data.status;
          let type = checkAddrType(data['from'], self.addrInfo);
          historyList.push({
            key: item,
            time: timeFormat(data['sendTime']),
            from: self.addrInfo[type][data['from']].name,
            to: toChecksumAddress(data.to.toLowerCase()),
            value: formatNum(fromWei(data.value)),
            status: languageIntl.language && ['Failed', 'Success'].includes(status) ? intl.get(`TransHistory.${status.toLowerCase()}`) : intl.get('TransHistory.pending'),
            sendTime: data['sendTime'],
            offline: !!item.offline
          });
        }
      });
      return historyList.sort((a, b) => b.sendTime - a.sendTime);
    } catch (e) {
      console.log('get history list failed:', e);
      return [];
    }
  }

  @computed get privateHistoryList() {
    let historyList = [];
    let page = self.currentPage;
    let addrList = [];
    const PrivateAddr = '0x0000000000000000000000000000000000000064';
    if (self.selectedAddr) {
      addrList = self.selectedAddr
    } else {
      page.forEach(name => {
        addrList = addrList.concat(Object.keys(self.addrInfo[name]))
      })
    }
    Object.keys(self.transHistory).forEach(item => {
      if (addrList.includes(self.transHistory[item]['from']) && self.transHistory[item].to === PrivateAddr) {
        let status = self.transHistory[item].status;
        let type = checkAddrType(self.transHistory[item]['from'], self.addrInfo);
        let operation = self.transHistory[item]['annotate'];
        let txHash = self.transHistory[item].txHash;
        let to = self.transHistory[item].to;

        historyList.push({
          key: item,
          txHash: txHash,
          time: timeFormat(self.transHistory[item]['sendTime']),
          from: self.addrInfo[type][self.transHistory[item]['from']].name,
          to: /refund/i.exec(operation) ? self.transHistory[item]['from'] : (/send/i.exec(operation) ? self.transHistory[item]['privateTo'] : to),
          type: /send/i.exec(operation) ? intl.get('Common.send') : /refund/i.exec(operation) ? intl.get('TransHistory.refund') : '',
          value: /refund/i.exec(operation) ? formatNum(self.transHistory[item]['redeemAmount'] || 0) : formatNum(fromWei(self.transHistory[item].value)),
          status: languageIntl.language && ['Failed', 'Success'].includes(status) ? intl.get(`TransHistory.${status.toLowerCase()}`) : intl.get('TransHistory.pending'),
          sendTime: self.transHistory[item]['sendTime']
        });
      }
    });
    return historyList.sort((a, b) => b.sendTime - a.sendTime);
  }

  @computed get offlineHistoryList() {
    let historyList = [];

    Object.keys(self.transHistory).forEach(item => {
      if (self.transHistory[item].offline) {
        let status = self.transHistory[item].status;
        historyList.push({
          key: item,
          time: timeFormat(self.transHistory[item]['sendTime']),
          from: self.transHistory[item].from,
          to: toChecksumAddress(self.transHistory[item].to.toLowerCase()),
          value: formatNum(fromWei(self.transHistory[item].value)),
          status: languageIntl.language && ['Failed', 'Success'].includes(status) ? intl.get(`TransHistory.${status.toLowerCase()}`) : intl.get('TransHistory.pending'),
          sendTime: self.transHistory[item]['sendTime'],
        });
      }
    });
    return historyList.sort((a, b) => b.sendTime - a.sendTime);
  }

  @computed get tokenTransferHistoryList() {
    let historyList = [];
    let page = self.currentPage;
    let addrList = [];

    if (self.selectedAddr) {
      addrList = self.selectedAddr
    } else {
      page.forEach(name => {
        addrList = addrList.concat(Object.keys(self.addrInfo[name] || []))
      })
    }

    Object.keys(self.transHistory).forEach(item => {
      if (addrList.includes(self.transHistory[item]['from']) && self.transHistory[item].transferTo && (tokens.currTokenAddr.toLowerCase() === self.transHistory[item].to.toLowerCase())) {
        let status = self.transHistory[item].status;
        let type = checkAddrType(self.transHistory[item].from, self.addrInfo);

        historyList.push({
          key: item,
          time: timeFormat(self.transHistory[item]['sendTime']),
          from: self.addrInfo[type][self.transHistory[item].from].name,
          to: toChecksumAddress(self.transHistory[item].transferTo.toLowerCase()),
          value: formatNum(self.transHistory[item].token || 0),
          status: languageIntl.language && ['Failed', 'Success'].includes(status) ? intl.get(`TransHistory.${status.toLowerCase()}`) : intl.get('TransHistory.pending'),
          sendTime: self.transHistory[item]['sendTime'],
        });
      }
    });
    return historyList.sort((a, b) => b.sendTime - a.sendTime);
  }

  // TODO: need add hd
  @computed get stakingHistoryList() {
    let historyList = [];
    let histories = self.transHistory;
    let addrList = Object.keys(Object.assign({}, self.addrInfo.normal, self.addrInfo.ledger, self.addrInfo.trezor));
    Object.keys(self.transHistory).forEach(item => {
      if (histories[item].validator && addrList.includes(histories[item].from) && ['DelegateIn', 'DelegateOut'].includes(histories[item].annotate)) {
        let type = checkAddrType(histories[item].from, self.addrInfo);
        let { status, annotate } = histories[item];
        let getIndex = staking.stakingList.findIndex(value => value.validator.address === self.transHistory[item].validator);
        historyList.push({
          key: item,
          time: timeFormat(histories[item].sendTime),
          from: self.addrInfo[type][histories[item].from].name,
          fromAddress: histories[item].from,
          to: histories[item].to,
          value: formatNum(fromWei(histories[item].value)),
          status: languageIntl.language && ['Failed', 'Success'].includes(status) ? intl.get(`TransHistory.${status.toLowerCase()}`) : intl.get('TransHistory.pending'),
          sendTime: histories[item].sendTime,
          annotate: languageIntl.language && ['DelegateIn', 'DelegateOut'].includes(annotate) ? intl.get(`TransHistory.${annotate.toLowerCase()}`) : annotate,
          validator: {
            address: histories[item].validator,
            name: (getIndex === -1 || staking.stakingList[getIndex].validator.name === undefined) ? histories[item].validator : staking.stakingList[getIndex].validator.name,
            img: (getIndex === -1 || staking.stakingList[getIndex].validator.img === undefined) ? ('data:image/png;base64,' + new Identicon(histories[item].validator).toString()) : staking.stakingList[getIndex].validator.img,
          },
          stakeAmount: histories[item].stakeAmount,
        });
      }
    });

    return historyList.sort((a, b) => b.sendTime - a.sendTime);
  }

  @computed get addrSelectedList() {
    let addrList = []
    Object.keys(self.addrInfo['normal']).forEach(addr => {
      addrList.push(addr);
    });

    self.ledgerAddrList.forEach(addr => {
      addrList.push(
        'Ledger: ' + addr.address
      )
    });
    self.trezorAddrList.forEach(addr => {
      addrList.push(
        'Trezor: ' + addr.address
      )
    });
    return addrList;
  }

  @computed get getNormalAmount() {
    let sum = new BigNumber(0);
    Object.values({ normal: self.addrInfo.normal, import: self.addrInfo.import }).forEach(value => { sum = sum.plus(Object.values(value).reduce((prev, curr) => new BigNumber(prev).plus(new BigNumber(curr.balance)), 0)) });
    return formatNum(sum.toString(10));
  }

  @computed get getAllAmount() {
    let sum = new BigNumber(0);
    if (session.settings.long_addresses) {
      Object.values(self.addrInfo).forEach(value => {
        sum = sum.plus(Object.values(value).reduce((prev, curr) => new BigNumber(prev).plus(new BigNumber(curr.balance)).plus(isNaN(curr.wbalance) ? new BigNumber(0) : new BigNumber(curr.wbalance)), 0));
      });
    } else {
      Object.values(self.addrInfo).forEach(value => {
        sum = sum.plus(Object.values(value).reduce((prev, curr) => new BigNumber(prev).plus(new BigNumber(curr.balance)), 0));
      });
    }
    return sum.toString(10);
  }
}

const self = new WanAddress();
export default self;
