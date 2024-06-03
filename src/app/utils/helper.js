import Web3 from 'web3';
import keccak from 'keccak';
import intl from 'react-intl-universal';
import { BigNumber } from 'bignumber.js';
import bs58check from 'bs58check';
import { bech32, bech32m } from 'bech32';
import { WANPATH, DEFAULT_GAS, HASHX, FAKEADDR, FAKESTOREMAN, X, FAKEVAL, MIN_CONFIRM_BLKS, MAX_CONFIRM_BLKS, WALLETID, PRIVATE_TX_AMOUNT_SELECTION, BTCPATH_MAIN, BTCCHAINID, ETHPATH, EOSPATH, XRPPATH, BSCPATH_MAIN, BSCPATH_TEST, DECIMALS, MAIN, CHAINID } from 'utils/settings';

import { fromWei, isNumber, formatNumByDecimals } from 'utils/support';
import { reject } from 'lodash';

const web3 = new Web3();
const wanUtil = require('wanchain-util');
const keypairs = require('ripple-keypairs')
const elliptic = require('elliptic')
let emitterHandlers = {};

export const deserializeWanTx = data => {
  let tx = new wanUtil.wanchainTx(data) // eslint-disable-line
  let from = tx.getSenderAddress();
  return { ...tx.toJSON(true), from: `0x${from.toString('hex')}` };
}

export const convertStatus = status => {
  switch (status) {
    case 'Revoked':
      return 'Cancelled';
    case 'BuddyLocked':
      return 'StoremanLocked';
    case 'Redeemed':
      return 'Success';
    default:
      return status;
  }
}

export const checkMaxFeeRate = function (rule, value, callback) {
  try {
    if (!isNumber(value)) {
      callback(intl.get('NormalTransForm.invalidFeeRate'));
      return;
    }
    if (value < 0 || value >= 100) {
      callback(intl.get('NormalTransForm.invalidFeeRate'));
      return;
    }
    if (value.toString().split('.')[1] && value.toString().split('.')[1].length > 2) {
      callback(intl.get('NormalTransForm.invalidFeeRate'));
      return;
    }
    callback();
  } catch (err) {
    callback(intl.get('NormalTransForm.invalidFeeRate'));
  }
}

export const wanPubKey2Address = function (pubKey) {
  let key = Buffer.from(pubKey.toLowerCase().replace('0x', '').substring(2), 'hex');
  let address = keccak('keccak256').update(key).digest().slice(-20).toString('hex');
  return '0x' + address;
}

export const getBalance = function (arr, chainType = 'WAN') {
  const addrArr = ['XRP'].includes(chainType) ? arr : arr.map(item => item.substr(2));

  return new Promise((resolve, reject) => {
    let thisVal
    wand.request('address_balance', { addr: addrArr, chainType }, (err, val) => {
      thisVal = Object.assign({}, val);
      if (err) {
        console.log(`Get ${chainType} balance failed`, err)
        return reject(err)
      } else {
        Object.keys(thisVal).forEach(item => {
          thisVal[item] = ['XRP'].includes(chainType) ? formatNumByDecimals(thisVal[item], DECIMALS[chainType]) : fromWei(thisVal[item]);
        });
        return resolve(thisVal);
      }
    })
  })
};

export const getAllBalancesFunc = function(chainType, address, options) {
  return new Promise((resolve, reject) => {
    wand.request('address_getAllBalances', { chainType, address, options }, (err, val) => {
      if (err) {
        console.log(`Get ${chainType} getAllBalances failed`, err)
        return reject(err)
      } else {
        return resolve(val);
      }
    })
  })
}

export const getRegisteredTokenList = function() {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getRegisteredTokenList', {}, (err, val) => {
      if (err) {
        console.log(`Get getRegisteredTokenList failed`, err)
        return reject(err)
      } else {
        return resolve(val);
      }
    })
  })
}

export const hasHackerAccount = async function(address) {
  return new Promise((resolve, reject) => {
    wand.request('account_hasHackerAccount', { address }, (err, val) => {
      if (err) {
        console.log(`hasHackerAccount failed`, err)
        return reject(err)
      } else {
        return resolve(val);
      }
    })
  });
}

export const getBTCMultiBalances = function (addresses) {
  return new Promise((resolve, reject) => {
    wand.request('address_getBtcMultiBalances', { minconf: MIN_CONFIRM_BLKS, maxconf: MAX_CONFIRM_BLKS, addresses }, (err, data) => {
      if (err) {
        console.log('Get BTC UTXO Failed: ', err);
        return reject(err);
      } else {
        return resolve(data);
      }
    })
  })
}

export const getEosAccountInfo = function (accounts) {
  return new Promise((resolve, reject) => {
    wand.request('address_getEosAccountInfo', { accounts }, (err, data) => {
      if (err) {
        console.log('Get EOS balance Failed: ', err);
        return reject(err);
      } else {
        return resolve(data);
      }
    })
  })
}

export const getBalanceWithPrivateBalance = function (arr, path) {
  const addrArr = arr.map(item => item.substr(2));
  return new Promise((resolve, reject) => {
    let thisVal = {};
    wand.request('address_balances', { addr: addrArr, path: path }, (err, val) => {
      if (err) {
        return reject(err)
      } else {
        thisVal.balance = Object.assign({}, val.balance);
        thisVal.privateBalance = Object.assign({}, val.privateBalance);
        Object.keys(thisVal.balance).forEach(item => {
          thisVal.balance[item] = fromWei(thisVal.balance[item]);
        });

        Object.keys(thisVal.privateBalance).forEach(item => {
          thisVal.privateBalance[item] = fromWei(thisVal.privateBalance[item]);
        });
        return resolve(thisVal);
      }
    });
  });
};

export const getValueByAddrInfo = function (value, type, addrInfo) {
  if (value === undefined) {
    return undefined;
  }
  if (value.indexOf(':') !== -1) {
    let addrArr = value.split(':');
    let addrType = addrArr[0].toLowerCase();
    let addr = addrArr[1].trimStart();
    return addrInfo[addrType][addr] && addrInfo[addrType][addr][type];
  } else {
    if (addrInfo['normal'][value]) {
      switch (type) {
        case 'path':
          return `${WANPATH}${addrInfo['normal'][value][type]}`
        default:
          return addrInfo['normal'][value][type];
      }
    } else if (addrInfo.ledger[value]) {
      return addrInfo.ledger[value] && addrInfo.ledger[value][type];
    } else if (addrInfo.trezor[value]) {
      return addrInfo.trezor[value] && addrInfo.trezor[value][type];
    } else {
      return undefined;
    }
  }
}

export const getInfoByAddress = function (address, infos, addrInfo) {
  let value = {};
  Object.keys(addrInfo).forEach(type => {
    let index = Object.keys(addrInfo[type]).findIndex(val => val.toLowerCase() === address.toLowerCase());
    if (index !== -1) {
      let addr = Object.keys(addrInfo[type])[index];
      value = { type, addr }
      infos.forEach(item => { value[item] = addrInfo[type][addr][item] });
    }
  });
  return value;
}

export const getValueByNameInfo = function (value, type, addrInfo, addrType = 'normal') {
  let targetVal = Object.values(addrInfo[addrType]).find(val => val.name === value)
  if (targetVal) {
    return targetVal[type];
  } else {
    return undefined
  }
}

export const getValueByNameInfoAllType = function (value, type, addrInfo) {
  let val;
  Object.keys(addrInfo).some(t => {
    let targetVal = Object.values(addrInfo[t]).find(val => val.name === value)
    if (targetVal) {
      val = type === 'type' ? t : targetVal[type];
      return true;
    } else {
      return false;
    }
  })
  return val;
}

export const getInfoByPath = function (pathInfo, addrInfo, addrType = 'normal') {
  let value = {};
  if (pathInfo) {
    let index = Object.keys(addrInfo[addrType]).findIndex(val => addrInfo[addrType][val].path === pathInfo.path.substr(pathInfo.path.lastIndexOf('\/') + 1));
    if (index !== -1) {
      let addr = Object.keys(addrInfo[addrType])[index];
      value = addrInfo[addrType][addr];
    }
  }
  return value;
}

export const getNonce = function (addrArr, chainType) {
  return new Promise((resolve, reject) => {
    wand.request('address_getNonce', { addr: addrArr, chainType: chainType }, (err, val) => {
      if (err) {
        console.log('Failed to get nonce', err)
        return reject(err);
      } else {
        let nonce = parseInt(val, 16);
        return resolve(nonce);
      }
    });
  })
};

export const getGasPrice = function (chainType) {
  return new Promise((resolve, reject) => {
    wand.request('query_getGasPrice', { chainType: chainType }, (err, val) => {
      if (err) {
        console.log('Failed to get gas price ', err);
        return reject(err)
      } else {
        let gasPrice = new BigNumber(val).div(BigNumber(10).pow(9)).toString(10);
        return resolve(gasPrice);
      }
    })
  })
};

export const getSmgList = function (crossChain, tokenAddr) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getSmgList', { crossChain, tokenAddr }, (err, val) => {
      if (err) {
        console.log('Get Smg list1 failed', err)
        return reject(err);
      } else {
        return resolve(val);
      }
    });
  })
}

export const getStoremanGroupList = function (srcChainName, dstChainName) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getStoremanGroupList', { srcChainName, dstChainName }, (err, val) => {
      if (err) {
        console.log('Get Smg list2 failed', err)
        return reject(err);
      } else {
        return resolve(val);
      }
    });
  })
}

export const getChainQuotaHiddenFlagDirectionally = function (chainIds) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getChainQuotaHiddenFlagDirectionally', { chainIds }, (err, val) => {
      if (err) {
        console.log('getChainQuotaHiddenFlagDirectionally failed', err)
        return reject(err);
      } else {
        return resolve(val);
      }
    });
  })
}

export const getWanBridgeDiscounts = function () {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getWanBridgeDiscounts', {}, (err, val) => {
      if (err) {
        console.log('GetWanBridgeDiscounts failed', err)
        return reject(err);
      } else {
        return resolve(val);
      }
    });
  })
}

export const getReadyOpenStoremanGroupList = function () {
  return new Promise((resolve, reject) => {
    wand.request('storeman_getReadyOpenStoremanGroupList', {}, (err, val) => {
      if (err) {
        console.log('Get Smg failed', err)
        return reject(err);
      } else {
        if (val instanceof Array && val.length > 1) {
          val.sort((front, behind) => front.groupId > behind.groupId);
        }
        return resolve(val);
      }
    });
  })
}

