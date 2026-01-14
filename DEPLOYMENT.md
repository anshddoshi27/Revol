# Google Cloud Deployment Guide

This guide will help you deploy the Tithi application to Google Cloud Platform.

## Prerequisites

1. Google Cloud SDK installed and configured
2. A Google Cloud Project with billing enabled
3. APIs enabled:
   - Cloud Run API
   - Container Registry API
   - Cloud Build API
   - Secret Manager API

## Setup Steps

### 1. Enable Required APIs

```bash
gcloud services enable run.googleapis.com
gcloud services enable containerregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
gcloud services enable secretmanager.googleapis.com
```

### 2. Create Secrets in Secret Manager

Store all sensitive environment variables as secrets:

```bash
# Supabase
echo -n "your-supabase-service-role-key" | gcloud secrets create supabase-service-role-key --data-file=-
echo -n "your-supabase-url" | gcloud secrets create next-public-supabase-url --data-file=-
echo -n "your-supabase-anon-key" | gcloud secrets create next-public-supabase-anon-key --data-file=-

# Stripe
echo -n "your-stripe-secret-key" | gcloud secrets create stripe-secret-key --data-file=-
echo -n "your-stripe-webhook-secret" | gcloud secrets create stripe-webhook-secret --data-file=-
echo -n "your-stripe-plan-with-notifications" | gcloud secrets create stripe-plan-with-notifications --data-file=-
echo -n "your-stripe-plan-without-notifications" | gcloud secrets create stripe-plan-without-notifications --data-file=-

# SendGrid
echo -n "your-sendgrid-api-key" | gcloud secrets create sendgrid-api-key --data-file=-
echo -n "your-sendgrid-from-email" | gcloud secrets create sendgrid-from-email --data-file=-

# Twilio
echo -n "your-twilio-account-sid" | gcloud secrets create twilio-account-sid --data-file=-
echo -n "your-twilio-auth-token" | gcloud secrets create twilio-auth-token --data-file=-
echo -n "your-twilio-from-number" | gcloud secrets create twilio-from-number --data-file=-
```

### 3. Grant Cloud Run Access to Secrets

```bash
PROJECT_NUMBER=$(gcloud projects describe $(gcloud config get-value project) --format="value(projectNumber)")
gcloud projects add-iam-policy-binding $(gcloud config get-value project) \
  --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"
```

### 4. Deploy Using Cloud Build

#### Option A: Using Cloud Build (Recommended)

```bash
# Set your project ID
export PROJECT_ID=$(gcloud config get-value project)

# Submit build
gcloud builds submit --config=cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_SUPABASE_URL="your-supabase-url",_NEXT_PUBLIC_SUPABASE_ANON_KEY="your-supabase-anon-key"
```

#### Option B: Manual Docker Build and Deploy

```bash
# Build the Docker image
docker build -t gcr.io/$PROJECT_ID/tithi-web:latest .

# Push to Container Registry
docker push gcr.io/$PROJECT_ID/tithi-web:latest

# Deploy to Cloud Run
gcloud run deploy tithi-web \
  --image gcr.io/$PROJECT_ID/tithi-web:latest \
  --region us-central1 \
  --platform managed \
  --allow-unauthenticated \
  --port 3000 \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 0 \
  --max-instances 10 \
  --set-env-vars "NEXT_PUBLIC_SUPABASE_URL=your-url,NEXT_PUBLIC_SUPABASE_ANON_KEY=your-key" \
  --set-secrets "SUPABASE_SERVICE_ROLE_KEY=supabase-service-role-key:latest,STRIPE_SECRET_KEY=stripe-secret-key:latest,STRIPE_WEBHOOK_SECRET=stripe-webhook-secret:latest,STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS=stripe-plan-with-notifications:latest,STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS=stripe-plan-without-notifications:latest,SENDGRID_API_KEY=sendgrid-api-key:latest,SENDGRID_FROM_EMAIL=sendgrid-from-email:latest,TWILIO_ACCOUNT_SID=twilio-account-sid:latest,TWILIO_AUTH_TOKEN=twilio-auth-token:latest,TWILIO_FROM_NUMBER=twilio-from-number:latest"
```

### 5. Get Your Deployment URL

After deployment, get your Cloud Run service URL:

```bash
gcloud run services describe tithi-web --region us-central1 --format 'value(status.url)'
```

## Environment Variables

The following environment variables are required:

### Public Variables (set via --set-env-vars)
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

### Secret Variables (set via --set-secrets)
- `SUPABASE_SERVICE_ROLE_KEY`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PLAN_PRICE_ID_WITH_NOTIFICATIONS`
- `STRIPE_PLAN_PRICE_ID_WITHOUT_NOTIFICATIONS`
- `SENDGRID_API_KEY`
- `SENDGRID_FROM_EMAIL`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_FROM_NUMBER`

## Updating Secrets

To update a secret:

```bash
echo -n "new-value" | gcloud secrets versions add secret-name --data-file=-
```

Then redeploy the service to pick up the new secret version.

## Monitoring and Logs

View logs:
```bash
gcloud run services logs read tithi-web --region us-central1
```

View service details:
```bash
gcloud run services describe tithi-web --region us-central1
```

## Troubleshooting

1. **Build fails**: Check that all dependencies are in package.json
2. **Runtime errors**: Check Cloud Run logs for environment variable issues
3. **Secret access denied**: Ensure Cloud Run service account has Secret Manager access
4. **Port issues**: Ensure the app listens on PORT environment variable (Cloud Run sets this)

## Cost Optimization

- `--min-instances 0`: Scale to zero when not in use
- `--max-instances 10`: Limit maximum instances
- Adjust memory and CPU based on actual usage
