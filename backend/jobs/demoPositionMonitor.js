const DemoAccount = require('../models/DemoAccount');
const DemoPosition = require('../models/DemoPosition');
const DemoTrade = require('../models/DemoTrade');
const getPrice = require('../utils/getPrice');
const mongoose = require('mongoose');

// WebSocket server reference (will be set from app.js)
let wss = null;

// Set WebSocket server reference
const setWebSocketServer = (websocketServer) => {
  wss = websocketServer;
};

// Broadcast position closure notification
const broadcastPositionClosure = (position, closureType, pnl) => {
  if (!wss) return;
  
  try {
    wss.clients.forEach(client => {
      if (client.readyState === require('ws').OPEN) {
        client.send(JSON.stringify({
          type: closureType === 'take_profit' ? 'take_profit_hit' : 'stop_loss_hit',
          data: {
            positionId: position._id,
            symbol: position.symbol,
            closureType: closureType,
            pnl: pnl,
            closedAt: new Date().toISOString(),
            user: position.user
          }
        }));
      }
    });
  } catch (error) {
    console.error('❌ Error broadcasting position closure:', error.message);
  }
};

// Enhanced position monitoring with better error handling
async function monitorDemoPositions() {
  // Check if database is connected
  if (mongoose.connection.readyState !== 1) {
    console.log('🔌 Database not connected - skipping demo position monitoring');
    return;
  }
  
  try {
    console.log('🔍 Starting demo position monitoring...');
    
    const accounts = await DemoAccount.find({}).populate('openPositions');
    let totalPositionsChecked = 0;
    let positionsClosed = 0;
    
    for (const account of accounts) {
      if (!account.openPositions || account.openPositions.length === 0) {
        continue;
      }
      
      console.log(`👤 Checking ${account.openPositions.length} positions for user ${account.user}`);
      
      for (const positionRef of account.openPositions) {
        try {
          // Get the full position document
          const position = await DemoPosition.findById(positionRef);
          if (!position) {
            console.log(`⚠️ Position ${positionRef} not found, removing from account`);
            account.openPositions = account.openPositions.filter(p => p.toString() !== positionRef.toString());
            continue;
          }
          
          totalPositionsChecked++;
          
          // Fetch current price
          const currentPrice = await getPrice(position.symbol);
          if (!currentPrice) {
            console.log(`⚠️ Could not fetch price for ${position.symbol}, skipping`);
            continue;
          }
          
          // Update position with current price
          position.currentPrice = currentPrice;
          
          // Calculate P&L
          const entryPrice = Number(position.entryPrice);
          const quantity = Number(position.quantity);
          const positionType = position.type || position.direction || 'BUY';
          
          let pnl = 0;
          if (positionType === 'BUY') {
            pnl = (currentPrice - entryPrice) * quantity;
          } else if (positionType === 'SELL') {
            pnl = (entryPrice - currentPrice) * quantity;
          }
          
          position.pnl = pnl;
          position.pnlPercentage = entryPrice > 0 ? (pnl / (entryPrice * quantity)) * 100 : 0;
          
          // Check take profit and stop loss conditions
          let shouldClose = false;
          let closureType = null;
          
          if (position.targetPrice && position.stopLoss) {
            if (positionType === 'BUY') {
              // For BUY positions
              if (currentPrice >= position.targetPrice) {
                shouldClose = true;
                closureType = 'take_profit';
                console.log(`🎯 Take profit hit for ${position.symbol} BUY position`);
              } else if (currentPrice <= position.stopLoss) {
                shouldClose = true;
                closureType = 'stop_loss';
                console.log(`🛑 Stop loss hit for ${position.symbol} BUY position`);
              }
            } else if (positionType === 'SELL') {
              // For SELL positions
              if (currentPrice <= position.targetPrice) {
                shouldClose = true;
                closureType = 'take_profit';
                console.log(`🎯 Take profit hit for ${position.symbol} SELL position`);
              } else if (currentPrice >= position.stopLoss) {
                shouldClose = true;
                closureType = 'stop_loss';
                console.log(`🛑 Stop loss hit for ${position.symbol} SELL position`);
              }
            }
          }
          
          if (shouldClose) {
            try {
              // Create trade record
              await DemoTrade.create({
                symbol: position.symbol,
                entryPrice: position.entryPrice,
                exitPrice: currentPrice,
                quantity: position.quantity,
                direction: position.type,
                profit: pnl,
                openedAt: position.openedAt,
                closedAt: new Date(),
                signalId: position.signalId,
                closureType: closureType,
                user: position.user,
                market: position.market,
                timeframe: position.timeframe,
              });
              
              // Update account balance
              account.balance = Number(account.balance) + Number(pnl);
              
              // Move position to trade history
              account.tradeHistory.push(position._id);
              account.openPositions = account.openPositions.filter(p => p.toString() !== position._id.toString());
              
              // Update position status
              position.status = 'closed';
              position.closedAt = new Date();
              position.closureType = closureType;
              await position.save();
              
              // Broadcast notification
              broadcastPositionClosure(position, closureType, pnl);
              
              positionsClosed++;
              
              console.log(`✅ Position closed: ${position.symbol} - ${closureType} - P&L: $${pnl.toFixed(2)}`);
              
            } catch (error) {
              console.error(`❌ Error closing position ${position.symbol}:`, error.message);
            }
          } else {
            // Save updated position with current price and P&L
            await position.save();
          }
          
        } catch (error) {
          console.error(`❌ Error processing position ${positionRef}:`, error.message);
        }
      }
      
      // Save account changes
      if (positionsClosed > 0) {
        await account.save();
        console.log(`💰 Account ${account.user} updated - Balance: $${account.balance.toFixed(2)}`);
      }
    }
    
    console.log(`📊 Position monitoring complete: ${totalPositionsChecked} positions checked, ${positionsClosed} positions closed`);
    
  } catch (error) {
    console.error('❌ Error in demo position monitoring:', error.message);
  }
}

