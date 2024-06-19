import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Icon, message, Spin, Checkbox, Tooltip, AutoComplete, Input, Row, Col } from 'antd';
import style from './index.less';
import ToolTipCus from 'components/Tooltips';
import PwdForm from 'componentUtils/PwdForm';
import SelectForm from 'componentUtils/SelectForm';
import CommonFormItem from 'componentUtils/CommonFormItem';
import HackerAccountVisible from 'componentUtils/HasHackerAccount';
import AddContactsModal from '../../AddContacts/AddContactsModal';
import ChooseContactsModal from '../../AddContacts/ChooseContactsModal';
import AdvancedCrossChainOptionForm from 'components/AdvancedCrossChainOptionForm';
import { INBOUND, CROSS_TYPE, FAST_GAS, WAN_ETH_DECIMAL, WALLETID } from 'utils/settings';
import ConfirmForm from 'components/CrossChain/CrossChainTransForm/ConfirmForm';
import { isExceedBalance, formatNumByDecimals, hexCharCodeToStr, removeRedundantDecimal, fromWei } from 'utils/support';
import { getFullChainName, checkAmountUnit, formatAmount, getValueByAddrInfo, checkAddressByChainType, getQuota, getValueByNameInfoAllType, getInfoByAddress, estimateCrossChainNetworkFee, estimateCrossChainOperationFee, hasHackerAccount } from 'utils/helper';

const Confirm = Form.create({ name: 'CrossChainConfirmForm' })(ConfirmForm);
const AdvancedCrossChainModal = Form.create({ name: 'AdvancedCrossChainOptionForm' })(AdvancedCrossChainOptionForm);
const { Option } = AutoComplete;
const AddContactsModalForm = Form.create({ name: 'AddContactsModal' })(AddContactsModal);
const ChooseContactsModalForm = Form.create({ name: 'AddContactsModal' })(ChooseContactsModal);

