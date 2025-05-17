/**
 * Uploads an image file to Cloudflare R2 via an internal Next.js API route.
 * @param imageFile The image file to upload.
 * @returns The public URL of the uploaded image, or null if an error occurs.
 */
export async function uploadImageToCloudflareR2(
  imageFile: File,
): Promise<string | null> {
  try {
    const formData = new FormData();
    formData.append('file', imageFile);
    const res = await fetch('/api/r2/uploadImage', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok || typeof data.url !== 'string') {
      console.error('Error uploading image via API:', data.error || data);
      return null;
    }
    return data.url;
  } catch (err) {
    console.error('uploadImageToCloudflareR2 error:', err);
    return null;
  }
}
