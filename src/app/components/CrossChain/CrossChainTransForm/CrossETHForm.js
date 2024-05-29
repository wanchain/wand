import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Icon, message, Spin, Checkbox, Tooltip, AutoComplete, Input, Row, Col } from 'antd';
import style from './index.less';
import PwdForm from 'componentUtils/PwdForm';
import SelectForm from 'componentUtils/SelectForm';
import ToolTipCus from 'components/Tooltips';
import CommonFormItem from 'componentUtils/CommonFormItem';
// import AutoCompleteForm from 'componentUtils/AutoCompleteForm';
import AddContactsModal from '../../AddContacts/AddContactsModal';
import ChooseContactsModal from '../../AddContacts/ChooseContactsModal';
import AdvancedCrossChainOptionForm from 'components/AdvancedCrossChainOptionForm';
import { CROSS_TYPE, INBOUND, FAST_GAS, OUTBOUND, WAN_ETH_DECIMAL, WALLETID } from 'utils/settings';
import ConfirmForm from 'components/CrossChain/CrossChainTransForm/ConfirmForm/CrossETHConfirmForm';
import { isExceedBalance, formatNumByDecimals, hexCharCodeToStr, removeRedundantDecimal, fromWei } from 'utils/support';
import { getFullChainName, checkAmountUnit, formatAmount, getValueByAddrInfo, getValueByNameInfoAllType, checkAddressByChainType, getFees, getQuota, getInfoByAddress, estimateCrossChainNetworkFee, estimateCrossChainOperationFee } from 'utils/helper';

const Confirm = Form.create({ name: 'CrossETHConfirmForm' })(ConfirmForm);
const AdvancedCrossChainModal = Form.create({ name: 'AdvancedCrossChainOptionForm' })(AdvancedCrossChainOptionForm);
const { Option } = AutoComplete;
const AddContactsModalForm = Form.create({ name: 'AddContactsModal' })(AddContactsModal);
const ChooseContactsModalForm = Form.create({ name: 'AddContactsModal' })(ChooseContactsModal);

@inject(stores => ({
  settings: stores.session.settings,
  isLegacyWanPath: stores.session.isLegacyWanPath,
  addrInfo: stores.ethAddress.addrInfo,
  language: stores.languageIntl.language,
  wanAddrInfo: stores.wanAddress.addrInfo,
  from: stores.sendCrossChainParams.currentFrom,
  currTokenPairId: stores.crossChain.currTokenPairId,
  currentTokenPairInfo: stores.crossChain.currentTokenPairInfo,
  transParams: stores.sendCrossChainParams.transParams,
  coinPriceObj: stores.portfolio.coinPriceObj,
  contacts: stores.contacts.contacts,
  updateTransParams: (addr, paramsObj) => stores.sendCrossChainParams.updateTransParams(addr, paramsObj),
  getChainAddressInfoByChain: chain => stores.tokens.getChainAddressInfoByChain(chain),
  addAddress: (chain, addr, val) => stores.contacts.addAddress(chain, addr, val),
  hasSameContact: (addr, chain) => stores.contacts.hasSameContact(addr, chain),
}))

@observer
class CrossETHForm extends Component {
  constructor(props) {
    super(props);
    let info = props.currentTokenPairInfo;
    let addr = props.getChainAddressInfoByChain(props.type === INBOUND ? info.toChainSymbol : info.fromChainSymbol)
    this.addressSelections = Object.keys({ ...addr.normal, ...addr.ledger, ...addr.trezor });
    this.state = {
      confirmVisible: false,
      crossType: CROSS_TYPE[0],
      advancedVisible: false,
      advanced: false,
      advancedFee: 0,
      operationFee: 0,
      networkFee: 0,
      isPercentOperationFee: false,
      minOperationFeeLimit: '0',
      maxOperationFeeLimit: '0',
      isPercentNetworkFee: false,
      discountPercentNetworkFee: '1',
      discountPercentOperationFee: '1',
      minNetworkFeeLimit: '0',
      maxNetworkFeeLimit: '0',
      percentOperationFee: 0,
      percentNetworkFee: 0,
      receivedAmount: '0',
      minQuota: 0,
      maxQuota: 0,
      contactsList: [],
      isNewContacts: false,
      showAddContacts: false,
      showChooseContacts: false,
      networkFeeRaw: {},
      operationFeeRaw: {},
      totalFee: '0'
    }
  }

