import intl from 'react-intl-universal';
import { message, Button, Form } from 'antd';
import React, { useState, useContext } from 'react';
import { observer, MobXProviderContext } from 'mobx-react';

import useToggle from 'hooks/useToggle';
import { INBOUND, CROSS_TYPE } from 'utils/settings';
import { crossChainTrezorTrans } from 'componentUtils/trezor';
import CrossXRPForm from 'components/CrossChain/CrossChainTransForm/CrossXRPForm';
import BigNumber from 'bignumber.js';

const CollectionCreateForm = Form.create({ name: 'CrossXRPForm' })(CrossXRPForm);

const XRPTrans = observer(({ record, type }) => {
  const { languageIntl, crossChain, sendCrossChainParams: { updateRecord, updateXRPTransParams, XRPCrossTransParams } } = useContext(MobXProviderContext)
  const [visible, toggleVisible] = useToggle(false);
  const tokenPairID = crossChain.currTokenPairId;
  const tokenPairsInfo = crossChain.tokenPairs[tokenPairID];

  const showModal = () => {
    updateRecord(Object.assign(record, { type }));
    const chainType = type === INBOUND ? crossChain.currentTokenPairInfo.fromChainSymbol : crossChain.currentTokenPairInfo.toChainSymbol;
    updateXRPTransParams({ from: { walletID: record.wid || record.walletID, path: record.path }, fromAddr: record.address, chainType, tokenPairID });
    toggleVisible();
  }

  const handleSend = () => {
    const input = {
      tokenPairID,
      crossType: CROSS_TYPE[0],
      to: XRPCrossTransParams.to,
      from: XRPCrossTransParams.from,
      storeman: XRPCrossTransParams.groupId,
      receivedAmount: XRPCrossTransParams.receivedAmount,
      crosschainFee: XRPCrossTransParams.crosschainFee,
      amountUnit: new BigNumber(XRPCrossTransParams.receivedAmount).multipliedBy(Math.pow(10, tokenPairsInfo.ancestorDecimals)).toString(10)
    }
    if (type === INBOUND) {
      input.tag = '0';
      input.value = XRPCrossTransParams.value;
      input.smgXrpAddr = XRPCrossTransParams.groupAddr;
      input.networkFee = new BigNumber(XRPCrossTransParams.networkFee).multipliedBy(Math.pow(10, 6));
    } else {
      input.amount = XRPCrossTransParams.value;
      input.gasPrice = XRPCrossTransParams.gasPrice;
      input.baseFeePerGas = XRPCrossTransParams.baseFeePerGas;
      input.gasLimit = XRPCrossTransParams.gasLimit;
      input.networkFee = new BigNumber(XRPCrossTransParams.networkFee).multipliedBy(Math.pow(10, 18));
    }
    const info = type === INBOUND ? {
      toChainSymbol: tokenPairsInfo.toChainSymbol,
      sourceSymbol: tokenPairsInfo.fromChainSymbol,
      sourceAccount: tokenPairsInfo.fromAccount,
      destinationSymbol: tokenPairsInfo.toChainSymbol,
      destinationAccount: tokenPairsInfo.toAccount,
    } : {
      toChainSymbol: tokenPairsInfo.toChainSymbol,
      sourceSymbol: tokenPairsInfo.toChainSymbol,
      sourceAccount: tokenPairsInfo.toAccount,
      destinationSymbol: tokenPairsInfo.fromChainSymbol,
      destinationAccount: tokenPairsInfo.fromAccount,
    }
    const trans = Object.assign(info, { input, tokenPairID, type: 'LOCK' })

    return new Promise((resolve, reject) => {
      if (input.from.walletID === 2) {
        message.info(intl.get('Ledger.signTransactionInLedger'))
      }
      if (type !== INBOUND && input.from.walletID === 3) {
        input.BIP44Path = input.from.path;
        input.from = XRPCrossTransParams.fromAddr;
        input.toAddr = XRPCrossTransParams.toAddr;
        crossChainTrezorTrans({ tokenSymbol: 'XRP', tokenStand: 'XRP', ...trans }).then(() => {
          message.success(intl.get('Send.transSuccess'));
          toggleVisible()
        }).catch(() => {
          message.warn(intl.get('WanAccount.sendTransactionFailed'));
          toggleVisible();
        })
      } else {
        wand.request('crossChain_crossChain', trans, (err, txHash) => {
          if (err) {
            console.log('crossChain_crossChain_XRP_err:', err)
            if (err instanceof Object && err.desc && err.desc.includes('ready')) {
              message.warn(intl.get('Common.networkError'));
            } else {
              message.warn(err.desc);
            }
            toggleVisible();
          } else {
            if (txHash.code === false) {
              console.log('crossChain_crossChain_XRP_txHash:', txHash)
              message.warn(intl.get('WanAccount.sendTransactionFailed'));
              toggleVisible();
            } else {
              message.success(intl.get('WanAccount.sendTransactionSuccessFully'));
              console.log('Tx hash: ', txHash);
              toggleVisible()
            }
          }
        });
      }
    })
  }

  return (
    <React.Fragment>
      <Button type="primary" onClick={showModal}>{intl.get('Common.convert')}</Button>
      {
        visible &&
        <CollectionCreateForm toggleVisible={toggleVisible} onSend={handleSend}/>
      }
    </React.Fragment>
  )
});

export default XRPTrans;
