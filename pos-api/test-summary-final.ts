async function testSummaryFinal() {
  try {
    console.log('🔍 Probando resumen diario final...\n');
    
    // Login como admin
    const adminLogin = await fetch('http://localhost:3001/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'Admin123!' })
    });
    
    if (!adminLogin.ok) {
      console.error('❌ Error en login:', adminLogin.status);
      return;
    }
    
    const adminData = await adminLogin.json();
    console.log('✅ Login admin exitoso');
    
    // Probar endpoint de resumen
    const summaryResponse = await fetch('http://localhost:3001/reports/summary?date=2025-10-03', {
      headers: {
        'Authorization': `Bearer ${adminData.access_token}`,
        'Content-Type': 'application/json',
      }
    });
    
    console.log(`📊 Status: ${summaryResponse.status}`);
    
    if (summaryResponse.ok) {
      const summaryData = await summaryResponse.json();
      console.log('📊 Resumen del día:');
      console.log(`   Total Ventas: ${summaryData.summary.totalSales}`);
      console.log(`   Total Vendido: Q${summaryData.summary.totalAmount}`);
      console.log(`   Vendedores Activos: ${summaryData.summary.activeSellers}/${summaryData.summary.totalSellers}`);
      
      if (summaryData.sellers && summaryData.sellers.length > 0) {
        console.log('\n👥 Vendedores:');
        summaryData.sellers.forEach((seller, index) => {
          console.log(`   ${index + 1}. ${seller.seller.fullName} (${seller.seller.username}): ${seller.metrics.totalSales} ventas (Q${seller.metrics.totalAmount})`);
        });
      } else {
        console.log('\n❌ No hay vendedores en el resumen');
      }
    } else {
      const errorText = await summaryResponse.text();
      console.error('❌ Error:', errorText);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

testSummaryFinal();























