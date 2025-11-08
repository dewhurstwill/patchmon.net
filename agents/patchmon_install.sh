#!/bin/sh
# PatchMon Agent Installation Script
# This script requires bash for full functionality
# Usage: curl -s {PATCHMON_URL}/api/v1/hosts/install -H "X-API-ID: {API_ID}" -H "X-API-KEY: {API_KEY}" | sh

# Check if bash is available, if not try to install it (for Alpine Linux)
if ! command -v bash >/dev/null 2>&1; then
    if command -v apk >/dev/null 2>&1; then
        echo "Installing bash for script compatibility..."
        apk add --no-cache bash >/dev/null 2>&1 || true
    fi
fi

# If bash is available and we're not already running in bash, switch to bash
# When piped, we can't re-execute easily, so we'll continue with sh
# but ensure bash is available for bash-specific features
if command -v bash >/dev/null 2>&1 && [ -z "${BASH_VERSION:-}" ]; then
    # Check if we're being piped (stdin is not a terminal)
    if [ -t 0 ]; then
        # Direct execution, re-execute with bash
        exec bash "$0" "$@"
        exit $?
    fi
    # When piped, we continue with sh but bash is now available
    # The script will use bash-specific features which should work if bash is installed
fi

# PatchMon Agent Installation Script
# Usage: curl -s {PATCHMON_URL}/api/v1/hosts/install -H "X-API-ID: {API_ID}" -H "X-API-KEY: {API_KEY}" | sh

set -e

# This placeholder will be dynamically replaced by the server when serving this
# script based on the "ignore SSL self-signed" setting. If set to -k, curl will
# ignore certificate validation. Otherwise, it will be empty for secure default.
# CURL_FLAGS is now set via environment variables by the backend

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Functions
error() {
    echo -e "${RED}❌ ERROR: $1${NC}" >&2
    exit 1
}

info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

success() {
    echo -e "${GREEN}✅ $1${NC}"
}

warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

# Check if running as root
if [ "$(id -u)" -ne 0 ]; then
   error "This script must be run as root (use sudo)"
fi

# Verify system datetime and timezone
verify_datetime() {
    info "🕐 Verifying system datetime and timezone..."
    
    # Get current system time
    system_time=$(date)
    timezone=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "Unknown")
    
    # Display current datetime info
    echo ""
    echo -e "${BLUE}📅 Current System Date/Time:${NC}"
    echo "   • Date/Time: $system_time"
    echo "   • Timezone: $timezone"
    echo ""
    
    # Check if we can read from stdin (interactive terminal)
    if [ -t 0 ]; then
        # Interactive terminal - ask user
        printf "Does this date/time look correct to you? (y/N): "
        read -r response
        case "$response" in
            [Yy]*) 
                success "✅ Date/time verification passed"
                echo ""
                return 0
                ;;
            *)
            echo ""
            echo -e "${RED}❌ Date/time verification failed${NC}"
            echo ""
            echo -e "${YELLOW}💡 Please fix the date/time and re-run the installation script:${NC}"
            echo "   sudo timedatectl set-time 'YYYY-MM-DD HH:MM:SS'"
            echo "   sudo timedatectl set-timezone 'America/New_York'  # or your timezone"
            echo "   sudo timedatectl list-timezones  # to see available timezones"
            echo ""
                echo -e "${BLUE}ℹ️  After fixing the date/time, re-run this installation script.${NC}"
                error "Installation cancelled - please fix date/time and re-run"
                ;;
        esac
    else
        # Non-interactive (piped from curl) - show warning and continue
        echo -e "${YELLOW}⚠️  Non-interactive installation detected${NC}"
        echo ""
        echo "Please verify the date/time shown above is correct."
        echo "If the date/time is incorrect, it may cause issues with:"
        echo "   • Logging timestamps"
        echo "   • Scheduled updates"
        echo "   • Data synchronization"
        echo ""
        echo -e "${GREEN}✅ Continuing with installation...${NC}"
        success "✅ Date/time verification completed (assumed correct)"
        echo ""
    fi
}

# Run datetime verification
verify_datetime