  async componentDidUpdate(prevProps) {
    if (prevProps.smgList !== this.props.smgList) {
      let { smgList, type, currentTokenPairInfo: info } = this.props;
      try {
        const chainType = type === INBOUND ? info.fromChainSymbol : info.toChainSymbol;
        const targetChainType = type === INBOUND ? info.toChainSymbol : info.fromChainSymbol;
        let [{ minQuota, maxQuota }] = await getQuota(chainType, smgList[0].groupId, [info.ancestorSymbol], { targetChainType });
        const decimals = info.ancestorDecimals;
        this.setState({
          minQuota: formatNumByDecimals(minQuota, decimals),
          maxQuota: formatNumByDecimals(maxQuota, decimals)
        })
      } catch (e) {
        console.log('e:', e);
        message.warn(intl.get('CrossChainTransForm.getQuotaFailed'));
        this.props.onCancel();
      }
    }
  }

  componentDidMount() {
    const { type, currentTokenPairInfo: info, getChainAddressInfoByChain } = this.props;

    let toAccountList;
    if (type === INBOUND) {
      toAccountList = getChainAddressInfoByChain(info.toChainSymbol);
    } else {
      toAccountList = getChainAddressInfoByChain(info.fromChainSymbol);
    }
    const accountDataSelections = this.addressSelections.map(val => {
      const name = getValueByAddrInfo(val, 'name', toAccountList);
      return {
        address: val,
        name: name,
        text: `${name}-${val}`
      }
    })

    this.processContacts();
    this.estimateNetworkFee(accountDataSelections[0].address);
    this.estimateOperationFee(accountDataSelections[0].address);
  }

  estimateNetworkFee = (address = '') => {
    const { type, currTokenPairId, currentTokenPairInfo: info, form, from } = this.props;
    const { ancestorDecimals } = info;

    estimateCrossChainNetworkFee(type === INBOUND ? 'ETH' : 'WAN', type === INBOUND ? 'WAN' : 'ETH', { tokenPairID: currTokenPairId, address: [address, from] }).then(res => {
      this.setState({
        networkFeeRaw: res.isPercent ? '0' : fromWei(res.value),
        networkFee: res.isPercent ? '0' : fromWei(res.value),
        isPercentNetworkFee: res.isPercent,
        discountPercentNetworkFee: res.discountPercent || 1,
        percentNetworkFee: res.isPercent ? res.value : 0,
        minNetworkFeeLimit: res.isPercent ? new BigNumber(res.minFeeLimit || '0').dividedBy(Math.pow(10, ancestorDecimals)).toString() : 0,
        maxNetworkFeeLimit: res.isPercent ? new BigNumber(res.maxFeeLimit || '0').dividedBy(Math.pow(10, ancestorDecimals)).toString() : 0,
      });
      this.updateCrosschainFee(form.getFieldValue('amount'));
    }).catch(err => {
      console.log('err:', err);
      message.warn(intl.get('CrossChainTransForm.getNetworkFeeFailed'));
    });
  }

  estimateOperationFee = (address = '') => {
    const { type, currTokenPairId, currentTokenPairInfo: info, form, from } = this.props;
    const { ancestorDecimals } = info;

    estimateCrossChainOperationFee(type === INBOUND ? 'ETH' : 'WAN', type === INBOUND ? 'WAN' : 'ETH', { tokenPairID: currTokenPairId, address: [address, from] }).then(res => {
      this.setState({
        operationFeeRaw: res.isPercent ? '0' : fromWei(res.value),
        operationFee: res.isPercent ? '0' : fromWei(res.value),
        isPercentOperationFee: res.isPercent,
        discountPercentOperationFee: res.discountPercent || 1,
        percentOperationFee: res.isPercent ? res.value : 0,
        minOperationFeeLimit: res.isPercent ? new BigNumber(res.minFeeLimit || '0').dividedBy(Math.pow(10, ancestorDecimals)).toString() : 0,
        maxOperationFeeLimit: res.isPercent ? new BigNumber(res.maxFeeLimit || '0').dividedBy(Math.pow(10, ancestorDecimals)).toString() : 0,
      });
      this.updateCrosschainFee(form.getFieldValue('amount'));
    }).catch(err => {
      console.log('err:', err);
      message.warn(intl.get('CrossChainTransForm.getOperationFeeFailed'));
    });
  }

