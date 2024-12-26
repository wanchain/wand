import BigNumber from 'bignumber.js';
import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Icon, message } from 'antd';
import { checkAmountUnit, getContractData, getContractAddr, getNonce, getGasPrice, getChainId } from 'utils/helper';
import { signTransaction } from 'componentUtils/trezor';
import { toWei } from 'utils/support.js';

import style from './index.less';
import PwdForm from 'componentUtils/PwdForm';
import CommonFormItem from 'componentUtils/CommonFormItem';
import ValidatorConfirmForm from 'components/Staking/ValidatorConfirmForm';
import { WANPATH, WALLETID } from 'utils/settings';

const pu = require('promisefy-util');
const Confirm = Form.create({ name: 'ValidatorConfirmForm' })(ValidatorConfirmForm);

@inject(stores => ({
  settings: stores.session.settings,
  addrInfo: stores.wanAddress.addrInfo,
  updateStakeInfo: () => stores.staking.updateStakeInfo(),
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
}))

@observer
class InForm extends Component {
  state = {
    confirmVisible: false,
    confirmLoading: false,
  };

  componentWillUnmount () {
    this.setState = (state, callback) => {
      return false;
    };
  }

  checkAmount = (rule, value, callback) => {
    let { form } = this.props;
    let balance = form.getFieldValue('balance');
    if (value === undefined || !checkAmountUnit(18, value)) {
      callback(intl.get('Common.invalidAmount'));
    }
    if (new BigNumber(value).lt(0)) {
      callback(intl.get('StakeInForm.stakeTooLow'));
      return;
    }
    if (new BigNumber(value).minus(balance).gte(0)) {
      callback(intl.get('SendNormalTrans.hasBalance'));
      return;
    }
    callback();
  }

  showConfirmForm = () => {
    let { form, settings, record, addrInfo } = this.props;
    let balance = addrInfo[record.myAddress.type][record.myAddress.addr].balance;
    form.validateFields(err => {
      if (err) return;
      if (new BigNumber(balance).minus(form.getFieldValue('amount')).lte(0)) {
        message.error(intl.get('NormalTransForm.overBalance'));
        return;
      }

      let pwd = form.getFieldValue('pwd');
      if (!settings.reinput_pwd) {
        this.setState({ confirmVisible: true });
      } else {
        wand.request('phrase_checkPwd', { pwd }, err => {
          if (err) {
            message.warn(intl.get('Backup.invalidPassword'));
          } else {
            this.setState({ confirmVisible: true });
          }
        })
      }
    })
  }

  onSend = async () => {
    this.setState({
      confirmLoading: true
    });
    let { form, record, addrInfo } = this.props;
    let from = record.myAddress.addr;
    let type = record.myAddress.type;
    let lockTime = record.lockTime;
    let publicKey1 = record.publicKey1;
    let amount = form.getFieldValue('amount');
    let path = type === 'normal' || type === 'rawKey' ? WANPATH + addrInfo[type][from].path : addrInfo[type][from].path;
    let walletID = type !== 'normal' ? WALLETID[type.toUpperCase()] : WALLETID.NATIVE;

    let tx = {
      from: from,
      amount: amount.toString(),
      BIP44Path: path,
      walletID: walletID,
      minerAddr: record.validator.address
    }

    if (WALLETID.TREZOR === walletID) {
      await this.trezorValidatorAppend(path, from.toLowerCase(), (amount || 0).toString(), lockTime, publicKey1);
      this.setState({ confirmVisible: false });
      this.props.onSend(walletID);
    } else {
      if (walletID === WALLETID.LEDGER) {
        message.info(intl.get('Ledger.signTransactionInLedger'))
      }
      wand.request('staking_validatorAppend', { tx }, (err, ret) => {
        if (err) {
          message.warn(intl.get('ValidatorRegister.topUpFailed'));
        }
        this.setState({ confirmVisible: false });
        this.props.onSend();
      });
    }
  }

