const logAPIFallback = (failedAPI, nextAPI, reason) => {
  console.log(`🔄 API Fallback: ${failedAPI} → ${nextAPI}`);
  console.log(`   Reason: ${reason}`);
  console.log(`   Time: ${new Date().toISOString()}`);
};

const logPriceUpdateSummary = (results) => {
  console.log('\n📊 PRICE UPDATE SUMMARY');
  console.log('========================');
  console.log(`✅ Successful: ${results.successful}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`⏱️ Duration: ${results.duration}ms`);
  console.log(`🔄 APIs Used: ${results.apisUsed.join(', ')}`);
  console.log(`📈 Symbols Updated: ${results.symbolsUpdated}`);
  console.log('========================\n');
};

module.exports = {
  logAPIFallback,
  logPriceUpdateSummary
};
