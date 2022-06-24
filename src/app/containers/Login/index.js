import intl from 'react-intl-universal';
import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Button, Input, message, Modal } from 'antd';

import style from './index.less';
import { WANPATH } from 'utils/settings';
import { initScanOTA, openScanOTA, createBTCAddr, createETHAddr, createXRPAddr } from 'utils/helper';

message.config({
  duration: 2,
  maxCount: 1
});

@inject(stores => ({
  auth: stores.session.auth,
  settings: stores.session.settings,
  btcPath: stores.btcAddress.btcPath,
  addrInfo: stores.wanAddress.addrInfo,
  language: stores.languageIntl.language,
  btcAddrInfo: stores.btcAddress.addrInfo,
  ethAddrInfo: stores.ethAddress.addrInfo,
  xrpAddrInfo: stores.xrpAddress.addrInfo,
  isFirstLogin: stores.session.isFirstLogin,
  needFirstDBUpdate: stores.session.needFirstDBUpdate,
  setAuth: val => stores.session.setAuth(val),
  setIsFirstLogin: val => stores.session.setIsFirstLogin(val),
  addAddress: newAddr => stores.btcAddress.addAddress(newAddr),
  addETHAddress: newAddr => stores.ethAddress.addAddress(newAddr),
  addXRPAddress: newAddr => stores.xrpAddress.addAddress(newAddr),
  updateUserAccountDB: (...args) => stores.wanAddress.updateUserAccountDB(...args)
}))

@observer
class Login extends Component {
  state = {
    pwd: '',
    visible: false
  }

  componentDidMount () {
    document.querySelector('.ant-input').focus();
  }

  login = () => {
    const pwd = this.state.pwd;
    wand.request('wallet_lock', () => {
      wand.request('wallet_unlock', { pwd: pwd }, async (err, val) => {
        if (err) {
          message.error(intl.get('Login.wrongPassword'))
          return;
        }
        if (this.props.isFirstLogin) {
          this.props.setIsFirstLogin(false);
        }
        this.props.setAuth(true);
        // Upgrade DB file from V1.0.0.
        if (this.props.needFirstDBUpdate) {
          await this.props.updateUserAccountDB('1.0.0', true);
        }
        // Open scanner to scan the smart contract to get private tx balance.
        // if (this.props.settings.scan_ota) {
        //   const normalObj = Object.values(this.props.addrInfo['normal']).map(item => [1, `${WANPATH}${item.path}`]);
        //   const importObj = Object.values(this.props.addrInfo['import']).map(item => [5, `${WANPATH}${item.path}`]);
        //   const rawKeyObj = Object.values(this.props.addrInfo['rawKey']).map(item => [6, `${WANPATH}${item.path}`]);
        //   openScanOTA([].concat(normalObj, importObj, rawKeyObj));
        // }
        let scanOtaKeyList = Object.keys(this.props.settings.scan_ota_list);
        if (scanOtaKeyList.length) {
          initScanOTA();
          openScanOTA(scanOtaKeyList.map(v => {
            let item = v.split('_');
            return [Number(item[0]), item[1]];
          }));
        }

        if (!Object.keys(this.props.btcAddrInfo.normal).length) {
          createBTCAddr(this.props.btcPath, 0).then(addressInfo => {
            this.props.addAddress(addressInfo);
          }).catch(err => {
            console.log(err);
          })
        }

        if (!Object.keys(this.props.ethAddrInfo.normal).length) {
          createETHAddr().then(addressInfo => {
            this.props.addETHAddress(addressInfo);
          }).catch(err => {
            console.log(err);
          })
        }

        if (!Object.keys(this.props.xrpAddrInfo.normal).length) {
          createXRPAddr().then(addressInfo => {
            this.props.addXRPAddress(addressInfo);
          }).catch(err => {
            console.log(err);
          })
        }
      })
    })
  }

  handleChange = (e) => {
    this.setState({
      pwd: e.target.value
    })
  }

  handleClick = () => {
    this.setState({
      visible: true
    })
  }

  resetStateVal = () => {
    this.setState({
      visible: false,
    });
  }

  handleOk = () => {
    wand.request('phrase_reset', null, () => {});
  }

  render () {
    return (
      <div className={style.loginW}>
        <div className={style.loginCon}>
          <Input.Password placeholder={intl.get('Login.inputPassword')} onPressEnter={this.login} onChange={this.handleChange} autoFocus/>
          <Button type="primary" onClick={this.login}>{intl.get('Login.login')}</Button>
          <p className={style.restoreBtn} onClick={this.handleClick}>{intl.get('Login.restore')}</p>
        </div>
        <Modal
          destroyOnClose={true}
          title={intl.get('Restore.restoreFromSeedPhrase')}
          visible={this.state.visible}
          onOk={this.handleOk}
          onCancel={this.resetStateVal}
          closable={false}
          okText={intl.get('Common.ok')}
          cancelText={intl.get('Common.cancel')}
        >
          <p className="textP">{intl.get('Common.warning')}: {intl.get('Restore.allLocalDataWillBeLost')}</p>
        </Modal>
      </div>
    );
  }
}

export default Login;
