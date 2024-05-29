import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Input, Icon, Select, message, Row, Col, Avatar } from 'antd';
import style from './index.less';
import { WANMAIN, WANTESTNET, WALLETID } from 'utils/settings'
import StakeConfirmForm from 'components/Staking/StakeConfirmForm';
import { toWei } from 'utils/support.js';
import { BigNumber } from 'bignumber.js';
import { getNonce, getGasInfo, checkAmountUnit, getChainId, getContractAddr, getContractData, checkWanValidatorAddr, fillRawTxGasPrice } from 'utils/helper';
import { signTransaction } from 'componentUtils/trezor'

const Option = Select.Option;
const pu = require('promisefy-util');
const Confirm = Form.create({ name: 'StakeConfirmForm' })(StakeConfirmForm);
const LEFT = 6;
const RIGHT = 18;

@inject(stores => ({
  settings: stores.session.settings,
  isMainNetwork: stores.session.isMainNetwork,
  getNormalAddrList: stores.wanAddress.getNormalAddrList,
  ledgerAddrList: stores.wanAddress.ledgerAddrList,
  trezorAddrList: stores.wanAddress.trezorAddrList,
  onlineValidatorList: stores.staking.onlineValidatorList,
  updateStakeInfo: () => stores.staking.updateStakeInfo(),
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
}))

@observer
class DelegateInForm extends Component {
  constructor (props) {
    super(props)
    this.state = {
      balance: '0',
      addrList: [],
      confirmVisible: false,
      confirmLoading: false,
      loading: false,
      record: {
        validator: {},
        accountAddress: '',
        myStake: { title: '' },
      }
    }
  }

  componentWillMount () {
    const { getNormalAddrList, ledgerAddrList, trezorAddrList } = this.props;
    let addrList = []
    getNormalAddrList.forEach(addr => {
      addrList.push(
        addr.address
      )
    });

    ledgerAddrList.forEach(addr => {
      addrList.push(
        'Ledger: ' + addr.address
      )
    });

    trezorAddrList.forEach(addr => {
      addrList.push(
        'Trezor: ' + addr.address
      )
    });

    this.setState({ addrList: addrList })
  }

  componentDidMount () {
    const { form, record, ledgerAddrList, trezorAddrList } = this.props;

    if (record) {
      let name = record.validator.name;
      let quota = this.getDataFromValidatorList(record.validator.address, 'quota');
      let from = record.accountAddress;

      form.setFieldsValue({
        to: record.validator.address,
        validatorName: name,
        quota: quota,
        commission: this.getDataFromValidatorList(record.validator.address, 'feeRate'),
        maxFeeRate: this.getDataFromValidatorList(record.validator.address, 'maxFeeRate')
      });

      for (let i = 0; i < ledgerAddrList.length; i++) {
        const hdAddr = ledgerAddrList[i].address;
        if (hdAddr.toLowerCase() === from.toLowerCase()) {
          from = 'Ledger: ' + from;
          break;
        }
      }
      for (let i = 0; i < trezorAddrList.length; i++) {
        const hdAddr = trezorAddrList[i].address;
        if (hdAddr.toLowerCase() === from.toLowerCase()) {
          from = 'Trezor: ' + from;
          break;
        }
      }

      form.setFieldsValue({ from: from });
      this.onChange(from);
    }
  }

  onValidatorChange = value => {
    let { form } = this.props;
    let addr = this.getDataFromValidatorList(value, 'address');
    form.setFieldsValue({
      to: addr,
      validatorName: value,
      quota: this.getDataFromValidatorList(addr, 'quota'),
      commission: this.getDataFromValidatorList(addr, 'feeRate'),
      maxFeeRate: this.getDataFromValidatorList(addr, 'maxFeeRate'),
    });
    this.validator = value;
  }

