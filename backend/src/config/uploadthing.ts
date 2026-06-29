import { createUploadthing, type FileRouter } from "uploadthing/express";

const f = createUploadthing();

export const uploadRouter = {
  imageUploader: f({
    image: {
      maxFileSize: "16MB",
      maxFileCount: 10,
    },
  }).onUploadComplete(async ({ metadata, file }) => {
    console.log("Upload complete for file:", file.url);
    return { uploadedBy: "user", url: file.url };
  }),
} satisfies FileRouter;

export type OurFileRouter = typeof uploadRouter;
