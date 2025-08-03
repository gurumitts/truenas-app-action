const WebSocket = require('ws');
const https = require('https');

/**
 * TrueNAS WebSocket client for managing applications
 * @class TrueNASClient
 */
class TrueNASClient {
    /**
     * Create a new TrueNAS client
     * @param {string} url - TrueNAS server URL (e.g., 'https://truenas.local')
     * @param {string} apiKey - TrueNAS API key with APPS_WRITE permissions
     * @param {Object} options - Client options
     * @param {boolean} [options.noSslVerify=false] - Whether to disable SSL certificate verification
     */
    constructor(url, apiKey, options = {}) {
        // Validate URL format
        if (!url || typeof url !== 'string') {
            throw new Error('TrueNAS URL is required and must be a string');
        }
        
        if (!url.match(/^https?:\/\/.+/)) {
            throw new Error('TrueNAS URL must be a valid HTTP/HTTPS URL (e.g., https://truenas.local)');
        }
        
        // Validate API key
        if (!apiKey || typeof apiKey !== 'string') {
            throw new Error('API key is required and must be a string');
        }
        
        if (apiKey.length < 10) {
            throw new Error('API key appears to be too short. Please check your TrueNAS API key');
        }
        
        // Validate options
        if (options && typeof options !== 'object') {
            throw new Error('Options must be an object');
        }
        
        this.url = url.replace('http', 'ws') + '/websocket';
        this.apiKey = apiKey;
        this.ws = null;
        this.messageId = 0;
        this.options = {
            noSslVerify: options.noSslVerify === true, // Default to false
            ...options
        };
    }

