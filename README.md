# Property Post Hub

Node.js 20+ required.

```bash
npm install
ADMIN_USER=owner ADMIN_PASSWORD='choose-a-long-password' SESSION_SECRET='choose-another-long-random-secret' npm start
```

Open http://localhost:3000. Configure a persistent disk for `properties.sqlite` and `uploads/` before deployment. HTTPS reverse proxy and persistent session store are recommended for production. No Facebook scraping is performed; add public post URLs, text and verified original images manually. Owner-only create/edit/delete/upload endpoints. No items are preloaded because none could be independently verified.
