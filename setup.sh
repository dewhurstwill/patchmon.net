#!/bin/bash
# PatchMon Self-Hosting Installation Script
# Automated deployment script for self-hosted PatchMon instances
# Usage: ./self-hosting-install.sh
# Interactive self-hosting installation script

set -e

# Create main installation log file
INSTALL_LOG="/var/log/patchmon-install.log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === PatchMon Self-Hosting Installation Started ===" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script PID: $$" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running as user: $(whoami)" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current directory: $(pwd)" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script arguments: $@" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $0" >> "$INSTALL_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ======================================" >> "$INSTALL_LOG"

# Create immediate debug log for troubleshooting
DEBUG_LOG="/tmp/patchmon_debug_$(date +%Y%m%d_%H%M%S).log"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === PatchMon Script Started ===" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script PID: $$" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Running as user: $(whoami)" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Current directory: $(pwd)" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script arguments: $@" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Script path: $0" >> "$DEBUG_LOG"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] ======================================" >> "$DEBUG_LOG"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Global variables
SCRIPT_VERSION="self-hosting-install.sh v1.2.7-selfhost-2025-01-20-1"
DEFAULT_GITHUB_REPO="https://github.com/PatchMon/PatchMon.git"
FQDN=""
CUSTOM_FQDN=""
EMAIL=""

# Logging function
function log_message() {
    local message="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local log_file="/var/log/patchmon-install.log"
    
    echo "[${timestamp}] ${message}" >> "$log_file"
    echo "[${timestamp}] ${message}"
}
DEPLOYMENT_BRANCH="main"
GITHUB_REPO=""
DB_SAFE_DB_DB_USER=""
DB_PASS=""
JWT_SECRET=""
BACKEND_PORT=""
APP_DIR=""
SERVICE_USE_LETSENCRYPT="true"  # Will be set based on user input
SERVER_PROTOCOL_SEL="https"
SERVER_PORT_SEL=""  # Will be set to BACKEND_PORT in init_instance_vars
SETUP_NGINX="true"

# Functions
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_question() {
    echo -e "${BLUE}❓ $1${NC}"
}

print_success() {
    echo -e "${GREEN}🎉 $1${NC}"
}

# Interactive input functions
read_input() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    
    if [ -n "$default_value" ]; then
        echo -n -e "${BLUE}$prompt${NC} [${YELLOW}$default_value${NC}]: "
    else
        echo -n -e "${BLUE}$prompt${NC}: "
    fi
    
    read -r input
    if [ -z "$input" ] && [ -n "$default_value" ]; then
        eval "$var_name='$default_value'"
    else
        eval "$var_name='$input'"
    fi
}

read_yes_no() {
    local prompt="$1"
    local var_name="$2"
    local default_value="$3"
    
    while true; do
        if [ -n "$default_value" ]; then
            echo -n -e "${BLUE}$prompt${NC} [${YELLOW}$default_value${NC}]: "
        else
            echo -n -e "${BLUE}$prompt${NC} (y/n): "
        fi
        read -r input
        
        if [ -z "$input" ] && [ -n "$default_value" ]; then
            input="$default_value"
        fi
        
        case $input in
            [Yy]|[Yy][Ee][Ss])
                eval "$var_name='y'"
                break
                ;;
            [Nn]|[Nn][Oo])
                eval "$var_name='n'"
                break
                ;;
            *)
                print_error "Please answer yes (y) or no (n)"
                ;;
        esac
    done
}

print_banner() {
    echo -e "${BLUE}====================================================${NC}"
    echo -e "${BLUE}        PatchMon Self-Hosting Installation${NC}"
    echo -e "${BLUE}Running: $SCRIPT_VERSION${NC}"
    echo -e "${BLUE}====================================================${NC}"
}

# Interactive setup functions
check_timezone() {
    print_info "Checking current timezone..."
    current_tz=$(timedatectl show --property=Timezone --value 2>/dev/null || echo "Unknown")
    
    if [ "$current_tz" != "Unknown" ]; then
        current_datetime=$(date)
        print_info "Current timezone: $current_tz"
        print_info "Current date/time: $current_datetime"
        read_yes_no "Is this timezone and date/time correct?" TIMEZONE_CORRECT "y"
        
        if [ "$TIMEZONE_CORRECT" = "n" ]; then
            print_info "Available timezones:"
            timedatectl list-timezones | head -20
            print_warning "Showing first 20 timezones. Use 'timedatectl list-timezones' to see all."
            read_input "Enter your timezone (e.g., America/New_York, Europe/London)" NEW_TIMEZONE
            
            if [ -n "$NEW_TIMEZONE" ]; then
                print_info "Setting timezone to $NEW_TIMEZONE..."
                timedatectl set-timezone "$NEW_TIMEZONE"
                print_status "Timezone updated to $NEW_TIMEZONE"
                
                # Show updated date/time
                updated_datetime=$(date)
                print_info "Updated date/time: $updated_datetime"
            fi
        fi
    else
        print_warning "Could not detect timezone. Please set it manually if needed."
        current_datetime=$(date)
        print_info "Current date/time: $current_datetime"
    fi
}

check_root() {
    if [[ $EUID -ne 0 ]]; then
        print_error "This script must be run as root"
        print_info "Please run: sudo $0"
        exit 1
    fi
}

# Function to run commands as a specific user with better error handling
run_as_user() {
    local user="$1"
    local command="$2"
    
    if ! command -v sudo >/dev/null 2>&1; then
        print_error "sudo is required but not installed. Please install sudo first."
        exit 1
    fi
    
    if ! id "$user" &>/dev/null; then
        print_error "User '$user' does not exist"
        exit 1
    fi
    
    sudo -u "$user" bash -c "$command"
}

# Detect and use the best available package manager
detect_package_manager() {
    # Prefer apt over apt-get for modern Debian/Ubuntu systems
    if command -v apt >/dev/null 2>&1; then
        PKG_MANAGER="apt"
        PKG_UPDATE="apt update"
        PKG_UPGRADE="apt upgrade -y"
        PKG_INSTALL="apt install -y"
    elif command -v apt-get >/dev/null 2>&1; then
        PKG_MANAGER="apt-get"
        PKG_UPDATE="apt-get update"
        PKG_UPGRADE="apt-get upgrade -y"
        PKG_INSTALL="apt-get install -y"
    else
        print_error "No supported package manager found (apt or apt-get required)"
        print_info "This script requires a Debian/Ubuntu-based system"
        exit 1
    fi
    
    print_info "Using package manager: $PKG_MANAGER"
}

check_prerequisites() {
    print_info "Running and checking prerequisites..."
    
    # Check if running as root
    check_root
    
    # Detect package manager
    detect_package_manager
    
    print_info "Installing updates..."
    $PKG_UPDATE -y
    $PKG_UPGRADE
    
    print_info "Installing prerequisite applications..."
    # Install sudo if not present (needed for user switching)
    if ! command -v sudo >/dev/null 2>&1; then
        print_info "Installing sudo (required for user switching)..."
        $PKG_INSTALL sudo
    fi
    
    $PKG_INSTALL wget curl jq git netcat-openbsd
    
    print_status "Prerequisites installed successfully"
}

select_branch() {
    print_info "Fetching available branches from GitHub repository..."
    
    # Create temporary directory for git operations
    TEMP_DIR="/tmp/patchmon_branches_$$"
    mkdir -p "$TEMP_DIR"
    cd "$TEMP_DIR"
    
    # Try to clone the repository normally
    if git clone "$DEFAULT_GITHUB_REPO" . 2>/dev/null; then
        # Get list of remote branches and trim whitespace
        branches=$(git branch -r | grep -v HEAD | sed 's/origin\///' | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//' | sort -u)
        
        if [ -n "$branches" ]; then
            print_info "Available branches with details:"
            echo ""
            
            # Get branch information
            branch_count=1
            while IFS= read -r branch; do
                if [ -n "$branch" ]; then
                    # Get last commit date for this branch
                    last_commit=$(git log -1 --format="%ci" "origin/$branch" 2>/dev/null || echo "Unknown")
                    
                    # Get release tag associated with this branch (if any)
                    release_tag=$(git describe --tags --exact-match "origin/$branch" 2>/dev/null || echo "")
                    
                    # Format the date
                    if [ "$last_commit" != "Unknown" ]; then
                        formatted_date=$(date -d "$last_commit" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$last_commit")
                    else
                        formatted_date="Unknown"
                    fi
                    
                    # Display branch info
                    printf "%2d. %-20s" "$branch_count" "$branch"
                    printf " (Last commit: %s)" "$formatted_date"
                    
                    if [ -n "$release_tag" ]; then
                        printf " [Release: %s]" "$release_tag"
                    fi
                    
                    echo ""
                    branch_count=$((branch_count + 1))
                fi
            done <<< "$branches"
            
            echo ""
            
            # Determine default selection: prefer 'main' if present
            main_index=$(echo "$branches" | nl -w1 -s':' | awk -F':' '$2=="main"{print $1}' | head -1)
            if [ -z "$main_index" ]; then
                main_index=1
            fi
            
            while true; do
                read_input "Select branch number" BRANCH_NUMBER "$main_index"
                
                if [[ "$BRANCH_NUMBER" =~ ^[0-9]+$ ]]; then
                    selected_branch=$(echo "$branches" | sed -n "${BRANCH_NUMBER}p" | sed 's/^[[:space:]]*//' | sed 's/[[:space:]]*$//')
                    if [ -n "$selected_branch" ]; then
                        DEPLOYMENT_BRANCH="$selected_branch"
                        
                        # Show additional info for selected branch
                        last_commit=$(git log -1 --format="%ci" "origin/$selected_branch" 2>/dev/null || echo "Unknown")
                        release_tag=$(git describe --tags --exact-match "origin/$selected_branch" 2>/dev/null || echo "")
                        
                        if [ "$last_commit" != "Unknown" ]; then
                            formatted_date=$(date -d "$last_commit" "+%Y-%m-%d %H:%M" 2>/dev/null || echo "$last_commit")
                        else
                            formatted_date="Unknown"
                        fi
                        
                        print_status "Selected branch: $DEPLOYMENT_BRANCH"
                        print_info "Last commit: $formatted_date"
                        if [ -n "$release_tag" ]; then
                            print_info "Release tag: $release_tag"
                        fi
                        break
                    else
                        print_error "Invalid branch number. Please try again."
                    fi
                else
                    print_error "Please enter a valid number."
                fi
            done
        else
            print_warning "No branches found, using default: main"
            DEPLOYMENT_BRANCH="main"
        fi
    else
        print_warning "Could not connect to GitHub repository"
        print_warning "This might be due to:"
        print_warning "  • Network connectivity issues"
        print_warning "  • Firewall blocking git access"
        print_warning "  • GitHub repository access restrictions"
        print_warning "Using default branch: main"
        DEPLOYMENT_BRANCH="main"
    fi
    
    # Clean up
    cd /
    rm -rf "$TEMP_DIR"
}

interactive_setup() {
    print_banner
    
    print_info "Welcome to PatchMon Self-Hosting Installation!"
    print_info "This script will guide you through the installation process."
    echo ""
    
    # Check prerequisites
    check_prerequisites
    echo ""
    
    # Check timezone
    check_timezone
    echo ""
    
    # Get basic information
    print_question "Let's gather some information about your installation:"
    echo ""
    
    read_input "Enter your domain name or IP address (e.g., patchmon.yourdomain.com or 192.168.1.100)" FQDN "patchmon.internal"
    
    echo ""
    print_info "🔒 SSL/HTTPS Configuration:"
    print_info "   • Public hosting (accessible from internet): Enable SSL for security"
    print_info "   • Local hosting (internal network only): SSL not required"
    echo ""
    read_yes_no "Are you hosting this publicly on the internet and want SSL/HTTPS with Let's Encrypt?" SSL_ENABLED "n"
    
    if [ "$SSL_ENABLED" = "y" ]; then
        read_input "Enter your email address for Let's Encrypt SSL certificate" EMAIL
    else
        EMAIL=""
    fi
    
    
    # Select branch
    echo ""
    select_branch
    echo ""
    
    # Confirm settings
    print_info "Please confirm your settings:"
    echo "  Domain/IP: $FQDN"
    echo "  SSL Enabled: $SSL_ENABLED"
    if [ "$SSL_ENABLED" = "y" ]; then
        echo "  Email: $EMAIL"
    fi
    echo "  Branch: $DEPLOYMENT_BRANCH"
    echo ""
    
    read_yes_no "Proceed with installation?" CONFIRM_INSTALL "y"
    
    if [ "$CONFIRM_INSTALL" = "n" ]; then
        print_info "Installation cancelled by user."
        exit 0
    fi
    
    print_success "Starting installation process..."
    echo ""
}

# Generate random password
generate_password() {
    openssl rand -base64 32 | tr -d "=+/" | cut -c1-25
}

# Generate JWT secret
generate_jwt_secret() {
    openssl rand -base64 64 | tr -d "=+/" | cut -c1-50
}

# Initialize instance variables
init_instance_vars() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] init_instance_vars function started" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating safe database name from FQDN: $FQDN" >> "$DEBUG_LOG"
    
    # Create safe database name from FQDN
    DB_SAFE_NAME=$(echo "$FQDN" | sed 's/[^a-zA-Z0-9]/_/g' | sed 's/^_*//' | sed 's/_*$//')
    
    # Check if FQDN starts with a digit (likely an IP address)
    if [[ "$FQDN" =~ ^[0-9] ]]; then
        # Generate 2 random letters for IP address prefixing
        RANDOM_PREFIX=$(tr -dc 'a-z' < /dev/urandom | head -c 2)
        DB_SAFE_NAME="${RANDOM_PREFIX}${DB_SAFE_NAME}"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] IP address detected, prefixed with: $RANDOM_PREFIX" >> "$DEBUG_LOG"
        print_info "IP address detected ($FQDN), using prefix '$RANDOM_PREFIX' for database/service names"
    fi
    
    DB_NAME="${DB_SAFE_NAME}"
    DB_USER="${DB_SAFE_NAME}"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DB_SAFE_NAME: $DB_SAFE_NAME" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DB_NAME: $DB_NAME" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] DB_USER: $DB_USER" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating password..." >> "$DEBUG_LOG"
    DB_PASS=$(generate_password)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating JWT secret..." >> "$DEBUG_LOG"
    JWT_SECRET=$(generate_jwt_secret)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Generating random backend port..." >> "$DEBUG_LOG"
    
    # Generate random backend port (3001-3999)
    BACKEND_PORT=$((3001 + RANDOM % 999))
    
    # Set SERVER_PORT_SEL to 443 for HTTPS (external port) or backend port for HTTP
    if [ "$SERVER_PROTOCOL_SEL" = "https" ]; then
        SERVER_PORT_SEL=443
    else
        SERVER_PORT_SEL=$BACKEND_PORT
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] BACKEND_PORT: $BACKEND_PORT" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SERVER_PORT_SEL: $SERVER_PORT_SEL" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Setting application directory and service name..." >> "$DEBUG_LOG"
    
    # Set application directory and service name
    APP_DIR="/opt/${FQDN}"
    SERVICE_NAME="${FQDN}"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] APP_DIR: $APP_DIR" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] SERVICE_NAME: $SERVICE_NAME" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Creating dedicated user name..." >> "$DEBUG_LOG"
    
    # Create dedicated user name (safe for system users)
    INSTANCE_USER=$(echo "$DB_SAFE_NAME" | cut -c1-32)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] INSTANCE_USER: $INSTANCE_USER" >> "$DEBUG_LOG"
    
    print_info "Initialized variables for $FQDN"
    print_info "Database: $DB_NAME"
    print_info "Backend Port: $BACKEND_PORT"
    print_info "App Directory: $APP_DIR"
    print_info "Instance User: $INSTANCE_USER"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] init_instance_vars function completed successfully" >> "$DEBUG_LOG"
}