  trezorValidatorAppend = async (path, from, value, lockTime, publicKey1) => {
    let chainId = await getChainId();
    let func = 'stakeAppend';// abi function
    try {
      let nonce = await getNonce(from, 'wan');
      let gasPrice = await getGasPrice('wan');
      let address = this.props.record.validator.address;
      let data = await getContractData(func, address);
      let amountWei = toWei(value);
      const cscContractAddr = await getContractAddr();
      let rawTx = {};
      rawTx.from = from;
      rawTx.to = cscContractAddr;
      rawTx.value = amountWei;
      rawTx.data = data;
      rawTx.nonce = '0x' + nonce.toString(16);
      rawTx.gasLimit = '0x' + Number(200000).toString(16);
      rawTx.gasPrice = toWei(gasPrice, 'gwei');
      rawTx.Txtype = Number(1);
      rawTx.chainId = chainId;
      let raw = await pu.promisefy(signTransaction, [path, rawTx], this);// Trezor sign

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
      let satellite = {
        secPk: publicKey1,
        lockTime,
        annotate: 'StakeAppend'
      }

      // save register validator history into DB
      await pu.promisefy(wand.request, ['staking_insertRegisterValidatorToDB', { tx: params, satellite }], this);
      this.props.updateStakeInfo();
      this.props.updateTransHistory();
    } catch (error) {
      console.log('Trezor validator append failed');
      console.log(error);
      message.error(intl.get('ValidatorRegister.topUpFailed'));
    }
  }

  onConfirmCancel = () => {
    this.setState({ confirmVisible: false, confirmLoading: false });
  }

  render () {
    const { onCancel, form, settings, record, addrInfo } = this.props;
    let showConfirmItem = { validatorAccount: true, myAddr: true, amount: true };
    let formValues = { publicKey1: record.publicKey1, myAddr: record.myAccount, amount: form.getFieldValue('amount') };

    return (
      <div>
        <Modal visible closable={false} destroyOnClose={true} title={intl.get('ValidatorRegister.topup')} className="validator-register-modal"
        footer={[
            <Button key="back" className="cancel" onClick={onCancel}>{intl.get('Common.cancel')}</Button>,
            <Button key="submit" type="primary" onClick={this.showConfirmForm}>{intl.get('Common.next')}</Button>,
          ]}
        >
          <div className="validator-bg">
            <div className="stakein-title">{intl.get('ValidatorRegister.validatorAccount')}</div>
            <CommonFormItem form={form} formName='validatorAccount' disabled={true}
              options={{ initialValue: record.validator.address, rules: [{ required: true }] }}
              title={intl.get('ValidatorRegister.validatorAccount')}
            />
          </div>
          <div className="validator-bg">
            <div className="stakein-title">{intl.get('ValidatorRegister.myAccount')}</div>
            <CommonFormItem form={form} formName='myAccount' disabled={true}
              options={{ initialValue: record.myAccount }}
              prefix={<Icon type="credit-card" className="colorInput" />}
              title={intl.get('ValidatorRegister.address')}
            />
            <CommonFormItem form={form} formName='balance' disabled={true}
              options={{ initialValue: addrInfo[record.myAddress.type][record.myAddress.addr].balance }}
              prefix={<Icon type="credit-card" className="colorInput" />}
              title={intl.get('ValidatorRegister.balance')}
            />
            <CommonFormItem form={form} formName='amount'
              options={{ initialValue: 100, rules: [{ required: true, validator: this.checkAmount }] }}
              prefix={<Icon type="credit-card" className="colorInput" />}
              title={intl.get('Common.amount')}
            />
            { settings.reinput_pwd && <PwdForm form={form}/> }
          </div>
        </Modal>
        { this.state.confirmVisible && <Confirm confirmLoading={this.state.confirmLoading} showConfirmItem={showConfirmItem} onCancel={this.onConfirmCancel} onSend={this.onSend} record={formValues} title={intl.get('NormalTransForm.ConfirmForm.transactionConfirm')} /> }
      </div>
    );
  }
}

const ValidatorInForm = Form.create({ name: 'InForm' })(InForm);
class ValidatorAppend extends Component {
  state = {
    visible: false
  }

  handleStateToggle = () => {
    this.setState(state => ({ visible: !state.visible }));
  }

  handleSend = () => {
    this.setState({ visible: false });
  }

  render () {
    return (
      <div>
        <Button className={style.modifyTopUpBtn} onClick={this.handleStateToggle} disabled={this.props.record.nextLockTime === 0}/>
        {this.state.visible && <ValidatorInForm onCancel={this.handleStateToggle} onSend={this.handleSend} record={this.props.record} />}
      </div>
    );
  }
}

export default ValidatorAppend;
