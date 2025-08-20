/**
 * Demo script to test lobby latency monitoring functionality
 * This would be used for manual testing or integration testing
 */

import { io } from 'socket.io-client'

export async function testLobbyLatencyMonitoring() {
  console.log('🚀 Testing Lobby Latency Monitoring...')
  
  const backendUrl = 'http://localhost:3001'
  const lobbySocket = io(`${backendUrl}/lobby-monitor`)
  
  return new Promise<void>((resolve, reject) => {
    let pingCount = 0
    const maxPings = 3
    const pings: number[] = []
    
    lobbySocket.on('connect', () => {
      console.log('✅ Connected to lobby monitor namespace')
      
      // Send first ping
      sendPing()
    })
    
    lobbySocket.on('ping_response', (data) => {
      const now = Date.now()
      const latency = now - data.timestamp
      pings.push(latency)
      
      console.log(`📊 Ping ${pingCount}: ${latency}ms`)
      
      if (pingCount < maxPings) {
        // Send next ping after a short delay
        setTimeout(sendPing, 1000)
      } else {
        // Calculate average and finish
        const average = Math.round(pings.reduce((a, b) => a + b, 0) / pings.length)
        console.log(`📈 Average latency: ${average}ms`)
        console.log('✅ Lobby latency monitoring test completed successfully!')
        
        lobbySocket.disconnect()
        resolve()
      }
    })
    
    lobbySocket.on('connect_error', (error) => {
      console.error('❌ Connection error:', error.message)
      reject(error)
    })
    
    lobbySocket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason)
    })
    
    function sendPing() {
      pingCount++
      const pingId = `test-ping-${pingCount}`
      const timestamp = Date.now()
      
      console.log(`📤 Sending ping ${pingCount}...`)
      lobbySocket.emit('ping_measurement', { pingId, timestamp })
    }
    
    // Timeout after 10 seconds
    setTimeout(() => {
      console.error('❌ Test timed out')
      lobbySocket.disconnect()
      reject(new Error('Test timeout'))
    }, 10000)
  })
}

// Export for use in tests or manual execution
export default testLobbyLatencyMonitoring