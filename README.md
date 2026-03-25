# BulkCut

A simple, fast, and clean calorie and macro tracking web app for gym users who want to bulk, cut, or maintain.

## Tech Stack
- React (Vite)
- TypeScript
- Tailwind CSS
- Firebase (Auth, Firestore, Security Rules)
- Stripe Payment Links
- Google Gemini API (AI Food Logging)

## Setup Instructions

### 1. Firebase Setup
1. Use the `set_up_firebase` tool in AI Studio to provision your Firebase project.
2. The tool will automatically create the `firebase-applet-config.json` file and set up Firestore and Authentication.
3. Security rules are defined in `firestore.rules` and should be deployed using the `deploy_firebase` tool.

### 2. Stripe Setup
1. Create a Stripe account.
2. Create a Product and a Payment Link.
3. Set the Payment Link's confirmation page to redirect to your app's `/success` route.

### 3. Environment Variables
In AI Studio, click the Settings (gear icon) -> Secrets and add the following:
- `GEMINI_API_KEY`: Your Google Gemini API key (for AI food logging).
- `VITE_STRIPE_PAYMENT_LINK`: Your Stripe Payment Link URL.

### 4. Running the App
The app will automatically build and run in AI Studio once the environment variables are set.

## Features
- **Onboarding**: Calculate daily calorie and macro targets based on age, sex, height, weight, activity level, goal, and pace.
- **Dashboard**: View daily progress against targets, latest bodyweight, and logged meals.
- **Food Logging**: 
  - Quick Add: Manually enter food name, calories, and macros.
  - AI Photo Logging (Premium): Upload a photo of your meal and let AI estimate the nutritional content.
- **Profile**: View stats, log daily bodyweight, and upgrade to Premium.
- **Premium Upgrade**: Simple Stripe Payment Link integration.

## Note on Architecture
This app was built as a React Single Page Application (SPA) using Vite, as requested by the AI Studio environment constraints. The functionality matches the requested requirements, but utilizes a client-side routing approach with `react-router-dom` and direct Firebase integration.
