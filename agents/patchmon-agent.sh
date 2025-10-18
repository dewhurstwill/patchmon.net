#!/bin/bash

# PatchMon Agent Migration Script v1.2.9
# This script migrates from legacy bash agent (v1.2.8) to Go agent (v1.3.0+)
# It acts as an intermediary during the upgrade process

# Configuration
PATCHMON_SERVER="${PATCHMON_SERVER:-http://localhost:3001}"
API_VERSION="v1"
AGENT_VERSION="1.2.9"
CREDENTIALS_FILE="/etc/patchmon/credentials"
LOG_FILE="/var/log/patchmon-agent.log"

# This placeholder will be dynamically replaced by the server when serving this
# script based on the "ignore SSL self-signed" setting. If set to -k, curl will
# ignore certificate validation. Otherwise, it will be empty for secure default.
CURL_FLAGS=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    if [[ -w "$(dirname "$LOG_FILE")" ]] 2>/dev/null; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] MIGRATION: $1" >> "$LOG_FILE" 2>/dev/null
    fi
}

# Error handling
error() {
    echo -e "${RED}ERROR: $1${NC}" >&2
    log "ERROR: $1"
    exit 1
}

# Info logging
info() {
    echo -e "${BLUE}ℹ️  $1${NC}" >&2
    log "INFO: $1"
}

# Success logging
success() {
    echo -e "${GREEN}✅ $1${NC}" >&2
    log "SUCCESS: $1"
}

# Warning logging
warning() {
    echo -e "${YELLOW}⚠️  $1${NC}" >&2
    log "WARNING: $1"
}

# Check if running as root
check_root() {
    if [[ $EUID -ne 0 ]]; then
        error "This migration script must be run as root"
    fi
}

# Load API credentials from legacy format
load_legacy_credentials() {
    if [[ ! -f "$CREDENTIALS_FILE" ]]; then
        error "Legacy credentials file not found at $CREDENTIALS_FILE"
    fi
    
    source "$CREDENTIALS_FILE"
    
    if [[ -z "$API_ID" ]] || [[ -z "$API_KEY" ]]; then
        error "API_ID and API_KEY must be configured in $CREDENTIALS_FILE"
    fi
    
    # Use PATCHMON_URL from credentials if available
    if [[ -n "$PATCHMON_URL" ]]; then
        PATCHMON_SERVER="$PATCHMON_URL"
    fi
}

# Convert legacy credentials to YAML format
convert_credentials_to_yaml() {
    local yaml_file="/etc/patchmon/credentials.yml"
    
    info "Converting credentials to YAML format..."
    
    cat > "$yaml_file" << EOF
api_id: "$API_ID"
api_key: "$API_KEY"
EOF
    
    chmod 600 "$yaml_file"
    success "Credentials converted to YAML format"
}

# Create Go agent configuration
create_go_agent_config() {
    local config_file="/etc/patchmon/config.yml"
    
    info "Creating Go agent configuration..."
    
    cat > "$config_file" << EOF
patchmon_server: "$PATCHMON_SERVER"
api_version: "$API_VERSION"
credentials_file: "/etc/patchmon/credentials.yml"
log_file: "/etc/patchmon/logs/patchmon-agent.log"
log_level: "info"
EOF
    
    chmod 644 "$config_file"
    success "Go agent configuration created"
}

# Download Go agent binary
download_go_agent() {
    local arch=$(uname -m)
    local goos="linux"
    local goarch=""
    
    # Map architecture
    case "$arch" in
        "x86_64")
            goarch="amd64"
            ;;
        "i386"|"i686")
            goarch="386"
            ;;
        "aarch64"|"arm64")
            goarch="arm64"
            ;;
        "armv7l"|"armv6l"|"armv5l")
            goarch="arm"
            ;;
        *)
            error "Unsupported architecture: $arch"
            ;;
    esac
    
    local download_url="$PATCHMON_SERVER/api/$API_VERSION/hosts/agent/go-binary?arch=$goarch"
    local temp_dir="/etc/patchmon/tmp"
    local temp_binary="$temp_dir/patchmon-agent-new"
    
    # Create temp directory if it doesn't exist
    mkdir -p "$temp_dir"
    
    info "Downloading Go agent binary for $goos-$goarch..."
    
    # Download with API credentials
    if curl $CURL_FLAGS -H "X-API-ID: $API_ID" -H "X-API-KEY: $API_KEY" \
           -o "$temp_binary" "$download_url"; then
        
        # Verify binary - check if it's a valid executable
        chmod +x "$temp_binary"
        
        # Test binary by trying to run it
        if "$temp_binary" check-version >/dev/null 2>&1; then
            success "Go agent binary downloaded and verified"
            echo "$temp_binary"
        else
            # Try to get more info about the file
            local file_info=$(file "$temp_binary" 2>/dev/null || echo "unknown")
            rm -f "$temp_binary"  # Clean up failed download
            error "Downloaded Go agent binary is not executable. File info: $file_info"
        fi
    else
        rm -f "$temp_binary"  # Clean up failed download
        error "Failed to download Go agent binary"
    fi
}

# Install Go agent binary
install_go_agent() {
    local temp_binary="$1"
    local install_path="/usr/local/bin/patchmon-agent"
    
    info "Installing Go agent binary..."
    
    # Create backup of current script if it exists
    if [[ -f "/usr/local/bin/patchmon-agent.sh" ]]; then
        local backup_path="/usr/local/bin/patchmon-agent.sh.backup.$(date +%Y%m%d_%H%M%S)"
        cp "/usr/local/bin/patchmon-agent.sh" "$backup_path"
        info "Backed up legacy script to: $backup_path"
    fi
    
    # Install new binary
    mv "$temp_binary" "$install_path"
    success "Go agent binary installed to: $install_path"
    
    # Clean up the temporary file
    rm -f "$temp_binary"
}

# Remove cron entries
remove_cron_entries() {
    info "Removing legacy cron entries..."
    
    # Get current crontab
    local current_crontab=$(crontab -l 2>/dev/null || echo "")
    
    if [[ -n "$current_crontab" ]]; then
        # Remove any lines containing patchmon-agent
        local new_crontab=$(echo "$current_crontab" | grep -v "patchmon-agent" || true)
        
        # Update crontab if it changed
        if [[ "$current_crontab" != "$new_crontab" ]]; then
            if [[ -n "$new_crontab" ]]; then
                echo "$new_crontab" | crontab -
                success "Legacy cron entries removed (kept other cron jobs)"
            else
                crontab -r 2>/dev/null || true
                success "All cron entries removed"
            fi
        else
            info "No patchmon cron entries found to remove"
        fi
    else
        info "No crontab found"
    fi
}

# Configure Go agent
configure_go_agent() {
    info "Configuring Go agent..."
    
    # Create necessary directories
    mkdir -p /etc/patchmon/logs
    
    # Configure credentials
    if ! /usr/local/bin/patchmon-agent config set-credentials "$API_ID" "$API_KEY"; then
        warning "Failed to configure credentials via CLI, but files were created manually"
    fi
    
    success "Go agent configured"
}

# Test Go agent
test_go_agent() {
    info "Testing Go agent..."
    
    # Test configuration
    if /usr/local/bin/patchmon-agent config show >/dev/null 2>&1; then
        success "Go agent configuration test passed"
    else
        warning "Go agent configuration test failed, but continuing..."
    fi
    
    # Test connectivity
    if /usr/local/bin/patchmon-agent ping >/dev/null 2>&1; then
        success "Go agent connectivity test passed"
    else
        warning "Go agent connectivity test failed, but continuing..."
    fi
}

# Clean up temporary directory
cleanup_temp_directory() {
    info "Cleaning up temporary files..."
    
    local temp_dir="/etc/patchmon/tmp"
    if [[ -d "$temp_dir" ]]; then
        rm -rf "$temp_dir"
        success "Temporary directory cleaned up"
    fi
}

# Clean up legacy files
cleanup_legacy_files() {
    info "Cleaning up legacy files..."
    
    # Remove legacy script
    if [[ -f "/usr/local/bin/patchmon-agent.sh" ]]; then
        rm -f "/usr/local/bin/patchmon-agent.sh"
        success "Removed legacy script"
    fi
    
    # Remove legacy credentials file
    if [[ -f "$CREDENTIALS_FILE" ]]; then
        rm -f "$CREDENTIALS_FILE"
        success "Removed legacy credentials file"
    fi
    
    # Remove legacy config file
    if [[ -f "$CONFIG_FILE" ]]; then
        rm -f "$CONFIG_FILE"
        success "Removed legacy config file"
    fi
}

