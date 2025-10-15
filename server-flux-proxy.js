// Load environment variables from .env file
require('dotenv').config();

const http = require('http');
const https = require('https');
const WebSocket = require('ws');
const { URL } = require('url');

// Configuration from environment variables
const PORT = process.env.FLUX_PROXY_PORT || 3001;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY;

console.log('🚀 Starting FLUX proxy server (language-based activation)');
console.log('🔍 Debug: Environment variables check:');
console.log('   DEEPGRAM_API_KEY exists:', !!process.env.DEEPGRAM_API_KEY);
console.log('   NEXT_PUBLIC_DEEPGRAM_API_KEY exists:', !!process.env.NEXT_PUBLIC_DEEPGRAM_API_KEY);
console.log('   FLUX_PROXY_PORT:', process.env.FLUX_PROXY_PORT);
if (process.env.DEEPGRAM_API_KEY) {
  console.log('   DEEPGRAM_API_KEY length:', process.env.DEEPGRAM_API_KEY.length);
}

if (!DEEPGRAM_API_KEY) {
  console.error('❌ DEEPGRAM_API_KEY environment variable is required!');
  console.log('💡 Set it with: export DEEPGRAM_API_KEY="your_api_key_here"');
  console.log('💡 Or use NEXT_PUBLIC_DEEPGRAM_API_KEY from your .env.local');
  process.exit(1);
}

// Connectivity test function for FLUX API
async function testFluxApiConnectivity() {
  const testUrl = 'api.deepgram.com';
  const port = 443; // HTTPS/WSS port

  console.log('\n🔍 Testing FLUX API Connectivity...');
  console.log(`   Target: ${testUrl}:${port}`);

  return new Promise((resolve) => {
    const startTime = Date.now();

    // Test HTTPS connectivity first
    const req = https.get(`https://${testUrl}`, {
      timeout: 5000,
      headers: {
        'User-Agent': 'RealTalk-FLUX-Proxy/1.0'
      }
    }, (res) => {
      const duration = Date.now() - startTime;
      console.log(`✅ HTTPS connection successful (${duration}ms)`);
      console.log(`   Status: ${res.statusCode} ${res.statusMessage}`);
      console.log(`   Server: ${res.headers.server || 'Unknown'}`);
      resolve({ success: true, duration, statusCode: res.statusCode });
      req.destroy();
    });

    req.on('error', (err) => {
      const duration = Date.now() - startTime;
      console.log(`❌ HTTPS connection failed (${duration}ms)`);
      console.log(`   Error: ${err.code} - ${err.message}`);

      if (err.code === 'ENOTFOUND') {
        console.log('   🔍 DNS resolution failed - check internet connection');
      } else if (err.code === 'ECONNREFUSED') {
        console.log('   🔍 Connection refused - service may be down');
      } else if (err.code === 'ETIMEDOUT') {
        console.log('   🔍 Connection timeout - network issues or firewall blocking');
      }

      resolve({ success: false, error: err, duration });
    });

    req.on('timeout', () => {
      const duration = Date.now() - startTime;
      console.log(`⏰ HTTPS request timeout (${duration}ms)`);
      req.destroy();
      resolve({ success: false, error: new Error('TIMEOUT'), duration });
    });
  });
}

