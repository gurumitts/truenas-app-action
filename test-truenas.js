#!/usr/bin/env node

const { TrueNASClient } = require('./src/truenas-client');

/**
 * Validate command line inputs before connecting
 * @param {string} command - The command to execute
 * @param {string} appName - The app name
 * @throws {Error} If any input is invalid
 */
function validateInputs(command, appName) {
    // Validate command
    if (!command || typeof command !== 'string') {
        throw new Error('Command is required and must be a string');
    }
    
    const validCommands = ['status', 'stop', 'start', 'restart'];
    if (!validCommands.includes(command.toLowerCase())) {
        throw new Error(`Invalid command: ${command}. Available commands: ${validCommands.join(', ')}`);
    }
    
    // Validate app name
    if (!appName || typeof appName !== 'string') {
        throw new Error('App name is required and must be a string');
    }
    
    if (appName.trim().length === 0) {
        throw new Error('App name cannot be empty');
    }
}

// Command line testing
async function commandLineTest() {
    const args = process.argv.slice(2);
    
    // Get API key and URL from environment variables (already validated)
    const apiKey = process.env.TRUENAS_API_KEY;
    const url = process.env.TRUENAS_URL;
    
    // Parse command line arguments
    let command, appName;
    let rejectUnauthorized = true;
    
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--no-ssl-verify') {
            rejectUnauthorized = false;
        } else if (!command) {
            command = args[i];
        } else if (!appName) {
            appName = args[i];
        }
    }
    
    if (!command) {
        console.log('Usage: node test-truenas.js <command> <app_name> [--no-ssl-verify]');
        console.log('');
        console.log('Commands:');
        console.log('  status <app_name>       - Check app status');
        console.log('  stop <app_name>         - Stop an app');
        console.log('  start <app_name>        - Start an app');
        console.log('  restart <app_name>      - Restart an app (stop then start)');
        console.log('');
        console.log('Examples:');
        console.log('  node test-truenas.js status app-name');
        console.log('  node test-truenas.js restart app-name');
        console.log('  node test-truenas.js restart app-name --no-ssl-verify');
        process.exit(1);
    }
    
    // Validate command and app_name requirements
    if (!appName) {
        console.log(`Error: app_name is required for '${command}' command`);
        process.exit(1);
    }
    
    // Validate inputs before connecting
    validateInputs(command, appName);
    
    const client = new TrueNASClient(url, apiKey, { rejectUnauthorized });
    
    try {
        console.log('🔗 Connecting to TrueNAS...');
        await client.connect();
        
        switch (command) {
            case 'status':
                const status = await client.getAppStatus(appName);
                console.log(`App status: ${status}`);
                break;
            case 'stop':
                await client.stopApp(appName);
                break;
            case 'start':
                await client.startApp(appName);
                break;
            case 'restart':
                await client.restartApp(appName);
                break;
            default:
                console.error('Unknown command:', command);
                console.log('Available commands: status, stop, start, restart');
                process.exit(1);
        }
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        process.exit(1);
    } finally {
        client.disconnect();
    }
}

// Check for required environment variables first
const apiKey = process.env.TRUENAS_API_KEY;
const url = process.env.TRUENAS_URL;

if (!apiKey || !url) {
    console.log('Error: Required environment variables are missing');
    if (!url) {
        console.log('  TRUENAS_URL is required');
        console.log('  Set it with: export TRUENAS_URL="https://truenas.local"');
    }
    if (!apiKey) {
        console.log('  TRUENAS_API_KEY is required');
        console.log('  Set it with: export TRUENAS_API_KEY="your-api-key"');
    }
    console.log('');
    console.log('Usage: node test-truenas.js <command> <app_name> [--no-ssl-verify]');
    console.log('');
    console.log('Commands:');
    console.log('  status <app_name>       - Check app status');
    console.log('  stop <app_name>         - Stop an app');
    console.log('  start <app_name>        - Start an app');
    console.log('  restart <app_name>      - Restart an app (stop then start)');
    console.log('');
    console.log('Examples:');
    console.log('  # Set environment variables first:');
    console.log('  # export TRUENAS_URL="https://truenas.local"');
    console.log('  # export TRUENAS_API_KEY="your-api-key"');
    console.log('  # Then run:');
    console.log('  node test-truenas.js status app-name');
    console.log('  node test-truenas.js restart app-name');
    console.log('  node test-truenas.js restart app-name --no-ssl-verify');
    process.exit(1);
}

// Run the command line test
commandLineTest(); 