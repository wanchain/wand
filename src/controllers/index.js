import fs from 'fs';
import _ from 'lodash';
import path from 'path';
import Web3 from 'web3';
import keccak from 'keccak';
import fsExtra from 'fs-extra';
import wanUtil from 'wanchain-util';
import Identicon from 'identicon.js';
import BigNumber from 'bignumber.js';
import bs58check from 'bs58check';
import { ipcMain as ipc, app } from 'electron';
import { hdUtil, ccUtil, btcUtil } from 'wanchain-js-sdk';
import sleep from 'ko-sleep';
import Logger from '~/src/utils/Logger';
import setting from '~/src/utils/Settings';
import contacts from '~/src/utils/Contacts';
import { dateFormat } from '~/src/app/utils/support';
import { Windows, walletBackend } from '~/src/modules';
import menuFactoryService from '~/src/services/menuFactory';

const web3 = new Web3();
const ethUtil = require('ethereumjs-util');
const logger = Logger.getLogger('controllers');
const COIN_ACCOUNT = '0x0000000000000000000000000000000000000000';

// route consts
const ROUTE_PHRASE = 'phrase';
const ROUTE_WALLET = 'wallet';
const ROUTE_ADDRESS = 'address';
const ROUTE_ACCOUNT = 'account';
const ROUTE_TX = 'transaction';
const ROUTE_QUERY = 'query';
const ROUTE_STAKING = 'staking';
const ROUTE_CROSSCHAIN = 'crossChain';
const ROUTE_DAPPSTORE = 'dappStore';
const ROUTE_SETTING = 'setting';
const ROUTE_CONTACTS = 'contact';
const ROUTE_STOREMAN = 'storeman';

// db collection consts
const DB_NORMAL_COLLECTION = 'normalTrans';
const DB_BTC_COLLECTION = 'crossTransBtc';

// wallet path consts
const WANBIP44Path = "m/44'/5718350'/0'/0/";

// chain ID consts
const WAN_ID = 5718350;
const network = setting.get('network');

const WALLET_ID_NATIVE = 0x01;   // Native WAN HD wallet
const WALLET_ID_LEDGER = 0x02;
const WALLET_ID_TREZOR = 0x03;
const WALLET_ID_KEYSTORE = 0x05;
const WALLET_ID_RAWKEY = 0x06;

const NETWORK_SLOW = 200;  // If network delay large than 200ms it shows Good.

ipc.on(ROUTE_PHRASE, (event, actionUni, payload) => {
    let err, phrase, ret
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'generate':
            try {
                phrase = hdUtil.generateMnemonic(payload.pwd)

            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_PHRASE, [action, id].join('#')].join('_'), event, { err: err, data: phrase })

            break
        case 'has':
            try {
                ret = hdUtil.hasMnemonic()
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_PHRASE, [action, id].join('#')].join('_'), event, { err: err, data: ret })

            break
        case 'reveal':
            try {
                phrase = hdUtil.revealMnemonic(payload.pwd)

            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_PHRASE, [action, id].join('#')].join('_'), event, { err: err, data: phrase })

            break
        case 'checkPwd':
            try {
                hdUtil.revealMnemonic(payload.pwd)

            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_PHRASE, [action, id].join('#')].join('_'), event, { err: err, data: null })

            break
        case 'import':
            try {
                ret = hdUtil.importMnemonic(payload.phrase, payload.pwd)
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_PHRASE, [action, id].join('#')].join('_'), event, { err: err, data: !!ret })
            break

        case 'reset':
            try {
                fsExtra.removeSync(path.join(setting.userDataPath, 'Db'))
                fsExtra.removeSync(path.join(setting.userDataPath, 'config.json'))
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            app.relaunch()
            app.exit(0)

            break
    }
})

ipc.on(ROUTE_WALLET, async (event, actionUni, payload) => {
    let err
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'lock':
            try {
                hdUtil.deleteHDWallet()
                hdUtil.deleteKeyStoreWallet()
                hdUtil.deleteRawKeyWallet()
                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: true })

            } catch (e) {
                logger.error(e.message || e.stack)
                err = e

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: false })
            }

            break
        case 'unlock':
            let phrase
            try {
                phrase = hdUtil.revealMnemonic(payload.pwd);
                hdUtil.initializeHDWallet(phrase);
                // create key file wallet
                hdUtil.newKeyStoreWallet(payload.pwd);
                // create raw key wallet
                hdUtil.newRawKeyWallet(payload.pwd);
                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: true });
            } catch (e) {
                logger.error(e.message || e.stack);
                err = e;
                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: false });
            }
            break

        case 'checkUpdateDB':
            try {
                // if the user db is not the newest version, update user db
                const dbVersion = hdUtil.getUserTableVersion();
                const latestVersion = walletBackend.config.dbExtConf.userTblVersion;
                let data = true;
                if (dbVersion !== latestVersion) {
                    data = dbVersion
                }
                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: data })
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: false })
            }

            break

        case 'getPubKeyChainId':
            {
                let { walletID, path } = payload
                let pubKey

                try {
                    pubKey = await hdUtil.getWalletSafe().getWallet(walletID).getPublicKey(path, true)
                } catch (e) {
                    logger.error('getPubKeyChainId failed:')
                    logger.error(e.message || e.stack)
                    err = e
                }

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: pubKey })
                break
            }

        case 'getPubKey':
            {
                let pubKey

                try {
                    pubKey = await hdUtil.getWalletSafe().getWallet(payload.walletID).getPublicKey(payload.path)
                } catch (e) {
                    logger.error('getPubKey failed:')
                    logger.error(e.message || e.stack)
                    err = e
                }

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: pubKey })
                break
            }

        case 'isConnected':
            {
                let ret = false;
                try {
                    hdUtil.getWalletSafe().getWallet(payload.walletID);
                    ret = true;
                } catch (e) {
                    ret = false
                }

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: ret })
                break
            }
        case 'signPersonalMessage':
            {
                let ret = null;
                let { walletID, path, rawTx } = payload;

                let hdWallet = hdUtil.getWalletSafe().getWallet(walletID);

                logger.info('Sign signPersonalMessage:');
                logger.info('wallet ID:' + walletID + ', path:' + path + ', raw:' + rawTx);

                if (hdWallet) {
                    try {
                        ret = await hdWallet.signMessage(path, ethUtil.toBuffer(rawTx));
                    } catch (e) {
                        logger.error(e.message || e.stack);
                        console.log('hdWallet.signMessage error:', e);
                        err = e
                    }
                } else {
                    err = new Error('Can not found wallet.');
                    console.log('hdWallet is undefine');
                }

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: ret })
                break
            }
        case 'signTx': // new added for wanswap inside
            {
                let sig = {};
                let { walletID, path, rawTx } = payload;

                logger.info('Sign transaction:');
                logger.info('wallet ID:' + walletID + ', path:' + path + ', raw:' + rawTx);
                const chain = hdUtil.getChain('WAN');
                let ret = await chain.signTransaction(walletID, rawTx, path);
                sig = '0x' + ret.toString('hex');
                console.log('sig', sig);

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: sig })
                break
            }

        case 'signTransaction':
            {
                let sig = {};
                let { walletID, path, rawTx } = payload;
                let hdWallet = hdUtil.getWalletSafe().getWallet(walletID);

                try {
                    let ret = await hdWallet.sec256k1sign(path, rawTx);
                    sig.r = '0x' + ret.r.toString('hex');
                    sig.s = '0x' + ret.s.toString('hex');
                    sig.v = '0x' + ret.v.toString('hex');
                } catch (e) {
                    logger.error(e.message || e.stack)
                    err = e
                }

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: sig })
                break
            }

        case 'connectToLedger':
            let data = false;
            try {
                await hdUtil.connectToLedger()
                data = true;
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: data })
            break

        case 'deleteLedger':
            {
                try {
                    await hdUtil.disconnectLedger()
                } catch (e) {
                    logger.error(e.message || e.stack)
                    err = e
                }

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: true })
                break
            }

        case 'setUserTblVersion':
            try {
                const latestVersion = walletBackend.config.dbExtConf.userTblVersion;// get version from config.js file
                logger.info('Set user DB version:' + latestVersion);
                hdUtil.setUserTableVersion(latestVersion);
                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: true })
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err: err, data: false })
            }

            break

        case 'reboot':
            try {
                app.relaunch()
                app.exit(0)
            } catch (e) {
                logger.error('Reboot failed: ' + e.message || e.stack)
            }
            break

        case 'exportPrivateKeys':
            let privateKeys;
            try {
                privateKeys = await hdUtil.exportPrivateKeys(payload.wid, payload.chainType, payload.path)
                privateKeys.forEach((item, index) => {
                    switch (payload.chainType) {
                        case 'EOS':
                            privateKeys[index] = ccUtil.toPrivateAddress(Buffer.from(item, 'hex'));
                            break;
                        case 'BTC':
                            privateKeys[index] = btcUtil.convertPrivateKey_Hex2WIFCompressed(item.toString('hex'), network !== 'main');
                            break;
                        default:
                            privateKeys[index] = item.toString('hex');
                            break;
                    }
                })
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err, data: privateKeys })
            break

        case 'importPrivateKey':
            {
                let ret;
                try {
                    let { pk, pk2, type } = payload;
                    let wid = WALLET_ID_RAWKEY;
                    let chainID = getPathIdByType(type.toUpperCase(), network !== 'main');
                    let rawPriv = (type === 'BTC' || type === 'EOS') ? btcUtil.getHexByPrivateKey(pk) : Buffer.from(pk, 'hex');
                    let address = await hdUtil.getAddressByPrivateKey(wid, type.toUpperCase(), rawPriv);
                    let existAddress = await hdUtil.checkIsExist(((type === 'ETH' || type === 'WAN') ? `0x${address}` : address), chainID);
                    if (!existAddress) {
                        let pathForm = `m/44'/${chainID}'/0'/0/`;
                        let isValidAddress = false;
                        let index = hdUtil.getNewPathIndexByChainID(chainID, pathForm, WALLET_ID_RAWKEY);
                        let newPath = `${pathForm}${index}`;
                        let accountName = hdUtil.getNewNameForImportedAccount(chainID, 'Imported', wid);

                        hdUtil.importPrivateKey(newPath, rawPriv);

                        if (pk2 !== undefined) {
                            let rawPriv2;
                            if (pk2.length === 0) {
                                rawPriv2 = ccUtil.createPrivateKey();
                            } else {
                                rawPriv2 = Buffer.from(pk2, 'hex');
                            }
                            let pathForm2 = `m/44'/${chainID}'/0'/1/`;
                            hdUtil.importPrivateKey(`${pathForm2}${index}`, rawPriv2);
                        }

                        let addr = await hdUtil.getAddress(wid, type, newPath);
                        let paramsObj1 = {};
                        let paramsObj2 = {};
                        switch (type) {
                            case 'BTC':
                                try {
                                    bs58check.decode(addr.address);
                                    isValidAddress = true;
                                    paramsObj1 = { name: accountName, addr: addr.address }
                                    paramsObj2 = { type, path: index, name: accountName, addr: addr.address }
                                } catch (e) {
                                    isValidAddress = false;
                                }
                                break;
                            case 'WAN':
                                isValidAddress = await ccUtil.isWanAddress(`0x${addr.address}`);
                                if (typeof (addr.waddress) !== 'string' || wanUtil.toChecksumOTAddress(addr.waddress) === '') {
                                    isValidAddress = false;
                                }
                                paramsObj1 = { name: accountName, addr: `0x${addr.address}`, waddr: `0x${addr.waddress}` }
                                paramsObj2 = { type, path: index, name: accountName, addr: `0x${addr.address}`, waddr: `0x${addr.waddress}` }
                                break;
                            case 'ETH':
                                isValidAddress = await ccUtil.isEthAddress(`0x${addr.address}`);
                                paramsObj1 = { name: accountName, addr: `0x${addr.address}` }
                                paramsObj2 = { type, path: index, name: accountName, addr: `0x${addr.address}` }
                                break;
                            case 'EOS':
                                isValidAddress = await ccUtil.isEosPublicKey(addr.pubKey);
                                paramsObj1 = { name: accountName, publicKey: addr.address }
                                paramsObj2 = { type, path: newPath, name: accountName, publicKey: addr.address }
                                break;
                            case 'XRP':
                                isValidAddress = await ccUtil.isXrpAccount(addr.address);
                                paramsObj1 = { name: accountName, addr: addr.address }
                                paramsObj2 = { type, path: newPath, name: accountName, addr: addr.address }
                                break;
                        }
                        if (isValidAddress) {
                            hdUtil.createUserAccount(wid, newPath, paramsObj1);
                            Windows.broadcast('notification', 'importPrivateKey', paramsObj2);
                            if (type === 'BTC') {
                                ccUtil.btcImportAddress(addr.address);
                            }
                            // if (type === 'WAN' && setting.get('settings').scan_ota) {
                            //     ccUtil.scanOTA(wid, newPath);
                            // }
                            ret = {
                                status: true,
                                data: addr.address
                            };
                        } else {
                            ret = {
                                status: false,
                            };
                        }
                    } else {
                        ret = {
                            status: false,
                            message: 'sameAddress'
                        };
                    }
                } catch (e) {
                    logger.error('importPrivateKey failed:')
                    logger.error(e.message || e.stack)
                    err = e
                }

                sendResponse([ROUTE_WALLET, [action, id].join('#')].join('_'), event, { err, data: ret });
            }
            break;

    }
})