// Create HTTP server for health checks
const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://localhost:${PORT}`);
  
  // Health check endpoint
  if (parsedUrl.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      flux_enabled: true,
      port: PORT,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Root endpoint
  if (parsedUrl.pathname === '/') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>RealTalk FLUX Proxy</title>
          <style>
            body { font-family: system-ui; max-width: 800px; margin: 50px auto; padding: 20px; }
            h1 { color: #333; }
            .status { padding: 10px; background: #e8f5e9; border-radius: 5px; margin: 10px 0; }
            code { background: #f5f5f5; padding: 2px 5px; border-radius: 3px; }
          </style>
        </head>
        <body>
          <h1>🚀 RealTalk FLUX Proxy Server</h1>
          <div class="status">
            <p><strong>Status:</strong> Running</p>
            <p><strong>Port:</strong> ${PORT}</p>
            <p><strong>WebSocket Endpoint:</strong> <code>ws://localhost:${PORT}</code></p>
            <p><strong>FLUX Enabled:</strong> true (language-based activation)</p>
          </div>
          <h2>Usage</h2>
          <p>Connect your client to <code>ws://localhost:${PORT}</code> with your Deepgram query parameters.</p>
          <p>Example: <code>ws://localhost:${PORT}?model=flux-general-en&smart_format=true</code></p>
        </body>
      </html>
    `);
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

// WebSocket proxy server attached to the same HTTP server
const wsServer = new WebSocket.Server({ server });

// Track active connections for monitoring
let activeConnections = 0;
let totalConnections = 0;

wsServer.on('connection', async (clientWs, req) => {
  activeConnections++;
  totalConnections++;
  const connectionId = totalConnections;

  console.log(`\n🔌 [Connection #${connectionId}] Client connected`);
  console.log(`   Client IP: ${req.socket.remoteAddress}`);
  console.log(`   User-Agent: ${req.headers['user-agent'] || 'Unknown'}`);
  console.log(`   Active connections: ${activeConnections}`);

  // Extract query parameters from the client request
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const searchParams = url.searchParams;

  // Build Deepgram WebSocket URL with client parameters
  const deepgramUrl = `wss://api.deepgram.com/v2/listen?${searchParams.toString()}`;

  console.log(`\n🎯 [Connection #${connectionId}] Preparing FLUX API Connection:`);
  console.log(`   Full URL: ${deepgramUrl}`);
  console.log(`   Parameters: ${Array.from(searchParams.entries()).map(([k, v]) => `${k}=${v}`).join(', ')}`);

  // Test connectivity before attempting WebSocket connection
  console.log(`\n🧪 [Connection #${connectionId}] Pre-connection connectivity test:`);
  const connectivityTest = await testFluxApiConnectivity();

  if (!connectivityTest.success) {
    console.log(`❌ [Connection #${connectionId}] Connectivity test failed`);
    clientWs.close(1002, `FLUX API connectivity test failed: ${connectivityTest.error?.message || 'Unknown error'}`);
    activeConnections--;
    return;
  }

  console.log(`✅ [Connection #${connectionId}] Connectivity test passed`);
  console.log(`\n🚀 [Connection #${connectionId}] Attempting WebSocket connection to FLUX API...`);
  const wsStartTime = Date.now();

  // Create connection to Deepgram with proper authentication
  const deepgramWs = new WebSocket(deepgramUrl, {
    headers: {
      'Authorization': `Token ${DEEPGRAM_API_KEY}`
    }
  });

  // Forward messages from client to Deepgram
  let messageCount = 0;
  clientWs.on('message', (data) => {
    messageCount++;

    // Log first few messages and periodically thereafter
    if (messageCount <= 5 || messageCount % 50 === 0) {
      console.log(`📤 [Connection #${connectionId}] Client->Deepgram message ${messageCount}: ${data.byteLength || data.length} bytes`);
    }

    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.send(data);
    } else {
      if (messageCount <= 3) {
        console.log(`❌ [Connection #${connectionId}] Cannot forward to Deepgram: readyState=${deepgramWs.readyState}`);
      }
    }
  });

  // Forward messages from Deepgram to client
  let responseCount = 0;
  deepgramWs.on('message', (data) => {
    responseCount++;

    // Convert data to string if it's binary
    const messageText = data.toString('utf8');

    // Log all Deepgram responses (they should be relatively infrequent)
    console.log(`📨 [Connection #${connectionId}] Deepgram response ${responseCount}: ${messageText.substring(0, 150)}${messageText.length > 150 ? '...' : ''}`);

    if (clientWs.readyState === WebSocket.OPEN) {
      // Send as text, not binary
      clientWs.send(messageText, { binary: false });
    } else {
      console.log(`❌ [Connection #${connectionId}] Cannot forward to client: readyState=${clientWs.readyState}`);
    }
  });

  // Handle Deepgram connection events
  deepgramWs.on('open', () => {
    const connectionTime = Date.now() - wsStartTime;
    console.log(`✅ [Connection #${connectionId}] Connected to Deepgram FLUX API successfully (${connectionTime}ms)`);
    console.log('   Protocol: WebSocket Secure (WSS)');
    console.log('   Ready State: OPEN');
    console.log('🎧 Ready to receive audio data...');
  });

  deepgramWs.on('error', (error) => {
    const connectionTime = Date.now() - wsStartTime;
    console.error(`❌ [Connection #${connectionId}] Deepgram connection error (${connectionTime}ms):`, error.message);
    console.error('🔍 Error details:', {
      code: error.code,
      message: error.message,
      type: error.constructor.name
    });

    // Provide specific troubleshooting guidance
    if (error.message.includes('401') || error.message.includes('Unauthorized')) {
      console.error('   🔑 Authentication failed - check your DEEPGRAM_API_KEY');
    } else if (error.message.includes('403') || error.message.includes('Forbidden')) {
      console.error('   🚫 Access forbidden - check API key permissions');
    } else if (error.message.includes('ENOTFOUND')) {
      console.error('   🌐 DNS lookup failed - check internet connection');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.error('   🔒 Connection refused - service may be down or blocked');
    }

    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close(1000, `Deepgram error: ${error.message}`);
    }
  });

  deepgramWs.on('close', (code, reason) => {
    const connectionTime = Date.now() - wsStartTime;
    const reasonStr = reason ? reason.toString() : 'No reason provided';
    console.log(`🔌 [Connection #${connectionId}] Deepgram connection closed (${connectionTime}ms): ${code} - ${reasonStr}`);
    console.log('🔍 WebSocket close codes:');
    console.log('   1000=Normal closure, 1002=Protocol error, 1003=Unsupported data');
    console.log('   4008=Invalid request, 4009=Rate limit, 4010=Invalid model');
    console.log('   4011=Insufficient credits, 4012=Model not available');

    if (code === 4008) {
      console.log('   💡 Invalid request - check query parameters and model name');
    } else if (code === 4011) {
      console.log('   💳 Insufficient credits - check your Deepgram account balance');
    } else if (code === 4010) {
      console.log('   🤖 Invalid model - check if model is available');
    }

    if (clientWs.readyState === WebSocket.OPEN) {
      // Map Deepgram-specific codes to standard WebSocket codes
      // WebSocket close codes must be in range 1000-1015 or 3000-4999
      // Deepgram uses 4xxx codes which are valid, but we need to ensure they're numbers
      const closeCode = typeof code === 'number' && code >= 1000 ? code : 1000;
      try {
        clientWs.close(closeCode, reasonStr);
      } catch (err) {
        console.error(`⚠️ [Connection #${connectionId}] Failed to close client socket:`, err.message);
        // Force close without parameters if there's an error
        try {
          clientWs.terminate();
        } catch {}
      }
    }

    activeConnections--;
    console.log(`   Active connections: ${activeConnections}`);
  });

  // Handle client disconnection
  clientWs.on('close', () => {
    console.log(`🔌 [Connection #${connectionId}] Client disconnected`);
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
    activeConnections--;
    console.log(`   Active connections: ${activeConnections}`);
  });

  clientWs.on('error', (error) => {
    console.error(`❌ [Connection #${connectionId}] Client connection error:`, error.message);
    if (deepgramWs.readyState === WebSocket.OPEN) {
      deepgramWs.close();
    }
    activeConnections--;
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('\n🛑 SIGTERM received, shutting down gracefully...');
  wsServer.close(() => {
    console.log('✅ WebSocket server closed');
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('\n🛑 SIGINT received, shutting down gracefully...');
  wsServer.close(() => {
    console.log('✅ WebSocket server closed');
    server.close(() => {
      console.log('✅ HTTP server closed');
      process.exit(0);
    });
  });
});

// Start the server
server.listen(PORT, async () => {
  console.log('\n' + '='.repeat(60));
  console.log('🚀 RealTalk FLUX Proxy Server');
  console.log('='.repeat(60));
  console.log(`🌐 HTTP server running at http://localhost:${PORT}`);
  console.log(`🔌 WebSocket proxy running on ws://localhost:${PORT}`);
  console.log(`🔑 Using API key: ${DEEPGRAM_API_KEY.substring(0, 8)}...${DEEPGRAM_API_KEY.substring(DEEPGRAM_API_KEY.length - 4)}`);
  console.log(`✅ FLUX enabled: true (language-based activation)`);
  console.log('📝 Health check: http://localhost:' + PORT + '/health');

  // Run initial connectivity test
  console.log('\n🔬 Running startup connectivity test...');
  const startupTest = await testFluxApiConnectivity();

  if (startupTest.success) {
    console.log('✅ Startup connectivity test passed - FLUX API is reachable');
    console.log(`   Response time: ${startupTest.duration}ms`);
    console.log(`   HTTP Status: ${startupTest.statusCode}`);
  } else {
    console.log('❌ Startup connectivity test failed');
    console.log('   This may indicate issues with:');
    console.log('   - Internet connection');
    console.log('   - DNS resolution');
    console.log('   - Firewall blocking HTTPS/WSS connections');
    console.log('   - Deepgram API service availability');
  }

  console.log('\n' + '='.repeat(60));
  console.log('🎯 FLUX API Target: wss://api.deepgram.com/v2/listen');
  console.log('📊 Ready to accept client connections...');
  console.log('='.repeat(60) + '\n');
});

