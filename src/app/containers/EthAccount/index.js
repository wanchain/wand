import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Button, Table, Row, Col, message, Tag } from 'antd';
import totalImg from 'static/image/eth.png';
import TransHistory from 'components/TransHistory/ETHTransHistory';
import CopyAndQrcode from 'components/CopyAndQrcode';
import SendNormalTrans from 'components/SendNormalTrans/SendETHNormalTrans';
import { checkAddrType, hasSameName, getWalletIdByType, createETHAddr } from 'utils/helper';
import { EditableFormRow, EditableCell } from 'components/Rename';
import WarningExistAddress from 'components/WarningExistAddress';

const CHAINTYPE = 'ETH';

@inject(stores => ({
  addrInfo: stores.ethAddress.addrInfo,
  language: stores.languageIntl.language,
  getAddrList: stores.ethAddress.getAddrList,
  getAllAmount: stores.ethAddress.getAllAmount,
  transParams: stores.sendTransParams.transParams,
  addAddress: newAddr => stores.ethAddress.addAddress(newAddr),
  updateTransHistory: () => stores.ethAddress.updateTransHistory(),
  getUserBNBAccountFromDB: () => stores.bnbAddress.getUserAccountFromDB(),
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  updateName: (arr, type) => stores.ethAddress.updateName(arr, type),
  updateChainBalanceList: chain => stores.tokens.updateChainBalanceList(chain),
}))

@observer
class EthAccount extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isUnlock: false,
      isExist: false,
      address: undefined,
    }
    this.canCreate = true;
    this.props.updateTransHistory();
  }

  columns = [
    {
      dataIndex: 'name',
      editable: true
    },
    {
      dataIndex: 'address',
      render: (text, record) => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} type={CHAINTYPE} path={record.path} wid={record.wid} name={record.name} /></div>
    },
    {
      dataIndex: 'balance',
      sorter: (a, b) => a.balance - b.balance,
    },
    {
      dataIndex: 'action',
      render: (text, record) => <div><SendNormalTrans balance={record.balance} walletID={record.wid} from={record.address} path={record.path} handleSend={this.handleSend} chainType={CHAINTYPE} /></div>
    }
  ];

  columnsTree = this.columns.map(col => {
    if (!col.editable) {
      return col;
    }
    return {
      ...col,
      onCell: record => ({
        record,
        editable: col.editable,
        dataIndex: col.dataIndex,
        title: col.title,
        handleSave: this.handleSave,
      }),
    };
  });

  componentDidMount() {
    this.props.updateChainBalanceList('ETH');
    this.props.changeTitle('WanAccount.wallet');
    this.timer = setInterval(() => this.props.updateTransHistory(), 5000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    this.props.updateChainBalanceList();
  }

  handleSend = from => {
    let params = this.props.transParams[from];
    let walletID = getWalletIdByType(checkAddrType(from, this.props.addrInfo));
    let trans = {
      walletID: walletID,
      chainType: CHAINTYPE,
      symbol: CHAINTYPE,
      path: params.path,
      to: params.to,
      amount: params.amount,
      gasLimit: `0x${params.gasLimit.toString(16)}`,
      gasPrice: params.gasPrice,
      baseFeePerGas: params.baseFeePerGas,
      nonce: params.nonce,
      data: params.data
    };
    console.log('EthAccount handleSend trans: %O', trans)
    return new Promise((resolve, reject) => {
      wand.request('transaction_normal', trans, function (err, txHash) {
        if (err) {
          message.warn(intl.get('WanAccount.sendTransactionFailed'));
          console.log(err);
          reject(false); // eslint-disable-line prefer-promise-reject-errors
        } else {
          if (txHash.code === false) {
            message.warn(intl.get('WanAccount.sendTransactionFailed'));
            reject(txHash.result);
          } else {
            message.success(intl.get('WanAccount.sendTransactionSuccessFully'));
            resolve(txHash)
          }
          this.props.updateTransHistory();
          console.log('Tx hash: ', txHash);
        }
      }.bind(this));
    })
  }

  createAccount = () => {
    const { addAddress, getAddrList, getUserBNBAccountFromDB } = this.props;

    if (this.canCreate) {
      try {
        this.canCreate = false;
        let checkDuplicate = address => {
          if (getAddrList.find(obj => obj.address.toLowerCase() === address.toLowerCase())) {
            this.setState({ address, isExist: true });
            return true;
          }
          return false;
        }
        createETHAddr(checkDuplicate).then(addressInfo => {
          addAddress(addressInfo);
          getUserBNBAccountFromDB();
          this.canCreate = true;
          message.success(intl.get('WanAccount.createAccountSuccess'));
        }).catch((e) => {
          this.canCreate = true;
          if (e.message === 'exist') {
            return;
          }
          message.warn(intl.get('WanAccount.createAccountFailed'));
        });
      } catch (e) {
        console.log('err:', e);
        this.canCreate = true;
        message.warn(intl.get('WanAccount.createAccountFailed'));
      };
    }
  }

  handleSave = row => {
    if (hasSameName('normal', row, this.props.addrInfo)) {
      message.warn(intl.get('WanAccount.notSameName'));
    } else {
      this.props.updateName(row, row.wid);
    }
  }

  onCloseModal = () => {
    this.setState({ isExist: false })
  }

  render() {
    const { getAllAmount, getAddrList, language } = this.props;
    const components = {
      body: {
        cell: EditableCell,
        row: EditableFormRow,
      },
    };
    language && this.columnsTree.forEach(col => {
      col.title = intl.get(`WanAccount.${col.dataIndex}`)
    });

    return (
      <div className="account">
        <Row className="title">
          <Col span={12} className="col-left">
            <img className="totalImg" src={totalImg} alt={intl.get('WanAccount.wanchain')} />
            <span className="wanTotal">{getAllAmount}</span>
            <span className="wanTex">{'ETH'}</span>
            <Tag className="symbol">{intl.get('Common.ethereum')}</Tag>
          </Col>
          <Col span={12} className="col-right">
            <Button className="createBtn" type="primary" shape="round" size="large" onClick={this.createAccount}>{intl.get('Common.create')}</Button>
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table components={components} rowClassName={() => 'editable-row'} className="content-wrap" pagination={false} columns={this.columnsTree} dataSource={getAddrList} />
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <TransHistory name={['normal', 'rawKey']} />
          </Col>
        </Row>
        {
          this.state.isExist && <WarningExistAddress title={intl.get('Common.warning')} address={this.state.address} onCloseModal={this.onCloseModal} text={intl.get('WanAccount.newAddressExistInImportedList')}/>
        }
      </div>
    );
  }
}

export default EthAccount;
