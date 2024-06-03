import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { message, Button, Form } from 'antd';
import { getGasPrice, getReadyOpenStoremanGroupList, getChainQuotaHiddenFlagDirectionally } from 'utils/helper';
import CrossWANForm from 'components/CrossChain/CrossChainTransForm/CrossWANForm';
import { FAST_GAS } from 'utils/settings';

const TransForm = Form.create({ name: 'CrossWANForm' })(CrossWANForm);

@inject(stores => ({
  language: stores.languageIntl.language,
  tokenPairs: stores.crossChain.tokenPairs,
  currentTokenPairInfo: stores.crossChain.currentTokenPairInfo,
  updateTransParams: (addr, paramsObj) => stores.sendCrossChainParams.updateTransParams(addr, paramsObj),
  addCrossTransTemplate: (addr, params) => stores.sendCrossChainParams.addCrossTransTemplate(addr, params),
}))

@observer
class WANTrans extends Component {
  state = {
    spin: true,
    loading: false,
    visible: false,
    smgList: [],
    estimateFee: 0,
    tokenAddr: '',
    gasPrice: 0,
    hideQuota: false
  }

  showModal = async () => {
    const { from, path, addCrossTransTemplate, updateTransParams, tokenPairs, chainPairId, chainType, record, currentTokenPairInfo } = this.props;
    if (!(chainPairId in tokenPairs)) {
      return false;
    }
    let info = Object.assign({}, tokenPairs[chainPairId]);
    let storeman;
    let tokenAddr = info.toAccount;
    this.setState({ tokenAddr });
    this.setState({ visible: true, loading: true, spin: true });
    addCrossTransTemplate(from, { chainType, path, walletID: record.wid });
    try {
      const { fromChainID, toChainID } = currentTokenPairInfo;
      let hideQuota = false;
      let [gasPrice, smgList, hideQuotaChains] = await Promise.all([getGasPrice(chainType), getReadyOpenStoremanGroupList(), getChainQuotaHiddenFlagDirectionally([fromChainID, toChainID])]);
      if (smgList.length === 0) {
        message.warn(intl.get('SendNormalTrans.smgUnavailable'));
        this.setState({ visible: false, spin: false, loading: false });
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
      storeman = smgList[0].groupId;
      updateTransParams(from, {
        gasPrice,
        gasLimit: FAST_GAS,
        storeman,
        chainPairId: chainPairId,
      });
      this.setState(() => ({ spin: false, loading: false }));
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
    const { visible, loading, spin, smgList, estimateFee, tokenAddr, gasPrice, hideQuota } = this.state;
    const { balance, from, type, account, record } = this.props;
    return (
      <div>
        <Button type="primary" onClick={this.showModal}>{intl.get('Common.convert')}</Button>
        {visible &&
          <TransForm balance={balance} from={from} account={account} gasPrice={gasPrice} hideQuota={hideQuota} tokenAddr={tokenAddr} record={record} chainType={this.props.chainType} type={type} estimateFee={estimateFee} smgList={smgList} wrappedComponentRef={this.saveFormRef} onCancel={this.handleCancel} onSend={this.handleSend} loading={loading} spin={spin} />
        }
      </div>
    );
  }
}

export default WANTrans;
