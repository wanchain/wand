import { message } from 'antd';
import intl from 'react-intl-universal';
import TrezorConnect from '@trezor/connect-web';
import { wandWrapper } from 'utils/support.js';

import Common from '@ethereumjs/common';
import { TransactionFactory } from '@ethereumjs/tx';

const pu = require('promisefy-util');
const WanTx = require('wanchainjs-tx');

export const WAN_PATH = "m/44'/5718350'/0'/0";

export const trezorRawTx = async (param, BIP44Path) => {
  try {
    let rawTx = {
      from: param.from,
      chainId: Number(param.chainId),
      Txtype: 1,
      to: param.to,
      value: param.value || '0x0',
      data: param.data,
      nonce: '0x' + param.nonce.toString(16),
      gasPrice: '0x' + Number(param.gasPrice).toString(16),
      gasLimit: '0x' + Number(param.gasLimit).toString(16),
    };
    let raw = await pu.promisefy(signTransaction, [BIP44Path, rawTx], this);
    return Promise.resolve({ raw, rawTx })
  } catch (error) {
    console.log('trezorRawTx:', error)
    return Promise.reject(error)
  }
}

export const signTransaction = (path, tx, callback) => {
  TrezorConnect.ethereumSignTransaction({
    path,
    transaction: {
      to: tx.to,
      value: tx.value,
      data: tx.data,
      chainId: tx.chainId,
      nonce: tx.nonce,
      gasLimit: tx.gasLimit,
      gasPrice: tx.gasPrice,
    }
  }).then((result) => {
    if (!result.success) {
      message.warn(intl.get('Trezor.signTransactionFailed'));
      callback(intl.get('Trezor.signFailed'), null);
      return;
    }

    tx.v = result.payload.v;
    tx.r = result.payload.r;
    tx.s = result.payload.s;
    const common = Common.custom({ chainId: tx.chainId });
    let newTx = TransactionFactory.fromTxData(tx, { common });
    let signedTx = '0x' + newTx.serialize().toString('hex');
    console.log('Signed tx: ', signedTx);
    callback(null, signedTx);
  }).catch(err => callback(err));
}

export const getPublicKey = callback => {
  TrezorConnect.getPublicKey({
    path: WAN_PATH
  }).then(result => {
    if (result.success) {
      callback(null, result.payload);
    }
  }).catch(error => {
    callback(error, {})
  });
}

export const signPersonalMessage = async (path, message) => {
  let bHex = false;
  if (message.startsWith('0x')) {
    bHex = true;
    message = message.slice(2);
  }

  const result = await TrezorConnect.ethereumSignMessage({ path, message: message, hex: bHex });
  if (!result.success) {
    throw new Error('Signature failed!');
  }
  return '0x' + result.payload.signature;
}

export const getAddresses = async (basePath, from, count) => {
  let bundle = [];
  for (let i = from; i < from + count; i++) {
    const path = basePath + '/' + i.toString();
    bundle.push({ path: path, showOnTrezor: false });
  }
  if (bundle.length > 0) {
    const bundleResult = await TrezorConnect.ethereumGetAddress({
      bundle: bundle
    });
    if (!bundleResult.success) {
      throw new Error('Get address failed!');
    }

    return bundleResult;
  }
  return null;
}

