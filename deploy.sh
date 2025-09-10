#!/bin/bash

# =============================================================================
# Fafftime Project Deployment Script
# =============================================================================
# 
# This script deploys the built application to a remote server using rsync over SSH.
# It includes safety checks, error handling, and configuration validation.
#
# Usage:
#   ./deploy.sh [environment]
#   npm run deploy [environment]
#
# Environments: staging, production (default: staging)
#
# Configuration:
#   Set deployment settings in the DEPLOY_CONFIG section below or via environment variables
#
# =============================================================================

set -euo pipefail  # Exit on any error, undefined variable, or pipe failure

# =============================================================================
# CONFIGURATION
# =============================================================================

# Source configuration file if it exists
if [ -f "$(dirname "$0")/deploy.config.sh" ]; then
    source "$(dirname "$0")/deploy.config.sh"
fi

# Default configuration - override via environment variables or config file
DEPLOY_CONFIG_STAGING_HOST="${DEPLOY_STAGING_HOST:-your-staging-server.com}"
DEPLOY_CONFIG_STAGING_USER="${DEPLOY_STAGING_USER:-www-data}"
DEPLOY_CONFIG_STAGING_PATH="${DEPLOY_STAGING_PATH:-/var/www/fafftime-staging}"
DEPLOY_CONFIG_STAGING_PORT="${DEPLOY_STAGING_PORT:-22}"

DEPLOY_CONFIG_PRODUCTION_HOST="${DEPLOY_PRODUCTION_HOST:-your-production-server.com}"
DEPLOY_CONFIG_PRODUCTION_USER="${DEPLOY_PRODUCTION_USER:-www-data}"
DEPLOY_CONFIG_PRODUCTION_PATH="${DEPLOY_PRODUCTION_PATH:-/var/www/fafftime}"
DEPLOY_CONFIG_PRODUCTION_PORT="${DEPLOY_PRODUCTION_PORT:-22}"

# Build directory
BUILD_DIR="dist"

# Rsync options
RSYNC_OPTIONS=(
    --archive              # Preserve permissions, times, etc.
    --verbose             # Verbose output
    --compress            # Compress during transfer
    --delete              # Delete files not in source
    --exclude='.DS_Store' # Exclude macOS metadata
    --exclude='*.log'     # Exclude log files
    --exclude='node_modules/' # Exclude node_modules if accidentally in dist
)

# =============================================================================
# FUNCTIONS
# =============================================================================

print_usage() {
    echo "Usage: $0 [environment]"
    echo ""
    echo "Environments:"
    echo "  staging     Deploy to staging server (default)"
    echo "  production  Deploy to production server"
    echo ""
    echo "Configuration via environment variables:"
    echo "  DEPLOY_STAGING_HOST      - Staging server hostname"
    echo "  DEPLOY_STAGING_USER      - SSH user for staging"
    echo "  DEPLOY_STAGING_PATH      - Remote path for staging"
    echo "  DEPLOY_STAGING_PORT      - SSH port for staging (default: 22)"
    echo ""
    echo "  DEPLOY_PRODUCTION_HOST   - Production server hostname"
    echo "  DEPLOY_PRODUCTION_USER   - SSH user for production"
    echo "  DEPLOY_PRODUCTION_PATH   - Remote path for production"
    echo "  DEPLOY_PRODUCTION_PORT   - SSH port for production (default: 22)"
    echo ""
    echo "Example:"
    echo "  DEPLOY_STAGING_HOST=my-server.com DEPLOY_STAGING_USER=ubuntu ./deploy.sh staging"
}

log_info() {
    echo "ℹ️  $1"
}

log_success() {
    echo "✅ $1"
}

log_warning() {
    echo "⚠️  $1"
}

log_error() {
    echo "❌ $1" >&2
}

check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if rsync is available
    if ! command -v rsync &> /dev/null; then
        log_error "rsync is required but not installed. Please install rsync."
        exit 1
    fi
    
    # Check if ssh is available
    if ! command -v ssh &> /dev/null; then
        log_error "ssh is required but not installed. Please install SSH client."
        exit 1
    fi
    
    # Check if build directory exists
    if [ ! -d "$BUILD_DIR" ]; then
        log_error "Build directory '$BUILD_DIR' not found. Please run 'npm run build' first."
        exit 1
    fi
    
    # Check if build directory has content
    if [ -z "$(ls -A "$BUILD_DIR" 2>/dev/null)" ]; then
        log_error "Build directory '$BUILD_DIR' is empty. Please run 'npm run build' first."
        exit 1
    fi
    
    log_success "Prerequisites check passed"
}

