Stacy/
├── server.js              ← Express API (20+ routes)
├── package.json
├── .env
├── database/db.js         ← SQLite schema + full seed data
├── middleware/auth.js     ← JWT auth + role guard
└── public/
    ├── index.html         ← Sign In page
    ├── signup.html        ← Client Sign Up page
    ├── admin/dashboard.html
    ├── client/dashboard.html
    ├── css/
    │   ├── global.css     ← Full claymorphism design system
    │   ├── auth.css
    │   ├── admin.css
    │   └── client.css
    └── js/
        ├── theme.js       ← Theme switcher
        ├── admin.js       ← Admin CRUD + 4 charts
        └── client.js      ← Client portal + 2 charts



Role	Email	Password
Admin	admin@nyeriit.com	Admin@2026!
Admin	jane.kamau@nyeriit.com	Nyeri@Admin99
Client	peter.mwangi@savannalogistics.co.ke	Client@2026
Client	grace@kilifintech.co.ke	Client@2026
Client	ali.hassan@serengeti.co.ke	Client@2026
Client	fatuma@baobabhealth.co.ke	Client@2026