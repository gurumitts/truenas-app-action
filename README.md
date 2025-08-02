# TrueNAS App Restart GitHub Action

A GitHub Action to restart TrueNAS Scale applications via WebSocket API.

## Features

- ✅ Restart TrueNAS Scale applications
- ✅ Check application status
- ✅ Start/Stop applications individually

## Usage

### Basic Restart

```yaml
name: Restart TrueNAS App
on:
  workflow_dispatch:
    inputs:
      app_name:
        description: 'App name to restart'
        required: true
        default: 'app-name'

jobs:
  restart-app:
    runs-on: ubuntu-latest
    steps:
      - name: Restart TrueNAS App
        uses: gurumitts/truenas-app-action@v3  #use recent release
        with:
          truenas-url: ${{ secrets.TRUENAS_URL }}
          api-key: ${{ secrets.TRUENAS_API_KEY }}
          app-name: ${{ github.event.inputs.app_name }}
          action: 'restart'
```


## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `truenas-url` | TrueNAS server URL  | Yes | - |
| `api-key` | TrueNAS API key | Yes | - |
| `app-name` | Name of the application to control | Yes | - |
| `action` | Action to perform (status, stop, start, restart) | Yes | restart |
| `disable-ssl-verify` | Disable SSL certificate verification | No | false |

## Outputs

| Output | Description |
|--------|-------------|
| `app-status` | Final status of the application |
| `success` | Whether the action was successful (true/false) |

## Setup

### 1. Create API Key in TrueNAS: 
https://www.truenas.com/docs/scale/scaletutorials/toptoolbar/managingapikeys/

### 2. Add Secrets to GitHub Repository
TRUENAS_URL: Your TrueNAS server URL

TRUENAS_API_KEY: The API key you created

### 3. Use the Action

Add the action to your workflow as shown in the usage examples above.

## Development

### Local Testing

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set environment variables:
   ```bash
   export TRUENAS_URL="https://your-truenas-server"
   export TRUENAS_API_KEY="your-api-key"
   ```

3. Test the action:
   ```bash
   Use the test script directly with your app name:
   node test-truenas.js status your-app-name
   node test-truenas.js restart your-app-name
   ```

### Building

The action uses `@vercel/ncc` to bundle all dependencies into a single file:

```bash
npm run build
```

This creates the `dist/` directory with the bundled action.

## Troubleshooting

### Common Issues

1. **Connection Failed**: Check your TrueNAS URL and ensure it's accessible from GitHub Actions runners
2. **Authentication Failed**: Verify your API key has the correct permissions (APPS_WRITE role)
3. **SSL Certificate Errors**: Use `disable-ssl-verify: 'true'` for self-signed certificates
**Note**: Only use this option if you're using self-signed certificates and understand the security implications.
4. **App Not Found**: Ensure the app name matches exactly what's shown in TrueNAS

### Debug Mode

To see detailed logs, you can temporarily add debug output to your workflow:

```yaml
- name: Restart App
  uses: gurumitts/truenas-app-action
  env:
    ACTIONS_STEP_DEBUG: true
  with:
    # ... your inputs
```

## License

MIT License - see LICENSE file for details. 