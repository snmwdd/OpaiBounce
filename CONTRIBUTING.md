# Contributing to OpaiBounce

Thanks for your interest in OpaiBounce!

This is a community project that I maintain in my spare time. Bug reports, suggestions, fixes, and other contributions are welcome, but please keep things relevant to the project.

## Reporting Issues

Before opening an issue, please check whether someone has already reported the same problem.

For bug reports, try to include:

- Your LiquidBounce and Minecraft versions
- What happened and what you expected to happen
- Steps to reproduce the issue
- Screenshots or logs, if available
- Whether you have both the OpaiBounce Theme and Script installed

You don't need to follow a complicated template. Just provide enough information for me to understand the problem.

Please don't open issues with random text, meaningless titles, or unrelated content. Issues like these may be closed without a response.

## Feature Requests

Suggestions are welcome, especially if they fit the style and purpose of OpaiBounce.

However, submitting a suggestion doesn't mean it will necessarily be implemented. Some features may be too complicated, outside the project's scope, or simply not something I plan to add.

## Pull Requests

If you want to contribute code, feel free to open a pull request.

A few things to keep in mind:

- Keep your changes focused on one issue or feature.
- Try to follow the existing code style.
- Explain what you changed and why.
- Test your changes before submitting.
- Avoid unnecessary rewrites of unrelated code.
- Don't introduce new dependencies unless there's a good reason.

For larger changes, opening an issue first is recommended so we can discuss the idea before you spend time implementing it.

I may request changes or decline a pull request if it doesn't fit the project.

## Building from Source

OpaiBounce uses Svelte, TypeScript, and Vite.

Requirements:

- Node.js 22+
- Python 3.11+
- JDK 21+

Install dependencies and start the development server:

```bash
npm ci
npm run dev
```

Useful commands:

```bash
npm run check
npm test
npm run test:music
npm run build
npm run verify
npm run package
```

If you're working on the companion Script, check the `script/` directory.

If you're working on the theme UI, most of the relevant files are in `src/`.

The Theme and Script work together, so please consider whether your changes affect both components.

Passing automated tests doesn't guarantee that everything will work correctly in-game. Please test in LiquidBounce when possible.

## Releases and Early Access

Official releases will be published when they're ready.

Please don't repeatedly ask for unreleased builds, private test versions, or early access.

I appreciate your interest, but I can't provide individual builds or guarantee release dates.

You can follow the GitHub repository or LiquidBounce Marketplace for updates.

## Community Guidelines

Please be respectful when interacting with other contributors and users.

Harassment, personal attacks, spam, trolling, and repeated disruptive behavior are not welcome.

Issues and pull requests should be used for actual project discussions, not unrelated conversations.

I reserve the right to close issues, decline contributions, or restrict participation when necessary to keep the project manageable.

## Credits and Licensing

OpaiBounce contains original work as well as adapted components and assets from other projects.

Please respect the existing licenses and preserve the required attribution and copyright notices.

See `LICENSE`, `LICENSE-OPAI-SHELL`, `NOTICE.md`, and the relevant license files for details.

If your contribution includes third-party code or assets, make sure they can legally be redistributed and include the appropriate credits.

## Final Notes

I'm still improving OpaiBounce, and there's always more to work on.

If you find a real problem, have a useful idea, or want to help improve the project, you're welcome to contribute.

Thanks for supporting OpaiBounce!

— snmwdd