    /**
     * Connect to TrueNAS WebSocket and authenticate
     * @returns {Promise<void>} Resolves when connected and authenticated
     * @throws {Error} If connection or authentication fails
     */
    async connect() {
        return new Promise((resolve, reject) => {
            const wsOptions = {};
            
            // Handle SSL certificate verification
            if (this.url.startsWith('wss://')) {
                wsOptions.agent = new https.Agent({
                    rejectUnauthorized: !this.options.noSslVerify
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
                    console.log('💡 Tip: Try using no-ssl-verify=true to disable SSL certificate verification');
                } else if (error.message.includes('ECONNREFUSED')) {
                    console.log('💡 Tip: Check if TrueNAS is running and the URL is correct');
                } else if (error.message.includes('ENOTFOUND')) {
                    console.log('💡 Tip: Check if the TrueNAS URL is correct and accessible');
                } else if (error.message.includes('timeout')) {
                    console.log('💡 Tip: Check network connectivity and TrueNAS server status');
                }
                reject(error);
            });
            
            this.ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
            });
        });
    }

    /**
     * Establish WebSocket connection to TrueNAS
     * @returns {Promise<void>} Resolves when WebSocket is connected
     * @throws {Error} If WebSocket connection fails
     * @private
     */
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

    /**
     * Authenticate with TrueNAS using API key
     * @returns {Promise<void>} Resolves when authentication succeeds
     * @throws {Error} If authentication fails
     * @private
     */
    async authenticateWithAPI() {
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
                        const errorReason = response.error.reason || 'Unknown error';
                        if (errorReason.includes('invalid') || errorReason.includes('wrong')) {
                            reject(new Error(`Authentication failed: Invalid API key. Please check your TrueNAS API key and ensure it has the required permissions (APPS_WRITE role)`));
                        } else if (errorReason.includes('expired')) {
                            reject(new Error(`Authentication failed: API key has expired. Please generate a new API key in TrueNAS`));
                        } else {
                            reject(new Error(`Authentication failed: ${errorReason}`));
                        }
                    } else {
                        console.log('✅ API authenticated successfully');
                        resolve();
                    }
                }
            });
        });
    }

    /**
     * Call a TrueNAS WebSocket method
     * @param {string} method - The method name to call
     * @param {Object} [params={}] - Parameters to pass to the method
     * @returns {Promise<any>} The result of the method call
     * @throws {Error} If the method call fails
     * @private
     */
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

    /**
     * Get the current status of an application
     * @param {string} appName - Name of the application
     * @returns {Promise<string|null>} Application status (RUNNING, STOPPED, etc.) or null if not found
     */
    async getAppStatus(appName) {
        // Validate app name
        if (!appName || typeof appName !== 'string') {
            throw new Error('App name is required and must be a string');
        }
        
        if (appName.trim().length === 0) {
            throw new Error('App name cannot be empty');
        }
        
        try {
            const app = await this.callMethod('app.get_instance', appName);
            return app.state;
        } catch (error) {
            if (error.message.includes('not found')) {
                console.error(`❌ App '${appName}' not found. Please check the app name in TrueNAS`);
            } else if (error.message.includes('permission')) {
                console.error(`❌ Permission denied. Please ensure your API key has APPS_READ permissions`);
            } else {
                console.error(`❌ Failed to get app status: ${error.message}`);
            }
            return null;
        }
    }

    /**
     * Wait for a TrueNAS job to complete
     * @param {number} jobId - The job ID to monitor
     * @param {number} [timeout=30000] - Timeout in milliseconds (30 seconds)
     * @returns {Promise<boolean>} True if job succeeded, false if failed or timed out
     */
    async waitForJob(jobId, timeout = 30000) {
        // Validate job ID
        if (!jobId || typeof jobId !== 'number' || jobId <= 0) {
            throw new Error('Job ID must be a positive number');
        }
        
        // Validate timeout
        if (timeout && (typeof timeout !== 'number' || timeout <= 0)) {
            throw new Error('Timeout must be a positive number');
        }
        
        console.log(`⏳ Waiting for job ${jobId} to complete...`);
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            try {
                const allJobs = await this.callMethod('core.get_jobs', []);
                const jobStatus = allJobs.find(job => job.id === jobId);
                                                       
                if (jobStatus) {
                    console.log(`📊 Job ${jobId} status: ${jobStatus.state}`);
                    
                    if (jobStatus.state === 'SUCCESS') {
                        console.log(`✅ Job ${jobId} completed successfully`);
                        return true;
                    } else if (jobStatus.state === 'FAILED') {
                        console.log(`❌ Job ${jobId} failed: ${jobStatus.error || 'Unknown error'}`);
                        return false;
                    } else if (jobStatus.state === 'RUNNING') {
                        if (jobStatus.progress) {
                            console.log(`📈 Job ${jobId} progress: ${jobStatus.progress.percent}% - ${jobStatus.progress.description}`);
                        }
                    }
                } else {
                    console.log(`⏳ Job ${jobId} status unknown, waiting...`);
                }
                
                // Wait 2 seconds before checking again
                await new Promise(resolve => setTimeout(resolve, 2000));
            } catch (error) {
                console.error(`❌ Error checking job status: ${error.message}`);
                // Continue trying on error
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }
        
        console.log(`⏰ Job ${jobId} timed out after ${timeout}ms`);
        return false;
    }

    /**
     * Stop an application
     * @param {string} appName - Name of the application to stop
     * @returns {Promise<number>} The job ID of the stop operation
     * @throws {Error} If the stop operation fails or times out
     */
    async stopApp(appName) {
        // Validate app name
        if (!appName || typeof appName !== 'string') {
            throw new Error('App name is required and must be a string');
        }
        
        if (appName.trim().length === 0) {
            throw new Error('App name cannot be empty');
        }
        
        // Check if app exists first
        console.log(`🔍 Checking if app '${appName}' exists...`);
        const appStatus = await this.getAppStatus(appName);
        if (appStatus === null) {
            throw new Error(`App '${appName}' not found. Please check the app name in TrueNAS`);
        }
        
        console.log(`🛑 Stopping app: ${appName} (current status: ${appStatus})`);
        try {
            const jobId = await this.callMethod('app.stop', appName);
            console.log(`✅ Stop command sent successfully (Job ID: ${jobId})`);
            
            // Wait for the job to complete
            const success = await this.waitForJob(jobId);
            if (!success) {
                throw new Error('Stop operation failed or timed out. The app may still be running.');
            }
            
            return jobId;
        } catch (error) {
            if (error.message.includes('not found')) {
                throw new Error(`App '${appName}' not found. Please check the app name in TrueNAS`);
            } else if (error.message.includes('permission')) {
                throw new Error(`Permission denied. Please ensure your API key has APPS_WRITE permissions`);
            } else if (error.message.includes('already stopped')) {
                console.log(`ℹ️ App '${appName}' is already stopped`);
                return null;
            } else {
                console.error(`❌ Failed to stop app: ${error.message}`);
                throw error;
            }
        }
    }

    /**
     * Start an application
     * @param {string} appName - Name of the application to start
     * @returns {Promise<number>} The job ID of the start operation
     * @throws {Error} If the start operation fails or times out
     */
    async startApp(appName) {
        // Validate app name
        if (!appName || typeof appName !== 'string') {
            throw new Error('App name is required and must be a string');
        }
        
        if (appName.trim().length === 0) {
            throw new Error('App name cannot be empty');
        }
        
        // Check if app exists first
        console.log(`🔍 Checking if app '${appName}' exists...`);
        const appStatus = await this.getAppStatus(appName);
        if (appStatus === null) {
            throw new Error(`App '${appName}' not found. Please check the app name in TrueNAS`);
        }
        
        console.log(`▶️ Starting app: ${appName} (current status: ${appStatus})`);
        try {
            const jobId = await this.callMethod('app.start', appName);
            console.log(`✅ Start command sent successfully (Job ID: ${jobId})`);
            
            // Wait for the job to complete
            const success = await this.waitForJob(jobId);
            if (!success) {
                throw new Error('Start operation failed or timed out. The app may not have started properly.');
            }
            
            return jobId;
        } catch (error) {
            if (error.message.includes('not found')) {
                throw new Error(`App '${appName}' not found. Please check the app name in TrueNAS`);
            } else if (error.message.includes('permission')) {
                throw new Error(`Permission denied. Please ensure your API key has APPS_WRITE permissions`);
            } else if (error.message.includes('already running')) {
                console.log(`ℹ️ App '${appName}' is already running`);
                return null;
            } else {
                console.error(`❌ Failed to start app: ${error.message}`);
                throw error;
            }
        }
    }

    /**
     * Restart an application (stop then start)
     * @param {string} appName - Name of the application to restart
     * @returns {Promise<string>} The final status of the application after restart
     * @throws {Error} If the restart operation fails
     */
    async restartApp(appName) {
        // Validate app name
        if (!appName || typeof appName !== 'string') {
            throw new Error('App name is required and must be a string');
        }
        
        if (appName.trim().length === 0) {
            throw new Error('App name cannot be empty');
        }
        
        // Check if app exists first
        console.log(`🔍 Checking if app '${appName}' exists...`);
        const initialStatus = await this.getAppStatus(appName);
        if (initialStatus === null) {
            throw new Error(`App '${appName}' not found. Please check the app name in TrueNAS`);
        }
        
        console.log(`🔄 Restarting app: ${appName} (current status: ${initialStatus})`);
        
        // Stop the app
        await this.stopApp(appName);
        
        // Check if stopped
        const stoppedStatus = await this.getAppStatus(appName);
        console.log(`📊 App status after stop: ${stoppedStatus}`);
        
        // Start the app
        await this.startApp(appName);
                
        // Check final status
        const finalStatus = await this.getAppStatus(appName);
        console.log(`📊 Final app status: ${finalStatus}`);
        
        return finalStatus;
    }

    /**
     * Disconnect from TrueNAS WebSocket
     */
    disconnect() {
        if (this.ws) {
            this.ws.close();
        }
    }
}

module.exports = { TrueNASClient }; 