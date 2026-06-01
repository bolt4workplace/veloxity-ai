// Global formatting utilities

function formatCurrency(value) {
  if (!value && value !== 0) return '$0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '$0.00';
  return '$' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function formatNumber(value) {
  if (!value && value !== 0) return '0.00';
  const num = parseFloat(value);
  if (isNaN(num)) return '0.00';
  return num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// Global popup utility (replaces alerts)
function showPopup(title, message, type = 'info') {
  const modal = document.createElement('div');
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.7);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  `;
  
  const colors = {
    error: '#f87171',
    success: '#10b981',
    info: '#3b82f6',
    warning: '#f59e0b'
  };
  
  const color = colors[type] || colors.info;
  
  modal.innerHTML = `
    <div style="
      background: #1f2937;
      border: 2px solid ${color};
      border-radius: 12px;
      padding: 24px;
      max-width: 450px;
      width: 90%;
      color: #f9fafb;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto;
    ">
      <h3 style="margin: 0 0 12px 0; color: ${color}; font-size: 18px;">${title}</h3>
      <p style="margin: 0 0 24px 0; color: #d1d5db; font-size: 14px; line-height: 1.5;">${message}</p>
      <button onclick="this.closest('div').parentElement.remove()" style="
        background: ${color};
        color: white;
        border: none;
        padding: 10px 24px;
        border-radius: 8px;
        cursor: pointer;
        font-weight: 600;
        width: 100%;
      ">OK</button>
    </div>
  `;
  
  document.body.appendChild(modal);
}