export const estimateGas = function (chainType, tx) {
  return new Promise((resolve, reject) => {
    wand.request('transaction_estimateGas', { chainType: chainType, tx: tx }, (err, val) => {
      if (err) {
        console.log('Failed to estimate gas ', err);
        return reject(err);
      } else {
        return resolve(val);
      }
    })
  })
};

export const checkWanAddr = function (address) {
  return new Promise((resolve, reject) => {
    wand.request('address_isWanAddress', { address }, (err, val) => {
      if (err) {
        console.log('Failed to check WAN address ', err);
        return reject(err);
      } else {
        return resolve(val);
      }
    })
  })
};

export const checkETHAddr = function (address) {
  return new Promise((resolve, reject) => {
    wand.request('address_isEthAddress', { address }, (err, val) => {
      if (err) {
        console.log('Check ETH address failed ', err);
        return reject(err);
      } else {
        return resolve(val);
      }
    })
  })
};

export const checkXRPAddr = function (address) {
  return new Promise((resolve, reject) => {
    wand.request('address_isXrpAddress', { address }, (err, val) => {
      if (err) {
        console.log('Check XRP address failed ', err);
        return reject(err);
      } else {
        return resolve(val);
      }
    })
  })
};

export const checkBTCAddr = async function (address) {
  const [valid1, valid2, valid3] = await Promise.all([checkBase58(address), checkBech32(address), checkBech32m(address)]);
  return valid1 || valid2 || valid3;
};

export const checkBase58 = function (address) {
  return new Promise((resolve, reject) => {
    try {
      bs58check.decode(address);
      resolve(true);
    } catch (error) {
      resolve(false);
    }
  });
}

export const checkBech32 = function (address) {
  return new Promise((resolve, reject) => {
    try {
      bech32.decode(address);
      resolve(true);
    } catch (error) {
      resolve(false);
    }
  });
}

export const checkBech32m = function (address) {
  return new Promise((resolve, reject) => {
    try {
      bech32m.decode(address);
      resolve(true);
    } catch (error) {
      resolve(false);
    }
  });
}

export const checkWanValidatorAddr = function (address) {
  return new Promise((resolve, reject) => {
    wand.request('address_isValidatorAddress', { address: address }, (err, val) => {
      if (err) {
        err = 'Failed to check WAN address: ' + err
        return reject(err)
      } else {
        return resolve(val);
      }
    })
  })
};

export const getNetwork = function () {
  return new Promise((resolve, reject) => {
    wand.request('query_config', {
      param: 'network'
    }, function (err, val) {
      if (err) {
        err = 'Failed to get network:' + err;
        reject(err);
      } else {
        resolve(val['network']);
      }
    });
  });
};

export const getChainId = function () {
  return new Promise((resolve, reject) => {
    getNetwork()
      .then(res => {
        if (res === MAIN) {
          return resolve(CHAINID.MAIN);
        } else {
          return resolve(CHAINID.TEST);
        }
      }).catch(err => {
        err = 'Failed to get chain ID:' + err;
        return reject(err);
      });
  });
};

export const isSdkReady = function () {
  return new Promise((resolve, reject) => {
    wand.request('query_config', {
      param: 'sdkStatus'
    }, function (err, val) {
      if (err) {
        err = 'Failed to get SDK status: ' + err;
        return reject(err);
      } else {
        if (val['sdkStatus'].includes('ready')) {
          return resolve(true);
        } else {
          return resolve(false);
        }
      }
    });
  });
};

export const checkAddrType = function (addr, addrInfo) {
  let type = false;
  if (typeof addr === 'string') {
    addr = String(addr).startsWith('0x') ? addr : `0x${addr}`.toLowerCase();
    Object.keys(addrInfo).forEach(item => {
      let has = Object.keys(addrInfo[item]).find(val => val.toLowerCase() === addr.toLowerCase());
      if (has) {
        type = item;
        return type;
      }
    })
    return type
  }
}

export const checkXRPAddrType = function (addr, addrInfo) {
  let type = false;
  if (typeof addr === 'string') {
    Object.keys(addrInfo).forEach(item => {
      let has = Object.keys(addrInfo[item]).find(val => val.toLowerCase() === addr.toLowerCase());
      if (has) {
        type = item;
        return type;
      }
    })
    return type
  }
}

export const hasSameName = function (type, record, addrInfo) {
  let tmp;
  let bool = false;
  if (type === 'normal') {
    tmp = Object.assign({}, addrInfo[type], addrInfo['import']);
  } else {
    tmp = Object.assign({}, addrInfo[type]);
  }
  Object.values(tmp).forEach(item => {
    if (item.name === record.name && item.address !== record.address) {
      bool = true;
    }
  })
  return bool;
}

export const getBalanceByAddr = function (addr, addrInfo) {
  let balance = 0;
  let tmp = {};
  Object.keys(addrInfo).forEach(item => {
    Object.assign(tmp, addrInfo[item])
  })
  Object.values(tmp).forEach(item => {
    if (item.address === addr || item.address === addr.toLowerCase()) {
      balance = item.balance;
      return; // eslint-disable-line no-useless-return
    }
  });
  return balance;
}