ipc.on(ROUTE_ADDRESS, async (event, actionUni, payload) => {
    let err, address, nonce
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'get':
            try {
                address = await hdUtil.getAddress(payload.walletID, payload.chainType, payload.start, payload.end)
            } catch (e) {
                logger.error('Get address failed: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: address })
            break

        case 'getOne':
            try {
                address = await hdUtil.getAddress(payload.walletID, payload.chainType, payload.path)
            } catch (e) {
                logger.error('Get one address failed: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: address })
            break

        case 'getNewPathIndex':
            let index;
            try {
                const { chainID, pathForm, walletID } = payload;
                index = await hdUtil.getNewPathIndexByChainID(chainID, pathForm, walletID);
            } catch (e) {
                logger.error('Get new path index failed: ' + e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: index })
            break

        case 'getNewNameForNativeAccount':
            let name;
            try {
                const { chainID, prefix } = payload;
                name = hdUtil.getNewNameForNativeAccount(chainID, prefix);
            } catch (e) {
                logger.error('Get new name for native account failed: ' + e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: name })
            break

        case 'getNonce':
            try {
                logger.info('getNonce called');
                nonce = await ccUtil.getNonce(payload.addr, payload.chainType, payload.includePending)
                logger.info('Nonce: ' + payload.addr + ',' + nonce);
            } catch (e) {
                logger.error('getNonce failed:')
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: nonce })
            break
        case 'balance':
            let balance
            const { addr, chainType } = payload
            try {
                if (_.isArray(addr) && addr.length > 1) {
                    let addresses = ['XRP'].includes(chainType) ? addr : addr.map(item => `0x${item}`);
                    balance = await ccUtil.getMultiBalances(addresses, chainType)
                } else {
                    let address = ['XRP'].includes(chainType) ? addr[0] : `0x${addr}`;
                    balance = await ccUtil.getBalance(address, chainType);
                    balance = { [address]: balance }
                }
            } catch (e) {
                logger.error('Failed to get balance:', e);
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: balance })
            break

        case 'getAllBalances':
          try {
              const { chainType, address, options } = payload;
              ret = await ccUtil.getAllBalances(chainType, address, options);
          } catch (e) {
              logger.error('Get getAllBalances failed');
              logger.error(e.message || e.stack)
              err = e
          }

          sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break

        case 'getServerInfo':
          try {
              const { chainType } = payload;
              ret = await ccUtil.getServerInfo(chainType);
          } catch (e) {
              logger.error('Get getServerInfo failed');
              logger.error(e.message || e.stack)
              err = e
          }

          sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break

        case 'btcImportAddress':
            try {
                ret = await ccUtil.btcImportAddress(payload.address);
            } catch (e) {
                logger.error('Get btcImportAddress failed');
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getBtcMultiBalances':
            let utxos;
            let btcMultiBalances = {};
            try {
                utxos = await ccUtil.getBtcUtxo(payload.minconf, payload.maxconf, payload.addresses);
                utxos.forEach(item => {
                    if (btcMultiBalances[item.address]) {
                        let balance = btcMultiBalances[item.address];
                        btcMultiBalances[item.address] = new BigNumber(balance).plus(item.value).toString();
                    } else {
                        btcMultiBalances[item.address] = item.value
                    }
                });
                payload.addresses.forEach(item => {
                    if (!btcMultiBalances[item]) {
                        btcMultiBalances[item] = '0'
                    }
                });
                ret = {
                    utxos,
                    btcMultiBalances
                };
            } catch (e) {
                logger.error('getBtcMultiBalances failed:' + e)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'btcCoinSelect':
            try {
                let { utxos, value, minConfParam, feeRate } = payload;
                ret = await ccUtil.btcCoinSelect(utxos, value * Math.pow(10, 8), feeRate, minConfParam);
            } catch (e) {
                logger.error('btcCoinSelect failed:')
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'btcCoinSelectSplit':
            try {
                let { utxos, to: target, feeRate } = payload;
                ret = await ccUtil.btcCoinSelectSplit(utxos, target, feeRate);
            } catch (e) {
                logger.error('btcCoinSelectSplit failed:')
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getEosAccountInfo':
            let obj = {};
            try {
                const { accounts } = payload;
                let [...eosAccountInfo] = await Promise.all(accounts.map(v => ccUtil.getEosAccountInfo(v)));
                accounts.forEach((v, i) => {
                    obj[v] = eosAccountInfo[i];
                });
            } catch (e) {
                logger.error('getEosAccountInfo failed:')
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: obj })
            break

        case 'getEOSResourcePrice':
            try {
                const { account } = payload;
                ret = await ccUtil.getResourcePrice('EOS', account);
            } catch (e) {
                logger.error('getEOSResourcePrice failed:')
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getRamPrice':
            try {
                ret = await ccUtil.getRamPrice('EOS');
            } catch (e) {
                logger.error('getRamPrice failed:')
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'balances':
            {
                let balance, privateBalance;
                const { addr, path } = payload;
                try {
                    //private balance
                    let [...result] = await Promise.all(path.map(v => {
                        return new Promise((resolve, reject) => {
                            let OTABalances = ccUtil.getOtaFunds(v[0], v[1]);
                            let amount = 0;
                            OTABalances.forEach(v => {
                                amount = new BigNumber(amount).plus(new BigNumber(v.value));
                            });
                            resolve({
                                [v[2]]: amount.toString(10)
                            });
                        });
                    }));
                    privateBalance = Object.assign({}, ...result);

                    //normal balance
                    if (addr) {
                        if (_.isArray(addr) && addr.length > 1) {
                            const addresses = addr.map(item => `0x${item}`)
                            balance = await ccUtil.getMultiBalances(addresses, 'WAN')
                        } else {
                            balance = await ccUtil.getBalance(`0x${addr}`, 'WAN')
                            balance = { [`0x${addr}`]: balance }
                        }
                    } else {
                        balance = {};
                    }

                } catch (e) {
                    logger.error('balances failed');
                    logger.error(e);
                    logger.error(e.message || e.stack)
                    err = e
                }

                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: { balance, privateBalance } })
            }
            break

        case 'getPrivateTxInfo':
            {
                const { wid, path } = payload;
                let res;
                try {
                    res = await new Promise((resolve, reject) => {
                        let OTABalances = ccUtil.getOtaFunds(wid, path);
                        resolve(OTABalances);
                    });
                } catch (e) {
                    logger.error('getPrivateTxInfo failed:')
                    logger.error(e.message || e.stack)
                    err = e
                }
                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: res })
            }
            break;

        case 'scanMultiOTA':
            {
                try {
                    const { path } = payload;
                    if (path.length > 0) {
                        path.forEach((v) => {
                            ccUtil.scanOTA(v[0], v[1]);
                        });
                    }
                } catch (e) {
                    logger.error('scanMultiOTA failed:')
                    logger.error(e.message || e.stack)
                    err = e
                }
                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: { status: 'Opened' } })
            }
            break

        case 'stopScanMultiOTA':
            {
                try {
                    ccUtil.stopCheckAcctsScan();
                } catch (e) {
                    logger.error('stopScanMultiOTA failed:')
                    logger.error(e.message || e.stack)
                    err = e
                }
                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: { status: 'Opened' } })
            }
            break

        case 'stopSingleScan':
            {
                try {
                    const { path } = payload;
                    if (path.length > 0) {
                        path.forEach((v) => {
                            ccUtil.stopSingleScan(v[0], v[1]);
                        });
                    }
                } catch (e) {
                    logger.error('stopSingleScan failed:')
                    logger.error(e.message || e.stack)
                    err = e
                }
                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: { status: 'Opened' } })
            }
            break
          
        case 'initScanOTA':
          {
              try {
                  ccUtil.initScanOTA();
              } catch (e) {
                  logger.error('initScanOTA failed:')
                  logger.error(e.message || e.stack)
                  err = e
              }
              sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: { status: 'Opened' } })
          }
          break

        case 'isWanAddress':
            let ret;
            try {
                ret = await ccUtil.isWanAddress(payload.address);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'isEthAddress':
            let ret1;
            try {
                ret1 = await ccUtil.isEthAddress(payload.address);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret1 })
            break

        case 'isXrpAddress':
            let isXrpAddress;
            try {
                isXrpAddress = await ccUtil.isXrpAccount(payload.address);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err, data: isXrpAddress })
            break

        case 'isValidatorAddress':
            try {
                ret = await ccUtil.isWanAddress(payload.address);
                let info = await ccUtil.getValidatorInfo('wan', payload.address);

                if (!info || info.feeRate == 10000) {
                    ret = false;
                }
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'isEosPublicKey':
            {
                let ret;
                try {
                    ret = await ccUtil.isEosPublicKey(payload.address);
                } catch (e) {
                    logger.error(e.message || e.stack)
                    err = e
                }

                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            }
            break

        case 'isEosNameExist':
            {
                let ret;
                try {
                    ret = await ccUtil.checkEosAccountExists(payload.name);
                } catch (e) {
                    logger.error(e.message || e.stack)
                    err = e
                }

                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            }
            break

        case 'fromKeyFile':
            const { keyFilePwd, hdWalletPwd, keyFilePath } = payload;
            const keyFileContent = fs.readFileSync(keyFilePath).toString();
            const keyStoreObj = JSON.parse(keyFileContent)
            const checkDuplicate = true;
            try {
                let pathForm = `m/44'/${WAN_ID}'/0'/0/`;
                let path = hdUtil.getNewPathIndexByChainID(WAN_ID, pathForm, WALLET_ID_KEYSTORE);
                let accountName = hdUtil.getNewNameForImportedAccount(WAN_ID, 'Imported');
                let addr = `0x${keyStoreObj.address}`.toLowerCase();
                let waddr = `0x${keyStoreObj.waddress}`.toLowerCase();

                hdUtil.importKeyStore(`${WANBIP44Path}0`, keyFileContent, keyFilePwd, hdWalletPwd, checkDuplicate);
                hdUtil.createUserAccount(5, `${WANBIP44Path}${path}`, { name: accountName, addr, waddr });
                Windows.broadcast('notification', 'keyfilepath', { path, name: accountName, addr: wanUtil.toChecksumAddress(addr), waddr: wanUtil.toChecksumOTAddress(waddr) });
                // if (setting.get('settings').scan_ota) {
                //   ccUtil.scanOTA(5, `${WANBIP44Path}${path}`);
                // }
                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: true })
            } catch (e) {
                console.log('e:', e);
                logger.error(e.message || e.stack)
                err = e

                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: false })
            }

            break

        case 'getKeyStoreCount':
            let count;
            try {
                count = hdUtil.getKeyStoreCount(WAN_ID);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err: err, data: count })
            break

        case 'isValidPrivateKey':
            {
                let ret;
                try {
                    let { key, type } = payload;
                    let rawPriv = (type === 'BTC' || type === 'EOS') ? btcUtil.getHexByPrivateKey(key) : Buffer.from(key, 'hex');
                    ret = type === 'XRP' ? true : ethUtil.isValidPrivate(rawPriv);
                    // TODO: choose ecdsa-secp256k1 (default) or ed25519.
                    // ccUtil.isValidXRPSecret(key)
                } catch (e) {
                    console.log('isValidPrivateKey Error:', e);
                    logger.error(e.message || e.stack);
                    // err = e;
                    ret = false;
                }
                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err, data: ret });
            }
            break;

        case 'getRegisteredCoinGecko':
            {
                let ret;
                try {
                    let { symbol } = payload;
                    ret = await ccUtil.getRegisteredCoinGecko({ symbol });
                } catch (e) {
                    console.log('getRegisteredCoinGecko Error:', e);
                    logger.error(e.message || e.stack);
                    err = e;
                }
                sendResponse([ROUTE_ADDRESS, [action, id].join('#')].join('_'), event, { err, data: ret });
            }
            break;

    }
})

ipc.on(ROUTE_ACCOUNT, async (event, actionUni, payload) => {
    let err, ret;
    const [action, id] = actionUni.split('#');
    switch (action) {
        case 'create':
            try {
                ret = hdUtil.createUserAccount(payload.walletID, payload.path, payload.meta)
            } catch (e) {
                logger.error('Create account failed: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'get':
            try {
                ret = hdUtil.getUserAccount(payload.walletID, payload.path)
            } catch (e) {
                logger.error('Get account failed: ' + e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getAllAccounts':
            try {
                ret = ccUtil.getEosAccounts();
            } catch (e) {
                logger.error('Get all accounts failed: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'hasHackerAccount':
            try {
                ret = await ccUtil.hasHackerAccount(payload.address);
            } catch (e) {
                logger.error('hasHackerAccount: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getAll':
            try {
                ret = hdUtil.getUserAccountForChain(payload.chainID)
            } catch (e) {
                logger.error('Get all accounts failed: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getImportedAccountsByPublicKey':
            try {
                const { chainID, pubKey, wids } = payload;
                ret = hdUtil.getImportAccountsByPubKeyForChain(network, chainID, pubKey, wids);
            } catch (e) {
                logger.error('Get all accounts failed: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'deleteEOSImportedAccounts':
            try {
                const { accounts } = payload;
                ret = hdUtil.deleteEOSImportedUserAccounts(accounts, network, 194)
            } catch (e) {
                logger.error('Get all accounts failed: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'update':
            try {
                ret = hdUtil.updateUserAccount(payload.walletID, payload.path, payload.meta)
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'setImportedUserAccounts':
            try {
                const { network, wid, path, accounts, pubKey } = payload;
                let [...ret] = await Promise.all(accounts.map(v => hdUtil.importUserAccount(network, wid, path, v, pubKey)));
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'delete':
            try {
                const { walletID, path, chainType = false, address } = payload;
                hdUtil.deleteUserAccount(walletID, path);
                if (walletID === WALLET_ID_RAWKEY) {
                    hdUtil.deleteRawKey(path);
                    if (chainType === 'WAN') { // Delete WAN private address's raw key
                        let privatePath = path.split('');
                        privatePath.splice(privatePath.lastIndexOf('/') - 1, 1, '1');
                        hdUtil.deleteRawKey(privatePath.join(''));
                    }
                } else if (walletID === WALLET_ID_KEYSTORE) {
                    hdUtil.deleteKeyStore(path, address.toLowerCase());
                }
                if (chainType === 'WAN') {
                    ccUtil.stopScanOTA(walletID, path);
                }

                ret = true;
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getAccountByPublicKey':
            try {
                ret = await ccUtil.getEosAccountsByPubkey(payload.chainType, payload.pubkey);
            } catch (e) {
                console.log('error:', e)
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getAccountStakeInfo':
            try {
                const { chain, account } = payload;
                ret = await ccUtil.getAccountStakeInfo(chain, account);
            } catch (e) {
                console.log('error:', e)
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_ACCOUNT, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break
    }
})

ipc.on(ROUTE_TX, async (event, actionUni, payload) => {
    let ret, err
    const [action, id] = actionUni.split('#')
    switch (action) {
        case 'normal':
            try {
                let { walletID, chainType, symbol, path, to, amount, gasPrice, gasLimit, nonce, data, satellite, isSend = undefined } = payload
                let from = await hdUtil.getAddress(walletID, chainType, path);
                let fromAddr = from.address;

                if (fromAddr.indexOf('0x') === -1) {
                    fromAddr = '0x' + fromAddr;
                }

                let input = {
                    symbol: symbol,
                    from: fromAddr,
                    to: to,
                    amount: amount,
                    gasPrice: gasPrice,
                    gasLimit: gasLimit,
                    BIP44Path: path,
                    walletID: walletID,
                    nonce: nonce,
                    data: str2Hex(data),
                    satellite: satellite
                }
                logger.info('Normal transaction: ' + JSON.stringify(input));
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(COIN_ACCOUNT, chainType);
                ret = await global.crossInvoker.invokeNormalTrans(srcChain, input, isSend);
                logger.info('Transaction hash: ' + JSON.stringify(ret));
            } catch (e) {
                logger.error('Failed to send transaction: ' + e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'tokenNormal':
            try {
                let { walletID, chainType, symbol, path, to, amount, gasPrice, gasLimit, nonce, data, satellite } = payload
                let from = await hdUtil.getAddress(walletID, chainType, path);
                let fromAddr = from.address;
                if (fromAddr.indexOf('0x') === -1) {
                    fromAddr = '0x' + fromAddr;
                }
                let input = {
                    symbol: symbol,
                    from: fromAddr,
                    to: satellite.transferTo,
                    amount: amount,
                    gasPrice: gasPrice,
                    gasLimit: gasLimit,
                    BIP44Path: path,
                    walletID: walletID,
                    nonce: nonce,
                    data: data,
                    satellite: satellite
                }

                logger.info('Token normal transaction: ' + JSON.stringify(input));
                let srcChain = await global.crossInvoker.getChainInfoByContractAddr(to, chainType);// token address, chain
                ret = await global.crossInvoker.invokeNormalTrans(srcChain, input);
                logger.info('Transaction hash: ' + JSON.stringify(ret));
            } catch (e) {
                logger.error('Failed to send transaction: ' + e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'BTCNormal':
            try {
                logger.info('Normal transaction: ' + JSON.stringify(payload));
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(COIN_ACCOUNT, 'BTC');
                ret = await global.crossInvoker.invokeNormalTrans(srcChain, payload);
            } catch (e) {
                logger.error('Failed to send transaction: ' + e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'XRPNormal':
            try {
                logger.info('XRP Normal transaction: ' + JSON.stringify(payload));
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(COIN_ACCOUNT, 'XRP');
                ret = await global.crossInvoker.invokeNormalTrans(srcChain, payload);
            } catch (e) {
                logger.error('Failed to send transaction: ' + e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'EOSNormal':
            try {
                logger.info('Normal transaction: ' + JSON.stringify(payload));

                const EOSSYMBOL = ccUtil.encodeAccount('EOS', 'eosio.token:EOS');
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(EOSSYMBOL, 'EOS');
                ret = await global.crossInvoker.invokeNormalTrans(srcChain, payload);
            } catch (e) {
                logger.error('Failed to send transaction: ' + e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'private':
            try {
                let { walletID, chainType, path, to, amount, gasPrice, gasLimit } = payload
                let from = await hdUtil.getAddress(walletID, chainType, path);
                let action = 'SEND';
                let input = {
                    "from": '0x' + from.address,
                    "to": to,
                    "gasPrice": gasPrice,
                    "gasLimit": gasLimit,
                    "BIP44Path": path,
                    "walletID": walletID
                }
                logger.info('Private transaction: ' + JSON.stringify(input));
                for (let obj of amount) {
                    input.amount = obj.face;
                    for (let i = 0; i < obj.count; i++) {
                        let res = await global.crossInvoker.invokePrivateTrans(action, input);
                        if (res.code === false) {
                            err = {
                                message: res.result
                            };
                        }
                    }
                }
            } catch (e) {
                logger.error('Send private transaction failed: ' + e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: null })
            break;

        case 'refund':
            try {
                let { input } = payload;
                const action = 'REFUND';
                for (let i of input) {
                    let res = await global.crossInvoker.invokePrivateTrans(action, i);
                    if (res.code === false) {
                        err = {
                            message: res.result
                        };
                    }
                }
            } catch (e) {
                logger.error('Refund failed');
                logger.error(e);
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: null })
            break;

        case 'raw':
            try {
                logger.info('Send raw transaction: ' + JSON.stringify(payload))
                ret = await ccUtil.sendTrans(payload.raw, payload.chainType)
                logger.info('Transaction hash: ' + ret);
            } catch (e) {
                logger.error('Send raw transaction failed');
                logger.error(e);
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        /**
         * tx = {
         *   from: from,
         *   to: to,
         *   value: value,
         *   data: data,
         *   gas: defaultGas
         * }
         */
        case 'estimateGas':
            try {
                logger.info('Try to estimate gas: ' + payload.chainType + ',' + JSON.stringify(payload.tx));
                ret = await ccUtil.estimateGas(payload.chainType, payload.tx);
                logger.info('Estimated gas: ' + ret);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'showRecords':
            try {
                ret = global.wanDb.queryComm(DB_NORMAL_COLLECTION, items => {
                    return items
                })
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'insertTransToDB':
            try {
                ccUtil.insertNormalTx(payload.rawTx, undefined, undefined, payload.satellite);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: true })
            break;

        case 'estimateSmartFee':
            try {
                ret = await ccUtil.estimateSmartFee(payload.chainType);
            } catch (e) {
                logger.error('estimateSmartFee failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'converter':
            try {
                const { str, from, to } = payload;
                ret = converter(str, from, to);
            } catch (e) {
                logger.error('convert failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_TX, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break
    }
})

ipc.on(ROUTE_QUERY, async (event, actionUni, payload) => {
    let ret, err
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'config':
            let { param } = payload

            try {
                let conf
                if (param === 'sdkStatus') {
                    conf = global.chainManager ? 'ready' : 'init'
                } else {
                    conf = setting[`${param}`]
                }

                ret = { [param]: conf }
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_QUERY, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getGasPrice':
            try {
                ret = await ccUtil.getGasPrice(payload.chainType);
                logger.info('Gas price: ' + payload.chainType + ',' + ret);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_QUERY, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;
    }

})

ipc.on(ROUTE_STAKING, async (event, actionUni, payload) => {
    let ret, err
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'getContractAddr':
            ret = setting.cscContractAddr;
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'getCurrentEpochInfo':
            try {
                ret = await ccUtil.getCurrentEpochInfo('wan');
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'PosStakeUpdateFeeRate':
            try {
                logger.info('PosStakeUpdateFeeRate: ' + payload);

                let { tx } = payload;
                let gasPrice = await ccUtil.getGasPrice('wan');
                tx.gasLimit = 200000;
                tx.gasPrice = web3.utils.fromWei(gasPrice, 'gwei');
                ret = await global.crossInvoker.PosStakeUpdateFeeRate(tx);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'info':
            try {
                let accounts = payload;
                let delegateInfo = [];
                let incentive = [];

                if (!global.slotCount) {
                    [global.slotCount, global.slotTime] = await Promise.all([retryRun(ccUtil.getSlotCount, 'wan'), retryRun(ccUtil.getSlotTime, 'wan')]);
                }

                let stakeInfoArray = accounts.map(async account => {
                    await retryRun(async (account) => {
                        let info = await ccUtil.getDelegatorStakeInfo('wan', account.address);
                        if (info && info.length && info.length > 0) {
                            delegateInfo.push({ account: account, stake: info });
                        }
                    }, account);
                });

                // Get the rewards information for each local account, including the list of rewards received and which validator the rewards came from.
                let DelegateIncentiveArray = accounts.map(async account => {
                    await retryRun(async (account) => {
                        let inc = await ccUtil.getDelegatorTotalIncentive('wan', account.address);
                        if (inc && inc.length && inc.length > 0) {
                            incentive.push({ account: account, incentive: inc });
                        }
                    }, account);
                });

                let promiseArray = [retryRun(ccUtil.getEpochID, 'wan'), retryRun(ccUtil.getCurrentStakerInfo, 'wan'), retryRun(ccUtil.getDelegatorSupStakeInfo, 'wan', accounts.map(val => val.address))].concat(stakeInfoArray).concat(DelegateIncentiveArray);
                let retArray = await Promise.all(promiseArray);
                let epochID = retArray[0];
                let stakeInfo = retArray[1];

                if (stakeInfo.length > 0) {
                    let prms = [];
                    for (let i = 0; i < stakeInfo.length; i++) {
                        prms.push(retryRun(getNameAndIcon, stakeInfo[i].address));
                    }

                    let prmsRet = await Promise.all(prms);

                    for (let i = 0; i < stakeInfo.length; i++) {
                        if (prmsRet && prmsRet[i]) {
                            let info = prmsRet[i];
                            stakeInfo[i].name = info[0].name;
                            stakeInfo[i].iconData = (info[0].iconData && info[0].iconData.length > 10) ? 'data:image/' + info[0].iconType + ';base64,' + info[0].iconData : ('data:image/png;base64,' + new Identicon(stakeInfo[i].address).toString());
                        }
                    }
                }

                ret = { base: {}, list: [] };
                ret.base = buildStakingBaseInfo(delegateInfo, incentive, epochID, stakeInfo);
                ret.list = await buildStakingList(delegateInfo, incentive, epochID, ret.base, retArray[2]);

                ret.stakeInfo = stakeInfo;
            } catch (e) {
                logger.error(actionUni + (e.message || e.stack));
                err = e;
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'validatorInfo':
            try {
                let { addr } = payload
                ret = await ccUtil.getValidatorStakeInfo('wan', addr);

            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'delegateIn':
            try {
                logger.info('delegateIn:' + JSON.stringify(payload));
                let tx = payload;

                let validatorInfo = await ccUtil.getValidatorInfo('wan', tx.validatorAddr);
                if (!validatorInfo || validatorInfo.feeRate == 10000) {
                    throw new Error('Validator Address is Invalid');
                }

                let gasPrice = await ccUtil.getGasPrice('wan');

                let gasLimit = 200000;
                tx.gasPrice = web3.utils.fromWei(gasPrice, 'gwei');;
                tx.gasLimit = gasLimit;

                ret = await global.crossInvoker.PosDelegateIn(tx);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'delegateOut':
            try {
                logger.info('delegateOut:' + payload);

                let tx = payload;
                let gasPrice = await ccUtil.getGasPrice('wan');

                let gasLimit = 200000;
                let gasPriceGwei = web3.utils.fromWei(gasPrice, 'gwei');;
                let input = {
                    "from": tx.from,
                    "validatorAddr": tx.validator,
                    "amount": 0,
                    "gasPrice": gasPriceGwei,
                    "gasLimit": gasLimit,
                    "BIP44Path": tx.path,
                    "walletID": tx.walletID,
                    "stakeAmount": tx.stakeAmount,
                }

                ret = await global.crossInvoker.PosDelegateOut(input);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'registerValidator':
            try {
                let { tx } = payload;
                let key = Buffer.from(tx.secPk.toLowerCase().replace('0x', '').substring(2), 'hex');
                let address = '0x' + keccak('keccak256').update(key).digest().slice(-20).toString('hex');
                let gasPrice = await ccUtil.getGasPrice('wan');

                tx.gasLimit = 200000;
                tx.minerAddr = address;
                tx.gasPrice = web3.utils.fromWei(gasPrice, 'gwei');
                logger.info('Register validator:' + JSON.stringify(tx));
                ret = await global.crossInvoker.PosStakeRegister(tx);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'validatorAppend':
            try {
                logger.info('validatorAppend: ' + payload);

                let { tx } = payload;
                let gasPrice = await ccUtil.getGasPrice('wan');
                tx.gasLimit = 200000;
                tx.gasPrice = web3.utils.fromWei(gasPrice, 'gwei');
                ret = await global.crossInvoker.PosStakeAppend(tx);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break
        case 'validatorUpdate':
            try {
                logger.info('validatorUpdate: ' + payload);
                let { tx } = payload;
                let gasPrice = await ccUtil.getGasPrice('wan');
                tx.gasLimit = 200000;
                tx.gasPrice = web3.utils.fromWei(gasPrice, 'gwei');
                ret = await global.crossInvoker.PosStakeUpdate(tx);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getContractData':
            try {
                let func = payload.func;
                let params = payload.params;
                var cscDefinition = [{ "constant": false, "inputs": [{ "name": "addr", "type": "address" }], "name": "stakeAppend", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }, { "constant": false, "inputs": [{ "name": "addr", "type": "address" }, { "name": "lockEpochs", "type": "uint256" }], "name": "stakeUpdate", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "name": "secPk", "type": "bytes" }, { "name": "bn256Pk", "type": "bytes" }, { "name": "lockEpochs", "type": "uint256" }, { "name": "feeRate", "type": "uint256" }], "name": "stakeIn", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }, { "constant": false, "inputs": [{ "name": "secPk", "type": "bytes" }, { "name": "bn256Pk", "type": "bytes" }, { "name": "lockEpochs", "type": "uint256" }, { "name": "feeRate", "type": "uint256" }, { "name": "maxFeeRate", "type": "uint256" }], "name": "stakeRegister", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }, { "constant": false, "inputs": [{ "name": "addr", "type": "address" }, { "name": "renewal", "type": "bool" }], "name": "partnerIn", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }, { "constant": false, "inputs": [{ "name": "delegateAddress", "type": "address" }], "name": "delegateIn", "outputs": [], "payable": true, "stateMutability": "payable", "type": "function" }, { "constant": false, "inputs": [{ "name": "delegateAddress", "type": "address" }], "name": "delegateOut", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "constant": false, "inputs": [{ "name": "addr", "type": "address" }, { "name": "feeRate", "type": "uint256" }], "name": "stakeUpdateFeeRate", "outputs": [], "payable": false, "stateMutability": "nonpayable", "type": "function" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "sender", "type": "address" }, { "indexed": true, "name": "posAddress", "type": "address" }, { "indexed": true, "name": "v", "type": "uint256" }, { "indexed": false, "name": "feeRate", "type": "uint256" }, { "indexed": false, "name": "lockEpoch", "type": "uint256" }, { "indexed": false, "name": "maxFeeRate", "type": "uint256" }], "name": "stakeRegister", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "sender", "type": "address" }, { "indexed": true, "name": "posAddress", "type": "address" }, { "indexed": true, "name": "v", "type": "uint256" }, { "indexed": false, "name": "feeRate", "type": "uint256" }, { "indexed": false, "name": "lockEpoch", "type": "uint256" }], "name": "stakeIn", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "sender", "type": "address" }, { "indexed": true, "name": "posAddress", "type": "address" }, { "indexed": true, "name": "v", "type": "uint256" }], "name": "stakeAppend", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "sender", "type": "address" }, { "indexed": true, "name": "posAddress", "type": "address" }, { "indexed": true, "name": "lockEpoch", "type": "uint256" }], "name": "stakeUpdate", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "sender", "type": "address" }, { "indexed": true, "name": "posAddress", "type": "address" }, { "indexed": true, "name": "v", "type": "uint256" }, { "indexed": false, "name": "renewal", "type": "bool" }], "name": "partnerIn", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "sender", "type": "address" }, { "indexed": true, "name": "posAddress", "type": "address" }, { "indexed": true, "name": "v", "type": "uint256" }], "name": "delegateIn", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "sender", "type": "address" }, { "indexed": true, "name": "posAddress", "type": "address" }], "name": "delegateOut", "type": "event" }, { "anonymous": false, "inputs": [{ "indexed": true, "name": "sender", "type": "address" }, { "indexed": true, "name": "posAddress", "type": "address" }, { "indexed": true, "name": "feeRate", "type": "uint256" }], "name": "stakeUpdateFeeRate", "type": "event" }];
                let data = ccUtil.getDataByFuncInterface(cscDefinition,
                    setting.cscContractAddr,
                    func,
                    ...params);

                ret = data;
            } catch (e) {
                logger.error('Get contract data failed');
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'insertTransToDB':
            try {
                logger.info('insertTransToDB:' + payload);
                let satellite = {
                    validator: payload.rawTx.validator,
                    annotate: payload.rawTx.annotate,
                    stakeAmount: payload.rawTx.stakeAmount,
                }
                await ccUtil.insertNormalTx(payload.rawTx, 'Sent', "external", satellite);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;


        case 'insertRegisterValidatorToDB': // Save the register validator record in local DB file.
            try {
                logger.info('insertRegisterValidatorToDB:' + payload);
                let { tx, satellite } = payload;
                let key = Buffer.from(satellite.secPk.toLowerCase().replace('0x', '').substring(2), 'hex');
                let validator = '0x' + keccak('keccak256').update(key).digest().slice(-20).toString('hex');
                satellite.validator = validator;
                await ccUtil.insertNormalTx(tx, tx.status, "external", satellite);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'posInfo':
            try {
                ret = {};
                let info = await ccUtil.getPosInfo('wan')
                if (info) {
                    ret.firstEpochId = info.firstEpochId;
                }

                ret.slotCount = await ccUtil.getSlotCount('wan');
                ret.slotTime = await ccUtil.getSlotTime('wan');
                global.slotCount = ret.slotCount;
                global.slotTime = ret.slotTime;
                global.firstEpochId = ret.firstEpochId;

            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'getValidatorsInfo':
            try {
                let { address } = payload;
                if (address.length === 0) {
                    ret = []
                } else {
                    let [ret0, ret1] = await Promise.all([ccUtil.getValidatorTotalIncentive('wan', address), ccUtil.getValidatorSupStakeInfo('wan', address)])
                    ret0.forEach(item => {
                        let index = ret1.findIndex(val => val.address === item.address);
                        item.stakeInTimestamp = index !== -1 ? ret1[index].stakeInTimestamp : 0;
                    });
                    ret = ret0;
                }
            } catch (e) {
                logger.info(e)
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STAKING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;
    }
})

ipc.on(ROUTE_CROSSCHAIN, async (event, actionUni, payload) => {
    let err, ret
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'getTokenInfo':
            try {
                let { scAddr, chain } = payload;
                ret = await ccUtil.getTokenInfo(scAddr, chain);
            } catch (e) {
                logger.error('getTokenInfo failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getTokensInfo':
            try {
                ret = setting.tokens;
            } catch (e) {
                logger.error('getTokensInfo failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getTokenPairs':
            try {
                ret = await ccUtil.getTokenPairs();
            } catch (e) {
                logger.error('getTokenPairs failed:', e)
                logger.error(e, e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getBlockNumber':
          try {
            let { chainType } = payload;
            ret = await ccUtil.getBlockNumber(chainType);
          } catch (e) {
              logger.error('getBlockNumber failed:', e)
              logger.error(e, e.message || e.stack)
              err = e
          }
          sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break

        case 'getRegisteredTokenList':
            try {
                ret = await ccUtil.getRegisteredTokenList();
            } catch (e) {
                logger.error('getRegisteredTokenList failed:', e)
                logger.error(e, e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getChainInfoByChainId':
            try {
                let { chainId } = payload;
                ret = await ccUtil.getChainInfoByChainId(chainId);
                // logger.info(ret)
            } catch (e) {
                logger.error('getChainInfoByChainId failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getCcTokenSelections':
            try {
                ret = setting.CcTokenSelections;
            } catch (e) {
                logger.error('getCcTokenSelections failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'setCcTokenSelectStatus':
            try {
                let { id, selected } = payload;
                setting.updateCcTokenSelections(id, selected);
                ret = true;
            } catch (e) {
                logger.error('setCcTokenSelectStatus failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'updateTokensInfo':
            {
                let { addr, key, value } = payload;
                try {
                    if (key === undefined) {
                        setting.updateTokenItem(addr, value);
                    } else {
                        setting.updateTokenKeyValue(addr, key, value);
                    }
                } catch (e) {
                    logger.error('updateTokensInfo failed:')
                    logger.error(e.message || e.stack)
                    err = e
                }
                sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err })
                break
            }

        case 'removeTokenItem':
          {
              let { addr } = payload;
              try {
                  setting.removeTokenItem(addr);
              } catch (e) {
                  logger.error('removeTokenItem failed:')
                  logger.error(e.message || e.stack)
                  err = e
              }
              sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err })
              break
          }

        case 'addCustomToken':
            try {
                let { key, account, ancestor, chain, chainSymbol, decimals, select, symbol, isCustomToken } = payload;
                setting.addToken(key, { account, ancestor, chain, chainSymbol, decimals, select, symbol, isCustomToken });
            } catch (e) {
                logger.error('addCustomToken failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err })
            break

        case 'deleteCustomToken':
            try {
                let { tokenAddr } = payload;
                setting.remove(`settings.${network}.tokens.${tokenAddr.toLowerCase()}`);
            } catch (e) {
                logger.error('deleteCustomToken failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err })
            break

        case 'updateTokensBalance':
            try {
                let { address, tokenScAddr, chain } = payload;
                ret = await ccUtil.getMultiTokenBalance(address, tokenScAddr, chain);
            } catch (e) {
                logger.error('updateTokensBalance failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getSmgList':
            let coin2WanRatio
            try {
                let { crossChain, tokenAddr } = payload;
                if (tokenAddr && crossChain === 'EOS') {
                    tokenAddr = ccUtil.encodeAccount(crossChain, tokenAddr);
                    ret = await ccUtil.syncTokenStoremanGroups(crossChain, tokenAddr);
                    coin2WanRatio = ccUtil.getRegTokenInfo(crossChain, tokenAddr).ratio;
                } else if (tokenAddr && tokenAddr.startsWith('0x')) {
                    ret = await ccUtil.syncTokenStoremanGroups(crossChain, tokenAddr);
                    coin2WanRatio = ccUtil.getRegTokenInfo(crossChain, tokenAddr).ratio;
                } else {
                    [ret, coin2WanRatio] = await Promise.all([ccUtil.getSmgList(crossChain), ccUtil.getC2WRatio(crossChain)]);
                }
                ret.forEach(item => item.coin2WanRatio = coin2WanRatio)

                if (crossChain === 'BTC') {
                    let net = network === 'main' ? 'mainnet' : 'testnet';
                    ret.forEach(smg => {
                        if (smg.btcAddress.startsWith('0x')) {
                            smg.smgBtcAddr = smg.btcAddress;
                            smg.btcAddress = btcUtil.hash160ToAddress(smg.btcAddress, 'pubkeyhash', net);
                        }
                    });
                }
            } catch (e) {
                logger.error('getSmgList failed: ' + e)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getStoremanGroupList':
            try {
                let { srcChainName, dstChainName } = payload;
                ret = await ccUtil.getStoremanGroupList(srcChainName, dstChainName);
            } catch (e) {
                logger.error('getSmgList failed: ' + e)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getChainQuotaHiddenFlagDirectionally':
          try {
              let { chainIds } = payload;
              ret = await ccUtil.getChainQuotaHiddenFlagDirectionally(chainIds);
          } catch (e) {
              logger.error('getChainQuotaHiddenFlagDirectionally failed: ' + e)
              err = e
          }
          sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break

        case 'getWanBridgeDiscounts':
          try {
              ret = await ccUtil.getWanBridgeDiscounts();
          } catch (e) {
              logger.error('getWanBridgeDiscounts failed: ' + e)
              err = e
          }
          sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break

        case 'getMintQuota':
            try {
                let { chainType, tokenPairID, storemanGroupID } = payload;
                ret = await ccUtil.getMintQuota(chainType, tokenPairID, storemanGroupID);
            } catch (e) {
                logger.error('getMintQuota failed: ' + e)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getBurnQuota':
            try {
                let { chainType, tokenPairID, storemanGroupID } = payload;
                ret = await ccUtil.getBurnQuota(chainType, tokenPairID, storemanGroupID);
            } catch (e) {
                logger.error('getBurnQuota failed: ' + e)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getQuota':
            try {
                let { chainType, groupId, symbolArray, options } = payload;
                ret = await ccUtil.getStoremanGroupQuota(chainType, groupId, symbolArray, options);
            } catch (e) {
                logger.error('getQuota failed: ' + e);
                err = e;
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret });
            break;

        case 'getHtmlAddr':
            try {
                if (payload && payload.symbol) {
                    ret = setting.htlcAddresses[payload.symbol];
                } else {
                    ret = setting.htlcAddresses;
                }
            } catch (e) {
                logger.error('getHtmlAddr failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getCrossChainContractData':
            try {
                const { sourceAccount, sourceSymbol, destinationAccount, destinationSymbol, type, input, tokenPairID } = payload;
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(sourceAccount, sourceSymbol, tokenPairID);
                let dstChain = global.crossInvoker.getSrcChainNameByContractAddr(destinationAccount, destinationSymbol, tokenPairID);
                let { crossMode, smgCrossMode } = global.crossInvoker.getCrossInvokerConfig(srcChain, dstChain, tokenPairID)
                if (payload.type === 'REDEEM') {
                    payload.input.x = ccUtil.hexAdd0x(payload.input.x);
                }
                ret = await global.crossInvoker.invoke(srcChain, dstChain, type, input, false);
                if (destinationSymbol === 'XRP') {
                  ret.LedgerVersion = await ccUtil.getLedgerVersion(destinationSymbol);
                }
                ret.crossMode = crossMode
                ret.smgCrossMode = smgCrossMode
                console.log('get ret:', ret)
            } catch (e) {
                logger.error('crossChain failed:');
                logger.error(e);
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'crossChain':
            try {
                const { sourceAccount, sourceSymbol, destinationAccount, destinationSymbol, type, input, tokenPairID, toChainSymbol } = payload;
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(sourceAccount, sourceSymbol, tokenPairID);
                let dstChain = global.crossInvoker.getSrcChainNameByContractAddr(destinationAccount, destinationSymbol, tokenPairID);
                if (destinationSymbol === 'XRP') {
                  input.LedgerVersion = await ccUtil.getLedgerVersion(destinationSymbol);
                }
                if (['WAN', 'ETH', "BTC"].includes(toChainSymbol)) {
                  input.dstLockedBlockNumber = await ccUtil.getBlockNumber(toChainSymbol)
                }
                if (payload.type === 'REDEEM') {
                    payload.input.x = ccUtil.hexAdd0x(payload.input.x);
                }
                ret = await global.crossInvoker.invoke(srcChain, dstChain, type, input);
            } catch (e) {
                logger.error('crossChain failed:')
                logger.error(e)
                // logger.error(e.message || e.stack);
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'crossBTC':
            try {
                const { sourceAccount, sourceSymbol, destinationAccount, destinationSymbol, type, input, tokenPairID } = payload;
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(sourceAccount, sourceSymbol, tokenPairID);
                let dstChain = global.crossInvoker.getSrcChainNameByContractAddr(destinationAccount, destinationSymbol, tokenPairID);
                let feeHard = network === 'main' ? 10000 : 100000;
                if (payload.type === 'LOCK' && sourceSymbol === 'WAN') {
                    payload.input.value = ccUtil.calculateLocWanFeeWei(payload.input.amount * 100000000, global.btc2WanRatio, payload.input.txFeeRatio);
                }
                if (payload.type === 'REDEEM') {
                    payload.input.feeRate = await ccUtil.estimateSmartFee('BTC');
                    payload.input.x = ccUtil.hexAdd0x(payload.input.x);
                }
                if (payload.type === 'REVOKE') {
                    payload.input.feeRate = await ccUtil.estimateSmartFee('BTC');
                }
                console.log('CC BTC:', payload.type, payload);
                ret = await global.crossInvoker.invoke(srcChain, dstChain, type, input);
                if (!ret.code) {
                    err = ret;
                }
            } catch (e) {
                logger.error('crossBTC failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'crossETH':
            try {
                const { sourceAccount, sourceSymbol, destinationAccount, destinationSymbol, type, input, tokenPairID } = payload;
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(sourceAccount, sourceSymbol, tokenPairID);
                let dstChain = global.crossInvoker.getSrcChainNameByContractAddr(destinationAccount, destinationSymbol, tokenPairID);
                if (payload.type === 'REDEEM') {
                    payload.input.x = ccUtil.hexAdd0x(payload.input.x);
                }
                ret = await global.crossInvoker.invoke(srcChain, dstChain, type, input);
                if (!ret.code) {
                    err = ret;
                }
            } catch (e) {
                logger.error('crossETH failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'crossEOS2WAN':
            try {
                const { sourceAccount, sourceSymbol, destinationAccount, destinationSymbol, type, input } = payload;
                const EOSSYMBOL = ccUtil.encodeAccount('EOS', sourceAccount);
                let srcChain = sourceSymbol === 'WAN' ? null : global.crossInvoker.getSrcChainNameByContractAddr(ccUtil.encodeAccount('EOS', sourceAccount), sourceSymbol);
                let dstChain = destinationSymbol === 'WAN' ? null : global.crossInvoker.getSrcChainNameByContractAddr(ccUtil.encodeAccount('EOS', destinationAccount), destinationSymbol);
                ret = await global.crossInvoker.invoke(srcChain, dstChain, type, input);
                if (!ret.code) {
                    err = ret;
                }
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'crossEOS':
            try {
                const { sourceAccount, sourceSymbol, destinationAccount, destinationSymbol, type, input, tokenPairID } = payload;
                let srcChain = global.crossInvoker.getSrcChainNameByContractAddr(sourceAccount, sourceSymbol, tokenPairID);
                let dstChain = global.crossInvoker.getSrcChainNameByContractAddr(destinationAccount, destinationSymbol, tokenPairID);
                ret = await global.crossInvoker.invoke(srcChain, dstChain, type, input);
                if (!ret.code) {
                    err = ret;
                }
            } catch (e) {
                logger.error('crossEOS failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getAllUndoneCrossTrans':
            try {
                ret = {
                    canRedeem: [],
                    canRevoke: []
                };
                let crossCollection = global.wanDb.getItemAll('crossTrans', {});
                crossCollection.forEach(record => {
                    if (ccUtil.canRedeem(record).code) {
                        record.redeemTryCount = 1;
                        ret.canRedeem.push(record);
                    }
                    if (ccUtil.canRevoke(record).code) {
                        record.revokeTryCount = 1;
                        ret.canRevoke.push(record);
                    }
                });
            } catch (e) {
                logger.error('getAllUndoneCrossTrans failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getAllCrossTrans':
            try {
                ret = global.wanDb.getItemAll('crossTrans', {});
            } catch (e) {
                logger.error('getAllCrossTrans failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'increaseFailedRetryCount':
            try {
                let { hashX, toCount, isRedeem, transType } = payload;
                let record = global.wanDb.getItem(transType, { hashX });
                if (record) {
                    if (isRedeem) {
                        record.redeemTryCount = toCount;
                    } else {
                        record.revokeTryCount = toCount;
                    }
                    global.wanDb.updateItem(transType, { hashX: record.hashX }, record);
                    ret = true;
                } else {
                    ret = false;
                }
            } catch (e) {
                logger.error('increaseFailedRetryCount failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getRegisteredOrigToken':
            try {
                let { chainType, options } = payload;
                ret = await ccUtil.getRegisteredOrigToken(payload.chainType, payload.options);
            } catch (e) {
                // logger.error('getRegisteredOrigToken failed:')
                // logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getFastMinCount':
            try {
                let { chainType, tokenPairID } = payload;
                ret = await ccUtil.getFastMinCount(chainType, tokenPairID);
            } catch (e) {
                logger.error('getFastMinCount failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getFees':
            try {
                let { chainType, chainID1, chainID2 } = payload;
                ret = await ccUtil.getFees(chainType, chainID1, chainID2);
            } catch (e) {
                logger.error('getFees failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'estimatedXrpFee':
            try {
                let payment = ccUtil.getXrpPayment(payload)
                let data = await ccUtil.packTransaction('XRP', { address: payload.from, payment });
                if (data && data.instructions) {
                    ret = data.instructions.fee
                } else {
                    ret = '0';
                    err = 'error'
                }
            } catch (e) {
                logger.error('packTransaction failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getCrossChainFees':
          try {
              let { chainType, chainIds } = payload
              ret = await ccUtil.getCrossChainFees(chainType, chainIds);
          } catch (e) {
              logger.error('estimateNetworkFee failed:')
              logger.error(e.message || e.stack)
              err = e
          }
          sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break

        case 'estimateCrossChainNetworkFee':
          try {
              let { chainType, dstChainType, options } = payload
              ret = await ccUtil.estimateCrossChainNetworkFee(chainType, dstChainType, options);
          } catch (e) {
              logger.error('estimateCrossChainNetworkFee failed:', e)
              logger.error(e.message || e.stack)
              err = e
          }
          sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break

        case 'estimateCrossChainOperationFee':
          try {
              let { chainType, dstChainType, options } = payload
              ret = await ccUtil.estimateCrossChainOperationFee(chainType, dstChainType, options);
          } catch (e) {
              logger.error('estimateCrossChainOperationFee failed:', e)
              logger.error(e.message || e.stack)
              err = e
          }
          sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break

        case 'insertCrossChainTransToDB':
          try {
              logger.debug(`Try ${action}: ${JSON.stringify(payload, null, 4)}`);
              let { tx, satellite } = payload;
              await ccUtil.insertCrossTx(tx, "LockSent", "external", satellite);
          } catch (e) {
              logger.error(e.message || e.stack)
              err = e
          }
          sendResponse([ROUTE_CROSSCHAIN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
          break;
    }
})

ipc.on(ROUTE_DAPPSTORE, async (event, actionUni, payload) => {
    let ret, err
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'getRegisteredDapp':
            try {
                ret = await ccUtil.getRegisteredDapp(payload.options);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }

            sendResponse([ROUTE_DAPPSTORE, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'getRegisteredAds':
            try {
                ret = await ccUtil.getRegisteredAds(payload.options);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_DAPPSTORE, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;
    }
})

ipc.on(ROUTE_SETTING, async (event, actionUni, payload) => {
    let ret, err, keys, vals = []
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'switchNetwork':

            let choice = parseInt(payload.choice)
            let mainWin = Windows.getByType('main')
            let switchWin = Windows.getByType('changeNetwork')

            if (choice === 1) {
                try {
                    setting.switchNetwork()
                    app.relaunch()
                    app.exit(0)
                } catch (e) {
                    logger.error(e.message || e.stack)
                    err = e
                }
            } else if (choice === 0) {
                try {
                    const networkMenu = menuFactoryService.networkMenu
                    const [targetMenu] = networkMenu.items.filter(i => !i.checked)
                    targetMenu.checked = true
                } catch (e) {
                    logger.error(e.message || e.stack)
                    err = e
                }
            }

            mainWin.show()
            switchWin.close()

            break

        case 'set':
            keys = Object.keys(payload)
            vals = Object.values(payload)

            try {
                keys.forEach((key, index) => {
                    let newValue = key === 'settings' ? Object.assign(setting.get('settings'), vals[index]) : vals[index]
                    setting.set(key, newValue)
                })
                ret = true
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e

                ret = false
            }

            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'get':
            let { keys } = payload[0];
            try {
                keys.forEach((key, index) => {
                    vals[index] = setting.get(key)
                })
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: vals })
            break
        case 'updateDapps':
            try {
                let dapp = payload;
                setting.updateDapps(dapp);
            } catch (e) {
                logger.error('updateDapps failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err })
            break;
        case 'getDapps':
            let val;
            try {
                val = setting.getDapps();
            } catch (e) {
                logger.error('getDapps failed:')
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: val })
            break;
        case 'getDAppInjectFile':
            ret = "";

            if (setting.isDev) {
                ret = `file://${__dirname}/../modals/dAppInject.js`;
            } else {
                ret = `file://${__dirname}/modals/dAppInject.js`
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break
        case 'rpcDelay':
            try {
                let startTime = Date.now();
                let result = await ccUtil.getEpochID('WAN');
                let cost = Date.now() - startTime;
                if (!result) {
                    ret = 'Time out';
                } else {
                    if (cost < NETWORK_SLOW) {
                        ret = 'Good (' + cost + 'ms)';
                    } else {
                        ret = 'Slow (' + cost + 'ms)';
                    }
                }
            } catch (error) {
                ret = 'Time out ' + error;
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;
        case 'wanNodeDelay':
            try {
                let startTime0 = Date.now();
                let result0 = await ccUtil.getEpochID('WAN');
                let cost0 = Date.now() - startTime0;

                let startTime = Date.now();
                let result = await ccUtil.getBalance('0xa4626e2bb450204c4b34bcc7525e585e8f678c0d', 'WAN');
                let cost = Date.now() - startTime - cost0;
                if (cost < 0) {
                    cost = cost * -1;
                }

                if (!result) {
                    ret = 'Time out';
                } else {
                    if (cost < NETWORK_SLOW) {
                        ret = 'Good (' + cost + 'ms)';
                    } else {
                        ret = 'Slow (' + cost + 'ms)';
                    }
                }
            } catch (error) {
                ret = 'Time out ' + error;
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;
        case 'ethNodeDelay':
            try {
                let startTime0 = Date.now();
                let result0 = await ccUtil.getEpochID('WAN');
                let cost0 = Date.now() - startTime0;

                let startTime = Date.now();
                let result = await ccUtil.getBalance('0xa4626e2bb450204c4b34bcc7525e585e8f678c0d', 'ETH');
                let cost = Date.now() - startTime - cost0;
                if (cost < 0) {
                    cost = cost * -1;
                }
                console.log('ethNodeDelay result:', result);
                if (!result) {
                    ret = 'Time out';
                } else {
                    if (cost < NETWORK_SLOW) {
                        ret = 'Good (' + cost + 'ms)';
                    } else {
                        ret = 'Slow (' + cost + 'ms)';
                    }
                }
            } catch (error) {
                ret = 'Time out ' + error;
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;
        case 'btcNodeDelay':
            try {
                let startTime0 = Date.now();
                let result0 = await ccUtil.getEpochID('WAN');
                let cost0 = Date.now() - startTime0;

                let addr = 'mtAXbCHDkgBZmL9zjq9kgYRpPA13gVFqYZ';
                if (network === 'main') {
                    addr = '1MzM2FMP1nbphaLgGRqKh7TRkgLtXXghWc';
                }

                let startTime = Date.now();
                let result = await ccUtil.getBtcUtxo(0, 10000000, [addr]);
                let cost = Date.now() - startTime - cost0;
                if (cost < 0) {
                    cost = cost * -1;
                }
                if (!result) {
                    ret = 'Time out';
                } else {
                    if (cost < NETWORK_SLOW) {
                        ret = 'Good (' + cost + 'ms)';
                    } else {
                        ret = 'Slow (' + cost + 'ms)';
                    }
                }
            } catch (error) {
                ret = 'Time out ' + error;
                console.log('btcNodeDelay error:', error);
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;
        case 'eosNodeDelay':
            try {
                let startTime0 = Date.now();
                let result0 = await ccUtil.getEpochID('WAN');
                let cost0 = Date.now() - startTime0;

                let startTime = Date.now();
                let result = await ccUtil.getBalance('1xsridm5splx', 'EOS');
                let cost = Date.now() - startTime - cost0;
                if (cost < 0) {
                    cost = cost * -1;
                }
                if (!result) {
                    ret = 'Time out';
                } else {
                    if (cost < NETWORK_SLOW) {
                        ret = 'Good (' + cost + 'ms)';
                    } else {
                        ret = 'Slow (' + cost + 'ms)';
                    }
                }
            } catch (error) {
                ret = 'Time out ' + error;
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;
        case 'resetSettingsByOptions':
            let { attrs } = payload;
            try {
                setting.resetSettingsByOptions(attrs);
            } catch (e) {
                logger.error('resetSettingsByOptions failed:');
                logger.error(e.message || e.stack);
                err = e;
            }
            sendResponse([ROUTE_SETTING, [action, id].join('#')].join('_'), event, { err: err })
            break;

    }
})

ipc.on(ROUTE_CONTACTS, async (event, actionUni, payload) => {
    let ret, err, keys, vals = []
    let [chain, addr, obj] = payload;
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'addAddress':
            
            try {
                contacts.addAddress(chain, addr, obj);
                ret = true
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e

                ret = false
            }

            sendResponse([ROUTE_CONTACTS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break
        case 'addPrivateAddress':
            try {
                const [privateAddr, privateObj] = payload;
                contacts.addPrivateAddress(privateAddr, privateObj);
                ret = true
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e

                ret = false
            }

            sendResponse([ROUTE_CONTACTS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'delAddress':
            
            try {
                await contacts.delAddress(chain, addr);
                ret = true;
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e

                ret = false
            }

            sendResponse([ROUTE_CONTACTS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'delPrivateAddress':
            try {
                contacts.delPrivateAddress(chain);
                ret = true
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e

                ret = false
            }

            sendResponse([ROUTE_CONTACTS, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break

        case 'get':
            keys = payload[0];
            try {
                vals = contacts.get(keys);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CONTACTS, [action, id].join('#')].join('_'), event, { err: err, data: vals })
            break

        case 'reset':
            try {
                vals = await contacts.reset();
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_CONTACTS, [action, id].join('#')].join('_'), event, { err: err, data: vals })
            break
            
    }
})

ipc.on(ROUTE_STOREMAN, async (event, actionUni, payload) => {
    let ret, err
    const [action, id] = actionUni.split('#')

    switch (action) {
        case 'publicToAddress':
            try {
                let { wPk } = payload;
                ret = await ccUtil.publicToAddress(wPk);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'getRewardRatio':
            try {
                ret = await ccUtil.getRewardRatio();
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'openStoremanAction':
            try {
                let { tx, action, isEstimateFee } = payload;
                if (!tx.gasLimit || !Number(tx.gasLimit)) {
                    tx.gasLimit = 2000000;
                }
                // let gasPrice = await ccUtil.getGasPrice('wan');
                tx.gasPrice = '1'; // web3.utils.fromWei(gasPrice, 'gwei');
                logger.info(`Open Storeman ${action}, isEstimateFee:${isEstimateFee}` + JSON.stringify(tx));
                ret = await global.crossInvoker.invokeOpenStoremanTrans(action, tx, isEstimateFee);
                if (action === 'delegateClaim' && isEstimateFee === false && ret.result) {
                    ret.result.estimateGas = ret.result.estimateGas * 2;
                }
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;

        case 'insertStoremanTransToDB':
            try {
                logger.debug(`Try ${action}: ${JSON.stringify(payload, null, 4)}`);
                let { tx, satellite } = payload;
                await ccUtil.insertNormalTx(tx, tx.status, "external", satellite);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'getOpenStoremanGroupList':
            try {
                logger.debug(`Try ${action}`);
                ret = await ccUtil.getOpenStoremanGroupList();
                logger.debug(`Return ${action}: ${ret.length ? JSON.stringify(ret, null, 4) : null}`);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'getReadyOpenStoremanGroupList':
            try {
                logger.debug(`Try ${action}`);
                ret = await ccUtil.getReadyOpenStoremanGroupList();
                // logger.debug(`Return ${action}: ${ret.length ? JSON.stringify(ret, null, 4) : null}`);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'getStoremanStakeInfo':
            try {
                logger.debug(`Try ${action}: ${JSON.stringify(payload, null, 4)}`);
                ret = await ccUtil.getStoremanStakeInfo(payload.sender, payload.wkAddr);
                logger.debug(`Return ${action}: ${ret.length ? ret : null}`);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err: err, data: ret })
            break;

        case 'getStoremanDelegatorInfo':
            try {
                logger.debug(`Try ${action}: ${JSON.stringify(payload, null, 4)}`);
                ret = await ccUtil.getStoremanDelegatorInfo(payload.sender);
                logger.debug(`Return ${action}: ${ret.length ? JSON.stringify(ret, null, 4) : null}`);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;

        case 'getStoremanGroupMember':
            try {
                logger.debug(`Try ${action}: ${JSON.stringify(payload, null, 4)}`);
                ret = await ccUtil.getStoremanGroupMember(payload.groupId);
                logger.debug(`Return ${action}: ${ret.length ? JSON.stringify(ret, null, 4) : null}`);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;

        case 'getMultiStoremanGroupInfo':
            try {
                ret = await ccUtil.getMultiStoremanGroupInfo(payload.groupId);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;

        case 'getStoremanCandidates':
            try {
                logger.debug(`Try ${action}: ${JSON.stringify(payload, null, 4)}`);
                ret = await ccUtil.getStoremanCandidates(payload.groupId);
                logger.debug(`Return ${action}: ${ret.length ? JSON.stringify(ret, null, 4) : null}`);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;

        case 'getStoremanStakeTotalIncentive':
            try {
                logger.debug(`Try ${action}: ${JSON.stringify(payload, null, 4)}`);
                ret = await ccUtil.getStoremanStakeTotalIncentive(payload.sender);
                logger.debug(`Return ${action}: ${ret.length ? ret : null}`);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;

        case 'getStoremanDelegatorTotalIncentive':
            try {
                logger.debug(`Try ${action}: ${JSON.stringify(payload, null, 4)}`);
                ret = await ccUtil.getStoremanDelegatorTotalIncentive(payload.sender);
                logger.debug(`Return ${action}: ${ret.length ? ret : null}`);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;
        case 'getStoremanConf':
            try {
                ret = await ccUtil.getStoremanConf();
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;

        case 'getSelectedStoreman':
            try {
                ret = await ccUtil.getSelectedStoreman(payload);
            } catch (e) {
                logger.error(e.message || e.stack)
                err = e
            }
            sendResponse([ROUTE_STOREMAN, [action, id].join('#')].join('_'), event, { err, data: ret })
            break;

    }
})

function sendResponse(endpoint, e, payload) {
    const id = e.sender.id
    let senderWindow = Windows.getById(id)
    const { err } = payload

    if (_.isObject(err) || !_.isEmpty(err)) {
        payload.err = errorWrapper(err)
    }

    if (senderWindow) {
        senderWindow.send('renderer_windowMessage', endpoint, payload)
    } else {
        console.log('can not find window id');
    }
}

function errorWrapper(err) {
    return { desc: err.message, code: err.errno, cat: err.name }
}

function buildStakingBaseInfo(delegateInfo, incentive, epochID, stakeInfo) {
    let base = {
        myStake: "N/A",
        validatorCnt: "N/A",
        pendingWithdrawal: "N/A",
        epochID: "Epoch N/A",
        epochIDRaw: "N/A",
        epochEndTime: "N/A",
        currentTime: "N/A",
        currentRewardRate: "N/A %",
        stakePool: 0,
        currentRewardRateChange: "↑",
        totalDistributedRewards: "N/A",
        startFrom: dateFormat((new Date()) / 1000),
    };

    let totalStake = web3.utils.toBN(0);
    let withdrawStake = web3.utils.toBN(0);
    let validator = {};
    let totalReward = web3.utils.toBN(0);
    for (let i = 0; i < delegateInfo.length; i++) {
        const info = delegateInfo[i].stake;
        for (let m = 0; m < info.length; m++) {
            const staker = info[m];
            totalStake = web3.utils.toBN(staker.amount).add(totalStake);
            if (staker.quitEpoch != 0) {
                withdrawStake = web3.utils.toBN(staker.amount).add(withdrawStake);
            }

            if (!validator[staker.address]) {
                validator[staker.address] = web3.utils.toBN(staker.amount);
            } else {
                validator[staker.address] = web3.utils.toBN(staker.amount).add(validator[staker.address]);
            }
        }
    }

    // Calculate the total reward received by all user addresses
    for (let i = 0; i < incentive.length; i++) {
        const inc = incentive[i].incentive;
        for (let m = 0; m < inc.length; m++) {
            const one = inc[m];
            totalReward = web3.utils.toBN(one.amount).add(totalReward);
        }
    }

    base.myStake = Number(web3.utils.fromWei(totalStake.toString())).toFixed(0);
    base.pendingWithdrawal = Number(web3.utils.fromWei(withdrawStake.toString())).toFixed(0);
    base.totalDistributedRewards = Number(web3.utils.fromWei(totalReward.toString())).toFixed(2);

    base.validatorCnt = Object.getOwnPropertyNames(validator).length;

    if (typeof epochID === "number") {
        base.epochIDRaw = epochID;
    }

    let stakePool = web3.utils.toBN(0)
    if (stakeInfo) {
        for (let i = 0; i < stakeInfo.length; i++) {
            const si = stakeInfo[i];
            stakePool = web3.utils.toBN(si.amount).add(stakePool);
            for (let m = 0; m < si.clients.length; m++) {
                const cl = si.clients[m];
                stakePool = web3.utils.toBN(cl.amount).add(stakePool);
            }

            for (let m = 0; m < si.partners.length; m++) {
                const pr = si.partners[m];
                stakePool = web3.utils.toBN(pr.amount).add(stakePool);
            }
        }
    }

    base.stakePool = Number(web3.utils.fromWei(stakePool.toString())).toFixed(0);

    return base;
}

async function buildStakingList(delegateInfo, incentive, epochID, base, delegatorSupStakeInfo) {
    let list = [];

    for (let i = 0; i < delegateInfo.length; i++) {
        const di = delegateInfo[i];
        for (let m = 0; m < di.stake.length; m++) {
            const sk = di.stake[m]
            let ret = await getNameAndIcon(sk.address);
            let img, name;
            if (ret && ret.length > 0) {
                img = (ret[0].iconData && ret[0].iconData.length > 10) ? 'data:image/' + ret[0].iconType + ';base64,' + ret[0].iconData : ('data:image/png;base64,' + new Identicon(sk.address).toString());
                name = ret[0].name;
            }

            list.push({
                myAccount: di.account.name,
                balance: di.account.balance,
                accountAddress: di.account.address,
                accountPath: di.account.path,
                myStake: { title: web3.utils.fromWei(sk.amount), bottom: "0" },
                validator: {
                    name: name ? name : sk.address,
                    img: img,
                },
                validatorAddress: sk.address,
                distributeRewards: { title: "50,000", bottom: "50 days ago" },
                modifyStake: ["+", "-"],
                quitEpoch: sk.quitEpoch
            })
        }
    }

    // Calculate the reward each user address receives from each validator and the earliest reward time.
    let longestDays = 0;
    for (let i = 0; i < list.length; i++) {
        let validatorAddress = list[i].validatorAddress;
        let accountAddress = list[i].accountAddress;
        let distributeRewards = web3.utils.toBN(0);
        let minEpochId = 0;

        for (let m = 0; m < incentive.length; m++) {
            const inc = incentive[m];
            if (accountAddress == inc.account.address) {
                for (let n = 0; n < inc.incentive.length; n++) {
                    const obj = inc.incentive[n];

                    if (obj.address.toLowerCase() == validatorAddress.toLowerCase()) {
                        distributeRewards = web3.utils.toBN(obj.amount).add(distributeRewards);
                        minEpochId = obj.minEpochId;
                    }
                }
            }
        }

        let days = (epochID - minEpochId) * (global.slotCount * global.slotTime) / (24 * 3600); // 1 epoch last 1 days.
        if (days > longestDays) {
            longestDays = days;
        }

        if (minEpochId == 0) {
            list[i].distributeRewards = { title: Number(web3.utils.fromWei(distributeRewards)).toFixed(2), bottom: 'N/A' };
            list[i].myStake.bottom = 'N/A';
        } else {
            list[i].distributeRewards = { title: Number(web3.utils.fromWei(distributeRewards)).toFixed(2), bottom: (days) };
            list[i].myStake.bottom = days;
        }

        let d = new Date()
        d.setDate(d.getDate() - longestDays);
        base.startFrom = dateFormat(d / 1000);
    }

    return list;
}

async function getNameAndIcon(address) {
    let addr = address;
    let ret = undefined;
    if (!global.nameIcon) {
        global.nameIcon = {};
        global.nameIconUpdateTime = {};
    }

    let value = global.nameIcon[addr];
    if (!value) {
        let nowTime = Date.now()
        if (!global.nameIconUpdateTime[addr] || (nowTime > (global.nameIconUpdateTime[addr] + 3 * 60 * 1000))) {
            value = await ccUtil.getRegisteredValidator(addr);
            if (!value || value.length == 0) {
            } else {
                global.nameIcon[addr] = value;
                ret = value;
            }

            global.nameIconUpdateTime[addr] = Date.now();
        }
    } else {
        ret = value;
    }
    return ret;
}

async function retryRun(func, ...params) {
    const retryTime = 20;
    let times = 0;
    while (times < retryTime) {
        try {
            let ret = await func(...params);
            return ret;
        } catch (err) {
            console.log(err);
            console.log('retry after 3 second, last times:', retryTime - times);
            await sleep(6000);
            times++;
        }
    }
    throw new Error('rpc get error 30 times reached');
}

const getPathIdByType = function (type, isTestNet = false) {
    let ID
    switch (type) {
        case 'WAN':
            ID = 5718350;
            break;
        case 'BTC':
            ID = isTestNet ? 1 : 0;
            break;
        case 'BSC':
        case 'ETH':
            ID = 60;
            break;
        case 'EOS':
            ID = 194;
            break;
        case 'XRP':
            ID = 144;
            break;
    }
    return ID;
}

const str2Hex = (str = '0x') => {
    str = str.trim();
    if (/^0x/.test(str)) {
        return str;
    }
    return '0x' + Buffer.from(str, 'utf8').toString('hex');
}

const converter = (str, from, to) => {
    str = str.trim();
    if (from === 'hex') {
        if (/^0x/.test(str)) {
            str = str.substr(2);
        }
        return Buffer.from(str, from).toString(to);
    }
    if (to === 'hex') {
        return '0x' + Buffer.from(str, from).toString('hex');
    }
}
