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
        default: 'invoicer'

jobs:
  restart-app:
    runs-on: ubuntu-latest
    steps:
      - name: Restart TrueNAS App
        uses: gurumitts/truenas-app-action@v1
        with:
          truenas-url: ${{ secrets.TRUENAS_URL }}
          api-key: ${{ secrets.TRUENAS_API_KEY }}
          app-name: ${{ github.event.inputs.app_name }}
          action: 'restart'
```

### Check App Status

```yaml
name: Check App Status
on:
  schedule:
    - cron: '0 */6 * * *'  # Every 6 hours

jobs:
  check-status:
    runs-on: ubuntu-latest
    steps:
      - name: Check App Status
        uses: gurumitts/truenas-app-action@v1
        with:
          truenas-url: ${{ secrets.TRUENAS_URL }}
          api-key: ${{ secrets.TRUENAS_API_KEY }}
          app-name: 'my-app'
          action: 'status'
```

### Manual App Control

```yaml
name: App Control
on:
  workflow_dispatch:
    inputs:
      app_name:
        description: 'App name'
        required: true
      action:
        description: 'Action to perform'
        required: true
        default: 'restart'
        type: choice
        options:
          - status
          - start
          - stop
          - restart

jobs:
  app-control:
    runs-on: ubuntu-latest
    steps:
      - name: Control App
        id: app-control
        uses: gurumitts/truenas-app-action@v1
        with:
          truenas-url: ${{ secrets.TRUENAS_URL }}
          api-key: ${{ secrets.TRUENAS_API_KEY }}
          app-name: ${{ github.event.inputs.app_name }}
          action: ${{ github.event.inputs.action }}
          disable-ssl-verify: 'false'

      - name: Show Results
        run: |
          echo "App Status: ${{ steps.app-control.outputs.app-status }}"
          echo "Success: ${{ steps.app-control.outputs.success }}"
```

## Inputs

| Input | Description | Required | Default |
|-------|-------------|----------|---------|
| `truenas-url` | TrueNAS server URL (e.g., https://truenas.local) | Yes | - |
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

### 1. Create API Key in TrueNAS

1. Log into your TrueNAS Scale web interface
2. Go to **Credentials** → **API Keys**
3. Click **Add** to create a new API key
4. Give it a name (e.g., "GitHub Actions")
5. Select the appropriate roles (APPS_WRITE for restart operations)
6. Copy the generated API key

### 2. Add Secrets to GitHub Repository

Go to your GitHub repository → **Settings** → **Secrets and variables** → **Actions** and add:

- `TRUENAS_URL`: Your TrueNAS server URL (e.g., `https://truenas.local`)
- `TRUENAS_API_KEY`: The API key you created

### 3. Use the Action

Add the action to your workflow as shown in the usage examples above.

## SSL Certificate Issues

If you encounter SSL certificate verification errors, you can disable SSL verification by setting `disable-ssl-verify: 'true'`:

```yaml
- name: Restart App
  uses: gurumitts/truenas-app-action@v1
  with:
    truenas-url: ${{ secrets.TRUENAS_URL }}
    api-key: ${{ secrets.TRUENAS_API_KEY }}
    app-name: 'my-app'
    action: 'restart'
    disable-ssl-verify: 'true'
```

**Note**: Only use this option if you're using self-signed certificates and understand the security implications.

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
4. **App Not Found**: Ensure the app name matches exactly what's shown in TrueNAS

### Debug Mode

To see detailed logs, you can temporarily add debug output to your workflow:

```yaml
- name: Restart App
  uses: gurumitts/truenas-app-action@v1
  env:
    ACTIONS_STEP_DEBUG: true
  with:
    # ... your inputs
```

## License

MIT License - see LICENSE file for details. 