import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Icon, message, Spin } from 'antd';

import './index.less';
import { WALLETID } from 'utils/settings';
import PwdForm from 'componentUtils/PwdForm';
import { toWei, fromWei } from 'utils/support';
import { signTransaction } from 'componentUtils/trezor';
import CommonFormItem from 'componentUtils/CommonFormItem';
import DelegationConfirmForm from './DelegationConfirmForm';
import style from 'components/Staking/MyValidatorsList/index.less';
import { getContractAddr, getNonce, getGasPrice, getChainId, getValueByAddrInfo, checkAmountUnit, getStoremanContractData } from 'utils/helper';

const MINAMOUNT = 1;
const pu = require('promisefy-util');
const Confirm = Form.create({ name: 'DelegationConfirmForm' })(DelegationConfirmForm);

@inject(stores => ({
  settings: stores.session.settings,
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  storemanConf: stores.openstoreman.storemanConf,
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
}))

@observer
class ModifyForm extends Component {
  constructor (props) {
    super(props);
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
    let action = this.state.isExit ? 'delegateOut' : 'delegateIn';
    let amount = this.state.isExit ? '0' : form.getFieldValue('amount');
    let tx = {
      from,
      amount,
      walletID,
      BIP44Path: path,
      wkAddr: record.wkAddr,
      gasLimit: this.state.gasLimit,
      gasPrice: fromWei(this.state.gasPrice),
    };

    if (walletID === WALLETID.LEDGER) {
      message.info(intl.get('Ledger.signTransactionInLedger'));
    }

    if (WALLETID.TREZOR === walletID) {
      let abiParams = [record.wkAddr];
      let satellite = { wkAddr: record.wkAddr, annotate: action === 'delegateIn' ? 'StoremanDelegateIn' : 'StoremanDelegateOut' };
      await this.trezorValidatorUpdate(path, from, amount, action, satellite, abiParams);
      this.setState({ confirmVisible: false });
      this.props.onSend(walletID);
    } else {
      wand.request('storeman_openStoremanAction', { tx, action }, (err, ret) => {
        if (err) {
          message.warn(intl.get('ValidatorRegister.updateFailed'));
        } else {
          console.log('validatorModify ret:', ret);
        }
        this.setState({ confirmVisible: false, confirmLoading: false });
        this.props.onSend();
      });
    }
  }

  trezorValidatorUpdate = async (path, from, value, action, satellite, abiParams) => {
    try {
      let { chainId, nonce, gasPrice, data, to } = await Promise.all([getChainId(), getNonce(from, 'wan'), getGasPrice('wan'), getStoremanContractData(action, ...abiParams), getContractAddr()])
      let rawTx = {
        to,
        from,
        data,
        chainId,
        Txtype: 1,
        value: toWei(value),
        nonce: '0x' + nonce.toString(16),
        gasLimit: '0x' + Number(200000).toString(16),
        gasPrice: toWei(gasPrice, 'gwei'),
      };

      let raw = await pu.promisefy(signTransaction, [path, rawTx], this);// Trezor sign
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
        status: 'Sending',
      };
      await pu.promisefy(wand.request, ['storeman_insertStoremanTransToDB', { tx: params, satellite }], this);
      this.props.updateTransHistory();
    } catch (error) {
      message.error(intl.get('ValidatorRegister.updateFailed'));
    }
  }

  onConfirmCancel = () => {
    this.setState({ confirmVisible: false, confirmLoading: false });
  }

  checkAmount = (rule, value, callback) => {
    let { record, form } = this.props;
    let { capacity, balance } = form.getFieldsValue(['capacity', 'balance']);

    if (value === undefined || !checkAmountUnit(18, value)) {
      callback(intl.get('Common.invalidAmount'));
    }
    if (new BigNumber(value).lt(MINAMOUNT)) {
      callback(intl.get('ValidatorRegister.stakeTooLow'));
      return;
    }
    if (!this.state.isExit && new BigNumber(value).gt(capacity)) {
      callback(intl.get('StakeInForm.stakeExceed'));
      return;
    }
    if (new BigNumber(value).gte(balance)) {
      callback(intl.get('SendNormalTrans.hasBalance'));
      return;
    }
    let { path, addr: from, walletID } = record.myAddress;
    let tx = {
      from,
      walletID,
      amount: value,
      BIP44Path: path,
      wkAddr: record.wkAddr,
    };
    wand.request('storeman_openStoremanAction', { tx, action: 'delegateIn', isEstimateFee: false }, (err, ret) => {
      if (err) {
        message.warn(intl.get('ValidatorRegister.updateFailed'));
      } else {
        let data = ret.result;
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
    const { onCancel, form, settings, record, addrInfo, storemanConf, spin } = this.props;
    let title = isExit ? 'Delegation Exit' : 'Delegation Top-up';
    let balance = getValueByAddrInfo(record.myAddress.addr, 'balance', addrInfo)
    let showConfirmItem = { storeman: true, groupId: true, crosschain: true, account: true, amount: !isExit };

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
              <div className="stakein-title">Storeman Account</div>
              <CommonFormItem form={form} formName='storeman' disabled={true}
                options={{ initialValue: record.wkAddr, rules: [{ required: true }] }}
                title='Storeman Account'
              />
              {
                !isExit &&
                <CommonFormItem form={form} formName='capacity' disabled={true} title='Capacity'
                  options={{
                    rules: [{ required: true }],
                    initialValue: new BigNumber(fromWei(record.deposit) * (storemanConf.delegationMulti || 0)).minus(fromWei(record.delegateDeposit)).toString(10)
                  }}
                />
              }
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
                title={intl.get('Common.balance')}
              />
              {
                !isExit &&
                <CommonFormItem form={form} formName='amount'
                  options={{ rules: [{ required: true, validator: this.checkAmount }] }}
                  prefix={<Icon type="credit-card" className="colorInput" />}
                  title={intl.get('Common.amount')}
                  placeholder={MINAMOUNT}
                />
              }
              <CommonFormItem form={form} formName='fee' disabled={true}
                options={{ initialValue: this.state.fee + ' WAN' }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title="Gas Fee"
              />
              { settings.reinput_pwd && <PwdForm form={form} /> }
            </div>
          </Spin>
        </Modal>
        {this.state.confirmVisible && <Confirm confirmLoading={this.state.confirmLoading} showConfirmItem={showConfirmItem} onCancel={this.onConfirmCancel} onSend={this.onSend} record={Object.assign({}, record, { amount: form.getFieldValue('amount') })} title={intl.get('NormalTransForm.ConfirmForm.transactionConfirm')} />}
      </div>
    );
  }
}

const DelegationModifyForm = Form.create({ name: 'ModifyForm' })(ModifyForm);
class DelegateAppendAndExit extends Component {
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
      wand.request('storeman_openStoremanAction', { tx, action: 'delegateOut', isEstimateFee: false }, (err, ret) => {
        if (err) {
          message.warn(intl.get('ValidatorRegister.updateFailed'));
        } else {
          let data = ret.result;
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
        <Button className={style.modifyTopUpBtn} disabled={ modifyType === 'exit' && !enableButton } onClick={this.handleStateToggle} />
        { this.state.visible &&
          <DelegationModifyForm spin={this.state.spin} onCancel={this.handleSend} onSend={this.handleSend} record={record} modifyType={modifyType} txParams={this.state.txParams} />
        }
      </div>
    );
  }
}

export default DelegateAppendAndExit;
