# TransPak Frontend (React)

Mobile-first React frontend for **TransPak**, a digital freight exchange / loadboard platform connecting shippers and carriers.

## Tech stack

- React + Vite
- React Router
- Bootstrap 5 + responsive CSS (mobile-first)
- Context API (Auth + global app state)
- Axios (service layer prepared for MERN backend)
- Recharts (dashboard analytics)
- React Icons

## Run locally

1. Install dependencies

```bash
npm install
```

2. Configure backend base URL (optional)

- Copy `.env.example` to `.env`
- Set `VITE_API_URL` to your backend API root (e.g. `http://localhost:5000/api`)

3. Start dev server

```bash
npm run dev
```

## API endpoints expected (MERN)

- `POST /auth/login`
- `POST /auth/register`
- `GET /loads`
- `POST /loads`
- `POST /bids`
- `GET /bids`
- `GET /shipments`
- `POST /tracking`
- `GET /wallet`
- `POST /wallet/pay`

## Notes

- Many screens currently use **dummy data** for presentation; the service layer in `src/services/` is ready to connect to your Express API.
- Mobile navigation uses a **bottom nav** and swaps one item based on user role (shipper/carrier/admin) for better small-screen UX.

