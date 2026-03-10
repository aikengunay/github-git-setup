# github-git-setup

A CLI tool for setting up Git identity and GitHub SSH configuration with an interactive setup process.

## Install

### From npm (Recommended)

```bash
npm install -g github-git-setup
```

**Linux users (one-time setup):**

If you get permission errors, configure npm once:

```bash
mkdir -p ~/.npm-global
npm config set prefix '~/.npm-global'
echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.bashrc
source ~/.bashrc
```

After this one-time setup, you can use `npm install -g` for any package without sudo or permission issues.

### From source

For development or to install from source:

```bash
git clone https://github.com/aikengunay/github-git-setup.git
cd github-git-setup
npm install -g .
```

The `-g` flag installs the package globally, making `github-git-setup` available from any directory in your terminal.

## Usage

```bash
github-git-setup
```

Run `github-git-setup` from any directory. The tool will guide you through:

1. **Git Identity Setup**: Configure your name and email
2. **SSH Key Generation**: Create an ED25519 SSH key for GitHub
3. **SSH Config**: Automatically configure SSH for GitHub
4. **Connection Test**: Verify your SSH connection to GitHub

**Examples:**

```bash
# Run setup
github-git-setup

# Show current configuration
github-git-setup --config

# Show version
github-git-setup --version

# Show help
github-git-setup --help
```

## Features

- Interactive Git identity configuration
- Automatic SSH key generation (ED25519)
- SSH config setup for GitHub
- Cross-platform clipboard support (Windows, macOS, Linux)
- SSH connection testing
- Configuration persistence
- Cross-platform support (Windows, macOS, Linux)

## Configuration

### Config Commands

```bash
# Show current configuration
github-git-setup --config

# Show version
github-git-setup --version

# Show help
github-git-setup --help
```

### Config File Location

Config file location: `~/.config/git-setup/config.json`

The tool saves your Git identity and SSH key path for reference, but Git configuration is stored in Git's global config (`git config --global`).

## Requirements

- Node.js 14 or higher
- Git
- SSH (usually pre-installed on macOS/Linux, available for Windows via Git for Windows)

## Platform Support

### Windows

- Uses `clip` command for clipboard
- SSH key permissions are handled automatically
- Works with Git for Windows

### macOS

- Uses `pbcopy` command for clipboard
- Proper SSH key permissions (600) and directory permissions (700)
- ssh-agent integration

### Linux

- Uses `xclip` or `xsel` for clipboard (if available)
- Proper SSH key permissions (600) and directory permissions (700)
- ssh-agent integration
- **Note:** For npm global installs, configure npm prefix to avoid permission errors (see Install section)

## Uninstall

```bash
npm uninstall -g github-git-setup
```

**Note:** This will not remove your Git configuration or SSH keys. To remove those:

```bash
# Remove Git config (optional)
git config --global --unset user.name
git config --global --unset user.email

# Remove SSH key (optional)
rm ~/.ssh/id_ed25519_github
rm ~/.ssh/id_ed25519_github.pub
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT
