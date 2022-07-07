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
class AddContactsModal extends Component {
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
    const { form, handleSave, address } = this.props;
    console.log('save', address)
    const nickName = form.getFieldValue('nickName');
    handleSave(address, nickName);
    this.onCancel();
  }

  render() {
    const { form, address } = this.props;
    const { spin } = this.state;
    const { getFieldDecorator } = form;

    return (
      <div>
        <Modal
          visible={true}
          wrapClassName={style.normalTransFormModal}
          destroyOnClose={true}
          closable={false}
          title={intl.get('AddressBook.saveContact')}
          onCancel={this.onCancel}
          footer={[
            <Button key="back" className="cancel" onClick={this.onCancel}>{intl.get('Common.cancel')}</Button>,
            <Button disabled={spin} key="submit" type="primary" onClick={this.handleSave}>{intl.get('Common.save')}</Button>,
          ]}
        >
          <Form labelCol={{ span: 24 }} wrapperCol={{ span: 24 }} className={style.transForm}>
            <Form.Item label={intl.get('AddressBook.address')}>
              {getFieldDecorator('address', { initialValue: address })
                (<Input disabled={true} />)}
            </Form.Item>
            <Form.Item label={intl.get('AddressBook.nickname')}>
              {getFieldDecorator('nickName')
                (<Input placeholder={intl.get('AddressBook.addNickname')} />)}
            </Form.Item>
          </Form>
        </Modal>
      </div>
    );
  }
}

export default AddContactsModal;