export const OsmTrezorTrans = async (tx, from, action, satellite) => {
  try {
    let { result: estimateData } = await wandWrapper('storeman_openStoremanAction', { tx, action, isEstimateFee: false });
    let rawTx = {
      from,
      chainId: Number(estimateData.chainId),
      Txtype: 1,
      to: estimateData.to,
      value: estimateData.value,
      data: estimateData.data,
      nonce: '0x' + estimateData.nonce.toString(16),
      gasPrice: '0x' + Number(estimateData.gasPrice).toString(16),
      gasLimit: '0x' + Number(estimateData.gasLimit).toString(16),
    };
    let raw = await pu.promisefy(signTransaction, [tx.BIP44Path, rawTx], this);// Trezor sign
    // Send register validator
    let txHash = await pu.promisefy(wand.request, ['transaction_raw', { raw, chainType: 'WAN' }], this);
    let params = {
      txHash,
      from: from.toLowerCase(),
      to: rawTx.to,
      value: rawTx.value,
      gasPrice: rawTx.gasPrice,
      gasLimit: rawTx.gasLimit,
      nonce: rawTx.nonce,
      srcSCAddrKey: 'WAN',
      srcChainType: 'WAN',
      tokenSymbol: 'WAN',
      status: 'Sent',
    };
    // save register validator history into DB
    await pu.promisefy(wand.request, ['storeman_insertStoremanTransToDB', { tx: params, satellite }], this);
    return Promise.resolve();
  } catch (error) {
    console.log(error);
    message.error(intl.get('ValidatorRegister.registerFailed'));
    return Promise.reject(error);
  }
}

export const crossChainTrezorTrans = async param => {
  try {
    let approveZeroTxHash, approveTxHash;
    let satellite = {}
    let { from, to, toAddr, storeman, tokenPairID, crossType, amountUnit, BIP44Path } = param.input
    let ret = await wandWrapper('crossChain_getCrossChainContractData', param);
    let { result: crossChainData, approveZeroTx, approveTx, smgCrossMode, crossMode } = ret;
    console.log('crossChainData, approveZeroTx, approveTx:', crossChainData, approveZeroTx, approveTx)

    if (approveZeroTx) {
      let { raw } = await trezorRawTx(approveZeroTx, BIP44Path)
      approveZeroTxHash = await pu.promisefy(wand.request, ['transaction_raw', { raw, chainType: 'WAN' }], this);
      console.log('approveZeroTx:', approveZeroTxHash)
    }
    if (approveTx) {
      let { raw } = await trezorRawTx(approveTx, BIP44Path)
      approveTxHash = await pu.promisefy(wand.request, ['transaction_raw', { raw, chainType: 'WAN' }], this);
      console.log('approveTx:', approveTxHash)
    }
    let { raw, rawTx } = await trezorRawTx(crossChainData, BIP44Path)
    let dstLockedBlockNumber = '';
    if (['WAN', 'ETH', 'BTC'].includes(param.toChainSymbol)) {
      dstLockedBlockNumber = await wandWrapper('crossChain_getBlockNumber', { chainType: param.toChainSymbol })
    };
    // Send register validator
    let txHash = await pu.promisefy(wand.request, ['transaction_raw', { raw, chainType: 'WAN' }], this);
    let params = {
      txHash,
      from: from.toLowerCase(),
      fromAddr: from.toLowerCase(),
      to,
      toAddr,
      storeman,
      dstLockedBlockNumber,
      tokenPairID: tokenPairID,
      value: crossChainData.value,
      contractValue: '0x' + Number(amountUnit).toString(16),
      crossValue: crossChainData.crossValue,
      networkFee: crossChainData.networkFee,
      gasPrice: rawTx.gasPrice,
      gasLimit: rawTx.gasLimit,
      nonce: rawTx.nonce,
      srcSCAddrKey: param.sourceAccount,
      dstSCAddrKey: param.destinationAccount,
      srcChainType: param.sourceSymbol,
      dstChainType: param.destinationSymbol,
      tokenSymbol: param.tokenSymbol,
      tokenStand: param.tokenStand,
      crossType,
      crossMode: crossMode || 'Release',
      smgCrossMode: smgCrossMode || 'Release',
    };
    if (approveZeroTxHash) {
      params.approveZeroTxHash = approveZeroTxHash;
    }
    if (approveTxHash) {
      params.approveTxHash = approveTxHash;
    }
    if (param.destinationSymbol === 'XRP' && ret.LedgerVersion) {
      satellite.LedgerVersion = ret.LedgerVersion
    }
    // save register validator history into DB
    await pu.promisefy(wand.request, ['crossChain_insertCrossChainTransToDB', { tx: params, satellite }], this);
    return Promise.resolve();
  } catch (error) {
    console.log('crossChainTrezorTrans:', error);
    return Promise.reject(error);
  }
}