  getBalance = (value) => {
    const { getNormalAddrList, ledgerAddrList, trezorAddrList } = this.props;
    if (!value) {
      return
    }

    if (value.includes('Ledger')) {
      for (let i = 0; i < ledgerAddrList.length; i++) {
        const element = ledgerAddrList[i];
        value = value.replace('Ledger: ', '')
        if (element.address === value) {
          return element.balance;
        }
      }
      return;
    }

    if (value.includes('Trezor')) {
      for (let i = 0; i < trezorAddrList.length; i++) {
        const element = trezorAddrList[i];
        value = value.replace('Trezor: ', '')
        if (element.address === value) {
          return element.balance;
        }
      }
      return;
    }

    for (let i = 0; i < getNormalAddrList.length; i++) {
      const element = getNormalAddrList[i];
      if (element.address === value) {
        return element.balance;
      }
    }
  }

  onChange = value => {
    if (!value) {
      return
    }
    this.setState({
      balance: this.getBalance(value),
    })
  }

  checkToWanAddr = (rule, value, callback) => {
    checkWanValidatorAddr(value).then(ret => {
      if (ret) {
        callback();
      } else {
        callback(intl.get('NormalTransForm.invalidAddress'));
      }
    }).catch((err) => {
        callback(err);
    })
  }

  checkAmount = (rule, value, callback) => {
    let { form } = this.props;
    let quota = form.getFieldValue('quota');
    let balance = form.getFieldValue('balance');

    if (!checkAmountUnit(18, value)) {
      callback(intl.get('Common.invalidAmount'));
    }

    let valueStringPre = value.toString().slice(0, 4)
    if (Number(value) < 0.0001 || (!this.props.topUp && Math.floor(valueStringPre) < 100)) {
      callback(intl.get('StakeInForm.stakeTooLow'));
      return;
    }

    if (Number(value) > Number(balance)) {
      callback(intl.get('SendNormalTrans.hasBalance'));
      return;
    }

    if (Number(value) > Number(quota)) {
      callback(intl.get('StakeInForm.stakeExceed'));
      return;
    }

    callback();
  }

  getPath = (from) => {
    const { getNormalAddrList, ledgerAddrList, trezorAddrList } = this.props;
    let addrs = getNormalAddrList
    let fromAddr = from

    if (from.includes('Ledger')) {
      fromAddr = from.replace('Ledger: ', '')
      addrs = ledgerAddrList
    }

    if (from.includes('Trezor')) {
      fromAddr = from.replace('Trezor: ', '')
      addrs = trezorAddrList
    }

    for (let i = 0; i < addrs.length; i++) {
      const addr = addrs[i];
      if (addr.address === fromAddr) {
        return addr.path;
      }
    }
  }

  getDataFromValidatorList = (addr, type) => {
    if (!addr) return ' ';
    let { onlineValidatorList } = this.props;
    let value = type === 'address' ? onlineValidatorList.find(item => addr.toLowerCase() === item.name.toLowerCase()) : onlineValidatorList.find(item => addr.toLowerCase() === item.address.toLowerCase());
    return value ? value[type] : ' '
  }

