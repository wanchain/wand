import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Table, Row, Col, message } from 'antd';
import totalImg from 'static/image/btc.png';
import CopyAndQrcode from 'components/CopyAndQrcode';
import { crossChainTrezorTrans } from 'componentUtils/trezor';
import { INBOUND, OUTBOUND, CROSS_TYPE } from 'utils/settings';
import BTCTrans from 'components/CrossChain/SendCrossChainTrans/BTCTrans';
import CrossBTCHistory from 'components/CrossChain/CrossChainTransHistory/CrossBTCHistory';
import { formatNum } from 'utils/support';
import { convertCrossChainTxErrorText } from 'utils/helper';
import style from './index.less';
import BigNumber from 'bignumber.js';

const CHAINTYPE = 'BTC';
@inject(stores => ({
  addrInfo: stores.btcAddress.addrInfo,
  language: stores.languageIntl.language,
  getNormalAddrList: stores.btcAddress.getNormalAddrList,
  getAmount: stores.btcAddress.getNormalAmount,
  getCCTokensListInfo: stores.tokens.getCCTokensListInfo,
  transParams: stores.sendCrossChainParams.transParams,
  BTCCrossTransParams: stores.sendCrossChainParams.BTCCrossTransParams,
  tokenPairs: stores.crossChain.tokenPairs,
  updateTransHistory: () => stores.btcAddress.updateTransHistory(),
  setCurrSymbol: symbol => stores.crossChain.setCurrSymbol(symbol),
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  setCurrToken: addr => stores.tokens.setCurrToken(addr),
  setCurrTokenChain: chain => stores.tokens.setCurrTokenChain(chain),
  updateTokensBalance: (...args) => stores.tokens.updateTokensBalance(...args),
  setCurrTokenPairId: id => stores.crossChain.setCurrTokenPairId(id),
  updateChainBalanceList: chain => stores.tokens.updateChainBalanceList(chain),
}))

@observer
class CrossBTC extends Component {
  constructor(props) {
    super(props);
    const { tokenPairs, match } = props;
    let tokenPairID = match.params.tokenPairId;
    this.info = tokenPairs[tokenPairID];
  }

  componentDidMount() {
    this.props.changeTitle('Common.crossChain');
    this.props.setCurrSymbol(CHAINTYPE);
    this.props.updateChainBalanceList(CHAINTYPE);
    this.props.updateChainBalanceList(this.info.toChainSymbol);
    this.props.setCurrTokenPairId(this.props.match.params.tokenPairId);
    this.props.setCurrToken(this.info.toAccount);
    this.props.setCurrTokenChain(this.info.toChainSymbol);
    this.props.updateTransHistory();
    this.props.updateTokensBalance(this.info.toAccount, this.info.toChainSymbol);
    this.timer = setInterval(() => {
      this.props.updateTokensBalance(this.info.toAccount, this.info.toChainSymbol);
    }, 5000);
  }

  componentWillUnmount() {
    this.props.updateChainBalanceList();
    clearInterval(this.timer);
  }

  inboundHandleSend = () => {
    const { match } = this.props;
    let tokenPairID = match.params.tokenPairId;
    let info = this.info;
    let transParams = this.props.BTCCrossTransParams;
    let input = {
      from: transParams.from,
      tokenPairID,
      value: transParams.value,
      feeRate: transParams.feeRate,
      changeAddress: transParams.changeAddress,
      storeman: transParams.storeman,
      crosschainFee: transParams.crosschainFee,
      receivedAmount: transParams.receivedAmount,
      to: transParams.to,
      crossType: CROSS_TYPE[0]
    };
    return new Promise((resolve, reject) => {
      wand.request('crossChain_crossChain', { sourceAccount: info.fromAccount, toChainSymbol: info.toChainSymbol, sourceSymbol: info.fromChainSymbol, destinationAccount: info.toAccount, destinationSymbol: info.toChainSymbol, type: 'LOCK', input, tokenPairID }, (err, ret) => {
        console.log(err, ret);
        this.props.updateTransHistory();
        if (err) {
          if (err instanceof Object && err.desc && err.desc.includes('ready')) {
            message.warn(intl.get('Common.networkError'));
          } else {
            message.warn(err.desc);
          }
          reject(err);
        } else {
          if (ret.code) {
            message.success(intl.get('Send.transSuccess'));
            resolve(ret);
          } else {
            message.warn(convertCrossChainTxErrorText(ret.result));
            reject(ret);
          }
        }
      })
    })
  }