  componentWillUnmount() {
    this.setState = (state, callback) => {
      return false;
    };
  }

  processContacts = () => {
    const { contacts, currentTokenPairInfo: info, type } = this.props;
    const { normalAddr } = contacts;
    const chainSymbol = getFullChainName(info[type === INBOUND ? 'toChainSymbol' : 'fromChainSymbol']);
    let contactsList = Object.values(normalAddr[chainSymbol]);
    this.setState({
      contactsList
    })
  }

  handleConfirmCancel = () => {
    this.setState({
      confirmVisible: false,
    });
  }

  onCancel = () => {
    this.props.onCancel();
  }

  handleNext = () => {
    const { updateTransParams, settings, form, from, type, getChainAddressInfoByChain, currentTokenPairInfo: info } = this.props;
    const { networkFee, contactsList } = this.state
    let toAddrInfo = getChainAddressInfoByChain(info[type === INBOUND ? 'toChainSymbol' : 'fromChainSymbol']);
    let isNativeAccount = false; // Figure out if the to value is contained in my wallet.
    form.validateFields(['from', 'balance', 'storemanAccount', 'quota', 'to', 'totalFee', 'amount'], { force: true }, (err, values) => {
      if (err) {
        console.log('validate form data failed:', err);
        return;
      };

      let { pwd, amount: sendAmount, to } = form.getFieldsValue(['pwd', 'amount', 'to']);

      let addrType = 'normal'
      if (this.accountSelections.includes(to)) {
        addrType = getValueByNameInfoAllType(to, 'type', toAddrInfo);
        to = getValueByNameInfoAllType(to, 'address', toAddrInfo);
        isNativeAccount = true;
      } else if (this.addressSelections.includes(to)) {
        isNativeAccount = true;
        addrType = getInfoByAddress(to, [], toAddrInfo).type;
      } else if (contactsList.find(v => v.name === to || v.address === to)) {
        const contactItem = contactsList.find(v => v.name === to || v.address === to);
        to = contactItem.address;
      }
      let chainID;
      let chainSymbol = (type === INBOUND ? info.toChainSymbol : info.fromChainSymbol);
      if (chainSymbol === 'WAN') {
        chainID = this.props.isLegacyWanPath ? 5718350 : 60;
      } else {
        chainID = (type === INBOUND ? info.toChainID : info.fromChainID) - Number('0x80000000'.toString(10));
      }
      let toPath = isNativeAccount
                               ? addrType === 'normal' ? `m/44'/${chainID}'/0'/0/${toAddrInfo[addrType][to].path}` : toAddrInfo[addrType][to].path
                               : undefined;

      let walletID = addrType === 'normal' ? 1 : WALLETID[addrType.toUpperCase()];
      let toValue = isNativeAccount && addrType !== 'trezor';
      if (settings.reinput_pwd) {
        if (!pwd) {
          message.warn(intl.get('Backup.invalidPassword'));
          return;
        }
        wand.request('phrase_checkPwd', { pwd: pwd }, (err) => {
          if (err) {
            message.warn(intl.get('Backup.invalidPassword'));
          } else {
            updateTransParams(from, { to: toValue ? { walletID, path: toPath } : to, toAddr: to, amount: formatAmount(sendAmount), networkFee, crosschainFee: form.getFieldValue('totalFee'), receivedAmount: form.getFieldValue('receive') });
            this.setState({ confirmVisible: true });
          }
        })
      } else {
        updateTransParams(from, { to: toValue ? { walletID, path: toPath } : to, toAddr: to, amount: formatAmount(sendAmount), networkFee, crosschainFee: form.getFieldValue('totalFee'), receivedAmount: form.getFieldValue('receive') });
        this.setState({ confirmVisible: true });
      }
    });
  }