  showConfirmForm = () => {
    this.setState({
      loading: true
    })
    let { form, settings } = this.props;
    form.validateFields(async (err) => {
      if (err) {
        this.setState({ loading: false });
        return;
      };

      let from = form.getFieldValue('from');
      let to = form.getFieldValue('to');
      let pwd = form.getFieldValue('pwd');
      let amount = form.getFieldValue('amount');

      if (!amount || (!this.props.topUp && amount < 100)) {
        message.error(intl.get('NormalTransForm.amountIsIncorrect'));
        this.setState({ loading: false });
        return;
      }

      if (Number(this.state.balance) <= amount) {
        message.error(intl.get('NormalTransForm.overBalance'))
        this.setState({ loading: false });
        return;
      }

      if (settings.reinput_pwd) {
        if (!pwd) {
          message.warn(intl.get('Backup.invalidPassword'));
          this.setState({ loading: false });
          return;
        }

        try {
          await pu.promisefy(wand.request, ['phrase_checkPwd', { pwd: pwd }], this);
        } catch (error) {
          message.warn(intl.get('Backup.invalidPassword'));
          this.setState({ loading: false });
          return;
        }
      }

      let validator = {}
      let { onlineValidatorList } = this.props;
      for (let i = 0; i < onlineValidatorList.length; i++) {
        const v = onlineValidatorList[i];
        if (to === v.address) {
          validator = v;
          break;
        }
      }
      this.setState({
        loading: false,
        confirmVisible: true,
        record: {
          accountAddress: from,
          validator: { name: validator.name, img: validator.icon, address: validator.address, commission: validator.feeRate, maxFeeRate: validator.maxFeeRate },
          myStake: { title: amount },
        }
      });
    })
  }

  onConfirmCancel = () => {
    this.setState({ confirmVisible: false, confirmLoading: false });
  }

  onSend = async () => {
    this.setState({
      confirmLoading: true
    });
    let { form } = this.props;
    let from = form.getFieldValue('from');
    let to = form.getFieldValue('to');

    let path = this.getPath(from);

    let amount = form.getFieldValue('amount');
    if (!amount || (!this.props.topUp && amount < 100)) {
      message.error('Please input a valid amount.');
      return;
    }
    let walletID = WALLETID.NATIVE;

    if (from.includes('Ledger')) {
      from = from.replace('Ledger: ', '')
      walletID = WALLETID.LEDGER;
    }

    if (from.includes('Trezor')) {
      from = from.replace('Trezor: ', '')
      walletID = WALLETID.TREZOR;
    }

    let tx = {
      from: from,
      validatorAddr: to,
      amount: new BigNumber(amount || 0).toString(),
      gasPrice: 0,
      gasLimit: 0,
      BIP44Path: path,
      walletID: walletID,
      stakeAmount: new BigNumber(amount || 0).toString(),
    }
    if (walletID === WALLETID.LEDGER) {
      message.info(intl.get('Ledger.signTransactionInLedger'))
    }
    if (walletID === WALLETID.TREZOR) {
      await this.trezorDelegateIn(path, from, to, new BigNumber(amount || 0).toString());
      this.props.onSend(walletID);
    } else {
      wand.request('staking_delegateIn', tx, (err, ret) => {
        if (err) {
          message.warn(intl.get('StakeInForm.delegateInFailed'));
        }
        this.setState({ confirmVisible: false });
        this.props.onSend();
      });
    }
    this.props.updateStakeInfo();
    this.props.updateTransHistory();
  }

  onClick = () => {
    let href = this.props.isMainNetwork ? `${WANMAIN}/vlds` : `${WANTESTNET}/vlds`;
    wand.shell.openExternal(href);
  }

