import React, { Component } from 'react';
import { observer, inject } from 'mobx-react';
import { Button, Modal, Form, Input, Select } from 'antd';
import intl from 'react-intl-universal';
import style from './index.less';

const { Option } = Select;

// const Confirm = Form.create({ name: 'NormalTransForm' })(ConfirmForm);
// const AdvancedOption = Form.create({ name: 'NormalTransForm' })(AdvancedOptionForm);

@inject(stores => ({
  normalContacts: stores.contacts.contacts.normalAddr,
  privateContacts: stores.contacts.contacts.privateAddr,
}))

@observer
class NormalTransForm extends Component {
  state = {
    isPrivate: false,
    spin: false
  }

  componentWillUnmount() {
    this.setState = () => false;
  }

  onCancel = () => {
    this.props.onCancel();
  }

  handleSave = () => {
    console.log('save')
    const { form, handleSave } = this.props;
    const { chain, address, username } = form.getFieldsValue(['chain', 'address', 'username']);
    handleSave(chain, address, username);
    this.onCancel()
  }

  render() {
    const { form, chainList } = this.props;
    const { spin } = this.state;
    const { getFieldDecorator } = form;

    return (
      <div>
        <Modal
          visible={true}
          wrapClassName={style.normalTransFormModal}
          destroyOnClose={true}
          closable={false}
          title={intl.get('NormalTransForm.transaction')}
          onCancel={this.onCancel}
          footer={[
            <Button key="back" className="cancel" onClick={this.onCancel}>{intl.get('Common.cancel')}</Button>,
            <Button disabled={spin} key="submit" type="primary" onClick={this.handleSave}>{intl.get('Common.save')}</Button>,
          ]}
        >
          <Form labelCol={{ span: 24 }} wrapperCol={{ span: 24 }} className={style.transForm}>
            <Form.Item label={intl.get('AddressBook.username')}>
              {getFieldDecorator('username')
                (<Input placeholder={intl.get('AddressBook.addUsernamePlaceHolder')} />)}
            </Form.Item>
            <Form.Item label={intl.get('AddressBook.address')}>
              {getFieldDecorator('address')
                (<Input placeholder={intl.get('AddressBook.addAddressPlaceHolder')} />)}
            </Form.Item>
            <Form.Item label={intl.get('AddressBook.chain')}>
              {getFieldDecorator('chain', { initialValue: undefined })
                (<Select
                  placeholder={intl.get('AddressBook.addChainPlaceHolder')}
                  dropdownMatchSelectWidth
                >
                  {chainList.map(v => <Option value={v} key={v}>{v}</Option>)}
                </Select>)}
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }
}

export default NormalTransForm;
