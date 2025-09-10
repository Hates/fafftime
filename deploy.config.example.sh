#!/bin/bash

# =============================================================================
# Deployment Configuration Example
# =============================================================================
#
# Copy this file to deploy.config.sh and customize your deployment settings
# The deploy.sh script will source this file if it exists
#
# Usage:
#   1. Copy this file: cp deploy.config.example.sh deploy.config.sh  
#   2. Edit deploy.config.sh with your server details
#   3. Run deployment: npm run deploy
#
# Note: deploy.config.sh should NOT be committed to version control
#       (it's already in .gitignore)
#
# =============================================================================

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

# =============================================================================
# Alternative: Environment-specific configuration
# =============================================================================

# You can also create separate config files:
# - deploy.staging.sh (for staging-specific settings)
# - deploy.production.sh (for production-specific settings)
#
# Then source them based on the environment:
# if [ "$DEPLOY_ENV" = "staging" ]; then
#     source "$(dirname "$0")/deploy.staging.sh"
# elif [ "$DEPLOY_ENV" = "production" ]; then
#     source "$(dirname "$0")/deploy.production.sh"  
# fi

# =============================================================================
# SSH Key Setup
# =============================================================================

# For passwordless deployment, ensure your SSH key is configured:
#
# 1. Generate SSH key (if you don't have one):
#    ssh-keygen -t rsa -b 4096 -C "your-email@example.com"
#
# 2. Copy public key to server:
#    ssh-copy-id -p $DEPLOY_STAGING_PORT $DEPLOY_STAGING_USER@$DEPLOY_STAGING_HOST
#
# 3. Test connection:
#    ssh -p $DEPLOY_STAGING_PORT $DEPLOY_STAGING_USER@$DEPLOY_STAGING_HOST
#
# 4. Ensure the web server user has write permissions:
#    sudo chown -R $DEPLOY_STAGING_USER:$DEPLOY_STAGING_USER $DEPLOY_STAGING_PATH
#    sudo chmod -R 755 $DEPLOY_STAGING_PATH

# =============================================================================
# Server Directory Structure
# =============================================================================

# Typical web server setup:
# 
# /var/www/fafftime/               <- DEPLOY_PATH points here
# ├── index.html                   <- Entry point
# ├── bundle.js                    <- JavaScript bundle
# ├── fonts/                       <- Font assets
# │   └── PlaywriteAUSA-Regular.ttf
# ├── screenshot.png               <- Images
# ├── GreatBritishEscapades2025.fit <- Example data
# └── [other build files]
#
# Nginx configuration example:
# server {
#     listen 80;
#     server_name fafftime.com;
#     root /var/www/fafftime;
#     index index.html;
#     
#     location / {
#         try_files $uri $uri/ =404;
#     }
# }