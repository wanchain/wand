import intl from 'react-intl-universal';
import { BigNumber } from 'bignumber.js';
import React, { useState, useContext, useMemo, useEffect } from 'react';
import { observer, MobXProviderContext } from 'mobx-react';
import { Button, Modal, Form, Input, Icon, Checkbox, message, Spin, AutoComplete, Select } from 'antd';

import style from '../index.less';
import useAsync from 'hooks/useAsync';
import { checkAmountUnit, checkXRPAddr, getBalance, getAllBalancesFunc } from 'utils/helper';
import ConfirmForm from 'components/NormalTransForm/XRPNormalTrans/XRPConfirmForm.js';
import AddContactsModal from '../../AddContacts/AddContactsModal';
import { MINXRPBALANCE } from 'utils/settings';

const DEFAULTFEE = '0.000012'
const Confirm = Form.create({ name: 'NormalTransForm' })(ConfirmForm);
const AddContactsModalForm = Form.create({ name: 'AddContactsModal' })(AddContactsModal);
const { Option } = Select;
const chainSymbol = 'XRPL';

const XRPNormalTransForm = observer(({ from, form, balance, orignBalance, onCancel, onSend }) => {
  const { session: { settings }, contacts: { contacts, addAddress, hasSameContact }, sendTransParams: { updateXRPTransParams } } = useContext(MobXProviderContext)
  const [disabledAmount, setDisabledAmount] = useState(false);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [minSendAmount, setMinSendAmount] = useState('0');
  const [contactsList, setContactsList] = useState([]);
  const [isNewContacts, setIsNewContacts] = useState(false);
  const [showAddContacts, setShowAddContacts] = useState(false);
  const [visibleTag, setVisibleTag] = useState(true);
  const { status: estimateSmartFeeStatus, value: estimateSmartFee } = useAsync('transaction_estimateSmartFee', DEFAULTFEE, true, { chainType: 'XRP' });
  const { status: getAllBalancesStatus, value: getAllBalances } = useAsync('address_getAllBalances', [{ currency: 'XRP', value: '0' }], true, { chainType: 'XRP', address: from });
  const { status: getServerInfoStatus, value: getServerInfo } = useAsync('address_getServerInfo', null, true, { chainType: 'XRP' });

  const spin = useMemo(() => {
    return [estimateSmartFeeStatus, getAllBalancesStatus, getServerInfoStatus].includes('pending');
  }, [estimateSmartFeeStatus, getAllBalancesStatus, getServerInfoStatus])

  const { getFieldDecorator } = form;

  useEffect(() => {
    if ([estimateSmartFeeStatus, getAllBalancesStatus, getServerInfoStatus].includes('error')) {
      message.warn(intl.get('network.down'));
    }
  }, [estimateSmartFeeStatus, getAllBalancesStatus, getServerInfoStatus])

  useEffect(() => {
    processContacts();
  }, [contacts]);

  const processContacts = () => {
    const { normalAddr } = contacts;
    let contactsList = Object.values(normalAddr[chainSymbol]);
    setContactsList(contactsList);
  }

  const baseReserve = useMemo(() => {
    if (getServerInfo && getServerInfo.validatedLedger) {
      return getServerInfo.validatedLedger.reserveBaseXRP || MINXRPBALANCE
    } else {
      return MINXRPBALANCE;
    }
  }, [getServerInfo])

  const reservePerToken = useMemo(() => {
    if (getServerInfo && getServerInfo.validatedLedger) {
      return getServerInfo.validatedLedger.reserveIncrementXRP || 2
    } else {
      return 2;
    }
  }, [getServerInfo])

  const minReserveXrp = useMemo(() => {
    const addrWithTokenType = (getAllBalances.length > 0 ? getAllBalances.length - 1 : 0) * reservePerToken
    return new BigNumber(addrWithTokenType).plus(baseReserve).toString(10)
  }, [getAllBalances, baseReserve, reservePerToken])

  const renderOption = item => {
    return (
      <Option key={item.address} text={item.address} name={item.name} tag={item.tag}>
        <div className="global-search-item">
          <span className="global-search-item-desc">
            {item.name}-{item.address}  { item.tag ? <span>Tag: {item.tag}</span> : ''}
          </span>
        </div>
      </Option>
    )
  }

  const handleCreate = (address, name, tag) => {
    addAddress(chainSymbol, address, {
      name,
      address,
      chainSymbol,
      tag
    }).then(async () => {
      setIsNewContacts(false);
      processContacts();
      if (tag) {
        form.setFieldsValue({ tag });
      }
    })
  }

  const handleShowAddContactModal = () => {
    setShowAddContacts(!showAddContacts);
  }

  const handleNext = () => {
    form.validateFields(err => {
      if (err) {
        console.log('handleNext', err);
        return;
      };
      let { pwd, amount, to, tag } = form.getFieldsValue(['pwd', 'amount', 'to', 'tag']);
      if (new BigNumber(orignBalance).lt(minReserveXrp)) {
        message.warn(intl.get('NormalTransForm.overBalance'));
        return;
      }
      if (settings.reinput_pwd) {
        if (!pwd) {
          message.warn(intl.get('Backup.invalidPassword'));
          return;
        }
        wand.request('phrase_checkPwd', { pwd }, err => {
          if (err) {
            message.warn(intl.get('Backup.invalidPassword'));
          } else {
            updateXRPTransParams({ to, value: amount, tag });
            setConfirmVisible(true);
          }
        })
      } else {
        updateXRPTransParams({ to, value: amount, tag })
        setConfirmVisible(true);
      }
    });
  }

  const useAvailableBalance = useMemo(() => {
    let tmp = new BigNumber(orignBalance).minus(estimateSmartFee.toString()).minus(minReserveXrp);
    return tmp.lt(0) ? '0' : tmp.toString(10);
  }, [orignBalance, estimateSmartFee, minReserveXrp])

  const checkToXRPAddr = (rule, value, callback) => {
    if (value) {
      checkXRPAddr(value).then(async ret => {
        const isNewContacts = hasSameContact(value, chainSymbol);
        if (ret[0] || ret[1]) {
          setIsNewContacts(!isNewContacts);
          callback()
          setVisibleTag(!ret[1])
        } else {
          setIsNewContacts(false);
          setVisibleTag(true)
          callback(rule.message)
        }
      }).then(() => getBalance([value], 'XRP')).then(val => {
        let value = new BigNumber(Object.values(val)[0])
        value.minus('11').lt('0') && setMinSendAmount(new BigNumber('11').minus(value).toString(10))
        if (form.getFieldValue('amount') !== undefined) {
          form.validateFields(['amount'])
        }
      }).catch(err => {
        console.log('checkToXRPAddrErr:', err);
        setVisibleTag(true)
        setIsNewContacts(false);
        callback(rule.message);
      })
    } else {
      setVisibleTag(true)
      setIsNewContacts(false);
      callback(rule.message);
    }
  }

  const checkAmount = async (rule, value, callback) => {
    if (value === undefined) {
      callback(intl.get('NormalTransForm.amountIsIncorrect'));
      return;
    }
    if (new BigNumber(value).lte(0) || !checkAmountUnit(6, value)) {
      callback(intl.get('NormalTransForm.amountIsIncorrect'));
      return;
    }
    if (new BigNumber(useAvailableBalance).minus(value).lt(0)) {
      callback(intl.get('Xrp.minAmount', { minReserveXrp }));
      return;
    }
    try {
      if (form.getFieldValue('to')) {
        const val = await getBalance([form.getFieldValue('to')], 'XRP');
        const addrBalances = await getAllBalancesFunc('XRP', form.getFieldValue('to'));
        const toBalance = new BigNumber(Object.values(val)[0]);
        const addrWithTokenType = (addrBalances.length > 0 ? addrBalances.length - 1 : 0) * reservePerToken
        const minReserveXrp_to = new BigNumber(addrWithTokenType).plus(baseReserve).toString(10);
        if (toBalance.lt(minReserveXrp_to) && new BigNumber(value).lt(minReserveXrp_to)) {
          callback(intl.get('Xrp.notExistAccount', { minReserveXrp: minReserveXrp_to }));
          return;
        }
      }
    } catch (error) {
      console.log('checkAmount', error)
    }

    callback();
  }

  const sendAllAmount = e => {
    if (e.target.checked) {
      form.setFieldsValue({
        amount: new BigNumber(useAvailableBalance).toString(10)
      });
      setDisabledAmount(true)
    } else {
      form.setFieldsValue({ amount: 0 });
      setDisabledAmount(false)
    }
  }

  const checkDestinationTag = (rule, value, callback) => {
    if (value && !Number.isInteger(Number(value))) {
      callback(rule.message);
      return;
    }
    callback();
  }

  const handleConfirmCancel = () => {
    setConfirmVisible(false);
  }

  const filterContactList = (inputValue, option) => {
    const text = option.props.text.toLowerCase();
    const name = option.props.name.toLowerCase();
    const inp = inputValue.toLowerCase();
    return text.includes(inp) || name.includes(inp);
  }

  const handleChange = (value, option) => {
    if (option.props.tag) {
      form.setFieldsValue({ tag: option.props.tag })
    }
  }

  return (
    <React.Fragment>
      <Modal
        visible
        wrapClassName={style.ETHNormalTransFormModal}
        destroyOnClose={true}
        closable={false}
        title={intl.get('NormalTransForm.transaction')}
        onCancel={onCancel}
        footer={[
          <Button key="back" className="cancel" onClick={onCancel}>{intl.get('Common.cancel')}</Button>,
          <Button disabled={spin} key="submit" type="primary" onClick={handleNext}>{intl.get('Common.next')}</Button>,
        ]}
      >
        <Spin spinning={spin} size="large">
          <Form labelCol={{ span: 24 }} wrapperCol={{ span: 24 }} className={style.transForm}>
            <Form.Item label={intl.get('Common.from')}>
              {getFieldDecorator('from', { initialValue: from })
                (<Input disabled={true} prefix={<Icon type="wallet" className="colorInput" />} />)}
            </Form.Item>
            <Form.Item label={intl.get('Common.balance')}>
              {getFieldDecorator('balance', { initialValue: balance + ' XRP' })
                (<Input disabled={true} prefix={<Icon type="wallet" className="colorInput" />} />)}
            </Form.Item>
            <Form.Item label={intl.get('NormalTransForm.to')}>
              {getFieldDecorator('to', { rules: [{ required: true, message: intl.get('NormalTransForm.addressIsIncorrect'), validator: checkToXRPAddr }] })
                (
                  <AutoComplete
                    getPopupContainer={node => node.parentNode}
                    size="large"
                    style={{ width: '100%' }}
                    filterOption={filterContactList}
                    dataSource={contactsList.map(renderOption)}
                    placeholder="input here"
                    optionLabelProp="text"
                    onSelect={handleChange}
                  >
                    <Input placeholder={intl.get('NormalTransForm.recipientAddress')} prefix={<Icon type="wallet" className="colorInput" />} />
                  </AutoComplete>
                )}
                {
                  isNewContacts
                  ? <Button className={style.addNewContacts} shape="round" onClick={handleShowAddContactModal}>
                    <span className={style.magicTxt}>
                      {intl.get('NormalTransForm.addNewContacts')}
                    </span>
                  </Button>
                  : null
                }
            </Form.Item>
              <Form.Item label={intl.get('NormalTransForm.fee')}>
                {getFieldDecorator('fee', { initialValue: estimateSmartFee })
                  (<Input disabled={true} prefix={<Icon type="wallet" className="colorInput" />} />)}
              </Form.Item>
            <Form.Item label={intl.get('Common.amount')}>
              {getFieldDecorator('amount', { rules: [{ required: true, validator: checkAmount }] })
                (<Input disabled={disabledAmount} min={0} placeholder={intl.get('Common.availableBalance', { availableBalance: useAvailableBalance })} prefix={<Icon type="credit-card" className="colorInput" />} />)}
              <Checkbox onChange={sendAllAmount}>{intl.get('NormalTransForm.sendAll')}</Checkbox>
            </Form.Item>
            {
              visibleTag &&
              <Form.Item label={intl.get('Xrp.destinationTag')}>
                {getFieldDecorator('tag', { rules: [{ message: intl.get('NormalTransForm.destinationTagRule'), validator: checkDestinationTag }] })
                  (<Input min={0} placeholder='Tag' prefix={<Icon type="credit-card" className="colorInput" />} />)}
              </Form.Item>
            }
            {
              settings.reinput_pwd &&
              <Form.Item label={intl.get('NormalTransForm.password')}>
                {getFieldDecorator('pwd', { rules: [{ required: true, message: intl.get('NormalTransForm.pwdIsIncorrect') }] })
                (<Input.Password placeholder={intl.get('Backup.enterPassword')} prefix={<Icon type="lock" className="colorInput" />} />)}
              </Form.Item>
            }
          </Form>
        </Spin>
      </Modal>
      {
        confirmVisible &&
        <Confirm visible={true} onCancel={handleConfirmCancel} sendTrans={onSend} from={from} fee={estimateSmartFee}/>
      }
      {
        showAddContacts && <AddContactsModalForm handleSave={handleCreate} onCancel={handleShowAddContactModal} address={form.getFieldValue('to')} chain={chainSymbol}></AddContactsModalForm>
      }
    </React.Fragment>
  )
})

export default XRPNormalTransForm;
