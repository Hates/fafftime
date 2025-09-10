# Deployment Guide

This document explains how to deploy the Fafftime application to remote servers using the included deployment script.

## Quick Start

1. **Configure your deployment settings:**
   ```bash
   cp deploy.config.example.sh deploy.config.sh
   # Edit deploy.config.sh with your server details
   ```

2. **Deploy to staging:**
   ```bash
   npm run build:deploy
   # or
   npm run deploy:staging
   ```

3. **Deploy to production:**
   ```bash
   npm run build:deploy:production
   # or
   npm run deploy:production
   ```

## Available Commands

| Command | Description |
|---------|-------------|
| `npm run deploy` | Deploy to staging (default) |
| `npm run deploy:staging` | Deploy to staging environment |
| `npm run deploy:production` | Deploy to production environment |
| `npm run build:deploy` | Build and deploy to staging |
| `npm run build:deploy:production` | Build and deploy to production |
| `./deploy.sh staging` | Direct script usage (staging) |
| `./deploy.sh production` | Direct script usage (production) |

## Configuration

### Method 1: Configuration File (Recommended)

1. Copy the example configuration:
   ```bash
   cp deploy.config.example.sh deploy.config.sh
   ```

2. Edit `deploy.config.sh` with your server details:
   ```bash
   # Staging Environment
   export DEPLOY_STAGING_HOST="staging.example.com"
   export DEPLOY_STAGING_USER="www-data"
   export DEPLOY_STAGING_PATH="/var/www/fafftime-staging"
   export DEPLOY_STAGING_PORT="22"

   # Production Environment  
   export DEPLOY_PRODUCTION_HOST="fafftime.com"
   export DEPLOY_PRODUCTION_USER="www-data"
   export DEPLOY_PRODUCTION_PATH="/var/www/fafftime"
   export DEPLOY_PRODUCTION_PORT="22"
   ```

### Method 2: Environment Variables

Set environment variables before running the deployment:

```bash
export DEPLOY_STAGING_HOST="your-server.com"
export DEPLOY_STAGING_USER="ubuntu"
export DEPLOY_STAGING_PATH="/var/www/html"
npm run deploy:staging
```

## Prerequisites

### Local Requirements

- `rsync` (usually pre-installed on macOS/Linux)
- `ssh` client
- Built application (`npm run build`)

### Server Requirements

- SSH server running
- Web server (nginx, Apache, etc.)
- Proper directory permissions
- SSH key-based authentication (recommended)

## SSH Setup

### 1. Generate SSH Key (if needed)

```bash
ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
```

### 2. Copy Public Key to Server

```bash
ssh-copy-id -p 22 www-data@your-server.com
```

### 3. Test Connection

```bash
ssh -p 22 www-data@your-server.com
```

### 4. Set Proper Permissions

On the server, ensure the web directory has proper permissions:

```bash
sudo chown -R www-data:www-data /var/www/fafftime
sudo chmod -R 755 /var/www/fafftime
```

## Web Server Configuration

### Nginx Example

```nginx
server {
    listen 80;
    server_name fafftime.com;
    root /var/www/fafftime;
    index index.html;
    
    # Enable gzip compression
    gzip on;
    gzip_types
        text/plain
        text/css
        text/js
        text/xml
        application/javascript
        application/json
        application/xml+rss;
    
    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
    
    # Main application
    location / {
        try_files $uri $uri/ =404;
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
    }
    
    # Handle .fit files (binary data)
    location ~* \.fit$ {
        add_header Content-Type "application/octet-stream";
    }
}
```

### Apache Example

```apache
<VirtualHost *:80>
    ServerName fafftime.com
    DocumentRoot /var/www/fafftime
    
    <Directory /var/www/fafftime>
        AllowOverride All
        Require all granted
    </Directory>
    
    # Enable compression
    LoadModule deflate_module modules/mod_deflate.so
    <Location />
        SetOutputFilter DEFLATE
        SetEnvIfNoCase Request_URI \
            \.(?:gif|jpe?g|png|ico)$ no-gzip dont-vary
        SetEnvIfNoCase Request_URI \
            \.(?:exe|t?gz|zip|bz2|sit|rar)$ no-gzip dont-vary
    </Location>
    
    # Cache static assets
    <LocationMatch "\.(css|js|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$">
        ExpiresActive On
        ExpiresDefault "access plus 1 year"
    </LocationMatch>
</VirtualHost>
```