  sendTrans = () => {
    this.props.onSend(this.props.from);
  }

  updateCrosschainFee = (value = '0') => {
    const { isPercentNetworkFee, isPercentOperationFee, networkFeeRaw, operationFeeRaw, percentNetworkFee, percentOperationFee, minNetworkFeeLimit, maxNetworkFeeLimit, minOperationFeeLimit, maxOperationFeeLimit, discountPercentOperationFee, discountPercentNetworkFee } = this.state;
    const { type } = this.props;
    if (!value) {
      value = this.props.form.getFieldValue('amount')
    }
    let finnalNetworkFee, finnalOperationFee, totalFee;
    if (isPercentNetworkFee) {
      const tmp = new BigNumber(value).multipliedBy(percentNetworkFee);
      const tmp1 = tmp.lt(minNetworkFeeLimit)
                              ? minNetworkFeeLimit
                              : (!new BigNumber(maxNetworkFeeLimit).eq('0') && tmp.gt(maxNetworkFeeLimit)) ? maxNetworkFeeLimit : tmp.toString();
      finnalNetworkFee = new BigNumber(tmp1).multipliedBy(discountPercentNetworkFee).toString()
    } else {
      finnalNetworkFee = new BigNumber(networkFeeRaw).multipliedBy(discountPercentNetworkFee).toString(10);
    }

    if (isPercentOperationFee) {
      const tmp = new BigNumber(value).multipliedBy(percentOperationFee);
      const tmp1 = tmp.lt(minOperationFeeLimit)
                              ? minOperationFeeLimit
                              : (!new BigNumber(maxOperationFeeLimit).eq('0') && tmp.gt(maxOperationFeeLimit)) ? maxOperationFeeLimit : tmp.toString();
      finnalOperationFee = new BigNumber(tmp1).multipliedBy(discountPercentOperationFee).toString();
    } else {
      finnalOperationFee = new BigNumber(operationFeeRaw).multipliedBy(discountPercentOperationFee).toString(10);
    }
    if (type === INBOUND) {
      totalFee = `${new BigNumber(finnalNetworkFee).plus(finnalOperationFee).toString()} ETH`;
    } else {
      totalFee = `${new BigNumber(finnalNetworkFee).toString()} WAN + ${new BigNumber(finnalOperationFee).toString()} ETH`;
    }

    this.setState({ networkFee: finnalNetworkFee, operationFee: finnalOperationFee, totalFee });

    return [finnalNetworkFee, finnalOperationFee];
  }

