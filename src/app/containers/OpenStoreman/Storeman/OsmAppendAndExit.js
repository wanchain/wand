import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Icon, message, Spin } from 'antd';

import './index.less';
import { WALLETID, ESTFEE_FAILED_INFO } from 'utils/settings';
import PwdForm from 'componentUtils/PwdForm';
import { wandWrapper, fromWei } from 'utils/support.js';
import { signTransaction } from 'componentUtils/trezor';
import StoremanConfirmForm from './StoremanConfirmForm';
import CommonFormItem from 'componentUtils/CommonFormItem';
import style from 'components/Staking/MyValidatorsList/index.less';
import { getValueByAddrInfo, checkAmountUnit } from 'utils/helper';

const MINAMOUNT = 100;
const pu = require('promisefy-util');
const Confirm = Form.create({ name: 'StoremanConfirmForm' })(StoremanConfirmForm);

@inject(stores => ({
  settings: stores.session.settings,
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  updateStakeInfo: () => stores.staking.updateStakeInfo(),
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
}))

@observer
class ModifyForm extends Component {
  constructor(props) {
    super(props)
    this.state = {
      gasPrice: '0',
      gasLimit: '0',
      confirmVisible: false,
      confirmLoading: false,
      fee: props.txParams.fee,
      isExit: props.modifyType === 'exit',
    }
  }

  componentDidUpdate(prevProps) {
    if (this.props.txParams.fee !== '0' && prevProps.txParams.fee === '0') {
      this.setState({
        fee: this.props.txParams.fee,
        gasLimit: this.props.txParams.gasLimit,
        gasPrice: this.props.txParams.gasPrice
      })
    }
  }

  componentWillUnmount () {
    this.setState = (state, callback) => {
      return false;
    };
  }

  showConfirmForm = () => {
    let { form, settings } = this.props;
    form.validateFields(err => {
      if (err) return;
      if (new BigNumber(form.getFieldValue('balance')).minus(this.state.isExit ? '0' : form.getFieldValue('amount')).lt(this.state.fee)) {
        message.warn(intl.get('NormalTransForm.overBalance'));
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
    this.setState({ confirmLoading: true });
    let { record, form } = this.props;
    let { path, addr: from, walletID } = record.myAddress;
    let action = this.state.isExit ? 'stakeOut' : 'stakeAppend';
    let amount = this.state.isExit ? '0' : form.getFieldValue('amount');
    let tx = {
      from,
      amount,
      walletID,
      wkAddr: record.wkAddr,
      BIP44Path: path,
      gasLimit: this.state.gasLimit,
    };

    if (walletID === WALLETID.LEDGER) {
      message.info(intl.get('Ledger.signTransactionInLedger'));
    }
    if (WALLETID.TREZOR === walletID) {
      let satellite = { wkAddr: record.wkAddr, annotate: action === 'stakeAppend' ? 'Storeman-stakeAppend' : 'Storeman-stakeOut' };
      try {
        await this.trezorTrans(path, from, amount, action, satellite);
      } catch (err) {
        message.warn(intl.get('WanAccount.sendTransactionFailed'));
        console.log(`trezorTrans Error: ${err}`)
      }
      message.success(intl.get('WanAccount.sendTransactionSuccessFully'));
      this.setState({ confirmVisible: false });
      this.props.onSend(walletID);
    } else {
      wand.request('storeman_openStoremanAction', { tx, action }, (err, ret) => {
        if (err) {
          message.warn(intl.get('WanAccount.sendTransactionFailed'));
        } else {
          console.log('validatorModify ret:', ret);
          message.success(intl.get('WanAccount.sendTransactionSuccessFully'));
        }
        this.props.updateTransHistory();
        this.setState({ confirmVisible: false, confirmLoading: false });
        this.props.onSend();
      });
    }
  }

  trezorTrans = async (BIP44Path, from, amount, action, satellite) => {
    try {
      let tx = {
        amount,
        BIP44Path,
        walletID: WALLETID.TREZOR,
        wkAddr: this.props.record.wkAddr,
        from: from.indexOf(':') === -1 ? from : from.split(':')[1].trim(),
      }
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
        gasLimit: '0x' + Number(new BigNumber(estimateData.gasLimit).multipliedBy(1.6).toString(10)).toString(16),
      };
      let raw = await pu.promisefy(signTransaction, [BIP44Path, rawTx], this);// Trezor sign
      // Send modify validator info
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

      await pu.promisefy(wand.request, ['storeman_insertStoremanTransToDB', { tx: params, satellite }], this);
      this.props.updateStakeInfo();
      this.props.updateTransHistory();
    } catch (error) {
      console.log(error);
      message.warn(intl.get('WanAccount.sendTransactionFailed'));
    }
  }

  onConfirmCancel = () => {
    this.setState({ confirmVisible: false, confirmLoading: false });
  }

  checkAmount = (rule, value, callback) => {
    let { form, record } = this.props;
    let balance = form.getFieldValue('balance');
    if (value === undefined || !checkAmountUnit(18, value)) {
      callback(intl.get('Common.invalidAmount'));
    }
    if (new BigNumber(value).lt(MINAMOUNT)) {
      callback(intl.get('Common.amountTooLow', { minAmount: MINAMOUNT }));
      return;
    }
    if (new BigNumber(value).gte(balance)) {
      callback(intl.get('SendNormalTrans.hasBalance'));
      return;
    }
    let { path, addr: from, walletID } = record.myAddress;
    let tx = {
      from,
      amount: value,
      walletID,
      BIP44Path: path,
      wkAddr: record.wkAddr,
    };
    wand.request('storeman_openStoremanAction', { tx, action: 'stakeAppend', isEstimateFee: false }, (err, ret) => {
      if (err) {
        message.warn(intl.get('NormalTransForm.estimateGasFailed'));
      } else {
        let data = ret.result;
        data.estimateGas = new BigNumber(data.estimateGas).multipliedBy(1.6).toString(10);
        this.setState({
          gasPrice: data.gasPrice,
          gasLimit: data.estimateGas,
          fee: fromWei(new BigNumber(data.gasPrice).multipliedBy(data.estimateGas).toString(10))
        })
      }
    });
    callback();
  }

  render () {
    const { isExit } = this.state;
    const { onCancel, form, settings, record, addrInfo, spin } = this.props;
    let title = intl.get(isExit ? 'TransHistory.Storeman-stakeOut' : 'TransHistory.StakeAppend');
    let balance = getValueByAddrInfo(record.myAddress.addr, 'balance', addrInfo)
    let showConfirmItem = { groupId: true, crosschain: true, account: true, amount: !isExit };

    return (
      <div>
        <Modal visible closable={false} destroyOnClose={true} title={title} className="validator-register-modal + spincont"
          footer={[
            <Button key="back" className="cancel" onClick={onCancel}>{intl.get('Common.cancel')}</Button>,
            <Button disabled={spin} key="submit" type="primary" onClick={this.showConfirmForm}>{intl.get('Common.next')}</Button>,
          ]}
        >
          <Spin spinning={spin} size="large">
            <div className="validator-bg">
              <div className="stakein-title">{intl.get('Storeman.storemanAccount')}</div>
              <CommonFormItem form={form} formName='crosschain' disabled={true}
                options={{ initialValue: record.crosschain, rules: [{ required: true }] }}
                title={intl.get('Common.crossChain')}
              />
              <CommonFormItem form={form} formName='groupId' disabled={true}
                options={{ initialValue: record.groupIdName, rules: [{ required: true }] }}
                title={intl.get('Storeman.group')}
              />
            </div>
            <div className="validator-bg">
              <div className="stakein-title">{intl.get('ValidatorRegister.myAccount')}</div>
              <CommonFormItem form={form} formName='myAccount' disabled={true}
                options={{ initialValue: record.account }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('ValidatorRegister.address')}
              />
              <CommonFormItem form={form} formName='balance' disabled={true}
                options={{ initialValue: balance }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('ValidatorRegister.balance')}
              />
              {
                !isExit &&
                <CommonFormItem form={form} formName='amount'
                  options={{ rules: [{ required: true, validator: this.checkAmount }] }}
                  prefix={<Icon type="credit-card" className="colorInput" />}
                  title={intl.get('Common.amount')}
                  placeholder={MINAMOUNT}
                  autoFocus={true}
                />
              }
              <CommonFormItem form={form} formName='fee' disabled={true}
                options={{ initialValue: this.state.fee + ' WAN' }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('CrossChainTransForm.estimateFee')}
              />
              {settings.reinput_pwd && <PwdForm form={form} />}
            </div>
          </Spin>
        </Modal>
        {this.state.confirmVisible && <Confirm confirmLoading={this.state.confirmLoading} showConfirmItem={showConfirmItem} onCancel={this.onConfirmCancel} onSend={this.onSend} record={Object.assign({}, record, { amount: form.getFieldValue('amount') })} title={intl.get('NormalTransForm.ConfirmForm.transactionConfirm')} />}
      </div>
    );
  }
}

const StoremanModifyForm = Form.create({ name: 'ModifyForm' })(ModifyForm);
class OsmAppendAndExit extends Component {
  state = {
    txParams: {
      fee: '0',
      gasPrice: '0',
      gasLimit: '0',
    },
    visible: false,
    spin: this.props.modifyType === 'exit',
  }

  handleStateToggle = () => {
    let { record, modifyType } = this.props;
    this.setState({ visible: true });
    if (modifyType === 'exit') {
      let { path, addr, walletID } = record.myAddress;
      let tx = {
        walletID,
        from: addr,
        amount: '0',
        BIP44Path: path,
        wkAddr: record.wkAddr,
      };
      wand.request('storeman_openStoremanAction', { tx, action: 'stakeOut', isEstimateFee: false }, (err, ret) => {
        if (err || (ret && !ret.code)) {
          if (ret && !ret.code && ESTFEE_FAILED_INFO.filter(i => ret.result.includes(i))) {
            message.warn(intl.get('NormalTransForm.insufficientFee'));
          } else {
            message.warn(intl.get('NormalTransForm.estimateGasFailed'));
          }
          this.setState({ visible: false });
        } else {
          let data = ret.result;
          data.estimateGas = new BigNumber(data.estimateGas).multipliedBy(1.6).toString(10);
          this.setState({
            spin: false,
            txParams: {
              gasPrice: data.gasPrice,
              gasLimit: data.estimateGas,
              fee: fromWei(new BigNumber(data.gasPrice).multipliedBy(data.estimateGas).toString(10))
            }
          })
        }
      });
    }
  }

  handleSend = () => {
    this.setState({ visible: false });
  }

  render () {
    const { record, modifyType, enableButton } = this.props;
    return (
      <div>
        <Button className={style.modifyTopUpBtn} disabled={ ['unselected', 'quitting', 'quitted', 'failed'].includes(record.oriStatus) || (modifyType === 'exit' && !enableButton) } onClick={this.handleStateToggle} />
        { this.state.visible &&
          <StoremanModifyForm txParams={this.state.txParams} spin={this.state.spin} onCancel={this.handleSend} onSend={this.handleSend} record={record} modifyType={modifyType} />
        }
      </div>
    );
  }
}

export default OsmAppendAndExit;
