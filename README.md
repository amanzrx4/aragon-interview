# Aragon Image Validation

This is a full-stack web app that takes user uploaded images and runs them through a validation pipeline before storing them. The UI splits images into "Accepted" and "Rejected" buckets based on the backend checks.

### How it works

The frontend passes uploaded files to the backend, which runs 5 sequential checks on every image:

- **Format check**: Only allows JPG, PNG, or HEIC.
- **Size & dimensions**: Enforces minimums of 256x256px and 50KB.
- **Blur detection**: Uses `sharp` to calculate Laplacian variance on grayscale images to filter out blurry photos.
- **Duplicate detection**: Uses `sharp` to generate a perceptual hash (dHash). It compares hashes using Hamming distance to reject visually identical images uploaded in the same browser session.
- **Face detection**: Uses `@tensorflow-models/blazeface` (running on `@tensorflow/tfjs` CPU backend). It rejects images if they have 0 faces, multiple faces, or if the single face is too small compared to the overall image area.

Valid images that pass all checks are pushed to UploadThing for remote storage, and their metadata is saved to a PostgreSQL database using Prisma.

### Tech stack & libraries

- **Frontend**: Next.js (React), BlueprintJS for icons and UI elements.
- **Backend**: Express, Prisma, PostgreSQL, UploadThing.
- **Image Processing**: `sharp` (handles blur detection, hashing, resizing, and HEIC-to-JPEG conversion).
- **Machine Learning**: `@tensorflow/tfjs` (pure JS CPU backend to avoid native binding compatibility issues) and `@tensorflow-models/blazeface`.
