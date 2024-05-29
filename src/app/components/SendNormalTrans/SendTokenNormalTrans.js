import React, { Component } from 'react';
import { message, Button, Form } from 'antd';
import { observer, inject } from 'mobx-react';
import intl from 'react-intl-universal';
import { TRANSTYPE } from 'utils/settings';
import TokenNormalTransForm from 'components/NormalTransForm/TokenNormalTransForm';
import { getNonce, getGasInfo, getBalanceByAddr } from 'utils/helper';

const TokenCollectionCreateForm = Form.create({ name: 'TokenNormalTransForm' })(TokenNormalTransForm);

@inject(stores => ({
  chainId: stores.session.chainId,
  language: stores.languageIntl.language,
  tokensBalance: stores.tokens.tokensBalance,
  addTransTemplate: (addr, params) => stores.sendTransParams.addTransTemplate(addr, params),
  updateTransParams: (addr, paramsObj) => stores.sendTransParams.updateTransParams(addr, paramsObj),
  updateGasPrice: (...args) => stores.sendTransParams.updateGasPrice(...args),
  getChainAddressInfoByChain: chain => stores.tokens.getChainAddressInfoByChain(chain),
}))

@observer
class SendTokenNormalTrans extends Component {
  state = {
    spin: true,
    loading: false,
    visible: false,
  }

  showModal = async () => {
    const { from, path, tokenAddr, chainType, chainId, addTransTemplate, updateTransParams, updateGasPrice, transType, tokensBalance, getChainAddressInfoByChain } = this.props;
    let addrInfo = getChainAddressInfoByChain(chainType);
    if (addrInfo === undefined) {
      console.log('Unknown token type');
      return;
    }

    // No sufficient funds
    if (getBalanceByAddr(from, addrInfo) === '0') {
      message.warn(intl.get('SendNormalTrans.hasNoBalance') + chainType);
      return;
    }

    if (transType === TRANSTYPE.tokenTransfer) {
      if (!tokensBalance[tokenAddr] || tokensBalance[tokenAddr][from] === '0') {
        message.warn(intl.get('SendNormalTrans.hasNoTokenBalance'));
        return;
      }
    }

    this.setState({ visible: true });
    addTransTemplate(from, { chainType, chainId });
    try {
      let [nonce, gasPrice] = await Promise.all([getNonce(from, chainType), getGasInfo(chainType)]);
      updateTransParams(from, { path, nonce, gasPrice });
      updateGasPrice(gasPrice, chainType);
      setTimeout(() => { this.setState({ spin: false }) }, 0)
    } catch (err) {
      console.log(`Get nonce or gas price failed: ${err}`)
      message.warn(err);
    }
  }

  handleCancel = () => {
    this.setState({ visible: false, spin: true });
  }

  saveFormRef = formRef => {
    this.formRef = formRef;
  }

  handleSend = (from, splitAmount) => {
    this.setState({ loading: true });
    this.props.handleSend(from, splitAmount).then(ret => {
      this.setState({ visible: false, loading: false, spin: true });
    }).catch(err => {
      console.log(err);
      this.setState({ visible: false, loading: false, spin: true });
    });
  }

  render() {
    const { visible, loading, spin } = this.state;
    const { tokenAddr, transType, balance, symbol } = this.props;

    return (
      <div>
        <Button type="primary" className={this.props.buttonClassName ? this.props.buttonClassName : ''} onClick={this.showModal}>{intl.get('Common.send')}</Button>
        { visible && tokenAddr && <TokenCollectionCreateForm symbol={symbol} balance={balance} transType={transType} wrappedComponentRef={this.saveFormRef} onCancel={this.handleCancel} onSend={this.handleSend} loading={loading} spin={spin} disablePrivateTx={this.props.disablePrivateTx}/> }
      </div>
    );
  }
}

export default SendTokenNormalTrans;