export const getAddrInfoByTypes = function (info, type, addrInfo, needType) {
  let tmp = {};
  let val;
  Object.keys(addrInfo).forEach(item => {
    tmp = Object.assign(tmp, addrInfo[item])
  })
  Object.keys(tmp).forEach(item => {
    if (tmp[item][type] === info) {
      if (needType === 'address') {
        val = item;
      } else {
        val = tmp[item][needType];
      }
    }
  })
  return val;
}

export const getPrivateBalanceByAddr = function (addr, addrInfo) {
  let addrArr = { ...addrInfo.normal, ...addrInfo.import, ...addrInfo.rawKey };
  return addrArr[addr] ? addrArr[addr].wbalance : '0';
}

export const checkAmountUnit = function (decimals, amount) {
  if (!Number.isInteger(Number(decimals))) {
    throw new Error('Decimals must be a integer');
  }
  if (amount === '0') {
    return true;
  }
  let amountStr = new BigNumber(amount).toString(10);
  let decimalLen = amountStr.includes('.') ? (amountStr.length - amountStr.indexOf('.') - 1) : 0;
  return !!(amount >= 1 / (10 ** decimals)) && decimalLen <= decimals;
}

export const formatAmount = function (amount) {
  let amountStr = amount.toString();
  if (amountStr.indexOf('.') === 0) {
    amount = new BigNumber(`0${amount}`);
  }
  if (amountStr.indexOf('.') === amountStr.length - 1) {
    amount = new BigNumber(`${amount}0`);
  }

  return amount.toString();
}

export const getAddrByTypes = function (addrInfo, types) {
  let addrs = [];
  if (types) {
    types.forEach(type => {
      addrs.push(Object.keys(addrInfo[type]));
    })
  } else {
    Object.keys(addrInfo).forEach(type => {
      addrs.push(Object.keys(addrInfo[type]));
    })
  }
  // return [['normal], ['Ledger], ... , ['Trezor]]
  return addrs;
}

export const regEmitterHandler = function (key, callback) {
  emitterHandlers[key] = callback;
}

export const initEmitterHandler = function () {
  wand.emitter.on('notification', function (key, val) {
    console.log('Emitter: ', key, val)
    if (Object.prototype.hasOwnProperty.call(emitterHandlers, key)) {
      emitterHandlers[key](val);
    }
  })
};

export const getContractAddr = function () {
  return new Promise((resolve, reject) => {
    wand.request('staking_getContractAddr', {}, (err, val) => {
      if (err) {
        err = 'staking_getContractAddr failed: ' + err;
        return reject(err);
      } else {
        return resolve(val);
      }
    });
  })
};

export const getContractData = function (func, ...params) {
  return new Promise((resolve, reject) => {
    wand.request('staking_getContractData', { func, params }, (err, val) => {
      if (err) {
        err = 'staking_getContractData failed: ' + err;
        return reject(err);
      } else {
        return resolve(val);
      }
    });
  })
};

export const getStoremanContractData = function (func, ...params) {
  return new Promise((resolve, reject) => {
    wand.request('storeman_getContractData', { func, params }, (err, val) => {
      if (err) {
        err = 'storeman_getContractData failed: ' + err;
        return reject(err);
      } else {
        return resolve(val);
      }
    });
  })
};

export const encodeTransferInput = function (addr, decimal, value = 0) {
  const TRANSFER = '0xa9059cbb';
  value = new BigNumber(value).multipliedBy(Math.pow(10, decimal)).toString(10);
  return TRANSFER + web3.eth.abi.encodeParameters(['address', 'uint256'], [addr.slice(2).toLowerCase(), value]).slice(2);
}

export const encodeEth2wethLockInput = function () {
  const LOCK = '0x158e00a3';
  return LOCK + web3.eth.abi.encodeParameters(['bytes32', 'address', 'address'], [HASHX, FAKESTOREMAN, FAKEADDR]).slice(2);
}

export const encodeEth2wethRefundInput = function () {
  const REFUND = '0x2000fe50';
  return REFUND + web3.eth.abi.encodeParameters(['bytes32'], [X]).slice(2);
}

export const encodeWeth2ethLockInput = function () {
  const REFUND = '0x004b4329';
  return REFUND + web3.eth.abi.encodeParameters(['bytes32', 'address', 'address', 'uint'], [HASHX, FAKESTOREMAN, FAKEADDR, FAKEVAL]).slice(2);
}

export const encodeWeth2ethRefundInput = function () {
  const REFUND = '0x514d0b01';
  return REFUND + web3.eth.abi.encodeParameters(['bytes32'], [X]).slice(2);
}

export const estimateCrossETHInboundGas = function (from) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getHtmlAddr', null, async (err, ret) => {
      if (err) {
        console.log('estimateCrossChainGas:', err)
        return reject(err);
      } else {
        let ethTrans = {
          from: from,
          to: ret.eth,
          value: new BigNumber('1').multipliedBy(Math.pow(10, 18)).toString(10),
          data: encodeEth2wethLockInput(),
          gas: DEFAULT_GAS
        };
        let wanTrans = {
          from: FAKEADDR,
          to: ret.weth,
          value: '0',
          data: encodeEth2wethRefundInput(),
          gas: DEFAULT_GAS
        };
        try {
          let [ethGas, wanGas] = await Promise.all([estimateGas('ETH', ethTrans), estimateGas('WAN', wanTrans)])
          resolve({
            ETH: ethGas,
            WAN: wanGas
          })
        } catch (err) {
          console.log('estimateCrossETHGas.estimateGas', err)
          reject(err)
        }
      }
    })
  })
}