## Security Considerations

1. **SSH Keys**: Use SSH key authentication instead of passwords
2. **File Permissions**: Ensure web server user owns the deployed files
3. **Firewall**: Only expose necessary ports (80, 443, SSH)
4. **HTTPS**: Configure SSL/TLS certificates for production
5. **Configuration Files**: Never commit `deploy.config.sh` to version control

## Deployment Process

The deployment script performs these steps:

1. **Prerequisites Check**: Verifies rsync, SSH, and build directory
2. **Configuration Validation**: Ensures all required settings are present
3. **SSH Connection Test**: Tests connectivity to remote server
4. **Directory Creation**: Creates remote directory if needed
5. **File Sync**: Uses rsync to transfer files with these options:
   - `--archive`: Preserves permissions, timestamps, etc.
   - `--verbose`: Shows detailed output
   - `--compress`: Compresses data during transfer
   - `--delete`: Removes files not in source (clean deployment)
6. **Confirmation**: Requires "yes" confirmation for production deployments

## Troubleshooting

### Connection Issues

```bash
# Test SSH connection manually
ssh -p 22 www-data@your-server.com

# Check SSH key
ssh-add -l

# Verbose SSH connection
ssh -v -p 22 www-data@your-server.com
```

### Permission Issues

```bash
# Fix ownership on server
sudo chown -R www-data:www-data /var/www/fafftime

# Fix permissions on server  
sudo chmod -R 755 /var/www/fafftime
```

### Build Issues

```bash
# Ensure build directory exists and has content
npm run build
ls -la dist/

# Check build output
npm run build 2>&1 | tee build.log
```

### Rsync Issues

```bash
# Test rsync manually (dry run)
rsync --dry-run --archive --verbose \
  -e "ssh -p 22" \
  dist/ \
  www-data@your-server.com:/var/www/fafftime

# Check rsync version
rsync --version
```

## Advanced Configuration

### Environment-Specific Config Files

You can create separate configuration files:

- `deploy.staging.sh` - Staging-only settings
- `deploy.production.sh` - Production-only settings

Then modify your `deploy.config.sh`:

```bash
if [ "$DEPLOY_ENV" = "staging" ]; then
    source "$(dirname "$0")/deploy.staging.sh"
elif [ "$DEPLOY_ENV" = "production" ]; then
    source "$(dirname "$0")/deploy.production.sh"
fi
```

### Custom Rsync Options

Modify the `RSYNC_OPTIONS` array in `deploy.sh`:

```bash
RSYNC_OPTIONS=(
    --archive
    --verbose
    --compress
    --delete
    --exclude='.DS_Store'
    --exclude='*.log'
    --progress              # Show progress
    --stats                 # Show statistics
    --human-readable        # Human readable sizes
)
```

### Post-Deployment Hooks

Add custom commands after deployment by modifying the `perform_deployment` function:

```bash
# At the end of perform_deployment function
ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" "
    cd '$DEPLOY_PATH' && \
    sudo systemctl reload nginx && \
    echo 'Web server reloaded'
"
```

## Monitoring and Logs

### Server-Side Monitoring

```bash
# Monitor web server access logs
tail -f /var/log/nginx/access.log

# Monitor web server error logs  
tail -f /var/log/nginx/error.log

# Check disk usage
df -h /var/www/fafftime
```

### Application Monitoring

Consider setting up:

- **Uptime monitoring** (Pingdom, UptimeRobot)
- **Error tracking** (Sentry, Rollbar)
- **Analytics** (Google Analytics, Plausible)
- **Performance monitoring** (PageSpeed Insights)

## Backup Strategy

Before deploying, consider backing up your current deployment:

```bash
# On the server
sudo cp -r /var/www/fafftime /var/www/fafftime.backup.$(date +%Y%m%d-%H%M%S)

# Or create a deployment script with automatic backup
ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" "
    if [ -d '$DEPLOY_PATH' ]; then
        cp -r '$DEPLOY_PATH' '${DEPLOY_PATH}.backup.$(date +%Y%m%d-%H%M%S)'
    fi
"
```