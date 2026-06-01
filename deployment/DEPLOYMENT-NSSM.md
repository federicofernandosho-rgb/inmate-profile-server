# Windows NSSM Deployment — Inmate Profile Server

This package runs the Inmate Profile app as a Windows service using NSSM.
All Node.js dependencies are **pre-bundled** — no internet access or `npm install` required on the server.

## Server Requirements

| Requirement | Details |
|---|---|
| OS | Windows Server (any modern version) |
| Node.js | 18 or newer (`node.exe` in PATH or `C:\Program Files\nodejs`) |
| NSSM | Already installed on the server (confirmed) |
| MySQL | Reachable at `pims:3308`, database `inmate_profile_db` |

## Deployment Steps

### 1. Copy the Folder

Copy the entire `InmateProfileServer` folder to the target server:

```text
C:\Apps\InmateProfileServer
```

The folder must contain:

```
InmateProfileServer\
  app.js
  index.html
  styles.css
  server.js
  package.json
  .env                   ← pre-configured for pims / port 3000 / MySQL
  node_modules\          ← pre-bundled (no npm install needed)
  data\                  ← created automatically on first run
  logs\                  ← created automatically on first run
  schema.sql
  migration-admin-role.sql
  create-super-admin.sql
  deployment\
    Install-InmateProfileService.ps1
    Start-InmateProfileService.ps1
    Stop-InmateProfileService.ps1
    Uninstall-InmateProfileService.ps1
```

### 2. Verify `.env`

The `.env` file is already configured:

```ini
PORT=3000
HOST=0.0.0.0

DB_HOST=pims
DB_PORT=3308
DB_USER=root
DB_PASSWORD=r00t@xs431u
DB_NAME=inmate_profile_db
DB_CONNECTION_LIMIT=10
```

No changes needed unless the database credentials change.

### 3. Run the MySQL Schema (first time only)

If the database tables do not exist yet, run the following from a machine with `mysql` CLI access:

```powershell
Get-Content .\schema.sql | mysql -h pims -P 3308 -u root -p
Get-Content .\migration-admin-role.sql | mysql -h pims -P 3308 -u root -p
Get-Content .\create-super-admin.sql | mysql -h pims -P 3308 -u root -p
```

Default super-admin credentials (change after first login):

```
Username: admin
Password: admin123
```

### 4. Create the NSSM Service (Manual — you said you prefer this)

Open **PowerShell as Administrator** on the `pims` server and run:

```powershell
nssm install InmateProfile "C:\Program Files\nodejs\node.exe" "C:\Apps\InmateProfileServer\server.js"
nssm set InmateProfile AppDirectory "C:\Apps\InmateProfileServer"
nssm set InmateProfile AppStdout "C:\Apps\InmateProfileServer\logs\service-output.log"
nssm set InmateProfile AppStderr "C:\Apps\InmateProfileServer\logs\service-error.log"
nssm set InmateProfile AppRotateFiles 1
nssm set InmateProfile AppRotateOnline 1
nssm set InmateProfile AppRotateBytes 10485760
nssm set InmateProfile Start SERVICE_AUTO_START
nssm set InmateProfile DisplayName "Inmate Profile"
nssm set InmateProfile Description "Inmate Profile Node.js web application"
```

> **Note:** Adjust the `node.exe` path if Node.js is installed on a different drive (e.g., `D:\Program Files\nodejs\node.exe`).

Create the logs directory first if it doesn't exist:

```powershell
New-Item -ItemType Directory -Path "C:\Apps\InmateProfileServer\logs" -Force
```

Then start the service:

```powershell
nssm start InmateProfile
```

### 5. Verify

Open a browser and navigate to:

```
http://pims:3000
```

## Service Management

```powershell
# Start
nssm start InmateProfile

# Stop
nssm stop InmateProfile

# Restart
nssm restart InmateProfile

# Remove service
nssm remove InmateProfile confirm
```

Or use the included scripts:

```powershell
cd C:\Apps\InmateProfileServer
.\deployment\Start-InmateProfileService.ps1
.\deployment\Stop-InmateProfileService.ps1
.\deployment\Uninstall-InmateProfileService.ps1
```

## Log Files

```
C:\Apps\InmateProfileServer\logs\service-output.log   ← stdout
C:\Apps\InmateProfileServer\logs\service-error.log    ← stderr (errors here)
```

## Notes

- `node_modules` is pre-bundled — **no internet access required on the server**.
- The `.env` file is read on startup by `server.js` directly (no `dotenv` package needed).
- The `data\` folder stores a JWT secret on first run — do **not** delete it or all sessions will be invalidated.
- If you move the folder to a different path, update the `AppDirectory` and log paths in NSSM accordingly.
