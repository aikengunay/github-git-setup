#!/usr/bin/env node

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const inquirer = require('inquirer');
const chalk = require('chalk');

// Configuration management
function getConfigPath() {
  const homeDir = os.homedir();
  const configDir = path.join(homeDir, '.config', 'git-setup');
  const configFile = path.join(configDir, 'config.json');
  return { configDir, configFile };
}

function loadConfig() {
  const { configFile } = getConfigPath();
  
  if (fs.existsSync(configFile)) {
    try {
      const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
      return config;
    } catch (err) {
      log(`Warning: Could not read config file: ${err.message}`, 'warning');
      return null;
    }
  }
  
  return null;
}

function saveConfig(config) {
  const { configDir, configFile } = getConfigPath();
  
  try {
    if (!fs.existsSync(configDir)) {
      fs.mkdirSync(configDir, { recursive: true });
    }
    
    const configData = {
      ...config,
      updatedAt: new Date().toISOString(),
    };
    
    fs.writeFileSync(configFile, JSON.stringify(configData, null, 2), 'utf8');
    return true;
  } catch (err) {
    log(`Error saving config: ${err.message}`, 'error');
    return false;
  }
}

function log(message, type = 'info') {
  const colors = {
    info: chalk.blue,
    success: chalk.green,
    error: chalk.red,
    warning: chalk.yellow,
  };
  console.log(colors[type](message));
}

function error(message) {
  log(message, 'error');
  process.exit(1);
}

function success(message) {
  log(message, 'success');
}

