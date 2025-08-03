const core = require('@actions/core');
const { TrueNASClient } = require('./truenas-client');

/**
 * Validate all input parameters before attempting connection
 * @param {string} truenasUrl - TrueNAS server URL
 * @param {string} apiKey - TrueNAS API key
 * @param {string} appName - Application name
 * @param {string} action - Action to perform
 * @throws {Error} If any input is invalid
 */
function validateInputs(truenasUrl, apiKey, appName, action) {
    // Validate TrueNAS URL
    if (!truenasUrl || typeof truenasUrl !== 'string') {
        throw new Error('truenas-url is required and must be a string');
    }
    
    if (!truenasUrl.match(/^https?:\/\/.+/)) {
        throw new Error('truenas-url must be a valid HTTP/HTTPS URL (e.g., https://truenas.local)');
    }
    
    // Validate API key
    if (!apiKey || typeof apiKey !== 'string') {
        throw new Error('api-key is required and must be a string');
    }
    
    if (apiKey.length < 10) {
        throw new Error('api-key appears to be too short. Please check your TrueNAS API key');
    }
    
    // Validate app name
    if (!appName || typeof appName !== 'string') {
        throw new Error('app-name is required and must be a string');
    }
    
    if (appName.trim().length === 0) {
        throw new Error('app-name cannot be empty');
    }
    
    // Validate action
    if (!action || typeof action !== 'string') {
        throw new Error('action is required and must be a string');
    }
    
    const validActions = ['status', 'stop', 'start', 'restart'];
    if (!validActions.includes(action.toLowerCase())) {
        throw new Error(`Invalid action: ${action}. Supported actions: ${validActions.join(', ')}`);
    }
}

async function run() {
    try {
        // Get inputs
        const truenasUrl = core.getInput('truenas-url', { required: true });
        const apiKey = core.getInput('api-key', { required: true });
        const appName = core.getInput('app-name', { required: true });
        const action = core.getInput('action', { required: true });
        const disableSSLVerify = core.getInput('disable-ssl-verify') === 'true';

        // Validate inputs before connecting
        validateInputs(truenasUrl, apiKey, appName, action);

        core.info(`🚀 Starting TrueNAS App ${action} for: ${appName}`);
        core.info(`🔗 Connecting to: ${truenasUrl}`);

        // Create client
        const client = new TrueNASClient(truenasUrl, apiKey, { 
            rejectUnauthorized: !disableSSLVerify 
        });

        let result = null;
        let success = false;

        try {
            // Connect to TrueNAS
            core.info('🔗 Connecting to TrueNAS...');
            await client.connect();

            // Execute the requested action
            switch (action) {
                case 'status':
                    core.info(`📊 Getting status for app: ${appName}`);
                    result = await client.getAppStatus(appName);
                    core.info(`App status: ${result}`);
                    success = true;
                    break;

                case 'stop':
                    core.info(`🛑 Stopping app: ${appName}`);
                    await client.stopApp(appName);
                    core.info('✅ App stop completed');
                    success = true;
                    break;

                case 'start':
                    core.info(`▶️ Starting app: ${appName}`);
                    await client.startApp(appName);
                    core.info('✅ App start completed');
                    success = true;
                    break;

                case 'restart':
                    core.info(`🔄 Restarting app: ${appName}`);
                    result = await client.restartApp(appName);
                    core.info(`✅ App restart completed. Final status: ${result}`);
                    success = true;
                    break;

                default:
                    throw new Error(`Unknown action: ${action}. Supported actions: status, stop, start, restart`);
            }

        } finally {
            // Always disconnect
            client.disconnect();
        }

        // Set outputs
        core.setOutput('app-status', result || 'unknown');
        core.setOutput('success', success.toString());

        if (success) {
            core.info('✅ Action completed successfully');
        } else {
            core.setFailed('❌ Action failed');
        }

    } catch (error) {
        core.setFailed(`❌ Action failed: ${error.message}`);
    }
}

// Run the action
run(); 