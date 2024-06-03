import React, { Component } from 'react';
import { Checkbox, Card, Select, Form, message, Icon } from 'antd';
import { observer, inject } from 'mobx-react';
import intl from 'react-intl-universal';
import style from './index.less';
import { defaultTimeout } from 'utils/settings';
import PasswordConfirmForm from 'components/PasswordConfirmForm';
import ConfirmDeleteToken from './ConfirmDeleteToken';

const { Option } = Select;
const PwdConfirmForm = Form.create({ name: 'PasswordConfirmForm' })(PasswordConfirmForm);
@inject(stores => ({
  settings: stores.session.settings,
  language: stores.languageIntl.language,
  updateSettings: newValue => stores.session.updateSettings(newValue),
}))

@observer
class Config extends Component {
  state = {
    showConfirm: false,
  }

  handleChange = e => {
    if (e.target.checked === true) {
      this.props.updateSettings({ reinput_pwd: e.target.checked });
    } else { // Confirm pwd when turn off the pwd confirmation.
      this.setState({
        showConfirm: true
      });
    }
  }

  handleStaking = e => {
    this.props.updateSettings({ staking_advance: e.target.checked });
  }

  handleCurrencyunit = unit => {
    this.props.updateSettings({ currency_unit: unit })
  }

  handleOffline = e => {
    this.props.updateSettings({ offline_wallet: e.target.checked });
  }

  handleLongAddresses = e => {
    this.props.updateSettings({ long_addresses: e.target.checked });
  }

  handleTimeoutChange = e => {
    this.props.updateSettings({ logout_timeout: e });
  }

  handleOk = pwd => {
    if (!pwd) {
      message.warn(intl.get('Config.invalidPassword'));
      return;
    }
    wand.request('phrase_checkPwd', { pwd: pwd }, (err) => {
      if (err) {
        message.warn(intl.get('Config.invalidPassword'));
      } else {
        this.props.updateSettings({ reinput_pwd: false });
        this.setState({
          showConfirm: false
        });
      }
    })
  }

  handleCancel = () => {
    this.setState({
      showConfirm: false
    });
  }

  render() {
    const { reinput_pwd, staking_advance, logout_timeout, offline_wallet, currency_unit, long_addresses } = this.props.settings;

    const options = [{
      value: '0',
      text: intl.get('Config.disableTimeout'),
    }, {
      value: '5',
      text: intl.get('Config.fiveMinutes'),
    }, {
      value: '10',
      text: intl.get('Config.tenMinutes'),
    }, {
      value: '15',
      text: intl.get('Config.fifteenMinutes'),
    }, {
      value: '30',
      text: intl.get('Config.thirtyMinutes'),
    }, {
      value: '60',
      text: intl.get('Config.oneHour'),
    }, {
      value: '120',
      text: intl.get('Config.twoHours'),
    }];
    return (
      <div className={style['settings_config']}>
        <Card title={intl.get('Config.option')}>
          <p className={style['set_title']}>{intl.get('Config.pwdConfirm')}</p>
          <Checkbox checked={reinput_pwd} onChange={this.handleChange}>{intl.get('Config.inputPwd')}</Checkbox>
          <PwdConfirmForm showConfirm={this.state.showConfirm} handleOk={this.handleOk} handleCancel={this.handleCancel}></PwdConfirmForm>
          <div className={style.timeout}>
            <p className={style['set_title']}>{intl.get('Config.loginTimeout')}</p>
            <Select className={style.timeoutSelect} value={logout_timeout === undefined ? defaultTimeout : logout_timeout} placeholder={intl.get('Config.selectLoginTimeout')} onChange={this.handleTimeoutChange}>
              {options.map(item => <Option key={item.value} value={item.value}>{item.text}</Option>)}
            </Select>
          </div>
        </Card>

        <Card title={intl.get('Config.staking')}>
          <p className={style['set_title']}>{intl.get('Config.enableValidator')}</p>
          <Checkbox checked={staking_advance} onChange={this.handleStaking}>{intl.get('Config.stakingAdvance')}</Checkbox>
        </Card>

        <Card title={intl.get('Config.others')}>
          <p className={style['set_title']}>{intl.get('Config.enableOfflineWallet')}</p>
          <Checkbox checked={offline_wallet} onChange={this.handleOffline}>{intl.get('Config.offlineWallet')}</Checkbox>
          <div className={style['set_gap']}></div>
          <p className={style['set_title']}>Currency Unit</p>
          <Checkbox checked={currency_unit === 'USD'} onChange={() => this.handleCurrencyunit('USD')}>USD ($)</Checkbox>
          <Checkbox checked={currency_unit === 'TRY'} onChange={() => this.handleCurrencyunit('TRY')}>TRY (₺)</Checkbox>
          <div className={style['set_gap']}></div>
          <p className={style['set_title']}>Enable Long Addresses(legacy)</p>
          <Checkbox checked={long_addresses} onChange={this.handleLongAddresses}>Show long addresses(legacy) in compatible wallets</Checkbox>
        </Card>
      </div>
    );
  }
}

export default Config;