# Update system packages
update_system() {
    print_info "Updating system packages..."
    $PKG_UPDATE -y
    $PKG_UPGRADE
}

# Install essential tools
install_essential_tools() {
    print_info "Installing essential tools..."
    $PKG_INSTALL curl netcat-openbsd git jq
}

# Install Node.js (if not already installed)
install_nodejs() {
    # Force PATH refresh to ensure we get the latest Node.js
    export PATH="/usr/bin:/usr/local/bin:$PATH"
    hash -r  # Clear bash command cache
    
    NODE_VERSION=""
    if command -v node >/dev/null 2>&1; then
        NODE_VERSION=$(node --version 2>/dev/null | sed 's/v//')
        print_info "Node.js already installed: v$NODE_VERSION"
        
        # Check if version is 18 or higher
        if [ "$(echo "$NODE_VERSION" | cut -d. -f1)" -ge 18 ]; then
            print_status "Node.js version is sufficient (v$NODE_VERSION)"
            # Clean npm cache to avoid issues
            npm cache clean --force 2>/dev/null || true
            return 0
        else
            print_warning "Node.js version $NODE_VERSION is too old, updating..."
        fi
    fi
    
    print_info "Installing Node.js 20.x..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    $PKG_INSTALL nodejs
    
    # Verify installation
    NODE_VERSION=$(node --version | sed 's/v//')
    NPM_VERSION=$(npm --version)
    print_status "Node.js installed: v$NODE_VERSION"
    print_status "npm installed: v$NPM_VERSION"
    
    # Clean npm cache to avoid issues
    npm cache clean --force 2>/dev/null || true
}

