import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Icon, message, Row, Col, Slider } from 'antd';
import { getContractData, getContractAddr, getNonce, getGasPrice, getChainId } from 'utils/helper';
import { signTransaction } from 'componentUtils/trezor';
import { toWei } from 'utils/support.js';

import style from './index.less';
import PwdForm from 'componentUtils/PwdForm';
import CommonFormItem from 'componentUtils/CommonFormItem';
import ValidatorModifySelect from 'componentUtils/ValidatorModifySelect';
import ValidatorConfirmForm from 'components/Staking/ValidatorConfirmForm';
import { isNumber } from 'utils/support';
import { MINDAYS, MAXDAYS, WANPATH, WALLETID } from 'utils/settings'

const pu = require('promisefy-util');
const Confirm = Form.create({ name: 'ValidatorConfirmForm' })(ValidatorConfirmForm);
const modifyTypes = {
  lockTime: 'ValidatorRegister.lockTime',
  feeRate: 'ValidatorRegister.feeRate'
}

@inject(stores => ({
  settings: stores.session.settings,
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  updateStakeInfo: () => stores.staking.updateStakeInfo(),
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
}))

@observer
class ModifyForm extends Component {
  constructor (props) {
    super(props);
    this.state = {
      selectType: '',
      confirmVisible: false,
      confirmLoading: false,
      lockTime: props.record.lockTime,
      showConfirmItem: {},
    }
  }

  componentWillUnmount () {
    this.setState = (state, callback) => {
      return false;
    };
  }