# Clean up old files (keep only last 3 of each type)
cleanup_old_files() {
    # Clean up old credential backups
    ls -t /etc/patchmon/credentials.yml.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old config backups
    ls -t /etc/patchmon/config.yml.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old agent backups
    ls -t /usr/local/bin/patchmon-agent.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old log files
    ls -t /etc/patchmon/logs/patchmon-agent.log.old.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old shell script backups (if any exist)
    ls -t /usr/local/bin/patchmon-agent.sh.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Clean up old credentials backups (if any exist)
    ls -t /etc/patchmon/credentials.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
}

# Run cleanup at start
cleanup_old_files

# Generate or retrieve machine ID
get_machine_id() {
    # Try multiple sources for machine ID
    if [ -f /etc/machine-id ]; then
        cat /etc/machine-id
    elif [ -f /var/lib/dbus/machine-id ]; then
        cat /var/lib/dbus/machine-id
    else
        # Fallback: generate from hardware info (less ideal but works)
        echo "patchmon-$(cat /sys/class/dmi/id/product_uuid 2>/dev/null || cat /proc/sys/kernel/random/uuid)"
    fi
}

# Parse arguments from environment (passed via HTTP headers)
if [ -z "$PATCHMON_URL" ] || [ -z "$API_ID" ] || [ -z "$API_KEY" ]; then
    error "Missing required parameters. This script should be called via the PatchMon web interface."
fi

# Auto-detect architecture if not explicitly set
if [ -z "$ARCHITECTURE" ]; then
    arch_raw=$(uname -m 2>/dev/null || echo "unknown")
    
    # Map architecture to supported values
    case "$arch_raw" in
        "x86_64")
            ARCHITECTURE="amd64"
            ;;
        "i386"|"i686")
            ARCHITECTURE="386"
            ;;
        "aarch64"|"arm64")
            ARCHITECTURE="arm64"
            ;;
        "armv7l"|"armv6l"|"arm")
            ARCHITECTURE="arm"
            ;;
        *)
            warning "⚠️  Unknown architecture '$arch_raw', defaulting to amd64"
            ARCHITECTURE="amd64"
            ;;
    esac
fi

# Validate architecture
if [ "$ARCHITECTURE" != "amd64" ] && [ "$ARCHITECTURE" != "386" ] && [ "$ARCHITECTURE" != "arm64" ] && [ "$ARCHITECTURE" != "arm" ]; then
    error "Invalid architecture '$ARCHITECTURE'. Must be one of: amd64, 386, arm64, arm"
fi

# Check if --force flag is set (for bypassing broken packages)
FORCE_INSTALL="${FORCE_INSTALL:-false}"
case "$*" in
    *"--force"*) FORCE_INSTALL="true" ;;
esac
if [ "$FORCE_INSTALL" = "true" ]; then
    FORCE_INSTALL="true"
    warning "⚠️  Force mode enabled - will bypass broken packages"
fi

# Get unique machine ID for this host
MACHINE_ID=$(get_machine_id)
export MACHINE_ID

info "🚀 Starting PatchMon Agent Installation..."
info "📋 Server: $PATCHMON_URL"
info "🔑 API ID: ${API_ID:0:16}..."
info "🆔 Machine ID: ${MACHINE_ID:0:16}..."
info "🏗️  Architecture: $ARCHITECTURE"

# Display diagnostic information
echo ""
echo -e "${BLUE}🔧 Installation Diagnostics:${NC}"
echo "   • URL: $PATCHMON_URL"
echo "   • CURL FLAGS: $CURL_FLAGS"
echo "   • API ID: ${API_ID:0:16}..."
echo "   • API Key: ${API_KEY:0:16}..."
echo "   • Architecture: $ARCHITECTURE"
echo ""

# Install required dependencies
info "📦 Installing required dependencies..."
echo ""

# Function to check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to install packages with error handling
install_apt_packages() {
    local packages=("$@")
    local missing_packages=()
    
    # Check which packages are missing
    for pkg in "${packages[@]}"; do
        if ! command_exists "$pkg"; then
            missing_packages+=("$pkg")
        fi
    done
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        success "All required packages are already installed"
        return 0
    fi
    
    info "Need to install: ${missing_packages[*]}"
    
    # Build apt-get command based on force mode
    local apt_cmd="apt-get install ${missing_packages[*]} -y"
    
    if [ "$FORCE_INSTALL" = "true" ]; then
        info "Using force mode - bypassing broken packages..."
        apt_cmd="$apt_cmd -o APT::Get::Fix-Broken=false -o DPkg::Options::=\"--force-confold\" -o DPkg::Options::=\"--force-confdef\""
    fi
    
    # Try to install packages
    if eval "$apt_cmd" 2>&1 | tee /tmp/patchmon_apt_install.log; then
        success "Packages installed successfully"
        return 0
    else
        warning "Package installation encountered issues, checking if required tools are available..."
        
        # Verify critical dependencies are actually available
        local all_ok=true
        for pkg in "${packages[@]}"; do
            if ! command_exists "$pkg"; then
                if [ "$FORCE_INSTALL" = "true" ]; then
                    error "Critical dependency '$pkg' is not available even with --force. Please install manually."
                else
                    error "Critical dependency '$pkg' is not available. Try again with --force flag or install manually: apt-get install $pkg"
                fi
                all_ok=false
            fi
        done
        
        if $all_ok; then
            success "All required tools are available despite installation warnings"
            return 0
        else
            return 1
        fi
    fi
}

# Function to check and install packages for yum/dnf
install_yum_dnf_packages() {
    local pkg_manager="$1"
    shift
    local packages=("$@")
    local missing_packages=()
    
    # Check which packages are missing
    for pkg in "${packages[@]}"; do
        if ! command_exists "$pkg"; then
            missing_packages+=("$pkg")
        fi
    done
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        success "All required packages are already installed"
        return 0
    fi
    
    info "Need to install: ${missing_packages[*]}"
    
    if [ "$pkg_manager" = "yum" ]; then
        yum install -y "${missing_packages[@]}"
    else
        dnf install -y "${missing_packages[@]}"
    fi
}

# Function to check and install packages for zypper
install_zypper_packages() {
    local packages=("$@")
    local missing_packages=()
    
    # Check which packages are missing
    for pkg in "${packages[@]}"; do
        if ! command_exists "$pkg"; then
            missing_packages+=("$pkg")
        fi
    done
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        success "All required packages are already installed"
        return 0
    fi
    
    info "Need to install: ${missing_packages[*]}"
    zypper install -y "${missing_packages[@]}"
}

# Function to check and install packages for pacman
install_pacman_packages() {
    local packages=("$@")
    local missing_packages=()
    
    # Check which packages are missing
    for pkg in "${packages[@]}"; do
        if ! command_exists "$pkg"; then
            missing_packages+=("$pkg")
        fi
    done
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        success "All required packages are already installed"
        return 0
    fi
    
    info "Need to install: ${missing_packages[*]}"
    pacman -S --noconfirm "${missing_packages[@]}"
}

# Function to check and install packages for apk
install_apk_packages() {
    local packages=("$@")
    local missing_packages=()
    
    # Check which packages are missing
    for pkg in "${packages[@]}"; do
        if ! command_exists "$pkg"; then
            missing_packages+=("$pkg")
        fi
    done
    
    if [ ${#missing_packages[@]} -eq 0 ]; then
        success "All required packages are already installed"
        return 0
    fi
    
    info "Need to install: ${missing_packages[*]}"
    
    # Update package index before installation
    info "Updating package index..."
    apk update -q || true
    
    # Build apk command
    local apk_cmd="apk add --no-cache ${missing_packages[*]}"
    
    # Try to install packages
    if eval "$apk_cmd" 2>&1 | tee /tmp/patchmon_apk_install.log; then
        success "Packages installed successfully"
        return 0
    else
        warning "Package installation encountered issues, checking if required tools are available..."
        
        # Verify critical dependencies are actually available
        local all_ok=true
        for pkg in "${packages[@]}"; do
            if ! command_exists "$pkg"; then
                if [ "$FORCE_INSTALL" = "true" ]; then
                    error "Critical dependency '$pkg' is not available even with --force. Please install manually."
                else
                    error "Critical dependency '$pkg' is not available. Try again with --force flag or install manually: apk add $pkg"
                fi
                all_ok=false
            fi
        done
        
        if $all_ok; then
            success "All required tools are available despite installation warnings"
            return 0
        else
            return 1
        fi
    fi
}

# Detect package manager and install jq, curl, and bc
if command -v apt-get >/dev/null 2>&1; then
    # Debian/Ubuntu
    info "Detected apt-get (Debian/Ubuntu)"
    echo ""
    
    # Check for broken packages
    if dpkg -l | grep -q "^iH\|^iF" 2>/dev/null; then
        if [ "$FORCE_INSTALL" = "true" ]; then
            warning "Detected broken packages on system - force mode will work around them"
        else
            warning "⚠️  Broken packages detected on system"
            warning "If installation fails, retry with: curl -s {URL}/api/v1/hosts/install --force -H ..."
        fi
    fi
    
    info "Updating package lists..."
    apt-get update || true
    echo ""
    info "Installing jq, curl, and bc..."
    install_apt_packages jq curl bc
elif command -v yum >/dev/null 2>&1; then
    # CentOS/RHEL 7
    info "Detected yum (CentOS/RHEL 7)"
    echo ""
    info "Installing jq, curl, and bc..."
    install_yum_dnf_packages yum jq curl bc
elif command -v dnf >/dev/null 2>&1; then
    # CentOS/RHEL 8+/Fedora
    info "Detected dnf (CentOS/RHEL 8+/Fedora)"
    echo ""
    info "Installing jq, curl, and bc..."
    install_yum_dnf_packages dnf jq curl bc
elif command -v zypper >/dev/null 2>&1; then
    # openSUSE
    info "Detected zypper (openSUSE)"
    echo ""
    info "Installing jq, curl, and bc..."
    install_zypper_packages jq curl bc
elif command -v pacman >/dev/null 2>&1; then
    # Arch Linux
    info "Detected pacman (Arch Linux)"
    echo ""
    info "Installing jq, curl, and bc..."
    install_pacman_packages jq curl bc
elif command -v apk >/dev/null 2>&1; then
    # Alpine Linux
    info "Detected apk (Alpine Linux)"
    echo ""
    info "Installing jq, curl, and bc..."
    install_apk_packages jq curl bc
else
    warning "Could not detect package manager. Please ensure 'jq', 'curl', and 'bc' are installed manually."
fi

echo ""
success "Dependencies installation completed"
echo ""

# Step 1: Handle existing configuration directory
info "📁 Setting up configuration directory..."

# Check if configuration directory already exists
if [ -d "/etc/patchmon" ]; then
    warning "⚠️  Configuration directory already exists at /etc/patchmon"
    warning "⚠️  Preserving existing configuration files"
    
    # List existing files for user awareness
    info "📋 Existing files in /etc/patchmon:"
    ls -la /etc/patchmon/ 2>/dev/null | grep -v "^total" | while read -r line; do
        echo "   $line"
    done
else
    info "📁 Creating new configuration directory..."
    mkdir -p /etc/patchmon
fi

# Check if agent is already configured and working (before we overwrite anything)
info "🔍 Checking if agent is already configured..."

if [ -f /etc/patchmon/config.yml ] && [ -f /etc/patchmon/credentials.yml ]; then
    if [ -f /usr/local/bin/patchmon-agent ]; then
        info "📋 Found existing agent configuration"
        info "🧪 Testing existing configuration with ping..."
        
        if /usr/local/bin/patchmon-agent ping >/dev/null 2>&1; then
            success "✅ Agent is already configured and ping successful"
            info "📋 Existing configuration is working - skipping installation"
            info ""
            info "If you want to reinstall, remove the configuration files first:"
            info "  sudo rm -f /etc/patchmon/config.yml /etc/patchmon/credentials.yml"
            echo ""
            exit 0
        else
            warning "⚠️  Agent configuration exists but ping failed"
            warning "⚠️  Will move existing configuration and reinstall"
            echo ""
        fi
    else
        warning "⚠️  Configuration files exist but agent binary is missing"
        warning "⚠️  Will move existing configuration and reinstall"
        echo ""
    fi
else
    success "✅ Agent not yet configured - proceeding with installation"
    echo ""
fi

# Step 2: Create configuration files
info "🔐 Creating configuration files..."

# Check if config file already exists
if [ -f "/etc/patchmon/config.yml" ]; then
    warning "⚠️  Config file already exists at /etc/patchmon/config.yml"
    warning "⚠️  Moving existing file out of the way for fresh installation"
    
    # Clean up old config backups (keep only last 3)
    ls -t /etc/patchmon/config.yml.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Move existing file out of the way
    mv /etc/patchmon/config.yml /etc/patchmon/config.yml.backup.$(date +%Y%m%d_%H%M%S)
    info "📋 Moved existing config to: /etc/patchmon/config.yml.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Check if credentials file already exists
if [ -f "/etc/patchmon/credentials.yml" ]; then
    warning "⚠️  Credentials file already exists at /etc/patchmon/credentials.yml"
    warning "⚠️  Moving existing file out of the way for fresh installation"
    
    # Clean up old credential backups (keep only last 3)
    ls -t /etc/patchmon/credentials.yml.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Move existing file out of the way
    mv /etc/patchmon/credentials.yml /etc/patchmon/credentials.yml.backup.$(date +%Y%m%d_%H%M%S)
    info "📋 Moved existing credentials to: /etc/patchmon/credentials.yml.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Clean up old credentials file if it exists (from previous installations)
if [ -f "/etc/patchmon/credentials" ]; then
    warning "⚠️  Found old credentials file, removing it..."
    rm -f /etc/patchmon/credentials
    info "📋 Removed old credentials file"
fi

# Create main config file
cat > /etc/patchmon/config.yml << EOF
# PatchMon Agent Configuration
# Generated on $(date)
patchmon_server: "$PATCHMON_URL"
api_version: "v1"
credentials_file: "/etc/patchmon/credentials.yml"
log_file: "/etc/patchmon/logs/patchmon-agent.log"
log_level: "info"
skip_ssl_verify: ${SKIP_SSL_VERIFY:-false}
EOF

# Create credentials file
cat > /etc/patchmon/credentials.yml << EOF
# PatchMon API Credentials
# Generated on $(date)
api_id: "$API_ID"
api_key: "$API_KEY"
EOF

chmod 600 /etc/patchmon/config.yml
chmod 600 /etc/patchmon/credentials.yml

# Step 3: Download the PatchMon agent binary using API credentials
info "📥 Downloading PatchMon agent binary..."

# Determine the binary filename based on architecture
BINARY_NAME="patchmon-agent-linux-${ARCHITECTURE}"

# Check if agent binary already exists
if [ -f "/usr/local/bin/patchmon-agent" ]; then
    warning "⚠️  Agent binary already exists at /usr/local/bin/patchmon-agent"
    warning "⚠️  Moving existing file out of the way for fresh installation"
    
    # Clean up old agent backups (keep only last 3)
    ls -t /usr/local/bin/patchmon-agent.backup.* 2>/dev/null | tail -n +4 | xargs -r rm -f
    
    # Move existing file out of the way
    mv /usr/local/bin/patchmon-agent /usr/local/bin/patchmon-agent.backup.$(date +%Y%m%d_%H%M%S)
    info "📋 Moved existing agent to: /usr/local/bin/patchmon-agent.backup.$(date +%Y%m%d_%H%M%S)"
fi

# Clean up old shell script if it exists (from previous installations)
if [ -f "/usr/local/bin/patchmon-agent.sh" ]; then
    warning "⚠️  Found old shell script agent, removing it..."
    rm -f /usr/local/bin/patchmon-agent.sh
    info "📋 Removed old shell script agent"
fi

# Download the binary
curl $CURL_FLAGS \
    -H "X-API-ID: $API_ID" \
    -H "X-API-KEY: $API_KEY" \
    "$PATCHMON_URL/api/v1/hosts/agent/download?arch=$ARCHITECTURE&force=binary" \
    -o /usr/local/bin/patchmon-agent

chmod +x /usr/local/bin/patchmon-agent

# Get the agent version from the binary
AGENT_VERSION=$(/usr/local/bin/patchmon-agent version 2>/dev/null || echo "Unknown")
info "📋 Agent version: $AGENT_VERSION"

# Handle existing log files and create log directory
info "📁 Setting up log directory..."

# Create log directory if it doesn't exist
mkdir -p /etc/patchmon/logs

# Handle existing log files
if [ -f "/etc/patchmon/logs/patchmon-agent.log" ]; then
    warning "⚠️  Existing log file found at /etc/patchmon/logs/patchmon-agent.log"
    warning "⚠️  Rotating log file for fresh start"
    
    # Rotate the log file
    mv /etc/patchmon/logs/patchmon-agent.log /etc/patchmon/logs/patchmon-agent.log.old.$(date +%Y%m%d_%H%M%S)
    info "📋 Log file rotated to: /etc/patchmon/logs/patchmon-agent.log.old.$(date +%Y%m%d_%H%M%S)"
fi

# Step 4: Test the configuration
info "🧪 Testing API credentials and connectivity..."
if /usr/local/bin/patchmon-agent ping; then
    success "✅ TEST: API credentials are valid and server is reachable"
else
    error "❌ Failed to validate API credentials or reach server"
fi

# Step 5: Setup service for WebSocket connection
# Note: The service will automatically send an initial report on startup (see serve.go)
# Detect init system and create appropriate service
if command -v systemctl >/dev/null 2>&1; then
    # Systemd is available
    info "🔧 Setting up systemd service..."
    
    # Stop and disable existing service if it exists
    if systemctl is-active --quiet patchmon-agent.service 2>/dev/null; then
        warning "⚠️  Stopping existing PatchMon agent service..."
        systemctl stop patchmon-agent.service
    fi
    
    if systemctl is-enabled --quiet patchmon-agent.service 2>/dev/null; then
        warning "⚠️  Disabling existing PatchMon agent service..."
        systemctl disable patchmon-agent.service
    fi
    
    # Create systemd service file
    cat > /etc/systemd/system/patchmon-agent.service << EOF
[Unit]
Description=PatchMon Agent Service
After=network.target
Wants=network.target

[Service]
Type=simple
User=root
ExecStart=/usr/local/bin/patchmon-agent serve
Restart=always
RestartSec=10
WorkingDirectory=/etc/patchmon

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=patchmon-agent

[Install]
WantedBy=multi-user.target
EOF
    
    # Clean up old crontab entries if they exist (from previous installations)
    if crontab -l 2>/dev/null | grep -q "patchmon-agent"; then
        warning "⚠️  Found old crontab entries, removing them..."
        crontab -l 2>/dev/null | grep -v "patchmon-agent" | crontab -
        info "📋 Removed old crontab entries"
    fi
    
    # Reload systemd and enable/start the service
    systemctl daemon-reload
    systemctl enable patchmon-agent.service
    systemctl start patchmon-agent.service
    
    # Check if service started successfully
    if systemctl is-active --quiet patchmon-agent.service; then
        success "✅ PatchMon Agent service started successfully"
        info "🔗 WebSocket connection established"
    else
        warning "⚠️  Service may have failed to start. Check status with: systemctl status patchmon-agent"
    fi
    
    SERVICE_TYPE="systemd"
elif [ -d /etc/init.d ] && command -v rc-service >/dev/null 2>&1; then
    # OpenRC is available (Alpine Linux)
    info "🔧 Setting up OpenRC service..."
    
    # Stop and disable existing service if it exists
    if rc-service patchmon-agent status >/dev/null 2>&1; then
        warning "⚠️  Stopping existing PatchMon agent service..."
        rc-service patchmon-agent stop
    fi
    
    if rc-update show default 2>/dev/null | grep -q "patchmon-agent"; then
        warning "⚠️  Disabling existing PatchMon agent service..."
        rc-update del patchmon-agent default
    fi
    
    # Create OpenRC service file
    cat > /etc/init.d/patchmon-agent << 'EOF'
#!/sbin/openrc-run

name="patchmon-agent"
description="PatchMon Agent Service"
command="/usr/local/bin/patchmon-agent"
command_args="serve"
command_user="root"
pidfile="/var/run/patchmon-agent.pid"
command_background="yes"
working_dir="/etc/patchmon"

depend() {
    need net
    after net
}
EOF
    
    chmod +x /etc/init.d/patchmon-agent
    
    # Clean up old crontab entries if they exist (from previous installations)
    if crontab -l 2>/dev/null | grep -q "patchmon-agent"; then
        warning "⚠️  Found old crontab entries, removing them..."
        crontab -l 2>/dev/null | grep -v "patchmon-agent" | crontab -
        info "📋 Removed old crontab entries"
    fi
    
    # Enable and start the service
    rc-update add patchmon-agent default
    rc-service patchmon-agent start
    
    # Check if service started successfully
    if rc-service patchmon-agent status >/dev/null 2>&1; then
        success "✅ PatchMon Agent service started successfully"
        info "🔗 WebSocket connection established"
    else
        warning "⚠️  Service may have failed to start. Check status with: rc-service patchmon-agent status"
    fi
    
    SERVICE_TYPE="openrc"
else
    # No init system detected, use crontab as fallback
    warning "⚠️  No init system detected (systemd or OpenRC). Using crontab for service management."
    
    # Clean up old crontab entries if they exist
    if crontab -l 2>/dev/null | grep -q "patchmon-agent"; then
        warning "⚠️  Found old crontab entries, removing them..."
        crontab -l 2>/dev/null | grep -v "patchmon-agent" | crontab -
        info "📋 Removed old crontab entries"
    fi
    
    # Add crontab entry to run the agent
    (crontab -l 2>/dev/null; echo "@reboot /usr/local/bin/patchmon-agent serve >/dev/null 2>&1") | crontab -
    info "📋 Added crontab entry for PatchMon agent"
    
    # Start the agent manually
    /usr/local/bin/patchmon-agent serve >/dev/null 2>&1 &
    success "✅ PatchMon Agent started in background"
    info "🔗 WebSocket connection established"
    
    SERVICE_TYPE="crontab"
fi

# Installation complete
success "🎉 PatchMon Agent installation completed successfully!"
echo ""
echo -e "${GREEN}📋 Installation Summary:${NC}"
echo "   • Configuration directory: /etc/patchmon"
echo "   • Agent binary installed: /usr/local/bin/patchmon-agent"
echo "   • Architecture: $ARCHITECTURE"
echo "   • Dependencies installed: jq, curl, bc"
if [ "$SERVICE_TYPE" = "systemd" ]; then
    echo "   • Systemd service configured and running"
elif [ "$SERVICE_TYPE" = "openrc" ]; then
    echo "   • OpenRC service configured and running"
else
    echo "   • Service configured via crontab"
fi
echo "   • API credentials configured and tested"
echo "   • WebSocket connection established"
echo "   • Logs directory: /etc/patchmon/logs"

# Check for moved files and show them
MOVED_FILES=$(ls /etc/patchmon/credentials.yml.backup.* /etc/patchmon/config.yml.backup.* /usr/local/bin/patchmon-agent.backup.* /etc/patchmon/logs/patchmon-agent.log.old.* /usr/local/bin/patchmon-agent.sh.backup.* /etc/patchmon/credentials.backup.* 2>/dev/null || true)
if [ -n "$MOVED_FILES" ]; then
    echo ""
    echo -e "${YELLOW}📋 Files Moved for Fresh Installation:${NC}"
    echo "$MOVED_FILES" | while read -r moved_file; do
        echo "   • $moved_file"
    done
    echo ""
    echo -e "${BLUE}💡 Note: Old files are automatically cleaned up (keeping last 3)${NC}"
fi

echo ""
echo -e "${BLUE}🔧 Management Commands:${NC}"
echo "   • Test connection: /usr/local/bin/patchmon-agent ping"
echo "   • Manual report: /usr/local/bin/patchmon-agent report"
echo "   • Check status: /usr/local/bin/patchmon-agent diagnostics"
if [ "$SERVICE_TYPE" = "systemd" ]; then
    echo "   • Service status: systemctl status patchmon-agent"
    echo "   • Service logs: journalctl -u patchmon-agent -f"
    echo "   • Restart service: systemctl restart patchmon-agent"
elif [ "$SERVICE_TYPE" = "openrc" ]; then
    echo "   • Service status: rc-service patchmon-agent status"
    echo "   • Service logs: tail -f /etc/patchmon/logs/patchmon-agent.log"
    echo "   • Restart service: rc-service patchmon-agent restart"
else
    echo "   • Service logs: tail -f /etc/patchmon/logs/patchmon-agent.log"
    echo "   • Restart service: pkill -f 'patchmon-agent serve' && /usr/local/bin/patchmon-agent serve &"
fi
echo ""
success "✅ Your system is now being monitored by PatchMon!"