# Install PostgreSQL
install_postgresql() {
    print_info "Installing PostgreSQL..."
    
    if systemctl is-active --quiet postgresql; then
        print_status "PostgreSQL already running"
    else
        $PKG_INSTALL postgresql postgresql-contrib
        systemctl start postgresql
        systemctl enable postgresql
        print_status "PostgreSQL installed and started"
    fi
}

# Install nginx
install_nginx() {
    print_info "Installing nginx..."
    
    if systemctl is-active --quiet nginx; then
        print_status "nginx already running"
    else
        $PKG_INSTALL nginx
        systemctl start nginx
        systemctl enable nginx
        print_status "nginx installed and started"
    fi
}

# Install certbot for Let's Encrypt
install_certbot() {
    print_info "Installing certbot for Let's Encrypt..."
    
    if command -v certbot >/dev/null 2>&1; then
        print_status "certbot already installed"
    else
        $PKG_INSTALL certbot python3-certbot-nginx
        print_status "certbot installed"
    fi
}

# Create dedicated user for this instance
create_instance_user() {
    print_info "Creating dedicated user: $INSTANCE_USER"
    
    # Create application directory first (as root)
    mkdir -p "$APP_DIR"
    
    # Check if user already exists
    if id "$INSTANCE_USER" &>/dev/null; then
        print_warning "User $INSTANCE_USER already exists, skipping creation"
        # Ensure directory ownership is correct for existing user
        chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR"
        chmod 755 "$APP_DIR"
        return 0
    fi
    
    # Create user with no login shell and no home directory
    useradd --system --no-create-home --shell /bin/false "$INSTANCE_USER"
    
    # Set ownership and permissions
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR"
    chmod 755 "$APP_DIR"
    
    print_status "Dedicated user $INSTANCE_USER created successfully"
}

# Setup Node.js environment isolation for this instance
setup_nodejs_isolation() {
    print_info "Setting up Node.js environment isolation for $INSTANCE_USER..."
    
    # Create npm directories as root first
    mkdir -p "$APP_DIR/.npm" "$APP_DIR/.npm-global"
    
    # Create .npmrc file with proper configuration
    cat > "$APP_DIR/.npmrc" << EOF
cache=$APP_DIR/.npm
prefix=$APP_DIR/.npm-global
init-module=$APP_DIR/.npm-global/.npm-init.js
tmp=$APP_DIR/.npm/tmp
EOF
    
    # Set ownership to the dedicated user
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR/.npm" "$APP_DIR/.npm-global" "$APP_DIR/.npmrc"
    
    print_status "Node.js environment isolation configured for $INSTANCE_USER"
}

# Setup database for instance
setup_database() {
    print_info "Creating database: $DB_NAME"
    
    # Check if sudo is available for user switching
    if command -v sudo >/dev/null 2>&1; then
        # Drop and recreate database and user for clean state
        sudo -u postgres psql -c "DROP DATABASE IF EXISTS $DB_NAME;" || true
        sudo -u postgres psql -c "DROP USER IF EXISTS $DB_USER;" || true
        
        # Create database and user
        sudo -u postgres psql -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';"
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"
        sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"
    else
        # Alternative method for systems without sudo (run as postgres user directly)
        print_warning "sudo not available, using alternative method for PostgreSQL setup"
        
        # Switch to postgres user using su
        su - postgres -c "psql -c \"DROP DATABASE IF EXISTS $DB_NAME;\"" || true
        su - postgres -c "psql -c \"DROP USER IF EXISTS $DB_USER;\"" || true
        su - postgres -c "psql -c \"CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';\""
        su - postgres -c "psql -c \"CREATE DATABASE $DB_NAME OWNER $DB_USER;\""
        su - postgres -c "psql -c \"GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;\""
    fi
    
    print_status "Database $DB_NAME created with user $DB_USER"
}

# Clone application repository
clone_application() {
    print_info "Cloning PatchMon application..."
    
    if [ -d "$APP_DIR" ]; then
        print_warning "Directory $APP_DIR already exists, removing..."
        rm -rf "$APP_DIR"
    fi
    
    git clone -b "$DEPLOYMENT_BRANCH" "$GITHUB_REPO" "$APP_DIR"
    
    # Set ownership to the dedicated user
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR"
    
    cd "$APP_DIR"
    
    print_status "Application cloned to $APP_DIR with ownership set to $INSTANCE_USER"
}

# Setup Node.js environment
setup_node_environment() {
    print_info "Setting up Node.js environment..."
    
    cd "$APP_DIR"
    
    # Set Node.js environment
    export NODE_ENV=production
    export PATH="/usr/bin:/usr/local/bin:$PATH"
    
    print_status "Node.js environment configured"
}

# Install dependencies
install_dependencies() {
    print_info "Installing dependencies as user $INSTANCE_USER..."
    
    cd "$APP_DIR"
    
    # Clean up any existing node_modules to avoid conflicts
    rm -rf node_modules
    
    # Create tmp directory for npm
    mkdir -p "$APP_DIR/.npm/tmp"
    
    # Fix npm cache ownership issues (common problem)
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR/.npm"
    
    # Clean npm cache to avoid permission issues
    run_as_user "$INSTANCE_USER" "cd $APP_DIR && npm cache clean --force" 2>/dev/null || true
    
    # Install root dependencies as the dedicated user
    print_info "Installing root dependencies..."
    if ! run_as_user "$INSTANCE_USER" "
        cd $APP_DIR
        export NPM_CONFIG_CACHE=$APP_DIR/.npm
        export NPM_CONFIG_PREFIX=$APP_DIR/.npm-global
        export NPM_CONFIG_TMP=$APP_DIR/.npm/tmp
        npm install --omit=dev --no-audit --no-fund --no-save --ignore-scripts
    "; then
        print_error "Failed to install root dependencies"
        return 1
    fi
    
    # Install backend dependencies as the dedicated user
    print_info "Installing backend dependencies..."
    cd backend
    rm -rf node_modules
    if ! run_as_user "$INSTANCE_USER" "
        cd $APP_DIR/backend
        export NPM_CONFIG_CACHE=$APP_DIR/.npm
        export NPM_CONFIG_PREFIX=$APP_DIR/.npm-global
        export NPM_CONFIG_TMP=$APP_DIR/.npm/tmp
        npm install --omit=dev --no-audit --no-fund --no-save --ignore-scripts
    "; then
        print_error "Failed to install backend dependencies"
        return 1
    fi
    cd ..
    
    # Install frontend dependencies as the dedicated user (including dev dependencies for build)
    print_info "Installing frontend dependencies..."
    cd frontend
    rm -rf node_modules
    if ! run_as_user "$INSTANCE_USER" "
        cd $APP_DIR/frontend
        export NPM_CONFIG_CACHE=$APP_DIR/.npm
        export NPM_CONFIG_PREFIX=$APP_DIR/.npm-global
        export NPM_CONFIG_TMP=$APP_DIR/.npm/tmp
        npm install --no-audit --no-fund --no-save --ignore-scripts
    "; then
        print_error "Failed to install frontend dependencies"
        return 1
    fi
    
    # Build frontend
    print_info "Building frontend..."
    if ! run_as_user "$INSTANCE_USER" "
        cd $APP_DIR/frontend
        export NPM_CONFIG_CACHE=$APP_DIR/.npm
        export NPM_CONFIG_PREFIX=$APP_DIR/.npm-global
        export NPM_CONFIG_TMP=$APP_DIR/.npm/tmp
        npm run build
    "; then
        print_error "Failed to build frontend"
        return 1
    fi
    cd ..
    
    # Ensure ownership is maintained
    chown -R "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR"
    
    print_status "Dependencies installed and frontend built as $INSTANCE_USER"
}

# Create environment files
create_env_files() {
    print_info "Creating environment files..."
    
    cd "$APP_DIR"
    
    # Backend .env
    cat > backend/.env << EOF
# Database Configuration
DATABASE_URL="postgresql://$DB_USER:$DB_PASS@localhost:5432/$DB_NAME"

# JWT Configuration
JWT_SECRET="$JWT_SECRET"

# Server Configuration
PORT=$BACKEND_PORT
NODE_ENV=production

# API Configuration
API_VERSION=v1

# CORS Configuration
CORS_ORIGIN="$SERVER_PROTOCOL_SEL://$FQDN"

# Rate Limiting (times in milliseconds)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=5000
AUTH_RATE_LIMIT_WINDOW_MS=600000
AUTH_RATE_LIMIT_MAX=500
AGENT_RATE_LIMIT_WINDOW_MS=60000
AGENT_RATE_LIMIT_MAX=1000

# Logging
LOG_LEVEL=info
EOF

    # Frontend .env
    cat > frontend/.env << EOF
VITE_API_URL=$SERVER_PROTOCOL_SEL://$FQDN/api/v1
VITE_APP_NAME=PatchMon
VITE_APP_VERSION=1.2.7
EOF

    print_status "Environment files created"
}

# Run database migrations
run_migrations() {
    print_info "Running database migrations as user $INSTANCE_USER..."
    
    cd "$APP_DIR/backend"
    # Suppress Prisma CLI output (still logged to install log via tee)
    run_as_user "$INSTANCE_USER" "cd $APP_DIR/backend && npx prisma migrate deploy" >/dev/null 2>&1 || true
    run_as_user "$INSTANCE_USER" "cd $APP_DIR/backend && npx prisma generate" >/dev/null 2>&1 || true
    
    print_status "Database migrations completed as $INSTANCE_USER"
}

# Admin account creation removed - handled by application's first-time setup

# Create systemd service
create_systemd_service() {
    print_info "Creating systemd service for user $INSTANCE_USER..."
    
    cat > "/etc/systemd/system/$SERVICE_NAME.service" << EOF
[Unit]
Description=PatchMon Service for $FQDN
After=network.target postgresql.service

[Service]
Type=simple
User=$INSTANCE_USER
Group=$INSTANCE_USER
WorkingDirectory=$APP_DIR/backend
ExecStart=/usr/bin/node src/server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$APP_DIR

[Install]
WantedBy=multi-user.target
EOF

    systemctl daemon-reload
    systemctl enable "$SERVICE_NAME"
    
    print_status "Systemd service created: $SERVICE_NAME (running as $INSTANCE_USER)"
}

# Setup nginx configuration
setup_nginx() {
    print_info "Setting up nginx configuration..."
    log_message "Setting up nginx configuration for $FQDN"
    
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        # HTTP-only config first for Certbot challenge
        cat > "/etc/nginx/sites-available/$FQDN" << EOF
server {
    listen 80;
    server_name $FQDN;
    
    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }
    
    location / {
        return 301 https://\$server_name\$request_uri;
    }
}
EOF
    else
        # HTTP-only configuration for local hosting
        cat > "/etc/nginx/sites-available/$FQDN" << EOF
server {
    listen 80;
    server_name $FQDN;
    
    # Frontend
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
    
    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        access_log off;
    }
}
EOF
    fi

    # Enable site
    ln -sf "/etc/nginx/sites-available/$FQDN" "/etc/nginx/sites-enabled/"
    
    # Remove default site if it exists
    rm -f /etc/nginx/sites-enabled/default
    
    # Test nginx configuration
    nginx -t
    
    # Reload nginx
    systemctl reload nginx
    
    print_status "nginx configuration created for $FQDN"
}

