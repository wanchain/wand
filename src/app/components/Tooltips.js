import React, { useMemo } from 'react';
import { Tooltip } from 'antd';
import ToolTipIcon from 'static/image/tooltip.png';
import { BigNumber } from 'bignumber.js';

export default function ToolTipCus({
  minOperationFeeLimit,
  maxOperationFeeLimit,
  percentOperationFee,
  isPercentOperationFee,
  wanBridgeDiscounts,
  discountPercentOperationFee,
  symbol
}) {
  const handleClick = () => {
    wand.shell.openExternal('https://docs.wanchain.org')
  }

  const rate = useMemo(() => {
    if (isPercentOperationFee) {
      const ret = new BigNumber(percentOperationFee).multipliedBy(discountPercentOperationFee).multipliedBy(100).toString()
      return `${ret}%`;
    } else {
      return 'N/A'
    }
  }, [isPercentOperationFee, percentOperationFee, discountPercentOperationFee])

  const minOperationFee = useMemo(() => {
    return new BigNumber(minOperationFeeLimit).multipliedBy(discountPercentOperationFee).toString(10);
  }, [minOperationFeeLimit, discountPercentOperationFee])

  const maxOperationFee = useMemo(() => {
    return new BigNumber(maxOperationFeeLimit).multipliedBy(discountPercentOperationFee).toString(10);
  }, [maxOperationFeeLimit, discountPercentOperationFee])

  const Content = () => {
    return (
      <div style={{ backgroundColor: '#3D3E53' }}>
        <p style={{ marginBottom: '15px' }}>The Bridge Fee is composed of the <span style={{ color: '#2FBDF4' }}>"Network Fee + Service Fee"</span>.</p>
        <p style={{ marginBottom: '15px' }}>Should either your sending or receiving address on the Wanchain network possess a designated amount of WAN (inclusive of amounts staked on a Bridge node), you are entitled to a discount on the Service Fee as outlined below:</p>
        <p>Discount Tiers Based on WAN Holdings:</p>
        {
          wanBridgeDiscounts.map((i, index) => <p key={index}>{i.amount} WAN | {i.discount}% off</p>)
        }
        <p style={{ marginTop: '10px' }}>
          <span style={{ color: '#F1754B', display: 'block' }}>Applicable Service Fee Rules for your address:</span>
          <span style={{ display: 'block' }}>- Service fee rate: {rate}</span>
          <span style={{ display: 'block' }}>- Minimum service fee charge: {minOperationFee} {symbol}</span>
          <span style={{ display: 'block' }}>- Maximum service fee charge: {maxOperationFee} {symbol}</span>
        </p>
        <p style={{ marginTop: '10px' }}>
          <span style={{ color: '#F1754B', display: 'block' }}>Note:</span>
          <span style={{ display: 'block' }}>To secure your discount, maintain a stable balance of WAN in your Wanchain address until the completion of your cross-chain transaction. This ensures the discount is applied and prevents additional charges.</span>
        </p>
        <p style={{ marginTop: '10px' }}>
          For complete details, visit the <span style={{ color: '#2fbdf4', cursor: 'pointer' }} onClick={handleClick}>Wanchain Online Documentation</span>
        </p>
      </div>
    )
  }

  return (
    <Tooltip
      placement="top"
      title={<Content />}
      overlayClassName="ccToolTips"
      overlayStyle={{ borderRadius: '12px', fontSize: '12px' }}
    >
      <img src={ToolTipIcon} alt="1" width={18} />
    </Tooltip>
  );
}