  checkAmount = (rule, value, callback) => {
    const { balance, estimateFee, from, type, currentTokenPairInfo: info, getChainAddressInfoByChain, form, account } = this.props;
    const { maxQuota, minQuota } = this.state;
    const unit = type === INBOUND ? info.fromTokenSymbol : info.toTokenSymbol;
    const { txFee } = form.getFieldsValue(['txFee']);
    const txFeeWithoutUnit = txFee.split(' ')[0];
    const message = intl.get('NormalTransForm.amountIsIncorrect');

    try {
      if (new BigNumber(value).lte(0) || !checkAmountUnit(18, value)) {
        callback(message);
        this.setState({ receivedAmount: '0' });
        return;
      }
      if (new BigNumber(value).lt(minQuota)) {
        let errText = `${intl.get('CrossChainTransForm.invalidAmount1')}: ${minQuota} ${unit}`;
        this.setState({ receivedAmount: '0' });
        callback(errText);
        return;
      }
      if (new BigNumber(value).gt(maxQuota)) {
        callback(intl.get('CrossChainTransForm.overQuota'))
        this.setState({ receivedAmount: '0' });
        return;
      }

      const [finnalNetworkFee, finnalOperationFee] = this.updateCrosschainFee(value)

      if (type === INBOUND) {
        if (new BigNumber(value).minus(finnalNetworkFee).minus(finnalOperationFee).lte(0)) {
          callback(message);
          return;
        }
        if (new BigNumber(balance).lte(value)) {
          callback(intl.get('CrossChainTransForm.overOriginalBalance'));
          return;
        }
        if (new BigNumber(balance).minus(value).minus(txFeeWithoutUnit).lt('0')) {
          callback(intl.get('NormalTransForm.insufficientFee'));
          return;
        }
        this.setState({ receivedAmount: new BigNumber(value).minus(finnalNetworkFee).minus(finnalOperationFee).toString(10) })
      } else {
        const fromAddrBalance = getValueByNameInfoAllType(account, 'balance', getChainAddressInfoByChain(info.toChainSymbol))
        if (new BigNumber(fromAddrBalance).minus(finnalNetworkFee).minus(txFeeWithoutUnit).lt(0)) {
          message.warn(intl.get('NormalTransForm.insufficientFee'))
          return;
        }
        if (new BigNumber(balance).lt(value)) {
          callback(message);
          return;
        }
        if (new BigNumber(value).lte(finnalOperationFee)) {
          callback(intl.get('CrossChainTransForm.overOriginalBalance'));
          return;
        }
        this.setState({ receivedAmount: new BigNumber(value).minus(finnalOperationFee).toString(10) })
      }
      callback();
    } catch (error) {
      callback(message);
    }
  }

  checkQuota = (rule, value, callback) => {
    value = value.split(' ')[0];
    if (new BigNumber(value).gt(0)) {
      let { amount } = this.props.form.getFieldsValue(['amount']);
      if (isExceedBalance(value, amount)) {
        callback(intl.get('CrossChainTransForm.overQuota'));
        return;
      }
      callback();
    } else {
      callback(intl.get('CrossChainTransForm.overQuota'));
    }
  }

  updateLockAccounts = async (storeman) => {
    let { from, form, updateTransParams, chainType, currentTokenPairInfo: info, type } = this.props;
    try {
      const targetChainType = type === INBOUND ? info.toChainSymbol : info.fromChainSymbol;
      const [{ minQuota, maxQuota }] = await getQuota(chainType, storeman, [info.ancestorSymbol], { targetChainType });
      const decimals = info.ancestorDecimals;
      this.setState({
        minQuota: formatNumByDecimals(minQuota, decimals),
        maxQuota: formatNumByDecimals(maxQuota, decimals)
      }, () => {
        form.setFieldsValue({
          quota: `${this.state.maxQuota} ${type === INBOUND ? info.fromTokenSymbol : info.toTokenSymbol}`
        })
      });
    } catch (e) {
      console.log('updateLockAccounts:', e);
      message.warn(intl.get('CrossChainTransForm.getQuotaFailed'));
      this.props.onCancel();
    }
    updateTransParams(from, { storeman });
  }

  updateCrossType = (v) => {
    let { from, updateTransParams } = this.props;
    updateTransParams(from, { crossType: v });
    this.setState({
      crossType: v,
    })
  }

  sendAllAmount = e => {
    let { form, balance } = this.props;
    if (e.target.checked) {
      balance = typeof (balance) === 'string' ? balance.replace(/,/g, '') : balance;
      form.setFieldsValue({ amount: new BigNumber(balance).toString(10) }, () => {
        form.validateFields(['amount'], { force: true });
      });
    } else {
      form.setFieldsValue({ amount: 0 });
    }
  }

  checkTo = async (rule, value, callback) => {
    const { currentTokenPairInfo: info, type, hasSameContact } = this.props;
    let chain = type === INBOUND ? info.toChainSymbol : info.fromChainSymbol;
    const chainSymbol = getFullChainName(chain);
    const isNewContacts = hasSameContact(value, chainSymbol);
    if (this.accountSelections.includes(value) || this.addressSelections.includes(value)) {
      this.setState({
        isNewContacts: false
      })
      this.estimateNetworkFee(value);
      this.estimateOperationFee(value);
      callback();
    } else {
      let isValid;
      if (chain === 'WAN') {
        let [isWAN, isETH] = await Promise.all([checkAddressByChainType(value, 'WAN'), checkAddressByChainType(value, 'ETH')]);
        isValid = isWAN || isETH;
      } else {
        isValid = await checkAddressByChainType(value, chain);
      }
      if (isValid) {
        this.setState({
          isNewContacts: !isNewContacts
        })
        this.estimateNetworkFee(value);
        this.estimateOperationFee(value);
        callback();
      } else {
        this.setState({
          isNewContacts: false
        })
        callback(intl.get('NormalTransForm.invalidAddress'));
      }
    }
  }

  onAdvanced = () => {
    this.setState({
      advancedVisible: true,
    });
  }

  handleAdvancedCancel = () => {
    this.setState({
      advancedVisible: false,
    });
  }

  handleSaveOption = (gasPrice, gasLimit) => {
    this.setState({
      advancedVisible: false,
      advanced: true,
      advancedFee: formatNumByDecimals(new BigNumber(gasPrice).times(gasLimit).times(BigNumber(10).pow(9)).toString(10), WAN_ETH_DECIMAL)
    });
  }

  filterToOption = (inputValue, option) => {
    const value = option.props.name;
    return value.toLowerCase().indexOf(inputValue.toLowerCase()) > -1;
  }

  renderOption = item => {
    return (
      <Option key={item.address} text={item.name} name={item.name + '-' + item.address}>
        <div className="global-search-item">
          <span className="global-search-item-desc">
            {item.name}-{item.address}
          </span>
        </div>
      </Option>
    )
  }

  handleShowAddContactModal = () => {
    this.setState({ showAddContacts: !this.state.showAddContacts });
  }

  handleCreate = (address, name) => {
    const { currentTokenPairInfo: info, addAddress } = this.props;
    const chainSymbol = getFullChainName(info.toChainSymbol);
    addAddress(chainSymbol, address, {
      name,
      address,
      chainSymbol
    }).then(async () => {
      this.setState({
        isNewContacts: false
      })
    })
  }

  handleChoose = address => {
    const { form } = this.props;
    form.setFieldsValue({
      to: address
    });
    form.validateFields(['to'], (errors, values) => {
      if (errors) {
        console.log('handleChoose:', errors);
      }
    })
  }

  getChooseToAdd = () => {
    const { form } = this.props;
    let to = form.getFieldValue('to');
    if (this.accountSelections.includes(to)) {
      to = this.accountDataSelections.find(val => val.name === to).address;
    }
    return to;
  }

  render() {
    const { loading, form, from, settings, smgList, gasPrice, chainType, balance, type, account, getChainAddressInfoByChain, currentTokenPairInfo: info } = this.props;
    const { advancedVisible, advanced, advancedFee, operationFee, networkFee, showChooseContacts, isNewContacts, showAddContacts, contactsList, receivedAmount, totalFee, isPercentOperationFee, percentOperationFee, minOperationFeeLimit, maxOperationFeeLimit } = this.state;
    const { getFieldDecorator } = form;
    let gasFee, gasFeeWithUnit, desChain, selectedList, title, toAccountList, unit, canAdvance, feeUnit, networkFeeUnit, operationFeeUnit;
    if (type === INBOUND) {
      desChain = info.toChainSymbol;
      toAccountList = getChainAddressInfoByChain(info.toChainSymbol);
      selectedList = Object.keys(toAccountList.normal);
      title = `${info.fromTokenSymbol}@${info.fromChainName} -> ${info.toTokenSymbol}@${info.toChainName}`;
      unit = info.fromTokenSymbol;
      feeUnit = info.fromChainSymbol;
      canAdvance = ['WAN', 'ETH'].includes(info.fromChainSymbol);
      operationFeeUnit = 'ETH';
      networkFeeUnit = 'ETH';
    } else {
      desChain = info.fromChainSymbol;
      toAccountList = getChainAddressInfoByChain(info.fromChainSymbol);
      selectedList = Object.keys(toAccountList.normal);
      title = `${info.toTokenSymbol}@${info.toChainName} -> ${info.fromTokenSymbol}@${info.fromChainName}`;
      unit = info.toTokenSymbol;
      feeUnit = info.toChainSymbol;
      canAdvance = ['WAN', 'ETH'].includes(info.toChainSymbol);
      operationFeeUnit = 'ETH';
      networkFeeUnit = 'WAN';
    }
    gasFee = advanced ? advancedFee : new BigNumber(gasPrice.gasPrice).times(FAST_GAS).div(BigNumber(10).pow(9)).toString(10);
    this.accountSelections = this.addressSelections.map(val => getValueByAddrInfo(val, 'name', toAccountList));
    this.accountDataSelections = this.addressSelections.map(val => {
      const name = getValueByAddrInfo(val, 'name', toAccountList);
      return {
        address: val,
        name: name,
        text: `${name}-${val}`
      }
    })
    let defaultSelectStoreman = smgList.length === 0 ? '' : smgList[0].groupId;

    // Convert the value of fee to USD
    // if ((typeof coinPriceObj === 'object') && feeUnit in coinPriceObj) {
    //   totalFee = `${new BigNumber(gasFee).plus(networkFee).times(coinPriceObj[feeUnit]).toString()} USD`;
    // } else {
    //   totalFee = `${new BigNumber(gasFee).plus(networkFee).toString()} ${feeUnit}`;
    // }
    // if (networkFeeUnit === operationFeeUnit) {
    //   totalFee = `${new BigNumber(networkFee).plus(operationFee).toString()} ${networkFeeUnit}`;
    // } else {
    //   totalFee = `${new BigNumber(networkFee).toString()} ${networkFeeUnit} + ${new BigNumber(operationFee).toString()} ${operationFeeUnit}`;
    // }

    gasFeeWithUnit = `${removeRedundantDecimal(gasFee)} ${feeUnit}`;

    // const operationFeeWithUnit = `${removeRedundantDecimal(operationFee)} ${operationFeeUnit}`;

    // const networkFeeWithUnit = `${removeRedundantDecimal(networkFee)} ${networkFeeUnit}`;

    return (
      <div>
        <Modal
          visible
          destroyOnClose={true}
          closable={false}
          title={title}
          onCancel={this.onCancel}
          className={style['cross-chain-modal']}
          footer={[
            <Button key="back" className="cancel" onClick={this.onCancel}>{intl.get('Common.cancel')}</Button>,
            <Button disabled={this.props.spin} key="submit" type="primary" onClick={this.handleNext}>{intl.get('Common.next')}</Button>,
          ]}
        >
          <Spin spinning={this.props.spin} size="large" /* tip={intl.get('Loading.transData')} indicator={<Icon type="loading" style={{ fontSize: 24 }} spin />} */ className="loadingData">
            <div className="validator-bg">
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='from'
                disabled={true}
                options={{ initialValue: account }}
                prefix={<Icon type="wallet" className="colorInput" />}
                title={intl.get('Common.from') + ' (' + getFullChainName(chainType) + ')'}
              />
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='balance'
                disabled={true}
                options={{ initialValue: balance + ` ${unit}` }}
                prefix={<Icon type="wallet" className="colorInput" />}
                title={intl.get('Common.balance')}
              />
              <SelectForm
                form={form}
                colSpan={6}
                formName='storemanAccount'
                initialValue={defaultSelectStoreman}
                selectedList={smgList.map(v => ({
                  text: hexCharCodeToStr(v.groupId),
                  value: v.groupId
                }))}
                isTextValueData={true}
                handleChange={this.updateLockAccounts}
                formMessage={intl.get('Common.storemanGroup')}
              />
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='quota'
                disabled={true}
                options={{ initialValue: `${this.state.maxQuota} ${unit}`, rules: [{ validator: this.checkQuota }] }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('CrossChainTransForm.quota')}
              />
              {/* <AutoCompleteForm
                form={form}
                colSpan={6}
                formName='to'
                dataSource={options}
                formMessage={intl.get('NormalTransForm.to') + ' (' + getFullChainName(desChain) + ')'}
                options={{ rules: [{ required: true }, { validator: this.checkTo }], initialValue: this.accountSelections[0] }}
              /> */}
              <div className="validator-line">
                <Row type="flex" justify="space-around" align="top">
                  <Col span={6}><span className="stakein-name">{intl.get('NormalTransForm.to') + ' (' + getFullChainName(desChain) + ')'}</span></Col>
                  <Col span={18}>
                    <Form layout="inline" id="selectForm">
                      <Form.Item>
                        {getFieldDecorator('to', { rules: [{ required: true }, { validator: this.checkTo }], initialValue: this.accountDataSelections[0].name })
                          (
                            <AutoComplete
                              dataSource={this.accountDataSelections.map(this.renderOption)}
                              filterOption={this.filterToOption}
                              optionLabelProp="text"
                              autoFocus
                            >
                              <Input suffix={
                                <Icon
                                  type="idcard"
                                  onClick={() => {
                                    this.setState({
                                      showChooseContacts: !showChooseContacts
                                    })
                                  }}
                                  className="colorInput"
                                />
                              } />
                            </AutoComplete>
                          )}
                      </Form.Item>
                    </Form>
                  </Col>
                </Row>
              </div>
              {
                isNewContacts
                  ? (
                      <div className="validator-line" style={{ margin: '0px 0px 10px', padding: '0 10px', height: 'auto' }}>
                        <Row type="flex" justify="space-around" align="top">
                          <Col span={6}></Col>
                          <Col span={18}>
                            <Button className={style.addNewContacts} shape="round" onClick={this.handleShowAddContactModal}>
                              <span className={style.magicTxt}>
                                {intl.get('NormalTransForm.addNewContacts')}
                              </span>
                            </Button>
                          </Col>
                        </Row>
                      </div>
                  )
                : null
              }
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='txFee'
                disabled={true}
                options={{ initialValue: gasFeeWithUnit }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('CrossChainTransForm.transactionFee')}
              />
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='totalFee'
                disabled={true}
                options={{ initialValue: totalFee }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('CrossChainTransForm.crosschainFee')}
                tooltips={<ToolTipCus minOperationFeeLimit={minOperationFeeLimit} maxOperationFeeLimit={maxOperationFeeLimit} percentOperationFee={percentOperationFee} isPercentOperationFee={isPercentOperationFee} symbol='ETH' />}
              />
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='amount'
                placeholder={0}
                options={{ rules: [{ required: true, validator: this.checkAmount }] }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('Common.amount')}
              />
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='receive'
                disabled={true}
                options={{ initialValue: `${receivedAmount} ${unit}` }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('CrossChainTransForm.youWillReceive')}
              />
              {type === OUTBOUND && (<Checkbox onChange={this.sendAllAmount} style={{ padding: '0px 20px' }}>{intl.get('NormalTransForm.sendAll')}</Checkbox>)}
              {settings.reinput_pwd && <PwdForm form={form} colSpan={6} />}
              <p className="onAdvancedT"><span onClick={this.onAdvanced}>{intl.get('NormalTransForm.advancedOptions')}</span></p>
            </div>
          </Spin>
        </Modal>
        { this.state.confirmVisible && <Confirm received={form.getFieldValue('receive')} tokenSymbol={unit} chainType={chainType} userNetWorkFee={gasFeeWithUnit} handleCancel={this.handleConfirmCancel} sendTrans={this.sendTrans} from={from} loading={loading} type={type} />}
        {advancedVisible && <AdvancedCrossChainModal chainType={chainType} onCancel={this.handleAdvancedCancel} onSave={this.handleSaveOption} from={from} />}
        {
          showAddContacts && <AddContactsModalForm handleSave={this.handleCreate} onCancel={this.handleShowAddContactModal} address={form.getFieldValue('to')} chain={getFullChainName(desChain)}></AddContactsModalForm>
        }
        {
          showChooseContacts && <ChooseContactsModalForm list={contactsList} to={this.getChooseToAdd()} handleChoose={this.handleChoose} onCancel={() => this.setState({ showChooseContacts: !showChooseContacts })}></ChooseContactsModalForm>
        }
      </div>
    );
  }
}

export default CrossETHForm;
