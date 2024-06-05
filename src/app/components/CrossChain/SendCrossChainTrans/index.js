import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { message, Button, Form } from 'antd';
import { getGasPrice, getReadyOpenStoremanGroupList, getChainQuotaHiddenFlagDirectionally } from 'utils/helper';
import CrossChainTransForm from 'components/CrossChain/CrossChainTransForm';
import { INBOUND, FAST_GAS } from 'utils/settings';

const TransForm = Form.create({ name: 'CrossChainTransForm' })(CrossChainTransForm);

@inject(stores => {
  return {
    language: stores.languageIntl.language,
    transParams: stores.sendCrossChainParams.transParams,
    tokenPairs: stores.crossChain.tokenPairs,
    currTokenPairId: stores.crossChain.currTokenPairId,
    currentTokenPairInfo: stores.crossChain.currentTokenPairInfo,
    updateTransParams: (addr, paramsObj) => stores.sendCrossChainParams.updateTransParams(addr, paramsObj),
    addCrossTransTemplate: (addr, params) => stores.sendCrossChainParams.addCrossTransTemplate(addr, params),
  }
})

@observer
class Trans extends Component {
  state = {
    spin: true,
    loading: false,
    visible: false,
    smgList: [],
    estimateFee: 0,
    tokenAddr: '',
    chainType: '',
    gasPrice: 0,
    hideQuota: false
  }

  showModal = async () => {
    const { from, path, addCrossTransTemplate, updateTransParams, type, tokenPairs, currTokenPairId, record, currentTokenPairInfo } = this.props;
    if (!(currTokenPairId in tokenPairs)) {
      message.error('Token pair ID is missing.');
      return false;
    }
    let info = Object.assign({}, tokenPairs[currTokenPairId]);
    let chainType = type === INBOUND ? info.fromChainSymbol : info.toChainSymbol;
    let tokenAddr = info.toAccount;
    this.setState({ chainType, tokenAddr });
    this.setState({ visible: true, spin: true, loading: true });
    addCrossTransTemplate(from, { chainType, path, walletID: record.walletID });
    try {
      const { fromChainID: fromID, toChainID: toID } = currentTokenPairInfo;
      const fromChainID = type === INBOUND ? fromID : toID;
      const toChainID = type === INBOUND ? toID : fromID;
      let hideQuota = false;
      let [gasPrice, smgList, hideQuotaChains] = await Promise.all([getGasPrice(chainType), getReadyOpenStoremanGroupList(), getChainQuotaHiddenFlagDirectionally([fromChainID, toChainID])]);
      if (smgList.length === 0) {
        this.setState(() => ({ visible: false, spin: false, loading: false }));
        message.warn(intl.get('SendNormalTrans.smgUnavailable'));
        return;
      }
      if (hideQuotaChains) {
        if (hideQuotaChains[fromChainID] && (hideQuotaChains[fromChainID].hiddenSourceChainQuota === true)) {
          hideQuota = true;
        } else if (hideQuotaChains[toChainID] && (hideQuotaChains[toChainID].hiddenTargetChainQuota === true)) {
          hideQuota = true;
        }
      }
      this.setState({
        smgList,
        estimateFee: new BigNumber(gasPrice).times(FAST_GAS).div(BigNumber(10).pow(9)).toString(10),
        gasPrice,
        hideQuota
      });
      let storeman = smgList[0].groupId;
      updateTransParams(from, {
        gasPrice,
        gasLimit: FAST_GAS,
        storeman,
        txFeeRatio: smgList[0].txFeeRatio || 0,
      });
      this.setState({ spin: false, loading: false });
    } catch (err) {
      console.log('showModal:', err)
      message.warn(intl.get('network.down'));
      this.setState(() => ({ visible: false, spin: false, loading: false }));
    }
  }

  handleCancel = () => {
    this.setState({ visible: false, spin: true });
  }

  saveFormRef = formRef => {
    this.formRef = formRef;
  }

  handleSend = from => {
    this.setState({ loading: true });
    this.props.handleSend(from).then(() => {
      this.setState({ visible: false, loading: false, spin: true });
    }).catch(() => {
      this.setState({ visible: false, loading: false, spin: true });
    });
  }

  render() {
    const { visible, loading, spin, smgList, estimateFee, tokenAddr, chainType, gasPrice, hideQuota } = this.state;
    const { balance, from, type, account } = this.props;
    return (
      <div>
        <Button type="primary" onClick={this.showModal} >{intl.get('Common.convert')}</Button>
        {visible &&
          <TransForm balance={balance} from={from} account={account} gasPrice={gasPrice} hideQuota={hideQuota} tokenAddr={tokenAddr} chainType={chainType} type={type} estimateFee={estimateFee} smgList={smgList} wrappedComponentRef={this.saveFormRef} onCancel={this.handleCancel} onSend={this.handleSend} loading={loading} spin={spin} />
        }
      </div>
    );
  }
}

export default Trans;
