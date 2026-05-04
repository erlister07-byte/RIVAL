# RIVAL

RIVAL is an Expo / React Native project that can run in the browser and on mobile with Expo Go.

## Prerequisites

- Node.js
- npm
- Expo Go on your mobile device

## Setup

1. Clone the repository:

   ```bash
   git clone <your-repo-url>
   ```

2. Change into the project directory:

   ```bash
   cd RIVAL
   ```

3. Install dependencies:

   ```bash
   npm install
   ```

4. Create your local environment file:

   ```bash
   cp .env.example .env
   ```

5. Fill in the public Supabase and Firebase environment variables in `.env`.

## Run the app

Start the Expo development server:

```bash
npx expo start
```

- Press `w` to open the app in the browser.
- Scan the QR code with Expo Go to run the app on mobile.

## Notes

- Real secrets are not committed to the repository.
- Keep your local `.env` file private and out of git.
