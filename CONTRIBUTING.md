# Contributing to SYNTHEX

First off, thank you for considering contributing to SYNTHEX! It's people like you that make SYNTHEX such a great tool.

## Code of Conduct

This project and everyone participating in it is governed by our Code of Conduct. By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check existing issues as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

* **Use a clear and descriptive title**
* **Describe the exact steps to reproduce the problem**
* **Provide specific examples to demonstrate the steps**
* **Describe the behavior you observed and expected**
* **Include screenshots if relevant**
* **Include your environment details**

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

* **Use a clear and descriptive title**
* **Provide a detailed description of the suggested enhancement**
* **Provide specific examples to demonstrate the enhancement**
* **Describe the current behavior and expected behavior**
* **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code follows the existing style
6. Issue that pull request!

## Development Process

1. **Setup Development Environment**
   ```bash
   git clone https://github.com/CleanExpo/Synthex.git
   cd Synthex
   npm install
   cp .env.example .env
   ```

2. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Your Changes**
   - Write clean, maintainable code
   - Follow TypeScript best practices
   - Add comments for complex logic
   - Update tests as needed

4. **Test Your Changes**
   ```bash
   npm test
   npm run lint
   npm run typecheck
   ```

5. **Commit Your Changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
   
   Follow conventional commits:
   - `feat:` New feature
   - `fix:` Bug fix
   - `docs:` Documentation changes
   - `style:` Code style changes
   - `refactor:` Code refactoring
   - `test:` Test changes
   - `chore:` Build process or auxiliary tool changes

6. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   ```

## Style Guidelines

### TypeScript Style

* Use TypeScript for all new code
* Enable strict mode
* Define interfaces for all data structures
* Use async/await over promises
* Prefer const over let

### Git Commit Messages

* Use the present tense ("Add feature" not "Added feature")
* Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
* Limit the first line to 72 characters or less
* Reference issues and pull requests liberally after the first line

### Documentation Style

* Use Markdown for documentation
* Include code examples where relevant
* Keep language clear and concise
* Update README.md if needed

## Testing

* Write tests for all new features
* Ensure all tests pass before submitting PR
* Aim for >80% code coverage
* Test edge cases

## Review Process

1. A maintainer will review your PR
2. They may request changes or ask questions
3. Once approved, your PR will be merged
4. Your contribution will be acknowledged

## Recognition

Contributors will be recognized in:
* The README.md file
* Release notes
* Our website (coming soon)

## Questions?

Feel free to open an issue with your question or reach out on our Discord server.

Thank you for contributing to SYNTHEX! 🚀