# Setup Let's Encrypt SSL
setup_letsencrypt() {
    print_info "Setting up Let's Encrypt SSL certificate..."
    
    # Check if a valid certificate already exists
    if certbot certificates 2>/dev/null | grep -q "$FQDN" && certbot certificates 2>/dev/null | grep -A 10 "$FQDN" | grep -q "VALID"; then
        print_status "Valid SSL certificate already exists for $FQDN, skipping certificate generation"
        
        # Update Nginx config with existing HTTPS configuration
        cat > "/etc/nginx/sites-available/$FQDN" << EOF
server {
    listen 80;
    server_name $FQDN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $FQDN;
    
    ssl_certificate /etc/letsencrypt/live/$FQDN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$FQDN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # Frontend
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
    }
    
    # API proxy
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
    }
}
EOF
        
        # Enable the site
        ln -sf "/etc/nginx/sites-available/$FQDN" "/etc/nginx/sites-enabled/"
        
        # Test nginx configuration
        if nginx -t; then
            print_status "Nginx configuration updated for existing SSL certificate"
            systemctl reload nginx
        else
            print_error "Nginx configuration test failed"
            return 1
        fi
        
        return 0
    fi
    
    print_info "No valid certificate found, generating new SSL certificate..."
    
    # Wait a moment for nginx to be ready
    sleep 5
    
    # Obtain SSL certificate
    log_message "Obtaining SSL certificate for $FQDN using Let's Encrypt"
    certbot --nginx -d "$FQDN" --non-interactive --agree-tos --email "$EMAIL" --redirect
    log_message "SSL certificate obtained successfully"
    
    # Update Nginx config with full HTTPS configuration
    cat > "/etc/nginx/sites-available/$FQDN" << EOF
server {
    listen 80;
    server_name $FQDN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $FQDN;
    
    ssl_certificate /etc/letsencrypt/live/$FQDN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$FQDN/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
    
    # Frontend
    location / {
        root $APP_DIR/frontend/dist;
        try_files \$uri \$uri/ /index.html;
        
        # Security headers
        add_header X-Frame-Options DENY;
        add_header X-Content-Type-Options nosniff;
        add_header X-XSS-Protection "1; mode=block";
        add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    }
    
    # API routes
    location /api/ {
        proxy_pass http://127.0.0.1:$BACKEND_PORT;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_cache_bypass \$http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
    
    # Health check
    location /health {
        proxy_pass http://127.0.0.1:$BACKEND_PORT/health;
        access_log off;
    }
}
EOF
    
    nginx -t
    nginx -s reload
    
    # Setup auto-renewal
    echo "0 12 * * * /usr/bin/certbot renew --quiet" | crontab -
    
    print_status "SSL certificate obtained and auto-renewal configured"
}

# Start services
start_services() {
    print_info "Starting services..."
    
    # Start PatchMon service
    systemctl start "$SERVICE_NAME"
    
    # Wait for service to start
    sleep 10
    
    # Check if service is running
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_status "PatchMon service started successfully"
    else
        print_error "Failed to start PatchMon service"
        systemctl status "$SERVICE_NAME"
        return 1
    fi
}

# Populate server settings in database
populate_server_settings() {
    print_info "Populating server settings in database..."
    
    cd "$APP_DIR/backend"
    
    # Create settings update script
    cat > update_settings.js << EOF
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateSettings() {
  try {
    // Check if settings record exists, create or update
    const existingSettings = await prisma.settings.findFirst();
    
    const settingsData = {
      server_url: '$SERVER_PROTOCOL_SEL://$FQDN',
      server_protocol: '$SERVER_PROTOCOL_SEL',
      server_host: '$FQDN',
      server_port: $SERVER_PORT_SEL,
      update_interval: 60,
      auto_update: true
    };
    
    if (existingSettings) {
      // Update existing settings
      await prisma.settings.update({
        where: { id: existingSettings.id },
        data: settingsData
      });
    } else {
      // Create new settings record
      await prisma.settings.create({
        data: settingsData
      });
    }
    
    console.log('✅ Database settings updated successfully');
  } catch (error) {
    console.error('❌ Error updating settings:', error.message);
    process.exit(1);
  } finally {
    await prisma.\$disconnect();
  }
}

updateSettings();
EOF

    # Run the settings update script as the dedicated user
    run_as_user "$INSTANCE_USER" "cd $APP_DIR/backend && node update_settings.js"
    
    # Clean up temporary script
    rm -f update_settings.js
    
    print_status "Server settings populated successfully"
}

# Create agent version
create_agent_version() {
    echo -e "${BLUE}🤖 Creating agent version...${NC}"
    log_message "Creating agent version in database..."
    cd $APP_DIR/backend
    
    # Priority 1: Get version from agent script (most accurate for agent versions)
    local current_version="N/A"
    if [ -f "$APP_DIR/agents/patchmon-agent.sh" ]; then
        current_version=$(grep '^AGENT_VERSION=' "$APP_DIR/agents/patchmon-agent.sh" | cut -d'"' -f2 2>/dev/null || echo "N/A")
        if [ "$current_version" != "N/A" ] && [ -n "$current_version" ]; then
            print_info "Detected agent version from script: $current_version"
        fi
    fi
    
    # Priority 2: Use fallback version if not found
    if [ "$current_version" = "N/A" ] || [ -z "$current_version" ]; then
        current_version="1.2.7"
        print_warning "Could not determine version, using fallback: $current_version"
    fi
    
    print_info "Creating/updating agent version: $current_version"
    print_info "This will ensure the latest agent script is available in the database"
    
    # Test connection before creating agent version
    if ! PGPASSWORD="$DB_PASS" psql -h localhost -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" >/dev/null 2>&1; then
        print_error "Cannot connect to database before creating agent version"
        exit 1
    fi
    
    # Copy agent script to backend directory
    if [ -f "$APP_DIR/agents/patchmon-agent.sh" ]; then
        cp "$APP_DIR/agents/patchmon-agent.sh" "$APP_DIR/backend/"
        
        print_status "Agent version management removed - using file-based approach"
# Ensure we close the conditional and the function properly
    fi

    return 0
}
# Create deployment summary
create_deployment_summary() {
    print_info "Writing deployment summary into deployment-info.txt..."
    
    # Reuse the unified deployment info file
    SUMMARY_FILE="$APP_DIR/deployment-info.txt"
    
    cat >> "$SUMMARY_FILE" << EOF

----------------------------------------------------
        Deployment Summary (Appended)
----------------------------------------------------

Deployment Information:
- Email: $EMAIL
- Branch: $DEPLOYMENT_BRANCH
- Deployed: $(date)
- Deployment Duration: $(($(date +%s) - $DEPLOYMENT_START_TIME)) seconds

Service Status:
- PatchMon Service: $(systemctl is-active $SERVICE_NAME)
- Nginx Service: $(systemctl is-active nginx)
- PostgreSQL Service: $(systemctl is-active postgresql)
- SSL Certificate: $(if [ "$USE_LETSENCRYPT" = "true" ]; then echo "Enabled"; else echo "Disabled"; fi)

Diagnostic Commands:
- Service Status: systemctl status $SERVICE_NAME
- Service Logs: journalctl -u $SERVICE_NAME -f
- Nginx Status: systemctl status nginx
- Nginx Logs: journalctl -u nginx -f
- Database Status: systemctl status postgresql
- SSL Certificate: certbot certificates
- Disk Usage: df -h $APP_DIR
- Process Status: ps aux | grep $SERVICE_NAME

Troubleshooting:
- Check deployment log: cat $APP_DIR/patchmon-install.log
- Check service logs: journalctl -u $SERVICE_NAME --since "1 hour ago"
- Check nginx config: nginx -t
- Check database connection: sudo -u $DB_USER psql -d $DB_NAME -c "SELECT 1;"
- Check port binding: netstat -tlnp | grep $BACKEND_PORT

====================================================
EOF

    # Ensure permissions
    chmod 644 "$SUMMARY_FILE"
    chown "$INSTANCE_USER:$INSTANCE_USER" "$SUMMARY_FILE"
    
    # Copy the entire installation log into the instance folder
    if [ -f "$INSTALL_LOG" ]; then
        cp "$INSTALL_LOG" "$APP_DIR/patchmon-install.log" || true
        chown "$INSTANCE_USER:$INSTANCE_USER" "$APP_DIR/patchmon-install.log" || true
        chmod 644 "$APP_DIR/patchmon-install.log" || true
    fi
    
    print_status "Unified deployment info saved to: $SUMMARY_FILE"
}