# Show migration summary
show_migration_summary() {
    echo ""
    echo "=========================================="
    echo "PatchMon Agent Migration Complete!"
    echo "=========================================="
    echo ""
    echo "✅ Successfully migrated from bash agent to Go agent"
    echo ""
    echo "What was done:"
    echo "  • Converted credentials to YAML format"
    echo "  • Created Go agent configuration"
    echo "  • Downloaded and installed Go agent binary"
    echo "  • Removed legacy cron entries"
    echo "  • Cleaned up legacy files"
    echo ""
    echo "Next steps:"
    echo "  • The Go agent runs as a service, no cron needed"
    echo "  • Use: patchmon-agent serve (to run as service)"
    echo "  • Use: patchmon-agent report (for one-time report)"
    echo "  • Use: patchmon-agent --help (for all commands)"
    echo ""
    echo "Monitoring commands:"
    echo "  • Check status: systemctl status patchmon-agent"
    echo "  • View logs: tail -f /etc/patchmon/logs/patchmon-agent.log"
    echo "  • Run diagnostics: patchmon-agent diagnostics"
    echo ""
    echo "Configuration files:"
    echo "  • Config: /etc/patchmon/config.yml"
    echo "  • Credentials: /etc/patchmon/credentials.yml"
    echo "  • Logs: /etc/patchmon/logs/patchmon-agent.log"
    echo ""
}

# Post-migration verification
post_migration_check() {
    echo ""
    echo "=========================================="
    echo "Post-Migration Verification"
    echo "=========================================="
    echo ""
    
    # Check if patchmon-agent is running
    info "Checking if patchmon-agent is running..."
    if pgrep -f "patchmon-agent serve" >/dev/null 2>&1; then
        success "PatchMon agent is running"
    else
        warning "PatchMon agent is not running (this is normal if not started as service)"
        info "To start as service: patchmon-agent serve"
    fi
    
    # Check WebSocket connection (if agent is running)
    if pgrep -f "patchmon-agent serve" >/dev/null 2>&1; then
        info "Checking WebSocket connection..."
        if /usr/local/bin/patchmon-agent ping >/dev/null 2>&1; then
            success "WebSocket connection is active"
        else
            warning "WebSocket connection test failed"
        fi
    else
        info "Skipping WebSocket check (agent not running)"
    fi
    
    # Run diagnostics
    info "Running system diagnostics..."
    echo ""
    if /usr/local/bin/patchmon-agent diagnostics >/dev/null 2>&1; then
        success "Diagnostics completed successfully"
        echo ""
        echo "Full diagnostics output:"
        echo "----------------------------------------"
        /usr/local/bin/patchmon-agent diagnostics
        echo "----------------------------------------"
    else
        warning "Diagnostics failed to run"
    fi
    
    echo ""
    echo "=========================================="
    echo "Migration Verification Complete!"
    echo "=========================================="
    echo ""
    success "Thank you for using PatchMon Agent!"
    echo ""
}

# Main migration function
perform_migration() {
    info "Starting PatchMon Agent migration from bash to Go..."
    echo ""
    
    # Load legacy credentials
    load_legacy_credentials
    
    # Convert credentials
    convert_credentials_to_yaml
    
    # Create Go agent config
    create_go_agent_config
    
    # Download Go agent
    local temp_binary=$(download_go_agent)
    
    # Install Go agent
    install_go_agent "$temp_binary"
    
    # Remove cron entries
    remove_cron_entries
    
    # Configure Go agent
    configure_go_agent
    
    # Test Go agent
    test_go_agent
    
    # Clean up legacy files
    cleanup_legacy_files
    
    # Clean up temporary directory
    cleanup_temp_directory
    
    # Show summary
    show_migration_summary
    
    # Run post-migration verification
    post_migration_check
    
    success "Migration completed successfully!"
    
    # Exit here to prevent the legacy script from continuing
    exit 0
}

# Handle command line arguments
case "$1" in
    "migrate")
        check_root
        perform_migration
        ;;
    "test")
        check_root
        load_legacy_credentials
        test_go_agent
        ;;
    "update-agent")
        # This is called by legacy agents during update
        check_root
        perform_migration
        ;;
    *)
        # If no arguments provided, check if we're being executed by a legacy agent
        # Legacy agents will call this script directly during update
        if [[ -f "$CREDENTIALS_FILE" ]]; then
            info "Detected legacy agent execution - starting migration..."
            check_root
            perform_migration
        else
            echo "PatchMon Agent Migration Script v$AGENT_VERSION"
            echo "Usage: $0 {migrate|test|update-agent}"
            echo ""
            echo "Commands:"
            echo "  migrate      - Perform full migration from bash to Go agent"
            echo "  test         - Test Go agent after migration"
            echo "  update-agent - Called by legacy agents during update"
            echo ""
            echo "This script should be executed by the legacy agent during update."
            exit 1
        fi
        ;;
esac