@inject(stores => ({
  settings: stores.session.settings,
  language: stores.languageIntl.language,
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
class CrossChainTransForm extends Component {
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
      discountPercentNetworkFee: '1',
      discountPercentOperationFee: '1',
      networkFeeRaw: {},
      operationFeeRaw: {},
      totalFee: '0',
      hackerAccountVisible: false
    }
  }

  async componentDidUpdate(prevProps) {
    if (prevProps.smgList !== this.props.smgList) {
      let { smgList, currentTokenPairInfo: info, chainType, type, hideQuota } = this.props;
      try {
        const targetChainType = type === INBOUND ? info.toChainSymbol : info.fromChainSymbol;
        const [{ minQuota, maxQuota }] = await getQuota(((info.ancestorSymbol === 'EOS' && chainType === 'WAN') ? 'EOS' : chainType), smgList[0].groupId, [info.ancestorSymbol], { targetChainType });// EOS在WAN侧的做特殊处理
        const decimals = info.ancestorDecimals;
        this.setState({
          minQuota: formatNumByDecimals(minQuota, decimals),
          maxQuota: hideQuota ? '0' : formatNumByDecimals(maxQuota, decimals)
        })
      } catch (e) {
        console.log('e:', e);
        message.warn(intl.get('CrossChainTransForm.getQuotaFailed'));
        this.props.onCancel();
      }
    }
  }

  componentDidMount() {
    const { currentTokenPairInfo: info, type, getChainAddressInfoByChain } = this.props;

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
    const { currentTokenPairInfo: info, currTokenPairId, type, form, from } = this.props;
    const { fromChainSymbol, toChainSymbol, ancestorDecimals } = info;

    estimateCrossChainNetworkFee(type === INBOUND ? fromChainSymbol : toChainSymbol, type === INBOUND ? toChainSymbol : fromChainSymbol, { tokenPairID: currTokenPairId, address: [address, from] }).then(res => {
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
    const { currentTokenPairInfo: info, currTokenPairId, type, form, from } = this.props;
    const { fromChainSymbol, toChainSymbol, ancestorDecimals } = info;

    estimateCrossChainOperationFee(type === INBOUND ? fromChainSymbol : toChainSymbol, type === INBOUND ? toChainSymbol : fromChainSymbol, { tokenPairID: currTokenPairId, address: [address, from] }).then(res => {
      this.setState({
        operationFeeRaw: res.isPercent ? '0' : new BigNumber(res.value).dividedBy(Math.pow(10, ancestorDecimals)).toString(),
        operationFee: res.isPercent ? '0' : new BigNumber(res.value).dividedBy(Math.pow(10, ancestorDecimals)).toString(),
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
    const { networkFee, contactsList } = this.state;
    let toAddrInfo = getChainAddressInfoByChain(info[type === INBOUND ? 'toChainSymbol' : 'fromChainSymbol']);
    let isNativeAccount = false; // Figure out if the to value is contained in my wallet.
    form.validateFields(['from', 'balance', 'storemanAccount', 'quota', 'to', 'totalFee', 'amount'], { force: true }, async (err, { pwd, amount: sendAmount, to }) => {
      if (err) {
        console.log('handleNext:', err);
        return;
      };
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

      const hackerAccount = await hasHackerAccount([to, this.props.from])
      if (hackerAccount) {
        this.setState({ hackerAccountVisible: true });
        return;
      }

      let toPath;
      if (type === INBOUND) {
        if (info.toChainSymbol === 'BNB') { // BNB coin type id is the same with ETH, both are 60.
          toPath = 60;
        } else {
          toPath = info.toChainID - Number('0x80000000'.toString(10));
        }
      } else {
        if (info.fromChainSymbol === 'BNB') {
          toPath = 60;
        } else {
          toPath = info.fromChainID - Number('0x80000000'.toString(10));
        }
      }
      toPath = isNativeAccount
                              ? addrType === 'normal' ? `m/44'/${toPath}'/0'/0/${toAddrInfo[addrType][to].path}` : toAddrInfo[addrType][to].path
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
    const { isPercentNetworkFee, isPercentOperationFee, networkFeeRaw, operationFeeRaw, percentNetworkFee, minOperationFeeLimit, maxOperationFeeLimit, percentOperationFee, minNetworkFeeLimit, maxNetworkFeeLimit, discountPercentNetworkFee, discountPercentOperationFee } = this.state;
    const { type, currentTokenPairInfo: info } = this.props;
    if (!value) {
      value = this.props.form.getFieldValue('amount')
    }

    let finnalNetworkFee, finnalOperationFee, totalFee, networkFeeUnit, operationFeeUnit;
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
      operationFeeUnit = info.ancestorSymbol;
      networkFeeUnit = info.fromChainSymbol;
    } else {
      operationFeeUnit = info.ancestorSymbol;
      networkFeeUnit = info.toChainSymbol;
    }

    totalFee = `${new BigNumber(finnalNetworkFee).toString(10)} ${networkFeeUnit} + ${new BigNumber(finnalOperationFee).toString(10)} ${operationFeeUnit}`;

    this.setState({ networkFee: finnalNetworkFee, operationFee: finnalOperationFee, totalFee });
    return [finnalNetworkFee, finnalOperationFee];
  }

  checkAmount = (rule, value, callback) => {
    const { balance, estimateFee, from, type, currentTokenPairInfo: info, getChainAddressInfoByChain, form, account } = this.props;
    const decimals = info.ancestorDecimals;
    const { ancestorDecimals } = info;
    const unit = type === INBOUND ? info.fromTokenSymbol : info.toTokenSymbol;
    const { maxQuota, minQuota } = this.state;
    const { txFee } = form.getFieldsValue(['txFee']);
    const txFeeWithoutUnit = txFee.split(' ')[0];

    const message = intl.get('NormalTransForm.amountIsIncorrect');

    try {
      if (new BigNumber(value).lte(0) || !checkAmountUnit(ancestorDecimals, value)) {
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
        const fromAddrBalance = getValueByNameInfoAllType(account, 'balance', getChainAddressInfoByChain(info.fromChainSymbol))
        if (new BigNumber(fromAddrBalance).minus(finnalNetworkFee).minus(txFeeWithoutUnit).lt(0)) {
          message.warn(intl.get('NormalTransForm.insufficientFee'))
          return;
        }
        if (new BigNumber(value).minus(finnalOperationFee).lte(0)) {
          callback(message);
          return;
        }
        if (new BigNumber(balance).lt(value)) {
          callback(intl.get('CrossChainTransForm.overOriginalBalance'));
          return;
        }
        this.setState({ receivedAmount: new BigNumber(value).minus(finnalOperationFee).toString(10) })
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
    let { from, form, updateTransParams, chainType, type, currentTokenPairInfo: info, hideQuota } = this.props;
    try {
      const targetChainType = type === INBOUND ? info.toChainSymbol : info.fromChainSymbol;
      const [{ minQuota, maxQuota }] = await getQuota(((info.ancestorSymbol === 'EOS' && chainType === 'WAN') ? 'EOS' : chainType), storeman, [info.ancestorSymbol], { targetChainType });// EOS在WAN侧的做特殊处理
      const decimals = info.ancestorDecimals;
      this.setState({
        minQuota: formatNumByDecimals(minQuota, decimals),
        maxQuota: hideQuota ? '0' : formatNumByDecimals(maxQuota, decimals)
      }, () => {
        form.setFieldsValue({
          quota: `${hideQuota ? '0' : this.state.maxQuota} ${type === INBOUND ? info.fromTokenSymbol : info.toTokenSymbol}`
        })
      });
    } catch (e) {
      console.log('e:', e);
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
      advancedFee: formatNumByDecimals(new BigNumber(gasPrice).times(gasLimit).times(BigNumber(10).pow(9)).toString(10), WAN_ETH_DECIMAL),
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
    const { currentTokenPairInfo: info, addAddress, type } = this.props;
    const chainSymbol = getFullChainName(type === INBOUND ? info.toChainSymbol : info.fromChainSymbol);
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
    const { loading, form, from, settings, smgList, gasPrice, chainType, balance, type, account, getChainAddressInfoByChain, currentTokenPairInfo: info, wanBridgeDiscounts } = this.props;
    const { getFieldDecorator } = form;
    const { advancedVisible, advanced, advancedFee, operationFee, showChooseContacts, isNewContacts, showAddContacts, contactsList, networkFee, receivedAmount, totalFee, minOperationFeeLimit, maxOperationFeeLimit, percentOperationFee, isPercentOperationFee, hackerAccountVisible, discountPercentOperationFee } = this.state;
    let gasFee, gasFeeWithUnit, desChain, title, tokenSymbol, toAccountList, quotaUnit, canAdvance, feeUnit, networkFeeUnit, operationFeeUnit;
    if (type === INBOUND) {
      desChain = info.toChainSymbol;
      toAccountList = getChainAddressInfoByChain(info.toChainSymbol);
      title = `${info.fromTokenSymbol}@${info.fromChainName} -> ${info.toTokenSymbol}@${info.toChainName}`;
      tokenSymbol = info.toTokenSymbol;
      quotaUnit = info.fromTokenSymbol;
      feeUnit = info.fromChainSymbol;
      canAdvance = ['WAN', 'ETH'].includes(info.fromChainSymbol);
      operationFeeUnit = info.ancestorSymbol;
      networkFeeUnit = info.fromChainSymbol;
    } else {
      desChain = info.fromChainSymbol;
      toAccountList = getChainAddressInfoByChain(info.fromChainSymbol);
      title = `${info.toTokenSymbol}@${info.toChainName} -> ${info.fromTokenSymbol}@${info.fromChainName}`;
      tokenSymbol = info.fromTokenSymbol;
      quotaUnit = info.toTokenSymbol;
      feeUnit = info.toChainSymbol;
      canAdvance = ['WAN', 'ETH'].includes(info.toChainSymbol);
      operationFeeUnit = info.ancestorSymbol;
      networkFeeUnit = info.toChainSymbol;
    }
    this.accountSelections = this.addressSelections.map(val => getValueByAddrInfo(val, 'name', toAccountList));
    this.accountDataSelections = this.addressSelections.map(val => {
      const name = getValueByAddrInfo(val, 'name', toAccountList);
      return {
        address: val,
        name: name,
        text: `${name}-${val}`
      }
    })
    gasFee = advanced ? advancedFee : new BigNumber(gasPrice).times(FAST_GAS).div(BigNumber(10).pow(9)).toString(10);
    let defaultSelectStoreman = smgList.length === 0 ? '' : smgList[0].groupId;

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
                options={{ initialValue: balance + ` ${tokenSymbol}` }}
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
                options={{ initialValue: `${this.state.maxQuota} ${quotaUnit}`, rules: [{ validator: this.checkQuota }] }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('CrossChainTransForm.quota')}
              />
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
                tooltips={<ToolTipCus discountPercentOperationFee={discountPercentOperationFee} wanBridgeDiscounts={wanBridgeDiscounts} minOperationFeeLimit={minOperationFeeLimit} maxOperationFeeLimit={maxOperationFeeLimit} percentOperationFee={percentOperationFee} isPercentOperationFee={isPercentOperationFee} symbol={info.ancestorSymbol} />}
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
                options={{ initialValue: `${receivedAmount} ${tokenSymbol}` }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('CrossChainTransForm.youWillReceive')}
              />
              <Checkbox onChange={this.sendAllAmount} style={{ padding: '0px 20px' }}>{intl.get('NormalTransForm.sendAll')}</Checkbox>
              {settings.reinput_pwd && <PwdForm form={form} colSpan={6} />}
              <p className="onAdvancedT"><span onClick={this.onAdvanced}>{intl.get('NormalTransForm.advancedOptions')}</span></p>
            </div>
          </Spin>
        </Modal>
        <Confirm tokenSymbol={tokenSymbol} received={form.getFieldValue('receive')} chainType={chainType} userNetWorkFee={gasFeeWithUnit} visible={this.state.confirmVisible} handleCancel={this.handleConfirmCancel} sendTrans={this.sendTrans} from={from} type={type} loading={loading} />
        {advancedVisible && <AdvancedCrossChainModal chainType={chainType} onCancel={this.handleAdvancedCancel} onSave={this.handleSaveOption} from={from} />}
        {
          showAddContacts && <AddContactsModalForm handleSave={this.handleCreate} onCancel={this.handleShowAddContactModal} address={form.getFieldValue('to')} chain={getFullChainName(desChain)}></AddContactsModalForm>
        }
        {
          showChooseContacts && <ChooseContactsModalForm list={contactsList} to={this.getChooseToAdd()} handleChoose={this.handleChoose} onCancel={() => this.setState({ showChooseContacts: !showChooseContacts })}></ChooseContactsModalForm>
        }
        {
          hackerAccountVisible && <HackerAccountVisible handleCancel={() => this.setState({ hackerAccountVisible: false })}/>
        }
      </div>
    );
  }
}

export default CrossChainTransForm;
