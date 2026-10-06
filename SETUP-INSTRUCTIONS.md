# TechCare setup — Windows

1. [Download TechCare](https://github.com/Vernsmoke/TechCare/archive/refs/heads/main.zip) and extract the ZIP, or clone the repository. If the repository is private, sign in with an account that has access.
2. Install **Node.js 24 or later** from [nodejs.org](https://nodejs.org/).
3. Open **PowerShell** inside the main extracted folder containing `frontend`, `backend`, and the root `package.json`. Run commands there.
4. Run these commands one at a time:

   ```powershell
   npm ci
   npm run setup
   npm run create-admin
   ```

5. Enter your preferred administrator name, email, and password when prompted. The password must be **12–128 characters**. Password typing is hidden.
6. Start the app:

   ```powershell
   npm run dev
   ```

7. Open [http://127.0.0.1:3000](http://127.0.0.1:3000) and sign in using the administrator email and password you just created.

## Access key and accounts

**No API or access key is required.** The built-in help assistant works with local project content.

The GitHub download does not include existing accounts or saved app data. Create your own administrator with `npm run create-admin`, as shown above.

## Opening TechCare again

Open PowerShell in the project folder and run `npm run dev`. You only need to install dependencies, copy the environment file, and create the administrator during the first setup.

Keep PowerShell open while using the app. Press **Ctrl+C** to stop it. Local accounts and uploads are saved in the `data` folder on that computer.

## If “Accept and continue” does not work

Run `npm run check:setup` from the repository root. The root `.env.local` should contain:

```dotenv
TECHCARE_ORIGIN=http://127.0.0.1:3000
TECHCARE_SECURE_COOKIES=0
TECHCARE_DEV_VERIFY=1
```

Open exactly `http://127.0.0.1:3000`. Opening `http://localhost:3000` while the setting says `127.0.0.1` fails the same-origin security check. Do not add a trailing slash or a page path to the setting. Restart the server after changing `.env.local`.

The environment file belongs beside the root `package.json`, not inside `frontend`. It is excluded from GitHub because it can contain SMTP credentials. Each developer runs `npm run setup` once; this command never overwrites existing settings. Do not upload your `.env.local` to GitHub.

## Other computers

These commands run a separate local copy on each developer's computer. `127.0.0.1` always means the device opening the browser; it cannot point a classmate's phone or laptop at your computer. To share one running app, use a configured host and matching HTTPS origin following [operations](docs/OPERATIONS.md). `npm run dev` intentionally listens only on this computer.