function checkGitInstalled() {
  try {
    execSync('git --version', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function checkSSHInstalled() {
  try {
    execSync('ssh -V', { stdio: 'ignore' });
    return true;
  } catch (err) {
    return false;
  }
}

function getSSHKeyPath() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.ssh', 'id_ed25519_github');
}

function getSSHPublicKeyPath() {
  return `${getSSHKeyPath()}.pub`;
}

function getSSHConfigPath() {
  const homeDir = os.homedir();
  return path.join(homeDir, '.ssh', 'config');
}

function copyToClipboard(text) {
  const platform = process.platform;
  
  try {
    if (platform === 'win32') {
      // Windows
      const proc = spawnSync('clip', [], {
        input: text,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      return proc.status === 0;
    } else if (platform === 'darwin') {
      // macOS
      const proc = spawnSync('pbcopy', [], {
        input: text,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      return proc.status === 0;
    } else {
      // Linux
      const proc = spawnSync('xclip', ['-selection', 'clipboard'], {
        input: text,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      if (proc.status === 0) return true;
      
      // Try xsel as fallback
      const proc2 = spawnSync('xsel', ['--clipboard', '--input'], {
        input: text,
        stdio: ['pipe', 'ignore', 'ignore'],
      });
      return proc2.status === 0;
    }
  } catch (err) {
    return false;
  }
}

function getClipboardCommand() {
  const platform = process.platform;
  if (platform === 'win32') return 'clip';
  if (platform === 'darwin') return 'pbcopy';
  return 'xclip or xsel';
}

async function setupGitIdentity() {
  log('\n=== Git Identity Setup ===', 'info');
  
  // Check current Git config
  let currentName = '';
  let currentEmail = '';
  
  try {
    currentName = execSync('git config --global user.name', { encoding: 'utf8' }).trim();
  } catch (err) {
    // No config set
  }
  
  try {
    currentEmail = execSync('git config --global user.email', { encoding: 'utf8' }).trim();
  } catch (err) {
    // No config set
  }
  
  const { gitName, gitEmail } = await inquirer.prompt([
    {
      type: 'input',
      name: 'gitName',
      message: 'Your full name:',
      default: currentName || '',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Name cannot be empty';
        }
        return true;
      },
    },
    {
      type: 'input',
      name: 'gitEmail',
      message: 'Your email (same as GitHub):',
      default: currentEmail || '',
      validate: (input) => {
        if (!input || input.trim() === '') {
          return 'Email cannot be empty';
        }
        if (!input.includes('@')) {
          return 'Please enter a valid email address';
        }
        return true;
      },
    },
  ]);
  
  try {
    execSync(`git config --global user.name "${gitName.trim()}"`, { stdio: 'inherit' });
    execSync(`git config --global user.email "${gitEmail.trim()}"`, { stdio: 'inherit' });
    success('✓ Git identity configured');
    return { gitName: gitName.trim(), gitEmail: gitEmail.trim() };
  } catch (err) {
    error(`Failed to set Git identity: ${err.message}`);
  }
}

async function setupSSHKey(gitEmail) {
  log('\n=== SSH Key Setup ===', 'info');
  
  const keyPath = getSSHKeyPath();
  const publicKeyPath = getSSHPublicKeyPath();
  const keyExists = fs.existsSync(keyPath);
  
  let shouldCreate = true;
  
  if (keyExists) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `SSH key already exists at ${keyPath}. Overwrite?`,
        default: false,
      },
    ]);
    
    if (!overwrite) {
      log('Skipping SSH key creation.', 'info');
      shouldCreate = false;
    }
  }
  
  if (shouldCreate) {
    try {
      // Remove existing key if overwriting
      if (keyExists) {
        if (fs.existsSync(keyPath)) fs.unlinkSync(keyPath);
        if (fs.existsSync(publicKeyPath)) fs.unlinkSync(publicKeyPath);
      }
      
      // Create .ssh directory if it doesn't exist
      const sshDir = path.dirname(keyPath);
      if (!fs.existsSync(sshDir)) {
        fs.mkdirSync(sshDir, { recursive: true });
        // Set proper permissions on .ssh directory (700)
        if (process.platform !== 'win32') {
          fs.chmodSync(sshDir, '700');
        }
      }
      
      log('Generating SSH key...', 'info');
      execSync(
        `ssh-keygen -t ed25519 -C "${gitEmail}" -f "${keyPath}" -N ""`,
        { stdio: 'inherit' }
      );
      
      // Set proper permissions on private key (600)
      if (process.platform !== 'win32') {
        fs.chmodSync(keyPath, '600');
      }
      
      success('✓ SSH key created');
    } catch (err) {
      error(`Failed to generate SSH key: ${err.message}`);
    }
  }
  
  // Ensure ssh-agent is running and add key
  try {
    if (process.platform !== 'win32') {
      // Start ssh-agent if not running
      execSync('eval "$(ssh-agent -s)"', { stdio: 'ignore', shell: '/bin/bash' });
      
      // Add key to ssh-agent
      try {
        execSync(`ssh-add "${keyPath}"`, { stdio: 'ignore' });
        success('✓ SSH key added to ssh-agent');
      } catch (err) {
        log('Could not add key to ssh-agent (this is okay)', 'warning');
      }
    }
  } catch (err) {
    log('Could not start ssh-agent (this is okay)', 'warning');
  }
  
  // Configure SSH config for GitHub
  await configureSSHConfig(keyPath);
  
  // Read and display public key
  if (fs.existsSync(publicKeyPath)) {
    const publicKey = fs.readFileSync(publicKeyPath, 'utf8').trim();
    
    log('\n--- Add this SSH public key to GitHub ---', 'info');
    log('Go to: Settings → SSH and GPG keys → New SSH key', 'info');
    log('\n' + publicKey + '\n', 'success');
    
    // Try to copy to clipboard
    if (copyToClipboard(publicKey)) {
      success(`✓ Public key copied to clipboard (${getClipboardCommand()})`);
    } else {
      log(`Could not copy to clipboard automatically. Install ${getClipboardCommand()} for clipboard support.`, 'warning');
    }
    
    return publicKey;
  }
  
  return null;
}

async function configureSSHConfig(keyPath) {
  const sshConfigPath = getSSHConfigPath();
  const sshConfigDir = path.dirname(sshConfigPath);
  
  // Create .ssh directory if it doesn't exist
  if (!fs.existsSync(sshConfigDir)) {
    fs.mkdirSync(sshConfigDir, { recursive: true });
    if (process.platform !== 'win32') {
      fs.chmodSync(sshConfigDir, '700');
    }
  }
  
  // Check if GitHub entry already exists
  let configExists = false;
  let configContent = '';
  
  if (fs.existsSync(sshConfigPath)) {
    configContent = fs.readFileSync(sshConfigPath, 'utf8');
    if (configContent.includes('Host github.com')) {
      configExists = true;
    }
  }
  
  if (!configExists) {
    const githubConfig = `\nHost github.com
  HostName github.com
  User git
  IdentityFile ${keyPath}\n`;
    
    try {
      fs.appendFileSync(sshConfigPath, githubConfig, 'utf8');
      
      // Set proper permissions on SSH config (600)
      if (process.platform !== 'win32') {
        fs.chmodSync(sshConfigPath, '600');
      }
      
      success(`✓ Added GitHub entry to ${sshConfigPath}`);
    } catch (err) {
      log(`Warning: Could not update SSH config: ${err.message}`, 'warning');
    }
  } else {
    log('GitHub entry already exists in SSH config', 'info');
  }
}

async function testSSHConnection() {
  log('\n=== Testing SSH Connection ===', 'info');
  
  const { testConnection } = await inquirer.prompt([
    {
      type: 'confirm',
      name: 'testConnection',
      message: 'Test SSH connection to GitHub? (Make sure you\'ve added the SSH key to GitHub first)',
      default: true,
    },
  ]);
  
  if (!testConnection) {
    log('Skipping SSH connection test.', 'info');
    return;
  }
  
  try {
    log('Testing connection...', 'info');
    const result = spawnSync('ssh', ['-T', 'git@github.com'], {
      stdio: 'pipe',
      encoding: 'utf8',
    });
    
    const output = result.stdout + result.stderr;
    
    if (output.includes('successfully authenticated') || output.includes('You\'ve successfully authenticated')) {
      success('✓ SSH connection to GitHub successful!');
    } else if (output.includes('Permission denied')) {
      log('Permission denied. Make sure you\'ve added the SSH key to your GitHub account.', 'warning');
    } else {
      log('SSH connection test completed. Check output above.', 'info');
      console.log(output);
    }
  } catch (err) {
    log(`SSH test failed: ${err.message}`, 'warning');
  }
}

function showConfig() {
  const config = loadConfig();
  const { configFile } = getConfigPath();
  
  if (config) {
    log('\nCurrent Configuration:', 'info');
    if (config.gitName) log(`Git Name: ${config.gitName}`, 'success');
    if (config.gitEmail) log(`Git Email: ${config.gitEmail}`, 'success');
    log(`Config File: ${configFile}`, 'info');
    
    // Show current Git config
    try {
      const gitName = execSync('git config --global user.name', { encoding: 'utf8' }).trim();
      const gitEmail = execSync('git config --global user.email', { encoding: 'utf8' }).trim();
      log(`\nCurrent Git Global Config:`, 'info');
      log(`  Name: ${gitName}`, 'info');
      log(`  Email: ${gitEmail}`, 'info');
    } catch (err) {
      // Git config not set
    }
    
    // Show SSH key info
    const keyPath = getSSHKeyPath();
    if (fs.existsSync(keyPath)) {
      log(`\nSSH Key: ${keyPath}`, 'success');
      if (fs.existsSync(`${keyPath}.pub`)) {
        const publicKey = fs.readFileSync(`${keyPath}.pub`, 'utf8').trim();
        log(`Public Key: ${publicKey}`, 'info');
      }
    } else {
      log('\nSSH Key: Not found', 'warning');
    }
  } else {
    log('No configuration found. Run github-git-setup to configure.', 'warning');
  }
}

function showVersion() {
  try {
    const packageJsonPath = path.join(__dirname, '..', 'package.json');
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    log(`github-git-setup v${packageJson.version}`, 'info');
  } catch (err) {
    log('github-git-setup (version unknown)', 'info');
  }
}

function showHelp() {
  log('\nUsage: github-git-setup [options]', 'info');
  log('\nOptions:', 'info');
  log('  -c, --config              Show current configuration', 'info');
  log('  -v, --version             Show version number', 'info');
  log('  -h, --help                Show this help message', 'info');
  log('\nDescription:', 'info');
  log('  Interactive setup tool for Git and GitHub SSH configuration.', 'info');
  log('  Configures Git identity and generates SSH keys for GitHub.', 'info');
}

// Ensure the script has execute permissions
process.on('exit', () => {
  const scriptPath = __filename;
  try {
    if (process.platform !== 'win32') {
      fs.chmodSync(scriptPath, '755');
    }
  } catch (err) {
    // Ignore chmod errors
  }
});

async function main() {
  // Parse command-line arguments
  const args = process.argv.slice(2);
  
  // Handle config commands
  if (args.length > 0) {
    if (args[0] === '--help' || args[0] === '-h') {
      showHelp();
      process.exit(0);
    }
    
    if (args[0] === '--version' || args[0] === '-v') {
      showVersion();
      process.exit(0);
    }
    
    if (args[0] === '--config' || args[0] === '-c') {
      showConfig();
      process.exit(0);
    }
  }
  
  // Check prerequisites
  if (!checkGitInstalled()) {
    error('Git is not installed or not found in PATH. Please install Git first.');
  }
  
  if (!checkSSHInstalled()) {
    error('SSH is not installed or not found in PATH. Please install SSH first.');
  }
  
  log('\n=== Git & GitHub Setup ===', 'info');
  log('This tool will help you configure Git and set up SSH keys for GitHub.\n', 'info');
  
  // Step 1: Git Identity
  const gitConfig = await setupGitIdentity();
  
  // Step 2: SSH Key
  const publicKey = await setupSSHKey(gitConfig.gitEmail);
  
  // Step 3: Wait for user to add key to GitHub
  if (publicKey) {
    log('\n--- Next Steps ---', 'info');
    log('1. Copy the SSH public key above (already in clipboard if supported)', 'info');
    log('2. Go to GitHub: https://github.com/settings/keys', 'info');
    log('3. Click "New SSH key"', 'info');
    log('4. Paste the key and save', 'info');
    
    await inquirer.prompt([
      {
        type: 'input',
        name: 'continue',
        message: '\nPress Enter after adding the key to GitHub to test the connection...',
      },
    ]);
  }
  
  // Step 4: Test SSH connection
  await testSSHConnection();
  
  // Save configuration
  const config = {
    gitName: gitConfig.gitName,
    gitEmail: gitConfig.gitEmail,
    sshKeyPath: getSSHKeyPath(),
    createdAt: new Date().toISOString(),
  };
  
  saveConfig(config);
  
  log('\n=== Setup Complete! ===', 'success');
  log('Your Git and GitHub SSH configuration is ready to use.', 'info');
}

// Run the main function
main().catch((err) => {
  error(`Unexpected error: ${err.message}`);
});
