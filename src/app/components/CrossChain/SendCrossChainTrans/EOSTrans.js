import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { BigNumber } from 'bignumber.js';
import { observer, inject } from 'mobx-react';
import { message, Button, Form } from 'antd';
import { getGasInfo, getSmgList } from 'utils/helper';
import { INBOUND, REDEEMWEOS_GAS, LOCKWEOS_GAS, CROSS_TYPE } from 'utils/settings';
import CrossEOSForm from 'components/CrossChain/CrossChainTransForm/CrossEOSForm';

const CollectionCreateForm = Form.create({ name: 'CrossEOSForm' })(CrossEOSForm);

@inject(stores => ({
  language: stores.languageIntl.language,
  getTokensListInfo: stores.tokens.getTokensListInfo,
  transParams: stores.sendCrossChainParams.transParams,
  currentTokenPairInfo: stores.crossChain.currentTokenPairInfo,
  updateTransParams: (addr, paramsObj) => stores.sendCrossChainParams.updateTransParams(addr, paramsObj),
  addCrossTransTemplate: (addr, params) => stores.sendCrossChainParams.addCrossTransTemplate(addr, params),
}))

@observer
class EOSTrans extends Component {
  state = {
    spin: true,
    loading: false,
    visible: false,
    smgList: [],
    estimateFee: 0
  }

  showModal = async () => {
    const { from, record, getTokensListInfo, addCrossTransTemplate, updateTransParams, direction, currentTokenPairInfo } = this.props;
    let wanGas, storeman;
    let info = Object.assign({}, currentTokenPairInfo);
    if (direction === INBOUND) {
      /* if (![record.balance, record.ramAvailable, record.cpuAvailable, record.netTotal].every(item => new BigNumber(item).gt(0))) {
        message.warn(intl.get('SendNormalTrans.hasBalance'));
        return;
      } */
      wanGas = REDEEMWEOS_GAS;
    } else {
      /* if (new BigNumber((getTokensListInfo.find(item => item.address === from)).amount).isEqualTo(0)) {
        message.warn(intl.get('SendNormalTrans.hasBalance'));
        return;
      } */
      wanGas = LOCKWEOS_GAS;
    }
    this.setState(() => ({ visible: true, spin: true, loading: true }));
    addCrossTransTemplate(from, { path: record.path, crossType: CROSS_TYPE[1] }); // EOS只有HTLC
    try {
      let [gasPrice, smgList] = await Promise.all([getGasInfo(info.toChainSymbol), getSmgList(info.fromChainSymbol, info.fromAccount)]);
      this.setState({
        smgList,
        estimateFee: new BigNumber(gasPrice.gasPrice).times(wanGas).div(BigNumber(10).pow(9)).toString(10)
      });
      storeman = smgList[0].storemanGroup;
      updateTransParams(from, { storeman, gasPrice, gasLimit: wanGas, txFeeRatio: smgList[0].txFeeRatio || 0, quota: direction === INBOUND ? smgList[0].inboundQuota : smgList[0].outboundQuota });
      this.setState(() => ({ spin: false, loading: false }));
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

  handleSend = from => {
    this.setState({ loading: true });
    this.props.handleSend(from).then(() => {
      this.setState({ visible: false, loading: false, spin: true });
    }).catch(() => {
      this.setState({ visible: false, loading: false, spin: true });
    });
  }

  render() {
    const { visible, loading, spin, smgList, estimateFee } = this.state;
    const { decimals, direction, record } = this.props;
    let balance = direction === INBOUND ? record.balance : record.amount;
    return (
      <div>
        <Button type="primary" onClick={this.showModal} /* disabled={Number(balance) === 0} */>{intl.get('Common.convert')}</Button>
        { visible &&
          <CollectionCreateForm balance={balance} record={record} decimals={decimals} direction={direction} estimateFee={estimateFee} smgList={smgList} wrappedComponentRef={this.saveFormRef} onCancel={this.handleCancel} onSend={this.handleSend} loading={loading} spin={spin} />
        }
      </div>
    );
  }
}

export default EOSTrans;