validate_config() {
    local env="$1"
    
    log_info "Validating configuration for environment: $env"
    
    if [ "$env" = "staging" ]; then
        DEPLOY_HOST="$DEPLOY_CONFIG_STAGING_HOST"
        DEPLOY_USER="$DEPLOY_CONFIG_STAGING_USER"
        DEPLOY_PATH="$DEPLOY_CONFIG_STAGING_PATH"
        DEPLOY_PORT="$DEPLOY_CONFIG_STAGING_PORT"
    elif [ "$env" = "production" ]; then
        DEPLOY_HOST="$DEPLOY_CONFIG_PRODUCTION_HOST"
        DEPLOY_USER="$DEPLOY_CONFIG_PRODUCTION_USER"
        DEPLOY_PATH="$DEPLOY_CONFIG_PRODUCTION_PATH"
        DEPLOY_PORT="$DEPLOY_CONFIG_PRODUCTION_PORT"
    else
        log_error "Unknown environment: $env"
        print_usage
        exit 1
    fi
    
    # Check required configuration
    if [[ "$DEPLOY_HOST" =~ your-.*-server\.com ]]; then
        log_error "Please configure DEPLOY_${env^^}_HOST (currently: $DEPLOY_HOST)"
        exit 1
    fi
    
    if [ -z "$DEPLOY_HOST" ] || [ -z "$DEPLOY_USER" ] || [ -z "$DEPLOY_PATH" ]; then
        log_error "Missing required configuration for $env environment"
        echo "Required: HOST, USER, PATH"
        echo "Current values:"
        echo "  HOST: $DEPLOY_HOST"
        echo "  USER: $DEPLOY_USER" 
        echo "  PATH: $DEPLOY_PATH"
        echo "  PORT: $DEPLOY_PORT"
        exit 1
    fi
    
    log_success "Configuration validated"
}

test_ssh_connection() {
    log_info "Testing SSH connection to $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PORT..."
    
    if ! ssh -p "$DEPLOY_PORT" -o ConnectTimeout=10 -o BatchMode=yes "$DEPLOY_USER@$DEPLOY_HOST" "echo 'SSH connection test successful'" 2>/dev/null; then
        log_error "Failed to connect to remote server"
        echo ""
        echo "Please ensure:"
        echo "1. The server is reachable"
        echo "2. SSH key is configured for passwordless access"
        echo "3. The user has proper permissions"
        echo ""
        echo "Test connection manually:"
        echo "  ssh -p $DEPLOY_PORT $DEPLOY_USER@$DEPLOY_HOST"
        exit 1
    fi
    
    log_success "SSH connection test passed"
}

create_remote_directory() {
    log_info "Ensuring remote directory exists: $DEPLOY_PATH"
    
    if ! ssh -p "$DEPLOY_PORT" "$DEPLOY_USER@$DEPLOY_HOST" "mkdir -p '$DEPLOY_PATH'"; then
        log_error "Failed to create remote directory: $DEPLOY_PATH"
        exit 1
    fi
    
    log_success "Remote directory ready"
}

perform_deployment() {
    local env="$1"
    
    log_info "Starting deployment to $env environment..."
    echo ""
    echo "Source:      $BUILD_DIR/"
    echo "Destination: $DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH"
    echo "Port:        $DEPLOY_PORT"
    echo ""
    
    # Show what files will be transferred
    log_info "Files to be deployed:"
    find "$BUILD_DIR" -type f | head -10
    local file_count=$(find "$BUILD_DIR" -type f | wc -l)
    if [ "$file_count" -gt 10 ]; then
        echo "... and $(($file_count - 10)) more files"
    fi
    echo ""
    
    # Confirm deployment for production
    if [ "$env" = "production" ]; then
        log_warning "You are about to deploy to PRODUCTION!"
        echo -n "Type 'yes' to continue: "
        read -r confirmation
        if [ "$confirmation" != "yes" ]; then
            log_info "Deployment cancelled"
            exit 0
        fi
    fi
    
    # Perform the rsync
    log_info "Syncing files..."
    if rsync "${RSYNC_OPTIONS[@]}" \
        -e "ssh -p $DEPLOY_PORT" \
        "$BUILD_DIR/" \
        "$DEPLOY_USER@$DEPLOY_HOST:$DEPLOY_PATH"; then
        
        log_success "Deployment completed successfully!"
        echo ""
        echo "Your application has been deployed to:"
        echo "  Environment: $env"
        echo "  Server:      $DEPLOY_HOST"
        echo "  Path:        $DEPLOY_PATH"
        
    else
        log_error "Deployment failed!"
        exit 1
    fi
}

# =============================================================================
# MAIN SCRIPT
# =============================================================================

main() {
    # Parse arguments
    local environment="${1:-staging}"
    
    if [ "$environment" = "-h" ] || [ "$environment" = "--help" ]; then
        print_usage
        exit 0
    fi
    
    echo "🚀 Fafftime Deployment Script"
    echo "=============================="
    echo ""
    
    # Run deployment steps
    check_prerequisites
    validate_config "$environment"
    test_ssh_connection
    create_remote_directory
    perform_deployment "$environment"
    
    echo ""
    log_success "All done! 🎉"
}

# Run main function with all arguments
main "$@"