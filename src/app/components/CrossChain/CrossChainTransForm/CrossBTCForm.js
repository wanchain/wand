import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Icon, message, Spin, Checkbox, Tooltip, AutoComplete, Input, Row, Col } from 'antd';
import style from './index.less';
import ToolTipCus from 'components/Tooltips';
import PwdForm from 'componentUtils/PwdForm';
import SelectForm from 'componentUtils/SelectForm';
import { isExceedBalance, formatNumByDecimals, removeRedundantDecimal, hexCharCodeToStr, fromWei } from 'utils/support';
import CommonFormItem from 'componentUtils/CommonFormItem';
import AddContactsModal from '../../AddContacts/AddContactsModal';
import HackerAccountVisible from 'componentUtils/HasHackerAccount';
import ChooseContactsModal from '../../AddContacts/ChooseContactsModal';
import { INBOUND, OUTBOUND, WALLETID } from 'utils/settings';
import outboundOptionForm from 'components/AdvancedCrossChainOptionForm';
import OptionForm from 'components/AdvancedCrossChainOptionForm/AdvancedBTCCrossChainOptionForm';
import ConfirmForm from 'components/CrossChain/CrossChainTransForm/ConfirmForm/CrossBTCConfirmForm';
import { getFullChainName, getBalanceByAddr, checkAmountUnit, formatAmount, getValueByAddrInfo, getCrossChainContractData, getQuota, checkAddressByChainType, getValueByNameInfoAllType, getInfoByAddress, estimateCrossChainNetworkFee, estimateCrossChainOperationFee, hasHackerAccount } from 'utils/helper';

const Confirm = Form.create({ name: 'CrossBTCConfirmForm' })(ConfirmForm);
const AdvancedOptionForm = Form.create({ name: 'AdvancedBTCCrossChainOptionForm' })(OptionForm);
const AdvancedOutboundOptionForm = Form.create({ name: 'AdvancedBTCCrossChainOptionForm' })(outboundOptionForm);
const { Option } = AutoComplete;
const AddContactsModalForm = Form.create({ name: 'AddContactsModal' })(AddContactsModal);
const ChooseContactsModalForm = Form.create({ name: 'AddContactsModal' })(ChooseContactsModal);

@inject(stores => ({
  utxos: stores.btcAddress.utxos,
  settings: stores.session.settings,
  btcPath: stores.btcAddress.btcPath,
  addrInfo: stores.btcAddress.addrInfo,
  language: stores.languageIntl.language,
  minCrossBTC: stores.sendCrossChainParams.minCrossBTC,
  currentTokenPairInfo: stores.crossChain.currentTokenPairInfo,
  coinPriceObj: stores.portfolio.coinPriceObj,
  transParams: stores.sendCrossChainParams.transParams,
  BTCCrossTransParams: stores.sendCrossChainParams.BTCCrossTransParams,
  currTokenPairId: stores.crossChain.currTokenPairId,
  contacts: stores.contacts.contacts,
  updateTransParams: (addr, paramsObj) => stores.sendCrossChainParams.updateTransParams(addr, paramsObj),
  updateBTCTransParams: paramsObj => stores.sendCrossChainParams.updateBTCTransParams(paramsObj),
  getChainAddressInfoByChain: chain => stores.tokens.getChainAddressInfoByChain(chain),
  getPathPrefix: chain => stores.tokens.getPathPrefix(chain),
  addAddress: (chain, addr, val) => stores.contacts.addAddress(chain, addr, val),
  hasSameContact: (addr, chain) => stores.contacts.hasSameContact(addr, chain),
}))

