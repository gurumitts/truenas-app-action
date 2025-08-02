const WebSocket = require('ws');
const https = require('https');

class TrueNASClient {
    constructor(url, apiKey, options = {}) {
        this.url = url.replace('http', 'ws') + '/websocket';
        this.apiKey = apiKey;
        this.ws = null;
        this.messageId = 0;
        this.options = {
            rejectUnauthorized: options.rejectUnauthorized !== false, // Default to true
            ...options
        };
    }

    async connect() {
        return new Promise((resolve, reject) => {
            const wsOptions = {};
            
            // Handle SSL certificate verification
            if (this.url.startsWith('wss://')) {
                wsOptions.agent = new https.Agent({
                    rejectUnauthorized: this.options.rejectUnauthorized
                });
            }
            
            this.ws = new WebSocket(this.url, wsOptions);
            
            this.ws.on('open', () => {
                console.log('✅ Connected to TrueNAS WebSocket');
                this.authenticate().then(resolve).catch(reject);
            });
            
            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
                if (error.message.includes('self-signed certificate') || error.message.includes('unable to verify')) {
                    console.log('💡 Tip: Try using disable-ssl-verify=true to disable SSL certificate verification');
                }
                reject(error);
            });
            
            this.ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
            });
        });
    }

    async authenticate() {
        // First, establish WebSocket connection
        const connectMessage = {
            msg: 'connect',
            version: '1',
            support: ['1']
        };
        
        return new Promise((resolve, reject) => {
            this.ws.send(JSON.stringify(connectMessage));
            
            this.ws.once('message', (data) => {
                const response = JSON.parse(data.toString());
                if (response.msg === 'connected') {
                    console.log('✅ WebSocket connected');
                    // Now authenticate with API key
                    this.authenticateWithAPI().then(resolve).catch(reject);
                } else {
                    reject(new Error('WebSocket connection failed'));
                }
            });
        });
    }

    async authenticateWithAPI() {
        // Try different authentication methods
        const authMessage = {
            id: ++this.messageId,
            msg: 'method',
            method: 'auth.login_with_api_key',
            params: [this.apiKey]
        };
        
        return new Promise((resolve, reject) => {
            this.ws.send(JSON.stringify(authMessage));
            
            this.ws.once('message', (data) => {
                const response = JSON.parse(data.toString());
                if (response.id === authMessage.id) {
                    if (response.error) {
                        // If API key method fails, try regular login
                        console.log('⚠️ API key auth failed, trying alternative method...');
                        this.tryAlternativeAuth().then(resolve).catch(reject);
                    } else {
                        console.log('✅ API authenticated successfully');
                        resolve();
                    }
                }
            });
        });
    }

    async tryAlternativeAuth() {
        // Try with username/password format (API key as password)
        const authMessage = {
            id: ++this.messageId,
            msg: 'method',
            method: 'auth.login',
            params: [{
                username: 'root',
                password: this.apiKey
            }]
        };
        
        return new Promise((resolve, reject) => {
            this.ws.send(JSON.stringify(authMessage));
            
            this.ws.once('message', (data) => {
                const response = JSON.parse(data.toString());
                if (response.id === authMessage.id) {
                    if (response.error) {
                        reject(new Error(`Authentication failed: ${response.error.reason}`));
                    } else {
                        console.log('✅ API authenticated successfully');
                        resolve();
                    }
                }
            });
        });
    }

    async callMethod(method, params = {}) {
        const messageId = ++this.messageId;
        const message = {
            id: messageId,
            msg: 'method',
            method: method,
            params: [params]
        };

        return new Promise((resolve, reject) => {
            this.ws.send(JSON.stringify(message));
            
            this.ws.once('message', (data) => {
                const response = JSON.parse(data.toString());
                
                if (response.id === messageId) {
                    if (response.error) {
                        reject(new Error(`Method call failed: ${response.error.message}`));
                    } else {
                        resolve(response.result);
                    }
                }
            });
        });
    }

    async getAppStatus(appName) {
        try {
            const app = await this.callMethod('app.get_instance', appName);
            return app.state;
        } catch (error) {
            console.error(`❌ Failed to get app status: ${error.message}`);
            return null;
        }
    }

    async waitForJob(jobId, timeout = 30000) {
        console.log(`⏳ Waiting for job ${jobId} to complete...`);
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                // Query job status using core.get_jobs with correct filter format
                const jobs = await this.callMethod('core.get_jobs', [[['id', '=', jobId]]]);
                
                if (jobs && jobs.length > 0) {
                    const jobStatus = jobs[0];
                    console.log(`📊 Job ${jobId} status: ${jobStatus.state}`);
                    
                    if (jobStatus.state === 'SUCCESS') {
                        console.log(`✅ Job ${jobId} completed successfully`);
                        return true;
                    } else if (jobStatus.state === 'FAILED') {
                        console.log(`❌ Job ${jobId} failed: ${jobStatus.error}`);
                        return false;
                    } else if (jobStatus.state === 'RUNNING') {
                        if (jobStatus.progress) {
                            console.log(`📈 Job ${jobId} progress: ${jobStatus.progress.percent}% - ${jobStatus.progress.description}`);
                        }
                    }
                }
                
                // Wait 2 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`❌ Error checking job status: ${error.message}`);
                return false;
            }
        }
        
        console.log(`⏰ Job ${jobId} timed out after ${timeout}ms`);
        return false;
    }

    async stopApp(appName) {
        console.log(`🛑 Stopping app: ${appName}`);
        try {
            const jobId = await this.callMethod('app.stop', appName);
            console.log(`✅ Stop command sent successfully (Job ID: ${jobId})`);
            
            // Wait for the job to complete (using fixed time for now)
            console.log(`⏳ Waiting 10 seconds for stop to complete...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            return jobId;
        } catch (error) {
            console.error(`❌ Failed to stop app: ${error.message}`);
            throw error;
        }
    }

    async startApp(appName) {
        console.log(`▶️ Starting app: ${appName}`);
        try {
            const jobId = await this.callMethod('app.start', appName);
            console.log(`✅ Start command sent successfully (Job ID: ${jobId})`);
            
            // Wait for the job to complete (using fixed time for now)
            console.log(`⏳ Waiting 10 seconds for start to complete...`);
            await new Promise(resolve => setTimeout(resolve, 10000));
            
            return jobId;
        } catch (error) {
            console.error(`❌ Failed to start app: ${error.message}`);
            throw error;
        }
    }

    async restartApp(appName) {
        console.log(`🔄 Restarting app: ${appName}`);
        
        // Check initial status
        const initialStatus = await this.getAppStatus(appName);
        console.log(`📊 Initial app status: ${initialStatus}`);
        
        // Stop the app
        await this.stopApp(appName);
        
        // Wait a bit for stop to complete
        console.log('⏳ Waiting for app to stop...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check if stopped
        const stoppedStatus = await this.getAppStatus(appName);
        console.log(`📊 App status after stop: ${stoppedStatus}`);
        
        // Start the app
        await this.startApp(appName);
        
        // Wait a bit for start to complete
        console.log('⏳ Waiting for app to start...');
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        // Check final status
        const finalStatus = await this.getAppStatus(appName);
        console.log(`📊 Final app status: ${finalStatus}`);
        
        return finalStatus;
    }

    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

module.exports = { TrueNASClient }; 