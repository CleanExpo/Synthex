#!/usr/bin/env node
/**
 * Find Button components without onClick handlers
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

class ButtonFinder {
  constructor() {
    this.inertButtons = [];
    this.totalButtons = 0;
    this.buttonsByFile = {};
  }

  findInertButtons() {
    console.log('🔍 Searching for Button components without onClick handlers...\n');

    // Find all TSX/JSX files
    const files = glob.sync('app/**/*.{tsx,jsx}', {
      ignore: ['**/node_modules/**', '**/storybook-static/**']
    });

    for (const file of files) {
      this.scanFile(file);
    }

    this.generateReport();
  }

  scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Skip if no Button import
    if (!content.includes('Button')) return;

    const lines = content.split('\n');
    const buttons = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNum = i + 1;

      // Find Button components
      if (line.includes('<Button')) {
        this.totalButtons++;
        
        // Check if this button has onClick in the same line or following lines
        let hasOnClick = false;
        let buttonText = '';
        let endFound = false;
        let checkLines = 10; // Check next 10 lines for multi-line buttons
        
        for (let j = i; j < Math.min(i + checkLines, lines.length) && !endFound; j++) {
          const checkLine = lines[j];
          
          if (checkLine.includes('onClick')) {
            hasOnClick = true;
          }
          
          // Extract button text
          const textMatch = checkLine.match(/>(.*?)</);
          if (textMatch && textMatch[1].trim()) {
            buttonText = textMatch[1].trim();
          }
          
          // Check if button tag ends
          if (checkLine.includes('</Button>') || checkLine.includes('/>')) {
            endFound = true;
          }
        }

        if (!hasOnClick) {
          buttons.push({
            line: lineNum,
            text: buttonText || '(no text)',
            snippet: line.trim()
          });
          this.inertButtons.push({
            file: filePath,
            line: lineNum,
            text: buttonText || '(no text)',
            snippet: line.trim()
          });
        }
      }
    }

    if (buttons.length > 0) {
      this.buttonsByFile[filePath] = buttons;
    }
  }

  generateReport() {
    console.log('📊 Button Analysis Report');
    console.log('========================\n');
    
    console.log(`Total Button components found: ${this.totalButtons}`);
    console.log(`Buttons without onClick: ${this.inertButtons.length}\n`);

    if (this.inertButtons.length === 0) {
      console.log('✅ All buttons have onClick handlers!');
      return;
    }

    console.log('❌ Buttons missing onClick handlers:\n');
    
    // Group by file
    for (const [file, buttons] of Object.entries(this.buttonsByFile)) {
      console.log(`📄 ${file}:`);
      for (const button of buttons) {
        console.log(`   Line ${button.line}: ${button.text}`);
        console.log(`   ${button.snippet}`);
      }
      console.log('');
    }

    // Generate fix patches
    this.generateFixPatches();
  }

  generateFixPatches() {
    const patchDir = path.join(__dirname, 'patches');
    if (!fs.existsSync(patchDir)) {
      fs.mkdirSync(patchDir, { recursive: true });
    }

    // Create a comprehensive fix script
    const fixes = [];
    
    for (const button of this.inertButtons) {
      const handler = this.suggestHandler(button.text);
      fixes.push({
        file: button.file,
        line: button.line,
        text: button.text,
        suggestedHandler: handler
      });
    }

    fs.writeFileSync(
      path.join(patchDir, 'button-fixes.json'),
      JSON.stringify(fixes, null, 2)
    );

    console.log(`\n💡 Fix suggestions saved to: patches/button-fixes.json`);
  }

  suggestHandler(buttonText) {
    const text = buttonText.toLowerCase();
    
    // Common button patterns
    if (text.includes('save')) return 'handleSave';
    if (text.includes('submit')) return 'handleSubmit';
    if (text.includes('cancel')) return 'handleCancel';
    if (text.includes('delete')) return 'handleDelete';
    if (text.includes('edit')) return 'handleEdit';
    if (text.includes('add')) return 'handleAdd';
    if (text.includes('create')) return 'handleCreate';
    if (text.includes('update')) return 'handleUpdate';
    if (text.includes('refresh')) return 'handleRefresh';
    if (text.includes('download')) return 'handleDownload';
    if (text.includes('upload')) return 'handleUpload';
    if (text.includes('export')) return 'handleExport';
    if (text.includes('import')) return 'handleImport';
    if (text.includes('connect')) return 'handleConnect';
    if (text.includes('disconnect')) return 'handleDisconnect';
    if (text.includes('login') || text.includes('sign in')) return 'handleLogin';
    if (text.includes('logout') || text.includes('sign out')) return 'handleLogout';
    if (text.includes('register') || text.includes('sign up')) return 'handleRegister';
    
    return 'handleClick';
  }
}

// Run the scanner
const finder = new ButtonFinder();
finder.findInertButtons();