@observer
class CrossBTCForm extends Component {
  constructor(props) {
    super(props);
    let info = props.currentTokenPairInfo;
    let addressInfo = props.getChainAddressInfoByChain(props.direction === INBOUND ? info.toChainSymbol : info.fromChainSymbol);
    this.addressSelections = Object.keys({ ...addressInfo.normal, ...addressInfo.ledger, ...addressInfo.trezor });
    this.accountSelections = this.addressSelections.map(val => getValueByAddrInfo(val, 'name', addressInfo));
    this.accountDataSelections = this.addressSelections.map(val => {
      const name = getValueByAddrInfo(val, 'name', addressInfo);
      return {
        address: val,
        name: name,
        text: `${name}-${val}`
      }
    })
    this.state = {
      fee: 0,
      confirmVisible: false,
      advancedVisible: false,
      feeRate: 0,
      minQuota: 0,
      maxQuota: 0,
      receive: 0,
      sendAll: false,
      contactsList: [],
      isNewContacts: false,
      showAddContacts: false,
      showChooseContacts: false,
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
      let { smgList, direction, currentTokenPairInfo: info, hideQuota } = this.props;
      try {
        const chainType = direction === INBOUND ? info.fromChainSymbol : info.toChainSymbol;
        const targetChainType = direction === INBOUND ? info.toChainSymbol : info.fromChainSymbol;
        let [{ minQuota, maxQuota }] = await getQuota(chainType, smgList[0].groupId, [info.ancestorSymbol], { targetChainType });
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

  componentWillUnmount() {
    this.setState = () => {
      return false;
    };
  }

  componentDidMount() {
    this.processContacts();
    this.estimateNetworkFee();
    this.estimateOperationFee();
  }

  estimateNetworkFee = (toAddrsss = '') => {
    const { direction, currentTokenPairInfo: info, currTokenPairId, from, form } = this.props;
    const { toChainSymbol, ancestorDecimals } = info;

    estimateCrossChainNetworkFee(direction === INBOUND ? 'BTC' : toChainSymbol, direction === INBOUND ? toChainSymbol : 'BTC', { tokenPairID: currTokenPairId, address: [from, toAddrsss] }).then(res => {
      this.setState({
        networkFeeRaw: res.isPercent ? '0' : direction === INBOUND ? formatNumByDecimals(res?.value, ancestorDecimals) : fromWei(res.value),
        networkFee: res.isPercent ? '0' : direction === INBOUND ? formatNumByDecimals(res?.value, ancestorDecimals) : fromWei(res.value),
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

  estimateOperationFee = (toAddrsss = '') => {
    const { direction, currentTokenPairInfo: info, currTokenPairId, from, form } = this.props;
    const { toChainSymbol, ancestorDecimals } = info;

    estimateCrossChainOperationFee(direction === INBOUND ? 'BTC' : toChainSymbol, direction === INBOUND ? toChainSymbol : 'BTC', { tokenPairID: currTokenPairId, address: [from, toAddrsss] }).then(res => {
      console.log('res', res)
      this.setState({
        operationFeeRaw: res.isPercent ? '0' : formatNumByDecimals(res.value, ancestorDecimals),
        operationFee: res.isPercent ? '0' : formatNumByDecimals(res.value, ancestorDecimals),
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

  processContacts = () => {
    const { contacts, currentTokenPairInfo: info, direction } = this.props;
    const { normalAddr } = contacts;
    const chainSymbol = getFullChainName(info[direction === INBOUND ? 'toChainSymbol' : 'fromChainSymbol']);
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

  handleNext = () => {
    const { updateBTCTransParams, updateTransParams, addrInfo, settings, estimateFee, form, direction, balance, from, btcPath, currentTokenPairInfo: info, getChainAddressInfoByChain, getPathPrefix, name } = this.props;
    const { sendAll, networkFee, contactsList } = this.state;
    let otherAddrInfo = Object.assign({}, getChainAddressInfoByChain(info.toChainSymbol));
    let isNativeAccount = false; // Figure out if the to value is contained in my wallet.
    form.validateFields(async (err, { pwd, amount: sendAmount, to, totalFee }) => {
      if (err) {
        console.log('handleNext:', err);
        return;
      };

      const { minQuota, maxQuota, fee } = this.state;
      if (new BigNumber(sendAmount).lt(minQuota)) {
        message.warn(`${intl.get('CrossChainTransForm.UnderFastMinimum')}: ${removeRedundantDecimal(minQuota, 2)} ${info[direction === INBOUND ? 'fromTokenSymbol' : 'toTokenSymbol']}`);
        return;
      }

      if (new BigNumber(sendAmount).gt(maxQuota)) {
        message.warn(intl.get('CrossChainTransForm.overQuota'));
        return;
      }

      if (direction === INBOUND) {
        if (new BigNumber(balance).minus(sendAmount).lt(fee)) {
          message.warn(intl.get('NormalTransForm.insufficientFee'))
          return;
        }
      } else {
        const fromAddrBalance = getValueByNameInfoAllType(name, 'balance', getChainAddressInfoByChain(info.toChainSymbol))
        if (new BigNumber(fromAddrBalance).minus(networkFee).lt(estimateFee)) {
          message.warn(intl.get('NormalTransForm.insufficientFee'))
          return;
        }
      }

      let addrType = 'normal';
      let toAddrInfo = direction === INBOUND ? otherAddrInfo : addrInfo
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

      if (direction === INBOUND) {
        if (!sendAll && isExceedBalance(balance, fee, sendAmount)) {
          message.warn(intl.get('CrossChainTransForm.overBalance'));
          return;
        }
      } else {
        if (isExceedBalance(balance, sendAmount) || isExceedBalance(getBalanceByAddr(from, otherAddrInfo), estimateFee)) {
          message.warn(intl.get('CrossChainTransForm.overBalance'));
          return;
        }
      }

      let walletID = addrType === 'normal' ? 1 : WALLETID[addrType.toUpperCase()]
      let toValue = isNativeAccount && addrType !== 'trezor';
      if (settings.reinput_pwd) {
        if (!pwd) {
          message.warn(intl.get('Backup.invalidPassword'));
          return;
        }
        wand.request('phrase_checkPwd', { pwd }, (err) => {
          if (err) {
            message.warn(intl.get('Backup.invalidPassword'));
          } else {
            if (direction === INBOUND) {
              updateBTCTransParams({ to: toValue ? { walletID, path: addrType === 'normal' ? getPathPrefix(info.toChainSymbol) + otherAddrInfo.normal[to].path : otherAddrInfo[addrType][to].path } : to, toAddr: to, value: formatAmount(sendAmount), crosschainFee: form.getFieldValue('totalFee'), receivedAmount: form.getFieldValue('receive') });
            } else {
              updateTransParams(from, { networkFee, to: toValue ? { walletID, path: btcPath + addrInfo.normal[to].path } : to, toAddr: to, amount: formatAmount(sendAmount), crosschainFee: form.getFieldValue('totalFee'), receivedAmount: form.getFieldValue('receive') });
            }
            this.setState({ confirmVisible: true });
          }
        })
      } else {
        if (direction === INBOUND) {
          updateBTCTransParams({ to: toValue ? { walletID, path: addrType === 'normal' ? getPathPrefix(info.toChainSymbol) + otherAddrInfo.normal[to].path : otherAddrInfo[addrType][to].path } : to, toAddr: to, value: formatAmount(sendAmount), crosschainFee: form.getFieldValue('totalFee'), receivedAmount: form.getFieldValue('receive') });
        } else {
          updateTransParams(from, { networkFee, to: toValue ? { walletID, path: btcPath + addrInfo.normal[to].path } : to, toAddr: to, amount: formatAmount(sendAmount), crosschainFee: form.getFieldValue('totalFee'), receivedAmount: form.getFieldValue('receive') });
        }
        this.setState({ confirmVisible: true });
      }
    });
  }

  sendTrans = () => {
    this.props.onSend(this.props.from);
  }

  updateCrosschainFee = (value = '0') => {
    const { isPercentNetworkFee, isPercentOperationFee, percentNetworkFee, percentOperationFee, networkFeeRaw, operationFeeRaw, minNetworkFeeLimit, maxNetworkFeeLimit, minOperationFeeLimit, maxOperationFeeLimit, discountPercentNetworkFee, discountPercentOperationFee } = this.state;
    const { direction, currentTokenPairInfo: info } = this.props;
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

    if (direction === INBOUND) {
      totalFee = `${new BigNumber(finnalNetworkFee).plus(finnalOperationFee).toString()} BTC`;
    } else {
      totalFee = `${new BigNumber(finnalNetworkFee).toString()} ${info.toChainSymbol} + ${new BigNumber(finnalOperationFee).toString()} BTC`;
    }

    this.setState({ networkFee: finnalNetworkFee, operationFee: finnalOperationFee, totalFee });

    return [finnalNetworkFee, finnalOperationFee];
  }

  checkAmount = async (rule, value, callback) => {
    const { addrInfo, btcPath, updateBTCTransParams, minCrossBTC, direction, balance, currentTokenPairInfo: info } = this.props;
    const { minQuota, maxQuota, sendAll } = this.state;
    const message = intl.get('NormalTransForm.amountIsIncorrect');

    try {
      if (new BigNumber(value).lte(0) || !checkAmountUnit(8, value)) {
        callback(message);
        return;
      }
      if (new BigNumber(value).lt(minQuota) || new BigNumber(value).lt(minCrossBTC)) {
        const min = Math.max(minQuota, minCrossBTC);
        let errText = `${intl.get('CrossChainTransForm.UnderFastMinimum')}: ${removeRedundantDecimal(min, 2)} ${info[direction === INBOUND ? 'fromTokenSymbol' : 'toTokenSymbol']}`;
        callback(errText);
        return;
      }
      if (new BigNumber(value).gt(maxQuota)) {
        callback(intl.get('CrossChainTransForm.overQuota'))
        return;
      }

      const [finnalNetworkFee, finnalOperationFee] = this.updateCrosschainFee(value)

      if (direction === INBOUND) {
        const from = Object.keys(addrInfo.normal).map(key => ({
          path: `${btcPath}${addrInfo.normal[key].path}`,
          walletID: 1
        }));
        updateBTCTransParams({ from });
        try {
          if (new BigNumber(balance).lte(value)) {
            callback(intl.get('CrossChainTransForm.overOriginalBalance'));
            return;
          }
          const getFee = await this.getFee(from, value);
          if (getFee === false) {
            callback(intl.get('CrossChainTransForm.getNetworkFeeFailed'));
            return;
          }
          const fee = formatNumByDecimals(getFee.result.fee, 8); // user network fee
          this.setState({ fee });
          if (new BigNumber(value).minus(finnalNetworkFee).minus(finnalOperationFee).lte(0)) {
            callback(message);
            return;
          }
          if (!sendAll && isExceedBalance(balance, fee, value)) {
            callback(intl.get('CrossChainTransForm.overBalance'));
            return;
          }
          this.setState({ fee, receive: new BigNumber(value).minus(finnalNetworkFee).minus(finnalOperationFee).toString(10) });
        } catch (e) {
          console.log('get Fee error:', e);
          callback(intl.get('CrossChainTransForm.getNetworkFeeFailed'));
        }
      } else {
        if (isExceedBalance(balance, value)) {
          callback(intl.get('CrossChainTransForm.overBalance'));
          return;
        }

        if (new BigNumber(value).minus(finnalOperationFee).lte(0)) {
          callback(intl.get('CrossChainTransForm.overOriginalBalance'));
          return;
        }
        this.setState({ receive: new BigNumber(value).minus(finnalOperationFee).toString(10) });
      }

      callback();
    } catch (error) {
      callback(message);
    }
  }

  getFee = (from, value) => {
    const { direction, BTCCrossTransParams, transParams, currTokenPairId: tokenPairID, currentTokenPairInfo: info, getPathPrefix, getChainAddressInfoByChain, form, addrInfo } = this.props;
    let otherAddrInfo = getChainAddressInfoByChain(info.toChainSymbol);

    let toAddress = form.getFieldsValue(['to']).to;
    let isNativeAccount = false;
    let addrType = 'normal';
    let toAddrInfo = direction === INBOUND ? otherAddrInfo : addrInfo
    if (this.accountSelections.includes(toAddress)) {
      addrType = getValueByNameInfoAllType(toAddress, 'type', toAddrInfo)
      toAddress = getValueByNameInfoAllType(toAddress, 'address', toAddrInfo);
      isNativeAccount = true;
    } else if (this.addressSelections.includes(toAddress)) {
      isNativeAccount = true;
      addrType = getInfoByAddress(toAddress, [], toAddrInfo).type
    }

    let input;
    if (direction === INBOUND) {
      input = {
        from,
        tokenPairID,
        value,
        feeRate: BTCCrossTransParams.feeRate,
        changeAddress: BTCCrossTransParams.changeAddress,
        storeman: BTCCrossTransParams.storeman,
        to: isNativeAccount && addrType !== 'trezor' ? {
          walletID: addrType === 'normal' ? 1 : 2,
          path: addrType === 'normal' ? getPathPrefix(info.toChainSymbol) + otherAddrInfo.normal[toAddress].path : otherAddrInfo[addrType][toAddress].path
        } : toAddress
      }
    } else {
      input = {
        from: from.walletID === 3 ? this.props.from : from,
        to: isNativeAccount ? {
          walletID: 1,
          path: getPathPrefix(info.fromChainSymbol) + addrInfo.normal[toAddress].path
        } : toAddress,
        amount: value,
        gasPrice: transParams[this.props.from].gasPrice,
        gasLimit: transParams[this.props.from].gasLimit,
        storeman: transParams[this.props.from].storeman,
        tokenPairID,
        crossType: transParams[this.props.from].crossType
      };
    }
    let param = direction === INBOUND ? { input, tokenPairID, sourceSymbol: info.fromChainSymbol, sourceAccount: info.fromAccount, destinationSymbol: info.toChainSymbol, destinationAccount: info.toAccount, type: 'LOCK' } : { input, tokenPairID, sourceSymbol: info.toChainSymbol, sourceAccount: info.toAccount, destinationSymbol: info.fromChainSymbol, destinationAccount: info.fromAccount, type: 'LOCK' };
    return getCrossChainContractData(param);
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

  checkTo = async (rule, value, callback) => {
    const { currentTokenPairInfo: info, direction, hasSameContact } = this.props;
    let toChain = direction === INBOUND ? info.toChainSymbol : info.fromChainSymbol;
    const chainSymbol = getFullChainName(toChain);
    const isNewContacts = hasSameContact(value, chainSymbol);
    if (this.accountSelections.includes(value) || this.addressSelections.includes(value)) {
      this.setState({
        isNewContacts: false
      });
      this.estimateNetworkFee(value);
      this.estimateOperationFee(value);
      callback();
    } else {
      let isValid;
      if (toChain === 'WAN') {
        let [isWAN, isETH] = await Promise.all([checkAddressByChainType(value, 'WAN'), checkAddressByChainType(value, 'ETH')]);
        isValid = isWAN || isETH;
      } else {
        isValid = await checkAddressByChainType(value, toChain);
      }
      if (isValid) {
        this.setState({
          isNewContacts: !isNewContacts
        });
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

  filterToOption = (inputValue, option) => {
    const value = option.props.name;
    return value.toLowerCase().indexOf(inputValue.toLowerCase()) > -1;
  }

  updateLockAccounts = async (storeman) => {
    const { updateBTCTransParams, updateTransParams, direction, currentTokenPairInfo: info, from, hideQuota } = this.props;
    try {
      const chainType = direction === INBOUND ? info.fromChainSymbol : info.toChainSymbol;
      const targetChainType = direction === INBOUND ? info.toChainSymbol : info.fromChainSymbol;
      const [{ minQuota, maxQuota }] = await getQuota(chainType, storeman, [info.ancestorSymbol], { targetChainType });
      const decimals = info.ancestorDecimals;
      this.setState({
        minQuota: formatNumByDecimals(minQuota, decimals),
        maxQuota: hideQuota ? '0' : formatNumByDecimals(maxQuota, decimals)
      });
    } catch (e) {
      console.log('updateLockAccounts:', e);
      message.warn(intl.get('CrossChainTransForm.getQuotaFailed'));
      this.props.onCancel();
    }

    direction === INBOUND ? updateBTCTransParams({ storeman }) : updateTransParams(from, { storeman });
  }

  filterStoremanData = item => {
    return item.groupId;
  }

  sendAllAmount = e => {
    let { form, balance } = this.props;
    if (e.target.checked) {
      this.setState({ sendAll: true });
      form.setFieldsValue({
        amount: new BigNumber(balance).toString(10)
      }, () => {
        form.validateFields(['amount'], { force: true });
      });
    } else {
      this.setState({ sendAll: false });
      form.setFieldsValue({
        amount: 0
      });
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

  handleInBoundSaveOption = (feeRate) => {
    const { updateBTCTransParams, form } = this.props;
    this.setState({
      advancedVisible: false,
      feeRate
    });
    updateBTCTransParams({ feeRate });
    form.validateFields(['amount'], { force: true });
  }

  handleOutBoundSaveOption = (gasPrice, gasLimit) => {
    this.props.updateBTCTransParams({ gasPrice, gasLimit });
    this.setState({
      advancedVisible: false,
    });
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
    const { loading, form, from, settings, smgList, estimateFee, direction, addrInfo, balance, currentTokenPairInfo: info, getChainAddressInfoByChain, coinPriceObj, name, wanBridgeDiscounts } = this.props;
    const { advancedVisible, feeRate, receive, sendAll, isNewContacts, showAddContacts, showChooseContacts, contactsList, totalFee, minOperationFeeLimit, maxOperationFeeLimit, percentOperationFee, isPercentOperationFee, hackerAccountVisible } = this.state;
    const { getFieldDecorator } = form;
    let gasFee, gasFeeWithUnit, desChain, defaultSelectStoreman, title, unit, toUnit, feeUnit, operationFeeUnit, networkFeeUnit;
    let otherAddrInfo = getChainAddressInfoByChain(info.toChainSymbol);
    if (direction === INBOUND) {
      desChain = info.toChainSymbol;
      title = `${info.fromTokenSymbol}@${info.fromChainName} -> ${info.toTokenSymbol}@${info.toChainName}`;
      gasFeeWithUnit = `${this.state.fee} ${info.fromChainSymbol}`;
      feeUnit = info.fromChainSymbol;
      operationFeeUnit = 'BTC';
      networkFeeUnit = 'BTC';
    } else {
      desChain = info.fromChainSymbol;
      title = `${info.toTokenSymbol}@${info.toChainName} -> ${info.fromTokenSymbol}@${info.fromChainName}`;
      gasFeeWithUnit = `${removeRedundantDecimal(estimateFee)} ${info.toChainSymbol}`;
      feeUnit = info.toChainSymbol;
      operationFeeUnit = 'BTC';
      networkFeeUnit = info.toChainSymbol;
    }

    if (smgList.length === 0) {
      defaultSelectStoreman = '';
    } else {
      if (direction === INBOUND) {
        unit = info.fromTokenSymbol;
        toUnit = info.toTokenSymbol;
      } else {
        unit = info.toTokenSymbol;
        toUnit = info.fromTokenSymbol;
      }
      defaultSelectStoreman = smgList[0].groupId;
    }

    return (
      <div>
        <Modal
          visible
          destroyOnClose={true}
          closable={false}
          title={title}
          onCancel={this.props.onCancel}
          className={style['cross-chain-modal']}
          footer={[
            <Button key="back" className="cancel" onClick={this.props.onCancel}>{intl.get('Common.cancel')}</Button>,
            <Button disabled={this.props.spin} key="submit" type="primary" onClick={this.handleNext}>{intl.get('Common.next')}</Button>,
          ]}
        >
          <Spin spinning={this.props.spin} size="large" className="loadingData">
            <div className="validator-bg">
              {
                direction !== INBOUND &&
                <CommonFormItem
                  form={form}
                  colSpan={6}
                  formName='from'
                  disabled={true}
                  options={{ initialValue: getValueByAddrInfo(from, 'name', otherAddrInfo) }}
                  prefix={<Icon type="credit-card" className="colorInput" />}
                  title={intl.get('Common.from')}
                />
              }
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='balance'
                disabled={true}
                options={{ initialValue: `${balance} ${unit}` }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('StakeInForm.balance')}
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
                filterItem={this.filterStoremanData}
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
                dataSource={this.accountSelections}
                formMessage={intl.get('NormalTransForm.to') + ' (' + getFullChainName(desChain) + ')'}
                options={{ rules: [{ required: true }, { validator: this.checkTo }], initialValue: this.accountSelections[0] }}
                filterOption={this.filterToOption}
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
                tooltips={<ToolTipCus wanBridgeDiscounts={wanBridgeDiscounts} minOperationFeeLimit={minOperationFeeLimit} maxOperationFeeLimit={maxOperationFeeLimit} percentOperationFee={percentOperationFee} isPercentOperationFee={isPercentOperationFee} symbol='BTC'/>}
              />
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='amount'
                options={{ rules: [{ required: true, validator: this.checkAmount }] }}
                placeholder={0}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('Common.amount')}
              />
              <CommonFormItem
                form={form}
                colSpan={6}
                formName='receive'
                disabled={true}
                options={{ initialValue: `${receive} ${toUnit}` }}
                prefix={<Icon type="credit-card" className="colorInput" />}
                title={intl.get('CrossChainTransForm.youWillReceive')}
              />
              <Checkbox checked={sendAll} onChange={this.sendAllAmount} style={{ padding: '0px 20px' }}>{intl.get('NormalTransForm.sendAll')}</Checkbox>
              {settings.reinput_pwd && <PwdForm form={form} colSpan={6} />}
              <p className="onAdvancedT"><span onClick={this.onAdvanced}>{intl.get('NormalTransForm.advancedOptions')}</span></p>
            </div>
          </Spin>
        </Modal>
        <Confirm chainType="BTC" direction={direction} name={name} received={form.getFieldValue('receive')} userNetWorkFee={gasFeeWithUnit} crosschainFee={totalFee} visible={this.state.confirmVisible} handleCancel={this.handleConfirmCancel} sendTrans={this.sendTrans} from={from} loading={loading} />
        { advancedVisible && direction === INBOUND && <AdvancedOptionForm chainType={'BTC'} value={feeRate || this.props.BTCCrossTransParams.feeRate} onCancel={this.handleAdvancedCancel} onSave={this.handleInBoundSaveOption} from={from} />}
        { advancedVisible && direction === OUTBOUND && <AdvancedOutboundOptionForm chainType={info.toChainSymbol} onCancel={this.handleAdvancedCancel} onSave={this.handleOutBoundSaveOption} from={from} />}
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

export default CrossBTCForm;