  trezorDelegateIn = async (path, from, validator, value) => {
    let chainId = await getChainId();
    let func = 'delegateIn';
    try {
      let nonce = await getNonce(from, 'wan');
      let gasInfo = await getGasInfo('wan');
      let data = await getContractData(func, validator);
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
        annotate: 'DelegateIn',
        status: 'Sent',
        source: 'external',
        stakeAmount: value.toString(),
        ...rawTx
      }

      await pu.promisefy(wand.request, ['staking_insertTransToDB', { rawTx: params }], this);
      this.props.updateStakeInfo();
      this.props.updateTransHistory();
    } catch (error) {
      message.error(error)
    }
  }

  render () {
    const { onlineValidatorList, form, settings, disabled, onCancel } = this.props;
    const { getFieldDecorator } = form;
    let validatorListSelect = onlineValidatorList.map(v => <div name={v.name}><Avatar src={v.icon} name={v.name} value={v.name} size="small" /> {v.name}</div>);

    return (
      <div>
        <Modal visible destroyOnClose={true} closable={false} title={intl.get('StakeInForm.title')} onCancel={this.onCancel} className={style['stakein-modal']}
          footer={[
            <Button key="back" className="cancel" onClick={onCancel}>{intl.get('Common.cancel')}</Button>,
            <Button loading={this.state.loading} key="submit" type="primary" onClick={this.showConfirmForm}>{intl.get('Common.next')}</Button>,
          ]}
        >
          <div className={style['stakein-bg']}>
            <div className="stakein-title">{intl.get('StakeInForm.validatorAccount')}</div>
            <div className={style['stakein-line']}>
              <Row type="flex" justify="space-around" align="middle">
                <Col span={5} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('StakeInForm.name')}</span></Col>
                <Col span={14}>
                  <Form layout="inline" id="posNameSelect">
                    <Form.Item>
                      {getFieldDecorator('validatorName', {
                        rules: [{ required: false }],
                      })(
                        <Select
                          disabled={disabled}
                          showArrow={!disabled}
                          showSearch
                          allowClear
                          style={{ width: 355 }}
                          placeholder={intl.get('StakeInForm.selectName')}
                          optionFilterProp="children"
                          onChange={this.onValidatorChange}
                          getPopupContainer={() => document.getElementById('posNameSelect')}
                          filterOption={(input, option) => option.props.value.toLowerCase().indexOf(input.toLowerCase()) >= 0}
                        >
                          {validatorListSelect.map((item, index) => <Option value={item.props.name} key={index}>{item}</Option>)}
                        </Select>
                      )}
                    </Form.Item>
                  </Form>
                </Col>
                <Col span={3} align="right" className={style['col-stakein-info']}>
                  <a onClick={this.onClick}>{intl.get('StakeInForm.more')}</a>
                </Col>
              </Row>
            </div>
            <div className={style['stakein-line']}>
              <Row type="flex" justify="space-around" align="top">
                <Col span={LEFT} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('StakeInForm.address')}</span></Col>
                <Col span={RIGHT}>
                  <Form layout="inline">
                    <Form.Item>
                      {getFieldDecorator('to')
                        (<Input disabled={true} placeholder={intl.get('StakeInForm.enterAddress')} prefix={<Icon type="wallet" className="colorInput" />} />)}
                    </Form.Item>
                  </Form>
                </Col>
              </Row>
            </div>
            <div className={style['stakein-line']}>
              <Row type="flex" justify="space-around" align="top">
                <Col span={LEFT} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('StakeInForm.quota')}</span></Col>
                <Col span={RIGHT}>
                  <Form layout="inline">
                    <Form.Item >
                      {getFieldDecorator('quota')
                        (<Input disabled={true} prefix={<Icon type="credit-card" className="colorInput" />} />)}
                    </Form.Item>
                  </Form>
                </Col>
              </Row>
            </div>
            <div className={style['stakein-line']}>
              <Row type="flex" justify="space-around" align="top">
                <Col span={LEFT} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('ValidatorRegister.maxFeeRate')}</span></Col>
                <Col span={RIGHT}>
                  <Form layout="inline">
                    <Form.Item >
                      {getFieldDecorator('maxFeeRate')
                        (<Input disabled={true} prefix={<Icon type="credit-card" className="colorInput" />} />)}
                    </Form.Item>
                  </Form>
                </Col>
              </Row>
            </div>
            <div className={style['stakein-line']}>
              <Row type="flex" justify="space-around" align="top">
                <Col span={LEFT} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('ValidatorRegister.feeRate')}</span></Col>
                <Col span={RIGHT}>
                  <Form layout="inline">
                    <Form.Item >
                      {getFieldDecorator('commission')
                        (<Input disabled={true} prefix={<Icon type="credit-card" className="colorInput" />} />)}
                    </Form.Item>
                  </Form>
                </Col>
              </Row>
            </div>
          </div>
          <div className={style['stakein-bg']}>
            <div className="stakein-title">{intl.get('StakeInForm.myAccount')}</div>

            <div className={style['stakein-line']}>
              <Row type="flex" justify="space-around" align="top">
                <Col span={LEFT} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('StakeInForm.address')}</span></Col>
                <Col span={RIGHT}>
                  <Form layout="inline" id="posAddrSelect">
                    <Form.Item>
                      {getFieldDecorator('from', { rules: [{ required: true, message: intl.get('NormalTransForm.invalidAddress') }] })
                        (
                          <Select
                            autoFocus
                            showSearch
                            allowClear
                            optionLabelProp="value"
                            disabled={this.props.topUp}
                            dropdownMatchSelectWidth={false}
                            dropdownStyle={{ width: '420px' }}
                            placeholder={intl.get('StakeInForm.selectAddress')}
                            optionFilterProp="children"
                            onSelect={this.onChange}
                            getPopupContainer={() => document.getElementById('posAddrSelect')}
                            filterOption={(input, option) => option.props.value.toLowerCase().indexOf(input.toLowerCase()) >= 0}
                            className="colorInput"
                          >
                            {this.state.addrList.map((item, index) =>
                              <Option value={item} key={index}>
                                <Row className="ant-row-flex">
                                  <Col>{item}</Col>&nbsp;
                                  <Col className="stakein-selection-balance">- {Number(this.getBalance(item)).toFixed(1)}</Col>
                                </Row>
                              </Option>)}
                          </Select>
                        )}
                    </Form.Item>
                  </Form>
                </Col>
              </Row>
            </div>

            <div className={style['stakein-line']}>
              <Row type="flex" justify="space-around" align="top">
                <Col span={LEFT} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('StakeInForm.balance')}</span></Col>
                <Col span={RIGHT}>
                  <Form layout="inline">
                    <Form.Item >
                      {getFieldDecorator('balance', { initialValue: this.state.balance })
                        (<Input disabled={true} prefix={<Icon type="credit-card" className="colorInput" />} />)}
                    </Form.Item>
                  </Form>
                </Col>
              </Row>
            </div>

            <div className={style['stakein-line']}>
              <Row type="flex" justify="space-around">
                <Col span={LEFT} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('StakeInForm.stake')}</span></Col>
                <Col span={RIGHT}>
                  <Form layout="inline">
                    <Form.Item>
                      {getFieldDecorator('amount', { initialValue: (this.props.topUp ? 0 : 100), rules: [{ required: true, validator: this.checkAmount }] })
                        (<Input prefix={<Icon type="credit-card" className="colorInput" />} />)}
                    </Form.Item>
                  </Form>
                </Col>
              </Row>
            </div>

            {settings.reinput_pwd &&
              <div className={style['stakein-line']}>
                <Row type="flex" justify="space-around" align="top">
                  <Col span={LEFT} className={style['col-stakein-name']}><span className="stakein-name">{intl.get('NormalTransForm.password')}</span></Col>
                  <Col span={RIGHT}>
                    <Form layout="inline">
                      <Form.Item>
                        {getFieldDecorator('pwd', { rules: [{ required: true, message: intl.get('NormalTransForm.pwdIsIncorrect') }] })
                          (<Input.Password placeholder={intl.get('Backup.enterPassword')} prefix={<Icon type="lock" className="colorInput" />} />)}
                      </Form.Item>
                    </Form>
                  </Col>
                </Row>
              </div>
            }
          </div>
        </Modal>
        { this.state.confirmVisible &&
          <Confirm
            confirmLoading={this.state.confirmLoading}
            visible={this.state.confirmVisible}
            onCancel={this.onConfirmCancel} onSend={this.onSend}
            record={this.state.record}
            title={intl.get('NormalTransForm.ConfirmForm.transactionConfirm')}
            note={''}
          />
        }
      </div>
    );
  }
}

export default DelegateInForm;