export const estimateCrossETHOutboundGas = function (from) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getHtmlAddr', null, async (err, ret) => {
      if (err) {
        console.log('estimateCrossChainGas:', err)
        return reject(err);
      } else {
        let wanTrans = {
          from: from,
          to: ret.weth,
          value: new BigNumber('1').multipliedBy(Math.pow(10, 18)).toString(10),
          data: encodeWeth2ethLockInput(),
          gas: DEFAULT_GAS
        };
        let ethTrans = {
          from: FAKEADDR,
          to: ret.eth,
          value: '0',
          data: encodeWeth2ethRefundInput(),
          gas: DEFAULT_GAS
        };
        try {
          let [ethGas, wanGas] = await Promise.all([estimateGas('ETH', ethTrans), estimateGas('WAN', wanTrans)])
          resolve({
            WAN: wanGas,
            ETH: ethGas
          })
        } catch (err) {
          console.log('estimateCrossETHGas.estimateGas', err)
          reject(err)
        }
      }
    })
  })
}

export const getAllUndoneCrossTrans = function (callback) {
  wand.request('crossChain_getAllUndoneCrossTrans', null, (err, ret) => {
    if (err) {
      return callback(err);
    } else {
      return callback(null, ret);
    }
  })
}

export const increaseFailedRetryCount = function (params) {
  if (!params.transType) {
    params.transType = 'crossTrans';
  }
  wand.request('crossChain_increaseFailedRetryCount', params, err => {
    if (err) {
      console.log('Increase redeem retry count failed');
    }
  })
}

export const openScanOTA = function (path) {
  return new Promise((resolve, reject) => {
    wand.request('address_scanMultiOTA', { path }, function (err, res) {
      if (err) {
        console.log('Open OTA scanner failed:', err);
        return reject(err);
      } else {
        return resolve();
      }
    });
  })
}

export const initScanOTA = function () {
  return new Promise((resolve, reject) => {
    wand.request('address_initScanOTA', {}, function (err, res) {
      if (err) {
        console.log('Open OTA scanner failed:', err);
        return reject(err);
      } else {
        return resolve();
      }
    });
  })
}

export const stopScanOTA = function () {
  return new Promise((resolve, reject) => {
    wand.request('address_stopScanMultiOTA', {}, function (err, res) {
      if (err) {
        console.log('Stop OTA scanner failed:', err);
        return reject(err);
      } else {
        return resolve();
      }
    });
  })
}

export const stopSingleScan = function (path) {
  return new Promise((resolve, reject) => {
    wand.request('address_stopSingleScan', { path }, function (err, res) {
      if (err) {
        console.log('Stop single OTA scanner failed:', err);
        return reject(err);
      } else {
        return resolve();
      }
    });
  })
}

export const createFirstAddr = function (walletID, chainType, path, name) {
  return new Promise((resolve, reject) => {
    wand.request('address_getOne', { walletID, chainType, path }, (err, val_address_get) => {
      if (!err) {
        let meta = { name, addr: `0x${val_address_get.address}` };
        if (chainType === 'WAN') {
          meta.waddr = `0x${val_address_get.waddress}`.toLowerCase();
        }
        wand.request('account_create', { walletID, path, meta }, (err, val_account_create) => {
          if (!err && val_account_create) {
            let addressInfo;
            if (chainType === 'WAN') {
              addressInfo = {
                start: '0',
                address: web3.utils.toChecksumAddress(`0x${val_address_get.address}`),
                waddress: (`0x${val_address_get.waddress}`)
              }

              // Scan new account
              // if (scan_ota) {
              //   openScanOTA([[1, path]]);
              // }
            } else {
              addressInfo = {
                start: 0,
                address: web3.utils.toChecksumAddress(`0x${val_address_get.address}`)
              }
            }
            resolve(addressInfo);
          } else {
            reject(err);
          }
        });
      }
    });
  })
}

export const createWANAddr = async function (checkDuplicate) {
  let index = await getNewPathIndex(5718350, WANPATH, WALLETID.NATIVE);
  let path = `${WANPATH}${index}`;
  return new Promise((resolve, reject) => {
    wand.request('address_getOne', { walletID: WALLETID.NATIVE, chainType: 'WAN', path: path }, async (err, data) => {
      if (!err) {
        if (checkDuplicate instanceof Function && checkDuplicate(`0x${data.address}`)) {
          return reject(new Error('exist'));
        }
        let name = await getNewAccountName(5718350, 'WAN-Account');
        wand.request('account_create', { walletID: WALLETID.NATIVE, path: path, meta: { name, addr: `0x${data.address}`.toLowerCase(), waddr: `0x${data.waddress}`.toLowerCase() } }, (err, val_account_create) => {
          if (!err && val_account_create) {
            let addressInfo = {
              start: index.toString(),
              name,
              path,
              address: web3.utils.toChecksumAddress(`0x${data.address}`),
              waddress: wanUtil.toChecksumOTAddress(`0x${data.waddress}`),
            }
            resolve(addressInfo);
          } else {
            reject(err);
          }
        });
      } else {
        reject(err);
      }
    });
  })
}

