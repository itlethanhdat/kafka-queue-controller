# Vercel One-Click Deployment

## Overview

The Kafka Queue Controller includes a built-in one-click deployment feature for the **development environment**. This allows developers to deploy the application to Vercel with a single click without leaving the application interface.

## Features

- ✅ One-click deployment to Vercel
- ✅ Only visible in development environment (`NODE_ENV=development`)
- ✅ Beautiful deployment UI with configuration preview
- ✅ Automatic repository linking
- ✅ Pre-configured build settings

## How to Use

### 1. Enable Development Mode

Ensure you're running the application in development mode:

```bash
npm run dev
```

The application will automatically start on `http://localhost:3000`

### 2. Access Deploy Button

When running in development mode, you'll see a **"Development Mode"** toolbar at the bottom-right corner of the application with a **"Deploy to Vercel"** button.

### 3. Click Deploy

Simply click the **"Deploy to Vercel"** button to open the Vercel deployment interface.

### 4. Complete Setup on Vercel

The button will redirect you to Vercel with:
- Your GitHub repository pre-selected
- Project name: `kafka-queue-controller`
- Build settings pre-configured

Complete the following steps on Vercel:

1. **Connect GitHub Account** (if not already connected)
2. **Select Repository** (pre-selected as `itlethanhdat/kafka-queue-controller`)
3. **Configure Project**
   - Project Name: `kafka-queue-controller`
   - Framework: Next.js (auto-detected)
   - Build Command: `npm run build`
   - Install Command: `npm install`
4. **Add Environment Variables** (optional)
5. **Deploy**

## Configuration Files

### `vercel.json`
Contains Vercel deployment configuration:
- Framework: Next.js 16.2.6
- Node.js version: 20.x
- Build and install commands
- Environment variables

### `.vercelignore`
Specifies files to ignore during deployment:
- `.git/`
- `node_modules/`
- `.next/`
- `.claude/`
- `.env.local`

## Components

### `src/components/dev/VercelDeployButton.tsx`
- Main deploy button component
- Shows deployment configuration
- Only renders in development environment
- Handles opening Vercel deployment page

### `src/components/dev/DevToolbar.tsx`
- Development toolbar container
- Displays at bottom-right of screen
- Shows "Development Mode" indicator
- Can be dismissed with close button

### `src/app/api/deploy/status/route.ts`
- API endpoint: `GET /api/deploy/status`
- Returns deployment configuration
- Only accessible in development environment
- Provides Vercel Deploy URL and project settings

## Environment Variables

### General

No additional environment variables are required for deployment, but you can customize:

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Set to `development` to show deploy button | auto |
| `VERCEL_REPO_URL` | GitHub repository URL | `https://github.com/itlethanhdat/kafka-queue-controller` |

### Encryption (NEXT_PUBLIC_SECRET_KEY)

Controls how connection credentials are encrypted:

| Mode | Configuration | Use Case |
|------|---------------|----------|
| **Device Mode** | No `NEXT_PUBLIC_SECRET_KEY` set | Default. Each device/browser gets a random encryption key stored in localStorage. Credentials are device-specific. |
| **Secret Mode** | `NEXT_PUBLIC_SECRET_KEY` set | All devices use the same deterministic key. Exported credentials can be imported on any device with the same secret. |

#### Using Device Mode (Default)

- No environment variable needed
- Each device generates a unique encryption key
- Key is stored in browser's localStorage
- Exported credentials work only on that device
- Better for personal use

#### Using Secret Mode

Set `NEXT_PUBLIC_SECRET_KEY` to a strong secret string:

```bash
export NEXT_PUBLIC_SECRET_KEY="your-very-secure-secret-key-min-32-chars"
npm run dev
```

Or in `.env.local`:

```
NEXT_PUBLIC_SECRET_KEY=your-very-secure-secret-key-min-32-chars
```

**On Vercel:**
1. Go to project Settings → Environment Variables
2. Add variable: `NEXT_PUBLIC_SECRET_KEY`
3. Set value to your secret
4. Redeploy

**Benefits of Secret Mode:**
- ✅ Share exported credentials across devices
- ✅ Deterministic encryption (same secret = same key)
- ✅ Portable backups work everywhere with the secret
- ✅ Team collaboration (if secret is shared securely)

**Important:**
- 🔒 Keep `NEXT_PUBLIC_SECRET_KEY` secure
- 🔒 Do not commit to git (use `.env.local` or Vercel secrets)
- 🔒 Use a strong, random secret (minimum 32 characters recommended)
- 🔒 If secret is compromised, all encrypted data is compromised

## Security

- ✅ Deploy button **only visible in development** (`NODE_ENV !== 'development'`)
- ✅ API route restricted to development environment
- ✅ No sensitive data exposed
- ✅ Vercel deploy URL generated dynamically

## Troubleshooting

### Deploy button not showing?

1. Ensure you're running `npm run dev`
2. Check that `NODE_ENV=development`
3. Verify the DevToolbar component is imported in `layout.tsx`
4. Check browser console for errors

### Deployment fails on Vercel?

1. Check build logs on Vercel dashboard
2. Ensure all dependencies are in `package.json`
3. Verify environment variables are set correctly
4. Check that `next.config.ts` is valid

### Can't connect GitHub account?

1. Visit https://vercel.com/dashboard
2. Go to Settings → Connected Git Repositories
3. Connect your GitHub account
4. Try deployment again

## Next Steps After Deployment

1. **Configure Domain**
   - Go to Vercel project settings
   - Add custom domain or use `vercel.app` subdomain

2. **Set Environment Variables**
   - Add any runtime environment variables needed
   - Redeploy if variables are added

3. **Enable Auto-Deploy**
   - Configure automatic deployments on push to main branch
   - Set up preview deployments for pull requests

4. **Monitor Performance**
   - Use Vercel Analytics to monitor application performance
   - Check deployment logs for issues

## Disabling Deploy Button (Production)

The deploy button is automatically hidden when:
- `NODE_ENV` is set to `production`
- Application is deployed to Vercel
- Built application is served with `npm start`

## Support

For issues with:
- **Vercel deployment**: Visit [Vercel Documentation](https://vercel.com/docs)
- **Next.js**: Visit [Next.js Documentation](https://nextjs.org/docs)
- **This project**: Open an issue on GitHub

---

**Happy Deploying!** 🚀
