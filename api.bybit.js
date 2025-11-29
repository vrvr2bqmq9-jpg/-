const crypto = require('crypto');

export default async function handler(req, res) {
  // 設定 CORS 允許所有來源
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // 處理 OPTIONS 請求 (CORS)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 只接受 POST 請求
  if (req.method !== 'POST') {
    return res.status(405).json({ error: '只允許 POST 請求', success: false });
  }

  console.log('=== 收到 TradingView 警報 ===');
  console.log('原始數據:', JSON.stringify(req.body, null, 2));

  try {
    // 從環境變數讀取 Bybit API
    const API_KEY = process.env.BYBIT_API_KEY;
    const SECRET_KEY = process.env.BYBIT_SECRET_KEY;

    if (!API_KEY || !SECRET_KEY) {
      throw new Error('請在 Vercel 環境變數中設定 BYBIT_API_KEY 和 BYBIT_SECRET_KEY');
    }

    // 解析 TradingView 數據
    const tvData = req.body;
    const symbol = tvData.symbol || tvData.ticker || 'BTCUSDT';
    const action = (tvData.action || tvData.side || 'buy').toString().toLowerCase();
    const quantity = tvData.quantity || tvData.qty || '0.001';

    // 轉換動作為 Bybit 格式
    const side = action.includes('buy') ? 'Buy' : 'Sell';

    // 準備訂單參數
    const orderParams = {
      category: 'linear',
      symbol: symbol.replace('/', ''), // 移除斜線如果有
      side: side,
      orderType: 'Market',
      qty: quantity.toString()
    };

    console.log('轉換後的訂單參數:', orderParams);

    // 生成簽名
    const timestamp = Date.now().toString();
    const recvWindow = '5000';
    
    const signString = timestamp + API_KEY + recvWindow + JSON.stringify(orderParams);
    const signature = crypto.createHmac('sha256', SECRET_KEY).update(signString).digest('hex');

    console.log('發送到 Bybit 測試網...');

    // 發送到 Bybit 測試網
    const bybitResponse = await fetch('https://api-testnet.bybit.com/v5/order/create', {
      method: 'POST',
      headers: {
        'X-BAPI-API-KEY': API_KEY,
        'X-BAPI-TIMESTAMP': timestamp,
        'X-BAPI-RECV-WINDOW': recvWindow,
        'X-BAPI-SIGN': signature,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(orderParams)
    });

    const result = await bybitResponse.json();
    
    console.log('Bybit 回應:', result);

    // 回傳結果
    if (result.retCode === 0) {
      res.status(200).json({
        success: true,
        message: `訂單成功: ${side} ${quantity} ${symbol}`,
        orderId: result.result.orderId,
        tradingViewData: tvData,
        bybitResponse: result
      });
    } else {
      res.status(400).json({
        success: false,
        error: `Bybit 錯誤: ${result.retMsg}`,
        bybitResponse: result
      });
    }

  } catch (error) {
    console.error('執行錯誤:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      tip: '請檢查 API Key 和網路連接'
    });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  return res.status(200).json({
    message: 'TradingView-Bybit 橋接器運行中',
    endpoints: {
      main: '/api/bybit - 接收 TradingView 警報',
      test: '/api/test - 測試服務狀態'
    },
    usage: '在 TradingView 警報中發送 POST 請求到 /api/bybit',
    example: {
      action: "buy",
      symbol: "BTCUSDT", 
      quantity: "0.001"
    }
  });
}