  outboundHandleSend = (from) => {
    let tokenPairID = this.props.match.params.tokenPairId;
    let info = this.info;
    let transParams = this.props.transParams[from];
    let input = {
      from: transParams.from,
      to: transParams.to,
      amount: transParams.amount,
      gasPrice: transParams.gasPrice,
      baseFeePerGas: transParams.baseFeePerGas,
      gasLimit: transParams.gasLimit,
      crosschainFee: transParams.crosschainFee,
      receivedAmount: transParams.receivedAmount,
      storeman: transParams.storeman,
      tokenPairID: tokenPairID,
      crossType: CROSS_TYPE[0],
      amountUnit: new BigNumber(transParams.amount).multipliedBy(Math.pow(10, info.ancestorDecimals)).toString(10),
      networkFee: new BigNumber(transParams.networkFee).multipliedBy(Math.pow(10, 18)).toString(10)
    };

    return new Promise((resolve, reject) => {
      if (input.from.walletID === 2) {
        message.info(intl.get('Ledger.signTransactionInLedger'))
      }
      if (input.from.walletID === 3) {
        input.BIP44Path = input.from.path;
        input.from = from;
        input.toAddr = transParams.toAddr;
        crossChainTrezorTrans({ sourceAccount: info.toAccount, toChainSymbol: info.fromChainSymbol, sourceSymbol: info.toChainSymbol, destinationAccount: info.fromAccount, destinationSymbol: info.fromChainSymbol, type: 'LOCK', input, tokenPairID, tokenSymbol: 'BTC', tokenStand: 'BTC' }).then(() => {
          message.success(intl.get('Send.transSuccess'));
          resolve();
        }).catch(err => {
          reject(err);
        })
      } else {
        wand.request('crossChain_crossChain', { sourceAccount: info.toAccount, toChainSymbol: info.fromChainSymbol, sourceSymbol: info.toChainSymbol, destinationAccount: info.fromAccount, destinationSymbol: info.fromChainSymbol, type: 'LOCK', input, tokenPairID }, (err, ret) => {
          console.log(err, ret);
          this.props.updateTransHistory();
          if (err) {
            if (err instanceof Object && err.desc && err.desc.includes('ready')) {
              message.warn(intl.get('Common.networkError'));
            } else {
              message.warn(err.desc);
            }
            reject(err);
          } else {
            if (ret.code) {
              message.success(intl.get('Send.transSuccess'));
              resolve(ret);
            } else {
              message.warn(convertCrossChainTxErrorText(ret.result));
              reject(ret);
            }
          }
        })
      }
    })
  }

  inboundColumns = [
    {
      dataIndex: 'name',
      width: '20%',
      ellipsis: true
    },
    {
      dataIndex: 'address',
      width: '50%',
      render: text => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} /></div>
    },
    {
      dataIndex: 'balance',
      width: '30%',
      ellipsis: true,
      sorter: (a, b) => a.balance - b.balance,
      render: num => formatNum(num),
    }
  ];

  outboundColumns = [
    {
      dataIndex: 'name',
      width: '20%',
      ellipsis: true
    },
    {
      dataIndex: 'address',
      width: '50%',
      render: text => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} /></div>
    },
    {
      dataIndex: 'balance',
      width: '20%',
      ellipsis: true,
      sorter: (a, b) => a.balance - b.balance,
      render: num => formatNum(num),
    },
    {
      dataIndex: 'action',
      width: '10%',
      render: (text, record) => <div><BTCTrans record={record} name={record.name} from={record.address} path={record.path} handleSend={this.outboundHandleSend} chainType={this.info.toChainSymbol} direction={OUTBOUND} /></div>
    }
  ];

  render() {
    const { getNormalAddrList, getCCTokensListInfo } = this.props;
    let from = getNormalAddrList.length ? getNormalAddrList[0].address : '';

    this.props.language && this.inboundColumns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    })

    this.props.language && this.outboundColumns.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    })

    return (
      <div className="account">
        <Row className="title">
          <Col span={12} className="col-left"><img className="totalImg" src={totalImg} /><span className="wanTotal">{this.info.fromTokenSymbol} </span><span className={style.chain}>{this.info.fromChainName}</span></Col>
          <Col span={12} className="col-right">
            <BTCTrans from={from} handleSend={this.inboundHandleSend} direction={INBOUND} chainType={this.info.fromChainSymbol} />
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} columns={this.inboundColumns} dataSource={getNormalAddrList} />
          </Col>
        </Row>
        <Row className="title">
          <Col span={12} className="col-left"><img className="totalImg" src={totalImg} /><span className="wanTotal">{this.info.toTokenSymbol} </span><span className={style.chain}>{this.info.toChainName}</span></Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table className="content-wrap" pagination={false} columns={this.outboundColumns} dataSource={getCCTokensListInfo} />
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <CrossBTCHistory name={['normal']} />
          </Col>
        </Row>
      </div>
    );
  }
}

export default props => <CrossBTC {...props} key={props.match.url} />;