export const createBTCAddr = function (btcPath, index, checkDuplicate) {
  let path = `${btcPath}${index}`;
  const CHAINID = btcPath === BTCPATH_MAIN ? BTCCHAINID.MAIN : BTCCHAINID.TEST;
  return new Promise((resolve, reject) => {
    wand.request('address_getOne', { walletID: WALLETID.NATIVE, chainType: 'BTC', path }, async (err_getOne, data) => {
      if (!err_getOne) {
        if (checkDuplicate instanceof Function && checkDuplicate(data.address)) {
          return reject(new Error('exist'));
        }
        let name = await getNewAccountName(CHAINID, 'BTC-Account');
        wand.request('account_create', { walletID: WALLETID.NATIVE, path, meta: { name, addr: data.address } }, (err, val_account_create) => {
          if (!err && val_account_create) {
            return resolve({
              start: index.toString(),
              name,
              address: data.address
            });
          } else {
            return reject(err);
          }
        });
      } else {
        return reject(err_getOne);
      }
    });
  })
}

export const createETHAddr = async function (checkDuplicate) {
  let CHAINID = 60;
  let index = await getNewPathIndex(CHAINID, ETHPATH, WALLETID.NATIVE);
  let path = `${ETHPATH}${index}`;
  return new Promise((resolve, reject) => {
    wand.request('address_getOne', { walletID: WALLETID.NATIVE, chainType: 'ETH', path }, async (err, data) => {
      if (!err) {
        if (checkDuplicate instanceof Function && checkDuplicate(`0x${data.address}`)) {
          return reject(new Error('exist'));
        }
        let name = await getNewAccountName(CHAINID, 'ETH-Account');
        wand.request('account_create', { walletID: WALLETID.NATIVE, path: path, meta: { name, addr: `0x${data.address}` } }, (err, val_account_create) => {
          if (!err && val_account_create) {
            let addressInfo = {
              start: index.toString(),
              name,
              address: web3.utils.toChecksumAddress(`0x${data.address}`)
            }
            resolve(addressInfo);
          } else {
            reject(err);
          }
        });
      } else {
        reject(err);
      }
    });
  })
}

export const createXRPAddr = async function (checkDuplicate) {
  let CHAINID = 144;
  let index = await getNewPathIndex(CHAINID, XRPPATH, WALLETID.NATIVE);
  let path = `${XRPPATH}${index}`;
  return new Promise((resolve, reject) => {
    wand.request('address_getOne', { walletID: WALLETID.NATIVE, chainType: 'XRP', path }, async (err, data) => {
      if (!err) {
        if (checkDuplicate instanceof Function && checkDuplicate(data.address)) {
          return reject(new Error('exist'));
        }
        let name = await getNewAccountName(CHAINID, 'XRP-Account');
        wand.request('account_create', { walletID: WALLETID.NATIVE, path: path, meta: { name, addr: data.address } }, (err, val_account_create) => {
          if (!err && val_account_create) {
            let addressInfo = {
              start: index.toString(),
              name,
              address: data.address
            }
            resolve(addressInfo);
          } else {
            reject(err);
          }
        });
      } else {
        reject(err);
      }
    });
  })
}

export const createEOSAddr = async function (checkDuplicate) {
  let CHAINID = 194;
  let index = await getNewPathIndex(CHAINID, EOSPATH, WALLETID.NATIVE);
  let path = `${EOSPATH}${index}`;
  return new Promise((resolve, reject) => {
    wand.request('address_getOne', { walletID: WALLETID.NATIVE, chainType: 'EOS', path }, async (err, data) => {
      if (!err) {
        if (checkDuplicate instanceof Function && checkDuplicate(data.address)) {
          return reject(new Error('exist'));
        }
        let name = await getNewAccountName(CHAINID, 'EOS-PublicKey');
        wand.request('account_create', { walletID: WALLETID.NATIVE, path, meta: { name, publicKey: data.address } }, (err, val_account_create) => {
          if (!err && val_account_create) {
            let addressInfo = {
              publicKey: data.address,
              path: data.path,
              name
            }
            resolve(addressInfo);
          } else {
            return reject(err);
          }
        });
      } else {
        reject(err);
      }
    });
  })
}

export const btcCoinSelect = function (utxos, value, feeRate) {
  return new Promise((resolve, reject) => {
    wand.request('address_btcCoinSelect', { utxos, value, feeRate }, (err, data) => {
      if (err) {
        console.log('btcCoinSelect: ', err)
        return reject(err);
      } else {
        return resolve(data);
      }
    });
  });
}

export const btcCoinSelectSplit = function (utxos, to, feeRate) {
  return new Promise((resolve, reject) => {
    wand.request('address_btcCoinSelectSplit', { utxos, to, feeRate }, (err, data) => {
      if (err) {
        console.log('btcCoinSelectSplit: ', err)
        return reject(err);
      } else {
        return resolve(data);
      }
    });
  });
}

