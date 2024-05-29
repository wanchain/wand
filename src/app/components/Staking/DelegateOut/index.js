import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { Button, Form, message } from 'antd';
import { observer, inject } from 'mobx-react';
import { signTransaction } from 'componentUtils/trezor'

import style from './index.less';
import DelegateOutConfirmForm from '../DelegateOutConfirmForm';
import { toWei } from 'utils/support.js';
import { getNonce, getGasInfo, getContractAddr, getContractData, getChainId, fillRawTxGasPrice } from 'utils/helper';

const pu = require('promisefy-util');
const DelegateOutForm = Form.create({ name: 'DelegateOutConfirmForm' })(DelegateOutConfirmForm);

@inject(stores => ({
  ledgerAddrList: stores.wanAddress.ledgerAddrList,
  trezorAddrList: stores.wanAddress.trezorAddrList,
  updateStakeInfo: () => stores.staking.updateStakeInfo(),
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
}))

@observer
class DelegateOut extends Component {
  state = {
    visible: false,
    confirmLoading: false,
  }

  showDialog = () => {
    this.setState({
      visible: true
    });
  }

  handleCancel = () => {
    this.setState({
      visible: false,
      confirmLoading: false
    });
  }

  handleSend = async () => {
    this.setState({
      confirmLoading: true
    });
    let from = this.props.record.accountAddress;
    const { ledgerAddrList, trezorAddrList } = this.props;

    const WALLET_ID_NATIVE = 0x01; // Native WAN HD wallet
    const WALLET_ID_LEDGER = 0x02;
    const WALLET_ID_TREZOR = 0x03;

    let walletID = WALLET_ID_NATIVE;

    for (let i = 0; i < ledgerAddrList.length; i++) {
      const hdAddr = ledgerAddrList[i].address;
      if (hdAddr.toLowerCase() === from.toLowerCase()) {
        walletID = WALLET_ID_LEDGER
        break;
      }
    }

    for (let i = 0; i < trezorAddrList.length; i++) {
      const hdAddr = trezorAddrList[i].address;
      if (hdAddr.toLowerCase() === from.toLowerCase()) {
        walletID = WALLET_ID_TREZOR
        break;
      }
    }

    let tx = {
      from: this.props.record.accountAddress,
      validator: this.props.record.validator.address,
      path: this.props.record.accountPath,
      walletID: walletID,
      stakeAmount: this.props.record.myStake.title,
    }

    if (walletID === WALLET_ID_TREZOR) {
      await this.trezorDelegateOut(tx.path, tx.from, tx.validator, '0', tx.stakeAmount);
      this.setState({ visible: false });
      return;
    }

    if (walletID === WALLET_ID_LEDGER) {
      message.info(intl.get('Ledger.signTransactionInLedger'))
    }

    wand.request('staking_delegateOut', tx, (err, ret) => {
      if (err) {
        message.warn(intl.get('DelegateOut.delegateOutFailed'));
      } else {
        this.setState({ confirmLoading: false, visible: false });
        if (ret.code === true) {
          this.props.handleDisableGroup();
          message.success(intl.get('DelegateOut.delegateOutSuccessfully'));
        } else {
          message.warn(intl.get('DelegateOut.delegateOutFailed'));
        }
      }
    });
  }

  trezorDelegateOut = async (path, from, validator, value, stakeAmount) => {
    let func = 'delegateOut';
    try {
      let [chainId, nonce, gasInfo, data] = await Promise.all([getChainId(), getNonce(from, 'wan'), getGasInfo('wan'), getContractData(func, validator)]);
      let amountWei = toWei(value);
      const cscContractAddr = await getContractAddr();
      let rawTx = {};
      rawTx.from = from;
      rawTx.to = cscContractAddr;
      rawTx.value = amountWei;
      rawTx.data = data;
      rawTx.nonce = '0x' + nonce.toString(16);
      rawTx.gasLimit = '0x' + Number(200000).toString(16);
      fillRawTxGasPrice(gasInfo, rawTx, true);
      rawTx.chainId = chainId;

      let raw = await pu.promisefy(signTransaction, [path, rawTx], this);

      let txHash = await pu.promisefy(wand.request, ['transaction_raw', { raw, chainType: 'WAN' }], this);
      console.log('Transaction hash:', txHash);
      let params = {
        srcSCAddrKey: 'WAN',
        srcChainType: 'WAN',
        tokenSymbol: 'WAN',
        // hashX: txHash,
        txHash,
        from: from.toLowerCase(),
        validator: validator,
        annotate: 'DelegateOut',
        status: 'Sent',
        source: 'external',
        stakeAmount: stakeAmount,
        ...rawTx
      }

      await pu.promisefy(wand.request, ['staking_insertTransToDB', { rawTx: params }], this);
      this.props.updateStakeInfo();
      this.props.updateTransHistory();
    } catch (error) {
      message.error(error);
    }
  }

  render() {
    return (
      <div>
        <Button className={style.modifyExitBtn} disabled={!this.props.enableButton} onClick={this.showDialog} />
        {this.state.visible &&
          <DelegateOutForm onCancel={this.handleCancel} onSend={this.handleSend}
            confirmLoading={this.state.confirmLoading}
            record={this.props.record}
            title={intl.get('WithdrawForm.title')}
            note={intl.get('WithdrawForm.note')}
          />
        }
      </div>
    );
  }
}

export default DelegateOut;
