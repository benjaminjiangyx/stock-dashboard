const StockRow = ({ symbol, price, change, open, high, low, previousClose }) => {
  const isPositive = parseFloat(change) >= 0;

  return (
    <tr className="stock-row">
      <td className="cell-symbol">{symbol}</td>
      <td className="cell-price">${price?.toFixed(2)}</td>
      <td className={`cell-change ${isPositive ? 'positive' : 'negative'}`}>
        {isPositive ? '+' : ''}{change}%
      </td>
      <td className="cell-open">${open?.toFixed(2)}</td>
      <td className="cell-high">${high?.toFixed(2)}</td>
      <td className="cell-low">${low?.toFixed(2)}</td>
      <td className="cell-prev-close">${previousClose?.toFixed(2)}</td>
    </tr>
  );
};

export default StockRow;
