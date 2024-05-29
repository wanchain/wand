/* eslint-disable prefer-promise-reject-errors */
import { toChecksumOTAddress } from 'wanchain-util';
import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Button, Table, Row, Col, message, Tooltip, Icon, Tag, Switch } from 'antd';
import style from './index.less';
import totalImg from 'static/image/wan.png';
import { WALLETID, WANPATH, ETHPATH } from 'utils/settings';
import WANTransHistory from 'components/WANTransHistory';
import CopyAndQrcode from 'components/CopyAndQrcode';
import SendNormalTrans from 'components/SendNormalTrans';
import RedeemFromPrivate from 'components/RedeemFromPrivate';
import { hasSameName, checkAddrType, getWalletIdByType, createWANAddr, initScanOTA, stopScanOTA, openScanOTA, stopSingleScan } from 'utils/helper';
import { EditableFormRow, EditableCell } from 'components/Rename';
import WarningExistAddress from 'components/WarningExistAddress';
import arrow from 'static/image/arrow.png';

const CHAINTYPE = 'WAN';

@inject(stores => ({
  isLegacyWanPath: stores.session.isLegacyWanPath,
  settings: stores.session.settings,
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  getAddrList: stores.wanAddress.getAddrList,
  getAllAmount: stores.wanAddress.getAllAmount,
  transParams: stores.sendTransParams.transParams,
  addAddress: newAddr => stores.wanAddress.addAddress(newAddr),
  updateTransHistory: () => stores.wanAddress.updateTransHistory(),
  changeTitle: newTitle => stores.languageIntl.changeTitle(newTitle),
  updateName: (arr, type) => stores.wanAddress.updateName(arr, type),
  updateSettings: newValue => stores.session.updateSettings(newValue),
  updateInsteadSettings: (key, value) => stores.session.updateInsteadSettings(key, value),
}))

@observer
class WanAccount extends Component {
  constructor(props) {
    super(props);
    this.state = {
      isUnlock: false,
      expanded: false,
      expandedRows: [],
      isExist: false,
      address: undefined,
      scanOtaList: this.props.getAddrList.map(item => {
        if (this.checkPathChecked(`${item.wid}_${item.path}`)) {
          return `${item.wid}_${item.path}`
        }
      }).filter(v => !!v)
    }
    this.canCreate = true;
    this.props.updateTransHistory();
  }

  // switchNode = (record) => {
  //   return <div>
  //     <Switch
  //       size="small"
  //       checked={this.state.scanOtaList.includes(`${record.wid}_${record.path}`)}
  //       className={style.switchBtn}
  //       defaultChecked
  //       onChange={(check) => this.handleSingleScanOTA(record, check)}
  //     />
  //   </div>
  // };

  columns = [
    {
      dataIndex: 'name',
      editable: true,
      width: '20%',
    },
    {
      dataIndex: 'address',
      render: (text, record) => <div className="addrText"><p className="address">{text}</p><CopyAndQrcode addr={text} type={CHAINTYPE} path={record.path} wid={record.wid} name={record.name} /></div>,
      width: '42%'
    },
    // {
    //   dataIndex: 'livePrivateBalance',
    //   render: (text, record) => this.switchNode(record),
    //   width: '17%',
    //   align: 'center'
    // },
    {
      dataIndex: 'balance',
      sorter: (a, b) => a.balance - b.balance,
      width: '20%',
      align: 'center'
    },
    {
      dataIndex: 'action',
      render: (text, record) => <div><SendNormalTrans balance={record.balance} buttonClassName={style.actionButton} walletID={record.wid} from={record.address} path={record.path} handleSend={this.handleSend} chainType={CHAINTYPE} /></div>,
      width: '13%'
    },
    {
      dataIndex: 'blank',
      key: 'expand',
      width: '5%'
    }
  ];

