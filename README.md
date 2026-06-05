# Inmate Profile

Server-ready inmate profile application with backend authentication, role-based access, and server-side record storage. It can use MySQL when database settings are configured, or JSON files for simple local testing.

## Run Locally

```powershell
npm install
npm start
```

Then open:

```text
http://localhost:3000
```

The first time the app runs, it asks you to create the first Super Admin user. Users can have one of these roles:

- Super Admin: can create users, change roles, and edit inmate records/photos.
- Data Entry: can create, edit, save records, and upload photos.
- Read Only: can view records, open the photo modal, navigate records, and generate reports.

## MySQL Setup

1. Create the database and tables by running:

```bash
mysql -u root -p < schema.sql
```

If you already created the database before the Super Admin role was added, run:

```bash
mysql -u root -p < migration-admin-role.sql
```

To create or reset the default Super Admin login, run:

```bash
mysql -u root -p < create-super-admin.sql
```

Default Super Admin:

```text
Username: admin
Password: admin123
```

2. Create a MySQL user, or use an existing one that has access to `inmate_profile_db`.

Example:

```sql
CREATE USER 'inmate_profile_user'@'%' IDENTIFIED BY 'change_this_password';
GRANT SELECT, INSERT, UPDATE, DELETE ON inmate_profile_db.* TO 'inmate_profile_user'@'%';
FLUSH PRIVILEGES;
```

3. Copy `.env.example` to `.env` and edit the database connection values:

```text
DB_HOST=your_mysql_server_ip
DB_PORT=3306
DB_USER=inmate_profile_user
DB_PASSWORD=your_password
DB_NAME=inmate_profile_db
```

4. Start the app:

```bash
npm start
```

If `DB_HOST` is set, the backend uses MySQL. If `DB_HOST` is missing, it uses JSON files.

## JSON Server Data

When MySQL is not configured, the backend stores data in:

```text
data/users.json
data/records.json
data/secret.txt
```

Back up the `data` folder regularly. Do not publish `data/secret.txt`.

## Deploy

Copy the project folder to your server, install Node.js 18 or newer, then run:

```bash
npm install
npm start
```

Optional environment variables:

```bash
PORT=3000
HOST=0.0.0.0
```

## Windows Service Deployment With NSSM

For Windows Server service installation, use:

```powershell
.\deployment\Install-InmateProfileService.ps1
```

Full instructions are in:

```text
deployment\DEPLOYMENT-NSSM.md
```

If NSSM is not installed in PATH, put `nssm.exe` here before running the install script:

```text
tools\nssm\nssm.exe
```

## Keep Changes & Deploy (recommended)

To preserve your UI changes and deploy the app to your server, follow these steps on your development machine and on the target server.

1. Commit your local changes locally (already done if you followed earlier steps):

```bash
git add -A
git commit -m "Apply UI and modal improvements"
```

2. Push to your remote (replace `origin` and `main` if different):

```bash
git push origin main
```

3. On the production server, clone or pull the repo and install dependencies:

```bash
git clone <your-repo-url> /opt/inmate-profile || (cd /opt/inmate-profile && git pull)
cd /opt/inmate-profile
npm install --production
```

4. Start the app with a process manager so it restarts on crash or reboot.

Using pm2 (recommended):

```bash
npm install -g pm2
pm2 start server.js --name inmate-profile --env production -- PORT=3000
pm2 save
pm2 startup
```

Using systemd (example service unit): create `/etc/systemd/system/inmate-profile.service` with:

```ini
[Unit]
Description=Inmate Profile Service
After=network.target

[Service]
WorkingDirectory=/opt/inmate-profile
ExecStart=/usr/bin/node server.js
Restart=always
Environment=PORT=3000
Environment=NODE_ENV=production
User=www-data

[Install]
WantedBy=multi-user.target
```

Then enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable inmate-profile
sudo systemctl start inmate-profile
sudo journalctl -u inmate-profile -f
```

5. Preserve runtime data: back up the `data/` folder regularly (it contains `users.json`, `records.json`, `secret.txt`).

6. Rollbacks and updates: pull latest changes on the server and restart pm2 or systemd:

```bash
cd /opt/inmate-profile && git pull && npm install
pm2 restart inmate-profile   # or: sudo systemctl restart inmate-profile
```

If you want, I can also create a small `deploy.sh` script to automate steps 3–6. Tell me if you'd like that.