# Email notification function removed for self-hosting deployment

# Save deployment information to file
save_deployment_info() {
    print_info "Saving deployment information to file..."
    
    # Create deployment info file
    INFO_FILE="$APP_DIR/deployment-info.txt"
    
    cat > "$INFO_FILE" << EOF
====================================================
        PatchMon Deployment Information
====================================================

Instance Details:
- FQDN: $FQDN
- URL: $SERVER_PROTOCOL_SEL://$FQDN
- Deployed: $(date)
- Deployment Type: $(if [ "$USE_LETSENCRYPT" = "true" ]; then echo "Public with SSL"; else echo "Local/Internal"; fi)
- SSL Enabled: $USE_LETSENCRYPT
- Service Name: $SERVICE_NAME

Directories:
- App Directory: $APP_DIR
- Backend: $APP_DIR/backend
- Frontend (built): $APP_DIR/frontend/dist
- Node.js isolation dir: $APP_DIR/.npm

Database Information:
- Name: $DB_NAME
- User: $DB_USER
- Password: $DB_PASS
- Host: localhost
- Port: 5432

Networking:
- Backend Port: $BACKEND_PORT
- Nginx Config: /etc/nginx/sites-available/$FQDN

Logs & Files:
- Deployment Log: $LOG_FILE
- Systemd Service: /etc/systemd/system/$SERVICE_NAME.service

Common Commands:
- Restart backend service: sudo systemctl restart $SERVICE_NAME
- Check backend status:   systemctl status $SERVICE_NAME
- Tail backend logs:      journalctl -u $SERVICE_NAME -f
- Test nginx config:      nginx -t && systemctl reload nginx
- Check DB connection:    sudo -u $DB_USER psql -d $DB_NAME -c "SELECT 1;"

First-Time Setup:
- Visit the web interface: $SERVER_PROTOCOL_SEL://$FQDN
- Create the admin account through the web UI (no pre-created credentials)

Notes:
- Default role permissions (admin/user) are created automatically on backend startup
- Keep this file for future reference of your environment

====================================================
EOF

    # Set permissions (readable by root and instance user)
    chmod 644 "$INFO_FILE"
    chown "$INSTANCE_USER:$INSTANCE_USER" "$INFO_FILE"
    
    print_status "Deployment information saved to: $INFO_FILE"
}

# Restart PatchMon service
restart_patchmon() {
    print_info "Restarting PatchMon service..."
    
    # Restart PatchMon service
    systemctl restart "$SERVICE_NAME"
    
    # Wait for service to restart
    sleep 5
    
    # Check if service is running
    if systemctl is-active --quiet "$SERVICE_NAME"; then
        print_status "PatchMon service restarted successfully"
    else
        print_error "Failed to restart PatchMon service"
        systemctl status "$SERVICE_NAME"
        return 1
    fi
}

# Setup logging for deployment
setup_deployment_logging() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] setup_deployment_logging function started" >> "$DEBUG_LOG"
    
    print_info "Setting up deployment logging..."
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] APP_DIR variable: $APP_DIR" >> "$DEBUG_LOG"
    
    # Use the main installation log file
    LOG_FILE="$INSTALL_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Using main log file: $LOG_FILE" >> "$DEBUG_LOG"
    
    print_info "Deployment log: $LOG_FILE"
    
    # Function to log with timestamp
    log_output() {
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"
    }
    
    # Redirect all output to both terminal and log file
    exec > >(tee -a "$LOG_FILE")
    exec 2>&1
    
    log_output "=== PatchMon Deployment Started ==="
    log_output "Script started at: $(date)"
    log_output "Script PID: $$"
    log_output "Running as user: $(whoami)"
    log_output "Current directory: $(pwd)"
    log_output "Script arguments: $@"
    log_output "FQDN: $FQDN"
    log_output "Email: $EMAIL"
    log_output "Branch: $DEPLOYMENT_BRANCH"
    log_output "SSL Enabled: $USE_LETSENCRYPT"
    log_output "====================================="
}