  columnsTree = this.columns.map((col) => {
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
    this.props.changeTitle('WanAccount.wallet');
    this.timer = setInterval(() => this.props.updateTransHistory(), 5000);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
  }

  componentDidUpdate(prevProps) {
    let scanList = Object.keys(prevProps.settings.scan_ota_list).filter(v => {
      let [wid, path] = v.split('_');
      let pathKey = (wid === '1') ? prevProps.settings.wan_path : WANPATH;
      return (path.indexOf(pathKey) >= 0);
    });
    if (scanList.length !== this.state.scanOtaList.length) {
      this.setState({
        scanOtaList: prevProps.getAddrList.map(item => {
          if (Object.hasOwnProperty.call(prevProps.settings.scan_ota_list, `${item.wid}_${item.path}`)) {
            return `${item.wid}_${item.path}`
          }
          console.log('scanOtaList: %O', item)
        }).filter(v => !!v),
        expandedRows: this.state.expandedRows.map(r => {
          if (prevProps.getAddrList.find(v => v.key === r)) {
            return r
          }
          console.log('expandedRows: %O', r)
        }).filter(v => !!v)
      })
    }
  }

  createAccount = () => {
    const { addAddress, getAddrList, settings, isLegacyWanPath } = this.props;
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
        let wanPath = isLegacyWanPath ? WANPATH : ETHPATH;
        createWANAddr(checkDuplicate, wanPath).then(addressInfo => {
          addAddress(addressInfo);
          this.canCreate = true;
          // if (settings.scan_ota) {
          //   wand.request('address_scanMultiOTA', { path: [[WALLETID.NATIVE, addressInfo.path]] }, function (err, res) {
          //     if (err) {
          //       console.log('Open OTA scanner failed:', err);
          //     }
          //   });
          // }
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

  handleSend = (from, splitAmount) => {
    if (splitAmount && splitAmount instanceof Array) {
      return this.onSendPrivateTransaction(from, splitAmount);
    } else {
      return this.onSendNormalTransaction(from);
    }
  }

  onSendNormalTransaction = (from) => {
    let params = this.props.transParams[from];
    let type = checkAddrType(from, this.props.addrInfo);
    let walletID = getWalletIdByType(type);
    let trans = {
      walletID: walletID,
      chainType: CHAINTYPE,
      path: params.path,
      gasLimit: `0x${params.gasLimit.toString(16)}`,
      gasPrice: params.gasPrice,
      baseFeePerGas: params.baseFeePerGas,
      to: params.to,
      amount: params.amount,
      symbol: CHAINTYPE,
      nonce: params.nonce,
      data: params.data,
      type: 2
    };
    console.log('wan onSendNormalTransaction: %O', trans)
    return new Promise((resolve, reject) => {
      wand.request('transaction_normal', trans, (err, txHash) => {
        if (err) {
          message.warn(intl.get('WanAccount.sendTransactionFailed'));
          console.log('Failed to send transaction:', err);
          reject(err);
        } else {
          console.log('Tx hash: ', txHash);
          if (txHash.code === false) {
            message.warn(intl.get('WanAccount.sendTransactionFailed'));
            reject(txHash.result);
          } else {
            message.success(intl.get('WanAccount.sendTransactionSuccessFully'));
            resolve();
          }
          this.props.updateTransHistory();
        }
      });
    });
  }

  onSendPrivateTransaction = (from, splitAmount = []) => {
    let params = this.props.transParams[from];
    let type = checkAddrType(from, this.props.addrInfo);
    let walletID = getWalletIdByType(type);
    let trans = {
      walletID: walletID,
      chainType: CHAINTYPE,
      path: params.path,
      gasLimit: `0x${params.gasLimit.toString(16)}`,
      gasPrice: params.gasPrice,
      baseFeePerGas: params.baseFeePerGas,
      to: toChecksumOTAddress(params.to),
      amount: splitAmount,
    };
    return new Promise((resolve, reject) => {
      wand.request('transaction_private', trans, (err, txHash) => {
        if (err) {
          message.warn(intl.get('WanAccount.sendBatchTransactionFailed'));
          console.log('Failed to send transaction:', err);
          reject(err);
        } else {
          message.success(intl.get('WanAccount.sendTransactionSuccessFully'));
          resolve();
          this.props.updateTransHistory();
        }
      });
    });
  }

  handleSave = row => {
    if (hasSameName('normal', row, this.props.addrInfo)) {
      message.warn(intl.get('WanAccount.notSameName'));
    } else {
      this.props.updateName(row, row.wid);
    }
  }

  customExpandIcon = props => {
    let text;
    if (props.expanded) {
      text = 'arrow-down';
    } else {
      text = 'arrow-right';
    }
    return (
      <img
        src={arrow}
        onClick={e => props.onExpand(props.record, e)}
        className={text}
        style={{ width: '12px', height: '10px', cursor: 'pointer' }}
      />
    );
  }

  expandContent = record => {
    const privateAddress = record.waddress;
    const checked = this.state.scanOtaList.includes(`${record.wid}_${record.path}`);
    const privateBalance = checked ? record.wbalance : 'N/A';
    return (
      <table style={{ width: 'calc(100% + 32px)', position: 'relative', left: '-16px' }}>
        <tbody>
          <tr>
            <td style={{ width: '20%', padding: '0px 16px' }}></td>
            <td style={{ width: '42%', padding: '0px 16px' }}>
              <div className="addrText">
                <p className={style.privateAddress}>
                  <Tooltip placement="bottomLeft" title={privateAddress} overlayStyle={{ width: 400 }} >{privateAddress}</Tooltip>
                </p>
                {privateAddress && <CopyAndQrcode addr={privateAddress} />}
                {privateAddress && <Tooltip placement="bottom" title={intl.get('WanAccount.privateTxReceiverAddress')}><Icon type="question-circle" style={{ marginLeft: '5px' }} /></Tooltip>}
              </div>
            </td>
            <td style={{ width: '20%', padding: '0px 16px', textAlign: 'center' }}>{privateBalance}</td>
            <td style={{ width: '13%', padding: '0px 16px', display: 'flex' }}>
              <RedeemFromPrivate from={record.address} wid={record.wid} path={record.path} chainType={CHAINTYPE} />
              <Tooltip placement="top" title={() => <>
              <p>
              When toggled on, the balance of each corresponding private address will be scanned and kept current. It make take several minutes to complete the scan. Toggle off accounts to optimise wallet performance.
              </p>
              <p>
              Current Status:&nbsp;{intl.get(!checked ? 'Common.off' : 'Common.on')}
              </p>
              </>}>
                <Button type="primary" onClick={() => this.handleSingleScanOTA(record)} style={{ marginLeft: '16px' }}>
                  {intl.get(checked ? 'Common.disable' : 'Common.enable')}
                </Button>
              </Tooltip>
            </td>
            <td style={{ width: '5%', padding: '0px 16px' }}></td>
          </tr>
        </tbody>
      </table>
    )
  }

  toggleExpand = () => {
    if (this.state.expanded) {
      this.setState({
        expandedRows: []
      });
    } else {
      this.setState({
        expandedRows: this.props.getAddrList.map(r => r.key)
      });
    }
    this.setState({ expanded: !this.state.expanded });
  }

  onExpand = (expanded, record) => {
    try {
      if (expanded) {
        this.setState({
          expandedRows: [...this.state.expandedRows, record.key]
        });
      } else {
        let list = [...this.state.expandedRows];
        list.splice(list.findIndex(n => n === record.key), 1);
        this.setState({
          expandedRows: list
        });
        if (list.length === 0) {
          this.setState({ expanded: false });
        }
      }
    } catch (err) {
      console.log('expand error:', err);
    }
  }

  onCloseModal = () => {
    this.setState({ isExist: false })
  }

  // handleScanOTA = checked => {
  //   this.props.updateSettings({ scan_ota: checked });
  //   if (checked) {
  //     initScanOTA().then(() => {
  //       const normalObj = Object.values(this.props.addrInfo['normal']).map(item => [1, `${WANPATH}${item.path}`]);
  //       const importObj = Object.values(this.props.addrInfo['import']).map(item => [5, `${WANPATH}${item.path}`]);
  //       const rawKeyObj = Object.values(this.props.addrInfo['rawKey']).map(item => [6, `${WANPATH}${item.path}`]);
  //       openScanOTA([].concat(normalObj, importObj, rawKeyObj));
  //     });
  //   } else {
  //     stopScanOTA();
  //   }
  // }

  checkPathChecked = path => {
    return Object.hasOwnProperty.call(this.props.settings.scan_ota_list, path);
  }

  handleSingleScanOTA = (item) => {
    let scan_ota_list = Object.assign({}, this.props.settings.scan_ota_list);
    const path = `${item.wid}_${item.path}`;
    const checked = !this.checkPathChecked(path)
    let arr = [].concat(this.state.scanOtaList);
    if (checked) {
      scan_ota_list[path] = true;
      arr.push(path);
      openScanOTA([[item.wid, item.path]]).then(res => {
        this.setScanOtaListType(arr, scan_ota_list);
      });
    } else {
      delete scan_ota_list[path];
      let i = arr.findIndex(v => v === path);
      arr.splice(i, 1);
      stopSingleScan([[item.wid, item.path]]).then(res => {
        this.setScanOtaListType(arr, scan_ota_list);
      });
    }
  }

  setScanOtaListType(arr, list) {
    this.props.updateInsteadSettings('scan_ota_list', list).then(res => {
      this.setState({
        scanOtaList: arr
      });
    })
  }

  render() {
    const { getAllAmount, getAddrList } = this.props;
    const components = {
      body: {
        cell: EditableCell,
        row: EditableFormRow,
      },
    };

    this.props.language && this.columnsTree.forEach(col => {
      if (col.dataIndex !== 'blank') {
        col.title = intl.get(`WanAccount.${col.dataIndex}`);
      } else {
        col.title = <img
          src={arrow}
          onClick={this.toggleExpand}
          className={this.state.expanded ? style['arrow-down'] : style['arrow-right']}
          style={{ width: '12px', height: '10px', cursor: 'pointer' }}
        />;
      }
    });

    return (
      <div className="account">
        <Row className={style.title + ' title'}>
          <Col span={16} className="col-left">
            <img className="totalImg" src={totalImg} alt={intl.get('WanAccount.wanchain')} />
            <span className="wanTotal">{getAllAmount}</span>
            <span className="wanTex">{intl.get('WanAccount.wan')}</span>
            <Tag className="symbol">{intl.get('Common.wanchain')}</Tag>
            {/* <Tooltip placement="top" title="The balances of all your private addresses will be scanned and updated to the latest state when you turn it on. This may take a while."><Icon style={{ marginLeft: '45px', position: 'relative', top: '2px' }} type="question-circle" /></Tooltip> */}
            {/* <span style={{ color: '#BCBCC1', display: 'inline-block', marginRight: '5px', marginLeft: '5px' }} className="wanTex">Refresh Private Balances</span>
            <Switch size="small" checked={settings.scan_ota} className={style.switchBtn} defaultChecked onChange={this.handleScanOTA} /> */}
          </Col>
          <Col span={8} className="col-right">
            <Button className="createBtn" type="primary" shape="round" size="large" onClick={this.createAccount}>{intl.get('Common.create')}</Button>
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <Table components={components} expandedRowKeys={this.state.expandedRows} rowClassName={() => 'editable-row'} className="content-wrap" pagination={false} columns={this.columnsTree} dataSource={getAddrList}
              expandedRowRender={this.expandContent} onExpand={this.onExpand} expandIconAsCell={false} expandIconColumnIndex={4} expandIcon={this.customExpandIcon} />
          </Col>
        </Row>
        <Row className="mainBody">
          <Col>
            <WANTransHistory name={['normal', 'import', 'rawKey']} />
          </Col>
        </Row>
        {
          this.state.isExist && <WarningExistAddress title={intl.get('Common.warning')} address={this.state.address} onCloseModal={this.onCloseModal} text={intl.get('WanAccount.newAddressExistInImportedList')}/>
        }
      </div>
    );
  }
}

export default WanAccount;
