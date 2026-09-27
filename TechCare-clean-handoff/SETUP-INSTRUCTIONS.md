# TechCare setup and access instructions

This package is ready for local development on another computer. It includes the current source code, local database, uploaded media, and the requested administrator and user accounts.

Keep this folder private. The `data/` directory contains account information, and this document contains working login credentials.

## Requirements

- Windows 10/11, macOS, or Linux
- Node.js 24 or later
- An internet connection for the first dependency installation
- About 1 GB of free disk space for the project and installed dependencies

Check the installed Node.js and npm versions:

```powershell
node --version
npm --version
```

The Node.js version must start with `v24` or be newer. If the commands are unavailable, install Node.js 24 or later and reopen the terminal.

## Windows setup

1. Extract `TechCare-clean-handoff.zip` to a normal local folder. Avoid running it directly from inside the ZIP.
2. Open PowerShell or Windows Terminal in the extracted folder—the folder containing `package.json`.
3. Install the exact project dependencies:

   ```powershell
   npm ci
   ```

4. Create the local environment file:

   ```powershell
   Copy-Item .env.example .env.local
   ```

5. Start TechCare:

   ```powershell
   npm run dev
   ```

6. Open <http://127.0.0.1:3000> in a browser.

Keep the terminal open while using the app. Press `Ctrl+C` in that terminal to stop it.

## macOS or Linux setup

From a terminal opened in the extracted project folder, run:

```bash
npm ci
cp .env.example .env.local
npm run dev
```

Then open <http://127.0.0.1:3000>.

## Login credentials

Email addresses are not case-sensitive, but passwords are case-sensitive.

### Administrator access

- Email: `Vern@123gmail.com`
- Password: `Vern.admin_123`
- Role: Administrator

### Standard user access

- Email: `Vernuser123@gmail.com`
- Password: `Vern.user_123`
- Role: Member

No OpenAI or other AI API access key is required. The built-in help assistant uses local project content and does not connect to a personal ChatGPT account.

## Confirm the installation

After `npm ci`, the development team can run these checks:

```powershell
npm test
npm run typecheck
npm run build
```

The local database and media are stored in `data/`. Preserve that directory when moving the working installation if the existing accounts and content must be retained.

## Common problems

### `node` or `npm` is not recognized

Install Node.js 24 or later, close the terminal, and open a new terminal before trying again.

### Port 3000 is already in use

Stop the other process or previous TechCare terminal with `Ctrl+C`, then run `npm run dev` again.

### Dependencies fail to install

Confirm that the computer has internet access and that its date and time are correct, then run `npm ci` again. Do not copy `node_modules` from another computer because native packages can differ between operating systems.

### The accounts or uploads are missing

Confirm that `data/techcare.sqlite3` and `data/media/` are still inside the extracted project folder. Do not run the app from a source-only copy that omits `data/`.

## Before public deployment

The included `.env.example` is configured for local classroom development. Before publishing the site, configure approved SMTP email delivery, HTTPS, secure cookies, persistent storage, backups, and a public origin. Change the supplied passwords before any public or production deployment.