  showConfirmForm = () => {
    let { form, settings, modifyType } = this.props;
    form.validateFields(err => {
      if (err) return;
      if (modifyType === 'exit') {
        this.setState({ showConfirmItem: { validatorAccount: true, myAddr: true } })
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
    let { form, record, addrInfo, modifyType } = this.props;
    let from = record.myAddress.addr;
    let type = record.myAddress.type;
    let walletID = type !== 'normal' ? WALLETID[type.toUpperCase()] : WALLETID.NATIVE;
    let path = type !== 'normal' || type !== 'rawKey' ? addrInfo[type][from].path : WANPATH + addrInfo[type][from].path;
    let tx = {
      from: from,
      amount: 0,
      BIP44Path: path,
      walletID: walletID,
      minerAddr: record.validator.address
    };

    if (walletID === WALLETID.LEDGER) {
      message.info(intl.get('Ledger.signTransactionInLedger'));
    }

    if (modifyType === 'exit' || this.handleShowSelectType('lockTime')) {
      let lockTime = modifyType === 'exit' ? 0 : form.getFieldValue('lockTime');
      let type = 'stakeUpdate';
      Object.assign(tx, { lockTime });

      if (WALLETID.TREZOR === walletID) {
        await this.trezorValidatorUpdate(path, from, type, lockTime);
        this.setState({ confirmVisible: false });
        this.props.onSend(walletID);
      } else {
        wand.request('staking_validatorUpdate', { tx }, (err, ret) => {
          if (err) {
            message.warn(intl.get('ValidatorRegister.updateFailed'));
          }
          this.setState({ confirmVisible: false, confirmLoading: false });
          this.props.onSend();
        });
      }
    }
    if (this.handleShowSelectType('feeRate')) {
      Object.assign(tx, {
        feeRate: Math.round(form.getFieldValue('feeRate') * 100),
      })

      if (WALLETID.TREZOR === walletID) {
        let type = 'stakeUpdateFeeRate';
        await this.trezorValidatorUpdate(path, from, type, tx.feeRate);
        this.setState({ confirmVisible: false });
        this.props.onSend(walletID);
      } else {
        wand.request('staking_getCurrentEpochInfo', null, (err, ret) => {
          if (err) {
            message.warn(intl.get('ValidatorRegister.updateFailed'));
          } else {
            if (ret.epochId === record.feeRateChangedEpoch) {
              message.warn(intl.get('ValidatorRegister.modifyFeeRateWarning'))
              return;
            }
            wand.request('staking_PosStakeUpdateFeeRate', { tx }, (err, ret) => {
              if (err) {
                // message.warn(err.message);
                message.warn(intl.get('ValidatorRegister.updateFailed'));
              } else {
                console.log('PosStakeUpdateFeeRate ret:', ret);
              }
              this.setState({ confirmVisible: false, confirmLoading: false });
              this.props.onSend();
            });
          }
        })
      }
    }
  }

  trezorValidatorUpdate = async (path, from, func, value) => {
    let { record } = this.props;
    let chainId = await getChainId();
    try {
      let nonce = await getNonce(from, 'wan');
      let gasPrice = await getGasPrice('wan');
      let address = record.validator.address;
      let data = await getContractData(func, address, value);
      let amountWei = toWei('0');
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
      let satellite = {
        secPk: record.publicKey1,
        lockTime: record.lockTime,
        annotate: func === 'stakeUpdate' ? 'StakeUpdate' : 'StakeUpdateFeeRate'
      }

      // save register validator history into DB
      await pu.promisefy(wand.request, ['staking_insertRegisterValidatorToDB', { tx: params, satellite }], this);
      // Update stake info & history
      this.props.updateStakeInfo();
      this.props.updateTransHistory();
    } catch (error) {
      console.log(error);
      message.error(intl.get('ValidatorRegister.updateFailed'));
    }
  }

  onChangeModifyTypeSelect = (value, option) => {
    let showConfirmItem;
    if (Object.keys(modifyTypes)[option.key] === 'lockTime') {
      showConfirmItem = { validatorAccount: true, myAddr: true, lockTime: true }
    }
    if (Object.keys(modifyTypes)[option.key] === 'feeRate') {
      showConfirmItem = { validatorAccount: true, myAddr: true, feeRate: true }
    }
    this.setState(() => ({ selectType: option.key, showConfirmItem }));
  }

  onSliderChange = value => {
    this.setState({ lockTime: value })
  }

  onConfirmCancel = () => {
    this.setState({ confirmVisible: false, confirmLoading: false });
  }

  checkMaxFeeRate = (rule, value, callback) => {
    let { feeRate, maxFeeRate } = this.props.record;
    try {
      if (!isNumber(value)) {
        callback(intl.get('NormalTransForm.invalidFeeRate'));
        return;
      }
      if (value < 0 || value > maxFeeRate) {
        callback(intl.get('NormalTransForm.invalidFeeRate'));
        return;
      }
      if (value.toString().split('.')[1] && value.toString().split('.')[1].length > 2) {
        callback(intl.get('NormalTransForm.invalidFeeRate'));
        return;
      }
      if (value > feeRate && value > feeRate + 1) {
        callback(intl.get('NormalTransForm.invalidFeeRate'));
        return;
      }
      callback();
    } catch (err) {
      callback(intl.get('NormalTransForm.invalidFeeRate'));
    }
  }

  handleShowSelectType (type) {
    return this.state.selectType === Object.keys(modifyTypes).findIndex(val => val === type).toString();
  }

  render () {
    const { onCancel, form, settings, record, addrInfo, modifyType } = this.props;
    const { getFieldDecorator, getFieldValue } = form;
    let formValues = { publicKey1: record.publicKey1, myAddr: record.myAccount, lockTime: getFieldValue('lockTime'), feeRate: getFieldValue('feeRate'), maxFeeRate: getFieldValue('maxFeeRate') };
    let title = modifyType === 'exit' ? intl.get('ValidatorRegister.exit') : intl.get('ValidatorRegister.verifyModification');
    let selectTypes = record.maxFeeRate === 100 ? [intl.get(`${modifyTypes.lockTime}`)] : [intl.get(`${modifyTypes.lockTime}`), intl.get(`${modifyTypes.feeRate}`)];

    return (
      <div>
        <Modal visible closable={false} destroyOnClose={true} title={title} className="validator-register-modal"
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
            {
              modifyType === 'modify' &&
              <div className="validator-line">
                <ValidatorModifySelect
                  form={form}
                  types={selectTypes}
                  handleChange={this.onChangeModifyTypeSelect}
                  title={intl.get('ValidatorRegister.modifyTypeTitle')}
                  message={intl.get('ValidatorRegister.invalidType')}
                  placeholder={intl.get('ValidatorRegister.selectType')}
                />
              </div>
            }
            {
              modifyType === 'modify' && this.handleShowSelectType('lockTime') &&
              <React.Fragment>
                <CommonFormItem form={form} formName='currentLockTime' disabled={true}
                  options={{ initialValue: record.lockTime, rules: [{ required: true }] }}
                  title={intl.get('ValidatorRegister.currentLockTime')}
                />
                <CommonFormItem form={form} formName='nextLockTime' disabled={true}
                  options={{ initialValue: record.nextLockTime, rules: [{ required: true }] }}
                  title={intl.get('ValidatorRegister.nextLockTime')}
                />
                <div className="validator-line">
                  <Row type="flex" justify="space-around" align="top">
                    <Col span={8}><span className="stakein-name">{intl.get('ValidatorRegister.lockTime')}</span></Col>
                    <Col span={13}>
                      <Form layout="inline">
                        <Form.Item>
                          {getFieldDecorator('lockTime', { initialValue: record.lockTime, rules: [{ required: true }] })
                            (<Slider className={style.locktimeSlider} min={MINDAYS} max={MAXDAYS} step={1} onChange={this.onSliderChange} />)}
                        </Form.Item>
                      </Form>
                    </Col>
                    <Col span={3}><span className="locktime-span">{getFieldValue('lockTime')} {intl.get('Common.days')}</span></Col>
                  </Row>
                </div>
              </React.Fragment>
            }
            {
              modifyType === 'modify' && this.handleShowSelectType('feeRate') &&
              <React.Fragment>
                <CommonFormItem form={form} formName='maxFeeRate' disabled={true}
                  options={{ initialValue: record.maxFeeRate, rules: [{ required: true }] }}
                  title={intl.get('ValidatorRegister.maxFeeRate')}
                />
                <CommonFormItem form={form} formName='currentFeeRate' disabled={true}
                  options={{ initialValue: record.feeRate, rules: [{ required: true }] }}
                  title={intl.get('ValidatorRegister.currentFeeRate')}
                />
                <CommonFormItem form={form} formName='feeRate'
                  options={{ initialValue: record.feeRate, rules: [{ required: true, validator: this.checkMaxFeeRate }] }}
                  title={intl.get('ValidatorRegister.feeRate')}
                  placeholder={intl.get('ValidatorRegister.feeRateLimit')}
                />
              </React.Fragment>
            }
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
            {settings.reinput_pwd && <PwdForm form={form} />}
          </div>
        </Modal>
        {this.state.confirmVisible && <Confirm confirmLoading={this.state.confirmLoading} showConfirmItem={this.state.showConfirmItem} onCancel={this.onConfirmCancel} onSend={this.onSend} record={formValues} title={intl.get('NormalTransForm.ConfirmForm.transactionConfirm')} />}
      </div>
    );
  }
}

const ValidatorModifyForm = Form.create({ name: 'ModifyForm' })(ModifyForm);
class ValidatorModify extends Component {
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
        {this.state.visible && <ValidatorModifyForm onCancel={this.handleStateToggle} onSend={this.handleSend} record={this.props.record} modifyType={this.props.modifyType} />}
      </div>
    );
  }
}

export default ValidatorModify;
