import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { message, Button, Form } from 'antd';
import { getReadyOpenStoremanGroupList, getGasPrice, estimateSmartFee, getChainQuotaHiddenFlagDirectionally } from 'utils/helper';
import { INBOUND, OUTBOUND, FAST_GAS } from 'utils/settings';
import CrossBTCForm from 'components/CrossChain/CrossChainTransForm/CrossBTCForm';

const CollectionCreateForm = Form.create({ name: 'CrossBTCForm' })(CrossBTCForm);

@inject(stores => ({
  language: stores.languageIntl.language,
  getAmount: stores.btcAddress.getNormalAmount,
  getTokensListInfo: stores.tokens.getTokensListInfo,
  currentTokenPairInfo: stores.crossChain.currentTokenPairInfo,
  BTCCrossTransParams: stores.sendCrossChainParams.BTCCrossTransParams,
  addCrossTransTemplate: (addr, params) => stores.sendCrossChainParams.addCrossTransTemplate(addr, params),
  updateBTCTransParams: paramsObj => stores.sendCrossChainParams.updateBTCTransParams(paramsObj),
  updateTransParams: (addr, paramsObj) => stores.sendCrossChainParams.updateTransParams(addr, paramsObj),
}))

@observer
class BTCTrans extends Component {
  state = {
    spin: true,
    loading: false,
    visible: false,
    smgList: [],
    estimateFee: 0,
    hideQuota: false
  }

  showModal = async () => {
    const { from, updateBTCTransParams, updateTransParams, direction, path, currentTokenPairInfo: info, addCrossTransTemplate, chainType, record } = this.props;
    this.setState(() => ({ visible: true, spin: true, loading: true }));
    if (direction === OUTBOUND) {
      addCrossTransTemplate(from, { chainType, path, walletID: record.walletID });
    }
    try {
      const { fromChainID, toChainID } = info;
      let [smgList, hideQuotaChains] = await Promise.all([getReadyOpenStoremanGroupList(), getChainQuotaHiddenFlagDirectionally([fromChainID, toChainID])]);
      smgList = smgList.filter(smg => Number(smg.curve1) === 0 || Number(smg.curve2) === 0);
      if (smgList.length === 0) {
        this.setState(() => ({ visible: false, spin: false, loading: false }));
        message.warn(intl.get('SendNormalTrans.smgUnavailable'));
        return;
      }
      let estimateFee;
      let hideQuota = false;
      let smgId = smgList[0].groupId;
      if (direction === INBOUND) {
        estimateFee = 0;
        let feeRate = await estimateSmartFee('BTC');
        updateBTCTransParams({
          feeRate,
          changeAddress: from,
          storeman: smgId,
        });
      } else {
        let gasPrice = await getGasPrice(info.toChainSymbol);
        estimateFee = new BigNumber(gasPrice).times(FAST_GAS).div(BigNumber(10).pow(9)).toString(10);
        updateTransParams(from, {
          gasPrice,
          gasLimit: FAST_GAS,
          storeman: smgId,
        });
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
        estimateFee,
        spin: false,
        loading: false,
        hideQuota
      });
    } catch (err) {
      console.log('showModal:', err);
      this.setState(() => ({ visible: false, spin: false, loading: false }));
      message.warn(intl.get('network.down'));
    }
  }

  handleCancel = () => {
    this.setState({ visible: false, spin: true });
  }

  saveFormRef = formRef => {
    this.formRef = formRef;
  }

  handleSend = (from) => {
    this.setState({ loading: true });
    this.props.handleSend(from).then(() => {
      this.setState({ visible: false, loading: false, spin: true });
    }).catch(() => {
      this.setState({ visible: false, loading: false, spin: true });
    });
  }

  render() {
    const { visible, loading, spin, smgList, estimateFee, hideQuota } = this.state;
    const { from, getAmount, direction, getTokensListInfo, name } = this.props;
    let balance;
    if (direction === INBOUND) {
      balance = getAmount;
    } else {
      let item = getTokensListInfo.find(item => item.address === from);
      balance = item ? item.amount : '0';
    }
    return (
      <div>
        <Button type="primary" onClick={this.showModal} >{intl.get('Common.convert')}</Button>
        { visible &&
          <CollectionCreateForm name={name} from={this.props.from} hideQuota={hideQuota} balance={balance} direction={this.props.direction} estimateFee={estimateFee} smgList={smgList} wrappedComponentRef={this.saveFormRef} onCancel={this.handleCancel} onSend={this.handleSend} loading={loading} spin={spin} />
        }
      </div>
    );
  }
}

export default BTCTrans;
