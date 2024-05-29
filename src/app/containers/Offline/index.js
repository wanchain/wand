import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Button, Input, message, Col, Row, Divider, Icon, Tooltip, Form } from 'antd';

import style from './index.less';
import TransHistory from 'components/TransHistory';
import ConfirmForm from 'components/NormalTransForm/ConfirmForm';
import { fromWei } from 'utils/support';
import { getGasPrice, getNonce, checkWanAddr, deserializeWanTx, checkETHAddr } from 'utils/helper';

const Confirm = Form.create({ name: 'NormalTransForm' })(ConfirmForm);

@inject(stores => ({
  language: stores.languageIntl.language,
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  addTransTemplate: (addr, params) => stores.sendTransParams.addTransTemplate(addr, params),
  updateTransParams: (addr, paramsObj) => stores.sendTransParams.updateTransParams(addr, paramsObj),
}))

@observer
class Offline extends Component {
  state = {
    raw: '',
    addr: '',
    gasPrice: {},
    nonce: null,
    confirmVisible: false,
    loading: false,
    from: ''
  }

  componentDidMount () {
    this.props.changeTitle('menuConfig.offline');
    this.timer = setInterval(() => this.props.updateTransHistory(), 5000);
  }

  componentWillUnmount () {
    clearInterval(this.timer);
  }

  handleGetInfo = async () => {
    let gasPrice, nonce;
    if (this.state.addr) {
      try {
        let ret = await Promise.all([checkWanAddr(this.state.addr), checkETHAddr(this.state.addr)])
        if (!(ret[0] || ret[1])) {
          message.warn(intl.get('NormalTransForm.addressIsIncorrect'));
          return;
        }
        [gasPrice, nonce] = await Promise.all([getGasPrice('WAN'), getNonce(this.state.addr, 'WAN')]);
        this.setState({
          gasPrice,
          nonce
        });
      } catch (err) {
        console.log('handleGetInfo: ', err)
        message.warn(intl.get('Offline.getInfoFailed'))
      }
    } else {
      message.warn(intl.get('NormalTransForm.addressIsIncorrect'));
    }
  }

  handleAddrChange = e => {
    if (e.target.value === '') {
      this.setState({
        addr: '',
        gasPrice: {},
        nonce: null
      })
    } else {
      this.setState({
        addr: e.target.value
      })
    }
  }

  handleRawChange = e => {
    this.setState({
      raw: e.target.value
    })
  }

  sendTrans = () => {
    this.setState({
      loading: true
    })
    if (this.state.raw) {
      wand.request('transaction_raw', { raw: this.state.raw, chainType: 'WAN' }, (err, txHash) => {
        if (err) {
          console.log('OfflineSendTx: ', err)
          message.warn(intl.get('Offline.sendRawTx'));
          this.setState({ loading: false });
          return;
        }
        message.success(intl.get('Send.transSuccess'))
        let txObj = deserializeWanTx(this.state.raw);
        let rawTx = {
          txHash,
          srcSCAddrKey: 'WAN',
          srcChainType: 'WAN',
          tokenSymbol: 'WAN',
          ...txObj
        }
        wand.request('transaction_insertTransToDB', { rawTx, satellite: { offline: true } }, (err, res) => {
          if (err) {
            console.log('Offline_transaction_insertTransToDB: ', err)
          } else {
            this.props.updateTransHistory();
          };
        })
        this.setState({ raw: '', loading: false, confirmVisible: false })
      })
    } else {
      message.warn(intl.get('Offline.inputRawTxText'))
    }
  }

  handleNext = () => {
    if (this.state.raw) {
      try {
        let parseRaw = deserializeWanTx(this.state.raw);
        this.props.addTransTemplate(parseRaw.from)
        this.props.updateTransParams(parseRaw.from, {
          to: parseRaw.to || 'N/A',
          amount: fromWei(parseRaw.value) || 'N/A',
          gasLimit: parseRaw.gasLimit || 'N/A',
          gasPrice: fromWei(parseRaw.gasPrice, 'Gwei') || 'N/A',
          nonce: parseRaw.nonce === '0x' ? 0 : parseInt(parseRaw.nonce),
          data: parseRaw.data
        })
        this.setState({ from: parseRaw.from, confirmVisible: true });
      } catch (error) {
        console.log('OfflineHandleNext: ', error)
        message.warn(intl.get('Offline.inputRawTxText'))
      }
    } else {
      message.warn(intl.get('Offline.inputRawTxText'))
    }
  }

  handleJumpToWebsite = () => {
    wand.shell.openExternal('https://www.wanchain.org/getstarted');
  }

  handleConfirmCancel = () => {
    this.setState({
      confirmVisible: false,
    });
  }

  render () {
    const { gasPrice, nonce } = this.state;

    return (
      <React.Fragment>
        <div className={style.offlineStep}>
          <Button type="primary" className={style.stepOne}>{intl.get('Offline.stepOne')}</Button>
          <h3 className={style.stepOne + ' ' + style.inlineBlock}>{intl.get('Offline.stepOneText')}</h3>
          <br />
          <Input placeholder={intl.get('Offline.inputAddr')} className={style.colorInputAddr} onChange={this.handleAddrChange} />
          <Button type="primary" onClick={this.handleGetInfo} className={style.getInfoBtn}>{intl.get('Offline.getInfo')}</Button>
          <Row align="middle" style={{ marginTop: '10px' }}>
            <Col span={6}>
              <span className={style.textFont}>{intl.get('AdvancedOptionForm.gasPrice')}: </span><Input className={style.colorShowInfo} value={gasPrice === null ? '--' : parseInt(gasPrice) + ' Gwin'} />
            </Col>
            <Col span={6}>
              <span className={style.textFont}>{intl.get('AdvancedOptionForm.nonce')}: </span><Input className={style.colorShowInfo} value={nonce === null ? '--' : nonce} />
            </Col>
          </Row>
        </div>
        <Divider className={style.borderSty} />
        <div className={style.offlineStep}>
          <Button type="primary" className={style.stepOne}>{intl.get('Offline.stepTwo')}</Button>
          <h3 className={style.stepOne + ' ' + style.inlineBlock}>{intl.get('Offline.stepTwoText')}</h3>
          <Tooltip placement="bottom" title={intl.get('Offline.linkToWebsite')}><Icon type="link" onClick={this.handleJumpToWebsite} /></Tooltip>
        </div>
        <Divider className={style.borderSty} />
        <div className={style.offlineStep}>
          <Button type="primary" className={style.stepOne}>{intl.get('Offline.stepThree')}</Button>
          <h3 className={style.stepOne + ' ' + style.inlineBlock}>{intl.get('Offline.stepThreeText')}</h3>
          <br />
          <p className={style.stepInfo}>{intl.get('Offline.threeInfo')}</p>
          <p>
            <Input.TextArea placeholder={intl.get('Offline.threeTitle')} autosize={{ minColumns: 15, minRows: 4, maxRows: 10 }} className={style.stepText} onChange={this.handleRawChange} value={this.state.raw}></Input.TextArea>
          </p>
          <p className={style.threeBtn}>
            <Button type="primary" onClick={this.handleNext}>{intl.get('Offline.sendTrans')}</Button>
          </p>
        </div>
        <TransHistory offline={true} />
        {
          this.state.confirmVisible &&
          <Confirm visible={true} onCancel={this.handleConfirmCancel} sendTrans={this.sendTrans} from={this.state.from} loading={this.state.loading}/>
        }
      </React.Fragment>
    );
  }
}

export default Offline;
