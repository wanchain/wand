import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { message, Button, Form } from 'antd';
import { getGasPrice, getReadyOpenStoremanGroupList, getChainQuotaHiddenFlagDirectionally, getWanBridgeDiscounts } from 'utils/helper';
import CrossETHForm from 'components/CrossChain/CrossChainTransForm/CrossETHForm';
import { INBOUND, LOCKETH_GAS, REDEEMWETH_GAS, LOCKWETH_GAS, REDEEMETH_GAS, FAST_GAS } from 'utils/settings';

const CollectionCreateForm = Form.create({ name: 'CrossETHForm' })(CrossETHForm);

@inject(stores => ({
  language: stores.languageIntl.language,
  tokenPairs: stores.crossChain.tokenPairs,
  currentTokenPairInfo: stores.crossChain.currentTokenPairInfo,
  updateTransParams: (addr, paramsObj) => stores.sendCrossChainParams.updateTransParams(addr, paramsObj),
  addCrossTransTemplate: (addr, params) => stores.sendCrossChainParams.addCrossTransTemplate(addr, params),
  getChainAddressInfoByChain: chain => stores.tokens.getChainAddressInfoByChain(chain),
}))

@observer
class ETHTrans extends Component {
  state = {
    spin: true,
    loading: false,
    visible: false,
    smgList: [],
    estimateFee: 0,
    gasPrice: 0,
    hideQuota: false
  }

  showModal = async () => {
    const { from, path, balance, record, chainType, addCrossTransTemplate, updateTransParams, type, tokenPairs, chainPairId, getChainAddressInfoByChain, currentTokenPairInfo } = this.props;
    let info = Object.assign({}, tokenPairs[chainPairId]);

    this.setState({ visible: true, loading: true, spin: true });
    addCrossTransTemplate(from, { chainType, path, walletID: record.walletID });
    try {
      const { fromChainID: fromID, toChainID: toID } = currentTokenPairInfo;
      const fromChainID = type === INBOUND ? fromID : toID;
      const toChainID = type === INBOUND ? toID : fromID;
      let hideQuota = false;
      let [gasPrice, smgList, hideQuotaChains, wanBridgeDiscounts] = await Promise.all([getGasPrice(chainType), getReadyOpenStoremanGroupList(), getChainQuotaHiddenFlagDirectionally([fromChainID, toChainID]), getWanBridgeDiscounts()]);
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
        chainPairId: chainPairId,
      });
      this.setState(() => ({ spin: false, loading: false }));
    } catch (err) {
      console.log('showModal:', err);
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
    const { visible, loading, spin, smgList, estimateFee, gasPrice, hideQuota } = this.state;
    const { balance, from, type, account, decimals, symbol, tokenAddr, chainType } = this.props;
    return (
      <div>
        <Button type="primary" onClick={this.showModal} /* disabled={Number(balance) === 0} */>{intl.get('Common.convert')}</Button>
        {visible &&
          <CollectionCreateForm balance={balance} from={from} account={account} hideQuota={hideQuota} gasPrice={gasPrice} decimals={decimals} tokenAddr={tokenAddr} symbol={symbol} chainType={chainType} type={type} estimateFee={estimateFee} smgList={smgList} wrappedComponentRef={this.saveFormRef} onCancel={this.handleCancel} onSend={this.handleSend} loading={loading} spin={spin} />
        }
      </div>
    );
  }
}

export default ETHTrans;