// Enhanced monitoring with configurable intervals
let monitoringInterval = null;

const startPositionMonitoring = (intervalMs = 30000) => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
  }
  
  console.log(`🚀 Starting position monitoring with ${intervalMs}ms interval`);
  
  // Run initial check
  monitorDemoPositions();
  
  // Set up recurring monitoring
  monitoringInterval = setInterval(monitorDemoPositions, intervalMs);
  
  return monitoringInterval;
};

const stopPositionMonitoring = () => {
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
    console.log('🛑 Position monitoring stopped');
  }
};

const getMonitoringStatus = () => {
  return {
    active: monitoringInterval !== null,
    interval: monitoringInterval ? 30000 : null,
    lastCheck: new Date().toISOString(),
  };
};

// Manual position closure for testing
const closePositionManually = async (positionId, userId) => {
  try {
    const account = await DemoAccount.findOne({ user: userId }).populate('openPositions');
    if (!account) {
      throw new Error('Account not found');
    }
    
    const position = account.openPositions.find(p => p._id.toString() === positionId);
    if (!position) {
      throw new Error('Position not found');
    }
    
    // Fetch current price
    const currentPrice = await getPrice(position.symbol);
    if (!currentPrice) {
      throw new Error('Could not fetch current price');
    }
    
    // Calculate P&L
    const entryPrice = Number(position.entryPrice);
    const quantity = Number(position.quantity);
    const positionType = position.type || position.direction || 'BUY';
    
    let pnl = 0;
    if (positionType === 'BUY') {
      pnl = (currentPrice - entryPrice) * quantity;
    } else if (positionType === 'SELL') {
      pnl = (entryPrice - currentPrice) * quantity;
    }
    
    // Create trade record
    await DemoTrade.create({
      symbol: position.symbol,
      entryPrice: position.entryPrice,
      exitPrice: currentPrice,
      quantity: position.quantity,
      direction: position.type,
      profit: pnl,
      openedAt: position.openedAt,
      closedAt: new Date(),
      signalId: position.signalId,
      closureType: 'manual',
      user: position.user,
      market: position.market,
      timeframe: position.timeframe,
    });
    
    // Update account
    account.balance = Number(account.balance) + Number(pnl);
    account.tradeHistory.push(position._id);
    account.openPositions = account.openPositions.filter(p => p._id.toString() !== positionId);
    await account.save();
    
    // Update position
    position.status = 'closed';
    position.closedAt = new Date();
    position.closureType = 'manual';
    await position.save();
    
    // Broadcast notification
    broadcastPositionClosure(position, 'manual', pnl);
    
    console.log(`✅ Manual position closure: ${position.symbol} - P&L: $${pnl.toFixed(2)}`);
    
    return { success: true, pnl, currentPrice };
    
  } catch (error) {
    console.error('❌ Error in manual position closure:', error.message);
    throw error;
  }
};

module.exports = { 
  monitorDemoPositions,
  startPositionMonitoring,
  stopPositionMonitoring,
  getMonitoringStatus,
  closePositionManually,
  setWebSocketServer,
};