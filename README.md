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