export const getPathFromUtxos = function (utxos, addrInfo, btcPath) {
  let fromArr = [];
  let addresses = new Set(utxos.map(item => item.address));
  addresses.forEach(item => {
    fromArr.push({
      walletID: addrInfo.normal[item] ? 1 : 6,
      path: `${btcPath}${addrInfo.normal[item] ? addrInfo.normal[item].path : addrInfo.rawKey[item].path}`
    });
  });
  return fromArr;
}

export const getNormalPathFromUtxos = function (utxos, addrInfo, btcPath) {
  let fromArr = [];
  let addresses = new Set(utxos.map(item => item.address));
  addresses.forEach(item => {
    if (addrInfo.normal[item]) {
      fromArr.push({
        walletID: 1,
        path: `${btcPath}${addrInfo.normal[item].path}`
      });
    }
  });
  return fromArr;
}

export const getFullChainName = function (chainType = '') {
  switch (chainType.toUpperCase()) {
    case 'WAN':
      return intl.get('Common.wanchain');
    case 'ETH':
      return intl.get('Common.ethereum');
    case 'BTC':
      return intl.get('Common.bitcoin');
    case 'EOS':
      return intl.get('Common.eos');
    case 'XRP':
      return intl.get('Common.xrpl');
    case 'BNB':
      return intl.get('Common.bsc');
  }
}

export const getSplitAmountToArray = function (amount) {
  let collections = {};
  let current = amount;
  PRIVATE_TX_AMOUNT_SELECTION.forEach(item => {
    if (new BigNumber(current).gte(item)) {
      collections[item] = new BigNumber(current).idiv(item).toNumber();
      current = new BigNumber(current).mod(item);
    }
  });
  return collections;
}

export const checkEosPublicKey = function (address) {
  return new Promise((resolve, reject) => {
    wand.request('address_isEosPublicKey', { address }, (err, val) => {
      if (err) {
        console.log('Failed to check WAN address ', err);
        return reject(err);
      } else {
        return resolve(val);
      }
    })
  })
};

export const checkEosNameExist = function (address) {
  return new Promise((resolve, reject) => {
    wand.request('address_isEosNameExist', { name: address }, (err, val) => {
      if (err) {
        console.log('Check EOS name failed ', err);
        return reject(err);
      } else {
        return resolve(val);
      }
    })
  })
};

export const getWalletIdByType = function (type) {
  let ID
  switch (type) {
    case 'normal':
      ID = WALLETID.NATIVE;
      break;
    case 'ledger':
      ID = WALLETID.LEDGER;
      break;
    case 'trezor':
      ID = WALLETID.TREZOR;
      break;
    case 'import':
      ID = WALLETID.KEYSTOREID;
      break;
    case 'rawKey':
      ID = WALLETID.RAWKEY;
      break;
  }
  return ID;
}

export const getTypeByWalletId = function (wid) {
  let type
  switch (wid) {
    case WALLETID.NATIVE:
      type = 'normal';
      break;
    case WALLETID.LEDGER:
      type = 'ledger';
      break;
    case WALLETID.TREZOR:
      type = 'trezor';
      break;
    case WALLETID.KEYSTOREID:
      type = 'import';
      break;
    case WALLETID.RAWKEY:
      type = 'rawKey';
      break;
  }
  return type;
}

export const getNewPathIndex = function (chainID, pathForm, walletID) {
  return new Promise((resolve, reject) => {
    wand.request('address_getNewPathIndex', { chainID, pathForm, walletID }, (err, index) => {
      if (err) {
        console.log(`Get new path index failed`, err)
        return reject(err)
      } else {
        return resolve(index);
      }
    })
  })
}

export const getNewAccountName = function (chainID, prefix) {
  return new Promise((resolve, reject) => {
    wand.request('address_getNewNameForNativeAccount', { chainID, prefix }, (err, name) => {
      if (err) {
        console.log(`Get new name failed`, err)
        return reject(err)
      } else {
        return resolve(name);
      }
    })
  })
}

export const dAppSort = function (dapps, ordering, orderList) {
  let newList;
  switch (ordering) {
    case orderList[0]:
      newList = dapps.slice().sort((a, b) => a.name.localeCompare(b.name));
      break;
    case orderList[1]:
      newList = dapps.slice().sort((a, b) => b.updatedAt - a.updatedAt);
      break;
    default:
      newList = dapps;
      break;
  }
  return newList;
}

export const isValidPrivateKey = function (key, type) {
  return new Promise((resolve, reject) => {
    wand.request('address_isValidPrivateKey', { key, type }, (err, res) => {
      if (err) {
        return resolve(false);
      } else {
        return resolve(res);
      }
    })
  })
}

export const getChainInfoByChainId = function (chainId) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getChainInfoByChainId', { chainId }, (err, res) => {
      if (err) {
        return resolve(false);
      } else {
        return resolve(res);
      }
    })
  })
}

export const getMintQuota = function (chainType, tokenPairID, storemanGroupID) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getMintQuota', { chainType, tokenPairID, storemanGroupID }, (err, res) => {
      if (err) {
        return resolve(false);
      } else {
        return resolve(res);
      }
    })
  })
}

export const getBurnQuota = function (chainType, tokenPairID, storemanGroupID) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getBurnQuota', { chainType, tokenPairID, storemanGroupID }, (err, res) => {
      if (err) {
        return resolve(false);
      } else {
        return resolve(res);
      }
    })
  })
}

export const getQuota = function (chainType, groupId, symbolArray, options) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getQuota', { chainType, groupId, symbolArray, options }, (err, res) => {
      // console.log('getQuota:', err, res, options)
      if (err) {
        return reject(new Error('get quota failed'));
      } else {
        return resolve(res);
      }
    })
  })
}

export const checkAddressByChainType = async (address, chain) => {
  let valid = false;
  switch (chain) {
    case 'WAN':
      valid = await checkWanAddr(address);
      break;
    case 'ETH':
      valid = await checkETHAddr(address);
      break;
    case 'BTC':
      valid = await checkBTCAddr(address);
      break;
    case 'EOS':
      try {
        valid = await checkEosNameExist(address);
      } catch (e) {
        valid = false;
      }
      break;
    default:
      valid = false;
  }
  return valid;
}

export const getFastMinCount = (chainType, tokenPairID) => {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getFastMinCount', { chainType, tokenPairID }, (err, res) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(res);
      }
    })
  });
}

export const estimateCrossChainNetworkFee = (chainType, dstChainType, options) => {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_estimateCrossChainNetworkFee', { chainType, dstChainType, options }, (err, res) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(res);
      }
    })
  });
}

export const estimateCrossChainOperationFee = (chainType, dstChainType, options) => {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_estimateCrossChainOperationFee', { chainType, dstChainType, options }, (err, res) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(res);
      }
    })
  });
}

export const getFees = (chainType, chainID1, chainID2) => {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getFees', { chainType, chainID1, chainID2 }, (err, res) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(res);
      }
    })
  });
}

export const estimateSmartFee = chainType => {
  return new Promise((resolve, reject) => {
    wand.request('transaction_estimateSmartFee', { chainType }, (err, res) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(res);
      }
    })
  });
}

export const resetSettingsByOptions = (attrs) => {
  return new Promise((resolve, reject) => {
    wand.request('setting_resetSettingsByOptions', { attrs }, (err, res) => {
      if (err) {
        return reject(err);
      } else {
        return resolve(true);
      }
    })
  });
}

export const getCrossChainContractData = function (param) {
  return new Promise((resolve, reject) => {
    wand.request('crossChain_getCrossChainContractData', param, (err, ret) => {
      console.log('CC data:', err, ret);
      if (err) {
        return reject(err);
      } else {
        if (ret.code) {
          return resolve(ret);
        } else {
          return resolve(false);
        }
      }
    })
  })
};

export const convertCrossChainTxErrorText = (text) => {
  if (text === 'insufficient funds for gas * price + value') {
    return intl.get('Common.sendFailedForInsufficientFunds');
  } else {
    return text;
  }
}

export const getStoremanAddrByGpk1 = function (gpk) {
  if (!gpk) {
    return null
  }
  const Secp256k1 = elliptic.ec('secp256k1');
  const pubkey = Secp256k1.keyFromPublic('04' + gpk.slice(2), 'hex');
  const compressed = pubkey.getPublic(true, 'hex');
  return keypairs.deriveAddress(compressed.toUpperCase())
}

export const estimateGasForNormalTrans = function (param) {
  return new Promise((resolve, reject) => {
    param.isSend = false;
    wand.request('transaction_normal', param, (err, ret) => {
      if (err) {
        resolve(false);
      } else {
        if (ret.code) {
          resolve({
            data: ret.result.data,
            gas: (ret.result || {}).estimateGas || false
          });
        } else {
          resolve(false);
        }
      }
    });
  });
};

export const converter = function (str, from = 'utf8', to = 'hex') {
  return new Promise((resolve, reject) => {
    wand.request('transaction_converter', { str, from, to }, (err, ret) => {
      if (err) {
        resolve(false);
      } else {
        resolve(ret);
      }
    });
  });
}

export const checkAddrByCT4Contacts = async (address, chain) => {
  let valid = false;
  try {
    switch (chain) {
      case 'Wanchain':
        valid = await checkToWanAddr(address);
        break;
      case 'Ethereum':
        valid = await checkETHAddr(address);
        break;
      case 'Bitcoin':
        valid = await checkBTCAddr(address);
        break;
      case 'EOS':
        valid = await checkEosNameExist(address);
        break;
      case 'XRPL':
        valid = await checkXRPAddr(address);
        valid = valid[0] || valid[1];
        break;
      case 'BSC':
        valid = await checkETHAddr(address);
        break;
      default:
        valid = false;
    }
  } catch (e) {
    valid = false;
  }
  return valid;
}

export const checkToWanAddr = (address) => {
  return new Promise((resolve, reject) => {
    Promise.all([checkWanAddr(address), checkETHAddr(address)]).then(results => {
      if (results[0] || results[1]) {
        resolve(true);
      } else {
        resolve(false);
      }
    }).catch(() => {
      resolve(false);
    });
  });
}

export const getHashKey = (key) => {
  let kBuf = Buffer.from(key, 'utf8');
  let h = keccak('keccak256');
  h.update(kBuf);
  let hashKey = h.digest('hex');
  return hashKey;
}
