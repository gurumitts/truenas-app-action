const core = require('@actions/core');
const { TrueNASClient } = require('./truenas-client');

async function run() {
    try {
        // Get inputs
        const truenasUrl = core.getInput('truenas-url', { required: true });
        const apiKey = core.getInput('api-key', { required: true });
        const appName = core.getInput('app-name', { required: true });
        const action = core.getInput('action', { required: true });
        const disableSSLVerify = core.getInput('disable-ssl-verify') === 'true';

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