# Main deployment function
deploy_instance() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] deploy_instance function started" >> "$DEBUG_LOG"
    
    log_message "=== SELF-HOSTING-INSTALL.SH DEPLOYMENT STARTED ==="
    log_message "Script version: $SCRIPT_VERSION"
    log_message "FQDN: $FQDN"
    log_message "Email: $EMAIL"
    log_message "SSL Enabled: $USE_LETSENCRYPT"
    
    print_banner
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Skipping early logging setup - will do after variables initialized" >> "$DEBUG_LOG"
    
    # Record deployment start time
    DEPLOYMENT_START_TIME=$(date +%s)
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] About to validate parameters" >> "$DEBUG_LOG"
    
    # Parameters are already validated in interactive_setup
    print_info "All parameters validated successfully"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Parameter validation passed" >> "$DEBUG_LOG"
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Checking if instance already exists at /opt/$FQDN" >> "$DEBUG_LOG"
    
    # Check if instance already exists
    if [ -d "/opt/$FQDN" ]; then
        print_error "Instance for $FQDN already exists at /opt/$FQDN"
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR: Instance already exists" >> "$DEBUG_LOG"
        exit 1
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Instance check passed - no existing instance found" >> "$DEBUG_LOG"
    
    print_info "🚀 Deploying PatchMon instance for $FQDN"
    print_info "📧 Email: $EMAIL"
    print_info "🌿 Branch: $DEPLOYMENT_BRANCH"
    print_info "🔒 SSL: $USE_LETSENCRYPT"
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        print_info "📧 SSL Email: $EMAIL"
    fi
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] About to call init_instance_vars function" >> "$DEBUG_LOG"
    
    # Initialize variables
    init_instance_vars
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] init_instance_vars function completed" >> "$DEBUG_LOG"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Variables initialized, APP_DIR: $APP_DIR" >> "$DEBUG_LOG"
    
    # Setup logging (after variables are initialized)
    setup_deployment_logging
    
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Deployment logging setup completed" >> "$DEBUG_LOG"
    
    # Display generated credentials
    echo -e "${BLUE}🔐 Auto-generated credentials:${NC}"
    echo -e "${YELLOW}Database Name: $DB_NAME${NC}"
    echo -e "${YELLOW}Database User: $DB_USER${NC}"
    echo -e "${YELLOW}Database Password: $DB_PASS${NC}"
    echo -e "${YELLOW}JWT Secret: $JWT_SECRET${NC}"
    echo -e "${YELLOW}Backend Port: $BACKEND_PORT${NC}"
    echo -e "${YELLOW}Instance User: $INSTANCE_USER${NC}"
    echo -e "${YELLOW}Node.js Isolation: $APP_DIR/.npm${NC}"
    echo ""
    
    # System setup (prerequisites already installed in interactive_setup)
    install_nodejs
    install_postgresql
    install_nginx
    
    # Only install certbot if SSL is enabled
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        install_certbot
    fi
    
    # Instance-specific setup
    create_instance_user
    setup_nodejs_isolation
    setup_database
    clone_application
    setup_node_environment
    install_dependencies
    create_env_files
    run_migrations
    # Admin account creation removed - handled by application's first-time setup
    
    # Service and web server setup
    create_systemd_service
    setup_nginx
    
    # SSL setup (if enabled)
    if [ "$USE_LETSENCRYPT" = "true" ]; then
        setup_letsencrypt
    else
        print_info "SSL disabled - skipping SSL certificate setup"
    fi
    
    # Start services
    start_services
    
    # Populate server settings in database
    populate_server_settings
    
    # Create agent version in database
    create_agent_version
    
    # Restart PatchMon service to ensure it's running properly
    restart_patchmon
    
    # Save deployment information to file
    save_deployment_info
    
    # Create deployment summary
    create_deployment_summary
    
    # Email notifications removed for self-hosting deployment
    
    # Final status
    log_message "=== DEPLOYMENT COMPLETED SUCCESSFULLY ==="
    log_message "Instance URL: $SERVER_PROTOCOL_SEL://$FQDN"
    log_message "Service name: $SERVICE_NAME"
    log_message "Backend port: $BACKEND_PORT"
    log_message "SSL enabled: $USE_LETSENCRYPT"
    
    print_status "🎉 PatchMon instance deployed successfully!"
    echo ""
    print_info "Next steps:"
    echo "  • Visit your URL: $SERVER_PROTOCOL_SEL://$FQDN (ensure DNS is configured)"
    echo "  • Useful deployment information is stored in: $APP_DIR/deployment-info.txt"
    echo ""
    
    # Suppress JSON echo to terminal; details already logged and saved to summary/credentials files
    :
}

# Main script execution
main() {
    # Log script entry
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Interactive installation started" >> "$DEBUG_LOG"
    
    # Run interactive setup
    interactive_setup
    
    # Set GitHub repo (always use public repo for self-hosted deployments)
    GITHUB_REPO="$DEFAULT_GITHUB_REPO"
    
    # Validate SSL setting
    if [ "$SSL_ENABLED" = "y" ] || [ "$SSL_ENABLED" = "yes" ]; then
        USE_LETSENCRYPT="true"
        SERVER_PROTOCOL_SEL="https"
        print_info "SSL enabled - will use Let's Encrypt for HTTPS"
        
        # Validate email for SSL
        if [ -z "$EMAIL" ]; then
            print_error "Email is required when SSL is enabled for Let's Encrypt"
            exit 1
        fi
    else
        USE_LETSENCRYPT="false"
        SERVER_PROTOCOL_SEL="http"
        print_info "SSL disabled - will use HTTP only"
    fi
    
    # Log before calling deploy_instance
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] About to call deploy_instance function" >> "$DEBUG_LOG"
    
    # Run deployment
    deploy_instance
    
    # Log after deploy_instance completes
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] deploy_instance function completed" >> "$DEBUG_LOG"
}

# Run main function (no arguments needed for interactive mode)
main
